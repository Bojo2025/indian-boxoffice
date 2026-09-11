(function () {
  const catalog = window.IBO_CATALOG;
  if (!catalog) {
    document.getElementById("updated-line").textContent = "Catalogue failed to load.";
    return;
  }

  const films = catalog.films.map((f) => ({ ...f }));
  const logs = [];

  const IST = "Asia/Kolkata";

  function deskDate(d = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: IST,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }

  function deskLong(iso) {
    const d = new Date(`${iso}T12:00:00+05:30`);
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: IST,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  }

  function dayNumber(releaseDate) {
    const a = Date.parse(`${releaseDate}T12:00:00+05:30`);
    const b = Date.parse(`${deskDate()}T12:00:00+05:30`);
    return Math.max(1, Math.floor((b - a) / 86400000) + 1);
  }

  function formatCr(value) {
    if (value == null || Number.isNaN(value)) return "—";
    const abs = Math.abs(value);
    const formatted = abs.toLocaleString("en-IN", {
      minimumFractionDigits: abs >= 100 ? 1 : 2,
      maximumFractionDigits: abs >= 100 ? 1 : 2,
    });
    return `₹${formatted} Cr`;
  }

  function formatCrCompact(value) {
    if (value == null || Number.isNaN(value)) return "—";
    const abs = Math.abs(value);
    if (abs >= 100) {
      return `₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`;
    }
    return `₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} Cr`;
  }

  function formatDelta(value) {
    if (value == null || Number.isNaN(value) || Math.abs(value) < 0.05) return null;
    const sign = value > 0 ? "+" : "−";
    const abs = Math.abs(value);
    const formatted = abs.toLocaleString("en-IN", {
      minimumFractionDigits: abs >= 10 ? 1 : 2,
      maximumFractionDigits: abs >= 10 ? 1 : 2,
    });
    return `${sign}₹${formatted} Cr`;
  }

  function parseCr(raw) {
    if (!raw) return null;
    const cleaned = String(raw).replace(/,/g, "").replace(/[^\d.]/g, "");
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  function foldTitle(s) {
    return s
      .toLowerCase()
      .replace(/[:'’.]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function matchMovie(title) {
    const f = foldTitle(title);
    let best = null;
    for (const m of films) {
      const mf = foldTitle(m.title);
      if (mf === f) return m;
      if (mf.length > 2 && (f.includes(mf) || (mf.length >= 8 && mf.includes(f)))) {
        if (!best || mf.length > foldTitle(best.title).length) best = m;
      }
    }
    return best;
  }

  function wikiAmountToCr(raw) {
    const range = raw.match(/([\d,.]+)\s*[–-]\s*([\d,.]+)/);
    if (range) {
      const a = parseCr(range[1]);
      const b = parseCr(range[2]);
      if (a != null && b != null) return Math.round(((a + b) / 2) * 100) / 100;
    }
    return parseCr(raw);
  }

  async function fetchWithTimeout(url, timeoutMs = 12000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  async function scrapeWikipedia() {
    const url =
      "https://en.wikipedia.org/w/api.php?action=parse&page=List_of_Indian_films_of_2026&prop=wikitext&format=json&formatversion=2&origin=*";
    const res = await fetchWithTimeout(url);
    const json = await res.json();
    const wikitext = json.parse?.wikitext ?? "";
    const chunks = wikitext.split(/\n\|-/).slice(1);
    let matched = 0;
    for (const chunk of chunks) {
      if (!chunk.includes("[[") || !/INR\|/.test(chunk)) continue;
      const titleMatch = chunk.match(/'{2,3}\[\[([^\]]+)\]\]'{2,3}/);
      if (!titleMatch) continue;
      const title = titleMatch[1].split("|").pop() ?? titleMatch[1];
      const movie = matchMovie(title);
      if (!movie) continue;
      const amount = (chunk.match(/INR\|([^}]+)/) ?? [])[1]?.trim() ?? "";
      const ww = wikiAmountToCr(amount);
      const showing = /#b6fcb6|currently showing/i.test(chunk);
      if (ww != null && ww > (movie.worldwide || 0)) {
        movie.worldwide = ww;
        movie.liveWiki = true;
        matched += 1;
      }
      if (showing && movie.status === "closed") movie.status = "playing";
    }
    logs.push(`wikipedia overlay: ${matched} titles`);
  }

  function boardStampLocal() {
    if (!catalog.generatedAt) return "";
    try {
      return new Date(catalog.generatedAt).toLocaleString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return catalog.generatedAt;
    }
  }

  function boardStampIst() {
    if (!catalog.generatedAt) return "";
    try {
      return new Date(catalog.generatedAt).toLocaleString("en-GB", {
        timeZone: IST,
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return catalog.generatedAt;
    }
  }

  function ingestSummary() {
    const rows = catalog.logs || [];
    if (!rows.length) return "Seed catalogue only.";
    const ok = rows.filter((l) => l.status === "ok").map((l) => l.sourceId);
    const blocked = rows.filter((l) => l.status !== "ok").map((l) => l.sourceId);
    const unique = (xs) => [...new Set(xs)];
    const parts = [];
    if (ok.length) parts.push(`trade ok: ${unique(ok).join(", ")}`);
    if (blocked.length) parts.push(`missed: ${unique(blocked).join(", ")}`);
    return parts.join(" · ") || "Publish finished.";
  }

  function renderUpdated() {
    const local = boardStampLocal();
    const ist = boardStampIst();
    const compared = catalog.comparedTo ? ` · vs ${catalog.comparedTo}` : "";
    document.getElementById("updated-line").textContent = local
      ? `Last updated ${local} (your time) · ${ist} IST${compared}`
      : "Board timestamp unavailable";
  }

  function clip(text, max) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return "";
    if (t.length <= max) return t;
    const cut = t.slice(0, max);
    const sp = cut.lastIndexOf(" ");
    return `${(sp > 40 ? cut.slice(0, sp) : cut).trim()}…`;
  }

  function renderBrief(brief) {
    const box = document.getElementById("brief");
    const modal = document.getElementById("brief-modal");
    const teaser = document.getElementById("brief-teaser");
    if (!brief || !brief.headline || !box || !modal || !teaser) return;

    const briefMs = new Date(brief.generatedAt).getTime();
    if (!Number.isFinite(briefMs) || (Date.now() - briefMs) / 86400000 > 1.5) return;

    const fullText = [brief.lede, brief.body].filter(Boolean).join(" ").trim();
    const preview = clip(fullText || brief.headline, 120);

    document.getElementById("brief-headline").textContent = brief.headline;
    document.getElementById("brief-preview").textContent = preview;
    document.getElementById("brief-modal-headline").textContent = brief.headline;
    document.getElementById("brief-lede").textContent = brief.lede || "";

    const bodyEl = document.getElementById("brief-body");
    bodyEl.innerHTML = (brief.body || "")
      .split(/\n\n+/)
      .filter(Boolean)
      .map((p) => `<p>${esc(p.trim())}</p>`)
      .join("");

    const citeEl = document.getElementById("brief-citations");
    if (brief.citations && brief.citations.length) {
      citeEl.style.display = "";
      citeEl.innerHTML = brief.citations
        .map(
          (c) =>
            `<li><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.title || c.url)}</a></li>`,
        )
        .join("");
    } else {
      citeEl.innerHTML = "";
      citeEl.style.display = "none";
    }

    const stampEl = document.getElementById("brief-stamp");
    try {
      stampEl.textContent = `Generated ${new Date(brief.generatedAt).toLocaleString("en-GB", {
        timeZone: "Indian/Mauritius",
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })} (Mauritius)`;
    } catch {
      stampEl.textContent = brief.generatedAt;
    }

    function openBrief() {
      if (typeof modal.showModal === "function") modal.showModal();
      else modal.setAttribute("open", "");
      history.replaceState(null, "", "#brief");
    }

    function closeBrief() {
      if (typeof modal.close === "function" && modal.open) modal.close();
      else modal.removeAttribute("open");
      if (location.hash === "#brief") history.replaceState(null, "", " ");
    }

    teaser.onclick = (e) => {
      e.preventDefault();
      openBrief();
    };

    modal.addEventListener("close", () => {
      if (location.hash === "#brief") history.replaceState(null, "", " ");
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeBrief();
    });

    document.querySelectorAll('a[href="#brief"]').forEach((a) => {
      a.onclick = (e) => {
        e.preventDefault();
        openBrief();
      };
    });

    box.style.display = "flex";
    if (location.hash === "#brief") openBrief();
  }

  async function loadBrief() {
    let brief = catalog.morningBrief || null;
    try {
      const res = await fetch(`./morning-brief.json?v=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const remote = await res.json();
        if (remote?.headline) brief = remote;
      }
    } catch {
      /* keep catalog fallback */
    }
    renderBrief(brief);
  }

  function render() {
    renderUpdated();

    const momentumRanked = [...films]
      .filter((m) => (m.status === "playing" || m.status === "late") && m.lastDayNet > 0)
      .sort((a, b) => (b.lastDayNet || 0) - (a.lastDayNet || 0));
    const momentumIds = new Set(momentumRanked.map((m) => m.id));
    const playing = films.filter((m) => m.status === "playing");
    const late = films.filter((m) => m.status === "late" && !momentumIds.has(m.id));
    const now = [...momentumRanked, ...playing.filter((m) => !momentumIds.has(m.id))];
    const ranked = [...films].sort((a, b) => b.worldwide - a.worldwide);

    // Put current daily momentum ahead of lifetime totals on the weekly board.
    const weekPool = films.filter((m) => m.status === "playing" || m.status === "late");
    const weekRanked = [...weekPool].sort(
      (a, b) => (b.lastDayNet || 0) - (a.lastDayNet || 0) || (b.worldwide || 0) - (a.worldwide || 0),
    );
    const weekBoard = document.getElementById("week-board");
    weekBoard.innerHTML =
      weekRanked
        .slice(0, 5)
        .map(
          (m, i) => `<li>
            <span class="week-rank">${i + 1}</span>
            <span class="week-title">${esc(m.title)}</span>
            <span class="week-gross">
              <strong>${esc(formatCrCompact(m.worldwide))}</strong>
              <em>WW</em>
              <span>${esc(formatCrCompact(m.indiaNet))} net</span>
            </span>
          </li>`,
        )
        .join("") || `<li class="week-empty">No theatrical titles on the board.</li>`;

    document.getElementById("now-grid").innerHTML = now.map(card).join("") || empty("No live titles.");
    document.getElementById("late-grid").innerHTML = late.map(card).join("") || empty("No late-run titles.");
    document.getElementById("rank-body").innerHTML = ranked
      .map(
        (m, i) => `<tr class="${m.status === "playing" ? "live" : ""}">
        <td class="rank">${i + 1}</td>
        <td class="title-cell">
          <img class="poster-thumb" src="${esc(posterSrc(m))}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${esc(posterFallback(m))}'" />
          <span>${esc(m.title)}${m.status === "playing" ? '<span class="pill">Playing</span>' : ""}${m.liveWiki ? '<span class="pill">Wiki</span>' : ""}</span>
        </td>
        <td>${esc(m.language)}</td>
        <td class="num">${esc(formatCr(m.indiaNet))}${deltaHtml(m.deltaNet)}</td>
        <td class="num strong">${esc(formatCr(m.worldwide))}${deltaHtml(m.deltaWw)}</td>
      </tr>`,
      )
      .join("");

  }

  function deltaHtml(value) {
    const text = formatDelta(value);
    if (!text) return "";
    const cls = value >= 0 ? "gain" : "loss";
    return `<div class="delta ${cls}">${esc(text)}</div>`;
  }

  function stat(label, value) {
    return `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
  }

  function posterSrc(m) {
    if (m.poster) return m.poster;
    const key = m.posterKey || m.id;
    return `./posters/${key}.jpg`;
  }

  function posterFallback(m) {
    const key = m.posterKey || m.id;
    return `./posters/${key}.svg`;
  }

  function card(m) {
    const day = dayNumber(m.releaseDate);
    const src = m.liveSources?.length ? ` · ${m.liveSources.join("+")}` : "";
    const img = posterSrc(m);
    const fallback = posterFallback(m);
    return `<article class="card">
      <div class="poster-wrap">
        <img class="poster" src="${esc(img)}" alt="${esc(m.title)} poster" loading="lazy" onerror="this.onerror=null;this.src='${esc(fallback)}'" />
      </div>
      <div class="card-body">
        <p class="kicker">${esc(m.language)} · Day ${day}${m.status === "late" ? " · Late run" : ""}${esc(src)}</p>
        <h3>${esc(m.title)}</h3>
        <p class="meta">${esc(m.director)} · ${esc(m.starring)}</p>
        <p class="synopsis">${esc(m.synopsis)}</p>
        <dl>
          <div><dt>India net</dt><dd>${esc(formatCr(m.indiaNet))}${deltaHtml(m.deltaNet)}</dd></div>
          <div><dt>Worldwide</dt><dd>${esc(formatCr(m.worldwide))}${deltaHtml(m.deltaWw)}</dd></div>
        </dl>
      </div>
    </article>`;
  }

  function empty(text) {
    return `<p class="meta">${esc(text)}</p>`;
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function overlayWiki() {
    logs.length = 0;
    try {
      await scrapeWikipedia();
    } catch (err) {
      logs.push(`wikipedia: blocked — ${err instanceof Error ? err.message : "failed"}`);
    }
    render();
  }

  loadBrief();
  render();
  overlayWiki();
})();
