import { createServerFn } from "@tanstack/react-start";
import { SOURCES } from "./catalog";
import { deskDate, num, numOrNull } from "./format";
import type {
  ConsensusDay,
  DailyReport,
  IngestEntry,
  Movie,
  MovieCard,
  NewsItem,
  Source,
  SourceSpread,
  TerritorySplit,
} from "./types";

async function readySql(opts: { ingest?: boolean } = {}) {
  const { ensureSeeded } = await import("./seed");
  const { getSql } = await import("@/lib/db");
  await ensureSeeded();
  if (opts.ingest !== false) {
    const { ingestIfStale } = await import("./ingest");
    await ingestIfStale();
  }
  return getSql();
}


type MovieRow = {
  id: string;
  slug: string;
  title: string;
  language: string;
  industry: string;
  director: string;
  starring: string;
  release_date: string;
  budget_cr: string | number | null;
  runtime_min: number | null;
  synopsis: string;
  poster_key: string;
  status: string;
  verdict: string;
};

type CardRow = MovieRow & {
  day_number: number | null;
  india_net: string | number | null;
  india_gross: string | number | null;
  overseas: string | number | null;
  worldwide: string | number | null;
  last_day_net: string | number | null;
  net_change_pct: string | number | null;
  disagreement_pct: string | number | null;
  screens: number | null;
  occupancy: string | number | null;
};

function movieFrom(r: MovieRow): Movie {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    language: r.language,
    industry: r.industry,
    director: r.director,
    starring: r.starring,
    releaseDate: r.release_date,
    budgetCr: numOrNull(r.budget_cr),
    runtimeMin: r.runtime_min,
    synopsis: r.synopsis,
    posterKey: r.poster_key,
    status: r.status as Movie["status"],
    verdict: r.verdict,
  };
}

function cardFrom(r: CardRow): MovieCard {
  return {
    ...movieFrom(r),
    dayNumber: num(r.day_number),
    indiaNet: num(r.india_net),
    indiaGross: num(r.india_gross),
    overseas: num(r.overseas),
    worldwide: num(r.worldwide),
    lastDayNet: num(r.last_day_net),
    netChangePct: numOrNull(r.net_change_pct),
    disagreementPct: numOrNull(r.disagreement_pct),
    screens: r.screens,
    occupancy: numOrNull(r.occupancy),
  };
}

const CARD_SQL = `
  select m.*,
    coalesce(t.india_net, 0) as india_net,
    coalesce(t.india_gross, 0) as india_gross,
    coalesce(t.overseas, 0) as overseas,
    coalesce(t.worldwide, 0) as worldwide,
    l.india_net as last_day_net,
    l.net_change_pct,
    l.disagreement_pct,
    l.screens,
    l.occupancy,
    l.day_number
  from movies m
  left join lateral (
    select
      greatest(
        coalesce(sum(c.india_net), 0),
        coalesce((select max(r.india_net) from readings r where r.movie_id = m.id and r.note like 'lifetime%'), 0)
      ) as india_net,
      greatest(
        coalesce(sum(c.india_gross), 0),
        coalesce((select max(r.india_gross) from readings r where r.movie_id = m.id and r.note like 'lifetime%'), 0)
      ) as india_gross,
      greatest(
        coalesce(sum(c.overseas), 0),
        coalesce((select max(r.overseas) from readings r where r.movie_id = m.id and r.note like 'lifetime%'), 0)
      ) as overseas,
      greatest(
        coalesce(sum(c.worldwide), 0),
        coalesce((select max(r.worldwide) from readings r where r.movie_id = m.id and r.note like 'lifetime%'), 0)
      ) as worldwide
    from consensus_days c
    where c.movie_id = m.id
  ) t on true
  left join lateral (
    select india_net, net_change_pct, disagreement_pct, screens, occupancy, day_number
    from consensus_days c
    where c.movie_id = m.id
    order by report_date desc
    limit 1
  ) l on true
`;

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await readySql();
  const playing = await sql.query<CardRow>(
    `${CARD_SQL} where m.status in ('playing','late') order by case when m.status = 'playing' then 0 else 1 end, coalesce(t.worldwide,0) desc`,
  );
  const year = await sql.query<CardRow>(
    `${CARD_SQL} order by coalesce(t.worldwide,0) desc limit 12`,
  );
  const news = await sql<{
    id: number;
    source_id: string;
    title: string;
    url: string;
    published_at: string | null;
    summary: string;
  }>`
    select id, source_id, title, url, published_at::text as published_at, summary
    from news_items
    order by published_at desc nulls last
    limit 10
  `;
  const report = await sql<{
    report_date: string;
    headline: string;
    lede: string;
    body: string;
    generated_at: string;
    origin: string;
  }>`
    select report_date::text as report_date, headline, lede, body, generated_at::text as generated_at, origin
    from reports
    order by report_date desc
    limit 1
  `;
  const ingest = await sql<{
    source_id: string;
    status: string;
    detail: string;
    fetched_at: string;
  }>`
    select source_id, status, detail, fetched_at::text as fetched_at
    from ingest_log
    order by fetched_at desc
    limit 6
  `;
  const ytd = year.reduce(
    (acc, r) => ({
      net: acc.net + num(r.india_net),
      ww: acc.ww + num(r.worldwide),
    }),
    { net: 0, ww: 0 },
  );

  const cards = playing.map(cardFrom);
  const todayNet = cards
    .filter((c) => c.status === "playing")
    .reduce((a, c) => a + c.lastDayNet, 0);

  return {
    today: deskDate(),
    playing: cards,
    year: year.map(cardFrom),
    news: news.map(
      (n): NewsItem => ({
        id: n.id,
        sourceId: n.source_id,
        title: n.title,
        url: n.url,
        publishedAt: n.published_at,
        summary: n.summary,
      }),
    ),
    report: report[0]
      ? ({
          reportDate: report[0].report_date,
          headline: report[0].headline,
          lede: report[0].lede,
          body: report[0].body,
          generatedAt: report[0].generated_at,
          origin: report[0].origin,
        } satisfies DailyReport)
      : null,
    ingest: ingest.map(
      (i): IngestEntry => ({
        sourceId: i.source_id,
        status: i.status,
        detail: i.detail,
        fetchedAt: i.fetched_at,
      }),
    ),
    ytdIndiaNet: ytd.net,
    ytdWorldwide: ytd.ww,
    todayIndiaNet: todayNet,
    sources: SOURCES,
    lastPull: (() => {
      const row = ingest.find((i) => i.source_id === "desk") ?? ingest[0];
      return row
        ? {
            sourceId: row.source_id,
            status: row.status,
            detail: row.detail,
            fetchedAt: row.fetched_at,
          }
        : null;
    })(),
    live: ingest.some((i) => /live scrape/i.test(i.detail)),
  };
});

export const getMovieCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await readySql();
  const rows = await sql.query<CardRow>(`${CARD_SQL} order by m.release_date desc`);
  return rows.map(cardFrom);
});

export const getRankings = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await readySql();
  const rows = await sql.query<CardRow>(
    `${CARD_SQL} order by coalesce(t.worldwide,0) desc`,
  );
  return {
    today: deskDate(),
    films: rows.map(cardFrom),
    sources: SOURCES,
  };
});

export const getMovieDetail = createServerFn({ method: "GET" })
  .validator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const sql = await readySql();
    const rows = await sql.query<CardRow>(`${CARD_SQL} where m.slug = $1`, [data.slug]);
    const movie = rows[0];
    if (!movie) return null;

    const days = await sql<{
      report_date: string;
      day_number: number;
      india_net: string | number;
      india_gross: string | number;
      overseas: string | number;
      worldwide: string | number;
      net_change_pct: string | number | null;
      disagreement_pct: string | number | null;
      screens: number | null;
      occupancy: string | number | null;
    }>`
      select report_date::text as report_date, day_number, india_net, india_gross, overseas, worldwide,
             net_change_pct, disagreement_pct, screens, occupancy
      from consensus_days
      where movie_id = ${movie.id}
      order by report_date asc
    `;

    const latestBySource = await sql<{
      source_id: string;
      name: string;
      kind: string;
      report_date: string;
      india_net: string | number | null;
      india_gross: string | number | null;
      worldwide: string | number | null;
      note: string;
    }>`
      select s.id as source_id, s.name, s.kind, x.report_date::text as report_date,
             x.india_net, x.india_gross, x.worldwide, x.note
      from sources s
      join lateral (
        select report_date, india_net, india_gross, worldwide, note
        from readings r
        where r.movie_id = ${movie.id} and r.source_id = s.id
        order by case when r.note like 'lifetime%' then 0 else 1 end, r.report_date desc
        limit 1
      ) x on true
      order by s.weight desc
    `;

    const sourceTotals = await sql<{
      source_id: string;
      name: string;
      kind: string;
      india_net: string | number | null;
      india_gross: string | number | null;
      worldwide: string | number | null;
      report_date: string;
      note: string;
    }>`
      select s.id as source_id, s.name, s.kind,
        case when max(case when r.note like 'lifetime%' then 1 else 0 end) = 1
          then max(case when r.note like 'lifetime%' then r.india_net end)
          else sum(r.india_net) filter (where r.note not like 'lifetime%')
        end as india_net,
        case when max(case when r.note like 'lifetime%' then 1 else 0 end) = 1
          then max(case when r.note like 'lifetime%' then r.india_gross end)
          else sum(r.india_gross) filter (where r.note not like 'lifetime%')
        end as india_gross,
        case when max(case when r.note like 'lifetime%' then 1 else 0 end) = 1
          then max(case when r.note like 'lifetime%' then r.worldwide end)
          else sum(r.worldwide) filter (where r.note not like 'lifetime%')
        end as worldwide,
        max(r.report_date)::text as report_date,
        coalesce(max(r.note) filter (where r.note like 'lifetime%'), '') as note
      from readings r
      join sources s on s.id = r.source_id
      where r.movie_id = ${movie.id}
      group by s.id, s.name, s.kind, s.weight
      order by s.weight desc
    `;

    const territories = await sql<{
      report_date: string;
      territory: string;
      india_net: string | number;
    }>`
      select report_date::text as report_date, territory, india_net
      from territory_splits
      where movie_id = ${movie.id}
      order by india_net desc
    `;

    const consensusDays: ConsensusDay[] = days.map((d) => ({
      movieId: movie.id,
      reportDate: d.report_date,
      dayNumber: num(d.day_number),
      indiaNet: num(d.india_net),
      indiaGross: num(d.india_gross),
      overseas: num(d.overseas),
      worldwide: num(d.worldwide),
      netChangePct: numOrNull(d.net_change_pct),
      disagreementPct: numOrNull(d.disagreement_pct),
      screens: d.screens,
      occupancy: numOrNull(d.occupancy),
    }));

    const spread: SourceSpread[] = sourceTotals.map((s) => ({
      sourceId: s.source_id,
      sourceName: s.name,
      kind: s.kind as SourceSpread["kind"],
      indiaNet: numOrNull(s.india_net),
      indiaGross: numOrNull(s.india_gross),
      worldwide: numOrNull(s.worldwide),
      reportDate: s.report_date,
      note: s.note,
    }));

    return {
      movie: cardFrom(movie),
      days: consensusDays,
      spread,
      latestBySource,
      territories: territories.map(
        (t): TerritorySplit => ({
          movieId: movie.id,
          reportDate: t.report_date,
          territory: t.territory,
          indiaNet: num(t.india_net),
        }),
      ),
      sources: SOURCES as Source[],
    };
  });

export const getReportPage = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await readySql();
  const reports = await sql<{
    report_date: string;
    headline: string;
    lede: string;
    body: string;
    generated_at: string;
    origin: string;
  }>`
    select report_date::text as report_date, headline, lede, body, generated_at::text as generated_at, origin
    from reports
    order by report_date desc
  `;
  return {
    today: deskDate(),
    reports: reports.map(
      (r): DailyReport => ({
        reportDate: r.report_date,
        headline: r.headline,
        lede: r.lede,
        body: r.body,
        generatedAt: r.generated_at,
        origin: r.origin,
      }),
    ),
  };
});

export const getNewsPage = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await readySql();
  const news = await sql<{
    id: number;
    source_id: string;
    title: string;
    url: string;
    published_at: string | null;
    summary: string;
  }>`
    select id, source_id, title, url, published_at::text as published_at, summary
    from news_items
    order by published_at desc nulls last
    limit 40
  `;
  const ingest = await sql<{
    source_id: string;
    status: string;
    detail: string;
    fetched_at: string;
  }>`
    select source_id, status, detail, fetched_at::text as fetched_at
    from ingest_log
    order by fetched_at desc
    limit 12
  `;
  return {
    today: deskDate(),
    news: news.map(
      (n): NewsItem => ({
        id: n.id,
        sourceId: n.source_id,
        title: n.title,
        url: n.url,
        publishedAt: n.published_at,
        summary: n.summary,
      }),
    ),
    ingest: ingest.map(
      (i): IngestEntry => ({
        sourceId: i.source_id,
        status: i.status,
        detail: i.detail,
        fetchedAt: i.fetched_at,
      }),
    ),
    sources: SOURCES,
  };
});

export const refreshWires = createServerFn({ method: "POST" }).handler(async () => {
  await readySql({ ingest: false });
  const { ingestIfStale } = await import("./ingest");
  const result = await ingestIfStale({ force: true });
  return {
    ok: true as const,
    headlines: result.headlines,
    readings: result.readings,
    movies: result.movies,
    wikiRows: result.wikiRows,
    skipped: result.skipped,
    logs: result.logs,
  };
});
