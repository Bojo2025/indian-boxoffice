/**
 * Point board/catalog film rows at local poster files under docs/posters/.
 * Prefers film.id.jpg (fetched for discovered titles); falls back to catalog posterKey;
 * only then the shared hero-cinema placeholder.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { MOVIES } from "../src/lib/boxoffice/catalog.ts";

function posterPathFor(key: string): string | null {
  for (const ext of ["jpg", "jpeg", "png", "webp", "svg"]) {
    if (existsSync(`docs/posters/${key}.${ext}`)) return `./posters/${key}.${ext}`;
  }
  return null;
}

function resolvePoster(film: { id: string; posterKey?: string }): { posterKey: string; poster: string } {
  const catalogKey = MOVIES.find((m) => m.id === film.id)?.posterKey;
  const candidates = [film.id, film.posterKey, catalogKey].filter(
    (k): k is string => Boolean(k) && k !== "hero-cinema",
  );
  for (const key of candidates) {
    const path = posterPathFor(key);
    if (path) return { posterKey: key, poster: path };
  }
  return { posterKey: film.posterKey || film.id, poster: "./posters/hero-cinema.jpg" };
}

for (const file of ["docs/catalog.js", "docs/board.json"]) {
  if (!existsSync(file)) continue;
  const raw = readFileSync(file, "utf8");
  const isJs = file.endsWith(".js");
  const json = isJs ? raw.replace(/^window\.IBO_CATALOG\s*=\s*/, "").replace(/;\s*$/, "") : raw;
  const pack = JSON.parse(json) as {
    films: { id: string; posterKey?: string; poster?: string }[];
  };
  let updated = 0;
  let stillFallback = 0;
  for (const f of pack.films) {
    const art = resolvePoster(f);
    if (f.poster !== art.poster || f.posterKey !== art.posterKey) updated += 1;
    f.posterKey = art.posterKey;
    f.poster = art.poster;
    if (art.poster.includes("hero-cinema")) stillFallback += 1;
  }
  const out = JSON.stringify(pack, null, 2);
  writeFileSync(file, isJs ? `window.IBO_CATALOG = ${out};\n` : `${out}\n`);
  console.log("updated", file, `· remapped ${updated} · still fallback ${stillFallback}`);
}
