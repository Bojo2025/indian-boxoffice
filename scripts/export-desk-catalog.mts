import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MOVIES, SERIES, SOURCES } from "../src/lib/boxoffice/catalog.ts";
import { round2 } from "../src/lib/boxoffice/consensus.ts";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "docs");
mkdirSync(outDir, { recursive: true });

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

const weights = Object.fromEntries(SOURCES.map((s) => [s.id, s.weight]));

type MoneyField = "indiaNet" | "indiaGross" | "overseas" | "worldwide";

function fromLifetime(life: typeof SERIES, field: MoneyField): number {
  return weightedMedian(
    life
      .map((s) => {
        const pt = s.points[s.points.length - 1];
        return { value: pt?.[field] ?? NaN, weight: weights[s.sourceId] ?? 0.5 };
      })
      .filter((p) => Number.isFinite(p.value)),
  );
}

function fromDaily(daily: typeof SERIES, field: MoneyField): number {
  if (daily.length === 0) return 0;
  const bySource = new Map<string, number>();
  for (const s of daily) {
    const total = s.points.reduce((a, p) => a + (p[field] ?? 0), 0);
    bySource.set(s.sourceId, Math.max(bySource.get(s.sourceId) ?? 0, total));
  }
  return Math.max(0, ...bySource.values());
}

const films = MOVIES.map((m) => {
  const series = SERIES.filter((s) => s.movieId === m.id);
  const life = series.filter((s) => s.mode === "lifetime");
  const daily = series.filter((s) => s.mode === "daily");
  const pick = (field: MoneyField) => round2(Math.max(fromLifetime(life, field), fromDaily(daily, field)));
  const lastDaily = daily
    .flatMap((s) => s.points)
    .sort((a, b) => a.day - b.day)
    .at(-1);
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
    indiaNet: pick("indiaNet"),
    indiaGross: pick("indiaGross"),
    overseas: pick("overseas"),
    worldwide: pick("worldwide"),
    lastDayNet: lastDaily?.indiaNet ?? null,
  };
});

const pack = {
  generatedAt: new Date().toISOString(),
  sources: SOURCES,
  films,
};

const js = `window.IBO_CATALOG = ${JSON.stringify(pack, null, 2)};\n`;
writeFileSync(join(outDir, "catalog.js"), js);
console.log("wrote", join(outDir, "catalog.js"), films.length, "films");
