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
      const source = stripTags(block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] ?? "News");
      if (!title || !link) continue;
      hits.push({
        url: link,
        title,
        source,
        numbers: croreNumbers(title),
        mentionsBooking: /advance booking|booking|occupancy/i.test(title),
        mentionsProducer: /producer|makers claim|official collection/i.test(title),
        status: "cited",
      });
    }
  } else {
    hits.push({
      url: rssUrl,
      title: "Google News search",
      source: "Google News",
      numbers: [],
      mentionsBooking: false,
      mentionsProducer: false,
      status: "unchecked",
      detail: rss.status ? `HTTP ${rss.status}` : "unreachable",
    });
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
    if (!result.ok) {
      hits.push({
        url: page.url,
        title: page.source,
        source: page.source,
        numbers: [],
        mentionsBooking: false,
        mentionsProducer: false,
        status: "unchecked",
        detail: result.status ? `HTTP ${result.status}` : "unreachable",
      });
      continue;
    }
    const text = stripTags(result.text).slice(0, 20000);
    const mentionsFilm = new RegExp(film.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text);
    if (!mentionsFilm && !/sacnilk/i.test(page.source)) continue;
    hits.push({
      url: page.url,
      title: `${page.source} — ${film.title}`,
      source: page.source,
      numbers: croreNumbers(text).slice(0, 12),
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
  const status = provisional ? "live estimate" : "closed";
  const meta = SLOT_META[slot];
  const sources = (film.liveSources ?? []).filter(Boolean);
  const sourceLabel = sources.length ? sources.join(", ") : "desk board";
  const daySumNet = round2(sortedDays(film).reduce((sum, row) => sum + (row.indiaNet || 0), 0));
  const nettGap = round2(film.indiaNet - daySumNet);
  const nextMilestone = film.worldwide >= 1500 ? 2000 : film.worldwide >= 1000 ? 1500 : 1000;
  const milestoneGap = round2(nextMilestone - film.worldwide);

  const headline = `${film.title} Day ${day.dayNumber}: ${fmt(day.indiaNet)} India nett`;
  const lede = [
    `${longDate(day.reportDate)}. ${status[0].toUpperCase()}${status.slice(1)} on the Indian Box Office desk (${sourceLabel}), board updated ${istClock(board.generatedAt)} IST.`,
    prior
      ? `Day ${day.dayNumber} India nett is ${fmt(day.indiaNet)} against Day ${prior.dayNumber} ${fmt(prior.indiaNet)} (${fmtPct(change)}).`
      : `Day ${day.dayNumber} India nett is ${fmt(day.indiaNet)}.`,
    `Desk cumulative India nett is ${fmt(film.indiaNet)} and worldwide gross is ${fmt(film.worldwide)} through Day ${film.trackedThroughDay ?? day.dayNumber}.`,
  ].join(" ");

  const tableRows = sortedDays(film)
    .map((row) => {
      const mark = row.dayNumber === day.dayNumber && provisional ? "*" : "";
      return `| ${row.dayNumber}${mark} | ${shortDate(row.reportDate)} | ${fmt(row.indiaNet)} | ${fmt(row.indiaGross)} | ${fmtInt(row.screens)} | ${row.occupancy != null && row.occupancy > 0 ? `${row.occupancy.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%` : "—"} | ${fmt(row.overseas, true)} | ${fmt(row.worldwide, true)} |`;
    })
    .join("\n");

  const targets = deskTargets(film, day, prior);
  const disagreements: string[] = [];
  const agreements: string[] = [];
  let bookingLine = "Advance bookings: not reported yet on the pages checked for this run.";
  let producerLine = "No producer-certified collection figure was identified in the sources checked. Figures above are desk and trade estimates.";

  for (const hit of news) {
    if (hit.status === "unchecked") {
      disagreements.push(`- ${hit.source}: unchecked (${hit.detail ?? "no response"}) — ${hit.url}`);
      continue;
    }
    if (hit.mentionsBooking && slot === "midday") {
      bookingLine = `Advance bookings: ${hit.source} mentions bookings or occupancy. See ${hit.url}. The desk does not turn that mention into a rupee total.`;
    }
    if (hit.mentionsProducer) {
      producerLine = `${hit.source} uses producer or official-collection language. It is cited below and is not folded into the desk total. ${hit.url}`;
    }
    const fresh = hit.numbers.filter((value) => !targets.some((target) => near(value, target)));
    const matched = hit.numbers.filter((value) => targets.some((target) => near(value, target)));
    if (fresh.length) {
      const shown = [...new Set(fresh.map((value) => fmt(value)))].slice(0, 4).join(", ");
      disagreements.push(
        `- ${hit.source}: reports ${shown}, which is not the desk series (${fmt(film.indiaNet)} India nett / ${fmt(film.worldwide)} worldwide). Not averaged. ${hit.url}`,
      );
    } else if (matched.length) {
      agreements.push(`- ${hit.source}: figures in this headline sit on the desk series. ${hit.url}`);
    } else {
      agreements.push(`- ${hit.source}: checked, no separate crore figure extracted. ${hit.url}`);
    }
  }

  const othersLines = others.slice(0, 4).map((other, index) => {
    const lang = languageLabel(other);
    return `- ${index + 2}. ${other.title}${lang ? ` (${lang})` : ""} — latest day ${fmt(other.lastDayNet)}; cumulative India nett ${fmt(other.indiaNet)}; worldwide ${fmt(other.worldwide)}`;
  });

  const sections = [
    `${meta.clock} desk report. ${meta.focus}. ${provisional ? "This day is still moving, so the daily figure is a live estimate and is not the final drop." : "This is the closed day on the desk ledger."}`,
    `## Day ${day.dayNumber} — latest reported collection`,
    [
      `Status: ${status}.`,
      `Source on the board: ${sourceLabel}.`,
      `Updated: ${istClock(board.generatedAt)} IST.`,
      day.screens ? `Shows tracked: ${fmtInt(day.screens)}.` : "Shows tracked: not on this row.",
      day.occupancy != null && day.occupancy > 0
        ? `Occupancy: ${day.occupancy.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%.`
        : "Occupancy: not on this row.",
    ].join(" "),
    `India nett: ${fmt(day.indiaNet)}${provisional ? " (live estimate)" : ""}.`,
    `India gross: ${fmt(day.indiaGross)}${provisional ? " (live estimate)" : ""}.`,
    prior
      ? `Change against Day ${prior.dayNumber}: previous day ${fmt(prior.indiaNet)} nett, current day ${fmt(day.indiaNet)} nett, change ${fmtPct(change)}.`
      : "No previous day is on the ledger, so a day-to-day change is not calculated.",
    slot === "midday" ? bookingLine : "",
    `## Day-by-day collection`,
    "India nett and India gross are daily figures. Overseas and worldwide stay blank when that day's row does not report them. A blank cell is not zero, and it is not filled from the jump in the lifetime worldwide total.",
    [
      "| Day | Date | India nett | India gross | Shows | Occupancy | Overseas | Worldwide |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
      tableRows,
    ].join("\n"),
    provisional ? `* Day ${day.dayNumber} is a live estimate.` : "",
    `## Cumulative totals through Day ${film.trackedThroughDay ?? day.dayNumber}`,
    `These are the desk lifetime fields, not a sum invented from the day table.`,
    `- India nett: ${fmt(film.indiaNet)}`,
    `- India gross: ${fmt(film.indiaGross)}`,
    `- Overseas gross: ${fmt(film.overseas, true)}`,
    `- Worldwide gross: ${fmt(film.worldwide, true)}`,
    Math.abs(nettGap) >= 1
      ? `The day-wise India nett rows on this film add up to ${fmtExact(daySumNet)}. That sum is not the same series as the desk lifetime nett of ${fmt(film.indiaNet)} (gap ${fmtExact(Math.abs(nettGap))}). Both stay on the page. They are not merged.`
      : "",
    day.worldwide > 0 ? "" : `Day ${day.dayNumber} worldwide gross is not on the row, so the lifetime worldwide figure is not moved forward for this day.`,
    `## Cross-check`,
    `Desk series, kept as published: Day ${day.dayNumber} India nett ${fmt(day.indiaNet)}, India gross ${fmt(day.indiaGross)}, lifetime India nett ${fmt(film.indiaNet)}, worldwide ${fmt(film.worldwide)}.`,
    disagreements.length ? disagreements.join("\n") : "No fetched page produced a crore figure outside the desk series.",
    agreements.length ? agreements.join("\n") : "",
    producerLine,
    othersLines.length ? `## Other films on the daily chart` : "",
    othersLines.length
      ? `Ranked by latest reported India nett, after dropping sub-₹1 Cr titles whose lifetime equals a single day.\n\n${othersLines.join("\n")}`
      : "",
    `## Observation`,
    [
      milestoneGap > 0 && milestoneGap <= 80
        ? `Worldwide gross is ${fmt(film.worldwide)} through Day ${film.trackedThroughDay ?? day.dayNumber}, ${fmt(milestoneGap)} short of ${fmt(nextMilestone)}.`
        : `Worldwide gross on the desk is ${fmt(film.worldwide)} through Day ${film.trackedThroughDay ?? day.dayNumber}.`,
      !(day.overseas > 0)
        ? "This day's overseas figure is not on the row, so domestic nett and worldwide gross stay in separate columns."
        : "",
    ]
      .filter(Boolean)
      .join(" "),
  ].filter(Boolean);

  const citations: Citation[] = [];
  const seen = new Set<string>();
  for (const hit of news) {
    if (seen.has(hit.url)) continue;
    seen.add(hit.url);
    citations.push({
      url: hit.url,
      title: hit.title || hit.source,
      note: hit.status === "unchecked" ? hit.detail ?? "unchecked" : undefined,
    });
    if (citations.length >= 10) break;
  }

  return {
    kind: "desk-edition",
    slot,
    briefDate: today,
    generatedAt: new Date().toISOString(),
    headline,
    lede,
    body: sections.join("\n\n"),
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
  const seen = new Set<string>();
  for (const edition of ordered) {
    for (const citation of edition.citations) {
      if (seen.has(citation.url)) continue;
      seen.add(citation.url);
      citations.push(citation);
    }
  }
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
  writeFileSync(briefPath, `${JSON.stringify(bundle, null, 2)}\n`);
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
