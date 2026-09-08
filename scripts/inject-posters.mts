import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { MOVIES } from "../src/lib/boxoffice/catalog.ts";

function posterFor(key: string) {
  for (const ext of ["jpg", "jpeg", "png", "webp", "svg"]) {
    if (existsSync(`docs/posters/${key}.${ext}`)) return `./posters/${key}.${ext}`;
  }
  return "./posters/hero-cinema.jpg";
}

for (const file of ["docs/catalog.js", "docs/board.json"]) {
  const raw = readFileSync(file, "utf8");
  const isJs = file.endsWith(".js");
  const json = isJs ? raw.replace(/^window\.IBO_CATALOG\s*=\s*/, "").replace(/;\s*$/, "") : raw;
  const pack = JSON.parse(json) as {
    films: { id: string; posterKey?: string; poster?: string }[];
  };
  const byId = Object.fromEntries(MOVIES.map((m) => [m.id, m]));
  for (const f of pack.films) {
    const m = byId[f.id];
    const key = m?.posterKey || f.id;
    f.posterKey = key;
    f.poster = posterFor(key);
  }
  const out = JSON.stringify(pack, null, 2);
  writeFileSync(file, isJs ? `window.IBO_CATALOG = ${out};\n` : `${out}\n`);
  console.log("updated", file);
}
