/**
 * Morning Brief Agent — IBO Desk
 *
 * Runs once a day (targeting 08:00 Mauritius = 04:00 UTC via GitHub Actions).
 * 1. Reads the latest board.json (already produced by publish:desk).
 * 2. Calls Gemini (free-tier AI Studio) with Google Search grounding for
 *    Indian box office news from the last 24 hours.
 * 3. Writes docs/morning-brief.json consumed by the homepage.
 *
 * Idempotent: if a brief for today already exists it exits early unless FORCE_BRIEF=1.
 * If GEMINI_API_KEY is absent it exits gracefully (no paid fallback).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "docs");
const boardPath = join(outDir, "board.json");
const briefPath = join(outDir, "morning-brief.json");

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

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
  const existing = readJson<{ briefDate?: string }>(briefPath);
  if (existing?.briefDate === todayMu || existing?.briefDate === todayIst) {
    console.log(
      `Morning brief already exists for ${existing.briefDate} — skipping. Set FORCE_BRIEF=1 to regenerate.`,
    );
    process.exit(0);
  }
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn(
    "GEMINI_API_KEY not set — morning brief skipped. Add it to GitHub Secrets → GEMINI_API_KEY.",
  );
  process.exit(0);
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

const board = readJson<Board>(boardPath);
const films = board?.films ?? [];
const headlines = board?.headlines ?? [];

if (!films.length) {
  console.warn("board.json has no films — run `npm run publish:desk` first.");
  process.exit(1);
}

const rows = films
  .slice(0, 20)
  .map((f) => {
    const delta =
      f.deltaWw != null
        ? ` (${f.deltaWw >= 0 ? "+" : ""}${f.deltaWw} Cr WW since last board)`
        : "";
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

const SYSTEM = `You are the IBO Desk morning brief writer — the staff analyst of Indian Box Office, an independent consensus desk covering theatrical collections in India.

Style rules:
- Figures in ₹ crore. India nett for domestic; worldwide gross for global.
- India has no official box-office auditor. Note source spread when trackers disagree.
- Be a trade paper, not a fan account. Short declarative sentences. No hype words.
- Producer statements are claims — log them, do not launder into consensus.
- Under 220 words total (headline + lede + body combined).

Output format — return EXACTLY these labelled lines, nothing else:
HEADLINE: <max 12 words, the day's single most important number or story>
LEDE: <one sentence, the most important fact>
BODY: <2-3 short paragraphs covering: top earner of the day/weekend; notable holds or drops; upcoming releases this week if any; source spread / tracker disagreement if notable>`;

const USER = `Today is ${todayMu} (Mauritius time). Search the web for Indian box office news published in the last 24 hours, then write today's IBO Desk morning brief.

Board snapshot (generated ${boardStamp}):
${rows}

Recent wires from tracked sources:
${wireLines || "(none scraped yet today)"}

Use both the web search results AND the snapshot to write the brief. Cite tracker names when giving figures. Keep the brief under 220 words.`;

console.log(`Calling Gemini (${MODEL}) with Google Search grounding…`);

type GeminiResponse = {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    groundingMetadata?: {
      groundingChunks?: { web?: { uri?: string; title?: string } }[];
    };
  }[];
  error?: { message?: string; code?: number; status?: string };
};

async function callGemini(withSearch: boolean): Promise<GeminiResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: USER }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 700,
    },
  };
  if (withSearch) payload.tools = [{ google_search: {} }];

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as GeminiResponse;
  if (!res.ok) {
    const msg = data.error?.message ?? JSON.stringify(data);
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  if (data.error?.message) throw new Error(data.error.message);
  return data;
}

let data: GeminiResponse;
try {
  data = await callGemini(true);
} catch (err) {
  console.warn(`Grounded call failed (${err instanceof Error ? err.message : err}) — retrying without search…`);
  try {
    data = await callGemini(false);
  } catch (err2) {
    console.error(`Gemini API error: ${err2 instanceof Error ? err2.message : err2}`);
    process.exit(1);
  }
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

if (!text) {
  console.error("Empty response from Gemini — aborting.");
  process.exit(1);
}

console.log("Gemini response:\n", text, "\n");

const lines = text.split("\n");
const headline =
  (lines.find((l) => /^HEADLINE:/i.test(l)) ?? "").replace(/^HEADLINE:\s*/i, "").trim() ||
  "Indian Box Office morning brief";
const lede =
  (lines.find((l) => /^LEDE:/i.test(l)) ?? "").replace(/^LEDE:\s*/i, "").trim() || "";
const bodyStart = lines.findIndex((l) => /^BODY:/i.test(l));
const bodyText =
  bodyStart >= 0
    ? lines
        .slice(bodyStart)
        .join("\n")
        .replace(/^BODY:\s*/i, "")
        .trim()
    : text.replace(/^HEADLINE:.*$/im, "").replace(/^LEDE:.*$/im, "").trim();

const brief = {
  briefDate: todayMu,
  generatedAt: new Date().toISOString(),
  headline,
  lede,
  body: bodyText,
  citations: citations.map((c) => ({ url: c.url, title: c.title || c.url })),
  boardGeneratedAt: board?.generatedAt ?? null,
  model: MODEL,
};

writeFileSync(briefPath, `${JSON.stringify(brief, null, 2)}\n`);
console.log(`✓ Morning brief written → docs/morning-brief.json`);
console.log(`  Headline: ${headline}`);
console.log(`  Citations: ${citations.length}`);
