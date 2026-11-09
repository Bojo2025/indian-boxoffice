/**
 * Fetch theatrical posters for board + catalog films.
 * Sources: Sacnilk movie pages (og:image), then Hungama for catalogued titles.
 * Writes small card-sized JPGs into public/posters + docs/posters (display is CSS-capped
 * at ~112×168 on cards — files are resized so they cannot blow up layout).
 */
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { execFileSync } from "node:child_process";
import { HUNGAMA_PAGES, MOVIES, SACNILK_PAGES } from "../src/lib/boxoffice/catalog.ts";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const publicDir = join(root, "public", "posters");
const docsDir = join(root, "docs", "posters");
const boardPath = join(root, "docs", "board.json");
mkdirSync(publicDir, { recursive: true });
mkdirSync(docsDir, { recursive: true });

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

/** Max edge in pixels — enough for 2× retina of the 112×168 card slot, nothing larger. */
const MAX_EDGE_PX = 336;

const EXTRA_HUNGAMA: { movieId: string; slug: string }[] = [
  { movieId: "jana-nayagan", slug: "jana-nayagan" },
  { movieId: "karuppu", slug: "karuppu" },
  { movieId: "msvpg", slug: "mana-shankara-vara-prasad-garu" },
  { movieId: "drishyam-3", slug: "drishyam-3" },
  { movieId: "vaazha-ii", slug: "vaazha-ii" },
  { movieId: "paw-patrol-dino", slug: "paw-patrol-the-dino-movie" },
];

type BoardFilm = {
  id: string;
  slug?: string;
  title: string;
  posterKey?: string;
  poster?: string;
};

type Result = { id: string; key: string; source: string; ok: boolean; detail: string };

async function fetchText(url: string, referer?: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html",
      "Accept-Language": "en-IN,en;q=0.9",
      ...(referer ? { Referer: referer } : {}),
    },
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
  if (/generic\.png|favicon|default-images|SNCI\.jpg|placeholder|hero-cinema/i.test(url)) return null;
  return url;
}

async function download(url: string, dest: string, referer: string): Promise<void> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Referer: referer, Accept: "image/*,*/*" },
    redirect: "follow",
  });
  if (!res.ok || !res.body) throw new Error(`download HTTP ${res.status}`);
  await pipeline(res.body as unknown as NodeJS.ReadableStream, createWriteStream(dest));
}

function resize(path: string) {
  try {
    execFileSync("sips", ["-Z", String(MAX_EDGE_PX), path], { stdio: "ignore" });
  } catch {
    /* sips missing — leave original; CSS still caps display size */
  }
}

function hasPosterFile(key: string): boolean {
  return ["jpg", "jpeg", "png", "webp"].some((ext) => existsSync(join(docsDir, `${key}.${ext}`)));
}

function needsFetch(film: BoardFilm): boolean {
  const key = film.id;
  if (!hasPosterFile(key) && film.posterKey && film.posterKey !== "hero-cinema" && hasPosterFile(film.posterKey)) {
    return false;
  }
  if (hasPosterFile(key) && film.posterKey !== "hero-cinema" && !String(film.poster || "").includes("hero-cinema")) {
    return false;
  }
  // Missing file, or still pointing at the generic theatre image.
  return !hasPosterFile(key) || film.posterKey === "hero-cinema" || String(film.poster || "").includes("hero-cinema");
}

async function savePoster(key: string, imageUrl: string, referer: string): Promise<void> {
  const out = join(publicDir, `${key}.jpg`);
  const tmp = `${out}.tmp`;
  await download(imageUrl, tmp, referer);
  execFileSync("mv", [tmp, out]);
  resize(out);
  copyFileSync(out, join(docsDir, `${key}.jpg`));
  for (const ext of ["svg", "png", "webp"]) {
    for (const dir of [docsDir, publicDir]) {
      const p = join(dir, `${key}.${ext}`);
      if (existsSync(p) && ext !== "jpg") {
        try {
          unlinkSync(p);
        } catch {
          /* ignore */
        }
      }
    }
  }
}

function loadBoardFilms(): BoardFilm[] {
  if (!existsSync(boardPath)) return [];
  try {
    const pack = JSON.parse(readFileSync(boardPath, "utf8")) as { films?: BoardFilm[] };
    return pack.films ?? [];
  } catch {
    return [];
  }
}

const results: Result[] = [];
const boardFilms = loadBoardFilms();
const catalogById = Object.fromEntries(MOVIES.map((m) => [m.id, m]));
const hungamaById = Object.fromEntries([...HUNGAMA_PAGES, ...EXTRA_HUNGAMA].map((p) => [p.movieId, p.slug]));
const sacnilkNewsById = Object.fromEntries(SACNILK_PAGES.map((p) => [p.movieId, p.slug]));

const targets: BoardFilm[] = [];
const seen = new Set<string>();
for (const f of boardFilms) {
  if (seen.has(f.id)) continue;
  seen.add(f.id);
  targets.push(f);
}
for (const m of MOVIES) {
  if (seen.has(m.id)) continue;
  seen.add(m.id);
  targets.push({ id: m.id, slug: m.slug, title: m.title, posterKey: m.posterKey });
}

const missing = targets.filter(needsFetch);
console.log(`poster fetch: ${missing.length} missing / ${targets.length} titles (max edge ${MAX_EDGE_PX}px)`);

for (const film of missing) {
  const key = film.id;
  let ok = false;
  let detail = "";
  let source = "";

  // 1) Sacnilk movie detail page (best for discovered titles).
  const sacSlug = film.slug || catalogById[film.id]?.slug;
  if (sacSlug) {
    try {
      const url = `https://www.sacnilk.com/movie/${sacSlug}`;
      const html = await fetchText(url, "https://www.sacnilk.com/");
      const img = ogImage(html);
      if (!img) throw new Error("no og:image");
      await savePoster(key, img, url);
      ok = true;
      source = "sacnilk-movie";
      detail = img;
    } catch (err) {
      detail = err instanceof Error ? err.message : "fail";
    }
  }

  // 2) Sacnilk day-wise news page from catalog list.
  if (!ok && sacnilkNewsById[film.id]) {
    try {
      const newsSlug = sacnilkNewsById[film.id];
      const url = `https://www.sacnilk.com/news/${newsSlug}`;
      const html = await fetchText(url, "https://www.sacnilk.com/");
      const img = ogImage(html);
      if (!img) throw new Error("no og:image");
      await savePoster(key, img, url);
      ok = true;
      source = "sacnilk-news";
      detail = img;
    } catch (err) {
      detail = err instanceof Error ? err.message : "fail";
    }
  }

  // 3) Hungama catalog pages.
  if (!ok && hungamaById[film.id]) {
    try {
      const slug = hungamaById[film.id];
      const url = `https://www.bollywoodhungama.com/movie/${slug}/`;
      const html = await fetchText(url);
      const img = ogImage(html);
      if (!img) throw new Error("no og:image");
      await savePoster(key, img, url);
      ok = true;
      source = "hungama";
      detail = img;
    } catch (err) {
      detail = err instanceof Error ? err.message : "fail";
    }
  }

  // 4) If catalog posterKey already has a file, copy under film.id.
  if (!ok) {
    const catalogKey = catalogById[film.id]?.posterKey;
    if (catalogKey && catalogKey !== key && hasPosterFile(catalogKey)) {
      const src = ["jpg", "jpeg", "png", "webp"]
        .map((ext) => join(docsDir, `${catalogKey}.${ext}`))
        .find((p) => existsSync(p));
      if (src) {
        copyFileSync(src, join(docsDir, `${key}.jpg`));
        copyFileSync(src, join(publicDir, `${key}.jpg`));
        resize(join(docsDir, `${key}.jpg`));
        resize(join(publicDir, `${key}.jpg`));
        ok = true;
        source = "copy-catalog-key";
        detail = catalogKey;
      }
    }
  }

  results.push({ id: film.id, key, source: source || "none", ok, detail });
  console.log(ok ? "ok" : "miss", key, source || detail);
  // Be polite to Sacnilk.
  await new Promise((r) => setTimeout(r, 250));
}

writeFileSync(
  join(docsDir, "manifest.json"),
  JSON.stringify({ fetchedAt: new Date().toISOString(), maxEdgePx: MAX_EDGE_PX, results }, null, 2),
);

console.log("done", results.filter((r) => r.ok).length, "ok /", results.length, "attempted");
