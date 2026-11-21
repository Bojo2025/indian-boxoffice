/**
 * Desk reports — three IST editions a day.
 *
 * morning  07:00  yesterday's closed day
 * midday   13:00  shows, occupancy, advance bookings
 * evening  20:00  the day's collection so far
 *
 * Figures come from board.json. News pages are fetched and cited.
 * A disagreeing publication is listed beside the desk series, never averaged in.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "docs");
const boardPath = join(outDir, "board.json");
const catalogPath = join(outDir, "catalog.js");
const briefPath = join(outDir, "morning-brief.json");

export type Slot = "morning" | "midday" | "evening";

const SLOT_ORDER: Slot[] = ["morning", "midday", "evening"];

const SLOT_META: Record<Slot, { label: string; clock: string; focus: string }> = {
  morning: { label: "Last day", clock: "7:00 IST", focus: "Yesterday's closed collection" },
  midday: { label: "Occupancy and bookings", clock: "13:00 IST", focus: "Shows, occupancy, and advance bookings" },
  evening: { label: "Collections so far", clock: "20:00 IST", focus: "The day's collection so far" },
};

type DayWise = {
  reportDate: string;
  dayNumber: number;
  indiaNet: number;
  indiaGross: number;
  overseas: number;
  worldwide: number;
  netChangePct: number | null;
  screens: number | null;
  occupancy: number | null;
};

type FilmRow = {
  id: string;
  slug: string;
  title: string;
  language: string;
  industry?: string;
  releaseDate: string;
  status: string;
  indiaNet: number;
  indiaGross: number;
  overseas: number;
  worldwide: number;
  lastDayNet: number | null;
  trackedThroughDay: number | null;
  liveSources?: string[];
  dayWise?: DayWise[];
};

type Board = {
  generatedAt?: string;
  deskDate?: string;
  films?: FilmRow[];
};

export type Citation = {
  url: string;
  title: string;
  note?: string;
};

export type DeskEdition = {
  kind: "desk-edition";
  slot: Slot;
  briefDate: string;
  generatedAt: string;
  headline: string;
  lede: string;
  body: string;
  citations: Citation[];
  boardGeneratedAt: string | null;
  model: "desk-report-v1";
  provisional: boolean;
  leadTitle: string;
};

export type DeskBundle = {
  kind: "desk-day";
  briefDate: string;
  generatedAt: string;
  headline: string;
  lede: string;
  body: string;
  citations: Citation[];
  boardGeneratedAt: string | null;
  model: "desk-report-v1";
  editions: DeskEdition[];
};

const SLOT_START_MIN: Record<Slot, number> = { morning: 7 * 60, midday: 13 * 60, evening: 20 * 60 };

function istMinutesNow(d = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

// Scheduled runs only file a report inside the slot's window. A late run is
// skipped instead of being filed under the wrong day or at the wrong hour.
function outsideSlotWindow(slot: Slot): string | null {
  if (process.env.GITHUB_EVENT_NAME !== "schedule") return null;
  const now = istMinutesNow();
  const start = SLOT_START_MIN[slot];
  if (now < start - 60 || now > start + 240) {
    const hh = String(Math.floor(now / 60)).padStart(2, "0");
    const mm = String(now % 60).padStart(2, "0");
    return `${slot} is outside its window (IST now ${hh}:${mm})`;
  }
  return null;
}

function deskDateIst(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function readJson<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function fmt(value: number | null | undefined, blankZero = false): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (blankZero && value === 0) return "—";
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 1 : 2;
  return `₹${abs.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} Cr`;
}

function fmtExact(value: number): string {
  return `₹${Math.abs(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Cr`;
}

function fmtInt(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  return Math.round(value).toLocaleString("en-IN");
}

function fmtPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`;
}

function longDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function shortDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
  }).format(date);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isNoise(film: FilmRow): boolean {
  const last = film.lastDayNet ?? 0;
  if (!(last > 0) || film.status === "closed") return true;
  const days = film.dayWise ?? [];
  const nett = film.indiaNet ?? 0;
  if (nett < 1 && (days.length <= 1 || Math.abs(nett - last) < 0.05)) return true;
  return false;
}

function sortedDays(film: FilmRow): DayWise[] {
  return [...(film.dayWise ?? [])].sort((a, b) => a.dayNumber - b.dayNumber);
}

function subjectDay(film: FilmRow, slot: Slot, today: string): DayWise | null {
  const days = sortedDays(film);
  if (!days.length) return null;
  if (slot === "morning") {
    const closed = days.filter((day) => day.reportDate < today);
    return closed[closed.length - 1] ?? days[days.length - 1];
  }
  const todayRow = [...days].reverse().find((day) => day.reportDate === today);
  return todayRow ?? days[days.length - 1];
}

function previousDay(film: FilmRow, day: DayWise): DayWise | null {
  const days = sortedDays(film);
  const idx = days.findIndex((row) => row.dayNumber === day.dayNumber && row.reportDate === day.reportDate);
  return idx > 0 ? days[idx - 1] : null;
}

function languageLabel(film: FilmRow): string | null {
  const language = (film.language || "").trim();
  if (!language || /^indian$/i.test(language)) return null;
  return language;
}

function istClock(iso: string | undefined): string {
  if (!iso) return "desk time unavailable";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h12",
  }).format(date);
}

type NewsHit = {
  url: string;
  title: string;
  source: string;
  numbers: number[];
  mentionsBooking: boolean;
  mentionsProducer: boolean;
  status: "cited" | "unchecked";
  detail?: string;
};

function croreNumbers(text: string): number[] {
  const found: number[] = [];
  const re = /(?:₹|rs\.?|inr)?\s*([\d]{1,3}(?:,[\d]{2,3})+(?:\.\d+)?|[\d]+(?:\.\d+)?)\s*(?:cr|crore)\b/gi;
  for (const match of text.matchAll(re)) {
    const value = Number(match[1].replace(/,/g, ""));
    if (Number.isFinite(value) && value > 0 && value < 10000) found.push(value);
  }
  return found;
}

function near(value: number, target: number, tolerance = 1.5): boolean {
  return Math.abs(value - target) <= tolerance;
}

async function fetchText(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "IndianBoxOfficeDesk/1.0 (+https://indian-boxoffice.com/about/)",
        Accept: "text/html,application/rss+xml,application/xml,text/plain",
      },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });
    const text = res.ok ? await res.text() : "";
    return { ok: res.ok, status: res.status, text };
  } catch (error) {
    return { ok: false, status: 0, text: error instanceof Error ? error.message : "fetch failed" };
  }
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Sources that are not trade box office reporting and must never be cited.
const EXCLUDED_NEWS_SOURCES = /^(imdb|wikipedia|reddit|youtube|facebook|x|twitter|instagram)\b/i;

// A headline only counts as a collection figure when it states a result, not a budget, target or forecast.
function isCollectionClaim(title: string): boolean {
  if (!/collect|box office|nett|net|gross|earn|worldwide|day \d+/i.test(title)) return false;
  return !/\b(set to|to cross|will cross|eyes|target|budget|expected|projected|predict\w*|forecast|likely|could|may|aims?|goal|estimated cost|cost)\b/i.test(title);
}

async function searchNews(film: FilmRow): Promise<NewsHit[]> {
  const hits: NewsHit[] = [];
  const query = encodeURIComponent(`${film.title} box office collection`);
  const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;
  const rss = await fetchText(rssUrl);
  if (rss.ok) {
    const items = [...rss.text.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 8);
    for (const item of items) {
      const block = item[1];
      const title = stripTags(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
      const link = stripTags(block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "");
      const sourceTag = block.match(/<source\b([^>]*)>([\s\S]*?)<\/source>/i);
      const source = stripTags(sourceTag?.[2] ?? "News");
      const sourceUrl = sourceTag?.[1]?.match(/\burl="([^"]+)"/i)?.[1] ?? "";
      if (!title || !source) continue;
      if (EXCLUDED_NEWS_SOURCES.test(source)) continue;
      const url = sourceUrl || (link && !/news\.google\.com/i.test(link) ? link : "");
      hits.push({
        url,
        title,
        source,
        numbers: isCollectionClaim(title) ? croreNumbers(title) : [],
        mentionsBooking: /advance booking|booking|occupancy/i.test(title),
        mentionsProducer: /producer|makers claim|official collection/i.test(title),
        status: "cited",
      });
    }
  }

  const pages: { source: string; url: string }[] = [
    {
      source: "Sacnilk",
      url: `https://www.sacnilk.com/news/${film.slug}_Box_Office_Collection_Day_Wise_Worldwide`,
    },
    {
      source: "Sacnilk",
      url: `https://www.sacnilk.com/quicknews/${film.slug}_Box_Office_Collection_Day_${film.trackedThroughDay ?? ""}`,
    },
    { source: "Pinkvilla", url: "https://www.pinkvilla.com/entertainment/box-office" },
    { source: "Indian Express", url: "https://indianexpress.com/section/entertainment/bollywood/box-office-collection/" },
    { source: "Koimoi", url: "https://www.koimoi.com/box-office/" },
    { source: "Box Office India", url: "https://www.boxofficeindia.com/" },
  ];

  for (const page of pages) {
    const result = await fetchText(page.url);
    if (!result.ok) continue;
    const text = stripTags(result.text).slice(0, 12000);
    const mentionsFilm = new RegExp(film.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text);
    if (!mentionsFilm && !/sacnilk/i.test(page.source)) continue;
    hits.push({
      url: page.url,
      title: page.source,
      source: page.source,
      numbers: [],
      mentionsBooking: /advance booking|tickets booked|occupancy/i.test(text),
      mentionsProducer: /producer|official collection/i.test(text),
      status: "cited",
    });
  }
  return hits;
}

function deskTargets(film: FilmRow, day: DayWise, prior: DayWise | null): number[] {
  return [
    film.indiaNet,
    film.indiaGross,
    film.overseas,
    film.worldwide,
    day.indiaNet,
    day.indiaGross,
    prior?.indiaNet ?? NaN,
    prior?.indiaGross ?? NaN,
  ].filter((value) => Number.isFinite(value) && value > 0);
}

function buildEdition(
  film: FilmRow,
  others: FilmRow[],
  slot: Slot,
  today: string,
  board: Board,
  news: NewsHit[],
): DeskEdition {
  const day = subjectDay(film, slot, today);
  if (!day) throw new Error(`No day row for ${film.title}`);
  const prior = previousDay(film, day);
  const change =
    prior && prior.indiaNet > 0 ? round2(((day.indiaNet - prior.indiaNet) / prior.indiaNet) * 100) : day.netChangePct;
  const provisional =
    slot !== "morning" && (day.reportDate === today || !(day.overseas > 0) || !(day.worldwide > 0));
  const targets = deskTargets(film, day, prior);
  const daySumNet = round2(sortedDays(film).reduce((sum, row) => sum + (row.indiaNet || 0), 0));
  const nettGap = round2(film.indiaNet - daySumNet);
  const nextMilestone = film.worldwide >= 1500 ? 2000 : film.worldwide >= 1000 ? 1500 : 1000;
  const milestoneGap = round2(nextMilestone - film.worldwide);
  const throughDay = film.trackedThroughDay ?? day.dayNumber;
  const occ =
    day.occupancy != null && day.occupancy > 0
      ? `${day.occupancy.toLocaleString("en-IN", { maximumFractionDigits: 1 })}% occupancy`
      : "";
  const shows = day.screens ? `${fmtInt(day.screens)} shows` : "";
  const footprint = [shows, occ].filter(Boolean).join(" at ");
  const changeBit = prior
    ? `${fmtPct(change)} from Day ${prior.dayNumber}'s ${fmt(prior.indiaNet)}`
    : "with no previous day on the ledger";
  const bookingNoted = news.some((hit) => hit.status === "cited" && hit.mentionsBooking);
  const producerNoted = news.some((hit) => hit.status === "cited" && hit.mentionsProducer);

  const headline = `${film.title} Day ${day.dayNumber}: ${fmt(day.indiaNet)} India nett`;

  const opening =
    slot === "midday"
      ? `${film.title} on Day ${day.dayNumber} (${longDate(day.reportDate)}) is at ${fmt(day.indiaNet)} India nett and ${fmt(day.indiaGross)} India gross, ${changeBit}. ${footprint ? `The board has ${footprint}.` : "Shows and occupancy are not on this row yet."} ${bookingNoted ? "Trade notes mention advance bookings, but no separate booking total is published here." : "Advance bookings are not reported yet."} ${provisional ? "The day is still open, so this is not the final figure." : ""}`
      : slot === "morning"
        ? `${film.title} closed Day ${day.dayNumber} on ${longDate(day.reportDate)} at ${fmt(day.indiaNet)} India nett and ${fmt(day.indiaGross)} India gross, ${changeBit}. ${footprint ? `That day played on ${footprint}.` : ""} This is the closed day on the desk, not a live estimate.`
        : `${film.title}'s Day ${day.dayNumber} collection so far, on ${longDate(day.reportDate)}, is ${fmt(day.indiaNet)} India nett and ${fmt(day.indiaGross)} India gross, ${changeBit}. ${footprint ? `That is across ${footprint}.` : ""} ${provisional ? `Updated ${istClock(board.generatedAt)} IST, and still a live estimate rather than the final drop.` : "The desk is treating this day as closed."}`;

  const chart = others
    .slice(0, 2)
    .map((other) => `${other.title} at ${fmt(other.lastDayNet)}`)
    .join(" and ");
  const running = `Through Day ${throughDay} the desk has ${film.title} at ${fmt(film.indiaNet)} India nett, ${fmt(film.indiaGross)} India gross, ${fmt(film.overseas)} overseas and ${fmt(film.worldwide)} worldwide. ${
    Math.abs(nettGap) >= 1
      ? `Adding the day-wise nett rows gives ${fmtExact(daySumNet)}, which is a different series from that lifetime nett, so the two are not combined. `
      : ""
  }${
    milestoneGap > 0 && milestoneGap <= 80
      ? `Worldwide is ${fmtExact(milestoneGap)} short of ${fmt(nextMilestone)}. `
      : ""
  }${chart ? `Behind it on the daily chart, ${chart}.` : ""} ${
    day.overseas > 0 ? "" : "This day's overseas figure is not in, so it is not used to move the worldwide total."
  }`;

  const cited = news.filter((hit) => hit.status === "cited");
  const mentioned: string[] = [];
  const seenSource = new Set<string>();
  for (const hit of cited) {
    if (seenSource.has(hit.source)) continue;
    const fresh = hit.numbers.find((value) => value >= 100 && !targets.some((target) => near(value, target)));
    if (fresh == null) continue;
    seenSource.add(hit.source);
    mentioned.push(`${hit.source} is citing about ${fmt(fresh)}`);
    if (mentioned.length >= 3) break;
  }
  const newsLine = mentioned.length
    ? `Trade coverage is still led by ${film.title}. ${mentioned.join(", ")}. The desk keeps ${fmt(film.indiaNet)} India nett and ${fmt(film.worldwide)} worldwide, and does not blend those reports into its own total.`
    : `Trade coverage is still led by ${film.title}. The desk figure remains ${fmt(film.indiaNet)} India nett and ${fmt(film.worldwide)} worldwide.`;
  const producerLine = producerNoted
    ? " A producer claim is not included in that total."
    : " No producer-certified total is included.";

  const lede = opening.replace(/\s+/g, " ").trim();
  const body = [running, `${newsLine}${producerLine}`].map((paragraph) => paragraph.replace(/\s+/g, " ").trim()).join("\n\n");
  const citations: Citation[] = [];

  return {
    kind: "desk-edition",
    slot,
    briefDate: today,
    generatedAt: new Date().toISOString(),
    headline,
    lede,
    body,
    citations,
    boardGeneratedAt: board.generatedAt ?? null,
    model: "desk-report-v1",
    provisional,
    leadTitle: film.title,
  };
}

function bundleEditions(editions: DeskEdition[], board: Board): DeskBundle {
  const ordered = SLOT_ORDER.map((slot) => editions.find((edition) => edition.slot === slot)).filter(
    (edition): edition is DeskEdition => Boolean(edition),
  );
  const latest = ordered[ordered.length - 1];
  const citations: Citation[] = [];
  return {
    kind: "desk-day",
    briefDate: latest?.briefDate ?? deskDateIst(),
    generatedAt: latest?.generatedAt ?? new Date().toISOString(),
    headline: latest?.headline ?? "Indian Box Office desk reports",
    lede: ordered.map((edition) => `${SLOT_META[edition.slot].clock}: ${edition.headline}`).join(" "),
    body: ordered.map((edition) => `## ${SLOT_META[edition.slot].clock} — ${SLOT_META[edition.slot].label}\n\n${edition.body}`).join("\n\n"),
    citations,
    boardGeneratedAt: board.generatedAt ?? null,
    model: "desk-report-v1",
    editions: ordered,
  };
}

function writeEdition(edition: DeskEdition) {
  const dir = join(outDir, "briefs", edition.briefDate, edition.slot);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "brief.json"), `${JSON.stringify(edition, null, 2)}\n`);
}

function injectBundle(bundle: DeskBundle) {
  if (!bundle.editions.length) {
    console.log("No desk report was written this run; leaving the existing bundle in place.");
    return;
  }
  writeFileSync(briefPath, `${JSON.stringify(bundle, null, 2)}\n`);
  mkdirSync(join(outDir, "briefs", bundle.briefDate), { recursive: true });
  writeFileSync(join(outDir, "briefs", bundle.briefDate, "brief.json"), `${JSON.stringify(bundle, null, 2)}\n`);

  if (existsSync(catalogPath)) {
    const raw = readFileSync(catalogPath, "utf8");
    const match = raw.match(/^window\.IBO_CATALOG\s*=\s*([\s\S]*);\s*$/);
    if (match) {
      try {
        const pack = JSON.parse(match[1]) as Record<string, unknown>;
        pack.morningBrief = bundle;
        writeFileSync(catalogPath, `window.IBO_CATALOG = ${JSON.stringify(pack, null, 2)};\n`);
      } catch (error) {
        console.warn("Could not inject catalog.js:", error);
      }
    }
  }

  const boardPack = readJson<Record<string, unknown>>(boardPath);
  if (boardPack) {
    boardPack.morningBrief = bundle;
    writeFileSync(boardPath, `${JSON.stringify(boardPack, null, 2)}\n`);
  }
}

function existingEdition(date: string, slot: Slot): DeskEdition | null {
  return readJson<DeskEdition>(join(outDir, "briefs", date, slot, "brief.json"));
}

function parseSlots(raw: string | undefined): Slot[] {
  const value = (raw || "all").trim().toLowerCase();
  if (value === "all" || value === "") return [...SLOT_ORDER];
  if (value === "morning" || value === "midday" || value === "evening") return [value];
  throw new Error(`Unknown BRIEF_SLOT "${raw}". Use morning, midday, evening, or all.`);
}

export async function generateDeskBriefs(slotArg?: string): Promise<DeskBundle> {
  const board = readJson<Board>(boardPath);
  const films = board?.films ?? [];
  if (!films.length) throw new Error("board.json has no films — run publish:desk first");

  const today = deskDateIst();
  const real = films.filter((film) => !isNoise(film)).sort((a, b) => (b.lastDayNet ?? 0) - (a.lastDayNet ?? 0));
  const lead = real[0];
  if (!lead) throw new Error("No film with a real latest-day India nett");
  const others = real.filter((film) => film.id !== lead.id);
  const wanted = parseSlots(slotArg ?? process.env.BRIEF_SLOT);
  const force = process.env.FORCE_BRIEF === "1";

  const news = await searchNews(lead);
  const editions: DeskEdition[] = [];
  for (const slot of SLOT_ORDER) {
    const previous = existingEdition(today, slot);
    if (!wanted.includes(slot)) {
      if (previous?.briefDate === today) editions.push(previous);
      continue;
    }
    if (previous && previous.briefDate === today && previous.model === "desk-report-v1" && !force) {
      console.log(`${slot} report already exists for ${today} — keeping it. Set FORCE_BRIEF=1 to rewrite.`);
      editions.push(previous);
      continue;
    }
    const late = outsideSlotWindow(slot);
    if (late) {
      console.log(`Skipped ${slot} report: ${late}.`);
      if (previous?.briefDate === today) editions.push(previous);
      continue;
    }
    const edition = buildEdition(lead, others, slot, today, board!, news);
    writeEdition(edition);
    editions.push(edition);
    console.log(`✓ ${slot} report — ${edition.headline}`);
  }

  const bundle = bundleEditions(editions, board!);
  injectBundle(bundle);
  console.log(`✓ Desk bundle → docs/morning-brief.json (${bundle.editions.map((edition) => edition.slot).join(", ")})`);
  return bundle;
}

const invoked = process.argv.some((arg) => /generate-morning-brief\.mts$/.test(arg));
if (invoked) {
  await generateDeskBriefs();
  const { generateSeoPages } = await import("./generate-seo-pages.mts");
  await generateSeoPages();
}
