# Handoffs — indian-boxoffice.com

**Last updated:** 27 Oct 2026  
**Companion docs:** `GITHUB-CLI-WEBSITE.md` (CLI ship loop) · `firstchange.md` / `secondchange.md` (original SEO plans)

Use this file to resume work in a new Cursor chat without re-discovering the project.

---

## 1. What this project is

| | |
|---|---|
| **Site** | https://indian-boxoffice.com |
| **Repo** | https://github.com/Bojo2025/indian-boxoffice |
| **Local path** | `/Users/kevin/Projects/composer2/indian-boxoffice/indian-box-office` |
| **Hosting** | GitHub Pages from the `docs/` folder on `main` |
| **Owner** | Kevin Boyjonauth (`Bojo2025`) |
| **Product** | Independent day-by-day Indian theatrical box office consensus desk |

**Differentiator to protect in copy/SEO:** day-by-day India nett / worldwide tracking (Day 1 → closing), not just lifetime totals.

---

## 2. Hard constraints (do not break)

1. **Zero paid APIs** for collection data (scrapers + consensus only).
2. **`box.zip` is untracked — never commit it.**
3. **Developer credit** must stay: `Developed by Mr Kevin Boyjonauth`.
4. **Never name Sacnilk / Koimoi / Hungama / BOI** in visitor-facing copy (briefs, movie pages, homepage).
5. Prefer **PR → squash-merge** to `main` (desk bot also commits to `main` every ~3h).
6. Durable site changes go in **generators** (`scripts/`, `src/lib/`), not one-off edits to generated `docs/*.html` alone — the next `publish:desk` will overwrite them.

Full CLI recipes: see **`GITHUB-CLI-WEBSITE.md`**.

---

## 3. Architecture (mental model)

```text
src/lib/boxoffice/     → catalog, scrape, consensus
scripts/publish-desk-board.mts → live ingest → docs/board.json + catalog.js
scripts/generate-seo-pages.mts → static HTML for movies/hubs/briefs/sitemap/feed
scripts/generate-morning-brief.mts → morning brief JSON + /brief/
docs/                  → THE PUBLIC SITE (GitHub Pages root)
.github/workflows/publish-desk.yml → every 3h board + daily morning brief
```

**Ship loop:** edit generators → `npm run seo:pages` / `publish:desk` → PR → squash-merge → Pages deploy → verify with `curl`.

---

## 4. What has already shipped

### SEO foundation (`firstchange.md` / `secondchange.md` → PR #17 era)
- Indexable `/movies/<slug>/` pages with Movie + FAQ + Breadcrumb JSON-LD
- Homepage static HTML pre-render (bypass Google WRS delay)
- `/brief/` + `/briefs/YYYY-MM-DD/` with `NewsArticle` schema
- `/rankings/2026/`, `/languages/*`, `/about-methodology/`
- Expanded `sitemap.xml` + `/feed.xml`
- Auto rebuild wired into publish desk + morning brief workflows

### Day-wise search focus (PR #18)
- Movie titles/meta/H1s aimed at “day wise / day by day collection”
- Milestone cards: Day 1, Opening Weekend, Week 1, Highest Single Day
- Hubs: `/daily-box-office/`, `/records/highest-day-1-collection-2026/`
- Homepage H1: **Day-by-Day Indian box office collection**

### Desk reliability (PR #19–#22)
- **Drishyam 3** catalog corrected to Hindi *The Conclusion* (2 Oct 2026), `playing`
- Discovery no longer swallows big openers matched to stale/closed stubs
- Sacnilk **HTTP 429** mitigated: retries + backoff, lower concurrency, playing titles scraped first
- Worldwide never left at ₹0 when India nett is live
- Morning brief: no public “desk health / tracker unreachable” copy; archive `brief.json` no longer overwrites fresher `morning-brief.json`

### Monetization (PR #23 + AdSense readiness pass)
- AdSense snippet live: `ca-pub-3635078997966836` on all generated pages + homepage
- `https://indian-boxoffice.com/ads.txt`
- `/privacy-policy/` (footer + sitemap)
- Site **verified** in AdSense; first review **rejected for Low-value content** (Nov 2026)
- Content upgrades for re-review: `/about/`, `/contact/` (`desk@indian-boxoffice.com`), `/editorial-policy/`, expanded methodology, substantial morning briefs (`deterministic-editorial-v2`), per-film analysis sections, `/briefs/` archive
- **Before re-requesting AdSense review:** set mailbox forwarding for `desk@indian-boxoffice.com`, wait for Google to recrawl, then check “I confirm…” only after the new pages are live

### Docs
- `GITHUB-CLI-WEBSITE.md` — how git / `gh` / npm manage the site from CLI (committed `f34de6d`)

---

## 5. Current live ops snapshot (as of handoff write)

| Check | Typical state |
|---|---|
| Desk publish | Scheduled every 3h; bot commits as `ibo-desk-bot` |
| Sacnilk | Usually OK (primary spine) |
| Hungama | Usually OK |
| Koimoi | Often **HTTP 403** (Cloudflare) — long fail streak; seed kept |
| BOI | Often **HTTP 403** — long fail streak |
| Morning brief | Regenerated on 04:00 UTC schedule (or `FORCE_BRIEF=1`) |

**Known scrape risk:** burst Sacnilk requests → 429; keep concurrency modest and retries intact in `src/lib/boxoffice/scrape.ts`.

---

## 6. Open / next work (priority order)

### A. AdSense (when approval email arrives)
1. Confirm site status in AdSense → Sites.
2. Enable Auto Ads carefully (anchor OK; leave vignettes/interstitials off at first).
3. Add **manual ad slots** in the generator (not hand-edited HTML):
   - Movie pages: after day-wise table; after FAQ
   - Homepage: after This Week board; after Now Playing
4. CSS class `.ad-slot` already reserved in `docs/styles.css`.
5. Optional: AdSense **Privacy & messaging** GDPR consent for EEA/UK.
6. Owner-only: bank details in AdSense Payments (not for agents).

### B. SEO / product
- Keep day-wise positioning; request indexing for new hubs after major publishes if GSC lags.
- When a major opener lands: ensure catalog status/`SACNILK_PAGES` entry + discovery path (don’t repeat closed-stub bug).
- Poster coverage still weak for many discovered titles (placeholder `hero-cinema`).

### C. Tracker resilience
- Koimoi / BOI 403: don’t expose in public copy; optionally improve fallbacks later without paid APIs.
- Watch `docs/health.json` / spine alerts after publishes.

### D. Process
- If PR conflicts with desk bot: `git fetch origin main && git merge origin/main` → `npm run seo:pages` → push → merge.
- Never force-push `main`.

---

## 7. Key URLs to verify after any ship

```text
https://indian-boxoffice.com/
https://indian-boxoffice.com/daily-box-office/
https://indian-boxoffice.com/movies/drishyam-3/
https://indian-boxoffice.com/brief/
https://indian-boxoffice.com/privacy-policy/
https://indian-boxoffice.com/ads.txt
https://indian-boxoffice.com/sitemap.xml
https://indian-boxoffice.com/feed.xml
https://indian-boxoffice.com/board.json
https://indian-boxoffice.com/health.json
```

Snippet check:

```bash
curl -sL https://indian-boxoffice.com/ | grep -o 'adsbygoogle.js?client=ca-pub-[0-9]*'
```

---

## 8. NPM commands cheat sheet

```bash
npm run publish:desk                 # scrape + write board + SEO pages
npm run morning:brief                # daily brief (skips if already exists for today)
FORCE_BRIEF=1 npm run morning:brief  # force rewrite brief
npm run seo:pages                    # regenerate static pages only
npm run typecheck
```

---

## 9. PR history worth knowing

| PR | Topic |
|---|---|
| #17 | Indexable movies, prerender, SEO velocity stack |
| #18 | Day-by-day hubs + movie page milestones |
| #19 | Drishyam live ingest / catalog fix |
| #20 | Morning brief regenerated with Drishyam |
| #21 | Strip desk-health jargon from brief |
| #22 | Sacnilk 429 retries + WW floor |
| #23 | AdSense verification + ads.txt + privacy |

---

## 10. One-line handoff

> **Generators own the site; `docs/` is the published artifact; ship via PR; protect day-by-day originality; AdSense code is live and awaiting Google review; next code task after approval is generator-based ad slots.**

For CLI step-by-step: open **`GITHUB-CLI-WEBSITE.md`**.
