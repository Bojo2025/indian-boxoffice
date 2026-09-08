/**
 * Server-side consensus publisher for the GitHub Pages desk.
 * Pulls Sacnilk + Hungama + Koimoi + BOI (+ newsroom/Wikipedia overlays),
 * merges with the seed catalogue as fallback, writes docs/catalog.js + health + history.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MOVIES, SERIES, SOURCES, dateForDay } from "../src/lib/boxoffice/catalog.ts";
import { round2 } from "../src/lib/boxoffice/consensus.ts";
import { ingestLiveSources } from "../src/lib/boxoffice/scrape.ts";
import type { Reading } from "../src/lib/boxoffice/types.ts";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "docs");
const historyDir = join(outDir, "history");
mkdirSync(outDir, { recursive: true });
mkdirSync(historyDir, { recursive: true });

const TRADE = new Set(["sacnilk", "koimoi", "hungama", "boi"]);
const SPINE = ["sacnilk", "koimoi", "hungama", "boi"] as const;
const weights = Object.fromEntries(SOURCES.map((s) => [s.id, s.weight]));

type MoneyField = "indiaNet" | "indiaGross" | "overseas" | "worldwide";

type FilmCard = {
  id: string;
  slug: string;
  title: string;
  language: string;
  industry: string;
  director: string;
  starring: string;
  releaseDate: string;
  budgetCr: number | null;
  synopsis: string;
  status: string;
  verdict: string;
  indiaNet: number;
  indiaGross: number;
  overseas: number;
  worldwide: number;
  lastDayNet: number | null;
  trackedThroughDay: number | null;
  liveSources: string[];
  deltaNet: number | null;
  deltaWw: number | null;
};

type HealthFile = {
  updatedAt: string;
  spine: Record<
    string,
    { ok: boolean; streakFail: number; lastOk: string | null; lastFail: string | null; detail: string; readings: number }
  >;
  alerts: string[];
  hardFail: boolean;
};

function weightedMedian(pairs: { value: number; weight: number }[]): number {
  const filtered = pairs.filter((p) => Number.isFinite(p.value) && p.weight > 0);
  if (filtered.length === 0) return 0;
  const total = filtered.reduce((a, p) => a + p.weight, 0);
  const sorted = [...filtered].sort((a, b) => a.value - b.value);
  let acc = 0;
  for (const p of sorted) {
    acc += p.weight;
    if (acc >= total / 2) return p.value;
  }
  return sorted[sorted.length - 1].value;
}

function seedReadings(): Reading[] {
  const out: Reading[] = [];
  for (const s of SERIES) {
    const movie = MOVIES.find((m) => m.id === s.movieId);
    if (!movie) continue;
    for (const p of s.points) {
      out.push({
        movieId: s.movieId,
        sourceId: s.sourceId,
        reportDate: s.mode === "lifetime" ? "2099-12-31" : dateForDay(movie.releaseDate, p.day),
        dayNumber: p.day,
        indiaNet: p.indiaNet ?? null,
        indiaGross: p.indiaGross ?? null,
        overseas: p.overseas ?? null,
        worldwide: p.worldwide ?? null,
        screens: p.screens ?? null,
        occupancy: p.occupancy ?? null,
        note: s.mode === "lifetime" ? "lifetime seed" : "seed",
      });
    }
  }
  return out;
}

function mergeReadings(
  seed: Reading[],
  live: Reading[],
  blockedTrade: Set<string>,
): Reading[] {
  const liveByMovie = new Map<string, Set<string>>();
  for (const r of live) {
    const set = liveByMovie.get(r.movieId) ?? new Set();
    set.add(r.sourceId);
    liveByMovie.set(r.movieId, set);
  }

  const liveKeys = new Set(live.map((r) => `${r.movieId}\t${r.sourceId}`));
  const out = [...live];

  for (const r of seed) {
    const key = `${r.movieId}\t${r.sourceId}`;
    if (liveKeys.has(key)) continue;
    const liveSources = liveByMovie.get(r.movieId);
    const movieHasLiveTrade = liveSources
      ? [...liveSources].some((id) => TRADE.has(id))
      : false;
    if (movieHasLiveTrade && !blockedTrade.has(r.sourceId)) continue;
    out.push(r);
  }
  return out;
}

function sourceTotals(rows: Reading[], field: MoneyField): Map<string, number> {
  const bySource = new Map<string, { life: number; daily: number }>();
  for (const r of rows) {
    const v = r[field];
    if (v == null || !Number.isFinite(v)) continue;
    const cur = bySource.get(r.sourceId) ?? { life: 0, daily: 0 };
    if (r.note.startsWith("lifetime") || r.reportDate >= "2099-01-01") {
      cur.life = Math.max(cur.life, v);
    } else {
      cur.daily += v;
    }
    bySource.set(r.sourceId, cur);
  }
  const out = new Map<string, number>();
  for (const [id, cur] of bySource) {
    out.set(id, Math.max(cur.life, cur.daily));
  }
  return out;
}

function consensusField(rows: Reading[], field: MoneyField): number {
  const totals = sourceTotals(rows, field);
  const tradeOnly = [...totals.entries()]
    .filter(([id]) => TRADE.has(id))
    .map(([id, value]) => ({ value, weight: weights[id] ?? 0.5 }));
  if (tradeOnly.length) return round2(weightedMedian(tradeOnly));
  const any = [...totals.entries()].map(([id, value]) => ({
    value,
    weight: weights[id] ?? 0.5,
  }));
  if (any.length) return round2(weightedMedian(any));
  return 0;
}

function lastDayNet(rows: Reading[]): number | null {
  const daily = rows
    .filter((r) => !r.note.startsWith("lifetime") && r.reportDate < "2099-01-01" && r.indiaNet != null)
    .sort((a, b) => a.dayNumber - b.dayNumber);
  return daily.at(-1)?.indiaNet ?? null;
}

function maxDay(rows: Reading[]): number | null {
  const days = rows.map((r) => r.dayNumber).filter((d) => Number.isFinite(d) && d < 9000);
  return days.length ? Math.max(...days) : null;
}

function deskDay(iso = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(iso);
}

function readJson<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function previousSnapshot(
  today: string,
): { date: string; films: { id: string; indiaNet: number; worldwide: number; title: string }[] } | null {
  const board = readJson<{
    generatedAt?: string;
    deskDate?: string;
    films?: { id: string; indiaNet: number; worldwide: number; title: string }[];
  }>(join(outDir, "board.json"));
  if (board?.films?.length) {
    const d = board.deskDate || (board.generatedAt ? deskDay(new Date(board.generatedAt)) : today);
    return { date: d === today ? `${d} prior` : d, films: board.films };
  }
  // Walk back up to 7 calendar days for a stored history file.
  for (let i = 1; i <= 7; i++) {
    const d = new Date(`${today}T12:00:00+05:30`);
    d.setDate(d.getDate() - i);
    const key = deskDay(d);
    const snap = readJson<{ films: { id: string; indiaNet: number; worldwide: number; title: string }[] }>(
      join(historyDir, `${key}.json`),
    );
    if (snap?.films?.length) return { date: key, films: snap.films };
  }
  return null;
}

const live = await ingestLiveSources();
const nowIso = new Date().toISOString();
const today = deskDay();

const sacnilkLiveDays = live.readings.filter(
  (r) => r.sourceId === "sacnilk" && r.note === "live scrape",
).length;
const sacnilkLog = live.logs.find((l) => l.sourceId === "sacnilk");
const sacnilkOk = sacnilkLog?.status === "ok" && sacnilkLiveDays > 0;

const prevHealth = readJson<HealthFile>(join(outDir, "health.json"));
const spineStatus: HealthFile["spine"] = {};
const alerts: string[] = [];

for (const id of SPINE) {
  const log = live.logs.find((l) => l.sourceId === id);
  const readings = live.readings.filter((r) => r.sourceId === id).length;
  const ok =
    id === "sacnilk"
      ? sacnilkOk
      : log?.status === "ok" || (id === "koimoi" && readings > 0);
  const prev = prevHealth?.spine?.[id];
  const streakFail = ok ? 0 : (prev?.streakFail ?? 0) + 1;
  spineStatus[id] = {
    ok,
    streakFail,
    lastOk: ok ? nowIso : (prev?.lastOk ?? null),
    lastFail: ok ? (prev?.lastFail ?? null) : nowIso,
    detail: log?.detail ?? (ok ? "ok" : "no successful pull"),
    readings,
  };
  if (!ok) {
    alerts.push(`${id} failed: ${spineStatus[id].detail} (streak ${streakFail})`);
  } else if (streakFail === 0 && (prev?.streakFail ?? 0) >= 2) {
    alerts.push(`${id} recovered after ${prev?.streakFail} failed runs`);
  }
  if (streakFail >= 2) {
    alerts.push(`${id} has failed ${streakFail} consecutive publishes`);
  }
}

if (!sacnilkOk) {
  alerts.unshift(
    `HARD: Sacnilk returned ${sacnilkLiveDays} day-wise rows — primary spine is down or the HTML regex broke`,
  );
}

const hardFail = !sacnilkOk;
const health: HealthFile = {
  updatedAt: nowIso,
  spine: spineStatus,
  alerts,
  hardFail,
};

const blockedTrade = new Set(
  live.logs.filter((l) => l.status !== "ok" && TRADE.has(l.sourceId)).map((l) => l.sourceId),
);
// Koimoi is often Cloudflare-blocked; keep seed for it even when logged blocked.
if (!spineStatus.koimoi?.ok) blockedTrade.add("koimoi");

const merged = mergeReadings(seedReadings(), live.readings, blockedTrade);
const prior = previousSnapshot(today);
const priorMap = new Map((prior?.films ?? []).map((f) => [f.id, f]));

const films: FilmCard[] = MOVIES.map((m) => {
  const rows = merged.filter((r) => r.movieId === m.id);
  const indiaNet = consensusField(rows, "indiaNet");
  const indiaGross = consensusField(rows, "indiaGross");
  const overseas = consensusField(rows, "overseas");
  let worldwide = consensusField(rows, "worldwide");
  if (!worldwide && indiaGross) worldwide = indiaGross;
  const liveSources = [...new Set(live.readings.filter((r) => r.movieId === m.id).map((r) => r.sourceId))];
  const prev = priorMap.get(m.id);
  const deltaNet = prev ? round2(indiaNet - prev.indiaNet) : null;
  const deltaWw = prev ? round2(worldwide - prev.worldwide) : null;
  return {
    id: m.id,
    slug: m.slug,
    title: m.title,
    language: m.language,
    industry: m.industry,
    director: m.director,
    starring: m.starring,
    releaseDate: m.releaseDate,
    budgetCr: m.budgetCr,
    synopsis: m.synopsis,
    status: m.status,
    verdict: m.verdict,
    indiaNet,
    indiaGross,
    overseas,
    worldwide,
    lastDayNet: lastDayNet(rows),
    trackedThroughDay: maxDay(rows),
    liveSources,
    deltaNet,
    deltaWw,
  };
});

const changes = films
  .filter((f) => (f.deltaWw != null && Math.abs(f.deltaWw) >= 0.5) || (f.deltaNet != null && Math.abs(f.deltaNet) >= 0.5))
  .sort((a, b) => Math.abs(b.deltaWw ?? 0) - Math.abs(a.deltaWw ?? 0))
  .slice(0, 8)
  .map((f) => {
    const parts: string[] = [];
    if (f.deltaWw != null && Math.abs(f.deltaWw) >= 0.5) {
      parts.push(`WW ${f.deltaWw >= 0 ? "+" : ""}₹${f.deltaWw} Cr`);
    }
    if (f.deltaNet != null && Math.abs(f.deltaNet) >= 0.5) {
      parts.push(`India net ${f.deltaNet >= 0 ? "+" : ""}₹${f.deltaNet} Cr`);
    }
    return {
      id: f.id,
      title: f.title,
      text: `${f.title}: ${parts.join(", ")} since ${prior?.date ?? "last board"}`,
      deltaNet: f.deltaNet,
      deltaWw: f.deltaWw,
    };
  });

const pack = {
  generatedAt: nowIso,
  deskDate: today,
  comparedTo: prior?.date ?? null,
  mode: "server-consensus",
  spine: [...SPINE],
  health: {
    hardFail,
    alerts,
    spine: Object.fromEntries(
      Object.entries(spineStatus).map(([id, s]) => [id, { ok: s.ok, streakFail: s.streakFail, detail: s.detail }]),
    ),
  },
  sources: SOURCES,
  films,
  changes,
  logs: live.logs,
  headlines: live.headlines.slice(0, 16).map((h) => ({
    sourceId: h.sourceId,
    title: h.title,
    url: h.url,
    publishedAt: h.publishedAt,
    summary: h.summary,
  })),
  downloads: {
    boardJson: "./board.json",
    healthJson: "./health.json",
    history: `./history/${today}.json`,
  },
};

writeFileSync(join(outDir, "catalog.js"), `window.IBO_CATALOG = ${JSON.stringify(pack, null, 2)};\n`);
writeFileSync(join(outDir, "board.json"), `${JSON.stringify(pack, null, 2)}\n`);
writeFileSync(join(outDir, "health.json"), `${JSON.stringify(health, null, 2)}\n`);
writeFileSync(
  join(historyDir, `${today}.json`),
  `${JSON.stringify(
    {
      date: today,
      generatedAt: nowIso,
      films: films.map((f) => ({
        id: f.id,
        title: f.title,
        indiaNet: f.indiaNet,
        worldwide: f.worldwide,
        status: f.status,
      })),
    },
    null,
    2,
  )}\n`,
);

const ok = live.logs.filter((l) => l.status === "ok").map((l) => l.sourceId);
const blocked = live.logs.filter((l) => l.status !== "ok").map((l) => `${l.sourceId}:${l.detail}`);
console.log("published", films.length, "films · compared to", prior?.date ?? "(none)");
console.log("ok", [...new Set(ok)].join(", ") || "(none)");
console.log("blocked", [...new Set(blocked)].join(" · ") || "(none)");
if (alerts.length) console.log("alerts:", alerts.join(" | "));
const toxic = films.find((f) => f.id === "toxic");
if (toxic) {
  console.log(
    `toxic → net ₹${toxic.indiaNet} Cr (${toxic.deltaNet != null ? `${toxic.deltaNet >= 0 ? "+" : ""}${toxic.deltaNet}` : "n/a"}) · ww ₹${toxic.worldwide} Cr · live [${toxic.liveSources.join(", ")}]`,
  );
}

if (hardFail) {
  console.error("HARD FAIL: Sacnilk spine produced no day-wise rows. Board written from fallback; fix scraper.");
  process.exitCode = 1;
}
