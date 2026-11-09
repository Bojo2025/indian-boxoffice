/**
 * Static SEO site generator for the GitHub Pages desk.
 * Builds indexable movie pages, rankings/language hubs, methodology,
 * morning-brief archives, sitemap, RSS feed, homepage prerender, and IndexNow ping.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import {
  ramayanaFeatureHtml,
  ramayanaJsonLd,
  renderRamayanaHubBody,
} from "./render-ramayana-hub.mts";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "docs");
const SITE = "https://indian-boxoffice.com";
const ASSET_VER = "20261109c";
const ADSENSE_CLIENT = "ca-pub-3635078997966836";
const ADSENSE_SCRIPT = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>`;
const DESK_EMAIL = "desk@indian-boxoffice.com";
const PUBLISHER_NAME = "Kevin Boyjonauth";
const GITHUB_REPO = "https://github.com/Bojo2025/indian-boxoffice";

type DayWise = {
  reportDate: string;
  dayNumber: number;
  indiaNet: number;
  indiaGross: number;
  overseas: number;
  worldwide: number;
  netChangePct: number | null;
  disagreementPct: number | null;
  screens: number | null;
  occupancy: number | null;
};

type Film = {
  id: string;
  slug: string;
  title: string;
  language: string;
  industry: string;
  director: string;
  starring: string;
  releaseDate: string;
  budgetCr: number | null;
  synopsis: string;
  rating: number | null;
  status: string;
  verdict: string;
  posterKey: string;
  poster: string;
  indiaNet: number;
  indiaGross: number;
  overseas: number;
  worldwide: number;
  lastDayNet: number | null;
  trackedThroughDay: number | null;
  dayWise?: DayWise[];
};

type MorningBrief = {
  briefDate: string;
  generatedAt: string;
  headline: string;
  lede: string;
  body: string;
  citations?: { url: string; title?: string }[];
};

type Pack = {
  generatedAt: string;
  deskDate: string;
  films: Film[];
  morningBrief?: MorningBrief | null;
  comparedTo?: string | null;
};

const LANGUAGE_PAGES = [
  { slug: "hindi-box-office", language: "Hindi", label: "Hindi / Bollywood" },
  { slug: "tamil-box-office", language: "Tamil", label: "Tamil / Kollywood" },
  { slug: "telugu-box-office", language: "Telugu", label: "Telugu / Tollywood" },
  { slug: "malayalam-box-office", language: "Malayalam", label: "Malayalam / Mollywood" },
  { slug: "kannada-box-office", language: "Kannada", label: "Kannada / Sandalwood" },
] as const;

function readJson<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCr(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-IN", {
    minimumFractionDigits: abs >= 100 ? 1 : 2,
    maximumFractionDigits: abs >= 100 ? 1 : 2,
  });
  return `₹${formatted} Cr`;
}

function formatCrCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 100) {
    return `₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`;
  }
  return `₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} Cr`;
}

function formatReleaseDate(iso: string): string {
  if (!iso) return "—";
  const date = new Date(`${iso}T12:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatRating(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? "Not available" : `${Number(value).toFixed(1)} / 10`;
}

function absolutePoster(poster: string | undefined, posterKey: string): string {
  if (poster) {
    return poster.replace(/^\.\//, "/").startsWith("http")
      ? poster
      : `${SITE}${poster.replace(/^\.\//, "/")}`;
  }
  return `${SITE}/posters/${posterKey || "hero-cinema"}.jpg`;
}

function localPoster(poster: string | undefined, posterKey: string): string {
  if (poster) return poster.replace(/^\.\//, "/");
  return `/posters/${posterKey || "hero-cinema"}.jpg`;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function computeDayMilestones(days: DayWise[]) {
  const sorted = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
  const day1 = sorted.find((d) => d.dayNumber === 1);
  const weekendDays = sorted.filter((d) => d.dayNumber >= 1 && d.dayNumber <= 3);
  const weekendNet =
    weekendDays.length >= 1 ? round2(weekendDays.reduce((sum, d) => sum + (d.indiaNet || 0), 0)) : null;
  const week1Days = sorted.filter((d) => d.dayNumber >= 1 && d.dayNumber <= 7);
  const week1Net =
    week1Days.length >= 1 ? round2(week1Days.reduce((sum, d) => sum + (d.indiaNet || 0), 0)) : null;
  const highestDay = sorted.length
    ? sorted.reduce((max, d) => ((d.indiaNet || 0) > (max.indiaNet || 0) ? d : max), sorted[0])
    : null;
  const latestDay = sorted.length ? sorted[sorted.length - 1] : null;

  return { day1, weekendNet, week1Net, highestDay, latestDay };
}

function peopleList(value: string): { "@type": "Person"; name: string }[] {
  return String(value || "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name && name !== "—")
    .slice(0, 8)
    .map((name) => ({ "@type": "Person" as const, name }));
}

function dayNumber(releaseDate: string, deskDate: string): number {
  const a = Date.parse(`${releaseDate}T12:00:00+05:30`);
  const b = Date.parse(`${deskDate}T12:00:00+05:30`);
  return Math.max(1, Math.floor((b - a) / 86400000) + 1);
}

function ensureDir(path: string) {
  mkdirSync(path, { recursive: true });
}

function writePage(relPath: string, html: string) {
  const full = join(outDir, relPath);
  ensureDir(dirname(full));
  writeFileSync(full, html);
}

function shell(opts: {
  title: string;
  description: string;
  canonical: string;
  ogType?: string;
  ogImage?: string;
  ogImageAlt?: string;
  keywords?: string;
  jsonLd?: unknown[];
  body: string;
  breadcrumbs?: { name: string; url: string }[];
}): string {
  const ogType = opts.ogType ?? "website";
  const ogImage = opts.ogImage ?? `${SITE}/posters/hero-cinema.jpg`;
  const crumbs = opts.breadcrumbs ?? [];
  const crumbLd =
    crumbs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: crumbs.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.name,
            item: c.url,
          })),
        }
      : null;
  const allLd = [...(opts.jsonLd ?? []), ...(crumbLd ? [crumbLd] : [])];
  const crumbNav =
    crumbs.length > 0
      ? `<nav class="crumbs" aria-label="Breadcrumb"><ol>${crumbs
          .map((c, i) => {
            const last = i === crumbs.length - 1;
            return last
              ? `<li aria-current="page">${esc(c.name)}</li>`
              : `<li><a href="${esc(c.url)}">${esc(c.name)}</a></li>`;
          })
          .join("")}</ol></nav>`
      : "";

  return `<!DOCTYPE html>
<html lang="en-IN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(opts.title)}</title>
  <meta name="description" content="${esc(opts.description)}" />
  ${opts.keywords ? `<meta name="keywords" content="${esc(opts.keywords)}" />` : ""}
  <meta name="author" content="Kevin Boyjonauth" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <meta name="theme-color" content="#0f0d0b" />
  <link rel="canonical" href="${esc(opts.canonical)}" />
  <link rel="alternate" type="application/rss+xml" title="Indian Box Office Feed" href="${SITE}/feed.xml" />

  <meta property="og:type" content="${esc(ogType)}" />
  <meta property="og:site_name" content="Indian Box Office" />
  <meta property="og:locale" content="en_IN" />
  <meta property="og:url" content="${esc(opts.canonical)}" />
  <meta property="og:title" content="${esc(opts.title)}" />
  <meta property="og:description" content="${esc(opts.description)}" />
  <meta property="og:image" content="${esc(ogImage)}" />
  <meta property="og:image:width" content="600" />
  <meta property="og:image:height" content="900" />
  ${opts.ogImageAlt ? `<meta property="og:image:alt" content="${esc(opts.ogImageAlt)}" />` : ""}

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(opts.title)}" />
  <meta name="twitter:description" content="${esc(opts.description)}" />
  <meta name="twitter:image" content="${esc(ogImage)}" />

  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/styles.css?v=${ASSET_VER}" />
  ${ADSENSE_SCRIPT}
  ${allLd.map((ld) => `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`).join("\n  ")}
</head>
<body>
  <header class="mast">
    <a class="brand" href="/">
      <span class="mark">IBO</span>
      <span>
        <strong>Indian Box Office</strong>
        <span>Consensus desk</span>
      </span>
      <small class="credit">Developed by Mr Kevin Boyjonauth</small>
    </a>
    <nav>
      <a href="/ramayana/">Ramayana</a>
      <a href="/daily-box-office/">Daily chart</a>
      <a href="/brief/">Morning brief</a>
      <a href="/briefs/">Brief archive</a>
      <a href="/rankings/2026/">2026 rankings</a>
      <a href="/about/">About</a>
      <a href="/contact/">Contact</a>
    </nav>
  </header>
  <main>
    ${crumbNav}
    ${opts.body}
  </main>
  <footer>
    <div class="wrap">
      Independent consensus of published theatrical estimates. India has no official auditor — we publish the spread.
      Figures in ₹ crore. India nett / worldwide gross.
      · <a href="/ramayana/">Ramayana</a>
      · <a href="/daily-box-office/">Daily chart</a>
      · <a href="/brief/">Morning brief</a>
      · <a href="/briefs/">Brief archive</a>
      · <a href="/rankings/2026/">2026 rankings</a>
      · <a href="/about/">About</a>
      · <a href="/about-methodology/">Methodology</a>
      · <a href="/editorial-policy/">Editorial policy</a>
      · <a href="/contact/">Contact</a>
      · <a href="/privacy-policy/">Privacy policy</a>
      · <a href="/feed.xml">RSS</a>
    </div>
  </footer>
</body>
</html>
`;
}

function movieUrl(slug: string): string {
  return `${SITE}/movies/${slug}/`;
}

function isAutoSynopsis(synopsis: string | undefined): boolean {
  const s = (synopsis || "").trim();
  if (!s) return true;
  return /automatically discovered/i.test(s) || s.length < 80;
}

function filmReadableSynopsis(film: Film): string {
  if (!isAutoSynopsis(film.synopsis)) return film.synopsis;
  const lang = film.language && film.language !== "Indian" ? film.language : film.industry || "Indian";
  const days = film.dayWise?.length ?? film.trackedThroughDay ?? 0;
  const dayBit =
    days > 0
      ? ` This page tracks ${days} reported theatrical day${days === 1 ? "" : "s"} with India nett and worldwide totals.`
      : " Day-wise figures are added as soon as the desk receives a usable daily report.";
  return `${film.title} is a ${lang} theatrical release (${formatReleaseDate(film.releaseDate)}) covered by the Indian Box Office consensus desk.${dayBit} Figures below are desk consensus estimates, not an official audit.`;
}

/** Original editorial narrative built from this film's own day-wise board — unique per title. */
function filmRunAnalysisHtml(film: Film, deskDate: string): string {
  const days = [...(film.dayWise ?? [])].sort((a, b) => a.dayNumber - b.dayNumber);
  const milestones = computeDayMilestones(days);
  const day1 = milestones.day1;
  const last = days.length ? days[days.length - 1] : null;
  const prior = days.length > 1 ? days[days.length - 2] : null;
  const paragraphs: string[] = [];

  paragraphs.push(
    `This desk follows ${esc(film.title)} day by day from first reported theatrical day through the current run. ` +
      `As of ${esc(deskDate)} (IST), consensus India nett stands at ${esc(formatCr(film.indiaNet))} with worldwide gross at ${esc(formatCr(film.worldwide))}. ` +
      `The film is listed as ${esc(film.status)} with a working box office verdict of ${esc(film.verdict)}.`,
  );

  if (day1) {
    paragraphs.push(
      `Opening day (Day 1, ${esc(formatReleaseDate(day1.reportDate))}) came in at ${esc(formatCr(day1.indiaNet))} India nett` +
        `${day1.occupancy != null ? ` with reported occupancy around ${esc(String(Math.round(day1.occupancy)))}%` : ""}. ` +
        (milestones.weekendNet != null
          ? `Opening weekend (Days 1–3) totals about ${esc(formatCr(milestones.weekendNet))} India nett on this board. `
          : "") +
        (milestones.week1Net != null && days.length >= 7
          ? `Week 1 (Days 1–7) is tracked at roughly ${esc(formatCr(milestones.week1Net))} India nett.`
          : days.length < 7
            ? `The first week is still building; only ${days.length} day${days.length === 1 ? "" : "s"} are on the ledger so far.`
            : ""),
    );
  } else {
    paragraphs.push(
      `A full Day 1 row is not yet on the board for ${esc(film.title)}. ` +
        `When opening-day India nett lands, this page will show the Day 1 figure beside later daily movement so readers can judge the run without waiting for a lifetime-only total.`,
    );
  }

  if (last && days.length >= 2) {
    const change =
      last.netChangePct != null
        ? ` that is a ${esc(String(Math.round(last.netChangePct)))}% move versus the previous reported day`
        : prior
          ? ` compared with ${esc(formatCr(prior.indiaNet))} on Day ${prior.dayNumber}`
          : "";
    paragraphs.push(
      `The latest reported day is Day ${last.dayNumber} (${esc(formatReleaseDate(last.reportDate))}) at ${esc(formatCr(last.indiaNet))} India nett${change}. ` +
        `Readers should treat single-day swings carefully: weekday vs weekend mix, screen count, and holiday calendars all move the curve.`,
    );
  } else if (last) {
    paragraphs.push(
      `Only Day ${last.dayNumber} is on the ledger so far (${esc(formatCr(last.indiaNet))} India nett). ` +
        `Early figures are the most volatile part of any theatrical run; this page will extend the day-wise table as later days clear.`,
    );
  }

  const overseas =
    film.worldwide != null && film.indiaGross != null
      ? Math.max(0, film.worldwide - film.indiaGross)
      : film.overseas;
  if (film.worldwide > 0 && film.indiaNet > 0) {
    const share =
      film.worldwide > 0 ? Math.round((film.indiaNet / film.worldwide) * 1000) / 10 : null;
    paragraphs.push(
      `Domestic vs global: India nett ${esc(formatCr(film.indiaNet))} sits against worldwide gross ${esc(formatCr(film.worldwide))}` +
        `${overseas != null && overseas > 0 ? `, with overseas gross near ${esc(formatCr(overseas))}` : ""}.` +
        (share != null
          ? ` India nett is about ${share}% of the worldwide gross figure on this desk (nett and gross are different bases, so treat the ratio as orientation, not a precise share of tickets).`
          : ""),
    );
  }

  if (film.budgetCr != null && film.budgetCr > 0) {
    const multiple = film.indiaNet / film.budgetCr;
    paragraphs.push(
      `Against the published budget estimate of ${esc(formatCr(film.budgetCr))}, current India nett is roughly ${multiple.toFixed(2)}× budget on this board. ` +
        `Verdict labels (${esc(film.verdict)}) are desk working labels from that relationship and the shape of the run — they are not studio marketing claims.`,
    );
  } else {
    paragraphs.push(
      `${esc(film.title)} does not yet carry a reliable public budget on this desk, so hit/flop language stays provisional. ` +
        `We still publish day-wise India nett so readers can watch the theatrical curve independently of marketing narratives.`,
    );
  }

  const lang = film.language && film.language !== "Indian" ? film.language : null;
  paragraphs.push(
    `${lang ? `As a ${esc(lang)} release` : "As a multi-industry theatrical title"}, ${esc(film.title)} is filed under ${esc(film.industry || "Indian cinema")} on the language hubs and daily chart. ` +
      `Director credit on file: ${esc(film.director || "—")}. Cast listed: ${esc(film.starring || "—")}. ` +
      `All money figures are consensus estimates in ₹ crore and will move when later daily reports land.`,
  );

  return `
      <section class="seo-prose film-analysis" id="analysis">
        <h2>${esc(film.title)} box office analysis</h2>
        ${paragraphs.map((p) => `<p>${p}</p>`).join("\n        ")}
      </section>`;
}

function rankingsRows(films: Film[]): string {
  return films
    .map(
      (m, i) => `<tr class="${m.status === "playing" ? "live" : ""}">
        <td class="rank">${i + 1}</td>
        <td class="title-cell">
          <a href="/movies/${esc(m.slug)}/" aria-label="Open details for ${esc(m.title)}">
            <img class="poster-thumb" src="${esc(localPoster(m.poster, m.posterKey))}" alt="${esc(m.title)} box office poster" loading="lazy" />
            <span>${esc(m.title)}${m.status === "playing" ? '<span class="pill">Playing</span>' : ""}</span>
          </a>
        </td>
        <td>${esc(m.language)}</td>
        <td>${esc(formatReleaseDate(m.releaseDate))}</td>
        <td class="num">${esc(formatCr(m.indiaNet))}</td>
        <td class="num strong">${esc(formatCr(m.worldwide))}</td>
      </tr>`,
    )
    .join("\n");
}

function dayWiseTable(film: Film): string {
  const days = [...(film.dayWise ?? [])].sort((a, b) => a.dayNumber - b.dayNumber);
  if (!days.length) {
    return `<div class="film-detail-days">
      <h2>${esc(film.title)} Day by Day Box Office Collection</h2>
      <p class="film-detail-empty">Day-wise collection figures are not yet available for this title.</p>
    </div>`;
  }
  const milestones = computeDayMilestones(days);
  const milestoneHtml = `
    <div class="day-milestones">
      <div class="milestone-card">
        <span class="m-label">Opening Day (Day 1)</span>
        <strong class="m-val">${esc(formatCr(milestones.day1?.indiaNet))}</strong>
        <span class="m-sub">India nett</span>
      </div>
      <div class="milestone-card">
        <span class="m-label">Opening Weekend</span>
        <strong class="m-val">${esc(formatCr(milestones.weekendNet))}</strong>
        <span class="m-sub">Days 1–3 nett</span>
      </div>
      <div class="milestone-card">
        <span class="m-label">Week 1 Total</span>
        <strong class="m-val">${esc(formatCr(milestones.week1Net))}</strong>
        <span class="m-sub">Days 1–7 nett</span>
      </div>
      <div class="milestone-card">
        <span class="m-label">Highest Single Day</span>
        <strong class="m-val">${esc(formatCr(milestones.highestDay?.indiaNet))}</strong>
        <span class="m-sub">${milestones.highestDay ? `Day ${milestones.highestDay.dayNumber}` : "—"}</span>
      </div>
    </div>
  `;

  return `<div class="film-detail-days">
    <h2>${esc(film.title)} Day by Day Box Office Collection (All Days)</h2>
    <p>Complete theatrical day-wise breakdown in Indian cinemas — domestic nett, worldwide gross, occupancy, and daily change.</p>
    ${milestoneHtml}
    <div style="overflow-x:auto">
      <table>
        <thead>
          <tr>
            <th>Day</th>
            <th>Date</th>
            <th class="num">India nett</th>
            <th class="num">Worldwide</th>
            <th class="num">Occupancy</th>
            <th class="num">Change</th>
          </tr>
        </thead>
        <tbody>
          ${days
            .map((d) => {
              const dayLabel = d.dayNumber === 1 ? "Day 1 (Opening)" : `Day ${d.dayNumber}`;
              const change =
                d.netChangePct == null
                  ? "—"
                  : `${d.netChangePct >= 0 ? "+" : ""}${d.netChangePct.toFixed(1)}%`;
              const occ = d.occupancy == null ? "—" : `${d.occupancy.toFixed(0)}%`;
              return `<tr class="${d.dayNumber === 1 ? "day-one" : ""}">
                <td><strong>${esc(dayLabel)}</strong></td>
                <td>${esc(formatReleaseDate(d.reportDate))}</td>
                <td class="num">${esc(formatCr(d.indiaNet))}</td>
                <td class="num">${esc(formatCr(d.worldwide))}</td>
                <td class="num">${esc(occ)}</td>
                <td class="num">${esc(change)}</td>
              </tr>`;
            })
            .join("\n")}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderMoviePage(film: Film, deskDate: string): string {
  const url = movieUrl(film.slug);
  const posterAbs = absolutePoster(film.poster, film.posterKey);
  const posterLocal = localPoster(film.poster, film.posterKey);
  const days = [...(film.dayWise ?? [])].sort((a, b) => a.dayNumber - b.dayNumber);
  const milestones = computeDayMilestones(days);
  const day1 = milestones.day1;
  const synopsis = filmReadableSynopsis(film);
  const budgetText =
    film.budgetCr == null
      ? `${film.title} does not yet have a published budget estimate on this desk, so any hit/flop label remains provisional until cost and longer-run nett are clearer.`
      : `${film.title} had an estimated budget of ${formatCr(film.budgetCr)} and has collected ${formatCr(film.indiaNet)} India nett (${formatCr(film.worldwide)} worldwide), earning a working box office verdict of ${film.verdict} on this desk.`;
  const verdictHeading = `${film.title} Box Office Verdict: Hit or Flop?`;
  const desc = `Day-by-day box office collection and editorial analysis for ${film.title}: Day 1 opening, daily India nett, worldwide gross, weekend totals, and consensus verdict from the Indian Box Office desk.`;

  const movieLd = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: film.title,
    url,
    image: posterAbs,
    datePublished: film.releaseDate,
    inLanguage: film.language,
    description: synopsis || desc,
    director: peopleList(film.director),
    actor: peopleList(film.starring),
    countryOfOrigin: { "@type": "Country", name: "India" },
    aggregateRating:
      film.rating != null
        ? {
            "@type": "AggregateRating",
            ratingValue: film.rating,
            bestRating: 10,
            worstRating: 1,
          }
        : undefined,
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `What is the day wise box office collection of ${film.title}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${film.title} has collected ${formatCr(film.indiaNet)} India nett and ${formatCr(film.worldwide)} worldwide gross across ${days.length || "multiple"} reported theatrical days. Refer to our day-by-day table for individual daily figures.`,
        },
      },
      {
        "@type": "Question",
        name: `What was the opening day (Day 1) collection of ${film.title}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: day1
            ? `${film.title} collected ${formatCr(day1.indiaNet)} India nett on Day 1 (opening day).`
            : `Opening day (Day 1) India nett for ${film.title} is not yet available on this desk.`,
        },
      },
      {
        "@type": "Question",
        name: `What was the opening weekend (Days 1–3) collection of ${film.title}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: milestones.weekendNet != null
            ? `${film.title} collected an estimated ${formatCr(milestones.weekendNet)} India nett across its opening weekend (Days 1–3).`
            : `Opening weekend collection for ${film.title} is being compiled.`,
        },
      },
      {
        "@type": "Question",
        name: `What is the total worldwide collection of ${film.title}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `The latest consensus worldwide gross for ${film.title} is ${formatCr(film.worldwide)}. India nett stands at ${formatCr(film.indiaNet)}.`,
        },
      },
      {
        "@type": "Question",
        name: `Is ${film.title} a hit or a flop?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${film.title} currently carries a box office verdict of ${film.verdict}. ${budgetText}`,
        },
      },
    ],
  };

  const body = `
    <article class="seo-film">
      <p class="kicker">${esc(film.language)} · ${esc(film.industry)} · ${esc(film.status)}</p>
      <div class="film-detail-hero">
        <img class="film-detail-poster" src="${esc(posterLocal)}" alt="${esc(film.title)} poster" width="220" height="320" />
        <div>
          <h1>${esc(film.title)}</h1>
          <p class="film-day-tagline">Day-by-Day Theatrical Box Office Collection</p>
          <p class="film-detail-meta">${esc(film.director)} · Released ${esc(formatReleaseDate(film.releaseDate))}</p>
          <p class="film-detail-cast"><strong>Cast</strong><br />${esc(film.starring)}</p>
          <p class="film-detail-description">${esc(synopsis)}</p>
        </div>
      </div>
      <dl class="film-detail-stats">
        <div><dt>India net</dt><dd>${esc(formatCr(film.indiaNet))}</dd></div>
        <div><dt>Worldwide</dt><dd>${esc(formatCr(film.worldwide))}</dd></div>
        <div><dt>Latest day</dt><dd>${esc(formatCr(film.lastDayNet))}</dd></div>
        <div><dt>Film rating</dt><dd>${esc(formatRating(film.rating))}</dd></div>
        <div><dt>Box office verdict</dt><dd>${esc(film.verdict)}</dd></div>
        <div><dt>Budget</dt><dd>${film.budgetCr == null ? "—" : esc(formatCr(film.budgetCr))}</dd></div>
      </dl>

      ${filmRunAnalysisHtml(film, deskDate)}

      ${dayWiseTable(film)}

      <section class="seo-verdict seo-prose" id="verdict">
        <h2>${esc(verdictHeading)}</h2>
        <p>${esc(budgetText)}</p>
        <p>India has no official theatrical auditor. The numbers on this page are a weighted-median consensus built by Indian Box Office, not a studio press release. Compare Day 1, weekend, and later weekdays in the table above before treating any single headline figure as final.</p>
        <p>Updated on the Indian Box Office consensus desk for ${esc(deskDate)} (IST). Corrections: <a href="/editorial-policy/">editorial policy</a> · <a href="/contact/">contact the desk</a>.</p>
      </section>

      <section class="faq-list seo-faq" id="faq">
        <h2>${esc(film.title)} box office FAQ</h2>
        <details open>
          <summary>What is the day-by-day box office collection of ${esc(film.title)}?</summary>
          <p>${esc(film.title)} has reported ${days.length} theatrical days on this desk, with total domestic India nett of ${esc(formatCr(film.indiaNet))} and global worldwide gross of ${esc(formatCr(film.worldwide))}. Refer to the table above for Day 1, Day 2, and daily percentage movement.</p>
        </details>
        <details open>
          <summary>What was the opening day (Day 1) collection of ${esc(film.title)}?</summary>
          <p>${day1 ? `${esc(film.title)} collected ${esc(formatCr(day1.indiaNet))} India nett on Day 1 (opening day).` : `Opening day (Day 1) India nett for ${esc(film.title)} is not yet available on this desk.`}</p>
        </details>
        <details>
          <summary>What was the opening weekend (Days 1–3) collection of ${esc(film.title)}?</summary>
          <p>${milestones.weekendNet != null ? `${esc(film.title)} collected ${esc(formatCr(milestones.weekendNet))} India nett over its opening weekend (Days 1–3).` : `Opening weekend collection is being compiled.`}</p>
        </details>
        <details>
          <summary>What is the total worldwide collection of ${esc(film.title)}?</summary>
          <p>The latest consensus worldwide gross for ${esc(film.title)} is ${esc(formatCr(film.worldwide))}. India nett stands at ${esc(formatCr(film.indiaNet))}.</p>
        </details>
        <details>
          <summary>Is ${esc(film.title)} a hit or a flop?</summary>
          <p>${esc(film.title)} currently carries a box office verdict of ${esc(film.verdict)}. ${esc(budgetText)}</p>
        </details>
      </section>

      ${
        /ramayana/i.test(film.id) || /ramayana/i.test(film.title)
          ? `<p class="seo-back"><a href="/ramayana/"><strong>Open Ramayana main page →</strong></a></p>`
          : ""
      }
      <p class="seo-back"><a href="/daily-box-office/">← Daily box office chart</a> · <a href="/records/highest-day-1-collection-2026/">Day 1 records</a> · <a href="/rankings/2026/">2026 rankings</a> · <a href="/">Home</a></p>
    </article>
  `;

  return shell({
    title: `${film.title} Day Wise Box Office Collection: Day by Day India Nett & Worldwide | Indian Box Office`,
    description: desc,
    canonical: url,
    ogType: "video.movie",
    ogImage: posterAbs,
    breadcrumbs: [
      { name: "Home", url: `${SITE}/` },
      { name: "Daily Box Office", url: `${SITE}/daily-box-office/` },
      { name: film.title, url },
    ],
    jsonLd: [movieLd, faqLd],
    body,
  });
}

function renderDailyBoxOfficePage(films: Film[], deskDate: string): string {
  const momentumRanked = [...films]
    .filter((m) => (m.status === "playing" || m.status === "late") && (m.lastDayNet || 0) > 0)
    .sort((a, b) => (b.lastDayNet || 0) - (a.lastDayNet || 0));
  const otherPlaying = films
    .filter((m) => m.status === "playing" && !momentumRanked.some((x) => x.id === m.id))
    .sort((a, b) => (b.indiaNet || 0) - (a.indiaNet || 0));
  const dailyList = [...momentumRanked, ...otherPlaying];

  const url = `${SITE}/daily-box-office/`;
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Daily Indian box office collection: day-wise theatrical chart",
    description: "Daily box office collection for films now running in Indian cinemas, ranked by latest reported single-day India nett.",
    numberOfItems: dailyList.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: dailyList.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: movieUrl(m.slug),
      name: m.title,
    })),
  };

  const rows = dailyList
    .map((m, i) => {
      const day = dayNumber(m.releaseDate, deskDate);
      const days = m.dayWise ?? [];
      const latestDayRow = days.length ? days[days.length - 1] : null;
      const change =
        latestDayRow?.netChangePct == null
          ? "—"
          : `${latestDayRow.netChangePct >= 0 ? "+" : ""}${latestDayRow.netChangePct.toFixed(1)}%`;
      return `<tr class="${m.status === "playing" ? "live" : ""}">
        <td class="rank">${i + 1}</td>
        <td class="title-cell">
          <a href="/movies/${esc(m.slug)}/" aria-label="Open details for ${esc(m.title)}">
            <img class="poster-thumb" src="${esc(localPoster(m.poster, m.posterKey))}" alt="${esc(m.title)} box office poster" loading="lazy" />
            <span>${esc(m.title)}${m.status === "playing" ? '<span class="pill">Playing</span>' : ""}</span>
          </a>
        </td>
        <td>${esc(m.language)}</td>
        <td><strong>Day ${day}</strong></td>
        <td class="num strong">${esc(formatCr(m.lastDayNet))}</td>
        <td class="num">${esc(change)}</td>
        <td class="num">${esc(formatCr(m.indiaNet))}</td>
        <td class="num">${esc(formatCr(m.worldwide))}</td>
      </tr>`;
    })
    .join("\n");

  const body = `
    <p class="kicker">Day-by-Day Tracking</p>
    <h1>Daily Indian Box Office Collection Today</h1>
    <p class="page-sub">Theatrical momentum ranked by latest reported single-day India nett collection, showing active day numbers (Day 1, Day 2, etc.) and day-over-day movement across Hindi, Tamil, Telugu, Malayalam and Kannada cinema. Updated ${esc(deskDate)} (IST).</p>

    <div style="overflow-x:auto;margin-top:24px">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Title</th>
            <th>Language</th>
            <th>Current day</th>
            <th class="num">Latest day nett</th>
            <th class="num">Daily change</th>
            <th class="num">India nett</th>
            <th class="num">Worldwide</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>

    <section class="seo-prose" style="margin-top:36px">
      <h2>Why day-by-day box office tracking matters</h2>
      <p>Unlike cumulative lifetime grosses that reward long runs, day-wise tracking captures theatrical momentum as it happens. Tracking Day 1 opening strength, Friday-to-Saturday jump percentages, Monday holds, and second-weekend drops reveals the actual theatrical health and word-of-mouth of every release.</p>
      <p>Indian Box Office publishes weighted-median consensus numbers across trade trackers for every reported day. Click any film above to view its complete Day 1 to closing run breakdown.</p>
    </section>

    <p class="seo-back" style="margin-top:28px"><a href="/records/highest-day-1-collection-2026/">← Day 1 records</a> · <a href="/rankings/2026/">2026 rankings</a> · <a href="/">Home</a></p>
  `;

  return shell({
    title: "Daily Indian Box Office Collection: Day-Wise Domestic Nett Today | Indian Box Office",
    description: "Daily Indian box office collection for films currently running in theatres. Day-wise India nett, active release day numbers (Day 1, Day 2), and day-over-day change percentages.",
    canonical: url,
    breadcrumbs: [
      { name: "Home", url: `${SITE}/` },
      { name: "Daily Box Office", url },
    ],
    jsonLd: [itemList],
    body,
  });
}

function renderDay1RecordsPage(films: Film[], deskDate: string): string {
  const withDay1 = films
    .map((m) => {
      const d1 = (m.dayWise ?? []).find((d) => d.dayNumber === 1);
      return {
        ...m,
        day1Net: d1?.indiaNet ?? null,
        day1Ww: d1?.worldwide ?? null,
      };
    })
    .filter((m) => m.day1Net != null && m.day1Net > 0)
    .sort((a, b) => (b.day1Net || 0) - (a.day1Net || 0));

  const url = `${SITE}/records/highest-day-1-collection-2026/`;
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Highest Day 1 box office collection 2026 (Indian films)",
    description: "Indian theatrical releases of 2026 ranked by Day 1 (opening day) India nett collection.",
    numberOfItems: withDay1.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: withDay1.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: movieUrl(m.slug),
      name: m.title,
    })),
  };

  const rows = withDay1
    .map(
      (m, i) => `<tr>
        <td class="rank">${i + 1}</td>
        <td class="title-cell">
          <a href="/movies/${esc(m.slug)}/" aria-label="Open details for ${esc(m.title)}">
            <img class="poster-thumb" src="${esc(localPoster(m.poster, m.posterKey))}" alt="${esc(m.title)} box office poster" loading="lazy" />
            <span>${esc(m.title)}</span>
          </a>
        </td>
        <td>${esc(m.language)}</td>
        <td>${esc(formatReleaseDate(m.releaseDate))}</td>
        <td class="num strong">${esc(formatCr(m.day1Net))}</td>
        <td class="num">${esc(formatCr(m.day1Ww))}</td>
        <td class="num">${esc(formatCr(m.indiaNet))}</td>
        <td class="num">${esc(formatCr(m.worldwide))}</td>
      </tr>`,
    )
    .join("\n");

  const body = `
    <p class="kicker">Opening Day Records</p>
    <h1>Highest Day 1 Box Office Collections of 2026</h1>
    <p class="page-sub">All 2026 Indian theatrical releases ranked by Day 1 (opening day) India nett collection across Hindi, Telugu, Tamil, Malayalam and Kannada cinema. Updated ${esc(deskDate)} (IST).</p>

    <div style="overflow-x:auto;margin-top:24px">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Title</th>
            <th>Language</th>
            <th>Release date</th>
            <th class="num">Day 1 India nett</th>
            <th class="num">Day 1 WW gross</th>
            <th class="num">Lifetime nett</th>
            <th class="num">Lifetime WW</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>

    <section class="seo-prose" style="margin-top:36px">
      <h2>Understanding Day 1 (opening day) collections</h2>
      <p>Opening day collection reflects pre-release hype, star power, screen count, and advance ticket bookings. On this desk, Day 1 figures represent verified consensus India nett (post-tax domestic revenue) reported on the film's first official day in cinemas.</p>
    </section>

    <p class="seo-back" style="margin-top:28px"><a href="/daily-box-office/">← Daily box office chart</a> · <a href="/rankings/2026/">2026 rankings</a> · <a href="/">Home</a></p>
  `;

  return shell({
    title: "Highest Day 1 Box Office Collection 2026 (Opening Day Records) | Indian Box Office",
    description: "Highest opening day (Day 1) Indian box office collections of 2026 ranked by domestic India nett. Compare Bollywood, Tollywood, Kollywood, and Mollywood openers.",
    canonical: url,
    breadcrumbs: [
      { name: "Home", url: `${SITE}/` },
      { name: "Day 1 Records 2026", url },
    ],
    jsonLd: [itemList],
    body,
  });
}

function renderRankingsPage(films: Film[], deskDate: string): string {
  const ranked = [...films].sort((a, b) => b.worldwide - a.worldwide);
  const url = `${SITE}/rankings/2026/`;
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Highest grossing Indian films 2026",
    description: "Indian theatrical releases of 2026 ranked by worldwide gross, with India nett collection.",
    numberOfItems: ranked.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: ranked.slice(0, 50).map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: movieUrl(m.slug),
      name: m.title,
      item: {
        "@type": "Movie",
        name: m.title,
        url: movieUrl(m.slug),
        datePublished: m.releaseDate,
        inLanguage: m.language,
      },
    })),
  };

  const body = `
    <p class="kicker">Year board</p>
    <h1>Highest grossing Indian films 2026</h1>
    <p class="page-sub">Worldwide gross rankings for Indian theatrical releases in 2026, with India nett collection and release date. Updated ${esc(deskDate)} (IST).</p>
    <div style="overflow-x:auto;margin-top:24px">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Title</th>
            <th>Language</th>
            <th>Release date</th>
            <th class="num">India net</th>
            <th class="num">Worldwide</th>
          </tr>
        </thead>
        <tbody>
          ${rankingsRows(ranked)}
        </tbody>
      </table>
    </div>
    <p class="seo-back" style="margin-top:28px"><a href="/">← Home</a> · <a href="/about-methodology/">Methodology</a></p>
  `;

  return shell({
    title: "Highest Grossing Indian Films 2026 | Box Office Rankings",
    description:
      "Highest grossing Indian films of 2026 by worldwide gross, with India nett collection, language, and theatrical release date. Updated daily.",
    canonical: url,
    breadcrumbs: [
      { name: "Home", url: `${SITE}/` },
      { name: "2026 Rankings", url },
    ],
    jsonLd: [itemList],
    body,
  });
}

function renderLanguagePage(
  meta: (typeof LANGUAGE_PAGES)[number],
  films: Film[],
  deskDate: string,
): string {
  const filtered = films
    .filter((f) => f.language.toLowerCase() === meta.language.toLowerCase())
    .sort((a, b) => b.worldwide - a.worldwide);
  const url = `${SITE}/languages/${meta.slug}/`;
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Highest grossing ${meta.label} movies 2026`,
    numberOfItems: filtered.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: filtered.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: movieUrl(m.slug),
      name: m.title,
    })),
  };

  const body = `
    <p class="kicker">${esc(meta.label)}</p>
    <h1>Highest grossing ${esc(meta.language)} movies 2026</h1>
    <p class="page-sub">${esc(meta.language)} theatrical box office collections — India nett and worldwide gross — updated ${esc(deskDate)} (IST).</p>
    <section class="seo-prose">
      <p>This hub isolates ${esc(meta.label)} titles on the Indian Box Office consensus board so readers can compare circuit peers without mixing every national release into one unsorted list. Rankings use cumulative India nett and worldwide gross from the same day-wise desk that powers individual film pages.</p>
      <p>${
        filtered.length
          ? `Right now ${filtered.length} ${esc(meta.language)} title${filtered.length === 1 ? "" : "s"} ${filtered.length === 1 ? "is" : "are"} on the board. Open any film for Day 1, daily India nett, and editorial run analysis.`
          : `No ${esc(meta.language)} titles are on the board yet; the hub will fill as soon as the desk ingests a qualifying theatrical report.`
      }</p>
    </section>
    ${
      filtered.length
        ? `<div style="overflow-x:auto;margin-top:24px">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Title</th>
            <th>Language</th>
            <th>Release date</th>
            <th class="num">India net</th>
            <th class="num">Worldwide</th>
          </tr>
        </thead>
        <tbody>${rankingsRows(filtered)}</tbody>
      </table>
    </div>`
        : `<p class="meta" style="margin-top:24px">No ${esc(meta.language)} titles are on the board yet.</p>`
    }
    <p class="seo-back" style="margin-top:28px"><a href="/rankings/2026/">← 2026 rankings</a> · <a href="/about-methodology/">Methodology</a> · <a href="/">Home</a></p>
  `;

  return shell({
    title: `${meta.language} Box Office Collection 2026 | Highest Grossing ${meta.language} Films`,
    description: `Highest grossing ${meta.language} movies of 2026 with day-by-day India nett context, worldwide gross, and ${meta.label} box office rankings from Indian Box Office.`,
    canonical: url,
    breadcrumbs: [
      { name: "Home", url: `${SITE}/` },
      { name: `${meta.language} Box Office`, url },
    ],
    jsonLd: [itemList],
    body,
  });
}

function renderRamayanaPage(pack: Pack): string | null {
  const body = renderRamayanaHubBody(pack);
  if (!body) return null;
  const url = `${SITE}/ramayana/`;
  const ram = pack.films.find(
    (f) => f.id === "ramayana" || /ramayana/i.test(f.title) || /ramayana/i.test(f.slug),
  );
  const posterAbs = ram
    ? absolutePoster(ram.poster, ram.posterKey || ram.id)
    : `${SITE}/posters/ramayana.jpg`;
  const day = ram?.trackedThroughDay ?? "—";
  const title = `Ramayana Box Office Collection Today (Day ${day}) | India Nett, Worldwide & Day-wise Tracker`;
  const description = `Ramayana box office collection today and day-wise: Day ${day} India nett ${ram?.lastDayNet != null ? formatCr(ram.lastDayNet) : "—"}, cumulative India nett ${ram ? formatCr(ram.indiaNet) : "—"}, overseas ${ram ? formatCr(ram.overseas) : "—"}, worldwide ${ram ? formatCr(ram.worldwide) : "—"}. Opening weekend, records and comparisons from Indian Box Office.`;
  return shell({
    title,
    description,
    keywords:
      "Ramayana box office, Ramayana box office collection, Ramayana box office collection today, Ramayana Day 1 collection, Ramayana worldwide box office, Ramayana overseas collection, Ramayana India nett, Ramayana day wise collection, Indian Box Office",
    canonical: url,
    ogType: "article",
    ogImage: posterAbs,
    ogImageAlt: "Ramayana theatrical poster — box office tracker",
    breadcrumbs: [
      { name: "Home", url: `${SITE}/` },
      { name: "Ramayana Box Office", url },
    ],
    jsonLd: ramayanaJsonLd(pack),
    body,
  });
}

function renderMethodologyPage(): string {
  const url = `${SITE}/about-methodology/`;
  const body = `
    <p class="kicker">Editorial trust</p>
    <h1>About our box office methodology</h1>
    <p class="page-sub">How Indian Box Office builds an independent, day-by-day consensus of theatrical collections across Hindi, Tamil, Telugu, Malayalam and Kannada releases — and why we refuse to treat any single headline as fact.</p>

    <section class="seo-prose">
      <h2>Why a consensus desk exists</h2>
      <p>India has no official box office auditor. Trade outlets publish estimates that can diverge on the same film, the same day, by crores. Fans and journalists still need a clear picture of Day 1 openings, weekday holds, and closing runs. Indian Box Office exists to turn those competing estimates into a transparent, repeatedly updated consensus — with the day-wise spine kept in public view.</p>
      <p>We are not a studio marketing channel. We do not invent openings to flatter a release. When sources disagree, the desk shows the consensus total and keeps refreshing as later reports arrive.</p>

      <h2>Weighted-median consensus</h2>
      <p>Every published figure on this site is an estimate. The desk therefore computes a weighted-median consensus across multiple independent trade reports rather than reprinting any single reported number as gospel.</p>
      <p>Each contributing report is weighted by historical reliability and coverage for that money field (India nett, India gross, overseas, worldwide). A weighted median dampens outliers without throwing away minority reports that may later prove correct. When the spine that supplies day-wise rows is temporarily unavailable, the board falls back carefully and surfaces desk health alerts for editors — visitor pages never blame named trackers in the brief copy.</p>

      <h2>What “day-by-day” means here</h2>
      <p>Lifetime worldwide charts alone hide the story of a theatrical run. This desk prioritises:</p>
      <ul>
        <li><strong>Day 1 (opening day)</strong> India nett as soon as a usable report exists.</li>
        <li><strong>Daily India nett</strong> through the run, with percentage change versus the previous reported day when available.</li>
        <li><strong>Weekend and Week 1 milestones</strong> derived from the same day-wise ledger.</li>
        <li><strong>Worldwide gross</strong> kept separate from India nett so readers are not forced to confuse tax bases.</li>
      </ul>
      <p>Film pages therefore carry both a day-wise table and a short editorial analysis written from that film’s own numbers — not a duplicated marketing synopsis.</p>

      <h2>Update cadence</h2>
      <p>The board refreshes multiple times through the Indian business day (scheduled ingest about every three hours). A written morning brief is published each morning with chart context, openers, and hold notes. Day-wise collection figures update as soon as new numbers clear the consensus pipeline.</p>

      <h2>Definitions</h2>
      <ul>
        <li><strong>India nett</strong> — domestic theatrical collection after entertainment tax and GST are removed.</li>
        <li><strong>India gross</strong> — domestic theatrical ticket revenue before those tax deductions.</li>
        <li><strong>Worldwide gross</strong> — total global ticket revenue before tax deductions, including overseas markets.</li>
        <li><strong>Occupancy / shows</strong> — when reported, used as context for a day’s strength; they are not substitutes for nett.</li>
      </ul>
      <p>These figures are never interchangeable. The desk always labels India nett and worldwide gross separately.</p>

      <h2>Verdicts and budgets</h2>
      <p>Hit / average / flop style labels on this site are working desk labels based on available budget estimates and the shape of the run. If budget is missing, verdicts stay provisional. Corrections follow the <a href="/editorial-policy/">editorial policy</a>.</p>

      <h2>Publisher</h2>
      <p>Indian Box Office is developed by Mr ${esc(PUBLISHER_NAME)}. Read the <a href="/about/">about page</a>, email <a href="mailto:${DESK_EMAIL}">${DESK_EMAIL}</a>, or see the public code at <a href="${GITHUB_REPO}">${GITHUB_REPO.replace("https://", "")}</a>.</p>
    </section>
  `;

  return shell({
    title: "Box Office Methodology | Indian Box Office Consensus Desk",
    description:
      "How Indian Box Office computes weighted-median consensus of day-by-day India nett and worldwide gross: definitions, update cadence, verdicts, and editorial trust notes.",
    canonical: url,
    breadcrumbs: [
      { name: "Home", url: `${SITE}/` },
      { name: "Methodology", url },
    ],
    body,
  });
}

function renderAboutPage(): string {
  const url = `${SITE}/about/`;
  const orgLd = {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    name: "Indian Box Office",
    alternateName: "IBO Desk",
    url: SITE,
    logo: `${SITE}/favicon.svg`,
    email: DESK_EMAIL,
    founder: { "@type": "Person", name: PUBLISHER_NAME, url: "https://github.com/Bojo2025" },
    description:
      "Independent day-by-day Indian theatrical box office consensus desk covering Hindi, Tamil, Telugu, Malayalam and Kannada cinema.",
    publishingPrinciples: `${SITE}/editorial-policy/`,
    privacyPolicy: `${SITE}/privacy-policy/`,
    sameAs: [GITHUB_REPO],
  };
  const body = `
    <p class="kicker">Publisher</p>
    <h1>About Indian Box Office</h1>
    <p class="page-sub">An independent consensus desk for Indian theatrical collections — built to answer “what did it do today?” with Day 1 through closing-run clarity.</p>

    <section class="seo-prose">
      <h2>What we publish</h2>
      <p>Indian Box Office (indian-boxoffice.com) publishes a live theatrical board, day-wise film pages, language hubs, 2026 rankings, Day 1 records, and a daily morning brief. The product focus is deliberate: <strong>day-by-day India nett and worldwide gross</strong>, not only lifetime leaderboards that flatten the first two weeks of a release.</p>
      <p>Coverage spans Hindi / Bollywood, Tamil / Kollywood, Telugu / Tollywood, Malayalam / Mollywood, Kannada / Sandalwood, and major Hollywood titles in Indian theatres. New releases are picked up as soon as usable daily reports exist.</p>

      <h2>Who builds it</h2>
      <p>The desk is developed by Mr ${esc(PUBLISHER_NAME)}. Editorial standards, corrections, and contact details are public so readers know who stands behind the numbers.</p>
      <ul>
        <li><strong>Methodology</strong> — <a href="/about-methodology/">how consensus is computed</a></li>
        <li><strong>Editorial policy</strong> — <a href="/editorial-policy/">corrections, sourcing posture, advertising</a></li>
        <li><strong>Contact</strong> — <a href="/contact/">${esc(DESK_EMAIL)}</a></li>
        <li><strong>Source code</strong> — <a href="${GITHUB_REPO}">public repository</a></li>
      </ul>

      <h2>What we are not</h2>
      <p>We are not an official auditor, not a studio PR desk, and not a scrapbook of unverified social-media screenshots. When the primary day-wise spine fails, we repair the ingest rather than invent rows. When AdSense or other advertising is enabled, ads are secondary to the editorial board — see the privacy and editorial pages for how that is disclosed.</p>

      <h2>How to use the site</h2>
      <p>Start with the <a href="/">home board</a> for this week’s daily chart, open a film for the full day-wise table and analysis, read the <a href="/brief/">morning brief</a> for context, and browse the <a href="/briefs/">brief archive</a> for prior mornings. Language hubs isolate industry runs when you only care about one circuit.</p>
    </section>
  `;

  return shell({
    title: "About Indian Box Office | Independent Day-by-Day Consensus Desk",
    description:
      "About Indian Box Office: who publishes the day-by-day Indian theatrical consensus desk, what we cover, and how to reach the editor.",
    canonical: url,
    breadcrumbs: [
      { name: "Home", url: `${SITE}/` },
      { name: "About", url },
    ],
    jsonLd: [orgLd],
    body,
  });
}

function renderContactPage(): string {
  const url = `${SITE}/contact/`;
  const body = `
    <p class="kicker">Desk</p>
    <h1>Contact Indian Box Office</h1>
    <p class="page-sub">Corrections, press questions, partnership notes, and privacy requests — reach the publisher directly.</p>

    <section class="seo-prose">
      <h2>Email</h2>
      <p>Write to <a href="mailto:${DESK_EMAIL}">${esc(DESK_EMAIL)}</a>. This inbox is monitored by Mr ${esc(PUBLISHER_NAME)} for the Indian Box Office desk.</p>
      <p>Please include the film title, the date of the figure you are questioning, and a link to the page on indian-boxoffice.com. Clear reports are corrected faster.</p>

      <h2>What to contact us about</h2>
      <ul>
        <li>Factual corrections to day-wise or lifetime totals on a film page</li>
        <li>Missing releases that are already reporting in theatres</li>
        <li>Privacy or advertising preference questions (see also the <a href="/privacy-policy/">privacy policy</a>)</li>
        <li>Press or citation requests for morning briefs</li>
      </ul>

      <h2>Response expectations</h2>
      <p>Theatrical numbers move through the day. We aim to acknowledge correction requests within two business days. Urgent opening-day issues are handled as soon as the next ingest cycle can verify them against independent reports.</p>

      <h2>Public repository</h2>
      <p>Technical issues with the open site build can also be filed at <a href="${GITHUB_REPO}/issues">${GITHUB_REPO.replace("https://", "")}/issues</a>.</p>
    </section>
  `;

  return shell({
    title: "Contact | Indian Box Office",
    description: `Contact the Indian Box Office desk at ${DESK_EMAIL} for corrections, press, and privacy questions.`,
    canonical: url,
    breadcrumbs: [
      { name: "Home", url: `${SITE}/` },
      { name: "Contact", url },
    ],
    body,
  });
}

function renderEditorialPolicyPage(): string {
  const url = `${SITE}/editorial-policy/`;
  const body = `
    <p class="kicker">Standards</p>
    <h1>Editorial policy &amp; corrections</h1>
    <p class="page-sub">How Indian Box Office handles sourcing posture, corrections, advertising separation, and reader trust.</p>

    <section class="seo-prose">
      <h2>Editorial mission</h2>
      <p>Publish a clear, day-by-day view of Indian theatrical collections that readers can check against the previous day — without pretending any single trade headline is an official audit.</p>

      <h2>Sourcing posture</h2>
      <p>Collection figures are estimates synthesised into a weighted-median consensus. Visitor-facing copy describes the desk’s own consensus; it does not turn the site into a mirror of one outlet’s homepage. Morning briefs are written from the verified board so every rupee claim can be traced to published desk data.</p>

      <h2>Corrections</h2>
      <p>If a day-wise row, lifetime total, or verdict label is wrong, email <a href="mailto:${DESK_EMAIL}">${esc(DESK_EMAIL)}</a> with the film, date, and expected correction. Material corrections are applied on the next successful publish after verification. We do not silently alter history without updating the live film page and, when relevant, noting the change in a later brief.</p>

      <h2>Advertising</h2>
      <p>When Google AdSense or similar advertising is active, ads are labelled by the ad network and are not editorial endorsements. Advertising partners do not decide Day 1 rankings, morning-brief headlines, or verdict labels. Cookie and personalised-ads disclosures live on the <a href="/privacy-policy/">privacy policy</a>.</p>

      <h2>Conflicts &amp; independence</h2>
      <p>The desk does not accept payment to inflate or suppress a film’s reported collection. Studio or publicist outreach is treated as correspondence, not as a substitute for the consensus pipeline.</p>

      <h2>Publisher accountability</h2>
      <p>Mr ${esc(PUBLISHER_NAME)} publishes Indian Box Office and is accountable for this policy. See <a href="/about/">About</a> and <a href="/contact/">Contact</a>.</p>
    </section>
  `;

  return shell({
    title: "Editorial Policy & Corrections | Indian Box Office",
    description:
      "Editorial policy for Indian Box Office: sourcing posture, corrections process, advertising separation, and publisher accountability.",
    canonical: url,
    breadcrumbs: [
      { name: "Home", url: `${SITE}/` },
      { name: "Editorial Policy", url },
    ],
    body,
  });
}

function renderBriefsIndexPage(briefs: MorningBrief[]): string {
  const url = `${SITE}/briefs/`;
  const items = briefs
    .map(
      (b) => `<li>
        <a href="/briefs/${esc(b.briefDate)}/">
          <strong>${esc(b.briefDate)}</strong>
          <span>${esc(b.headline)}</span>
        </a>
        <p>${esc(b.lede)}</p>
      </li>`,
    )
    .join("\n");
  const body = `
    <p class="kicker">Archive</p>
    <h1>Morning brief archive</h1>
    <p class="page-sub">Dated editorial briefs from the Indian Box Office desk — daily chart context, openers, and hold notes kept in public archive.</p>

    <section class="seo-prose">
      <p>Each morning brief is generated from that morning’s consensus board, then filed here so readers can compare how the chart moved across days. The <a href="/brief/">latest brief</a> always mirrors the newest entry.</p>
    </section>

    <ol class="brief-archive-list">
      ${items || "<li>No briefs archived yet.</li>"}
    </ol>
  `;

  return shell({
    title: "Morning Brief Archive | Indian Box Office",
    description:
      "Archive of Indian Box Office morning briefs: dated daily chart analysis for Hindi, Tamil, Telugu, Malayalam and Kannada theatrical collections.",
    canonical: url,
    breadcrumbs: [
      { name: "Home", url: `${SITE}/` },
      { name: "Morning Brief", url: `${SITE}/brief/` },
      { name: "Archive", url },
    ],
    body,
  });
}

function renderPrivacyPolicyPage(): string {
  const url = `${SITE}/privacy-policy/`;
  const body = `
    <p class="kicker">Privacy</p>
    <h1>Privacy policy</h1>
    <p class="page-sub">How Indian Box Office (indian-boxoffice.com) handles information when you visit this website. Last updated: 21 October 2026.</p>

    <section class="seo-prose">
      <h2>Who we are</h2>
      <p>Indian Box Office is an independent box office reporting website developed by Mr Kevin Boyjonauth. This page explains what information is collected when you browse the site, how advertising cookies work, and the choices available to you.</p>

      <h2>Information we collect</h2>
      <p>We do not require you to create an account, sign in, or submit personal information to read this website, and we do not operate a comment system or contact form on this site. Like most websites, our hosting provider may automatically record standard technical information in server logs, such as your IP address, browser type, device information, referring page, and the pages you visit. We use this information in aggregate to operate, secure, and improve the website.</p>

      <h2>Cookies and advertising</h2>
      <p>We use Google AdSense to display advertising on this website. Google and its partners may use cookies and similar technologies (including web beacons and IP addresses) to serve ads based on your prior visits to this website and/or other sites on the Internet, and to measure ad performance and prevent fraud.</p>
      <ul>
        <li>Third-party vendors, including Google, use cookies to serve ads based on a user's prior visits to this website or other websites.</li>
        <li>Google's use of advertising cookies enables it and its partners to serve ads to users based on their visit to this site and/or other sites on the Internet.</li>
        <li>You may opt out of personalised advertising by visiting <a href="https://www.google.com/settings/ads" rel="noopener">Google Ads Settings</a>. You can also opt out of some third-party vendors' use of cookies for personalised advertising at <a href="https://www.aboutads.info/" rel="noopener">aboutads.info</a>.</li>
        <li>For more information about how Google uses data from sites that use its services, see <a href="https://policies.google.com/technologies/partner-sites" rel="noopener">How Google uses information from sites or apps that use our services</a>.</li>
      </ul>
      <p>Where required by applicable law (including in the European Economic Area, the United Kingdom, and Switzerland), we request your consent for the use of cookies for personalised advertising through a Google-certified consent message shown on this site. You can change or withdraw your consent through that message where it is presented.</p>

      <h2>Your browser choices</h2>
      <p>Most browsers let you block or delete cookies through their settings. If you disable cookies, this website should remain readable, although advertising and some site features may work less well.</p>

      <h2>External links</h2>
      <p>This website links to external websites (for example, source publications and our public code repository). We are not responsible for the privacy practices or content of those external sites, and we encourage you to read their privacy policies.</p>

      <h2>Children</h2>
      <p>This website is a general-audience publication about film box office results and is not directed at children under 13. We do not knowingly collect personal information from children.</p>

      <h2>Changes to this policy</h2>
      <p>We may update this privacy policy from time to time. Material changes will be reflected on this page together with a revised "last updated" date.</p>

      <h2>Contact</h2>
      <p>Questions about this privacy policy: email <a href="mailto:${DESK_EMAIL}">${esc(DESK_EMAIL)}</a> or use the <a href="/contact/">contact page</a>. Technical site issues can also be raised at <a href="${GITHUB_REPO}">${GITHUB_REPO.replace("https://", "")}</a>.</p>
    </section>
  `;

  return shell({
    title: "Privacy Policy | Indian Box Office",
    description:
      "Privacy policy for Indian Box Office: cookies, Google AdSense advertising, opt-out choices, and contact information.",
    canonical: url,
    breadcrumbs: [
      { name: "Home", url: `${SITE}/` },
      { name: "Privacy Policy", url },
    ],
    body,
  });
}

function renderBriefBodyHtml(body: string): string {
  const blocks = String(body || "")
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return blocks
    .map((block) => {
      if (/^##\s+/.test(block)) {
        return `<h2>${esc(block.replace(/^##\s+/, ""))}</h2>`;
      }
      if (/^###\s+/.test(block)) {
        return `<h3>${esc(block.replace(/^###\s+/, ""))}</h3>`;
      }
      // Support simple bullet lists: lines starting with "- "
      if (/^- /.test(block) || block.includes("\n- ")) {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.every((l) => l.startsWith("- "))) {
          return `<ul>${lines.map((l) => `<li>${esc(l.slice(2))}</li>`).join("")}</ul>`;
        }
      }
      return `<p>${esc(block)}</p>`;
    })
    .join("\n");
}

function renderBriefPage(brief: MorningBrief, isLatest: boolean): string {
  const path = isLatest ? "/brief/" : `/briefs/${brief.briefDate}/`;
  const url = `${SITE}${path}`;
  const newsLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: brief.headline,
    description: brief.lede,
    datePublished: brief.generatedAt,
    dateModified: brief.generatedAt,
    mainEntityOfPage: url,
    author: {
      "@type": "Person",
      name: PUBLISHER_NAME,
      url: "https://github.com/Bojo2025",
      email: DESK_EMAIL,
    },
    publisher: {
      "@type": "Organization",
      name: "Indian Box Office",
      url: SITE,
      logo: `${SITE}/favicon.svg`,
      email: DESK_EMAIL,
    },
    image: `${SITE}/posters/hero-cinema.jpg`,
  };

  const body = `
    <article class="seo-brief">
      <p class="kicker">Morning brief · ${esc(brief.briefDate)}</p>
      <h1>${esc(brief.headline)}</h1>
      <p class="brief-byline">By ${esc(PUBLISHER_NAME)} · Indian Box Office consensus desk</p>
      <p class="brief-lede">${esc(brief.lede)}</p>
      <div class="brief-body seo-prose">
        ${renderBriefBodyHtml(brief.body || "")}
      </div>
      <p class="updated">Published ${esc(brief.generatedAt)}</p>
      <p class="seo-back"><a href="/briefs/">Brief archive</a> · <a href="/about-methodology/">Methodology</a> · <a href="/contact/">Contact</a></p>
      ${isLatest ? "" : `<p class="seo-back"><a href="/brief/">← Latest morning brief</a></p>`}
      <p class="seo-back"><a href="/">← Home board</a></p>
    </article>
  `;

  return shell({
    title: `${brief.headline} | Indian Box Office Morning Brief`,
    description: brief.lede || brief.headline,
    canonical: url,
    ogType: "article",
    breadcrumbs: [
      { name: "Home", url: `${SITE}/` },
      { name: "Morning Brief", url: `${SITE}/brief/` },
      ...(isLatest ? [] : [{ name: brief.briefDate, url }]),
    ],
    jsonLd: [newsLd],
    body,
  });
}

function weekBoardHtml(films: Film[], deskDate: string): string {
  const weekPool = films.filter((m) => m.status === "playing" || m.status === "late");
  const weekRanked = [...weekPool].sort(
    (a, b) => (b.lastDayNet || 0) - (a.lastDayNet || 0) || (b.worldwide || 0) - (a.worldwide || 0),
  );
  if (!weekRanked.length) return `<li class="week-empty">No theatrical titles on the board.</li>`;
  return weekRanked
    .slice(0, 5)
    .map(
      (m, i) => `<li>
            <a class="week-link" href="/movies/${esc(m.slug)}/" aria-label="Open details for ${esc(m.title)}">
              <span class="week-rank">${i + 1}</span>
              <span class="week-title">${esc(m.title)}</span>
              <span class="week-gross">
                <strong>${esc(formatCrCompact(m.worldwide))}</strong>
                <em>WW</em>
                <span>${esc(formatCrCompact(m.indiaNet))} net</span>
              </span>
            </a>
          </li>`,
    )
    .join("\n");
}

function cardHtml(m: Film, deskDate: string): string {
  const day = dayNumber(m.releaseDate, deskDate);
  const img = localPoster(m.poster, m.posterKey);
  return `<a class="film-card-link" href="/movies/${esc(m.slug)}/" aria-label="Open details for ${esc(m.title)}">
      <article class="card">
        <div class="poster-wrap">
          <img class="poster" src="${esc(img)}" alt="${esc(m.title)} poster" loading="lazy" />
        </div>
        <div class="card-body">
          <p class="kicker">${esc(m.language)} · Day ${day}${m.status === "late" ? " · Late run" : ""}</p>
          <h3>${esc(m.title)}</h3>
          <p class="meta">${esc(m.director)} · ${esc(m.starring)}</p>
          <p class="synopsis">${esc(m.synopsis)}</p>
          <dl>
            <div><dt>India net</dt><dd>${esc(formatCr(m.indiaNet))}</dd></div>
            <div><dt>Worldwide</dt><dd>${esc(formatCr(m.worldwide))}</dd></div>
          </dl>
        </div>
      </article>
    </a>`;
}

function replaceInnerById(html: string, id: string, inner: string): string {
  const openRe = new RegExp(`<(?<tag>[a-zA-Z0-9]+)(?=[^>]*\\bid="${id}")[^>]*>`);
  const open = openRe.exec(html);
  if (!open || open.index == null) {
    console.warn(`SEO prerender: element #${id} not found in index.html`);
    return html;
  }
  const tag = open.groups?.tag;
  if (!tag) return html;
  const startInner = open.index + open[0].length;
  const closeTag = `</${tag}>`;
  let depth = 1;
  let i = startInner;
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf(`<${tag}`, i);
    const nextClose = html.indexOf(closeTag, i);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      const after = html[nextOpen + tag.length + 1];
      if (after === " " || after === ">" || after === "\n" || after === "\t") depth += 1;
      i = nextOpen + tag.length + 1;
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      return `${html.slice(0, startInner)}\n${inner}\n${html.slice(nextClose)}`;
    }
    i = nextClose + closeTag.length;
  }
  console.warn(`SEO prerender: could not find closing tag for #${id}`);
  return html;
}

function prerenderHomepage(pack: Pack) {
  const indexPath = join(outDir, "index.html");
  let html = readFileSync(indexPath, "utf8");
  const films = pack.films;
  const deskDate = pack.deskDate;

  const momentumRanked = [...films]
    .filter((m) => (m.status === "playing" || m.status === "late") && (m.lastDayNet || 0) > 0)
    .sort((a, b) => (b.lastDayNet || 0) - (a.lastDayNet || 0));
  const momentumIds = new Set(momentumRanked.map((m) => m.id));
  const playing = films.filter((m) => m.status === "playing");
  const late = films.filter((m) => m.status === "late" && !momentumIds.has(m.id));
  const now = [...momentumRanked, ...playing.filter((m) => !momentumIds.has(m.id))];
  const ranked = [...films].sort((a, b) => b.worldwide - a.worldwide);

  html = replaceInnerById(html, "week-board", weekBoardHtml(films, deskDate));
  html = replaceInnerById(html, "now-grid", now.map((m) => cardHtml(m, deskDate)).join("\n") || `<p class="meta">No live titles.</p>`);
  html = replaceInnerById(html, "late-grid", late.map((m) => cardHtml(m, deskDate)).join("\n") || `<p class="meta">No late-run titles.</p>`);
  html = replaceInnerById(html, "rank-body", rankingsRows(ranked));

  const feature = ramayanaFeatureHtml(pack);
  if (html.includes('id="ramayana-feature"')) {
    html = replaceInnerById(html, "ramayana-feature", feature || "");
  } else if (feature) {
    html = html.replace(
      /(<div class="board-top">)/,
      `<div id="ramayana-feature">\n${feature}\n</div>\n    $1`,
    );
  }

  const stamp = pack.generatedAt
    ? `Last updated ${new Date(pack.generatedAt).toLocaleString("en-GB", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })} IST${pack.comparedTo ? ` · vs ${pack.comparedTo}` : ""}`
    : `Desk date ${deskDate}`;
  html = html.replace(
    /(<p class="updated" id="updated-line">)[\s\S]*?(<\/p>)/i,
    `$1${stamp}$2`,
  );

  // Bump stylesheet cache + ensure RSS link + feed discovery
  html = html.replace(/styles\.css\?v=[^"]+/g, `styles.css?v=${ASSET_VER}`);
  html = html.replace(/catalog\.js\?v=[^"]+/g, `catalog.js?v=${ASSET_VER}`);
  html = html.replace(/app\.js\?v=[^"]+/g, `app.js?v=${ASSET_VER}`);

  if (!html.includes('type="application/rss+xml"')) {
    html = html.replace(
      '<link rel="canonical"',
      `<link rel="alternate" type="application/rss+xml" title="Indian Box Office Feed" href="${SITE}/feed.xml" />\n  <link rel="canonical"`,
    );
  }

  if (!html.includes("adsbygoogle.js")) {
    html = html.replace("</head>", `  ${ADSENSE_SCRIPT}\n</head>`);
  }

  writeFileSync(indexPath, html);
}

function writeSitemap(pack: Pack, briefDates: string[]) {
  const lastmod = pack.generatedAt;
  const urls: { loc: string; changefreq: string; priority: string }[] = [
    { loc: `${SITE}/`, changefreq: "hourly", priority: "1.0" },
    { loc: `${SITE}/daily-box-office/`, changefreq: "hourly", priority: "0.95" },
    { loc: `${SITE}/rankings/2026/`, changefreq: "hourly", priority: "0.9" },
    { loc: `${SITE}/records/highest-day-1-collection-2026/`, changefreq: "daily", priority: "0.85" },
    { loc: `${SITE}/ramayana/`, changefreq: "hourly", priority: "0.98" },
    { loc: `${SITE}/about/`, changefreq: "monthly", priority: "0.7" },
    { loc: `${SITE}/about-methodology/`, changefreq: "monthly", priority: "0.7" },
    { loc: `${SITE}/editorial-policy/`, changefreq: "monthly", priority: "0.55" },
    { loc: `${SITE}/contact/`, changefreq: "monthly", priority: "0.6" },
    { loc: `${SITE}/privacy-policy/`, changefreq: "yearly", priority: "0.3" },
    { loc: `${SITE}/brief/`, changefreq: "daily", priority: "0.85" },
    { loc: `${SITE}/briefs/`, changefreq: "daily", priority: "0.75" },
    { loc: `${SITE}/feed.xml`, changefreq: "hourly", priority: "0.5" },
  ];
  for (const lang of LANGUAGE_PAGES) {
    urls.push({ loc: `${SITE}/languages/${lang.slug}/`, changefreq: "daily", priority: "0.8" });
  }
  for (const f of pack.films) {
    urls.push({ loc: movieUrl(f.slug), changefreq: "hourly", priority: "0.8" });
  }
  for (const d of briefDates) {
    urls.push({ loc: `${SITE}/briefs/${d}/`, changefreq: "weekly", priority: "0.7" });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;
  writeFileSync(join(outDir, "sitemap.xml"), xml);
}

function writeFeed(pack: Pack, briefs: MorningBrief[]) {
  const items: string[] = [];
  items.push(`  <item>
    <title>Daily Indian Box Office Chart — Day-Wise Theatrical Collections</title>
    <link>${SITE}/daily-box-office/</link>
    <guid isPermaLink="true">${SITE}/daily-box-office/</guid>
    <pubDate>${new Date(pack.generatedAt).toUTCString()}</pubDate>
    <description>Latest day-wise India nett collections, day numbers, and percentage movements for films currently running in Indian cinemas.</description>
  </item>`);
  items.push(`  <item>
    <title>Highest Day 1 Box Office Collections of 2026 — Opening Day Records</title>
    <link>${SITE}/records/highest-day-1-collection-2026/</link>
    <guid isPermaLink="true">${SITE}/records/highest-day-1-collection-2026/</guid>
    <pubDate>${new Date(pack.generatedAt).toUTCString()}</pubDate>
    <description>All 2026 Indian theatrical releases ranked by Day 1 (opening day) India nett collection across Hindi, Telugu, Tamil, Malayalam and Kannada cinema.</description>
  </item>`);
  for (const brief of briefs.slice(0, 14)) {
    const link = brief.briefDate === pack.morningBrief?.briefDate ? `${SITE}/brief/` : `${SITE}/briefs/${brief.briefDate}/`;
    items.push(`  <item>
    <title>${esc(brief.headline)}</title>
    <link>${link}</link>
    <guid isPermaLink="true">${link}</guid>
    <pubDate>${new Date(brief.generatedAt).toUTCString()}</pubDate>
    <description>${esc(brief.lede)}</description>
  </item>`);
  }
  // Milestone-ish movie entries: top movers by worldwide
  const top = [...pack.films].sort((a, b) => b.worldwide - a.worldwide).slice(0, 10);
  for (const f of top) {
    items.push(`  <item>
    <title>${esc(f.title)} box office — ${esc(formatCr(f.worldwide))} WW / ${esc(formatCr(f.indiaNet))} India nett</title>
    <link>${movieUrl(f.slug)}</link>
    <guid isPermaLink="true">${movieUrl(f.slug)}</guid>
    <pubDate>${new Date(pack.generatedAt).toUTCString()}</pubDate>
    <description>${esc(`${f.title} (${f.language}) — verdict ${f.verdict}. India nett ${formatCr(f.indiaNet)}, worldwide ${formatCr(f.worldwide)}.`)}</description>
  </item>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Indian Box Office</title>
    <link>${SITE}/</link>
    <description>Daily Indian box office consensus — morning briefs, rankings, and day-wise collections.</description>
    <language>en-in</language>
    <lastBuildDate>${new Date(pack.generatedAt).toUTCString()}</lastBuildDate>
${items.join("\n")}
  </channel>
</rss>
`;
  writeFileSync(join(outDir, "feed.xml"), xml);
}

function ensureIndexNowKey(): string {
  const marker = join(outDir, ".indexnow-key");
  let key: string | null = null;
  if (existsSync(marker)) {
    try {
      key = readFileSync(marker, "utf8").trim();
    } catch {
      key = null;
    }
  }
  if (!key || !/^[a-f0-9]{32,128}$/i.test(key)) {
    key = randomBytes(16).toString("hex");
    writeFileSync(marker, key);
  }
  writeFileSync(join(outDir, `${key}.txt`), key);
  return key;
}

async function pingIndexNow(key: string, urls: string[]) {
  const payload = {
    host: "indian-boxoffice.com",
    key,
    keyLocation: `${SITE}/${key}.txt`,
    urlList: urls.slice(0, 100),
  };
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });
    console.log(`IndexNow ping → ${res.status} (${urls.length} urls)`);
  } catch (err) {
    console.warn("IndexNow ping failed:", err instanceof Error ? err.message : err);
  }
}

function collectBriefs(pack: Pack): MorningBrief[] {
  const map = new Map<string, MorningBrief>();
  const upsert = (brief: MorningBrief | null | undefined) => {
    if (!brief?.briefDate) return;
    const prev = map.get(brief.briefDate);
    // Keep the freshest revision when the same desk date is rewritten.
    if (!prev || (brief.generatedAt ?? "") >= (prev.generatedAt ?? "")) {
      map.set(brief.briefDate, brief);
    }
  };

  // Archives first, then board copy, then live morning-brief.json last.
  const briefsDir = join(outDir, "briefs");
  if (existsSync(briefsDir)) {
    for (const name of readdirSync(briefsDir)) {
      upsert(readJson<MorningBrief>(join(briefsDir, name, "brief.json")));
    }
  }
  upsert(pack.morningBrief);
  upsert(readJson<MorningBrief>(join(outDir, "morning-brief.json")));

  return [...map.values()].sort((a, b) => b.briefDate.localeCompare(a.briefDate));
}

function clearGeneratedMovieDirs(films: Film[]) {
  const moviesDir = join(outDir, "movies");
  if (!existsSync(moviesDir)) return;
  const keep = new Set(films.map((f) => f.slug));
  for (const name of readdirSync(moviesDir)) {
    if (!keep.has(name)) {
      rmSync(join(moviesDir, name), { recursive: true, force: true });
    }
  }
}

export async function generateSeoPages(packInput?: Pack): Promise<void> {
  const pack =
    packInput ??
    readJson<Pack>(join(outDir, "board.json")) ??
    (() => {
      throw new Error("docs/board.json missing — run publish:desk first");
    })();

  if (!pack.films?.length) throw new Error("No films in pack");

  clearGeneratedMovieDirs(pack.films);

  for (const film of pack.films) {
    writePage(`movies/${film.slug}/index.html`, renderMoviePage(film, pack.deskDate));
  }

  writePage("daily-box-office/index.html", renderDailyBoxOfficePage(pack.films, pack.deskDate));
  writePage("records/highest-day-1-collection-2026/index.html", renderDay1RecordsPage(pack.films, pack.deskDate));
  writePage("rankings/2026/index.html", renderRankingsPage(pack.films, pack.deskDate));

  for (const lang of LANGUAGE_PAGES) {
    writePage(`languages/${lang.slug}/index.html`, renderLanguagePage(lang, pack.films, pack.deskDate));
  }

  const ramayanaHtml = renderRamayanaPage(pack);
  if (ramayanaHtml) writePage("ramayana/index.html", ramayanaHtml);

  writePage("about/index.html", renderAboutPage());
  writePage("about-methodology/index.html", renderMethodologyPage());
  writePage("editorial-policy/index.html", renderEditorialPolicyPage());
  writePage("contact/index.html", renderContactPage());
  writePage("privacy-policy/index.html", renderPrivacyPolicyPage());
  writeFileSync(
    join(outDir, "ads.txt"),
    "# Google AdSense — authorized digital sellers for indian-boxoffice.com\ngoogle.com, pub-3635078997966836, DIRECT, f08c47fec0942fa0\n",
  );

  const briefs = collectBriefs(pack);
  writePage("briefs/index.html", renderBriefsIndexPage(briefs));
  for (const brief of briefs) {
    ensureDir(join(outDir, "briefs", brief.briefDate));
    writeFileSync(join(outDir, "briefs", brief.briefDate, "brief.json"), `${JSON.stringify(brief, null, 2)}\n`);
    writePage(`briefs/${brief.briefDate}/index.html`, renderBriefPage(brief, false));
  }
  // Prefer the newest brief by date (morning-brief.json may be newer than board.json's copy).
  const latest = briefs[0] ?? null;
  if (latest) {
    writePage("brief/index.html", renderBriefPage(latest, true));
    // Keep board/catalog morningBrief in sync with the newest source of truth.
    if (!pack.morningBrief || pack.morningBrief.briefDate < latest.briefDate) {
      pack.morningBrief = latest;
      try {
        const boardPath = join(outDir, "board.json");
        const board = readJson<Record<string, unknown>>(boardPath);
        if (board) {
          board.morningBrief = latest;
          writeFileSync(boardPath, `${JSON.stringify(board, null, 2)}\n`);
        }
        const catalogPath = join(outDir, "catalog.js");
        if (existsSync(catalogPath)) {
          const raw = readFileSync(catalogPath, "utf8");
          const match = raw.match(/^window\.IBO_CATALOG\s*=\s*([\s\S]*);\s*$/);
          if (match) {
            const cat = JSON.parse(match[1]) as Record<string, unknown>;
            cat.morningBrief = latest;
            writeFileSync(catalogPath, `window.IBO_CATALOG = ${JSON.stringify(cat, null, 2)};\n`);
          }
        }
      } catch (err) {
        console.warn("Could not sync morningBrief into board/catalog:", err);
      }
    }
  }

  prerenderHomepage(pack);
  writeSitemap(pack, briefs.map((b) => b.briefDate));
  writeFeed(pack, briefs);

  const indexNowKey = ensureIndexNowKey();
  const pingUrls = [
    `${SITE}/`,
    `${SITE}/daily-box-office/`,
    `${SITE}/records/highest-day-1-collection-2026/`,
    `${SITE}/feed.xml`,
    `${SITE}/rankings/2026/`,
    `${SITE}/brief/`,
    `${SITE}/briefs/`,
    `${SITE}/ramayana/`,
    `${SITE}/about/`,
    `${SITE}/about-methodology/`,
    `${SITE}/editorial-policy/`,
    `${SITE}/contact/`,
    ...pack.films.slice(0, 40).map((f) => movieUrl(f.slug)),
  ];
  if (latest) pingUrls.push(`${SITE}/briefs/${latest.briefDate}/`);
  await pingIndexNow(indexNowKey, pingUrls);

  console.log(
    `SEO pages: ${pack.films.length} movies · daily hub + records + ${LANGUAGE_PAGES.length} languages · ${briefs.length} briefs${ramayanaHtml ? " · ramayana hub" : ""} · sitemap + feed written`,
  );
}

// vite-node may not set argv[1] to this file; match any argv segment.
if (process.argv.some((arg) => /generate-seo-pages\.mts$/.test(arg))) {
  await generateSeoPages();
}
