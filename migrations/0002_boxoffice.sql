create table if not exists sources (
  id text primary key,
  name text not null,
  homepage text not null,
  kind text not null,
  weight real not null,
  notes text not null default ''
);

create table if not exists movies (
  id text primary key,
  slug text unique not null,
  title text not null,
  language text not null,
  industry text not null,
  director text not null default '',
  starring text not null default '',
  release_date date not null,
  budget_cr numeric(12,2),
  runtime_min int,
  synopsis text not null default '',
  poster_key text not null default '',
  status text not null,
  verdict text not null default 'Pending'
);

create table if not exists readings (
  id serial primary key,
  movie_id text not null references movies(id),
  source_id text not null references sources(id),
  report_date date not null,
  day_number int not null,
  india_net numeric(12,2),
  india_gross numeric(12,2),
  overseas numeric(12,2),
  worldwide numeric(12,2),
  screens int,
  occupancy numeric(5,2),
  note text not null default '',
  unique (movie_id, source_id, report_date)
);

create index if not exists readings_movie_date_idx on readings (movie_id, report_date);

create table if not exists consensus_days (
  movie_id text not null references movies(id),
  report_date date not null,
  day_number int not null,
  india_net numeric(12,2) not null,
  india_gross numeric(12,2) not null,
  overseas numeric(12,2) not null,
  worldwide numeric(12,2) not null,
  net_change_pct numeric(8,2),
  disagreement_pct numeric(8,2),
  screens int,
  occupancy numeric(5,2),
  primary key (movie_id, report_date)
);

create table if not exists territory_splits (
  movie_id text not null references movies(id),
  report_date date not null,
  territory text not null,
  india_net numeric(12,2) not null,
  primary key (movie_id, report_date, territory)
);

create table if not exists news_items (
  id serial primary key,
  source_id text not null,
  title text not null,
  url text not null unique,
  published_at timestamptz,
  summary text not null default '',
  fetched_at timestamptz not null default now()
);

create table if not exists reports (
  id serial primary key,
  report_date date not null unique,
  headline text not null,
  lede text not null,
  body text not null,
  generated_at timestamptz not null default now(),
  origin text not null default 'desk'
);

create table if not exists analyses (
  id serial primary key,
  movie_id text,
  prompt_hash text not null unique,
  body text not null,
  generated_at timestamptz not null default now()
);

create table if not exists ingest_log (
  id serial primary key,
  source_id text not null,
  status text not null,
  detail text not null default '',
  fetched_at timestamptz not null default now()
);
