# Cursor Implementation Brief: Ramayana Box Office Command Centre
**Project:** Indian Box Office — https://indian-boxoffice.com/  
**Prepared:** 9 November 2026  
**Purpose:** Add a premium, data-rich Ramayana hub to the existing Indian Box Office website, make it the definitive destination on the site for Ramayana box-office information, and improve the site's ability to earn relevant search traffic and repeat visitors.

---

## 1. Instructions to Cursor AI

You are working inside an existing production website: **Indian Box Office** (`https://indian-boxoffice.com/`). This is an enhancement to the current application, not a request to rebuild the website from scratch.

### Your first task: inspect before changing anything

1. Inspect the entire repository and identify:
   - framework, build tool, routing approach and deployment target;
   - current page layout, navigation, design tokens, components and responsive breakpoints;
   - current data model and where film/box-office data comes from;
   - existing charts, tables, cards, filters, search, analytics and SEO implementation;
   - existing Ramayana film page and any existing daily collection/advance-booking data;
   - current sitemap, robots.txt, canonical URLs, metadata and structured data;
   - existing tests and build/deployment scripts.
2. Read the existing implementation before deciding how to integrate the new hub.
3. Reuse the existing stack, components, styling conventions and data pipeline wherever practical.
4. Do not replace working pages, delete current functionality, change the deployment process, or introduce a new backend/database without first establishing that it is necessary.
5. Do not fabricate live values, sources, ticket counts, show counts, occupancy, projections, release details, records or chart points.
6. Make the smallest coherent set of changes that delivers the requirements below.
7. After implementation, run the project's existing build, lint and tests. Fix regressions before finishing.

### Product goal

Create a dedicated **Ramayana Box Office** section that becomes the most useful, transparent and visually compelling place to follow the film's theatrical performance.

The hub should answer, at a glance:

- How much has Ramayana made in India today and cumulatively?
- What is its India net, India gross, overseas gross and worldwide gross?
- How is it performing in individual overseas territories?
- How many tickets have been sold, where and over what period?
- How many shows are listed, and what is occupancy?
- How does advance booking look for upcoming days?
- What is the likely end-of-day / weekend / first-week result, and how uncertain is that estimate?
- Which records has it broken, which records is it chasing, and what is the exact gap?
- How does it compare with films such as Dhurandhar 2, Pathaan, Pushpa 2 and other relevant benchmarks?
- Where did each number come from, and when was it last verified?

The section must be genuinely useful to film fans, researchers and casual search visitors—not a page filled with repeated keywords or unsupported claims.

---

## 2. Existing website context and initial audit notes

The live site currently presents itself as an independent day-by-day Indian box-office consensus desk, with daily charts, a morning brief, Now Playing, annual rankings, opening-day records and a methodology page.

The live Ramayana page currently resolves at:

`https://indian-boxoffice.com/movies/ramayana_part_1_2026/`

The homepage and Ramayana page expose useful existing functionality and data. Integrate with these rather than creating a disconnected microsite.

### Important data-quality audit to perform before launch

The publicly indexed Ramayana page snapshot inspected on 9 November 2026 showed some values that appear inconsistent across the page. For example, the cumulative headline, daily table, worldwide daily values and week totals did not obviously reconcile. Treat this as an audit requirement, not as proof that the underlying database is wrong.

Before adding new visualisations:

1. Identify the canonical source record for Ramayana.
2. Recalculate all cumulative totals from the underlying daily records.
3. Verify whether the displayed `Week 1 Total` is a completed seven-day total or a running total. Never label a partial period as a completed week.
4. Verify whether worldwide daily gross is missing, genuinely zero, or simply unavailable. **Unknown must not be rendered as ₹0.00.**
5. Confirm the difference between `India net`, `India gross`, `overseas gross` and `worldwide gross`.
6. Ensure the page's “latest day”, date, day number, update time and all chart/table values refer to the same data snapshot.
7. Add automated consistency checks (see Section 10).

Do not copy figures from this brief into production as live values. All numeric values must come from the application's verified data store and source records.

---

## 3. Information architecture and URLs

Create a clearly visible navigation entry named **Ramayana** or **Ramayana Box Office**. It should be prominent while the film is actively running, but must not permanently overwhelm the site's other sections after its theatrical run.

### Recommended routes

Use the site's existing routing conventions if they differ. Preferred information architecture:

- `/ramayana/` — main Ramayana Box Office Command Centre (primary SEO landing page)
- `/ramayana/india/` — India collections, daily trends, state/city/market breakdowns where reliable data exists
- `/ramayana/overseas/` — overseas collections and territory breakdown
- `/ramayana/advance-booking/` — ticket sales, gross, shows and occupancy
- `/ramayana/records/` — record tracker and comparisons
- `/ramayana/predictions/` — clearly labelled projections and scenarios
- `/ramayana/news/` — original updates and analysis, if the site has a sustainable editorial workflow

If the existing film detail route is already indexed and has links/backlinks, **do not delete or casually change it**. Either:
- make `/ramayana/` the main hub and link prominently to the existing film detail page; or
- choose one canonical URL and use a permanent redirect only after checking existing route and SEO implications.

Avoid creating thin pages merely to multiply URLs. If a subpage has insufficient unique content, keep it as a section on the main hub until it can stand on its own.

### Navigation and internal linking

- Add Ramayana to the main navigation with a clear label.
- Add a prominent Ramayana feature card to the homepage while the film is a current major release.
- Link from the existing Ramayana film page to the new hub and vice versa.
- Link to relevant comparison films and record pages.
- Add breadcrumbs to subpages.
- Include contextual links from daily charts, rankings and relevant articles.
- Ensure every important page is reachable through ordinary crawlable HTML links, not only JavaScript click handlers.

---

## 4. Main Ramayana hub: page layout

Build a premium editorial/data dashboard. It should feel like a professional box-office tracker: clean typography, excellent mobile usability, clear hierarchy, fast loading and charts that explain the numbers.

### 4.1 Hero / current status

At the top of `/ramayana/` show:

- Film title: **Ramayana**
- A short factual subtitle, such as “Daily India and worldwide theatrical box-office tracker”
- Current theatrical day number, only if the release date is verified
- Latest reporting date and time, with timezone
- A visible `Last updated` label
- A compact status chip such as `LIVE TRACKING`, `UPDATED`, `ESTIMATED` or `DATA DELAYED`, based on actual data freshness
- A small note that trade collections are estimates unless an audited official figure is available

Avoid unsupported marketing claims such as “number one source”, “official collection” or “all-time record” unless independently justified.

### 4.2 Key collection cards

Display these as separate cards, with consistent units and clear definitions:

1. **India Net**
2. **India Gross**
3. **Overseas Gross**
4. **Worldwide Gross**
5. **Tickets Sold** (only if a source actually reports ticket volume)
6. **Shows** (only if source coverage and definition are known)

For every metric:
- show the value;
- show currency and unit (e.g. `₹295.0 Cr`);
- show the reporting period (`Day 4`, `Monday`, `Cumulative`);
- show whether it is estimated, reported or calculated;
- show a tooltip/info icon with its definition;
- provide a source/updated-at link or source drawer.

Do not mix a daily figure with a cumulative figure in the same card without explicitly labelling the period.

### 4.3 Today's performance

Create a prominent “Today at the Box Office” module:

- India net today (if available)
- India gross today (if available)
- Overseas gross today (if available)
- Worldwide gross today (only when both domestic gross and overseas gross can be calculated reliably)
- Current advance-booking gross
- Tickets sold / booked
- Number of shows
- Occupancy percentage
- Day-over-day change
- Estimate for end-of-day, if modelled

Every value must display the timestamp and data status. For a day still in progress, say `Live estimate` or `So far`, not `Final collection`.

### 4.4 Day-wise collection table

Provide a sortable, mobile-friendly table:

| Column | Description |
|---|---|
| Day | Day 1, Day 2, etc. |
| Date | Local theatrical date |
| India net | Daily India net |
| India gross | Daily India gross |
| Overseas gross | Daily overseas gross |
| Worldwide gross | Daily worldwide gross |
| Tickets | Tickets sold, if sourced |
| Shows | Show count, if sourced |
| Occupancy | Occupancy, if sourced |
| Change | Change versus previous comparable day |
| Status | Live estimate / provisional / final / unavailable |

Requirements:
- Show cumulative totals in a separate row/column, not mixed into daily numbers.
- Allow users to switch between `Daily` and `Cumulative`.
- Provide a mobile card/list layout or horizontally scrollable table with sticky first column.
- Missing values must display `—` or `Not reported`, never zero.
- Include a downloadable CSV only if the underlying data is accurate and the export is useful.
- Include an explanatory note about the source and collection basis.

### 4.5 Charts and visualisations

Implement the following charts only when sufficient data exists:

1. **Daily India net trend** — line or column chart.
2. **Daily worldwide gross trend** — stacked columns for India gross + overseas gross, if comparable data exists.
3. **Cumulative worldwide gross** — line chart.
4. **Overseas territory breakdown** — bar chart or ranked list.
5. **Advance booking trend** — tickets and gross over time.
6. **Occupancy trend** — line chart by day, market or show-time if data supports it.
7. **Actual vs projection** — chart with a clear boundary between actual and forecast values.
8. **Comparison chart** — Ramayana versus selected benchmark films, aligned by theatrical day number (Day 1 with Day 1, etc.).

Chart requirements:
- Always label axes, currency, unit and time period.
- Provide accessible text summaries and keyboard-friendly controls.
- Use consistent chart scales when comparing films.
- Tooltips must show exact values, dates, source status and units.
- Do not draw fake smooth curves through sparse or missing data.
- Do not use a chart if it adds no insight; a simple table may be better.
- Include an accessible table or text equivalent for important chart data.
- Lazy-load below-the-fold chart code if this materially improves initial performance.

### 4.6 Overseas performance

Create a dedicated overseas module and `/ramayana/overseas/` page.

Show:
- Overseas cumulative gross
- Overseas daily gross
- Country/territory breakdown where available
- Territory ranking by gross
- Number of territories with reported data
- Reporting period and timestamp
- A map only if the data is geographically reliable and the map remains legible on mobile

Possible territories include North America, United Kingdom, Australia, Gulf / Middle East, New Zealand and other individual markets. Do not invent territory values or imply that a regional total is the sum of every market if some markets are missing.

For every territory, record:
- market name;
- currency as originally reported;
- converted INR amount, if conversion is required;
- exchange-rate date/source;
- gross/net basis if known;
- source;
- report timestamp;
- whether the number is partial or cumulative.

**Important:** “Overseas” excludes India. Do not use a provider's `International` field as overseas unless its definition is verified. Some box-office databases use `International` to mean all markets outside the United States, which may include India. The interface must state exactly what each provider's category means.

### 4.7 Ticket sales and advance booking

This is a high-interest feature and should be a major section, but only source-backed data may be shown.

Display where available:
- tickets sold / booked;
- advance-booking gross;
- number of shows;
- occupancy;
- seats available / booked, only if the source defines these;
- city or cinema-chain breakdown;
- language / format breakdown (Hindi, Tamil, Telugu, IMAX, etc.) only if the source provides it;
- day-wise booking curve;
- booking pace versus previous comparable films.

Distinguish:
- tickets sold from seats blocked;
- paid tickets from complimentary tickets;
- advance bookings from actual box-office collections;
- gross booking value from net collection;
- one platform's tracked inventory from the entire market.

Never label a partial sample as all-India ticket sales. If a source includes blocked seats, provide both figures if possible and label them prominently.

Recommended display:
- `Tickets booked (tracked sample)`
- `Advance gross (tracked sample)`
- `Shows tracked`
- `Occupancy (tracked sample)`
- `Last checked`

Add a clear methodology note describing source coverage and limitations.

### 4.8 Record tracker

Create a dynamic “Records & Targets” panel.

Possible comparisons:
- Highest single-day India net
- Highest opening-day India net
- Highest first weekend India net
- Highest first-week India net
- Highest overseas first week
- Highest worldwide opening weekend
- Highest worldwide first week
- Fastest film to reach selected cumulative milestones
- Highest ticket sales / advance booking, if definitions are comparable

For each record:
- record name;
- current record holder;
- record value;
- record date / day number;
- source;
- Ramayana's comparable value;
- gap to record;
- percentage of record reached;
- whether Ramayana has actually surpassed it.

Use consistent metrics and time windows. Do not compare:
- India net with India gross;
- overseas gross with worldwide gross;
- first three days with first four days;
- preview-inclusive with preview-exclusive totals;
- different currency conversion bases without disclosing them.

Record status labels:
- `HOLDING RECORD`
- `RECORD BROKEN`
- `WITHIN REACH`
- `NOT YET COMPARABLE`
- `INSUFFICIENT DATA`

A record should not be marked broken until the same metric and period are verified against a reliable source. Include a “How we compare records” explainer.

### 4.9 Film comparison centre

Allow users to compare Ramayana with 2–4 films, with sensible defaults such as Dhurandhar 2, Pathaan and Pushpa 2. The list must be configurable and the selected films must have comparable data.

Comparison modes:
- Same theatrical day (`Day 1` to `Day 1`, `Day 2` to `Day 2`)
- Opening weekend
- First 7 days
- Overseas first week
- Worldwide first week
- Highest single day
- Advance booking, only where the data definition and source coverage match

Show:
- aligned day-wise table;
- cumulative line chart;
- difference in rupees and percentage;
- source and data-quality note for each film.

Provide controls to include/exclude paid previews. If previews are included, show them as a separate line/row and do not silently fold them into Day 1.

### 4.10 Projections and predictions

Create a section named **Box Office Projections** or **Estimated Finish**, not “confirmed collection”.

Potential outputs:
- today's estimated India net;
- today's estimated worldwide gross;
- projected first-week total;
- projected second-week total;
- projected lifetime range;
- probability-free low / base / high scenarios unless a statistically defensible probability model exists.

Use transparent methods:
- booking pace;
- current occupancy;
- show count;
- historical weekday/weekend multipliers for comparable films;
- day-of-week effects;
- holidays and regional holidays, if verified;
- market-by-market overseas trend;
- capacity constraints and screen/show availability, if available.

Every projection must show:
- timestamp generated;
- input data cutoff;
- forecast horizon;
- methodology in plain language;
- low/base/high range;
- assumptions;
- confidence label (`Low`, `Medium`, `High`) based on data completeness and model validation.

Do not present an algorithmic estimate as a trade report or official number. Do not claim certainty. Do not show a precise-looking forecast when inputs are weak.

### 4.11 News, updates and analysis

If the site has or can support editorial posts, create a compact update feed:
- headline;
- short original summary;
- publication time;
- author/editor;
- sources;
- links to related data panels.

Suggested editorial formats:
- “Ramayana Box Office Day 5: India and Worldwide Update”
- “Ramayana Overseas Box Office: Territory Breakdown”
- “Ramayana Advance Booking: Tickets and Gross”
- “Ramayana vs Dhurandhar 2: Day-wise Comparison”
- “Can Ramayana beat the overseas first-week record?”

Each post must add original analysis or a useful synthesis. Do not auto-generate dozens of near-identical pages. Do not copy articles from other publications.

---

## 5. Data model and source provenance

A reliable data model is more important than flashy charts. Keep raw observations, normalized values, calculated aggregates and forecasts separate.

### 5.1 Suggested entities

Adapt to the current database / JSON / CMS architecture rather than introducing a new system unnecessarily.

#### Film
- `id`
- `slug`
- `title`
- `alternate_titles`
- `release_date`
- `languages`
- `formats`
- `poster`
- `status`
- `official_site` (optional)
- `created_at`
- `updated_at`

#### BoxOfficeObservation
- `id`
- `film_id`
- `metric` (e.g. `india_net`, `india_gross`, `overseas_gross`, `worldwide_gross`, `tickets_sold`, `advance_gross`, `shows`, `occupancy`)
- `value`
- `currency`
- `unit`
- `period_type` (`daily`, `cumulative`, `advance_booking`, `forecast`)
- `period_start`
- `period_end`
- `theatrical_day_number`
- `market` (`India`, `Overseas`, territory code, etc.)
- `source_id`
- `source_url`
- `source_label`
- `source_published_at`
- `observed_at`
- `basis` (`net`, `gross`, `unknown`, `tracked_sample`)
- `status` (`reported`, `estimated`, `calculated`, `forecast`, `unverified`)
- `includes_previews`
- `includes_blocked_seats`
- `coverage_note`
- `confidence`
- `raw_value`
- `raw_currency`
- `exchange_rate`
- `exchange_rate_date`
- `notes`

#### Source
- `id`
- `name`
- `url`
- `source_type` (`trade_tracker`, `industry_publication`, `official_distributor`, `ticketing_platform`, `manual_editorial`)
- `reliability_note`
- `terms_url`
- `last_checked_at`

#### Forecast
- `id`
- `film_id`
- `metric`
- `forecast_for_date`
- `low`
- `base`
- `high`
- `generated_at`
- `input_cutoff`
- `method_version`
- `assumptions`
- `confidence`
- `actual_value` (nullable; populated after the date closes)

#### DataSnapshot
- `id`
- `created_at`
- `reporting_timezone`
- `source_count`
- `snapshot_status`
- `editor_note`

### 5.2 Source hierarchy and attribution

Use multiple sources where possible. A suggested hierarchy:

1. Official distributor / studio / exhibitor statements for clearly defined official figures.
2. Established box-office trade trackers with transparent daily reporting.
3. Reputable entertainment/business publications quoting identifiable trade sources.
4. Ticketing platforms for their own booking inventory and tracked sales—not as a complete all-market ticket count unless they explicitly support that claim.
5. Editorial estimates only when clearly labelled and method documented.

Possible sources to evaluate:
- Sacnilk
- Box Office India
- Bollywood Hungama
- trade publications such as Variety, Deadline, The Hollywood Reporter, Screen, Indian Express, Mint and other established outlets
- ticketing platforms such as BookMyShow, where their data is publicly and lawfully available

This is a list of candidates to evaluate, not a claim that each source provides every metric or permits automated extraction.

### 5.3 Source handling rules

- Follow each provider's terms of use, robots policy, licensing and rate limits.
- Prefer licensed APIs, public feeds, official press releases, or manual editorial entry when automated access is not clearly permitted.
- Do not bypass paywalls, access controls, anti-bot systems or authentication.
- Store the source URL and retrieval timestamp for every observation.
- Preserve the original reported number and its definition.
- Do not silently overwrite one source's value with another.
- If sources disagree, retain the observations and calculate a consensus only when the metric definitions match.
- Show a range or a “sources differ” note where a single consensus would be misleading.
- Keep an audit trail of corrections.

### 5.4 Consensus methodology

If the existing website already uses a weighted-median consensus, preserve it and document it.

For each metric:
1. Normalize only observations with matching period, market, currency basis and gross/net definition.
2. Convert currencies using a documented exchange rate and date.
3. Apply source weights only if the methodology explains why those weights are used.
4. Use a weighted median or another robust method that is documented and tested.
5. Do not average incomparable data.
6. Retain source-level values for readers to inspect.
7. Show the number of sources contributing to the consensus.
8. If only one valid source exists, label the value as single-source rather than consensus.

### 5.5 Metric definitions — must be consistent throughout the site

- **India Net:** Domestic theatrical collection after applicable entertainment taxes, as reported by the chosen trade convention.
- **India Gross:** Domestic theatrical gross before the relevant tax deductions.
- **Overseas Gross:** Theatrical gross outside India. It must exclude India.
- **Worldwide Gross:** India gross + overseas gross, using compatible gross bases and the same time window.
- **Worldwide Net:** Do not calculate or display unless a defensible, consistently defined method exists.
- **Tickets Sold:** Number of tickets actually booked/sold according to the named source and coverage. Never infer ticket volume from gross revenue without a clearly labelled estimate.
- **Advance Booking Gross:** Gross value of advance tickets booked for future shows, with the booking cutoff time stated.
- **Shows:** Number of shows tracked by the named source; not necessarily every show in the country.
- **Occupancy:** Seats booked divided by seats available for the defined tracked sample and time window. State the sample.
- **Daily:** A theatrical calendar day in the market's local reporting convention.
- **Cumulative:** Sum through a specified theatrical day/date.
- **Paid Previews:** Report separately from official Day 1 unless a comparison explicitly includes previews.

### 5.6 Unknown, missing and zero values

This rule is critical:

- `0` means the measured value is genuinely zero.
- `null` / missing means no reliable figure is available.
- `not_reported` means the source did not publish it.
- `not_applicable` means the metric does not apply.

Never coerce missing values to zero. Do not allow `null` to break totals or charts. Do not add incomplete overseas values to domestic values and label the result worldwide.

---

## 6. SEO and search visibility strategy

The ambition is to make Indian-boxoffice.com a useful result when people search for queries such as:
- Ramayana box office collection
- Ramayana box office collection today
- Ramayana Day 1 / Day 2 / Day 3 / Day 4 collection
- Ramayana worldwide box office collection
- Ramayana overseas box office collection
- Ramayana advance booking
- Ramayana tickets sold
- Ramayana first weekend collection
- Ramayana first week collection
- Ramayana vs Dhurandhar 2
- Ramayana highest single day collection
- Ramayana box office records

**No implementation can guarantee a Google ranking or a specific search position.** Build the best answer and the clearest technical foundations; do not use spam tactics.

### 6.1 Primary landing page

The main page `/ramayana/` should be a genuinely comprehensive and frequently updated answer to the main search intent.

Suggested:
- Title: `Ramayana Box Office Collection: Day-Wise India, Overseas & Worldwide`
- H1: `Ramayana Box Office Collection`
- Meta description: `Follow Ramayana's latest India net, India gross, overseas and worldwide box office collections, daily breakdown, advance booking, ticket sales and records. Updated [date/time].`

Generate the actual date/time dynamically and accurately. Do not hard-code stale dates in metadata.

Use natural headings:
- Latest Ramayana Box Office Collection
- Ramayana Day-Wise Collection
- Ramayana India Box Office
- Ramayana Overseas Box Office
- Ramayana Advance Booking and Tickets Sold
- Ramayana Worldwide Collection
- Ramayana Box Office Records
- Ramayana vs Dhurandhar 2
- Frequently Asked Questions
- Sources and Methodology

Do not repeat the exact keyword unnaturally in every heading.

### 6.2 Unique metadata and canonical URLs

- Every indexable page needs a unique descriptive `<title>` and meta description.
- Add one canonical URL per page.
- Avoid duplicate or near-duplicate pages for each keyword variation.
- Use clean, stable URLs.
- Ensure the initial HTML or server-rendered output contains meaningful page content, title, canonical and metadata.
- If the site is a client-rendered SPA, evaluate prerendering or static generation for important landing pages.
- Do not rely on client-side JavaScript alone for critical content discovery.

### 6.3 Structured data

Use JSON-LD only where the page genuinely qualifies. Validate all markup.

Recommended candidates:
- `Organization` for the website/publisher identity, with truthful information.
- `WebSite` for the website.
- `BreadcrumbList` for subpages.
- `Article` or `NewsArticle` for original editorial updates, with real author, publication date and modification date.
- `Dataset` only if the published data genuinely meets the Dataset description and has clear variables, coverage and provenance.

Do not invent ratings, reviews, actors' endorsements, awards or official status. Do not mark a live data dashboard as `NewsArticle` simply to chase a rich result. Structured data does not guarantee a rich result.

### 6.4 Sitemaps and crawlability

- Ensure the XML sitemap includes the canonical Ramayana hub and useful indexable subpages.
- Update `lastmod` only when the page has materially changed.
- Do not create a new URL for every tiny data refresh.
- Add a news sitemap only if the site has genuine news articles and can follow Google's news sitemap rules.
- Keep robots.txt correct and do not accidentally block important CSS/JS resources or pages.
- Verify canonical and sitemap URLs use HTTPS and the preferred host consistently.
- Add internal links to the Ramayana hub from relevant pages.

### 6.5 Content that can earn links and repeat visits

Prioritise useful original assets:
- a transparent live/day-wise data table;
- a historical day-number comparison tool;
- a record tracker with cited evidence;
- a territory-by-territory overseas dashboard;
- a clearly explained advance-booking trend;
- original daily analysis that explains why collections rose or fell;
- downloadable charts or data exports if accurate and useful.

Do not publish dozens of AI-generated pages that only rephrase the same daily number. Google explicitly warns against scaled content that exists primarily to manipulate rankings. Every editorial update must add original context, analysis or a meaningful new dataset.

### 6.6 Search Console and measurement

Add/verify Google Search Console for the domain if not already done. Check:
- domain/property verification;
- sitemap submission;
- indexing status of `/ramayana/`;
- canonical selected by Google;
- mobile usability / Core Web Vitals;
- search queries and landing-page impressions;
- crawl errors and structured-data issues.

Use privacy-respecting analytics or the site's existing analytics. Track:
- page views for `/ramayana/`;
- clicks to India / Overseas / Advance Booking / Records sections;
- comparison tool usage;
- CSV downloads;
- returning visitors;
- referral and social traffic.

Do not place personal data or credentials in source code.

---

## 7. Visual design and UX

### Design direction

- Match the existing Indian Box Office brand and design system.
- Make the Ramayana hub visually distinctive but consistent with the rest of the site.
- Use a restrained cinematic visual treatment, not an overloaded fan poster.
- Keep the box-office figures the primary focus.
- Use a clear typography scale and high contrast.
- Make the most important information visible near the top on mobile.
- Avoid large hero imagery that pushes useful numbers far below the fold.
- Use responsive cards, compact charts and accessible tables.
- Add subtle loading skeletons and graceful error/empty states.

### Mobile-first requirements

- Test at 320px, 375px, 390px, 430px and tablet widths.
- No horizontal page overflow.
- Buttons and tabs must be touch-friendly.
- Tables must remain usable on small screens.
- Charts must resize and have text equivalents.
- Avoid hover-only tooltips; support tap and keyboard.
- Keep important numbers readable without zooming.

### Accessibility

- Semantic headings in logical order.
- Accessible names for controls.
- Keyboard navigation for tabs, filters and charts.
- Visible focus styles.
- Sufficient contrast.
- Do not use colour alone to indicate status.
- Respect reduced-motion preferences.
- Provide accessible descriptions for charts and image alt text for meaningful images.

### Performance

- Keep the main dashboard fast, especially on mobile networks.
- Lazy-load non-critical charts and images.
- Optimise image sizes and use modern formats where appropriate.
- Avoid adding a large charting library if the existing project already has a suitable one.
- Avoid layout shifts when charts and cards load.
- Cache static assets safely.
- Do not cache stale live values indefinitely; show data timestamps.

---

## 8. Editorial standards and trust

Add a visible **Sources & Methodology** section on the hub.

It must explain:
- where the figures come from;
- what India net, India gross, overseas gross and worldwide gross mean;
- whether figures are estimates, reported values or calculations;
- how conflicting trade estimates are reconciled;
- how ticket sales and occupancy coverage is measured;
- how often data is refreshed;
- what happens when a source is unavailable;
- how corrections are made.

Each data module should have a source link or a “View sources” drawer. Provide a source list with:
- publisher/source name;
- linked report or data page;
- publication/update timestamp;
- metric supported;
- notes about coverage and limitations.

Add a clear disclaimer:

> Box-office figures are compiled from publicly available trade reports and other identified sources. Unless explicitly stated otherwise, figures should be treated as estimates, not audited financial statements. Different trackers may report different totals because of timing, territory coverage and gross/net methodology. Indian Box Office publishes its own source-based consensus and corrections where necessary.

Do not imply affiliation with the film's producers, distributors, exhibitors, actors or ticketing platforms unless a real relationship exists.

Clearly identify the site's editor/author and provide an About / methodology link. Use real author information only.

---

## 9. Data refresh and operational workflow

The page should support a reliable refresh process without requiring a full rebuild for every small data change, if the current architecture allows it.

### Refresh workflow

1. Collect observations from permitted sources.
2. Store raw source values and source timestamps.
3. Validate units, market, currency, period and gross/net basis.
4. Detect duplicates and conflicting values.
5. Calculate consensus / aggregates using the existing documented method.
6. Recompute day-wise and cumulative totals.
7. Run consistency checks.
8. Publish the new snapshot only if checks pass.
9. Display the snapshot timestamp and source coverage.
10. Keep the previous valid snapshot available if a refresh fails.

### Stale data states

Use clear status states:
- `LIVE` — recently refreshed and current-day reporting is ongoing.
- `UPDATED` — latest published snapshot is recent.
- `DELAYED` — source update is late.
- `STALE` — data is older than the configured freshness threshold.
- `PARTIAL` — one or more important markets/metrics are unavailable.

Do not call data “live” if it refreshes only once per day.

### Manual editorial override

If an editor corrects a figure:
- require a reason/note;
- record editor and timestamp;
- preserve the previous value;
- record source evidence;
- show the corrected value publicly if it materially changes a reported figure.

---

## 10. Validation, tests and acceptance criteria

Cursor must not consider this task complete merely because the page renders.

### Data tests

- Daily totals sum to cumulative totals where the same metric and periods apply.
- India gross is not lower than India net when both refer to the same period and convention, unless a documented special case explains it.
- Worldwide gross equals India gross + overseas gross only when both components are present and compatible.
- Overseas excludes India.
- Daily values are not accidentally displayed as cumulative values.
- Day numbers align with the verified release date and market convention.
- Paid previews are kept separate or explicitly included.
- Missing values remain missing, not zero.
- Currency conversions retain the original currency and exchange-rate metadata.
- Ticket totals are not summed across overlapping sources or platforms.
- Occupancy is calculated only from a known seats-booked / seats-available denominator.
- Forecasts are never included in actual cumulative totals.
- Week totals use the correct seven-day window and are labelled partial until complete.

### UI tests

- Navigation link opens the correct Ramayana hub.
- All tabs/filters work.
- Mobile layouts do not overflow.
- Charts and tables show consistent data.
- Tooltips and source drawers are accessible.
- Empty/error states are understandable.
- Data timestamps and timezone are correct.
- No stale hard-coded values remain in hero cards or metadata.

### SEO tests

- Unique title and meta description.
- Correct canonical.
- Crawlable internal links.
- Valid sitemap entry.
- No accidental `noindex`.
- Structured data validates and matches visible content.
- Important text is present in rendered HTML for crawlers.
- No duplicate or thin pages created.
- Open Graph / social sharing metadata works.

### Final delivery from Cursor

When finished, report:
1. files changed;
2. components/routes added;
3. data source and refresh behaviour;
4. SEO changes;
5. tests/build commands run and their results;
6. any data source or API limitations;
7. anything still requiring manual configuration (e.g. Search Console, analytics, API credentials).

Do not claim a feature is connected or live if it has only been mocked.

---

## 11. Suggested implementation phases

Implement in stages so the existing site remains stable.

### Phase 1 — Audit and foundation
- Inspect project and current Ramayana data.
- Resolve inconsistent/missing metrics.
- Confirm canonical URL and route plan.
- Create reusable Ramayana data selectors and metric definitions.
- Add source provenance and timestamp support if absent.

### Phase 2 — Main hub
- Add Ramayana navigation entry.
- Build hero/status area and metric cards.
- Add today's performance and day-wise table.
- Add source/methodology disclosure.
- Add responsive layouts.

### Phase 3 — Visual analytics
- Add daily/cumulative charts.
- Add overseas territory breakdown.
- Add ticket/advance-booking/occupancy modules where data exists.
- Add comparison centre.

### Phase 4 — Records and projections
- Add verified record tracker.
- Add forecast module with low/base/high scenarios and transparent assumptions.
- Add actual-versus-projection history.

### Phase 5 — SEO and editorial
- Add metadata, canonical, structured data and sitemap support.
- Add original editorial updates if sustainable.
- Add internal linking and social preview metadata.
- Verify Search Console readiness.

### Phase 6 — Quality and release
- Run tests and production build.
- Test on mobile and desktop.
- Validate structured data and sitemap.
- Verify data consistency and no invented values.
- Deploy without breaking existing pages.

Prioritise **correct data and a useful main hub** over implementing every possible chart immediately.

---

## 12. Recommended launch checklist

Before promoting the new hub:

- [ ] `/ramayana/` loads quickly on mobile.
- [ ] Navigation links to the hub.
- [ ] Latest update time and timezone are visible.
- [ ] India net / India gross / overseas gross / worldwide gross are clearly distinguished.
- [ ] Overseas excludes India.
- [ ] Day-wise table reconciles with cumulative totals.
- [ ] Unknown values show as unavailable, not zero.
- [ ] Ticket sales and show counts include coverage notes.
- [ ] Advance booking is not confused with final collections.
- [ ] Forecasts are visibly estimates.
- [ ] Record comparisons use identical metrics and periods.
- [ ] Every important number has a source or methodology note.
- [ ] SEO title, description and canonical are correct.
- [ ] Sitemap includes the canonical page.
- [ ] Structured data matches visible content.
- [ ] Mobile and accessibility checks pass.
- [ ] Existing homepage, rankings, film pages and daily charts still work.

---

## 13. Official technical references

Cursor should use the current official documentation when implementing SEO and structured data. These links were reviewed while preparing this brief:

1. **Google Search Essentials** — technical requirements, spam policies and key best practices:  
   https://developers.google.com/search/docs/essentials

2. **Creating Helpful, Reliable, People-First Content** — original value, authorship, trust and avoiding search-engine-first content:  
   https://developers.google.com/search/docs/fundamentals/creating-helpful-content

3. **Google Search spam policies** — especially scaled content abuse and scraping/low-value mass content:  
   https://developers.google.com/search/docs/essentials/spam-policies

4. **JavaScript SEO basics** — rendering, titles, snippets and canonical URLs:  
   https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics

5. **Sitemaps overview** — sitemap discovery, freshness and image/video/news sitemap guidance:  
   https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview

6. **Article structured data** — valid Article / NewsArticle / BlogPosting markup:  
   https://developers.google.com/search/docs/appearance/structured-data/article

7. **News sitemap guidance** — only relevant if the site publishes genuine news articles:  
   https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap

Use these references as technical guidance, not as a promise that structured data or SEO changes will produce a particular ranking.

---

## 14. Final instruction to Cursor

Build a **Ramayana Box Office Command Centre** inside the existing Indian Box Office website. It should combine reliable source-based data, day-wise collections, India and overseas performance, ticket/advance-booking information, charts, record comparisons, transparent projections and strong technical SEO.

The priority order is:

1. **Accuracy and source transparency**
2. **Excellent mobile experience**
3. **A genuinely useful Ramayana landing page**
4. **Clear overseas, ticket-sales and advance-booking coverage**
5. **Comparable records and film comparisons**
6. **Fast, crawlable, search-friendly implementation**
7. **Scalable design that can later be reused for other major films**

Do not fabricate missing data. Do not break the existing website. Do not rebuild the application unnecessarily. Inspect, plan, implement, test and then provide a concise implementation report.
