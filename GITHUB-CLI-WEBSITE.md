# How the site is managed from the CLI

This note explains how Cursor (and you) connect to GitHub and ship changes to **indian-boxoffice.com** without touching the GitHub website UI.

---

## What is connected to what

| Piece | Value |
|---|---|
| Local project | `/Users/kevin/Projects/composer2/indian-boxoffice/indian-box-office` |
| Git remote | `https://github.com/Bojo2025/indian-boxoffice.git` |
| Live site | `https://indian-boxoffice.com` |
| Hosting | **GitHub Pages** |
| Published folder | `docs/` (every file under `docs/` is what visitors see) |
| Default branch | `main` |

GitHub Pages is configured to serve the `docs/` folder from `main`.  
So: **commit to `docs/` on `main` → Pages builds → site updates** (usually within ~30–60 seconds after the Pages deploy workflow finishes).

---

## Tools used on the CLI

### 1. `git` — source control

```bash
git status
git checkout -b feat/my-change
git add <files>
git commit -m "message"
git push -u origin HEAD
git checkout main
git pull origin main
```

### 2. `gh` (GitHub CLI) — PRs, merges, Actions

Authenticated against your GitHub account (`Bojo2025`). Typical commands:

```bash
# Create a pull request from the current branch
gh pr create --title "..." --body "..."

# Squash-merge into main and delete the remote branch
gh pr merge <number> --squash --delete-branch

# Watch the GitHub Pages deploy
gh run list -L 5 --workflow "pages-build-deployment"
gh run watch <run-id>

# Inspect a failed / scheduled desk publish
gh run list -L 10 --workflow "Publish desk board"
```

### 3. `npm` scripts — regenerate the site content

```bash
npm run publish:desk      # scrape trackers → docs/board.json + catalog.js + SEO pages
npm run morning:brief     # rewrite morning brief from the current board
FORCE_BRIEF=1 npm run morning:brief   # force regenerate even if today already exists
npm run seo:pages         # rebuild all static movie/hub/brief pages + sitemap + feed
npm run typecheck         # TypeScript check before shipping
```

### 4. `curl` — verify the live site after deploy

```bash
curl -sI https://indian-boxoffice.com/
curl -sL https://indian-boxoffice.com/ads.txt
curl -sL https://indian-boxoffice.com/board.json | head -c 200
curl -sL https://indian-boxoffice.com/ | grep -o 'adsbygoogle.js?client=ca-pub-[0-9]*'
```

---

## Standard ship workflow (what Cursor does)

Every feature or fix follows this loop so `main` stays clean and Pages only gets reviewed changes:

```text
1. git checkout -b feat/… or fix/…
2. Edit code / regenerate docs (npm run seo:pages or publish:desk)
3. git add … && git commit …
4. git push -u origin HEAD
5. gh pr create …
6. gh pr merge … --squash --delete-branch
7. git checkout main && git pull origin main
8. Wait for "pages build and deployment" → curl live URLs to confirm
```

### Why PRs instead of pushing straight to `main`?

- Keeps a reviewable history (squash merges stay readable).
- Avoids fighting the scheduled desk bot that also commits to `main` every few hours.
- If `main` moved while we worked, we `git fetch origin main && git merge origin/main`, resolve conflicts, regenerate `docs/`, push, then merge the PR.

### Important constraints Cursor follows

- Never force-push `main` / `master`.
- Never commit `box.zip` or `.env` secrets.
- Never skip git hooks (`--no-verify`) unless you explicitly ask.
- Developer credit (`Developed by Mr Kevin Boyjonauth`) stays intact.
- Tracker source names (Sacnilk / Koimoi / Hungama / BOI) stay out of visitor-facing copy.

---

## How the live website gets new data

Two paths update `docs/` on `main`:

### A. Manual / Cursor-driven (this CLI flow)

You (or Cursor) change generators or content, run `npm run seo:pages` / `publish:desk`, open a PR, merge.

### B. Automated (GitHub Actions)

Workflow: `.github/workflows/publish-desk.yml`

| Schedule | What it does |
|---|---|
| Every 3 hours | `npm run publish:desk` → refresh board, scrape trackers, rebuild SEO pages, commit if changed |
| 04:00 UTC daily | Also runs `npm run morning:brief` |
| Manual | `workflow_dispatch` from the Actions tab / `gh workflow run` |

The bot commits as:

```text
ibo-desk-bot <ibo-desk-bot@users.noreply.github.com>
Refresh Pages desk from Sacnilk/Koimoi/Hungama/BOI consensus.
```

That is why PRs sometimes need a merge from `origin/main` before they can squash-merge — the bot may have published new board data while the PR was open.

---

## Where key files live

| Path | Role |
|---|---|
| `docs/` | **The public site** (GitHub Pages root) |
| `docs/index.html` | Homepage |
| `docs/board.json` / `docs/catalog.js` | Live consensus data the front-end reads |
| `docs/movies/<slug>/` | Indexable per-movie pages |
| `docs/ads.txt` | AdSense authorized sellers |
| `docs/privacy-policy/` | Privacy policy (AdSense requirement) |
| `scripts/generate-seo-pages.mts` | Builds almost every static HTML page |
| `scripts/publish-desk-board.mts` | Live scrape + board publish |
| `scripts/generate-morning-brief.mts` | Morning brief text |
| `src/lib/boxoffice/` | Catalog, scrape, consensus logic |
| `.github/workflows/publish-desk.yml` | Scheduled desk publisher |

Edits that must survive the 3-hourly republish belong in **generators** (`scripts/…`, `src/lib/…`), not only in a one-off `docs/*.html` file — otherwise the next bot run can overwrite them.

---

## Auth: how CLI access works

On this machine:

1. **Git HTTPS** remote uses your GitHub credentials (credential helper / token already set up for `Bojo2025`).
2. **`gh` CLI** is logged in as the same account, so `gh pr create` / `gh pr merge` / `gh run …` work without opening github.com in a browser.
3. Cursor does **not** log into GitHub as a separate user — it runs the same `git` / `gh` commands in your project directory, with your existing auth.

Check yourself anytime:

```bash
gh auth status
git remote -v
gh repo view
```

---

## Quick recipes

### Ship a content / SEO / AdSense change

```bash
git checkout main && git pull
git checkout -b feat/whatever
# edit scripts/… or docs/…
npm run seo:pages
git add -A && git commit -m "feat: …"
git push -u origin HEAD
gh pr create --title "…" --body "…"
gh pr merge --squash --delete-branch
git checkout main && git pull
```

### Force a fresh board + brief right now

```bash
npm run publish:desk
FORCE_BRIEF=1 npm run morning:brief
# then commit/push via PR as above if you want it on main immediately
# (otherwise the next scheduled Action will publish eventually)
```

### Confirm Pages finished deploying

```bash
gh run list -L 3 --workflow "pages-build-deployment"
# when status is success:
curl -sI https://indian-boxoffice.com/ | head -5
```

### Recover when a PR conflicts with the desk bot

```bash
git fetch origin main
git merge origin/main
# resolve conflicts (often docs/*); prefer regenerating:
npm run seo:pages
git add docs/ && git commit -m "Merge main and regenerate"
git push
gh pr merge --squash --delete-branch
```

---

## One-line mental model

> **Edit generators → regenerate `docs/` → PR to `main` → GitHub Pages deploys → indian-boxoffice.com updates.**

That is how Cursor manages your website from the CLI.
