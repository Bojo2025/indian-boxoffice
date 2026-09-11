import { HUNGAMA_PAGES, KOIMOI_PAGES, MOVIES, SACNILK_PAGES, dateForDay } from "./catalog";
import { deskDate } from "./format";
import type { Movie, Reading, TerritorySplit } from "./types";

export type ScrapedHeadline = {
  sourceId: string;
  title: string;
  url: string;
  publishedAt: string | null;
  summary: string;
};

export type WikiRow = {
  rank: number;
  title: string;
  language: string;
  worldwide: string;
  showing: boolean;
};

export type IngestResult = {
  headlines: ScrapedHeadline[];
  readings: Reading[];
  territories: TerritorySplit[];
  wikiRows: WikiRow[];
  logs: { sourceId: string; status: string; detail: string }[];
};

/** Lifetime-only rows live on a sentinel date so they never collide with a daily unique key. */
export const LIFETIME_DATE = "2099-12-31";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function stripTags(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(s: string): string {
  return s
    .replace(/&#8377;/g, "\u20B9")
    .replace(/&#8377;/g, "\u20B9")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#039;/g, "'")
    .replace(/'/g, "'")
    .replace(/"/g, '"')
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCharCode(code) : "";
    });
}

function decodeXml(s: string): string {
  return decodeHtml(
    s.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, ""),
  ).trim();
}

function parseCr(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "").replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function foldTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[:'’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchMovie(title: string): Movie | null {
  const f = foldTitle(title);
  if (!f) return null;
  for (const m of MOVIES) {
    if (foldTitle(m.title) === f) return m;
  }
  let best: Movie | null = null;
  for (const m of MOVIES) {
    const mf = foldTitle(m.title);
    if (mf.length <= 2) {
      if (new RegExp(`(?:^| )${mf}(?: |$)`).test(f)) return m;
      continue;
    }
    if (f.includes(mf) || (mf.length >= 8 && mf.includes(f))) {
      if (!best || mf.length > foldTitle(best.title).length) best = m;
    }
  }
  return best;
}

async function fetchText(url: string, timeoutMs = 12000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
        Referer: "https://www.google.com/",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return decodeHtml(await res.text());
  } finally {
    clearTimeout(t);
  }
}

async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const n = Math.min(limit, Math.max(1, queue.length));
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (queue.length) {
        const item = queue.shift();
        if (item !== undefined) await fn(item);
      }
    }),
  );
}

function tableRows(html: string): string[][] {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  const out: string[][] = [];
  for (const table of tables) {
    const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
    for (const row of rows) {
      const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
        stripTags(m[1]),
      );
      if (cells.length) out.push(cells);
    }
  }
  return out;
}

function parseRss(xml: string, sourceId: string): ScrapedHeadline[] {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const out: ScrapedHeadline[] = [];
  for (const item of items.slice(0, 12)) {
    const title = decodeXml((item.match(/<title>([\s\S]*?)<\/title>/i) ?? [])[1] ?? "");
    const linkRaw = decodeXml((item.match(/<link>([\s\S]*?)<\/link>/i) ?? [])[1] ?? "");
    const url = stripTags(linkRaw).replace(/^https?:\/\/https?:\/\//, "https://");
    const date = decodeXml((item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) ?? [])[1] ?? "");
    const desc = stripTags(decodeXml((item.match(/<description>([\s\S]*?)<\/description>/i) ?? [])[1] ?? "")).slice(
      0,
      280,
    );
    if (!title || !url.startsWith("http")) continue;
    out.push({
      sourceId,
      title,
      url,
      publishedAt: date ? new Date(date).toISOString() : null,
      summary: desc,
    });
  }
  return out;
}

function parseWikiWikitext(wikitext: string): WikiRow[] {
  const rows: WikiRow[] = [];
  const chunks = wikitext.split(/\n\|-/).slice(1);
  let rank = 0;
  let carryLang = "";
  for (const chunk of chunks) {
    if (!chunk.includes("[[") || !/INR\|/.test(chunk)) continue;
    const titleMatch = chunk.match(/'{2,3}\[\[([^\]]+)\]\]'{2,3}/);
    if (!titleMatch) continue;
    const title = titleMatch[1].split("|").pop() ?? titleMatch[1];
    const langMatch = chunk.match(
      /\[\[([^\]]+?language[^\]]*)\|([^\]]+)\]\]|\[\[(Hindi|Tamil|Telugu|Kannada|Malayalam)\]\]/,
    );
    const language = langMatch ? langMatch[2] || langMatch[3] || carryLang : carryLang;
    if (language) carryLang = language;
    const amount = (chunk.match(/INR\|([^}]+)/) ?? [])[1]?.trim() ?? "";
    const showing = /#b6fcb6|currently showing/i.test(chunk);
    rank += 1;
    rows.push({ rank, title, language: language || "—", worldwide: amount, showing });
  }
  return rows;
}

function wikiAmountToCr(raw: string): number | null {
  const range = raw.match(/([\d,.]+)\s*[–-]\s*([\d,.]+)/);
  if (range) {
    const a = parseCr(range[1]);
    const b = parseCr(range[2]);
    if (a != null && b != null) return Math.round(((a + b) / 2) * 100) / 100;
  }
  return parseCr(raw);
}

function movieDayFallback(movie: Movie): number {
  return Math.max(
    1,
    Math.floor(
      (Date.parse(`${deskDate()}T12:00:00+05:30`) - Date.parse(`${movie.releaseDate}T12:00:00+05:30`)) /
        86_400_000,
    ) + 1,
  );
}

function clampHollywoodWorldwide(
  movie: Movie,
  worldwide: number | null,
  indiaGross: number | null,
): { value: number | null; note: string | null } {
  if (worldwide == null) return { value: null, note: null };
  if (movie.industry === "Hollywood" && indiaGross != null && worldwide > indiaGross * 2.5) {
    return {
      value: indiaGross,
      note: `Sacnilk reported WW \u20B9${worldwide} Cr; India desk keeps India gross \u20B9${indiaGross} Cr (global WW exceeds 2.5\u00d7 India gross)`,
    };
  }
  return { value: worldwide, note: null };
}

function parseSacnilkPage(
  html: string,
  movie: Movie,
): { readings: Reading[]; territories: TerritorySplit[] } {
  const text = stripTags(html);
  const readings: Reading[] = [];
  const dayRe =
    /Day\s+(\d+)(?:\s+\d{1,2}\s+[A-Za-z]{3,9})?\s*\([^)]+\)\s*\u20B9\s*([\d,.]+)\s*Cr\s*\u20B9\s*([\d,.]+)\s*Cr\s*([\d,]+)\s*([\d.]+)\s*%/g;
  let match: RegExpExecArray | null;
  while ((match = dayRe.exec(text))) {
    const day = Number(match[1]);
    const indiaGross = parseCr(match[2]);
    const indiaNet = parseCr(match[3]);
    const screens = Number(String(match[4]).replace(/,/g, ""));
    const occupancy = Number(match[5]);
    if (!day || indiaNet == null) continue;
    readings.push({
      movieId: movie.id,
      sourceId: "sacnilk",
      reportDate: dateForDay(movie.releaseDate, day),
      dayNumber: day,
      indiaNet,
      indiaGross,
      overseas: null,
      worldwide: null,
      screens: Number.isFinite(screens) ? screens : null,
      occupancy: Number.isFinite(occupancy) ? occupancy : null,
      note: "live scrape",
    });
  }

  // Newer Sacnilk cards sometimes expose only India nett + occupancy, with
  // the calendar year between the date and the weekday label.
  const compactDayRe =
    /Day\s+(\d+)(?:\s+\d{1,2}\s+[A-Za-z]{3,9}(?:\s+\d{4})?)?\s*\([^)]+\)\s*\u20B9\s*([\d,.]+)\s*Cr(?:\s+([\d.]+)\s*%|\s+Language Breakdown)/g;
  const seenDays = new Set(readings.map((reading) => reading.dayNumber));
  while ((match = compactDayRe.exec(text))) {
    const day = Number(match[1]);
    const indiaNet = parseCr(match[2]);
    if (!day || indiaNet == null || seenDays.has(day)) continue;
    seenDays.add(day);
    readings.push({
      movieId: movie.id,
      sourceId: "sacnilk",
      reportDate: dateForDay(movie.releaseDate, day),
      dayNumber: day,
      indiaNet,
      indiaGross: null,
      overseas: null,
      worldwide: null,
      screens: null,
      occupancy: match[3] ? Number(match[3]) : null,
      note: "live scrape",
    });
  }

  const life = text.match(
    /worldwide collections of\s*\u20B9\s*([\d,.]+)\s*Cr\s*\(\s*India Gross:\s*\u20B9\s*([\d,.]+)\s*Cr\s*,\s*Overseas:\s*\u20B9\s*([\d,.]+)\s*Cr[\s\S]{0,120}?\u20B9\s*([\d,.]+)\s*Cr in net/i,
  );
  if (life) {
    const worldwideRaw = parseCr(life[1]);
    const indiaGross = parseCr(life[2]);
    const overseasRaw = parseCr(life[3]);
    const indiaNet = parseCr(life[4]);
    const clamped = clampHollywoodWorldwide(movie, worldwideRaw, indiaGross);
    const worldwide = clamped.value;
    const overseas =
      movie.industry === "Hollywood" && overseasRaw != null && indiaGross != null && overseasRaw > indiaGross * 2.5
        ? null
        : overseasRaw;
    const lastDay = readings.length
      ? readings.reduce((a, b) => (a.dayNumber >= b.dayNumber ? a : b)).dayNumber
      : movieDayFallback(movie);
    readings.push({
      movieId: movie.id,
      sourceId: "sacnilk",
      reportDate: LIFETIME_DATE,
      dayNumber: lastDay,
      indiaNet,
      indiaGross,
      overseas,
      worldwide,
      screens: null,
      occupancy: null,
      note: clamped.note
        ? `lifetime live · ${clamped.note}`
        : "lifetime live",
    });
  }

  const territories: TerritorySplit[] = [];
  const langBlock = text.match(
    /Day 1 \([^)]+\)[\s\S]{0,200}?Language-wise Breakdown([\s\S]{0,500}?)(?:Day 2|Market Analysis|$)/i,
  );
  if (langBlock) {
    const langRe = /(Hindi|Kannada|Telugu|Tamil|Malayalam)\s*\u20B9\s*[\d,.]+\s*Cr\s*\u20B9\s*([\d,.]+)\s*Cr/g;
    let lm: RegExpExecArray | null;
    while ((lm = langRe.exec(langBlock[1]))) {
      const indiaNet = parseCr(lm[2]);
      if (indiaNet == null) continue;
      territories.push({
        movieId: movie.id,
        reportDate: movie.releaseDate,
        territory: lm[1],
        indiaNet,
      });
    }
  }

  return { readings, territories };
}

function parseHungamaTable(html: string): Reading[] {
  const out: Reading[] = [];
  for (const cells of tableRows(html)) {
    if (cells.length < 6 || /rank/i.test(cells[0] ?? "")) continue;
    const movie = matchMovie(cells[1] ?? "");
    if (!movie) continue;
    const indiaNet = parseCr(cells[2]);
    const indiaGross = parseCr(cells[3]);
    const overseas = parseCr(cells[4]);
    const worldwide = parseCr(cells[5]);
    if (worldwide == null && indiaNet == null) continue;
    out.push({
      movieId: movie.id,
      sourceId: "hungama",
      reportDate: LIFETIME_DATE,
      dayNumber: movieDayFallback(movie),
      indiaNet,
      indiaGross,
      overseas,
      worldwide,
      screens: null,
      occupancy: null,
      note: "lifetime live",
    });
  }
  return out;
}

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

function parseHungamaDate(raw: string): string | null {
  const m = raw.match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1].padStart(2, "0")}`;
}

function parseHungamaMoviePage(html: string, movie: Movie): Reading[] {
  const out: Reading[] = [];
  const seenDays = new Set<number>();
  for (const cells of tableRows(html)) {
    const label = cells[0] ?? "";
    const dayMatch = label.match(/^Day\s+(\d+)$/i);
    if (!dayMatch || cells.length < 4) continue;
    const amountRaw = cells[2] ?? "";
    // India nett tables print "₹90 cr.". Overseas tables print raw dollars / tickets.
    if (!/\u20B9|\bcr\.?\b|\brs\.?\b/i.test(amountRaw)) continue;
    const day = Number(dayMatch[1]);
    if (seenDays.has(day)) continue;
    const indiaNet = parseCr(amountRaw);
    if (indiaNet == null || indiaNet <= 0 || indiaNet > 400) continue;
    const reportDate = parseHungamaDate(cells[1] ?? "") ?? dateForDay(movie.releaseDate, day);
    const screens = Number(String(cells[4] ?? "").replace(/,/g, ""));
    const occupancy = parseCr(cells[5]);
    seenDays.add(day);
    out.push({
      movieId: movie.id,
      sourceId: "hungama",
      reportDate,
      dayNumber: day,
      indiaNet,
      indiaGross: null,
      overseas: null,
      worldwide: null,
      screens: Number.isFinite(screens) && screens > 10 ? screens : null,
      occupancy: occupancy != null && occupancy <= 100 ? occupancy : null,
      note: "live scrape · Hungama nett (often Hindi-weighted); India gross not scraped",
    });
  }
  return out;
}

function parsePinkvilla(html: string): ScrapedHeadline[] {
  const out: ScrapedHeadline[] = [];
  const seen = new Set<string>();
  const re = /<a[^>]+href="(https:\/\/www\.pinkvilla\.com[^"]*box-office[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const url = m[1].split("?")[0];
    const title = stripTags(m[2]);
    if (!title || title.length < 18 || seen.has(url)) continue;
    if (!/box office|collection|crore|\u20B9/i.test(title)) continue;
    seen.add(url);
    out.push({
      sourceId: "pinkvilla",
      title,
      url,
      publishedAt: new Date().toISOString(),
      summary: "Pinkvilla box-office desk",
    });
    if (out.length >= 10) break;
  }
  return out;
}

/** Soft lifetime reading from a newsroom headline that cites a crore figure. */
function readingFromHeadline(sourceId: string, title: string, url: string): Reading | null {
  const movie = matchMovie(title);
  if (!movie) return null;
  const gross = title.match(
    /(?:earns?|collects?|grosses?|makes?|clocks?|nets?)\s*(?:rs\.?|₹)?\s*([\d,.]+)\s*cr/i,
  );
  const net = title.match(/([\d,.]+)\s*cr(?:ore)?\s*(?:india\s*)?nett?/i);
  const indiaNet = parseCr(net?.[1] ?? "");
  const indiaGross = parseCr(gross?.[1] ?? "");
  if (indiaNet == null && indiaGross == null) return null;
  return {
    movieId: movie.id,
    sourceId,
    reportDate: LIFETIME_DATE,
    dayNumber: movieDayFallback(movie),
    indiaNet,
    indiaGross,
    overseas: null,
    worldwide: indiaGross,
    screens: null,
    occupancy: null,
    note: "lifetime live · newsroom headline estimate",
  };
}

function parseKoimoiPage(html: string, movie: Movie): Reading[] {
  const text = stripTags(html);
  const out: Reading[] = [];
  const dayRe =
    /Day\s+(\d+)\s*[:\-]?\s*(?:\([^)]+\)\s*)?(?:₹|Rs\.?)\s*([\d,.]+)\s*Cr/gi;
  let match: RegExpExecArray | null;
  const seen = new Set<number>();
  while ((match = dayRe.exec(text))) {
    const day = Number(match[1]);
    const indiaNet = parseCr(match[2]);
    if (!day || seen.has(day) || indiaNet == null || indiaNet <= 0 || indiaNet > 400) continue;
    seen.add(day);
    out.push({
      movieId: movie.id,
      sourceId: "koimoi",
      reportDate: dateForDay(movie.releaseDate, day),
      dayNumber: day,
      indiaNet,
      indiaGross: null,
      overseas: null,
      worldwide: null,
      screens: null,
      occupancy: null,
      note: "live scrape · Koimoi nett; India gross not scraped",
    });
  }

  const lifeWw = text.match(/worldwide[^.]{0,60}?(?:₹|Rs\.?)\s*([\d,.]+)\s*Cr/i);
  const lifeNet = text.match(/India\s*(?:Net|Nett)[^.]{0,40}?(?:₹|Rs\.?)\s*([\d,.]+)\s*Cr/i);
  const worldwide = parseCr(lifeWw?.[1] ?? "");
  const indiaNet = parseCr(lifeNet?.[1] ?? "");
  if (indiaNet != null || worldwide != null) {
    out.push({
      movieId: movie.id,
      sourceId: "koimoi",
      reportDate: LIFETIME_DATE,
      dayNumber: out.at(-1)?.dayNumber ?? movieDayFallback(movie),
      indiaNet: indiaNet ?? null,
      indiaGross: null,
      overseas: null,
      worldwide: worldwide ?? null,
      screens: null,
      occupancy: null,
      note: "lifetime live",
    });
  }
  return out;
}

function wikiReadings(rows: WikiRow[]): Reading[] {
  const out: Reading[] = [];
  for (const row of rows) {
    const movie = matchMovie(row.title);
    if (!movie) continue;
    const worldwide = wikiAmountToCr(row.worldwide);
    if (worldwide == null) continue;
    out.push({
      movieId: movie.id,
      sourceId: "wikipedia",
      reportDate: LIFETIME_DATE,
      dayNumber: movieDayFallback(movie),
      indiaNet: null,
      indiaGross: null,
      overseas: null,
      worldwide,
      screens: null,
      occupancy: null,
      note: row.showing ? "lifetime live · currently showing" : "lifetime live",
    });
  }
  return out;
}

function parseBoiHome(html: string): { url: string; title: string }[] {
  const out: { url: string; title: string }[] = [];
  const re = /href="(report-details\.php\?articleid=\d+)"[^>]*>([^<]+)/gi;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(html))) {
    const path = m[1];
    const title = stripTags(decodeHtml(m[2]));
    if (seen.has(path) || title.length < 12) continue;
    seen.add(path);
    out.push({ url: `https://www.boxofficeindia.com/${path}`, title });
  }
  return out.slice(0, 8);
}

function parseBoiArticle(html: string, title: string, url: string): { headline: ScrapedHeadline; reading: Reading | null } {
  const text = stripTags(html);
  const movie = matchMovie(title);
  const allIndia = text.match(/all India collections[^.]{0,60}?([\d,.]+)\s*crore nett/i);
  const firstWeek = text.match(/first week of\s+([\d,.]+)\s*crore nett/i);
  const indiaNet = parseCr(allIndia?.[1] ?? firstWeek?.[1] ?? "");
  const summary = text.slice(text.search(/had a |collected |The film/i), text.search(/had a |collected |The film/i) + 280) || title;
  const headline: ScrapedHeadline = {
    sourceId: "boi",
    title,
    url,
    publishedAt: new Date().toISOString(),
    summary: summary.replace(/\s+/g, " ").trim().slice(0, 280),
  };
  if (!movie || indiaNet == null) return { headline, reading: null };
  return {
    headline,
    reading: {
      movieId: movie.id,
      sourceId: "boi",
      reportDate: LIFETIME_DATE,
      dayNumber: movieDayFallback(movie),
      indiaNet,
      indiaGross: null,
      overseas: null,
      worldwide: null,
      screens: null,
      occupancy: null,
      note: allIndia ? "lifetime live · BOI all-India nett" : "lifetime live · BOI week nett",
    },
  };
}

export async function ingestLiveSources(): Promise<IngestResult> {
  const logs: IngestResult["logs"] = [];
  const headlines: ScrapedHeadline[] = [];
  const readings: Reading[] = [];
  const territories: TerritorySplit[] = [];
  let wikiRows: WikiRow[] = [];

  const jobs: { sourceId: string; run: () => Promise<void> }[] = [
    ...SACNILK_PAGES.map((page) => ({
      sourceId: "sacnilk" as const,
      run: async () => {
        const movie = MOVIES.find((m) => m.id === page.movieId);
        if (!movie) throw new Error(`Unknown movie ${page.movieId}`);
        const html = await fetchText(`https://www.sacnilk.com/news/${page.slug}`);
        const parsed = parseSacnilkPage(html, movie);
        if (!parsed.readings.length) throw new Error("No day-wise rows");
        readings.push(...parsed.readings);
        territories.push(...parsed.territories);
        const lastDaily = parsed.readings.filter((r) => r.note === "live scrape").at(-1);
        const life = parsed.readings.find((r) => r.note.startsWith("lifetime"));
        headlines.push({
          sourceId: "sacnilk",
          title: `${movie.title}: Sacnilk ${parsed.readings.filter((r) => r.note === "live scrape").length} days, India net \u20B9${life?.indiaNet ?? lastDaily?.indiaNet} Cr`,
          url: `https://www.sacnilk.com/news/${page.slug}`,
          publishedAt: new Date().toISOString(),
          summary: `Live day-wise pull. Last day ${lastDaily?.dayNumber ?? "—"}. WW \u20B9${life?.worldwide ?? "—"} Cr.`,
        });
      },
    })),
    {
      sourceId: "hungama",
      run: async () => {
        const html = await fetchText(
          "https://www.bollywoodhungama.com/box-office-collections/worldwide/2026/",
        );
        const parsed = parseHungamaTable(html);
        if (!parsed.length) throw new Error("Worldwide table empty");
        readings.push(...parsed);
        headlines.push({
          sourceId: "hungama",
          title: `Hungama 2026 worldwide: ${parsed.length} titles matched`,
          url: "https://www.bollywoodhungama.com/box-office-collections/worldwide/2026/",
          publishedAt: new Date().toISOString(),
          summary: parsed
            .slice(0, 5)
            .map((r) => `${r.movieId} \u20B9${r.worldwide} Cr WW`)
            .join(" \u00b7 "),
        });
      },
    },
    ...HUNGAMA_PAGES.map((page) => ({
      sourceId: "hungama" as const,
      run: async () => {
        const movie = MOVIES.find((m) => m.id === page.movieId);
        if (!movie) throw new Error(`Unknown movie ${page.movieId}`);
        const html = await fetchText(`https://www.bollywoodhungama.com/movie/${page.slug}/box-office/`);
        const parsed = parseHungamaMoviePage(html, movie);
        if (!parsed.length) return;
        readings.push(...parsed);
      },
    })),
    {
      sourceId: "wikipedia",
      run: async () => {
        const json = await fetchText(
          "https://en.wikipedia.org/w/api.php?action=parse&page=List_of_Indian_films_of_2026&prop=wikitext&format=json&formatversion=2",
        );
        const parsed = JSON.parse(json) as { parse?: { wikitext?: string } };
        wikiRows = parseWikiWikitext(parsed.parse?.wikitext ?? "");
        readings.push(...wikiReadings(wikiRows));
        if (wikiRows[0]) {
          headlines.push({
            sourceId: "wikipedia",
            title: `Wikipedia 2026 ranking: ${wikiRows[0].title} leads at ${wikiRows[0].worldwide}`,
            url: "https://en.wikipedia.org/wiki/List_of_Indian_films_of_2026",
            publishedAt: new Date().toISOString(),
            summary: wikiRows
              .slice(0, 6)
              .map((r) => `${r.rank}. ${r.title} (${r.language}) ${r.worldwide}`)
              .join(" \u00b7 "),
          });
        }
      },
    },
    {
      sourceId: "etimes",
      run: async () => {
        const xml = await fetchText("https://timesofindia.indiatimes.com/rssfeeds/1081479906.cms");
        const items = parseRss(xml, "etimes");
        if (!items.length) throw new Error("ETimes RSS empty");
        headlines.push(...items);
      },
    },
    {
      sourceId: "express",
      run: async () => {
        try {
          const xml = await fetchText("https://indianexpress.com/section/entertainment/feed/");
          const items = parseRss(xml, "express");
          if (items.length) {
            headlines.push(...items);
            return;
          }
        } catch {
          /* Express RSS is often 403; fall through to The Hindu, still labelled as wires. */
        }
        const xml = await fetchText("https://www.thehindu.com/entertainment/movies/feeder/default.rss");
        const items = parseRss(xml, "express").filter((h) =>
          /box office|collection|toxic|awarapan|vishwanath|irumudi|dhurandhar|cinema|film/i.test(
            `${h.title} ${h.summary}`,
          ),
        );
        const picked = items.length ? items : parseRss(xml, "express").slice(0, 4);
        if (!picked.length) throw new Error("No entertainment headlines");
        headlines.push(
          ...picked.map((h) => ({
            ...h,
            summary: `${h.summary} (The Hindu feed; Indian Express RSS blocked)`,
          })),
        );
      },
    },
    {
      sourceId: "pinkvilla",
      run: async () => {
        const html = await fetchText("https://www.pinkvilla.com/entertainment/box-office");
        const items = parsePinkvilla(html);
        if (!items.length) throw new Error("No box-office headlines");
        headlines.push(...items);
        for (const item of items) {
          const soft = readingFromHeadline("pinkvilla", item.title, item.url);
          if (soft) readings.push(soft);
        }
      },
    },
    ...KOIMOI_PAGES.map((page) => ({
      sourceId: "koimoi" as const,
      run: async () => {
        const movie = MOVIES.find((m) => m.id === page.movieId);
        if (!movie) throw new Error(`Unknown movie ${page.movieId}`);
        const html = await fetchText(
          `https://www.koimoi.com/box-office/daily-breakdown/${page.slug}/`,
        );
        const parsed = parseKoimoiPage(html, movie);
        if (!parsed.length) throw new Error("No day-wise rows");
        readings.push(...parsed);
        const lastDaily = parsed.filter((r) => r.note === "live scrape").at(-1);
        const life = parsed.find((r) => r.note.startsWith("lifetime"));
        headlines.push({
          sourceId: "koimoi",
          title: `${movie.title}: Koimoi ${parsed.filter((r) => r.note === "live scrape").length} days`,
          url: `https://www.koimoi.com/box-office/daily-breakdown/${page.slug}/`,
          publishedAt: new Date().toISOString(),
          summary: `Live day-wise pull. Last day ${lastDaily?.dayNumber ?? "—"}. India net \u20B9${life?.indiaNet ?? lastDaily?.indiaNet ?? "—"} Cr.`,
        });
      },
    })),
    {
      sourceId: "boi",
      run: async () => {
        const home = await fetchText("https://www.boxofficeindia.com/");
        const links = parseBoiHome(home);
        if (!links.length) throw new Error("No BOI report links");
        let readingsN = 0;
        await runPool(links.slice(0, 8), 3, async (link) => {
          try {
            const html = await fetchText(link.url);
            const parsed = parseBoiArticle(html, link.title, link.url);
            headlines.push(parsed.headline);
            if (parsed.reading) {
              readings.push(parsed.reading);
              readingsN += 1;
            }
          } catch {
            headlines.push({
              sourceId: "boi",
              title: link.title,
              url: link.url,
              publishedAt: new Date().toISOString(),
              summary: "Box Office India trade note",
            });
          }
        });
        if (readingsN === 0 && !headlines.some((h) => h.sourceId === "boi")) {
          throw new Error("BOI articles empty");
        }
      },
    },
  ];

  const jobNotes: { sourceId: string; ok: boolean; detail: string }[] = [];

  await runPool(jobs, 8, async (job) => {
    try {
      await job.run();
      jobNotes.push({
        sourceId: job.sourceId,
        ok: true,
        detail: "Fetched",
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Failed";
      jobNotes.push({ sourceId: job.sourceId, ok: false, detail });
    }
  });

  const bySource = new Map<string, { ok: number; fail: number; details: string[] }>();
  for (const note of jobNotes) {
    const cur = bySource.get(note.sourceId) ?? { ok: 0, fail: 0, details: [] };
    if (note.ok) cur.ok += 1;
    else cur.fail += 1;
    cur.details.push(note.detail);
    bySource.set(note.sourceId, cur);
  }
  for (const [sourceId, cur] of bySource) {
    const n = readings.filter((r) => r.sourceId === sourceId).length;
    if (cur.ok) {
      logs.push({
        sourceId,
        status: "ok",
        detail: n
          ? `${n} collection rows from ${cur.ok} live pull${cur.ok === 1 ? "" : "s"}${cur.fail ? `, ${cur.fail} page(s) missed` : ""}`
          : `Fetched ${cur.ok} page${cur.ok === 1 ? "" : "s"} (headlines / status)`,
      });
    } else {
      logs.push({
        sourceId,
        status: "blocked",
        detail: cur.details[0] ?? "Failed",
      });
    }
  }

  const seen = new Set<string>();
  const uniqueHeadlines = headlines.filter((h) => {
    if (seen.has(h.url)) return false;
    seen.add(h.url);
    return true;
  });

  return { headlines: uniqueHeadlines, readings, territories, wikiRows, logs };
}
