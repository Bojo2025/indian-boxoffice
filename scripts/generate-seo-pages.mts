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

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "docs");
const SITE = "https://indian-boxoffice.com";
const ASSET_VER = "20260926a";

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
  <meta name="author" content="Kevin Boyjonauth" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
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

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(opts.title)}" />
  <meta name="twitter:description" content="${esc(opts.description)}" />
  <meta name="twitter:image" content="${esc(ogImage)}" />

  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/styles.css?v=${ASSET_VER}" />
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
      <a href="/brief/">Morning brief</a>
      <a href="/#now">Now playing</a>
      <a href="/rankings/2026/">2026</a>
      <a href="/about-methodology/">Methodology</a>
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
      · <a href="/about-methodology/">Methodology</a>
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
    return `<div class="film-detail-days"><h3>Day-wise box office collection</h3><p class="film-detail-empty">Day-wise figures are not yet available for this title.</p></div>`;
  }
  return `<div class="film-detail-days">
    <h3>${esc(film.title)} day-wise box office collection</h3>
    <p>India nett and worldwide gross by theatrical day, including Day 1 / opening day.</p>
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
  const day1 = (film.dayWise ?? []).find((d) => d.dayNumber === 1);
  const budgetText =
    film.budgetCr == null
      ? `${film.title} does not yet have a published budget estimate on this desk.`
      : `${film.title} had an estimated budget of ${formatCr(film.budgetCr)} and has collected ${formatCr(film.indiaNet)} India nett (${formatCr(film.worldwide)} worldwide), earning a box office verdict of ${film.verdict}.`;
  const verdictHeading = `${film.title} Box Office Verdict: Hit or Flop?`;
  const desc = `${film.title} box office collection: India nett ${formatCr(film.indiaNet)}, worldwide gross ${formatCr(film.worldwide)}. Day-wise collections, budget, and ${film.verdict} verdict.`;

  const movieLd = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: film.title,
    url,
    image: posterAbs,
    datePublished: film.releaseDate,
    inLanguage: film.language,
    description: film.synopsis || desc,
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
        name: `What is the total worldwide collection of ${film.title}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `The latest consensus worldwide gross for ${film.title} is ${formatCr(film.worldwide)}. India nett stands at ${formatCr(film.indiaNet)}.`,
        },
      },
      {
        "@type": "Question",
        name: `What was the opening day collection of ${film.title}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: day1
            ? `${film.title} collected ${formatCr(day1.indiaNet)} India nett on Day 1 (opening day).`
            : `Opening day (Day 1) India nett for ${film.title} is not yet available on this desk.`,
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
          <p class="film-detail-meta">${esc(film.director)} · Released ${esc(formatReleaseDate(film.releaseDate))}</p>
          <p class="film-detail-cast"><strong>Cast</strong><br />${esc(film.starring)}</p>
          <p class="film-detail-description">${esc(film.synopsis)}</p>
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

      <section class="seo-verdict" id="verdict">
        <h2>${esc(verdictHeading)}</h2>
        <p>${esc(budgetText)}</p>
        <p>Updated on the Indian Box Office consensus desk for ${esc(deskDate)} (IST).</p>
      </section>

      ${dayWiseTable(film)}

      <section class="faq-list seo-faq" id="faq">
        <h2>${esc(film.title)} box office FAQ</h2>
        <details open>
          <summary>What is the total worldwide collection of ${esc(film.title)}?</summary>
          <p>The latest consensus worldwide gross for ${esc(film.title)} is ${esc(formatCr(film.worldwide))}. India nett stands at ${esc(formatCr(film.indiaNet))}.</p>
        </details>
        <details>
          <summary>What was the opening day collection of ${esc(film.title)}?</summary>
          <p>${day1 ? `${esc(film.title)} collected ${esc(formatCr(day1.indiaNet))} India nett on Day 1 (opening day).` : `Opening day (Day 1) India nett for ${esc(film.title)} is not yet available on this desk.`}</p>
        </details>
        <details>
          <summary>Is ${esc(film.title)} a hit or a flop?</summary>
          <p>${esc(film.title)} currently carries a box office verdict of ${esc(film.verdict)}. ${esc(budgetText)}</p>
        </details>
      </section>

      <p class="seo-back"><a href="/rankings/2026/">← 2026 Indian box office rankings</a> · <a href="/">Home</a></p>
    </article>
  `;

  return shell({
    title: `${film.title} Box Office Collection, Day-Wise Nett & Verdict | Indian Box Office`,
    description: desc,
    canonical: url,
    ogType: "video.movie",
    ogImage: posterAbs,
    breadcrumbs: [
      { name: "Home", url: `${SITE}/` },
      { name: "2026 Rankings", url: `${SITE}/rankings/2026/` },
      { name: film.title, url },
    ],
    jsonLd: [movieLd, faqLd],
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
    <p class="seo-back" style="margin-top:28px"><a href="/rankings/2026/">← 2026 rankings</a> · <a href="/">Home</a></p>
  `;

  return shell({
    title: `${meta.language} Box Office Collection 2026 | Highest Grossing ${meta.language} Films`,
    description: `Highest grossing ${meta.language} movies of 2026 with India nett and worldwide gross. Daily ${meta.label} box office updates.`,
    canonical: url,
    breadcrumbs: [
      { name: "Home", url: `${SITE}/` },
      { name: `${meta.language} Box Office`, url },
    ],
    jsonLd: [itemList],
    body,
  });
}

function renderMethodologyPage(): string {
  const url = `${SITE}/about-methodology/`;
  const body = `
    <p class="kicker">Editorial trust</p>
    <h1>About our box office methodology</h1>
    <p class="page-sub">How Indian Box Office builds an independent consensus of theatrical collections across Hindi, Tamil, Telugu, Malayalam and Kannada releases.</p>

    <section class="seo-prose">
      <h2>Weighted-median consensus</h2>
      <p>India has no official box office auditor. Every published figure is an estimate. This desk therefore computes a weighted-median consensus across multiple trade trackers rather than reprinting any single reported number.</p>
      <p>Each tracker is assigned a weight based on historical reliability and coverage. For a given money field (India nett, India gross, overseas, worldwide), we take the weighted median of source totals, which dampens outliers without discarding minority reports.</p>

      <h2>Update cadence</h2>
      <p>The board refreshes every three hours through the day. A written morning brief is published each morning. Day-wise collection figures update as soon as new numbers are reported.</p>

      <h2>Definitions</h2>
      <ul>
        <li><strong>India nett</strong> — domestic theatrical collection after entertainment tax and GST are removed.</li>
        <li><strong>India gross</strong> — domestic theatrical ticket revenue before tax deductions.</li>
        <li><strong>Worldwide gross</strong> — total global ticket revenue before tax deductions, including overseas markets.</li>
      </ul>
      <p>These figures are never interchangeable. The desk always reports India nett and worldwide gross separately.</p>

      <h2>Publisher</h2>
      <p>Indian Box Office is developed by Mr Kevin Boyjonauth. Contact and source code: <a href="https://github.com/Bojo2025/indian-boxoffice">github.com/Bojo2025/indian-boxoffice</a>.</p>
    </section>
  `;

  return shell({
    title: "Box Office Methodology | Indian Box Office Consensus Desk",
    description:
      "How Indian Box Office computes weighted-median consensus of India nett and worldwide gross. Definitions, update cadence, and editorial trust notes.",
    canonical: url,
    breadcrumbs: [
      { name: "Home", url: `${SITE}/` },
      { name: "Methodology", url },
    ],
    body,
  });
}

function renderBriefPage(brief: MorningBrief, isLatest: boolean): string {
  const path = isLatest ? "/brief/" : `/briefs/${brief.briefDate}/`;
  const url = `${SITE}${path}`;
  const paragraphs = String(brief.body || "")
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
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
      name: "Kevin Boyjonauth",
      url: "https://github.com/Bojo2025",
    },
    publisher: {
      "@type": "Organization",
      name: "Indian Box Office",
      url: SITE,
      logo: `${SITE}/favicon.svg`,
    },
    image: `${SITE}/posters/hero-cinema.jpg`,
  };

  const body = `
    <article class="seo-brief">
      <p class="kicker">Morning brief · ${esc(brief.briefDate)}</p>
      <h1>${esc(brief.headline)}</h1>
      <p class="brief-lede">${esc(brief.lede)}</p>
      <div class="brief-body">
        ${paragraphs.map((p) => `<p>${esc(p)}</p>`).join("\n")}
      </div>
      <p class="updated">Published ${esc(brief.generatedAt)}</p>
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

  writeFileSync(indexPath, html);
}

function writeSitemap(pack: Pack, briefDates: string[]) {
  const lastmod = pack.generatedAt;
  const urls: { loc: string; changefreq: string; priority: string }[] = [
    { loc: `${SITE}/`, changefreq: "hourly", priority: "1.0" },
    { loc: `${SITE}/rankings/2026/`, changefreq: "hourly", priority: "0.9" },
    { loc: `${SITE}/about-methodology/`, changefreq: "monthly", priority: "0.6" },
    { loc: `${SITE}/brief/`, changefreq: "daily", priority: "0.8" },
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
  const live = readJson<MorningBrief>(join(outDir, "morning-brief.json"));
  if (live?.briefDate) map.set(live.briefDate, live);
  if (pack.morningBrief?.briefDate) map.set(pack.morningBrief.briefDate, pack.morningBrief);

  const briefsDir = join(outDir, "briefs");
  if (existsSync(briefsDir)) {
    for (const name of readdirSync(briefsDir)) {
      const jsonPath = join(briefsDir, name, "brief.json");
      const archived = readJson<MorningBrief>(jsonPath);
      if (archived?.briefDate) map.set(archived.briefDate, archived);
    }
  }
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

  writePage("rankings/2026/index.html", renderRankingsPage(pack.films, pack.deskDate));

  for (const lang of LANGUAGE_PAGES) {
    writePage(`languages/${lang.slug}/index.html`, renderLanguagePage(lang, pack.films, pack.deskDate));
  }

  writePage("about-methodology/index.html", renderMethodologyPage());

  const briefs = collectBriefs(pack);
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
    `${SITE}/feed.xml`,
    `${SITE}/rankings/2026/`,
    `${SITE}/brief/`,
    ...pack.films.slice(0, 40).map((f) => movieUrl(f.slug)),
  ];
  if (latest) pingUrls.push(`${SITE}/briefs/${latest.briefDate}/`);
  await pingIndexNow(indexNowKey, pingUrls);

  console.log(
    `SEO pages: ${pack.films.length} movies · ${LANGUAGE_PAGES.length} languages · ${briefs.length} briefs · sitemap + feed written`,
  );
}

// vite-node may not set argv[1] to this file; match any argv segment.
if (process.argv.some((arg) => /generate-seo-pages\.mts$/.test(arg))) {
  await generateSeoPages();
}
