(function () {
  const catalog = window.IBO_CATALOG;
  if (!catalog) {
    document.getElementById("status").textContent = "Catalogue failed to load.";
    return;
  }

  const films = catalog.films.map((f) => ({ ...f }));
  const logs = [];
  const headlines = [];

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

  async function scrapeWikipedia() {
    const url =
      "https://en.wikipedia.org/w/api.php?action=parse&page=List_of_Indian_films_of_2026&prop=wikitext&format=json&formatversion=2&origin=*";
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
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
      if (ww != null) {
        movie.worldwide = ww;
        movie.liveWiki = true;
        matched += 1;
      }
      if (showing && movie.status === "closed") movie.status = "playing";
    }
    logs.push(`wikipedia: ${matched} titles updated from the 2026 ranking`);
    headlines.unshift({
      sourceId: "wikipedia",
      title: "List of Indian films of 2026 — worldwide ranking",
      url: "https://en.wikipedia.org/wiki/List_of_Indian_films_of_2026",
      summary: `${matched} catalogue titles matched to the live Wikipedia table.`,
    });
  }

  async function scrapeRss(sourceId, rssUrl) {
    const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`;
    const res = await fetch(proxy);
    if (!res.ok) throw new Error(`${sourceId} HTTP ${res.status}`);
    const xml = await res.text();
    const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
    let n = 0;
    for (const item of items.slice(0, 8)) {
      const title = decodeXml((item.match(/<title>([\s\S]*?)<\/title>/i) ?? [])[1] ?? "");
      const linkRaw = decodeXml((item.match(/<link>([\s\S]*?)<\/link>/i) ?? [])[1] ?? "");
      const url = stripTags(linkRaw);
      const desc = stripTags(
        decodeXml((item.match(/<description>([\s\S]*?)<\/description>/i) ?? [])[1] ?? ""),
      ).slice(0, 280);
      if (!title || !url.startsWith("http")) continue;
      if (!/box office|collection|film|movie|cinema|toxic|dhurandhar/i.test(`${title} ${desc}`)) {
        continue;
      }
      headlines.push({ sourceId, title, url, summary: desc });
      n += 1;
    }
    logs.push(`${sourceId}: ${n} headlines`);
  }

  async function scrapeHungama() {
    const target = "https://www.bollywoodhungama.com/box-office-collections/worldwide/2026/";
    const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`);
    if (!res.ok) throw new Error(`Hungama HTTP ${res.status}`);
    const html = await res.text();
    const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
    let matched = 0;
    for (const row of rows) {
      const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => stripTags(m[1]));
      if (cells.length < 3) continue;
      const movie = matchMovie(cells[1] || cells[0]);
      if (!movie) continue;
      const ww = parseCr(cells[cells.length - 1]);
      if (ww != null && ww > 1) {
        movie.hungamaWw = ww;
        movie.worldwide = ww;
        matched += 1;
      }
    }
    if (!matched) throw new Error("Hungama table empty or blocked");
    logs.push(`hungama: ${matched} titles from the 2026 worldwide table`);
  }

  function stripTags(s) {
    return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  function decodeXml(s) {
    return s
      .replace(/<!\[CDATA\[/g, "")
      .replace(/\]\]>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .trim();
  }

  function render() {
    const today = deskDate();
    document.getElementById("desk-date").textContent = `${deskLong(today)} · IST`;
    const playing = films.filter((m) => m.status === "playing");
    const late = films.filter((m) => m.status === "late");
    const ranked = [...films].sort((a, b) => b.worldwide - a.worldwide);
    const ytdWw = films.reduce((a, m) => a + (m.worldwide || 0), 0);
    const ytdNet = films.reduce((a, m) => a + (m.indiaNet || 0), 0);

    document.getElementById("stats").innerHTML = [
      stat("Tracked worldwide", formatCrCompact(ytdWw)),
      stat("India net on file", formatCrCompact(ytdNet)),
      stat("Now playing", String(playing.length)),
      stat("Sources", String(catalog.sources.length)),
    ].join("");

    document.getElementById("now-grid").innerHTML = playing.map(card).join("") || empty("No live titles.");
    document.getElementById("late-grid").innerHTML = late.map(card).join("") || empty("No late-run titles.");
    document.getElementById("rank-body").innerHTML = ranked
      .map(
        (m, i) => `<tr class="${m.status === "playing" ? "live" : ""}">
        <td class="rank">${i + 1}</td>
        <td>${esc(m.title)}${m.status === "playing" ? '<span class="pill">Playing</span>' : ""}${m.liveWiki ? '<span class="pill">Wiki</span>' : ""}</td>
        <td>${esc(m.language)}</td>
        <td class="num">${esc(formatCr(m.indiaNet))}</td>
        <td class="num strong">${esc(formatCr(m.worldwide))}</td>
      </tr>`,
      )
      .join("");

    document.getElementById("wires-list").innerHTML =
      headlines
        .slice(0, 10)
        .map(
          (h) => `<li>
        <a href="${esc(h.url)}" target="_blank" rel="noopener noreferrer">${esc(h.title)}</a>
        <p>${esc(h.summary || h.sourceId)}</p>
      </li>`,
        )
        .join("") || `<li><p>No wires yet — pull live collections.</p></li>`;

    document.getElementById("source-grid").innerHTML = catalog.sources
      .map(
        (s) => `<article class="source">
        <h3>${s.homepage ? `<a href="${esc(s.homepage)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>` : esc(s.name)}</h3>
        <p class="meta">${esc(s.kind)} · weight ${esc(s.weight)}</p>
        <p>${esc(s.notes)}</p>
      </article>`,
      )
      .join("");
  }

  function stat(label, value) {
    return `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
  }

  function card(m) {
    const day = dayNumber(m.releaseDate);
    return `<article class="card">
      <p class="kicker">${esc(m.language)} · Day ${day}${m.status === "late" ? " · Late run" : ""}</p>
      <h3>${esc(m.title)}</h3>
      <p class="meta">${esc(m.director)} · ${esc(m.starring)}</p>
      <p class="synopsis">${esc(m.synopsis)}</p>
      <dl>
        <div><dt>India net</dt><dd>${esc(formatCr(m.indiaNet))}</dd></div>
        <div><dt>Worldwide</dt><dd>${esc(formatCr(m.worldwide))}</dd></div>
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

  async function pull() {
    const btn = document.getElementById("pull");
    const status = document.getElementById("status");
    btn.disabled = true;
    status.textContent = "Scraping Wikipedia, Hungama and the wires…";
    logs.length = 0;
    headlines.length = 0;
    const jobs = [
      ["wikipedia", scrapeWikipedia],
      ["hungama", scrapeHungama],
      ["etimes", () => scrapeRss("etimes", "https://timesofindia.indiatimes.com/rssfeeds/1081479906.cms")],
      ["express", () => scrapeRss("express", "https://www.thehindu.com/entertainment/movies/feeder/default.rss")],
    ];
    for (const [id, fn] of jobs) {
      try {
        await fn();
      } catch (err) {
        logs.push(`${id}: blocked — ${err instanceof Error ? err.message : "failed"}`);
      }
    }
    render();
    status.textContent = logs.join(" · ") || "Pull finished.";
    document.getElementById("live-badge").textContent = "Live scrape";
    btn.disabled = false;
  }

  document.getElementById("pull").addEventListener("click", pull);
  render();
  pull();
})();
