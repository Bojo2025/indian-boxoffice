# Indian Box Office

Independent **consensus desk** for Indian theatrical collections. The site does not treat any one tracker as fact. It pulls Sacnilk, Koimoi, Bollywood Hungama, Box Office India, Pinkvilla, Indian Express, ETimes and Wikipedia, then publishes a weighted-median consensus, source spread, a daily report, and a desk analyst.

This repository **is** the complete website. Clone it, install, run.

## Requirements

- **Node.js 22+**
- npm (comes with Node)

## Run locally

```bash
git clone <this-repo>
cd indian-box-office
npm install
npm run dev
```

Open [http://localhost:8080](http://localhost:8080).

That is the whole app: Pulse, Now playing, 2026 rankings, Catalogue, film files, Daily report, Desk, Wires, Sources, Download.

### Desk analyst (optional)

Copy `env.example` to `.env` and add an [xAI](https://console.x.ai) key:

```
XAI_API_KEY=xai-...
```

Restart `npm run dev`. Without a key the rest of the site still runs; Desk and AI daily-report generation return a quiet unavailable state.

Optional, for the Download page GitHub button:

```
VITE_GITHUB_REPO=https://github.com/<you>/indian-box-office
```

### Production database (optional locally, recommended on Vercel)

With no `DATABASE_URL`, the app uses **PGLite** (Postgres compiled to WASM) in memory. Fine for local work. For a durable deploy, set a Neon / Postgres URL:

```
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
```

Then `npm run db:migrate` against that database. Serverless hosts should not rely on in-memory PGLite.

## Deploy (Vercel)

1. Push this repository to GitHub.
2. Import the repo in [Vercel](https://vercel.com/new). Framework: Vite. Build command: `npm run build`.
3. Set `DATABASE_URL` (Neon) and optionally `XAI_API_KEY` and `VITE_GITHUB_REPO`.
4. Deploy.

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs `npm ci` and `npm run typecheck` on push.

## What’s in the product

| Route | What it is |
|---|---|
| `/` Pulse | Lead film, live scrape, year board, daily report excerpt, wires |
| `/now` | Films still in theatres, hold / last-day net |
| `/rankings` | 2026 worldwide board with India net |
| `/movies` | Full catalogue |
| `/movies/$slug` | Film file: day-wise curve, source spread, budget recovery, territories |
| `/report` | Daily desk report |
| `/desk` | Analyst bot (Grok) over the live snapshot |
| `/wires` | Ingested headlines + scrape log |
| `/sources` | Methodology and tracker weights |
| `/download` | CSV / JSON / HTML snapshots of the board |

## How the data works

India has **no official theatrical auditor**. Every published number is an estimate. This desk’s job is to show the spread, not to launder one tracker into “the” figure.

### Pipeline

1. **`src/lib/boxoffice/catalog.ts`** — films, budgets, source weights, seeded day-wise series.
2. **`src/lib/boxoffice/scrape.ts`** — live pull: Wikipedia REST, Times of India / Hindu RSS, Hungama and Sacnilk pages where they answer. Many trade sites bot-wall anonymous scrapers; those misses are logged on Wires, not invented.
3. **`src/lib/boxoffice/ingest.ts`** — writes readings, rebuilds consensus, stores headlines. Stale window is 20 minutes; Pulse has a manual “pull live” as well.
4. **`src/lib/boxoffice/consensus.ts`** — weighted median per day. Sacnilk 1.0, Koimoi 0.92, Box Office India 0.9, Hungama 0.88, newsrooms lower, producer statements 0.35 and never sole consensus.
5. **`src/lib/boxoffice/seed.ts`** — if `movies` is empty, loads the catalogue so the board is never blank.
6. **`src/lib/boxoffice/analyst.ts`** — desk bot + daily report via `XAI_API_KEY` (`grok-4.5`), prompt-hashed and cached in `analyses`.

### Add a film

1. Append an entry to `MOVIES` in `src/lib/boxoffice/catalog.ts` (id, slug, language, budget, release date, posterKey).
2. Drop artwork at `public/posters/{posterKey}.jpg`, or run `npm run posters` for a desk SVG stand-in.
3. Add day-wise or lifetime points to `SERIES` in the same file (one series per source).
4. Restart the dev server (PGLite is in-memory; a restart reseeds). On Neon, upsert happens on the next request for catalogue rows; readings only seed when the table was empty — add them via scrape or a one-off SQL insert.

### Add a tracker

1. Add a row to `SOURCES` in `catalog.ts` with a weight between 0 and 1.
2. Teach `scrape.ts` how to fetch it. Prefer RSS / JSON / documented APIs over HTML. Respect robots.txt, throttle, and **attribute every figure**.
3. Do not present a producer statement as consensus.

### Schema

`migrations/0002_boxoffice.sql`

- `sources` — tracker metadata + weight
- `movies` — titles
- `readings` — one row per film × source × date
- `consensus_days` — desk figure per film × date, plus `disagreement_pct`
- `territory_splits` — language / circuit cuts
- `news_items` — wires
- `reports` — daily desk copy
- `analyses` — cached bot answers
- `ingest_log` — scrape health

## Stack

- React 19 + TanStack Start / Router / Query
- Tailwind v4 (tokens in `src/styles.css`)
- Postgres via Neon, or PGLite when `DATABASE_URL` is unset
- Recharts on film files
- Vite 8, Nitro (Vercel preset)

Useful commands:

```bash
npm run dev          # http://localhost:8080
npm run typecheck
npm run build
npm run db:migrate
npm run posters      # SVG stand-ins for titles without a .jpg
```

Path alias: `@/` → `src/`.

## Project map

```
src/routes/                 pages + /api/ingest + /api/desk-file
src/components/layout/      masthead / shell
src/components/boxoffice/   posters, charts, spread bar, report body
src/lib/boxoffice/          catalog, scrape, ingest, consensus, queries, analyst
src/lib/db.ts               Neon / PGLite
migrations/                 SQL
public/posters/             film art
scripts/                    env wrapper, migrate, pglite assets
```

This repo was first built on Grok App Builder. Leave `scripts/grok-pwa-plugin.mjs`, `scripts/with-app-env.mjs` and `src/components/preview-host-bridge.tsx` in place — Vite is wired to them. They do not block local or Vercel deploys.

## Legal / editorial

- Attribute every source. The desk publishes a **consensus**, not owned box-office data.
- Do not scrape behind logins or paywalls. If a site blocks the fetch, log it and move on.
- Producer / studio claims are claims. They stay on the spread bar.
- Figures are in **₹ crore**. India nett for domestic, worldwide gross for global.

## What to build next

1. Hardened parsers for Sacnilk / Koimoi / Hungama day-wise tables (they change markup).
2. A cron (Vercel cron → `GET /api/ingest`) so production pulls on a schedule.
3. Language-wise occupancy from ticket sites, kept as a separate table — never mixed into nett.
4. Historical 2024–2025 catalogue so 2026 has a baseline.
5. Neon in production + a small admin upsert for a new release Friday.

Start at `src/lib/boxoffice/catalog.ts` and `src/lib/boxoffice/scrape.ts`.
