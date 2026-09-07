export type SourceKind = "trade" | "newsroom" | "compiler";
export type MovieStatus = "playing" | "late" | "closed";

export type Source = {
  id: string;
  name: string;
  homepage: string;
  kind: SourceKind;
  weight: number;
  notes: string;
};

export type Movie = {
  id: string;
  slug: string;
  title: string;
  language: string;
  industry: string;
  director: string;
  starring: string;
  releaseDate: string;
  budgetCr: number | null;
  runtimeMin: number | null;
  synopsis: string;
  posterKey: string;
  status: MovieStatus;
  verdict: string;
};

export type Reading = {
  movieId: string;
  sourceId: string;
  reportDate: string;
  dayNumber: number;
  indiaNet: number | null;
  indiaGross: number | null;
  overseas: number | null;
  worldwide: number | null;
  screens: number | null;
  occupancy: number | null;
  note: string;
};

export type ConsensusDay = {
  movieId: string;
  reportDate: string;
  dayNumber: number;
  indiaNet: number;
  indiaGross: number;
  overseas: number;
  worldwide: number;
  netChangePct: number | null;
  disagreementPct: number | null;
  screens: number | null;
  occupancy: number | null;
};

export type TerritorySplit = {
  movieId: string;
  reportDate: string;
  territory: string;
  indiaNet: number;
};

export type NewsItem = {
  id: number;
  sourceId: string;
  title: string;
  url: string;
  publishedAt: string | null;
  summary: string;
};

export type DailyReport = {
  reportDate: string;
  headline: string;
  lede: string;
  body: string;
  generatedAt: string;
  origin: string;
};

export type MovieCard = Movie & {
  dayNumber: number;
  indiaNet: number;
  indiaGross: number;
  overseas: number;
  worldwide: number;
  lastDayNet: number;
  netChangePct: number | null;
  disagreementPct: number | null;
  screens: number | null;
  occupancy: number | null;
};

export type SourceSpread = {
  sourceId: string;
  sourceName: string;
  kind: SourceKind;
  indiaNet: number | null;
  indiaGross: number | null;
  worldwide: number | null;
  reportDate: string;
  note: string;
};

export type IngestEntry = {
  sourceId: string;
  status: string;
  detail: string;
  fetchedAt: string;
};
