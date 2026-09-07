import { Link } from "@tanstack/react-router";
import { formatCr, formatPct } from "@/lib/boxoffice/format";
import type { MovieCard } from "@/lib/boxoffice/types";
import { cn } from "@/lib/utils";
import { Poster } from "./poster";

export function MovieRow({ movie, rank }: { movie: MovieCard; rank?: number }) {
  const drop = movie.netChangePct;
  return (
    <Link
      to="/movies/$slug"
      params={{ slug: movie.slug }}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-surface sm:grid-cols-[auto_auto_1fr_auto_auto_auto]"
    >
      <span className="w-6 font-mono text-xs text-subtle tabular">{rank ?? ""}</span>
      <div className="hidden size-12 overflow-hidden rounded-sm sm:block">
        <Poster posterKey={movie.posterKey} title={movie.title} />
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium text-fg">{movie.title}</p>
        <p className="truncate text-xs text-muted">
          {movie.language} · Day {movie.dayNumber || "—"} · {movie.verdict}
        </p>
      </div>
      <span
        className={cn(
          "hidden font-mono text-xs tabular sm:inline",
          drop != null && drop < -20 ? "text-loss" : drop != null && drop > 10 ? "text-gain" : "text-muted",
        )}
      >
        {formatPct(drop)}
      </span>
      <span className="hidden font-mono text-sm text-paper tabular sm:inline">{formatCr(movie.indiaNet)}</span>
      <span className="text-right font-mono text-sm text-fg tabular">{formatCr(movie.worldwide)}</span>
    </Link>
  );
}

export function MovieGridCard({ movie }: { movie: MovieCard }) {
  return (
    <Link
      to="/movies/$slug"
      params={{ slug: movie.slug }}
      className="group overflow-hidden rounded-xl bg-bg-elevated shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]"
    >
      <div className="aspect-2/3 overflow-hidden bg-surface">
        <Poster
          posterKey={movie.posterKey}
          title={movie.title}
          className="transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="space-y-1 p-3">
        <p className="font-display text-lg leading-tight text-fg">{movie.title}</p>
        <p className="text-xs text-muted">
          {movie.language} · Day {movie.dayNumber || "—"}
        </p>
        <p className="font-mono text-sm text-paper tabular">{formatCr(movie.worldwide)} WW</p>
      </div>
    </Link>
  );
}
