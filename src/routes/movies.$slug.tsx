import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { CollectionChart } from "@/components/boxoffice/collection-chart";
import { Poster } from "@/components/boxoffice/poster";
import { SpreadBar } from "@/components/boxoffice/spread-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { askDesk } from "@/lib/boxoffice/analyst";
import { formatCr, formatInt, formatPct, recovery } from "@/lib/boxoffice/format";
import { getMovieDetail } from "@/lib/boxoffice/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/movies/$slug")({
  loader: async ({ params }) => {
    const detail = await getMovieDetail({ data: { slug: params.slug } });
    if (!detail) throw notFound();
    return detail;
  },
  component: MoviePage,
});

function MoviePage() {
  const detail = Route.useLoaderData();
  const m = detail.movie;
  const rec = recovery(m.indiaNet, m.budgetCr);
  const [brief, setBrief] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyse() {
    setBusy(true);
    setError(null);
    const res = await askDesk({
      data: {
        movieTitle: m.title,
        question: `Write a tight theatrical brief on ${m.title}: opening, holds, source conflict, budget recovery, and likely verdict. Use the snapshot.`,
      },
    });
    setBusy(false);
    if (!res.ok) setError(res.error);
    else setBrief(res.text);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">
        <Link to="/now" className="hover:text-fg">
          Now playing
        </Link>
        <span className="mx-2 text-subtle">/</span>
        {m.industry}
      </p>
      <div className="mt-6 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
          <div className="aspect-2/3">
            <Poster posterKey={m.posterKey} title={m.title} />
          </div>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={m.status === "playing" ? "live" : "default"}>{m.status}</Badge>
            <Badge variant="paper">{m.verdict}</Badge>
            {m.disagreementPct != null && m.disagreementPct > 15 ? (
              <Badge variant="loss">Spread {formatPct(m.disagreementPct)}</Badge>
            ) : null}
          </div>
          <h1 className="mt-3 font-display text-4xl tracking-[-0.03em] text-fg sm:text-5xl">{m.title}</h1>
          <p className="mt-2 text-sm text-muted">
            {m.language} · {m.director} · {m.releaseDate}
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-paper">{m.synopsis}</p>
          <p className="mt-2 text-sm text-muted">{m.starring}</p>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Figure label="India net" value={formatCr(m.indiaNet)} />
            <Figure label="India gross" value={formatCr(m.indiaGross)} />
            <Figure label="Overseas" value={formatCr(m.overseas)} />
            <Figure label="Worldwide" value={formatCr(m.worldwide)} />
            <Figure label="Last day net" value={formatCr(m.lastDayNet)} hint={formatPct(m.netChangePct)} />
            <Figure label="Screens / shows" value={formatInt(m.screens)} />
            <Figure label="Occupancy" value={m.occupancy != null ? `${m.occupancy.toFixed(1)}%` : "—"} />
            <Figure
              label="Budget recovery"
              value={rec != null ? `${rec.toFixed(0)}%` : "—"}
              hint={m.budgetCr ? `Budget ${formatCr(m.budgetCr, 0)}` : "Budget unpublished"}
            />
          </div>
        </div>
      </div>

      <section className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div>
          <h2 className="font-display text-2xl text-fg">Day-wise India net</h2>
          <p className="mt-1 text-sm text-muted">Consensus daily, not a single tracker.</p>
          <div className="mt-4 rounded-xl bg-bg-elevated p-4 shadow-[var(--shadow-border)]">
            <CollectionChart days={detail.days} />
          </div>
          {detail.days.length > 1 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-[0.14em] text-subtle">
                  <tr className="border-b border-border">
                    <th className="py-2 font-medium">Day</th>
                    <th className="py-2 text-right font-medium">India net</th>
                    <th className="py-2 text-right font-medium">WW</th>
                    <th className="py-2 text-right font-medium">+/-</th>
                    <th className="py-2 text-right font-medium">Spread</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.days.map((d) => (
                    <tr key={d.reportDate} className="border-b border-border/60">
                      <td className="py-2 text-muted">
                        D{d.dayNumber} · {d.reportDate}
                      </td>
                      <td className="py-2 text-right font-mono tabular">{formatCr(d.indiaNet)}</td>
                      <td className="py-2 text-right font-mono tabular text-paper">{formatCr(d.worldwide)}</td>
                      <td
                        className={cn(
                          "py-2 text-right font-mono tabular",
                          d.netChangePct != null && d.netChangePct < 0 ? "text-loss" : "text-gain",
                        )}
                      >
                        {formatPct(d.netChangePct)}
                      </td>
                      <td className="py-2 text-right font-mono tabular text-subtle">
                        {formatPct(d.disagreementPct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
        <div className="space-y-8">
          <div className="rounded-xl bg-bg-elevated p-4 shadow-[var(--shadow-border)]">
            <SpreadBar spread={detail.spread} />
          </div>
          {detail.territories.length ? (
            <div>
              <h2 className="font-display text-xl text-fg">Language split · Day 1</h2>
              <ul className="mt-3 space-y-2">
                {detail.territories.map((t) => (
                  <li key={t.territory} className="flex justify-between text-sm">
                    <span className="text-muted">{t.territory}</span>
                    <span className="font-mono tabular text-fg">{formatCr(t.indiaNet)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-12 rounded-xl bg-bg-elevated p-5 shadow-[var(--shadow-border)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-fg">Desk brief</h2>
          <Button type="button" variant="outline" onClick={analyse} disabled={busy}>
            {busy ? "Reading…" : brief ? "Refresh brief" : "Ask the desk"}
          </Button>
        </div>
        {error ? <p className="mt-3 text-sm text-loss">{error}</p> : null}
        {brief ? (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-paper">{brief}</p>
        ) : (
          <p className="mt-3 text-sm text-muted">
            User-initiated analysis. Cached after the first run for this film.
          </p>
        )}
      </section>
    </main>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-surface px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 font-mono text-sm tabular text-fg">{value}</p>
      {hint ? <p className="text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}
