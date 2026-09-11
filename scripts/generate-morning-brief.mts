/**
 * Morning Brief Agent — IBO Desk
 *
 * Runs once a day (08:00 Mauritius = 04:00 UTC via GitHub Actions).
 * Builds a concise editorial brief directly from the verified consensus board.
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
    (existing.body?.trim().length ?? 0) >= 40 &&
    (existing.lede?.trim().length ?? 0) >= 20;
  if (usable) {
    console.log(
      `Morning brief already exists for ${existing!.briefDate} — skipping. Set FORCE_BRIEF=1 to regenerate.`,
    );
    process.exit(0);
  }
}

type FilmRow = {
  id: string;
  title: string;
  language: string;
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

type Headline = {
  sourceId: string;
  title: string;
  url: string;
  publishedAt?: string | null;
  summary?: string | null;
};

type Board = {
  generatedAt?: string;
  deskDate?: string;
  films?: FilmRow[];
  headlines?: Headline[];
  health?: {
    hardFail?: boolean;
    alerts?: string[];
    spine?: Record<string, { ok?: boolean }>;
  };
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
  .filter((film) => film.deltaWw != null && Math.abs(film.deltaWw) >= 0.5)
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

function currentRankingLine(): string {
  if (!currentRanked.length) return "No current daily collection figures are available.";
  return currentRanked
    .slice(0, 5)
    .map(
      (film, index) =>
        `${index + 1}. ${film.title} — ${fmt(film.lastDayNet)} on Day ${film.trackedThroughDay ?? "—"}; cumulative India nett ${fmt(film.indiaNet)}`,
    )
    .join(" | ");
}

function recentReleaseLine(): string {
  const recent = films
    .filter((film) => film.status !== "closed")
    .filter((film) => {
      const ageMs = deskDayMs - Date.parse(`${film.releaseDate}T12:00:00+05:30`);
      return ageMs >= 0 && ageMs <= 45 * 86_400_000;
    })
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))
    .slice(0, 4);
  if (!recent.length) return "No recent release is currently represented with a daily figure.";
  return recent
    .map(
      (film) =>
        `${film.title} (released ${film.releaseDate}) — latest India nett ${fmt(film.lastDayNet)}`,
    )
    .join("; ");
}

function momentumLine(): string {
  if (!movers.length) {
    return "No material day-over-day worldwide move of ₹0.5 Cr or more was recorded in the latest board comparison.";
  }

  const entries = movers.slice(0, 3).map((film) => {
    const indiaMove =
      film.deltaNet != null && Math.abs(film.deltaNet) >= 0.5
        ? `; India nett ${deltaLabel(film.deltaNet)}`
        : "";
    return `${film.title} ${deltaLabel(film.deltaWw)} worldwide${indiaMove}`;
  });
  return `Momentum: ${entries.join("; ")} since the previous board snapshot.`;
}

// Reports feed health as counts only — individual tracker names are never
// exposed to readers.
function deskNote(): string {
  const spine = board?.health?.spine ?? {};
  const feeds = Object.values(spine);
  const degraded = feeds.filter((feed) => feed?.ok === false).length;
  if (!feeds.length && (board?.health?.alerts?.length ?? 0) > 0) {
    return "Desk health: some feeds are degraded on this pull. Figures remain the weighted-median consensus of the trackers still reporting; India has no official box-office auditor.";
  }
  if (degraded > 0) {
    const noun = degraded === 1 ? "feed is" : "feeds are";
    return `Desk health: ${degraded} of ${feeds.length} tracker ${noun} unreachable on this pull. Figures remain the weighted-median consensus of the trackers still reporting; India has no official box-office auditor.`;
  }
  return "Desk health is clear, with every tracker feed reporting. Figures are the weighted-median consensus of those feeds; India has no official box-office auditor.";
}

function buildBrief(): Brief {
  const headline = currentTop
    ? `India box office: ${currentTop.title} leads the latest daily chart at ${fmt(currentTop.lastDayNet)}`
    : "Indian Box Office morning brief";
  const lede = currentTop
    ? `${currentTop.title} leads the latest reported daily India nett at ${fmt(currentTop.lastDayNet)} on Day ${currentTop.trackedThroughDay ?? "—"}; its cumulative India nett is ${fmt(currentTop.indiaNet)}.`
    : "The IBO consensus board has been refreshed from the latest available tracker data.";
  const body = [
    `Latest reported daily ranking: ${currentRankingLine()}.`,
    `Recent-release watch: ${recentReleaseLine()}.`,
    top
      ? `Lifetime context: ${top.title} remains the cumulative worldwide leader at ${fmt(top.worldwide)}, but that is not the current daily chart.`
      : "Lifetime totals are unavailable on this board pull.",
    momentumLine(),
    deskNote(),
  ].join("\n\n");

  return {
    briefDate: todayMu,
    generatedAt: new Date().toISOString(),
    headline: headline.slice(0, 100),
    lede,
    body,
    // Readers never see tracker attribution, so the brief ships no citations.
    citations: [],
    boardGeneratedAt: board?.generatedAt ?? null,
    model: "deterministic-editorial-v1",
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
console.log("✓ Morning brief written → docs/morning-brief.json");
console.log(`  Headline: ${brief.headline}`);
console.log(`  Model: ${brief.model}`);
console.log(`  Citations: ${brief.citations.length}`);
