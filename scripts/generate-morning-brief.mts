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
  health?: { hardFail?: boolean; alerts?: string[] };
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
const headlines = board?.headlines ?? [];

if (!films.length) {
  console.warn("board.json has no films — run `npm run publish:desk` first.");
  process.exit(1);
}

const ranked = [...films]
  .filter((film) => Number.isFinite(film.worldwide))
  .sort((a, b) => b.worldwide - a.worldwide);
const movers = [...films]
  .filter((film) => film.deltaWw != null && Math.abs(film.deltaWw) >= 0.5)
  .sort((a, b) => Math.abs(b.deltaWw ?? 0) - Math.abs(a.deltaWw ?? 0));
const top = ranked[0];

function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "n/a";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr`;
}

function deltaLabel(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || Math.abs(n) < 0.05) return "no change";
  return `${n >= 0 ? "+" : ""}${n.toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr`;
}

function rankingLine(): string {
  return ranked
    .slice(0, 5)
    .map(
      (film, index) =>
        `${index + 1}. ${film.title} — India nett ${fmt(film.indiaNet)}; worldwide ${fmt(film.worldwide)}`,
    )
    .join(" | ");
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

function deskNote(): string {
  const alerts = board?.health?.alerts ?? [];
  if (alerts.length) {
    const visibleAlerts = alerts.slice(0, 2).join("; ");
    return `Desk health: ${visibleAlerts}. Figures remain the weighted-median consensus of the available trackers; India has no official box-office auditor.`;
  }
  return "Desk health is clear. Figures are the weighted-median consensus of the available trade trackers; India has no official box-office auditor.";
}

function buildBrief(): Brief {
  const headline = top
    ? `India box office: ${top.title} leads at ${fmt(top.worldwide)} worldwide`
    : "Indian Box Office morning brief";
  const lede = top
    ? `${top.title} leads the current IBO consensus board at ${fmt(top.worldwide)} worldwide, including ${fmt(top.indiaNet)} in India nett.`
    : "The IBO consensus board has been refreshed from the latest available tracker data.";
  const body = [
    `Current board ranking: ${rankingLine()}.`,
    momentumLine(),
    deskNote(),
  ].join("\n\n");

  return {
    briefDate: todayMu,
    generatedAt: new Date().toISOString(),
    headline: headline.slice(0, 100),
    lede,
    body,
    citations: headlines.slice(0, 5).map((headline) => ({
      url: headline.url,
      title: headline.title,
    })),
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
