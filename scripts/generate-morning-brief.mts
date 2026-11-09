/**
 * Morning Brief Agent — IBO Desk
 *
 * Runs once a day (08:00 Mauritius = 04:00 UTC via GitHub Actions).
 * Builds a substantial editorial brief directly from the verified consensus board.
 *
 * This intentionally has no generative-AI dependency: every figure and claim in
 * the brief is derived from board.json, so the daily copy is repeatable,
 * auditable, and unaffected by API keys, quotas, or model hallucinations.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "docs");
const boardPath = join(outDir, "board.json");
const catalogPath = join(outDir, "catalog.js");
const briefPath = join(outDir, "morning-brief.json");

function deskDateIst(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function deskDateMauritius(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Indian/Mauritius",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function readJson<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

const todayMu = deskDateMauritius();
const todayIst = deskDateIst();

if (process.env.FORCE_BRIEF !== "1") {
  const existing = readJson<{ briefDate?: string; body?: string; lede?: string }>(briefPath);
  const usable =
    existing &&
    (existing.briefDate === todayMu || existing.briefDate === todayIst) &&
    (existing.body?.trim().length ?? 0) >= 800 &&
    (existing.lede?.trim().length ?? 0) >= 40;
  if (usable) {
    console.log(
      `Morning brief already exists for ${existing!.briefDate} — skipping. Set FORCE_BRIEF=1 to regenerate.`,
    );
    const { generateSeoPages } = await import("./generate-seo-pages.mts");
    await generateSeoPages();
    process.exit(0);
  }
}

type FilmRow = {
  id: string;
  title: string;
  language: string;
  industry?: string;
  releaseDate: string;
  status: string;
  verdict: string;
  budgetCr: number | null;
  indiaNet: number;
  worldwide: number;
  lastDayNet: number | null;
  trackedThroughDay: number | null;
  liveSources: string[];
  deltaNet: number | null;
  deltaWw: number | null;
};

type Board = {
  generatedAt?: string;
  deskDate?: string;
  films?: FilmRow[];
};

type Brief = {
  briefDate: string;
  generatedAt: string;
  headline: string;
  lede: string;
  body: string;
  citations: { url: string; title?: string }[];
  boardGeneratedAt: string | null;
  model: string;
};

const board = readJson<Board>(boardPath);
const films = board?.films ?? [];
if (!films.length) {
  console.warn("board.json has no films — run `npm run publish:desk` first.");
  process.exit(1);
}

const ranked = [...films]
  .filter((film) => Number.isFinite(film.worldwide))
  .sort((a, b) => b.worldwide - a.worldwide);
const currentRanked = [...films]
  .filter((film) => film.status !== "closed" && film.lastDayNet != null && film.lastDayNet > 0)
  .sort((a, b) => (b.lastDayNet ?? 0) - (a.lastDayNet ?? 0));
const movers = [...films]
  .filter((film) => {
    if (film.deltaWw == null || !Number.isFinite(film.deltaWw)) return false;
    const abs = Math.abs(film.deltaWw);
    // Ignore absurd swings (usually unit/parse artefacts) and tiny noise.
    if (abs < 0.5) return false;
    if (film.worldwide > 0 && abs > film.worldwide * 0.85) return false;
    if (abs > 80) return false;
    return true;
  })
  .sort((a, b) => Math.abs(b.deltaWw ?? 0) - Math.abs(a.deltaWw ?? 0));
const top = ranked[0];
const currentTop = currentRanked[0];
const deskDayMs = Date.parse(`${todayIst}T12:00:00+05:30`);

function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "n/a";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr`;
}

function deltaLabel(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || Math.abs(n) < 0.05) return "no change";
  return `${n >= 0 ? "+" : ""}${n.toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr`;
}

function languageLabel(film: FilmRow): string {
  if (film.language && film.language !== "Indian") return film.language;
  return film.industry || "Indian cinema";
}

function ageDays(film: FilmRow): number | null {
  const released = Date.parse(`${film.releaseDate}T12:00:00+05:30`);
  if (!Number.isFinite(released)) return null;
  return Math.max(0, Math.floor((deskDayMs - released) / 86_400_000));
}

function recentReleases(): FilmRow[] {
  return films
    .filter((film) => film.status !== "closed")
    .filter((film) => {
      const age = ageDays(film);
      return age != null && age >= 0 && age <= 14;
    })
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
}

function languageSplitLine(): string {
  const buckets = new Map<string, { count: number; nett: number }>();
  for (const film of currentRanked.slice(0, 12)) {
    const key = languageLabel(film);
    const prev = buckets.get(key) ?? { count: 0, nett: 0 };
    prev.count += 1;
    prev.nett += film.lastDayNet ?? 0;
    buckets.set(key, prev);
  }
  const rankedBuckets = [...buckets.entries()].sort((a, b) => b[1].nett - a[1].nett);
  if (!rankedBuckets.length) return "Language mix on the daily chart is still settling.";
  return rankedBuckets
    .slice(0, 5)
    .map(([label, row]) => `${label}: ${row.count} title${row.count === 1 ? "" : "s"} contributing about ${fmt(row.nett)} of latest-day India nett among the top tracked films`)
    .join("; ");
}

function buildBrief(): Brief {
  const leader = currentTop;
  const second = currentRanked[1];
  const third = currentRanked[2];
  const recent = recentReleases();
  const opener = recent.find((f) => (f.trackedThroughDay ?? ageDays(f) ?? 99) <= 3) ?? recent[0];

  const headline = leader
    ? `India box office: ${leader.title} leads the latest daily chart at ${fmt(leader.lastDayNet)}`
    : "Indian Box Office morning brief";

  const lede = leader
    ? `${leader.title} leads the latest reported daily India nett at ${fmt(leader.lastDayNet)} on Day ${leader.trackedThroughDay ?? "—"}, taking cumulative India nett to ${fmt(leader.indiaNet)} and worldwide gross to ${fmt(leader.worldwide)} on the Indian Box Office consensus desk.`
    : "The Indian Box Office consensus board has been refreshed from the latest available theatrical reports.";

  const rankingBullets = currentRanked.slice(0, 8).map((film, index) => {
    const day = film.trackedThroughDay ?? "—";
    return `- ${index + 1}. ${film.title} (${languageLabel(film)}) — ${fmt(film.lastDayNet)} on Day ${day}; cumulative India nett ${fmt(film.indiaNet)}; WW ${fmt(film.worldwide)}`;
  });

  const sections: string[] = [];

  sections.push(
    `Good morning. This is the Indian Box Office morning brief for ${todayIst} (IST desk date), written from the verified consensus board rather than any single trade headline. India still has no official theatrical auditor; every rupee figure below is a desk estimate, labelled so India nett is never confused with worldwide gross.`,
  );

  if (leader) {
    sections.push(`## Daily chart leader`);
    sections.push(
      `${leader.title} sits at the top of the latest-day India nett ranking with ${fmt(leader.lastDayNet)} on Day ${leader.trackedThroughDay ?? "—"}. Cumulative India nett is ${fmt(leader.indiaNet)}; worldwide gross on this desk is ${fmt(leader.worldwide)}. The title is filed as ${languageLabel(leader)} and currently carries a working status of ${leader.status} with verdict ${leader.verdict}.`,
    );
    if (second) {
      sections.push(
        `${second.title} is next on the daily chart at ${fmt(second.lastDayNet)} (Day ${second.trackedThroughDay ?? "—"}, cumulative India nett ${fmt(second.indiaNet)})${
          third
            ? `, with ${third.title} third at ${fmt(third.lastDayNet)}`
            : ""
        }. Gaps between the top three matter more than the order alone: a soft midweek day for a long-runner can look “small” in absolute crores while still being a healthy hold for its week of release.`,
      );
    }
  }

  sections.push(`## Latest daily ranking`);
  sections.push(
    `Here is the desk’s latest-day India nett order among currently tracked theatrical titles (not a lifetime worldwide leaderboard):`,
  );
  if (rankingBullets.length) {
    sections.push(rankingBullets.join("\n"));
  } else {
    sections.push(`No current daily collection figures are available on the board yet.`);
  }

  sections.push(`## Openers and recent releases`);
  if (opener) {
    const age = ageDays(opener);
    sections.push(
      `Among films released in the last two weeks, ${opener.title} is the one to watch closely: released ${opener.releaseDate}${age != null ? ` (${age} day${age === 1 ? "" : "s"} ago)` : ""}, latest reported India nett ${fmt(opener.lastDayNet)} with cumulative India nett ${fmt(opener.indiaNet)} and worldwide ${fmt(opener.worldwide)}. Early days are the most volatile part of any run — Day 1 and the first weekday drop usually say more about screens and word of mouth than a lifetime total published weeks later.`,
    );
  }
  if (recent.length) {
    const lines = recent.slice(0, 6).map((film) => {
      return `- ${film.title} (released ${film.releaseDate}, ${languageLabel(film)}) — latest day ${fmt(film.lastDayNet)}; cumulative India nett ${fmt(film.indiaNet)}`;
    });
    sections.push(`Recent theatrical watchlist:`);
    sections.push(lines.join("\n"));
  } else {
    sections.push(`No fresh theatrical openers are currently represented with a daily figure on the board.`);
  }

  sections.push(`## Holds, momentum, and lifetime context`);
  if (movers.length) {
    const entries = movers.slice(0, 4).map((film) => {
      const indiaMove =
        film.deltaNet != null && Math.abs(film.deltaNet) >= 0.5 && Math.abs(film.deltaNet) < 80
          ? `; India nett ${deltaLabel(film.deltaNet)}`
          : "";
      return `${film.title} ${deltaLabel(film.deltaWw)} worldwide${indiaMove}`;
    });
    sections.push(
      `Since the previous board snapshot, notable lifetime moves include: ${entries.join("; ")}. Treat snapshot-to-snapshot deltas as orientation — ingest repairs and late reports can restate a total without meaning the film “earned” that swing in a single calendar day.`,
    );
  } else {
    sections.push(
      `No clean mid-sized worldwide moves cleared the desk’s sanity filters since the previous snapshot. When deltas look extreme, we prefer to wait for the next ingest rather than narrate a bad parse.`,
    );
  }
  if (top && (!leader || top.id !== leader.id)) {
    sections.push(
      `Lifetime context: ${top.title} remains the cumulative worldwide leader on this board at ${fmt(top.worldwide)} (India nett ${fmt(top.indiaNet)}). That is a career-to-date total, not today’s daily chart.`,
    );
  }

  sections.push(`## Language circuits`);
  sections.push(
    `Across the top of the daily chart, circuit mix looks like this — ${languageSplitLine()}. Hindi, South Indian, and Hollywood titles can share the same national chart while living on very different screen footprints; compare like with like when judging a Day 8 versus a Day 1.`,
  );

  sections.push(`## How to read today’s brief`);
  sections.push(
    `Use the home board for the live “this week” stack, open individual film pages for the full day-wise table and analysis, and keep this brief as the morning narrative layer. Definitions: India nett is domestic after entertainment tax/GST; worldwide gross is global ticket revenue before those deductions. Methodology and corrections live on the desk’s public policy pages. Publisher: Kevin Boyjonauth · Indian Box Office.`,
  );

  const body = sections.join("\n\n");

  return {
    briefDate: todayMu,
    generatedAt: new Date().toISOString(),
    headline: headline.slice(0, 110),
    lede,
    body,
    citations: [],
    boardGeneratedAt: board?.generatedAt ?? null,
    model: "deterministic-editorial-v2",
  };
}

function injectBrief(brief: Brief) {
  if (existsSync(catalogPath)) {
    const raw = readFileSync(catalogPath, "utf8");
    const match = raw.match(/^window\.IBO_CATALOG\s*=\s*([\s\S]*);\s*$/);
    if (match) {
      try {
        const pack = JSON.parse(match[1]) as Record<string, unknown>;
        pack.morningBrief = brief;
        writeFileSync(catalogPath, `window.IBO_CATALOG = ${JSON.stringify(pack, null, 2)};\n`);
        console.log("✓ Injected morningBrief into docs/catalog.js");
      } catch (error) {
        console.warn("Could not inject catalog.js:", error);
      }
    }
  }

  const boardPack = readJson<Record<string, unknown>>(boardPath);
  if (boardPack) {
    boardPack.morningBrief = brief;
    writeFileSync(boardPath, `${JSON.stringify(boardPack, null, 2)}\n`);
    console.log("✓ Injected morningBrief into docs/board.json");
  }
}

const brief = buildBrief();
writeFileSync(briefPath, `${JSON.stringify(brief, null, 2)}\n`);
injectBrief(brief);

const { generateSeoPages } = await import("./generate-seo-pages.mts");
await generateSeoPages();

console.log("✓ Morning brief written → docs/morning-brief.json");
console.log(`  Headline: ${brief.headline}`);
console.log(`  Body chars: ${brief.body.length}`);
console.log(`  Model: ${brief.model}`);
