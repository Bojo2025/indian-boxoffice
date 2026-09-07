import type { ConsensusDay, Reading } from "./types";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

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

function disagreement(values: number[]): number | null {
  if (values.length < 2) return 0;
  const m = median(values);
  if (m === 0) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  return ((max - min) / m) * 100;
}

export type WeightMap = Record<string, number>;

export function buildConsensus(
  readings: Reading[],
  weights: WeightMap,
): ConsensusDay[] {
  const groups = new Map<string, Reading[]>();
  for (const r of readings) {
    const key = `${r.movieId}|${r.reportDate}`;
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }

  const days: ConsensusDay[] = [];
  for (const [, list] of groups) {
    const first = list[0];
    const pick = (field: "indiaNet" | "indiaGross" | "overseas" | "worldwide") => {
      const pairs = list
        .map((r) => ({
          value: r[field] ?? NaN,
          weight: weights[r.sourceId] ?? 0.5,
        }))
        .filter((p) => Number.isFinite(p.value));
      return weightedMedian(pairs);
    };
    const nets = list.map((r) => r.indiaNet).filter((v): v is number => v != null);
    const screens = list.map((r) => r.screens).filter((v): v is number => v != null);
    const occ = list.map((r) => r.occupancy).filter((v): v is number => v != null);
    days.push({
      movieId: first.movieId,
      reportDate: first.reportDate,
      dayNumber: first.dayNumber,
      indiaNet: round2(pick("indiaNet")),
      indiaGross: round2(pick("indiaGross")),
      overseas: round2(pick("overseas")),
      worldwide: round2(pick("worldwide")),
      netChangePct: null,
      disagreementPct: disagreement(nets),
      screens: screens.length ? Math.round(median(screens)) : null,
      occupancy: occ.length ? round2(median(occ)) : null,
    });
  }

  days.sort((a, b) =>
    a.movieId === b.movieId
      ? a.reportDate.localeCompare(b.reportDate)
      : a.movieId.localeCompare(b.movieId),
  );

  const lastNet = new Map<string, number>();
  for (const d of days) {
    const prev = lastNet.get(d.movieId);
    if (prev != null && prev > 0) {
      d.netChangePct = round2(((d.indiaNet - prev) / prev) * 100);
    }
    lastNet.set(d.movieId, d.indiaNet);
  }
  return days;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function cumulativeFromDaily(days: ConsensusDay[]): ConsensusDay[] {
  const byMovie = new Map<string, ConsensusDay[]>();
  for (const d of days) {
    const list = byMovie.get(d.movieId) ?? [];
    list.push(d);
    byMovie.set(d.movieId, list);
  }
  const out: ConsensusDay[] = [];
  for (const list of byMovie.values()) {
    list.sort((a, b) => a.dayNumber - b.dayNumber);
    let net = 0;
    let gross = 0;
    let overseas = 0;
    let ww = 0;
    for (const d of list) {
      net += d.indiaNet;
      gross += d.indiaGross;
      overseas += d.overseas;
      ww += d.worldwide;
      out.push({
        ...d,
        indiaNet: round2(net),
        indiaGross: round2(gross),
        overseas: round2(overseas),
        worldwide: round2(ww),
      });
    }
  }
  return out;
}
