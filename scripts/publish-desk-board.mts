/**
 * Server-side consensus publisher for the GitHub Pages desk.
 * Pulls Sacnilk + Hungama + Koimoi + BOI (+ newsroom/Wikipedia overlays),
 * merges with the seed catalogue as fallback, and writes docs/catalog.js.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MOVIES, SERIES, SOURCES, dateForDay } from "../src/lib/boxoffice/catalog.ts";
import { round2 } from "../src/lib/boxoffice/consensus.ts";
import { ingestLiveSources } from "../src/lib/boxoffice/scrape.ts";
import type { Reading } from "../src/lib/boxoffice/types.ts";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "docs");
mkdirSync(outDir, { recursive: true });

const TRADE = new Set(["sacnilk", "koimoi", "hungama", "boi"]);
const weights = Object.fromEntries(SOURCES.map((s) => [s.id, s.weight]));

type MoneyField = "indiaNet" | "indiaGross" | "overseas" | "worldwide";

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
    // Once a film has live trade data, only keep seed for trackers that are globally blocked.
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

const live = await ingestLiveSources();
const blockedTrade = new Set(
  live.logs.filter((l) => l.status !== "ok" && TRADE.has(l.sourceId)).map((l) => l.sourceId),
);
const merged = mergeReadings(seedReadings(), live.readings, blockedTrade);

const films = MOVIES.map((m) => {
  const rows = merged.filter((r) => r.movieId === m.id);
  const indiaNet = consensusField(rows, "indiaNet");
  const indiaGross = consensusField(rows, "indiaGross");
  const overseas = consensusField(rows, "overseas");
  let worldwide = consensusField(rows, "worldwide");
  // If WW is missing but we have India gross, use gross as a floor for India-desk WW.
  if (!worldwide && indiaGross) worldwide = indiaGross;
  const liveSources = [...new Set(live.readings.filter((r) => r.movieId === m.id).map((r) => r.sourceId))];
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
  };
});

const pack = {
  generatedAt: new Date().toISOString(),
  mode: "server-consensus",
  spine: ["sacnilk", "koimoi", "hungama", "boi"],
  sources: SOURCES,
  films,
  logs: live.logs,
  headlines: live.headlines.slice(0, 16).map((h) => ({
    sourceId: h.sourceId,
    title: h.title,
    url: h.url,
    publishedAt: h.publishedAt,
    summary: h.summary,
  })),
};

writeFileSync(join(outDir, "catalog.js"), `window.IBO_CATALOG = ${JSON.stringify(pack, null, 2)};\n`);
writeFileSync(join(outDir, "board.json"), `${JSON.stringify(pack, null, 2)}\n`);

const ok = live.logs.filter((l) => l.status === "ok").map((l) => l.sourceId);
const blocked = live.logs.filter((l) => l.status !== "ok").map((l) => `${l.sourceId}:${l.detail}`);
console.log("published", films.length, "films");
console.log("ok", [...new Set(ok)].join(", ") || "(none)");
console.log("blocked", [...new Set(blocked)].join(" · ") || "(none)");
const toxic = films.find((f) => f.id === "toxic");
if (toxic) {
  console.log(
    `toxic → net ₹${toxic.indiaNet} Cr · ww ₹${toxic.worldwide} Cr · live [${toxic.liveSources.join(", ")}]`,
  );
}
