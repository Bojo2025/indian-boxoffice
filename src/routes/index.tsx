import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Poster } from "@/components/boxoffice/poster";
import { ReportBody } from "@/components/boxoffice/report-body";
import { SpreadBar } from "@/components/boxoffice/spread-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCr, formatCrCompact, formatDeskLong, formatPct } from "@/lib/boxoffice/format";
import { getDashboard, getMovieDetail, refreshWires } from "@/lib/boxoffice/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  loader: async () => {
    const dash = await getDashboard();
    const lead = dash.playing[0];
    const detail = lead ? await getMovieDetail({ data: { slug: lead.slug } }) : null;
    return { dash, detail };
  },
  component: Home,
});

function Home() {
  const { dash, detail } = Route.useLoaderData();
  const lead = dash.playing[0];
  const news = dash.news.slice(0, 6);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function pullLive() {
    setBusy(true);
    setNote(null);
    try {
      const res = await refreshWires();
      setNote(
        res.ok
          ? `Scraped ${res.readings} collection rows across ${res.movies} films · ${res.headlines} headlines`
          : "Pull failed",
      );
      await router.invalidate();
    } catch {
      setNote("The trackers did not answer. Try again in a minute.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <section className="relative overflow-hidden border-b border-border">
        <img
          src="/posters/hero-cinema.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/80 to-bg/40" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="live">{dash.live ? "Live scrape" : "Pulling trackers"}</Badge>
            <p className="text-xs uppercase tracking-[0.22em] text-accent">
              {formatDeskLong(dash.today)} · IST
            </p>
          </div>
          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.08] tracking-[-0.03em] text-fg sm:text-6xl">
            Live collections, scraped from the trackers.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-paper">
            Sacnilk day-wise pages, Bollywood Hungama tables, Wikipedia 2026 ranking, Pinkvilla,
            Box Office India notes and the entertainment wires — pulled into one desk, then published
            as a weighted median with the spread still attached.
          </p>
          {dash.lastPull ? (
            <p className="mt-4 max-w-2xl text-xs leading-relaxed text-muted">
              Last pull: {dash.lastPull.detail}
            </p>
          ) : null}
          {note ? <p className="mt-3 text-sm text-paper">{note}</p> : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <Button type="button" onClick={pullLive} disabled={busy}>
              {busy ? "Scraping trackers…" : "Pull live collections"}
            </Button>
            <Button asChild variant="outline">
              <Link to="/now">Now in theatres</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/desk">Ask the desk</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-border sm:grid-cols-4">
          <Stat label="Today, India net" value={formatCrCompact(dash.todayIndiaNet)} hint="Playing titles, last reported day" />
          <Stat label="Tracked worldwide" value={formatCrCompact(dash.ytdWorldwide)} hint="On the 2026 board" />
          <Stat label="Sources on the desk" value={`${dash.sources.length}`} hint="Trade, newsroom, compiler" />
          <Stat label="Now playing" value={`${dash.playing.filter((m) => m.status === "playing").length}`} hint="Theatrical titles" />
        </div>
      </section>

      {lead && detail ? (
        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="live">Lead</Badge>
              <span className="text-xs uppercase tracking-[0.16em] text-muted">Day {lead.dayNumber}</span>
            </div>
            <h2 className="mt-3 font-display text-4xl tracking-[-0.03em] text-fg">{lead.title}</h2>
            <p className="mt-2 text-sm text-muted">
              {lead.language} · {lead.director} · {lead.starring}
            </p>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-paper">{lead.synopsis}</p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <MiniStat label="India net" value={formatCr(lead.indiaNet)} />
              <MiniStat label="Worldwide" value={formatCr(lead.worldwide)} />
              <MiniStat
                label="Last day"
                value={formatCr(lead.lastDayNet)}
                hint={formatPct(lead.netChangePct)}
                tone={lead.netChangePct != null && lead.netChangePct < -20 ? "loss" : "muted"}
              />
            </div>
            <div className="mt-6">
              <Button asChild variant="outline">
                <Link to="/movies/$slug" params={{ slug: lead.slug }}>
                  Open the file <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl bg-bg-elevated shadow-[var(--shadow-border)]">
            <div className="aspect-4/5 max-h-[420px] overflow-hidden sm:aspect-3/4">
              <Poster posterKey={lead.posterKey} title={lead.title} />
            </div>
            <div className="p-4">
              <SpreadBar spread={detail.spread} field="indiaNet" />
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl text-fg">The board</h2>
            <Link to="/now" className="text-sm text-muted hover:text-fg">
              All playing
            </Link>
          </div>
          <div className="mt-6 divide-y divide-border">
            <div className="hidden grid-cols-[auto_auto_1fr_auto_auto_auto] gap-3 px-2 pb-2 text-[11px] uppercase tracking-[0.14em] text-subtle sm:grid">
              <span className="w-6">#</span>
              <span className="w-12" />
              <span>Title</span>
              <span>Hold</span>
              <span>India net</span>
              <span className="text-right">Worldwide</span>
            </div>
            {dash.playing.map((m, i) => (
              <BoardRow key={m.id} movie={m} rank={i + 1} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-bg-elevated">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_0.8fr]">
          {dash.report ? (
            <article>
              <p className="text-xs uppercase tracking-[0.16em] text-accent">Daily report</p>
              <h2 className="mt-2 font-display text-3xl tracking-[-0.03em] text-fg">{dash.report.headline}</h2>
              <p className="mt-3 text-paper">{dash.report.lede}</p>
              <div className="mt-6 max-h-80 overflow-hidden">
                <ReportBody body={dash.report.body} />
              </div>
              <Link to="/report" className="mt-4 inline-flex min-h-11 items-center text-sm text-muted hover:text-fg">
                Read the full report
              </Link>
            </article>
          ) : null}
          <aside>
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Wires</p>
            <ul className="mt-4 divide-y divide-border">
              {news.map((n) => (
                <li key={n.id} className="py-3">
                  <a href={n.url} target="_blank" rel="noreferrer" className="text-sm text-fg hover:text-paper">
                    {n.title}
                  </a>
                  <p className="mt-1 text-xs text-subtle">{n.sourceId}</p>
                </li>
              ))}
            </ul>
            <Link to="/wires" className="mt-4 inline-flex min-h-11 items-center text-sm text-muted hover:text-fg">
              All wires
            </Link>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl text-fg">2026 race</h2>
          <Link to="/rankings" className="text-sm text-muted hover:text-fg">
            Full table
          </Link>
        </div>
        <ol className="mt-6 grid gap-2 sm:grid-cols-2">
          {dash.year.slice(0, 8).map((m, i) => (
            <li key={m.id}>
              <Link
                to="/movies/$slug"
                params={{ slug: m.slug }}
                className="flex min-h-14 items-center justify-between gap-3 rounded-lg px-3 hover:bg-surface"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="w-6 font-mono text-xs text-subtle tabular">{i + 1}</span>
                  <span className="truncate text-sm text-fg">{m.title}</span>
                </span>
                <span className="font-mono text-sm text-paper tabular">{formatCr(m.worldwide, 1)}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-bg px-4 py-5 sm:px-6">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl tabular text-fg">{value}</p>
      <p className="mt-1 text-xs text-subtle">{hint}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  hint,
  tone = "muted",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "muted" | "loss" | "gain";
}) {
  return (
    <div className="rounded-lg bg-surface px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 font-mono text-sm tabular text-fg">{value}</p>
      {hint ? (
        <p className={cn("text-xs", tone === "loss" ? "text-loss" : tone === "gain" ? "text-gain" : "text-subtle")}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function BoardRow({ movie, rank }: { movie: import("@/lib/boxoffice/types").MovieCard; rank: number }) {
  const drop = movie.netChangePct;
  return (
    <Link
      to="/movies/$slug"
      params={{ slug: movie.slug }}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-2 py-3 hover:bg-surface sm:grid-cols-[auto_auto_1fr_auto_auto_auto]"
    >
      <span className="w-6 font-mono text-xs text-subtle tabular">{rank}</span>
      <div className="hidden size-12 overflow-hidden rounded-sm sm:block">
        <Poster posterKey={movie.posterKey} title={movie.title} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm text-fg">{movie.title}</p>
        <p className="text-xs text-muted">
          {movie.language} · Day {movie.dayNumber || "—"}
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
      <span className="hidden font-mono text-sm tabular text-paper sm:inline">{formatCr(movie.indiaNet)}</span>
      <span className="text-right font-mono text-sm tabular text-fg">{formatCr(movie.worldwide)}</span>
    </Link>
  );
}
