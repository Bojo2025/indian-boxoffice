import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDeskLong } from "@/lib/boxoffice/format";
import { getNewsPage, refreshWires } from "@/lib/boxoffice/queries";
import type { IngestEntry, NewsItem } from "@/lib/boxoffice/types";

export const Route = createFileRoute("/wires")({
  loader: () => getNewsPage(),
  component: WiresPage,
});

function WiresPage() {
  const initial = Route.useLoaderData();
  const [news, setNews] = useState<NewsItem[]>(initial.news);
  const [ingest, setIngest] = useState<IngestEntry[]>(initial.ingest);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setNote(null);
    const res = await refreshWires();
    setBusy(false);
    if (res.ok) {
      setNote(`Scraped ${res.readings} collection rows across ${res.movies} films. Headlines: ${res.headlines}. Wikipedia rows: ${res.wikiRows}.`);
      const next = await getNewsPage();
      setNews(next.news);
      setIngest(next.ingest);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.2em] text-accent">{formatDeskLong(initial.today)}</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-[-0.03em] text-fg">Wires</h1>
          <p className="mt-3 max-w-xl text-sm text-muted">
            This page is the live ingest log. Refresh pulls Sacnilk day-wise collections, Hungama
            tables, Wikipedia, Pinkvilla, Box Office India notes, ETimes RSS and whatever else the
            trackers will still serve. Koimoi and Indian Express HTML are often bot-walled — when
            they are, the file keeps the last published table and says so.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={refresh} disabled={busy}>
          {busy ? "Scraping…" : "Pull live collections"}
        </Button>
      </div>
      {note ? <p className="mt-4 text-sm text-paper">{note}</p> : null}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <ul className="divide-y divide-border">
          {news.map((n) => (
            <li key={n.id} className="py-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-subtle">{n.sourceId}</p>
              <a href={n.url} target="_blank" rel="noreferrer" className="mt-1 block text-lg text-fg hover:text-paper">
                {n.title}
              </a>
              {n.summary ? <p className="mt-2 text-sm text-muted">{n.summary}</p> : null}
            </li>
          ))}
        </ul>
        <aside>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Ingest log</p>
          <ul className="mt-3 space-y-3">
            {ingest.map((i, idx) => (
              <li key={`${i.fetchedAt}-${idx}`} className="rounded-lg bg-surface px-3 py-3">
                <p className="text-sm text-fg">{i.sourceId}</p>
                <p className="text-xs uppercase tracking-wide text-muted">{i.status}</p>
                <p className="mt-1 text-xs text-subtle">{i.detail}</p>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </main>
  );
}
