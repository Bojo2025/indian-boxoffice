import { createFileRoute, Link } from "@tanstack/react-router";
import { formatCr, formatDeskLong } from "@/lib/boxoffice/format";
import { getRankings } from "@/lib/boxoffice/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/rankings")({
  loader: () => getRankings(),
  component: Rankings,
});

function Rankings() {
  const data = Route.useLoaderData();
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.2em] text-accent">{formatDeskLong(data.today)}</p>
      <h1 className="mt-2 font-display text-4xl tracking-[-0.03em] text-fg">2026 worldwide</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Ranked on IBO consensus worldwide gross. Range titles (Peddi, Jana Nayagan) sit at the
        midpoint and carry a spread flag on the film page.
      </p>
      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.14em] text-subtle">
            <tr className="border-b border-border">
              <th className="py-3 pr-3 font-medium">#</th>
              <th className="py-3 pr-3 font-medium">Title</th>
              <th className="py-3 pr-3 font-medium">Language</th>
              <th className="py-3 pr-3 font-medium">Status</th>
              <th className="py-3 pr-3 text-right font-medium">India net</th>
              <th className="py-3 text-right font-medium">Worldwide</th>
            </tr>
          </thead>
          <tbody>
            {data.films.map((m, i) => (
              <tr key={m.id} className="border-b border-border/70">
                <td className="py-3 pr-3 font-mono text-xs text-subtle tabular">{i + 1}</td>
                <td className="py-3 pr-3">
                  <Link to="/movies/$slug" params={{ slug: m.slug }} className="text-fg hover:text-paper">
                    {m.title}
                  </Link>
                </td>
                <td className="py-3 pr-3 text-muted">{m.language}</td>
                <td className="py-3 pr-3">
                  <span className={cn("text-xs uppercase tracking-wide", m.status === "playing" ? "text-accent" : "text-subtle")}>
                    {m.status}
                  </span>
                </td>
                <td className="py-3 pr-3 text-right font-mono tabular text-paper">{formatCr(m.indiaNet)}</td>
                <td className="py-3 text-right font-mono tabular text-fg">{formatCr(m.worldwide)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
