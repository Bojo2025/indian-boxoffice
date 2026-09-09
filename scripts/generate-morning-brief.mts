/**
 * Morning Brief Agent — IBO Desk
 *
 * Runs once a day (targeting 08:00 Mauritius = 04:00 UTC via GitHub Actions).
 * 1. Reads the latest board.json (already produced by publish:desk).
 * 2. Calls Gemini free-tier (optional Google Search) for a trade-paper brief.
 * 3. Writes docs/morning-brief.json and injects it into catalog.js / board.json
 *    so the Pages homepage can show a teaser + expandable full brief.
 *
 * Idempotent unless FORCE_BRIEF=1. Falls back to a deterministic board brief
 * if Gemini is missing, rate-limited, or returns truncated text.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "docs");
const boardPath = join(outDir, "board.json");
const catalogPath = join(outDir, "catalog.js");
const briefPath = join(outDir, "morning-brief.json");

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const WANT_SEARCH = process.env.GEMINI_SEARCH === "1";

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

function readJson<T>(p: string): T | null {
  try {
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf8")) as T;
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

const playing = films.filter((f) => f.status === "playing");
const ranked = [...films].sort((a, b) => b.worldwide - a.worldwide);
const movers = [...films]
  .filter((f) => f.deltaWw != null && Math.abs(f.deltaWw) >= 0.5)
  .sort((a, b) => Math.abs(b.deltaWw ?? 0) - Math.abs(a.deltaWw ?? 0));
const top = ranked[0];
const topMover = movers[0];

function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "n/a";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr`;
}

function deltaLabel(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || Math.abs(n) < 0.05) return "";
  return `${n >= 0 ? "+" : ""}${n.toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr`;
}

function templateBrief(): Brief {
  const leadFilm = topMover ?? top;
  const headline = leadFilm
    ? topMover
      ? `${leadFilm.title} moves ${deltaLabel(leadFilm.deltaWw)} worldwide`
      : `${leadFilm.title} leads the board at ${fmt(leadFilm.worldwide)} WW`
    : "Indian Box Office morning board";

  const lede = top
    ? `${top.title} sits at ${fmt(top.worldwide)} worldwide / ${fmt(top.indiaNet)} India nett on the consensus desk.`
    : "Consensus desk refreshed from Sacnilk, Hungama, Koimoi and Box Office India.";

  const moverLines = movers.slice(0, 4).map((f) => {
    const parts = [`${f.title}: WW ${deltaLabel(f.deltaWw)}`];
    if (f.deltaNet != null && Math.abs(f.deltaNet) >= 0.5) {
      parts.push(`India net ${deltaLabel(f.deltaNet)}`);
    }
    return parts.join(", ");
  });

  const playingLine =
    playing.length > 0
      ? `Now playing: ${playing
          .slice(0, 5)
          .map((f) => `${f.title} (${fmt(f.worldwide)} WW)`)
          .join("; ")}.`
      : "No titles marked playing on this board.";

  const wireLine = headlines[0]
    ? `Wire: ${headlines[0].title} (${headlines[0].sourceId}).`
    : "No fresh wires on this board pull.";

  const body = [
    moverLines.length
      ? `Day-over-day movers on the consensus board — ${moverLines.join(". ")}.`
      : "No material day-over-day moves since the last board snapshot.",
    playingLine,
    wireLine,
    "Figures are weighted-median consensus across trade trackers. India has no official auditor.",
  ].join("\n\n");

  return {
    briefDate: todayMu,
    generatedAt: new Date().toISOString(),
    headline: headline.slice(0, 90),
    lede,
    body,
    citations: headlines.slice(0, 5).map((h) => ({ url: h.url, title: h.title })),
    boardGeneratedAt: board?.generatedAt ?? null,
    model: "board-template",
  };
}

function parseModelText(text: string): { headline: string; lede: string; body: string } {
  const lines = text.split("\n");
  const headline =
    (lines.find((l) => /^HEADLINE:/i.test(l)) ?? "").replace(/^HEADLINE:\s*/i, "").trim() ||
    "Indian Box Office morning brief";
  const lede =
    (lines.find((l) => /^LEDE:/i.test(l)) ?? "").replace(/^LEDE:\s*/i, "").trim() || "";
  const bodyStart = lines.findIndex((l) => /^BODY:/i.test(l));
  const body =
    bodyStart >= 0
      ? lines
          .slice(bodyStart)
          .join("\n")
          .replace(/^BODY:\s*/i, "")
          .trim()
      : text.replace(/^HEADLINE:.*$/im, "").replace(/^LEDE:.*$/im, "").trim();
  return { headline, lede, body };
}

function isComplete(parts: { headline: string; lede: string; body: string }): boolean {
  if (parts.headline.length < 8) return false;
  if (parts.lede.length < 24) return false;
  if (parts.body.length < 60) return false;
  // Truncation heuristics
  if (/[,:;–—-]\s*$/.test(parts.lede)) return false;
  if (/\b(to|the|a|an|and|of|for|as|at|in)\s*$/i.test(parts.lede)) return false;
  return true;
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
      } catch (err) {
        console.warn("Could not inject catalog.js:", err);
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

function writeBrief(brief: Brief) {
  writeFileSync(briefPath, `${JSON.stringify(brief, null, 2)}\n`);
  injectBrief(brief);
  console.log(`✓ Morning brief written → docs/morning-brief.json`);
  console.log(`  Headline: ${brief.headline}`);
  console.log(`  Model: ${brief.model}`);
  console.log(`  Citations: ${brief.citations.length}`);
}

const rows = films
  .slice(0, 20)
  .map((f) => {
    const delta =
      f.deltaWw != null ? ` (${f.deltaWw >= 0 ? "+" : ""}${f.deltaWw} Cr WW since last board)` : "";
    const day = f.trackedThroughDay ? ` day ${f.trackedThroughDay}` : "";
    const live = f.liveSources?.length ? ` [${f.liveSources.join("+")}]` : "";
    const budget = f.budgetCr ? ` budget ₹${f.budgetCr} Cr` : "";
    return `${f.title} (${f.language},${day} ${f.status}): India net ₹${f.indiaNet} Cr · WW ₹${f.worldwide} Cr${delta} · verdict ${f.verdict}${budget}${live}`;
  })
  .join("\n");

const wireLines = headlines
  .slice(0, 8)
  .map((h) => `• [${h.sourceId}] ${h.title}${h.summary ? ` — ${h.summary}` : ""}`)
  .join("\n");

const boardStamp = board?.generatedAt
  ? new Date(board.generatedAt).toLocaleString("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }) + " IST"
  : "recent";

const SYSTEM = `You are the IBO Desk morning brief writer — staff analyst of Indian Box Office, an independent consensus desk for theatrical collections in India.

Style rules:
- Figures in ₹ crore. India nett domestic; worldwide gross global.
- Note tracker disagreement when relevant. No hype words. Short trade-paper sentences.
- Under 220 words total.

Return EXACTLY these labels, nothing else:
HEADLINE: <max 12 words>
LEDE: <one complete sentence>
BODY: <2-3 complete short paragraphs>`;

const USER = `Today is ${todayMu} (Mauritius). Write today's IBO Desk morning brief from this consensus snapshot (generated ${boardStamp}).

Board:
${rows}

Wires:
${wireLines || "(none)"}

Cite tracker names when giving figures. Finish every sentence. Keep under 220 words.`;

type GeminiResponse = {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    groundingMetadata?: {
      groundingChunks?: { web?: { uri?: string; title?: string } }[];
    };
  }[];
  error?: { message?: string };
};

async function callGemini(withSearch: boolean): Promise<GeminiResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: USER }] }],
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: 1200,
    },
  };
  if (withSearch) payload.tools = [{ google_search: {} }];

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as GeminiResponse;
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${data.error?.message ?? JSON.stringify(data)}`);
  if (data.error?.message) throw new Error(data.error.message);
  return data;
}

const fallback = templateBrief();
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY not set — writing board-template brief.");
  writeBrief(fallback);
  process.exit(0);
}

console.log(`Calling Gemini (${MODEL})${WANT_SEARCH ? " with search" : " (board-only prompt)"}…`);

let data: GeminiResponse | null = null;
const attempts = WANT_SEARCH ? [false, true] : [false];
for (const withSearch of attempts) {
  try {
    data = await callGemini(withSearch);
    break;
  } catch (err) {
    console.warn(`Gemini call failed (${withSearch ? "search" : "plain"}): ${err instanceof Error ? err.message : err}`);
  }
}

if (!data) {
  console.warn("Gemini unavailable — writing board-template brief.");
  writeBrief(fallback);
  process.exit(0);
}

const text =
  data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim() ?? "";

const chunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
const citations = chunks
  .map((c) => ({ url: c.web?.uri ?? "", title: c.web?.title ?? c.web?.uri ?? "" }))
  .filter((c) => c.url)
  .slice(0, 10);

console.log("Gemini response:\n", text, "\n");

const parsed = parseModelText(text);
if (!isComplete(parsed)) {
  console.warn("Gemini returned incomplete brief — using board-template instead.");
  writeBrief(fallback);
  process.exit(0);
}

writeBrief({
  briefDate: todayMu,
  generatedAt: new Date().toISOString(),
  headline: parsed.headline,
  lede: parsed.lede,
  body: parsed.body,
  citations: citations.length
    ? citations
    : headlines.slice(0, 5).map((h) => ({ url: h.url, title: h.title })),
  boardGeneratedAt: board?.generatedAt ?? null,
  model: MODEL,
});
