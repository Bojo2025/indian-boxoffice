import { formatCr, formatCrCompact, formatDeskLong, formatPct } from "./format";
import type { DailyReport, MovieCard, NewsItem, Source } from "./types";

export type ArchivePack = {
  today: string;
  films: MovieCard[];
  playing: MovieCard[];
  report: DailyReport | null;
  news: NewsItem[];
  sources: Source[];
  ytdIndiaNet: number;
  ytdWorldwide: number;
};

export function archiveBasename(today: string): string {
  return `indian-box-office-${today}`;
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rankingsCsv(films: MovieCard[]): string {
  const header = [
    "Rank",
    "Title",
    "Language",
    "Industry",
    "Status",
    "Verdict",
    "Release",
    "Day",
    "India Net (Cr)",
    "India Gross (Cr)",
    "Overseas (Cr)",
    "Worldwide (Cr)",
    "Director",
    "Starring",
  ];
  const rows = films.map((m, i) =>
    [
      i + 1,
      m.title,
      m.language,
      m.industry,
      m.status,
      m.verdict,
      m.releaseDate,
      m.dayNumber,
      m.indiaNet,
      m.indiaGross,
      m.overseas,
      m.worldwide,
      m.director,
      m.starring,
    ]
      .map(csvCell)
      .join(","),
  );
  return `\uFEFF${header.join(",")}\n${rows.join("\n")}\n`;
}

export function nowPlayingCsv(playing: MovieCard[]): string {
  const header = [
    "Title",
    "Language",
    "Status",
    "Day",
    "Last day India net (Cr)",
    "India Net (Cr)",
    "Worldwide (Cr)",
    "Screens",
    "Occupancy %",
    "Change %",
  ];
  const rows = playing.map((m) =>
    [
      m.title,
      m.language,
      m.status,
      m.dayNumber,
      m.lastDayNet,
      m.indiaNet,
      m.worldwide,
      m.screens,
      m.occupancy,
      m.netChangePct,
    ]
      .map(csvCell)
      .join(","),
  );
  return `\uFEFF${header.join(",")}\n${rows.join("\n")}\n`;
}

export function archiveJson(pack: ArchivePack): string {
  return `${JSON.stringify(pack, null, 2)}\n`;
}

function esc(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;");
}

function inlineMd(text: string): string {
  return esc(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function reportHtml(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("## ")) {
        return `<h2>${inlineMd(trimmed.replace(/^##\s+/, ""))}</h2>`;
      }
      return `<p>${inlineMd(trimmed.replace(/\n/g, " "))}</p>`;
    })
    .join("\n");
}

function statusLabel(status: MovieCard["status"]): string {
  if (status === "playing") return "Now playing";
  if (status === "late") return "Late run";
  return "Closed";
}

export function buildArchiveHtml(pack: ArchivePack): string {
  const titleDate = formatDeskLong(pack.today);
  const playingLive = pack.playing.filter((m) => m.status === "playing");
  const rows = pack.films
    .map((m, i) => {
      const live = m.status === "playing";
      return `<tr class="${live ? "live" : ""}">
        <td class="rank">${i + 1}</td>
        <td>
          <a href="#film-${esc(m.slug)}">${esc(m.title)}</a>
          ${live ? '<span class="pill">Playing</span>' : ""}
        </td>
        <td>${esc(m.language)}</td>
        <td class="num">${esc(formatCr(m.indiaNet))}</td>
        <td class="num strong">${esc(formatCr(m.worldwide))}</td>
      </tr>`;
    })
    .join("\n");

  const cardHtml = (m: MovieCard) => `<article class="card">
        <p class="kicker">${esc(m.language)} · Day ${esc(m.dayNumber)}${m.status === "late" ? " · Late run" : ""}</p>
        <h3><a href="#film-${esc(m.slug)}">${esc(m.title)}</a></h3>
        <p class="meta">${esc(m.director)} · ${esc(m.starring)}</p>
        <dl>
          <div><dt>India net</dt><dd>${esc(formatCr(m.indiaNet))}</dd></div>
          <div><dt>Worldwide</dt><dd>${esc(formatCr(m.worldwide))}</dd></div>
          <div><dt>Last day</dt><dd>${esc(formatCr(m.lastDayNet))} <span>${esc(formatPct(m.netChangePct))}</span></dd></div>
        </dl>
      </article>`;
  const nowCards = playingLive.map(cardHtml).join("\n");
  const latePlaying = pack.playing.filter((m) => m.status === "late");
  const lateCards = latePlaying.map(cardHtml).join("\n");
  const lateSection = latePlaying.length
    ? `<section id="late">
      <p class="kicker">Holdovers</p>
      <h2>Late run</h2>
      <div class="grid" style="margin-top:24px">${lateCards}</div>
    </section>`
    : "";

  const filmFiles = pack.films
    .map(
      (m) => `<article class="file" id="film-${esc(m.slug)}">
        <header>
          <p class="kicker">${esc(m.language)} · ${esc(m.industry)} · ${esc(statusLabel(m.status))}</p>
          <h3>${esc(m.title)}</h3>
          <p class="meta">${esc(m.director)} · ${esc(m.starring)} · released ${esc(m.releaseDate)}</p>
        </header>
        <p class="synopsis">${esc(m.synopsis)}</p>
        <dl>
          <div><dt>India net</dt><dd>${esc(formatCr(m.indiaNet))}</dd></div>
          <div><dt>India gross</dt><dd>${esc(formatCr(m.indiaGross))}</dd></div>
          <div><dt>Overseas</dt><dd>${esc(formatCr(m.overseas))}</dd></div>
          <div><dt>Worldwide</dt><dd>${esc(formatCr(m.worldwide))}</dd></div>
          <div><dt>Verdict</dt><dd>${esc(m.verdict)}</dd></div>
          <div><dt>Budget</dt><dd>${m.budgetCr == null ? "—" : esc(formatCr(m.budgetCr, 0))}</dd></div>
        </dl>
      </article>`,
    )
    .join("\n");

  const sourceList = pack.sources
    .map(
      (s) => `<article class="source">
        <h3>${esc(s.name)}</h3>
        <p class="meta">${esc(s.kind)} · weight ${esc(s.weight)}</p>
        <p>${esc(s.notes)}</p>
        ${
          s.homepage.startsWith("http")
            ? `<p class="url"><a href="${esc(s.homepage)}">${esc(s.homepage)}</a></p>`
            : ""
        }
      </article>`,
    )
    .join("\n");

  const newsList = pack.news
    .slice(0, 10)
    .map(
      (n) => `<li>
        <a href="${esc(n.url)}">${esc(n.title)}</a>
        <p>${esc(n.summary)}</p>
      </li>`,
    )
    .join("\n");

  const reportBlock = pack.report
    ? `<header>
        <p class="kicker">Daily report · ${esc(pack.report.reportDate)}</p>
        <h2>${esc(pack.report.headline)}</h2>
        <p class="lede">${esc(pack.report.lede)}</p>
      </header>
      <div class="report-body">${reportHtml(pack.report.body)}</div>`
    : "<p class='empty'>No report on file for this snapshot.</p>";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Indian Box Office — desk files ${esc(pack.today)}</title>
  <meta name="description" content="Offline snapshot of the Indian Box Office consensus desk." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #0c0b0a;
      --surface: #1b1814;
      --fg: #f3efe6;
      --muted: #9a9488;
      --subtle: #6f6a62;
      --border: #2c2823;
      --accent: #c45c3e;
      --paper: #e8e0d2;
      --font-sans: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
      --font-display: "Newsreader", "Times New Roman", serif;
      --font-mono: "IBM Plex Mono", ui-monospace, monospace;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--fg);
      font-family: var(--font-sans);
      line-height: 1.5;
    }
    a { color: inherit; }
    header.mast {
      border-bottom: 1px solid var(--border);
      padding: 20px 24px;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: center;
      position: sticky;
      top: 0;
      background: color-mix(in srgb, var(--bg) 92%, transparent);
      backdrop-filter: blur(8px);
      z-index: 4;
    }
    .brand { display: flex; gap: 10px; align-items: center; text-decoration: none; }
    .mark {
      width: 32px; height: 32px; display: grid; place-items: center;
      background: var(--accent); color: var(--bg);
      font-size: 11px; font-weight: 600; letter-spacing: 0.12em;
    }
    .brand strong { font-family: var(--font-display); font-size: 17px; font-weight: 500; display: block; letter-spacing: -0.03em; }
    .brand span { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); }
    nav { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 13px; color: var(--muted); }
    nav a { text-decoration: none; min-height: 32px; display: inline-flex; align-items: center; }
    nav a:hover { color: var(--fg); }
    main { max-width: 1080px; margin: 0 auto; padding: 48px 24px 80px; }
    .kicker { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--accent); margin: 0 0 10px; }
    h1, h2, h3 { font-family: var(--font-display); font-weight: 500; letter-spacing: -0.03em; line-height: 1.1; margin: 0; }
    h1 { font-size: clamp(2.2rem, 5vw, 3.6rem); max-width: 18ch; }
    h2 { font-size: 2rem; }
    .lede { color: var(--paper); max-width: 62ch; margin: 18px 0 0; }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      border: 1px solid var(--border);
      margin: 40px 0 56px;
    }
    .stats div { padding: 18px 20px; border-right: 1px solid var(--border); }
    .stats div:last-child { border-right: 0; }
    .stats dt { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--subtle); }
    .stats dd { margin: 8px 0 0; font-family: var(--font-mono); font-size: 1.15rem; }
    section { margin: 64px 0; }
    .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
    .card, .file, .source {
      background: var(--surface);
      padding: 20px;
      border: 1px solid var(--border);
    }
    .card h3, .file h3, .source h3 { font-size: 1.45rem; margin-top: 6px; }
    .meta, .url { color: var(--muted); font-size: 13px; }
    .synopsis { color: var(--paper); font-size: 14px; }
    dl { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 16px 0 0; }
    dt { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--subtle); }
    dd { margin: 4px 0 0; font-family: var(--font-mono); font-size: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--subtle); font-weight: 500; padding: 12px 8px; border-bottom: 1px solid var(--border); }
    td { padding: 12px 8px; border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent); vertical-align: top; }
    td a { text-decoration: none; }
    td a:hover { color: var(--paper); }
    .rank, .num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
    .num { text-align: right; }
    .strong { color: var(--fg); }
    tr.live td:first-child { box-shadow: inset 3px 0 0 var(--accent); }
    .pill { display: inline-block; margin-left: 8px; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
    .wires { list-style: none; padding: 0; margin: 0; }
    .wires li { padding: 14px 0; border-bottom: 1px solid var(--border); }
    .wires a { text-decoration: none; font-weight: 500; }
    .wires p { margin: 6px 0 0; color: var(--muted); font-size: 14px; }
    .report-body h2 { font-size: 1.35rem; margin: 28px 0 10px; }
    .report-body p { color: var(--paper); max-width: 68ch; }
    footer {
      border-top: 1px solid var(--border);
      padding: 28px 24px 48px;
      color: var(--muted);
      font-size: 13px;
    }
    footer .wrap { max-width: 1080px; margin: 0 auto; }
    @media (max-width: 720px) {
      .stats { grid-template-columns: 1fr 1fr; }
      .stats div:nth-child(1), .stats div:nth-child(2) { border-bottom: 1px solid var(--border); }
      .stats div:nth-child(2) { border-right: 0; }
      header.mast { flex-direction: column; align-items: flex-start; }
      table { font-size: 13px; }
    }
    @media print {
      body { background: #fff; color: #1a1814; }
      header.mast { position: static; background: #fff; }
      .card, .file, .source { break-inside: avoid; }
      a { color: inherit; text-decoration: none; }
    }
  </style>
</head>
<body>
  <header class="mast">
    <a class="brand" href="#top">
      <span class="mark">IBO</span>
      <span>
        <strong>Indian Box Office</strong>
        <span>Offline desk files</span>
      </span>
    </a>
    <nav>
      <a href="#now">Now playing</a>
      <a href="#rankings">2026</a>
      <a href="#report">Report</a>
      <a href="#catalogue">Catalogue</a>
      <a href="#wires">Wires</a>
      <a href="#sources">Sources</a>
    </nav>
  </header>
  <main id="top">
    <p class="kicker">${esc(titleDate)} · IST snapshot</p>
    <h1>The desk that reads every tracker.</h1>
    <p class="lede">
      Consensus collections compiled from Sacnilk, Koimoi, Bollywood Hungama, Box Office India,
      Pinkvilla, Indian Express and ETimes — published with the spread, not against it.
      This file is a self-contained copy of the board on ${esc(titleDate)}.
    </p>
    <dl class="stats">
      <div><dt>Tracked worldwide</dt><dd>${esc(formatCrCompact(pack.ytdWorldwide))}</dd></div>
      <div><dt>India net on file</dt><dd>${esc(formatCrCompact(pack.ytdIndiaNet))}</dd></div>
      <div><dt>Now playing</dt><dd>${playingLive.length}</dd></div>
      <div><dt>Sources</dt><dd>${pack.sources.length}</dd></div>
    </dl>

    <section id="now">
      <p class="kicker">Theatrical</p>
      <h2>Now in theatres</h2>
      <div class="grid" style="margin-top:24px">${nowCards}</div>
    </section>
    ${lateSection}

    <section id="rankings">
      <p class="kicker">Year board</p>
      <h2>2026 worldwide</h2>
      <p class="lede">Ranked on IBO consensus worldwide gross. Range titles sit at the midpoint.</p>
      <div style="overflow-x:auto;margin-top:24px">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Language</th>
              <th class="num">India net</th>
              <th class="num">Worldwide</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </section>

    <section id="report">
      ${reportBlock}
    </section>

    <section id="catalogue">
      <p class="kicker">Files</p>
      <h2>Catalogue</h2>
      <div class="grid" style="margin-top:24px">${filmFiles}</div>
    </section>

    <section id="wires">
      <p class="kicker">Wires</p>
      <h2>Latest headlines</h2>
      <ul class="wires">${newsList || "<li><p>No wires in this snapshot.</p></li>"}</ul>
    </section>

    <section id="sources">
      <p class="kicker">Method</p>
      <h2>Sources on the desk</h2>
      <div class="grid" style="margin-top:24px">${sourceList}</div>
    </section>
  </main>
  <footer>
    <div class="wrap">
      Independent consensus of published theatrical estimates. India has no official auditor — we publish the spread.
      Figures in ₹ crore. India nett / worldwide gross. Saved ${esc(pack.today)}.
    </div>
  </footer>
</body>
</html>
`;
}
