import { createFileRoute } from "@tanstack/react-router";
import { MovieGridCard, MovieRow } from "@/components/boxoffice/movie-row";
import { formatDeskLong } from "@/lib/boxoffice/format";
import { getDashboard } from "@/lib/boxoffice/queries";

export const Route = createFileRoute("/now")({
  loader: () => getDashboard(),
  component: NowPlaying,
});

function NowPlaying() {
  const dash = Route.useLoaderData();
  const playing = dash.playing.filter((m) => m.status === "playing");
  const late = dash.playing.filter((m) => m.status === "late");

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.2em] text-accent">{formatDeskLong(dash.today)}</p>
      <h1 className="mt-2 font-display text-4xl tracking-[-0.03em] text-fg">Now playing</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Theatrical titles the desk is still marking as live. Consensus is a weighted median of
        published estimates, not a ticket count.
      </p>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {playing.map((m) => (
          <MovieGridCard key={m.id} movie={m} />
        ))}
      </div>
      {late.length ? (
        <section className="mt-12">
          <h2 className="font-display text-2xl text-fg">Late run</h2>
          <div className="mt-4 divide-y divide-border">
            {late.map((m, i) => (
              <MovieRow key={m.id} movie={m} rank={i + 1} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
