/**
 * Ramayana Box Office Command Centre — static hub at /ramayana/
 * Built only from verified board.json day-wise + lifetime fields. No fabricated
 * territory, advance-booking, or ticket totals.
 */

const SITE = "https://indian-boxoffice.com";

export type DayWise = {
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

export type Film = {
  id: string;
  slug: string;
  title: string;
  language: string;
  industry: string;
  releaseDate: string;
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

export type Pack = {
  generatedAt: string;
  deskDate: string;
  films: Film[];
};

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

function formatCrOrDash(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value === 0) return "—";
  return formatCr(value);
}

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`;
}

function formatReleaseDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00+05:30`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function formatInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-IN");
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function localPoster(poster: string | undefined, posterKey: string): string {
  if (poster) return poster.replace(/^\.\//, "/");
  return `/posters/${posterKey || "hero-cinema"}.jpg`;
}

function sortedDays(film: Film): DayWise[] {
  return [...(film.dayWise ?? [])].sort((a, b) => a.dayNumber - b.dayNumber);
}

function findRamayana(films: Film[]): Film | null {
  return (
    films.find((f) => f.id === "ramayana" || /ramayana/i.test(f.title) || /ramayana/i.test(f.slug)) ??
    null
  );
}

/** Prefer day-wise ledger for cumulative India nett when it is populated. */
function ledgerIndiaNet(days: DayWise[]): number {
  return round2(days.reduce((s, d) => s + (d.indiaNet || 0), 0));
}

function ledgerIndiaGross(days: DayWise[]): number {
  return round2(days.reduce((s, d) => s + (d.indiaGross || 0), 0));
}

function moneyCell(value: number | null | undefined, opts?: { allowZero?: boolean }): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (!opts?.allowZero && value === 0) return "—";
  return formatCr(value);
}

function sparkline(values: number[], width = 320, height = 88): string {
  const nums = values.filter((v) => Number.isFinite(v) && v > 0);
  if (nums.length < 2) return "";
  const max = Math.max(...nums);
  const min = Math.min(...nums, 0);
  const span = Math.max(max - min, 0.01);
  const pts = nums
    .map((v, i) => {
      const x = (i / (nums.length - 1)) * (width - 16) + 8;
      const y = height - 12 - ((v - min) / span) * (height - 24);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const bars = nums
    .map((v, i) => {
      const x = (i / Math.max(nums.length - 1, 1)) * (width - 24) + 12;
      const h = ((v - min) / span) * (height - 28);
      const y = height - 12 - h;
      return `<rect x="${(x - 8).toFixed(1)}" y="${y.toFixed(1)}" width="16" height="${Math.max(h, 1).toFixed(1)}" fill="currentColor" opacity="0.85" />`;
    })
    .join("");
  return `<svg class="rama-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily India nett chart">${bars}<polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${pts}" /></svg>`;
}

function cumulativeLine(values: number[], width = 320, height = 88): string {
  if (values.length < 2) return "";
  let run = 0;
  const cum = values.map((v) => {
    run += v;
    return run;
  });
  const max = Math.max(...cum);
  const pts = cum
    .map((v, i) => {
      const x = (i / (cum.length - 1)) * (width - 16) + 8;
      const y = height - 12 - (v / Math.max(max, 0.01)) * (height - 24);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return `<svg class="rama-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Cumulative India nett chart"><polyline fill="none" stroke="var(--paper)" stroke-width="2.5" points="${pts}" /></svg>`;
}

type CompRow = {
  title: string;
  slug: string;
  day1: number | null;
  throughDay: number | null;
  daysTracked: number;
};

function comparisonRows(ram: Film, films: Film[], throughDay: number): CompRow[] {
  const ids = ["jailer-2", "toxic", "drishyam-3", "dhurandhar", "scene"];
  const out: CompRow[] = [];
  const ramDays = sortedDays(ram);
  out.push({
    title: ram.title,
    slug: ram.slug,
    day1: ramDays.find((d) => d.dayNumber === 1)?.indiaNet ?? null,
    throughDay: round2(
      ramDays.filter((d) => d.dayNumber <= throughDay).reduce((s, d) => s + (d.indiaNet || 0), 0),
    ),
    daysTracked: ramDays.length,
  });
  for (const id of ids) {
    const f = films.find((x) => x.id === id);
    if (!f) continue;
    const days = sortedDays(f);
    if (!days.length) continue;
    out.push({
      title: f.title,
      slug: f.slug,
      day1: days.find((d) => d.dayNumber === 1)?.indiaNet ?? null,
      throughDay: round2(
        days.filter((d) => d.dayNumber <= throughDay).reduce((s, d) => s + (d.indiaNet || 0), 0),
      ),
      daysTracked: days.length,
    });
  }
  return out;
}

function recordPanels(ram: Film, films: Film[], days: DayWise[]) {
  const day1 = days.find((d) => d.dayNumber === 1)?.indiaNet ?? null;
  const highest = days.length
    ? days.reduce((a, b) => ((a.indiaNet || 0) >= (b.indiaNet || 0) ? a : b))
    : null;
  const weekend = round2(
    days.filter((d) => d.dayNumber >= 1 && d.dayNumber <= 3).reduce((s, d) => s + (d.indiaNet || 0), 0),
  );

  const boardDay1 = films
    .map((f) => {
      const d1 = sortedDays(f).find((d) => d.dayNumber === 1);
      return d1 ? { title: f.title, value: d1.indiaNet, slug: f.slug } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (b!.value || 0) - (a!.value || 0)) as { title: string; value: number; slug: string }[];

  const bestDay1 = boardDay1[0] ?? null;
  const panels: { name: string; status: string; detail: string }[] = [];

  if (day1 != null && bestDay1) {
    const gap = round2(bestDay1.value - day1);
    const pct = bestDay1.value > 0 ? round2((day1 / bestDay1.value) * 100) : null;
    const broken = day1 >= bestDay1.value && bestDay1.slug === ram.slug;
    panels.push({
      name: "Highest Day 1 India nett (films on this desk)",
      status: broken ? "HOLDING RECORD" : day1 >= bestDay1.value * 0.85 ? "WITHIN REACH" : "NOT YET COMPARABLE",
      detail: broken
        ? `${ram.title} Day 1 ${formatCr(day1)} leads the desk sample.`
        : `Desk leader: ${bestDay1.title} at ${formatCr(bestDay1.value)}. Ramayana Day 1 is ${formatCr(day1)} (${pct != null ? `${pct}% of leader` : "—"}, gap ${formatCr(gap)}).`,
    });
  }

  if (highest) {
    panels.push({
      name: "Highest single day so far (this run)",
      status: "LIVE TRACKING",
      detail: `Day ${highest.dayNumber} (${formatReleaseDate(highest.reportDate)}) at ${formatCr(highest.indiaNet)} India nett.`,
    });
  }

  if (days.length >= 3) {
    panels.push({
      name: "Opening weekend India nett (Days 1–3)",
      status: days.length >= 3 ? "REPORTED" : "INSUFFICIENT DATA",
      detail: `Ramayana opening weekend ledger total ${formatCr(weekend)} India nett across Days 1–3.`,
    });
  }

  panels.push({
    name: "Worldwide vs India gross basis",
    status: "REPORTED",
    detail: `Consensus worldwide gross ${formatCr(ram.worldwide)} with overseas ${formatCr(ram.overseas)} (India excluded from overseas). Daily worldwide rows are not published on the day-wise ledger — unknown is shown as — , not ₹0.`,
  });

  return panels;
}

function projectionBlock(days: DayWise[]): string {
  if (days.length < 2) {
    return `<p>Not enough day-wise rows yet for a transparent Week 1 scenario.</p>`;
  }
  const soFar = ledgerIndiaNet(days);
  const last = days[days.length - 1];
  const avg = soFar / days.length;
  // Remaining days in a standard 7-day Week 1 window.
  const remain = Math.max(0, 7 - days.length);
  const low = round2(soFar + remain * last.indiaNet * 0.55);
  const base = round2(soFar + remain * avg * 0.85);
  const high = round2(soFar + remain * Math.max(last.indiaNet, avg) * 1.05);
  return `
    <p>Desk scenarios for <strong>Week 1 India nett (Days 1–7)</strong>, derived only from the reported day-wise ledger. These are <em>not</em> trade reports.</p>
    <ul>
      <li><strong>So far (Days 1–${days.length})</strong>: ${esc(formatCr(soFar))} India nett</li>
      <li><strong>Low</strong>: ${esc(formatCr(low))} — remaining weekdays at ~55% of the latest day</li>
      <li><strong>Base</strong>: ${esc(formatCr(base))} — remaining days at ~85% of the run average</li>
      <li><strong>High</strong>: ${esc(formatCr(high))} — remaining days near the stronger of latest day / average</li>
    </ul>
    <p class="rama-note">Confidence: <strong>Low–Medium</strong> while Week 1 is incomplete and overseas daily rows are unavailable. Input cutoff: Day ${esc(String(last.dayNumber))} (${esc(formatReleaseDate(last.reportDate))}).</p>`;
}

export function ramayanaFeatureHtml(pack: Pack): string {
  const ram = findRamayana(pack.films);
  if (!ram || ram.status === "closed") return "";
  const days = sortedDays(ram);
  const last = days[days.length - 1];
  const poster = localPoster(ram.poster, ram.posterKey || ram.id);
  return `
    <aside class="rama-feature" aria-label="Ramayana box office command centre">
      <a class="rama-feature-link" href="/ramayana/">
        <img class="rama-feature-poster" src="${esc(poster)}" alt="Ramayana poster" width="72" height="108" loading="lazy" />
        <div class="rama-feature-copy">
          <p class="kicker">Featured tracker</p>
          <h2>Ramayana Box Office</h2>
          <p>Day ${esc(String(ram.trackedThroughDay ?? last?.dayNumber ?? "—"))} live desk · India nett ${esc(formatCr(ram.indiaNet))} · Worldwide ${esc(formatCr(ram.worldwide))}</p>
          <span class="rama-feature-cta">Open command centre →</span>
        </div>
      </a>
    </aside>`;
}

export function renderRamayanaHubBody(pack: Pack): string | null {
  const ram = findRamayana(pack.films);
  if (!ram) return null;
  const days = sortedDays(ram);
  const last = days[days.length - 1] ?? null;
  const day1 = days.find((d) => d.dayNumber === 1) ?? null;
  const ledgerNet = ledgerIndiaNet(days);
  const ledgerGross = ledgerIndiaGross(days);
  const weekendNet = round2(
    days.filter((d) => d.dayNumber >= 1 && d.dayNumber <= 3).reduce((s, d) => s + (d.indiaNet || 0), 0),
  );
  const poster = localPoster(ram.poster, ram.posterKey || ram.id);
  const filmPage = `/movies/${ram.slug}/`;
  const through = ram.trackedThroughDay ?? last?.dayNumber ?? days.length;
  const comps = comparisonRows(ram, pack.films, Math.min(through, 7));
  const records = recordPanels(ram, pack.films, days);
  const freshnessHours =
    pack.generatedAt && Number.isFinite(Date.parse(pack.generatedAt))
      ? (Date.now() - Date.parse(pack.generatedAt)) / 3_600_000
      : null;
  const statusChip =
    freshnessHours != null && freshnessHours <= 6
      ? "LIVE TRACKING"
      : freshnessHours != null && freshnessHours <= 24
        ? "UPDATED"
        : "DATA DELAYED";

  const dailyNets = days.map((d) => d.indiaNet || 0);

  const dayRows = days
    .map((d, i) => {
      const prev = i > 0 ? days[i - 1] : null;
      const change =
        d.netChangePct != null
          ? formatPct(d.netChangePct)
          : prev && prev.indiaNet
            ? formatPct(((d.indiaNet - prev.indiaNet) / prev.indiaNet) * 100)
            : "—";
      return `<tr>
        <td><strong>Day ${esc(String(d.dayNumber))}${d.dayNumber === 1 ? " (Opening)" : ""}</strong></td>
        <td>${esc(formatReleaseDate(d.reportDate))}</td>
        <td class="num">${esc(moneyCell(d.indiaNet, { allowZero: true }))}</td>
        <td class="num">${esc(moneyCell(d.indiaGross))}</td>
        <td class="num">—</td>
        <td class="num">—</td>
        <td class="num">${esc(formatInt(d.screens))}</td>
        <td class="num">${d.occupancy != null ? `${esc(String(d.occupancy))}%` : "—"}</td>
        <td class="num">${esc(change)}</td>
        <td>${d.dayNumber === through ? "Latest reported" : "Reported"}</td>
      </tr>`;
    })
    .join("\n");

  const compTable = comps
    .map(
      (c) => `<tr class="${c.slug === ram.slug ? "rama-self" : ""}">
        <td><a href="/movies/${esc(c.slug)}/">${esc(c.title)}</a></td>
        <td class="num">${esc(moneyCell(c.day1, { allowZero: true }))}</td>
        <td class="num">${esc(moneyCell(c.throughDay, { allowZero: true }))}</td>
        <td class="num">${esc(String(c.daysTracked))}</td>
      </tr>`,
    )
    .join("\n");

  return `
    <article class="rama-hub">
      <header class="rama-hero">
        <img class="rama-hero-poster" src="${esc(poster)}" alt="Ramayana theatrical poster" width="140" height="210" />
        <div>
          <p class="kicker">Command centre</p>
          <h1>Ramayana Box Office</h1>
          <p class="page-sub">Daily India and worldwide theatrical tracker — consensus desk estimates, not an official audit.</p>
          <p class="rama-meta">
            <span class="rama-chip">${esc(statusChip)}</span>
            <span>Theatrical Day ${esc(String(through))}</span>
            <span>Released ${esc(formatReleaseDate(ram.releaseDate))}</span>
            <span>Desk date ${esc(pack.deskDate)} (IST)</span>
          </p>
          <p class="updated">Last updated ${esc(pack.generatedAt)} · <a href="${esc(filmPage)}">Standard film page</a> · <a href="/about-methodology/">Methodology</a></p>
        </div>
      </header>

      <section class="rama-metrics" aria-label="Key collections">
        <div class="rama-metric"><span class="m-label">India nett (consensus)</span><strong>${esc(formatCr(ram.indiaNet))}</strong><span class="m-sub">Cumulative · estimated</span></div>
        <div class="rama-metric"><span class="m-label">India nett (day-wise sum)</span><strong>${esc(formatCr(ledgerNet))}</strong><span class="m-sub">Days 1–${esc(String(days.length))} ledger</span></div>
        <div class="rama-metric"><span class="m-label">India gross (ledger)</span><strong>${esc(formatCr(ledgerGross || ram.indiaGross))}</strong><span class="m-sub">Cumulative from daily gross</span></div>
        <div class="rama-metric"><span class="m-label">Overseas gross</span><strong>${esc(formatCr(ram.overseas))}</strong><span class="m-sub">Outside India · cumulative</span></div>
        <div class="rama-metric"><span class="m-label">Worldwide gross</span><strong>${esc(formatCr(ram.worldwide))}</strong><span class="m-sub">Consensus lifetime</span></div>
        <div class="rama-metric"><span class="m-label">Latest day India nett</span><strong>${esc(formatCr(ram.lastDayNet ?? last?.indiaNet))}</strong><span class="m-sub">Day ${esc(String(through))}</span></div>
      </section>
      ${
        Math.abs(ledgerNet - (ram.indiaNet || 0)) > 1
          ? `<p class="rama-note">Data note: consensus India nett (${esc(formatCr(ram.indiaNet))}) and the sum of published daily India nett rows (${esc(formatCr(ledgerNet))}) currently differ. Both are shown so readers can see the ledger and the lifetime consensus while day rows catch up. Milestone cards below use the day-wise ledger unless labelled consensus.</p>`
          : `<p class="rama-note">Trade collections are estimates. India nett and worldwide gross use different bases and are never interchangeable.</p>`
      }

      <section class="rama-today" id="today">
        <h2>Today at the box office</h2>
        <p class="rama-note">Latest reported theatrical day on this desk — not a live end-of-day final unless the day has closed in the source ledger.</p>
        <dl class="rama-today-grid">
          <div><dt>India nett (Day ${esc(String(through))})</dt><dd>${esc(formatCr(last?.indiaNet ?? ram.lastDayNet))}</dd></div>
          <div><dt>India gross (Day ${esc(String(through))})</dt><dd>${esc(moneyCell(last?.indiaGross))}</dd></div>
          <div><dt>Overseas (daily)</dt><dd>—</dd></div>
          <div><dt>Worldwide (daily)</dt><dd>—</dd></div>
          <div><dt>Shows (tracked sample)</dt><dd>${esc(formatInt(last?.screens))}</dd></div>
          <div><dt>Occupancy (tracked sample)</dt><dd>${last?.occupancy != null ? `${esc(String(last.occupancy))}%` : "—"}</dd></div>
          <div><dt>vs previous day</dt><dd>${esc(formatPct(last?.netChangePct))}</dd></div>
          <div><dt>Opening weekend (D1–3)</dt><dd>${esc(formatCr(weekendNet))}</dd></div>
        </dl>
        <p class="rama-note">Shows and occupancy are source-tracked samples for that day, not a claim of every screen in India. Advance-booking / all-India ticket counts are <strong>not reported</strong> on this desk yet — they are omitted rather than guessed.</p>
      </section>

      <section id="day-wise">
        <h2>Day-wise collection table</h2>
        <p>Daily India nett and gross from the consensus board. Overseas and worldwide daily columns stay <strong>—</strong> when the ledger does not publish them (never coerced to ₹0).</p>
        <div style="overflow-x:auto">
          <table class="rama-table">
            <thead>
              <tr>
                <th>Day</th><th>Date</th><th class="num">India nett</th><th class="num">India gross</th>
                <th class="num">Overseas</th><th class="num">Worldwide</th>
                <th class="num">Shows</th><th class="num">Occ.</th><th class="num">Change</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${dayRows}
              <tr class="rama-total">
                <td colspan="2"><strong>Ledger total (Days 1–${esc(String(days.length))})</strong></td>
                <td class="num"><strong>${esc(formatCr(ledgerNet))}</strong></td>
                <td class="num"><strong>${esc(formatCr(ledgerGross))}</strong></td>
                <td class="num">—</td>
                <td class="num">—</td>
                <td colspan="4"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="rama-charts" id="charts">
        <h2>Trends</h2>
        <div class="rama-chart-grid">
          <figure>
            <figcaption>Daily India nett (₹ Cr)</figcaption>
            ${sparkline(dailyNets) || "<p class='rama-note'>Need at least two days for a chart.</p>"}
          </figure>
          <figure>
            <figcaption>Cumulative India nett from daily ledger (₹ Cr)</figcaption>
            ${cumulativeLine(dailyNets) || "<p class='rama-note'>Need at least two days for a chart.</p>"}
          </figure>
        </div>
      </section>

      <section id="overseas">
        <h2>Overseas performance</h2>
        <p>Cumulative overseas gross on this desk: <strong>${esc(formatCr(ram.overseas))}</strong>. Worldwide consensus: <strong>${esc(formatCr(ram.worldwide))}</strong> (compatible with India gross ${esc(formatCr(ram.indiaGross || ledgerGross))} + overseas when both sides are present).</p>
        <p class="rama-note">Territory-level breakdown (NA, UK, Gulf, etc.) is <strong>not available</strong> in the current board export. This section will expand when reliable territory rows exist — we will not invent market splits.</p>
      </section>

      <section id="records">
        <h2>Records &amp; targets</h2>
        <p class="rama-note">Comparisons use films currently on the Indian Box Office desk with matching India nett day definitions. Labels are desk-working status, not studio claims.</p>
        <div class="rama-records">
          ${records
            .map(
              (r) => `<article class="rama-record">
              <p class="rama-chip">${esc(r.status)}</p>
              <h3>${esc(r.name)}</h3>
              <p>${esc(r.detail)}</p>
            </article>`,
            )
            .join("\n")}
        </div>
      </section>

      <section id="compare">
        <h2>Day-aligned comparison (India nett)</h2>
        <p>Same theatrical day window: Day 1 opening and cumulative India nett through Day ${esc(String(Math.min(through, 7)))} for films that publish day-wise rows on this desk.</p>
        <div style="overflow-x:auto">
          <table class="rama-table">
            <thead>
              <tr><th>Film</th><th class="num">Day 1</th><th class="num">Through Day ${esc(String(Math.min(through, 7)))}</th><th class="num">Days on ledger</th></tr>
            </thead>
            <tbody>${compTable}</tbody>
          </table>
        </div>
      </section>

      <section id="projections">
        <h2>Week 1 scenarios (desk estimates)</h2>
        ${projectionBlock(days)}
      </section>

      <section class="seo-prose" id="about-this-hub">
        <h2>How to read this hub</h2>
        <p>Indian Box Office is an independent consensus desk. Figures are weighted-median estimates across trade reports where available. There is still no official Indian theatrical auditor.</p>
        <ul>
          <li><strong>India nett</strong> — domestic after entertainment tax / GST conventions used by trade.</li>
          <li><strong>India gross</strong> — domestic before those deductions.</li>
          <li><strong>Overseas</strong> — outside India only.</li>
          <li><strong>Worldwide</strong> — lifetime consensus gross; daily worldwide is shown only when the ledger publishes it.</li>
        </ul>
        <p>Full film file with FAQ: <a href="${esc(filmPage)}">${esc(filmPage)}</a>. Corrections: <a href="/contact/">contact the desk</a>.</p>
      </section>
    </article>`;
}

export function ramayanaJsonLd(pack: Pack): unknown[] {
  const ram = findRamayana(pack.films);
  if (!ram) return [];
  const days = sortedDays(ram);
  const last = days[days.length - 1];
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Ramayana Box Office Collection — Day-wise India & Worldwide Tracker",
      url: `${SITE}/ramayana/`,
      description:
        "Ramayana box office command centre: day-wise India nett, worldwide gross, overseas totals, records and desk projections from Indian Box Office.",
      dateModified: pack.generatedAt,
      isPartOf: { "@type": "WebSite", name: "Indian Box Office", url: SITE },
      about: {
        "@type": "Movie",
        name: ram.title,
        datePublished: ram.releaseDate,
        image: `${SITE}${localPoster(ram.poster, ram.posterKey || ram.id)}`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is the Ramayana box office collection today?",
          acceptedAnswer: {
            "@type": "Answer",
            text: `Latest reported India nett on Day ${ram.trackedThroughDay ?? last?.dayNumber ?? "—"} is ${formatCr(ram.lastDayNet ?? last?.indiaNet)}. Cumulative consensus India nett is ${formatCr(ram.indiaNet)}; worldwide gross is ${formatCr(ram.worldwide)}.`,
          },
        },
        {
          "@type": "Question",
          name: "What is Ramayana worldwide box office collection?",
          acceptedAnswer: {
            "@type": "Answer",
            text: `The Indian Box Office consensus worldwide gross for Ramayana is ${formatCr(ram.worldwide)}, with overseas gross ${formatCr(ram.overseas)}.`,
          },
        },
        {
          "@type": "Question",
          name: "What was Ramayana Day 1 box office collection?",
          acceptedAnswer: {
            "@type": "Answer",
            text: days.find((d) => d.dayNumber === 1)
              ? `Ramayana collected ${formatCr(days.find((d) => d.dayNumber === 1)!.indiaNet)} India nett on Day 1.`
              : "Day 1 India nett is not yet on the desk ledger.",
          },
        },
      ],
    },
  ];
}
