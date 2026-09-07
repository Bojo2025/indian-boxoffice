import { getSql } from "@/lib/db";
import {
  MOVIES,
  SEEDED_HEADLINES,
  SEEDED_REPORT,
  SERIES,
  SOURCES,
  TERRITORIES,
  dateForDay,
} from "./catalog";
import { buildConsensus } from "./consensus";
import { round2 } from "./consensus";
import type { Reading } from "./types";

let seeding: Promise<void> | null = null;

type SqlClient = Awaited<ReturnType<typeof getSql>>;

async function upsertCatalog(sql: SqlClient) {
  for (const s of SOURCES) {
    await sql`
      insert into sources (id, name, homepage, kind, weight, notes)
      values (${s.id}, ${s.name}, ${s.homepage}, ${s.kind}, ${s.weight}, ${s.notes})
      on conflict (id) do update set name = excluded.name, homepage = excluded.homepage, kind = excluded.kind, weight = excluded.weight, notes = excluded.notes
    `;
  }
  for (const m of MOVIES) {
    await sql`
      insert into movies (id, slug, title, language, industry, director, starring, release_date, budget_cr, runtime_min, synopsis, poster_key, status, verdict)
      values (${m.id}, ${m.slug}, ${m.title}, ${m.language}, ${m.industry}, ${m.director}, ${m.starring}, ${m.releaseDate}, ${m.budgetCr}, ${m.runtimeMin}, ${m.synopsis}, ${m.posterKey}, ${m.status}, ${m.verdict})
      on conflict (id) do update set title = excluded.title, language = excluded.language, status = excluded.status, verdict = excluded.verdict, synopsis = excluded.synopsis, poster_key = excluded.poster_key
    `;
  }
}

export async function ensureSeeded(): Promise<void> {
  if (seeding) return seeding;
  seeding = (async () => {
    const sql = await getSql();
    const count = await sql<{ n: number }>`select count(*)::int as n from movies`;
    if ((count[0]?.n ?? 0) > 0) {
      await upsertCatalog(sql);
      return;
    }
    await seedAll();
  })().finally(() => {
    seeding = null;
  });
  return seeding;
}

export async function seedAll(): Promise<void> {
  const sql = await getSql();
  await upsertCatalog(sql);

  const movieById = new Map(MOVIES.map((m) => [m.id, m]));

  const readings: Reading[] = [];
  for (const series of SERIES) {
    const movie = movieById.get(series.movieId);
    if (!movie) continue;
    for (const p of series.points) {
      const reportDate = dateForDay(movie.releaseDate, p.day);
      const note = [series.mode === "lifetime" ? "lifetime" : "", p.note ?? ""].filter(Boolean).join(" · ");
      await sql`
        insert into readings (movie_id, source_id, report_date, day_number, india_net, india_gross, overseas, worldwide, screens, occupancy, note)
        values (${series.movieId}, ${series.sourceId}, ${reportDate}, ${p.day}, ${p.indiaNet ?? null}, ${p.indiaGross ?? null}, ${p.overseas ?? null}, ${p.worldwide ?? null}, ${p.screens ?? null}, ${p.occupancy ?? null}, ${note})
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
      readings.push({
        movieId: series.movieId,
        sourceId: series.sourceId,
        reportDate,
        dayNumber: p.day,
        indiaNet: p.indiaNet ?? null,
        indiaGross: p.indiaGross ?? null,
        overseas: p.overseas ?? null,
        worldwide: p.worldwide ?? null,
        screens: p.screens ?? null,
        occupancy: p.occupancy ?? null,
        note,
      });
    }
  }

  const weights = Object.fromEntries(SOURCES.map((s) => [s.id, s.weight]));
  const dailyReadings = readings.filter((r) => !r.note.startsWith("lifetime"));
  const consensus = buildConsensus(dailyReadings, weights);
  for (const d of consensus) {
    await sql`
      insert into consensus_days (movie_id, report_date, day_number, india_net, india_gross, overseas, worldwide, net_change_pct, disagreement_pct, screens, occupancy)
      values (${d.movieId}, ${d.reportDate}, ${d.dayNumber}, ${d.indiaNet}, ${d.indiaGross}, ${d.overseas}, ${d.worldwide}, ${d.netChangePct}, ${d.disagreementPct}, ${d.screens}, ${d.occupancy})
      on conflict (movie_id, report_date) do update set
        india_net = excluded.india_net,
        india_gross = excluded.india_gross,
        overseas = excluded.overseas,
        worldwide = excluded.worldwide,
        net_change_pct = excluded.net_change_pct,
        disagreement_pct = excluded.disagreement_pct,
        screens = excluded.screens,
        occupancy = excluded.occupancy
    `;
  }

  const lifetimeReadings = readings.filter((r) => r.note.startsWith("lifetime"));
  const moviesWithDaily = new Set(consensus.map((d) => d.movieId));
  const lifetimeOnly = lifetimeReadings.filter((r) => !moviesWithDaily.has(r.movieId));
  const lifetimeConsensus = buildConsensus(lifetimeOnly, weights);
  for (const d of lifetimeConsensus) {
    await sql`
      insert into consensus_days (movie_id, report_date, day_number, india_net, india_gross, overseas, worldwide, net_change_pct, disagreement_pct, screens, occupancy)
      values (${d.movieId}, ${d.reportDate}, ${d.dayNumber}, ${d.indiaNet}, ${d.indiaGross}, ${d.overseas}, ${d.worldwide}, ${d.netChangePct}, ${d.disagreementPct}, ${d.screens}, ${d.occupancy})
      on conflict (movie_id, report_date) do nothing
    `;
  }

  for (const t of TERRITORIES) {
    await sql`
      insert into territory_splits (movie_id, report_date, territory, india_net)
      values (${t.movieId}, ${t.reportDate}, ${t.territory}, ${t.indiaNet})
      on conflict (movie_id, report_date, territory) do update set india_net = excluded.india_net
    `;
  }

  for (const n of SEEDED_HEADLINES) {
    await sql`
      insert into news_items (source_id, title, url, published_at, summary)
      values (${n.sourceId}, ${n.title}, ${n.url}, ${n.publishedAt}, ${n.summary})
      on conflict (url) do nothing
    `;
  }

  await sql`
    insert into reports (report_date, headline, lede, body, origin)
    values (${SEEDED_REPORT.reportDate}, ${SEEDED_REPORT.headline}, ${SEEDED_REPORT.lede}, ${SEEDED_REPORT.body}, ${SEEDED_REPORT.origin})
    on conflict (report_date) do nothing
  `;

  await sql`
    insert into ingest_log (source_id, status, detail)
    values (${"desk"}, ${"ok"}, ${"Seeded compiled desk snapshot for 31 Aug 2026. Live wires: Wikipedia API, ETimes RSS, The Hindu RSS. Koimoi / Indian Express / Hungama HTML are bot-walled; their figures are ingested from published day-wise tables."})
  `;
}

export function lifetimeToDailyNote(note: string): boolean {
  return note.startsWith("lifetime");
}

export { round2 };
