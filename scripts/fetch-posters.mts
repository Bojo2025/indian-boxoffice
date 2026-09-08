/**
 * Fetch real theatrical posters from Hungama (og:image) / Sacnilk pages,
 * resize to desk card size, write into public/posters + docs/posters.
 */
import { createWriteStream, existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { execFileSync } from "node:child_process";
import { HUNGAMA_PAGES, MOVIES, SACNILK_PAGES } from "../src/lib/boxoffice/catalog.ts";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const publicDir = join(root, "public", "posters");
const docsDir = join(root, "docs", "posters");
mkdirSync(publicDir, { recursive: true });
mkdirSync(docsDir, { recursive: true });

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const EXTRA_HUNGAMA: { movieId: string; slug: string }[] = [
  { movieId: "jana-nayagan", slug: "jana-nayagan" },
  { movieId: "karuppu", slug: "karuppu" },
  { movieId: "msvpg", slug: "mana-shankara-vara-prasad-garu" },
  { movieId: "drishyam-3", slug: "drishyam-3" },
  { movieId: "vaazha-ii", slug: "vaazha-ii" },
  { movieId: "paw-patrol-dino", slug: "paw-patrol-the-dino-movie" },
];

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "en-IN,en;q=0.9" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function ogImage(html: string): string | null {
  const m =
    html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  const url = m?.[1]?.trim() ?? null;
  if (!url) return null;
  if (/generic\.png|favicon|default-images|SNCI\.jpg/i.test(url)) return null;
  return url;
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Referer: "https://www.bollywoodhungama.com/" },
    redirect: "follow",
  });
  if (!res.ok || !res.body) throw new Error(`download HTTP ${res.status}`);
  await pipeline(res.body as unknown as NodeJS.ReadableStream, createWriteStream(dest));
}

function resize(path: string) {
  try {
    // Portrait card size; keep aspect, max edge 600
    execFileSync("sips", ["-Z", "600", path], { stdio: "ignore" });
  } catch {
    /* sips missing — leave original */
  }
}

const byId = Object.fromEntries(MOVIES.map((m) => [m.id, m]));
const hungama = [...HUNGAMA_PAGES, ...EXTRA_HUNGAMA];
const results: { id: string; key: string; source: string; ok: boolean; detail: string }[] = [];

for (const page of hungama) {
  const movie = byId[page.movieId];
  if (!movie) continue;
  const key = movie.posterKey || movie.id;
  const out = join(publicDir, `${key}.jpg`);
  try {
    const html = await fetchText(`https://www.bollywoodhungama.com/movie/${page.slug}/`);
    const img = ogImage(html);
    if (!img) throw new Error("no og:image");
    const tmp = `${out}.tmp`;
    await download(img, tmp);
    // normalize extension to jpg path even if source was jpeg
    execFileSync("mv", [tmp, out]);
    resize(out);
    copyFileSync(out, join(docsDir, `${key}.jpg`));
    // drop conflicting svg so jpg wins
    const svg = join(docsDir, `${key}.svg`);
    if (existsSync(svg)) {
      try {
        execFileSync("rm", ["-f", svg, join(publicDir, `${key}.svg`)]);
      } catch {
        /* ignore */
      }
    }
    results.push({ id: movie.id, key, source: "hungama", ok: true, detail: img });
    console.log("ok", key, img.slice(0, 90));
  } catch (err) {
    results.push({
      id: movie.id,
      key,
      source: "hungama",
      ok: false,
      detail: err instanceof Error ? err.message : "fail",
    });
    console.log("miss", key, err instanceof Error ? err.message : err);
  }
}

// Sacnilk fallback for remaining films
for (const page of SACNILK_PAGES) {
  const movie = byId[page.movieId];
  if (!movie) continue;
  const key = movie.posterKey || movie.id;
  const out = join(publicDir, `${key}.jpg`);
  if (existsSync(out) && results.some((r) => r.key === key && r.ok)) continue;
  try {
    const html = await fetchText(`https://www.sacnilk.com/news/${page.slug}`);
    const img = ogImage(html);
    if (!img) throw new Error("no og:image");
    const tmp = `${out}.tmp`;
    await download(img, tmp);
    execFileSync("mv", [tmp, out]);
    resize(out);
    copyFileSync(out, join(docsDir, `${key}.jpg`));
    results.push({ id: movie.id, key, source: "sacnilk", ok: true, detail: img });
    console.log("ok-sac", key, img.slice(0, 90));
  } catch (err) {
    console.log("miss-sac", key, err instanceof Error ? err.message : err);
  }
}

writeFileSync(
  join(docsDir, "manifest.json"),
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      results,
    },
    null,
    2,
  ),
);

console.log(
  "done",
  results.filter((r) => r.ok).length,
  "ok /",
  results.length,
  "attempted",
);
