(function () {
  const catalog = window.IBO_CATALOG;
  if (!catalog) {
    document.getElementById("status").textContent = "Catalogue failed to load.";
    return;
  }

  const films = catalog.films.map((f) => ({ ...f }));
  const logs = [];
  const headlines = [...(catalog.headlines || [])];

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

  function renderHealth() {
    const el = document.getElementById("health-alert");
    const alerts = catalog.health?.alerts || [];
    if (!alerts.length) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = alerts.slice(0, 3).join(" · ");
    el.className = catalog.health?.hardFail ? "alert alert-hard" : "alert";
  }

  function renderChanges() {
    const list = document.getElementById("changes-list");
    const changes = catalog.changes || [];
    if (!changes.length) {
      list.innerHTML = `<li><p class="meta">No material moves vs ${esc(catalog.comparedTo || "the previous board")} yet — check after the next publish.</p></li>`;
      return;
    }
    list.innerHTML = changes
      .map((c) => {
        const cls = (c.deltaWw ?? 0) >= 0 ? "gain" : "loss";
        return `<li><span class="${cls}">${esc(c.text)}</span></li>`;
      })
      .join("");
  }

  function render() {
    const today = deskDate();
    document.getElementById("desk-date").textContent = `${deskLong(today)} · IST`;
    renderUpdated();
    renderHealth();
    renderChanges();

    const playing = films.filter((m) => m.status === "playing");
    const late = films.filter((m) => m.status === "late");
    const ranked = [...films].sort((a, b) => b.worldwide - a.worldwide);
    const ytdWw = films.reduce((a, m) => a + (m.worldwide || 0), 0);
    const ytdNet = films.reduce((a, m) => a + (m.indiaNet || 0), 0);

    document.getElementById("stats").innerHTML = [
      stat("Tracked worldwide", formatCrCompact(ytdWw)),
      stat("India net on file", formatCrCompact(ytdNet)),
      stat("Now playing", String(playing.length)),
      stat("Spine alerts", String((catalog.health?.alerts || []).length)),
    ].join("");

    document.getElementById("now-grid").innerHTML = playing.map(card).join("") || empty("No live titles.");
    document.getElementById("late-grid").innerHTML = late.map(card).join("") || empty("No late-run titles.");
    document.getElementById("rank-body").innerHTML = ranked
      .map(
        (m, i) => `<tr class="${m.status === "playing" ? "live" : ""}">
        <td class="rank">${i + 1}</td>
        <td>${esc(m.title)}${m.status === "playing" ? '<span class="pill">Playing</span>' : ""}${m.liveWiki ? '<span class="pill">Wiki</span>' : ""}${m.liveSources?.length ? `<span class="pill">${esc(m.liveSources.length)} src</span>` : ""}</td>
        <td>${esc(m.language)}</td>
        <td class="num">${esc(formatCr(m.indiaNet))}${deltaHtml(m.deltaNet)}</td>
        <td class="num strong">${esc(formatCr(m.worldwide))}${deltaHtml(m.deltaWw)}</td>
      </tr>`,
      )
      .join("");

    document.getElementById("wires-list").innerHTML =
      headlines
        .slice(0, 12)
        .map(
          (h) => `<li>
        <a href="${esc(h.url)}" target="_blank" rel="noopener noreferrer">${esc(h.title)}</a>
        <p>${esc(h.summary || h.sourceId)}</p>
      </li>`,
        )
        .join("") || `<li><p>No wires on this board yet.</p></li>`;

    document.getElementById("source-grid").innerHTML = catalog.sources
      .map((s) => {
        const spine = (catalog.spine || []).includes(s.id);
        const health = catalog.health?.spine?.[s.id];
        const healthNote = health
          ? health.ok
            ? " · live ok"
            : ` · failing ×${health.streakFail || 1}`
          : "";
        return `<article class="source">
        <h3>${s.homepage ? `<a href="${esc(s.homepage)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>` : esc(s.name)}</h3>
        <p class="meta">${esc(s.kind)} · weight ${esc(s.weight)}${spine ? " · spine" : ""}${esc(healthNote)}</p>
        <p>${esc(s.notes)}</p>
      </article>`;
      })
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

  function card(m) {
    const day = dayNumber(m.releaseDate);
    const src = m.liveSources?.length ? ` · ${m.liveSources.join("+")}` : "";
    return `<article class="card">
      <p class="kicker">${esc(m.language)} · Day ${day}${m.status === "late" ? " · Late run" : ""}${esc(src)}</p>
      <h3>${esc(m.title)}</h3>
      <p class="meta">${esc(m.director)} · ${esc(m.starring)}</p>
      <p class="synopsis">${esc(m.synopsis)}</p>
      <dl>
        <div><dt>India net</dt><dd>${esc(formatCr(m.indiaNet))}${deltaHtml(m.deltaNet)}</dd></div>
        <div><dt>Worldwide</dt><dd>${esc(formatCr(m.worldwide))}${deltaHtml(m.deltaWw)}</dd></div>
      </dl>
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
    const btn = document.getElementById("pull");
    const status = document.getElementById("status");
    btn.disabled = true;
    status.textContent = "Checking Wikipedia overlay…";
    logs.length = 0;
    try {
      await scrapeWikipedia();
    } catch (err) {
      logs.push(`wikipedia: blocked — ${err instanceof Error ? err.message : "failed"}`);
    }
    render();
    status.textContent = [ingestSummary(), ...logs].filter(Boolean).join(" · ");
    document.getElementById("live-badge").textContent =
      catalog.mode === "server-consensus" ? "Server consensus" : "Catalogue";
    btn.disabled = false;
  }

  document.getElementById("pull").addEventListener("click", overlayWiki);
  document.getElementById("live-badge").textContent =
    catalog.mode === "server-consensus" ? "Server consensus" : "Catalogue";
  document.getElementById("status").textContent = ingestSummary();
  render();
  overlayWiki();
})();
