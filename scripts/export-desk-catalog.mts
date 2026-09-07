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

const films = MOVIES.map((m) => {
  const series = SERIES.filter((s) => s.movieId === m.id);
  const life = series.filter((s) => s.mode === "lifetime");
  const daily = series.filter((s) => s.mode === "daily");
  const pick = (field: "indiaNet" | "indiaGross" | "overseas" | "worldwide") =>
    weightedMedian(
      life
        .map((s) => {
          const pt = s.points[s.points.length - 1];
          return { value: pt?.[field] ?? NaN, weight: weights[s.sourceId] ?? 0.5 };
        })
        .filter((p) => Number.isFinite(p.value)),
    );
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
    indiaNet: round2(pick("indiaNet")),
    indiaGross: round2(pick("indiaGross")),
    overseas: round2(pick("overseas")),
    worldwide: round2(pick("worldwide")),
    lastDayNet: lastDaily?.indiaNet ?? null,
  };
});

const pack = {
  sources: SOURCES,
  films,
};

const js = `window.IBO_CATALOG = ${JSON.stringify(pack, null, 2)};\n`;
writeFileSync(join(outDir, "catalog.js"), js);
console.log("wrote", join(outDir, "catalog.js"), films.length, "films");
