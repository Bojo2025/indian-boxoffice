import { MOVIES, SOURCES } from "./catalog";
import { buildConsensus } from "./consensus";
import { deskDate, num, numOrNull } from "./format";
import type { Reading, TerritorySplit } from "./types";

const STALE_MS = 20 * 60 * 1000;
let inflight: Promise<IngestPersistResult> | null = null;

export type IngestPersistResult = {
  ok: true;
  skipped: boolean;
  headlines: number;
  readings: number;
  movies: number;
  wikiRows: number;
  logs: { sourceId: string; status: string; detail: string }[];
};

type Sql = {
  query: <T>(text: string, params?: unknown[]) => Promise<T[]>;
  <T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
};

async function lastDeskPull(sql: Sql): Promise<number | null> {
  const rows = await sql<{ fetched_at: string }>`
    select fetched_at::text as fetched_at
    from ingest_log
    where source_id = 'desk' and status = 'ok'
    order by fetched_at desc
    limit 1
  `;
  if (!rows[0]?.fetched_at) return null;
  const t = Date.parse(rows[0].fetched_at);
  return Number.isFinite(t) ? t : null;
}

async function writeReadings(sql: Sql, readings: Reading[]) {
  const keys = new Set(readings.map((r) => `${r.movieId}\t${r.sourceId}`));
  for (const key of keys) {
    const [movieId, sourceId] = key.split("\t");
    await sql`delete from readings where movie_id = ${movieId} and source_id = ${sourceId}`;
  }
  for (const r of readings) {
    await sql`
      insert into readings (movie_id, source_id, report_date, day_number, india_net, india_gross, overseas, worldwide, screens, occupancy, note)
      values (${r.movieId}, ${r.sourceId}, ${r.reportDate}, ${r.dayNumber}, ${r.indiaNet}, ${r.indiaGross}, ${r.overseas}, ${r.worldwide}, ${r.screens}, ${r.occupancy}, ${r.note})
      on conflict (movie_id, source_id, report_date) do update set
        india_net = excluded.india_net,
        india_gross = excluded.india_gross,
        overseas = excluded.overseas,
        worldwide = excluded.worldwide,
        screens = excluded.screens,
        occupancy = excluded.occupancy,
        note = excluded.note,
        day_number = excluded.day_number
    `;
  }
}

async function writeTerritories(sql: Sql, rows: TerritorySplit[]) {
  for (const t of rows) {
    await sql`
      insert into territory_splits (movie_id, report_date, territory, india_net)
      values (${t.movieId}, ${t.reportDate}, ${t.territory}, ${t.indiaNet})
      on conflict (movie_id, report_date, territory) do update set india_net = excluded.india_net
    `;
  }
}

async function rebuildConsensus(sql: Sql, movieIds: string[]) {
  const weights = Object.fromEntries(SOURCES.map((s) => [s.id, s.weight]));
  for (const id of movieIds) {
    const rows = await sql<{
      movie_id: string;
      source_id: string;
      report_date: string;
      day_number: number;
      india_net: string | number | null;
      india_gross: string | number | null;
      overseas: string | number | null;
      worldwide: string | number | null;
      screens: number | null;
      occupancy: string | number | null;
      note: string;
    }>`
      select movie_id, source_id, report_date::text as report_date, day_number,
             india_net, india_gross, overseas, worldwide, screens, occupancy, note
      from readings
      where movie_id = ${id}
    `;
    const mapped: Reading[] = rows.map((r) => ({
      movieId: r.movie_id,
      sourceId: r.source_id,
      reportDate: r.report_date,
      dayNumber: num(r.day_number),
      indiaNet: numOrNull(r.india_net),
      indiaGross: numOrNull(r.india_gross),
      overseas: numOrNull(r.overseas),
      worldwide: numOrNull(r.worldwide),
      screens: r.screens,
      occupancy: numOrNull(r.occupancy),
      note: r.note,
    }));
    const daily = mapped.filter((r) => !r.note.startsWith("lifetime") && r.reportDate < "2099-01-01");
    const lifetime = mapped.filter((r) => r.note.startsWith("lifetime") || r.reportDate >= "2099-01-01");
    const source = daily.length ? daily : lifetime;
    const consensus = buildConsensus(source, weights);
    await sql`delete from consensus_days where movie_id = ${id}`;
    for (const d of consensus) {
      await sql`
        insert into consensus_days (movie_id, report_date, day_number, india_net, india_gross, overseas, worldwide, net_change_pct, disagreement_pct, screens, occupancy)
        values (${d.movieId}, ${d.reportDate}, ${d.dayNumber}, ${d.indiaNet}, ${d.indiaGross}, ${d.overseas}, ${d.worldwide}, ${d.netChangePct}, ${d.disagreementPct}, ${d.screens}, ${d.occupancy})
      `;
    }
  }
}

function cr(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `\u20B9${n.toLocaleString("en-IN", { maximumFractionDigits: n >= 100 ? 1 : 2 })} Cr`;
}

async function writeLiveReport(
  sql: Sql,
  logs: { sourceId: string; status: string; detail: string }[],
) {
  const rows = await sql<{
    id: string;
    title: string;
    language: string;
    status: string;
    verdict: string;
    budget_cr: string | number | null;
    india_net: string | number | null;
    worldwide: string | number | null;
    day_number: number | null;
  }>`
    select m.id, m.title, m.language, m.status, m.verdict, m.budget_cr,
      greatest(
        coalesce((select sum(c.india_net) from consensus_days c where c.movie_id = m.id), 0),
        coalesce((select max(r.india_net) from readings r where r.movie_id = m.id and r.note like 'lifetime%'), 0)
      ) as india_net,
      greatest(
        coalesce((select sum(c.worldwide) from consensus_days c where c.movie_id = m.id), 0),
        coalesce((select max(r.worldwide) from readings r where r.movie_id = m.id and r.note like 'lifetime%'), 0)
      ) as worldwide,
      (select day_number from consensus_days c where c.movie_id = m.id order by report_date desc limit 1) as day_number
    from movies m
    order by worldwide desc
  `;

  const playing = rows.filter((r) => r.status === "playing" || r.status === "late");
  const lead = playing[0];
  const today = deskDate();
  const ok = logs.filter((l) => l.status === "ok").map((l) => l.sourceId);
  const blocked = logs.filter((l) => l.status === "blocked");
  const liveSources = [...new Set(ok)];

  const headline = lead
    ? `${lead.title} stands at ${cr(num(lead.india_net))} India net after ${lead.day_number ?? "—"} days`
    : "Live collections are on the board";
  const lede = `Live pull from ${liveSources.join(", ") || "the desk"}${
    blocked.length ? `. ${blocked.map((b) => b.sourceId).join(", ")} blocked` : ""
  }. Consensus is a weighted median. India net is the working unit; worldwide is gross.`;

  const boardLines = playing
    .slice(0, 8)
    .map(
      (r) =>
        `- **${r.title}** (${r.language}, day ${r.day_number ?? "—"}): India net ${cr(num(r.india_net))}, worldwide ${cr(num(r.worldwide))}. Verdict ${r.verdict}.`,
    )
    .join("\n");

  const yearLines = rows
    .slice(0, 8)
    .map((r, i) => `${i + 1}. ${r.title} — ${cr(num(r.worldwide))} WW / ${cr(num(r.india_net))} India net`)
    .join("\n");

  const logLines = logs.map((l) => `- ${l.sourceId}: ${l.status} — ${l.detail}`).join("\n");

  const body = `The Indian box office still has no official auditor. These figures were scraped from the public trackers and compiled on ${today}.

## The board, live

${boardLines || "No playing titles returned from the pull."}

${lead ? `**${lead.title}** is the lead on the theatrical board. India net ${cr(num(lead.india_net))} through day ${lead.day_number ?? "—"}. Worldwide ${cr(num(lead.worldwide))}.` : ""}

## The year

${yearLines}

## The argument

Sacnilk is the all-India daily spine. Bollywood Hungama is often Hindi-weighted — on a pan-India film the opening can read at roughly half of Sacnilk. Wikipedia compiles worldwide gross and lags. Koimoi HTML is routinely bot-walled; when it is, the last published table stays on the file and is labelled as such.

${blocked.length ? `Blocked this pull: ${blocked.map((b) => `${b.sourceId} (${b.detail})`).join("; ")}.` : "Every requested tracker answered."}

## What the wires returned

${logLines}

Figures in crore. Consensus is a weighted median, not a vibe. Producer claims never set the number on their own.`;

  await sql`
    insert into reports (report_date, headline, lede, body, origin)
    values (${today}, ${headline}, ${lede}, ${body}, ${"desk"})
    on conflict (report_date) do update set
      headline = excluded.headline,
      lede = excluded.lede,
      body = excluded.body,
      origin = excluded.origin,
      generated_at = now()
  `;
}

async function runIngest(sql: Sql): Promise<IngestPersistResult> {
  try {
    const { ingestLiveSources } = await import("./scrape");
    const result = await ingestLiveSources();

    for (const h of result.headlines) {
      await sql`
        insert into news_items (source_id, title, url, published_at, summary)
        values (${h.sourceId}, ${h.title}, ${h.url}, ${h.publishedAt}, ${h.summary})
        on conflict (url) do update set title = excluded.title, summary = excluded.summary, published_at = excluded.published_at
      `;
    }

    await writeReadings(sql, result.readings);
    await writeTerritories(sql, result.territories);
    const movieIds = [...new Set(result.readings.map((r) => r.movieId))];
    if (movieIds.length) await rebuildConsensus(sql, movieIds);
    await writeLiveReport(sql, result.logs);

    for (const log of result.logs) {
      await sql`
        insert into ingest_log (source_id, status, detail)
        values (${log.sourceId}, ${log.status}, ${log.detail})
      `;
    }
    const titles = movieIds
      .map((id) => MOVIES.find((m) => m.id === id)?.title ?? id)
      .slice(0, 6)
      .join(", ");
    const summary = `Live scrape: ${result.readings.length} collection rows across ${movieIds.length} titles (${titles}). Headlines ${result.headlines.length}.`;
    await sql`
      insert into ingest_log (source_id, status, detail)
      values (${"desk"}, ${"ok"}, ${summary})
    `;

    return {
      ok: true,
      skipped: false,
      headlines: result.headlines.length,
      readings: result.readings.length,
      movies: movieIds.length,
      wikiRows: result.wikiRows.length,
      logs: result.logs,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Ingest failed";
    await sql`
      insert into ingest_log (source_id, status, detail)
      values (${"desk"}, ${"blocked"}, ${detail})
    `;
    return {
      ok: true,
      skipped: false,
      headlines: 0,
      readings: 0,
      movies: 0,
      wikiRows: 0,
      logs: [{ sourceId: "desk", status: "blocked", detail }],
    };
  }
}

export async function ingestIfStale(opts: { force?: boolean } = {}): Promise<IngestPersistResult> {
  const { getSql } = await import("@/lib/db");
  const { ensureSeeded } = await import("./seed");
  await ensureSeeded();
  const sql = (await getSql()) as unknown as Sql;

  if (!opts.force) {
    const last = await lastDeskPull(sql);
    const lastDetail = await sql<{ detail: string }>`
      select detail from ingest_log
      where source_id = 'desk' and status = 'ok'
      order by fetched_at desc
      limit 1
    `;
    const isLive = /live scrape/i.test(lastDetail[0]?.detail ?? "");
    if (isLive && last != null && Date.now() - last < STALE_MS) {
      return {
        ok: true,
        skipped: true,
        headlines: 0,
        readings: 0,
        movies: 0,
        wikiRows: 0,
        logs: [{ sourceId: "desk", status: "ok", detail: "Fresh enough — last live pull under 20 minutes." }],
      };
    }
  }

  if (inflight) return inflight;
  inflight = runIngest(sql).finally(() => {
    inflight = null;
  });
  return inflight;
}

export function scrapeStamp(): string {
  return deskDate();
}
