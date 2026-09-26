# First SEO Change Plan for indian-boxoffice.com

## Goal
Improve Google visibility and rankings by fixing indexability, content depth, and site structure for box-office queries.

---

## 1) Highest-Impact Structural Fixes

### 1.1 Create real movie URLs
- Replace hash-only detail targets (`#film-...`) with indexable URLs:
  - `/movies/hanuman-ansh`
  - `/movies/mirzapur-the-movie`
  - `/movies/resident-evil`
- Keep hash navigation only as UX fallback, not primary URL structure.

### 1.2 Add dedicated per-movie pages
Each movie page must include:
- Movie title (H1)
- Release date
- Cast
- Poster
- Synopsis/description
- India net
- Worldwide gross
- Day-wise collection table (Day 1, Day 2, ...)
- Verdict / rating section

### 1.3 Internal linking updates
- Homepage top-5 list -> movie pages
- Now in theatres cards -> movie pages
- Rankings table titles -> movie pages

---

## 2) Metadata and Schema Enhancements

### 2.1 Per-page SEO metadata
For every movie page:
- Unique `<title>`
- Unique `<meta name="description">`
- `<link rel="canonical">`
- Open Graph tags
- Twitter card tags

### 2.2 Structured data
- Add `Movie` JSON-LD on each movie page
- Keep `WebSite` / `CollectionPage` / `FAQPage` on homepage
- Keep `ItemList` for rankings

---

## 3) Sitemap and Crawlability

### 3.1 Expand sitemap
- Include:
  - homepage
  - every `/movies/<slug>` page
  - rankings page(s)
  - language pages
- Add accurate `lastmod` values.

### 3.2 Keep crawl signals clean
- `robots.txt` should continue allowing crawl.
- Ensure no accidental `noindex` on key pages.
- Keep canonical tags self-referential and correct.

---

## 4) Content Expansion for Long-Tail Queries

### 4.1 Add indexable pages beyond homepage
- `/rankings/2026`
- `/languages/hindi-box-office`
- `/languages/tamil-box-office`
- `/languages/telugu-box-office`
- `/about-methodology`

### 4.2 Target searchable query patterns
Optimize pages for terms like:
- `[movie] box office collection day 7`
- `[movie] india net collection`
- `[movie] worldwide gross`
- `highest grossing indian films 2026`

---

## 5) Authority and Trust Signals

### 5.1 Editorial trust page
- Explain methodology:
  - weighted-median consensus
  - no official India auditor
  - update cadence
- Clarify data definitions:
  - India net vs India gross vs worldwide gross

### 5.2 Brand consistency
- Keep “Indian Box Office” naming consistent across title tags, schema, and social profiles.
- Keep publisher attribution visible and consistent.

---

## 6) Measurement and Monitoring

### 6.1 Google Search Console workflow
- Verify domain property
- Submit sitemap
- Inspect URLs and request indexing
- Monitor:
  - indexing coverage
  - impressions/clicks/CTR
  - query-level performance
  - crawl status and errors

### 6.2 Weekly KPI review
Track weekly:
- Number of indexed pages
- Impressions for long-tail movie queries
- Average position by query cluster
- Click-through rate
- Top gaining/losing pages

---

## 7) Execution Priority (Order)

1. Real movie URLs + movie pages  
2. Per-page metadata + Movie schema  
3. Sitemap expansion  
4. Internal linking improvements  
5. Supporting pages (rankings/language/methodology)  
6. Search Console indexing loop + weekly KPI iteration

---

## Expected Outcome

### Short term (2-6 weeks)
- Better indexing coverage
- More impressions on long-tail movie queries

### Mid term (2-4 months)
- Stronger rankings for movie-specific box office searches
- Better domain authority signals for broader terms
