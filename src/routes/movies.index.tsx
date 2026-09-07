import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MovieRow } from "@/components/boxoffice/movie-row";
import { Input } from "@/components/ui/input";
import { getMovieCatalog } from "@/lib/boxoffice/queries";

export const Route = createFileRoute("/movies/")({
  loader: () => getMovieCatalog(),
  component: MoviesPage,
});

function MoviesPage() {
  const films = Route.useLoaderData();
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return films;
    return films.filter((m) =>
      `${m.title} ${m.language} ${m.director} ${m.starring}`.toLowerCase().includes(needle),
    );
  }, [films, q]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl tracking-[-0.03em] text-fg">All titles</h1>
      <div className="mt-6 max-w-md">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, language, director"
        />
      </div>
      <div className="mt-6 divide-y divide-border">
        {filtered.map((m, i) => (
          <MovieRow key={m.id} movie={m} rank={i + 1} />
        ))}
      </div>
    </main>
  );
}
