import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Download, ExternalLink, FileJson, FileSpreadsheet, Github, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { archiveBasename, type ArchivePack } from "@/lib/boxoffice/archive";
import { formatCrCompact, formatDeskLong } from "@/lib/boxoffice/format";
import { getNewsPage, getRankings, getReportPage } from "@/lib/boxoffice/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/download")({
  loader: async (): Promise<ArchivePack> => {
    const [rank, reports, news] = await Promise.all([getRankings(), getReportPage(), getNewsPage()]);
    const films = rank.films;
    const ytd = films.reduce(
      (acc, m) => ({ net: acc.net + m.indiaNet, ww: acc.ww + m.worldwide }),
      { net: 0, ww: 0 },
    );
    return {
      today: rank.today,
      films,
      playing: films.filter((m) => m.status === "playing" || m.status === "late"),
      report: reports.reports[0] ?? null,
      news: news.news.slice(0, 12),
      sources: rank.sources,
      ytdIndiaNet: ytd.net,
      ytdWorldwide: ytd.ww,
    };
  },
  component: DownloadPage,
});

function fileHref(kind: "website" | "rankings" | "now" | "json", view = false) {
  const params = new URLSearchParams({ kind });
  if (view) params.set("view", "1");
  return `/api/desk-file?${params.toString()}`;
}

function DownloadPage() {
  const pack = Route.useLoaderData();
  const [hint, setHint] = useState<string | null>(null);
  const base = archiveBasename(pack.today);
  const githubRepo = import.meta.env.VITE_GITHUB_REPO as string | undefined;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.2em] text-accent">Desk files · {formatDeskLong(pack.today)}</p>
      <h1 className="mt-3 max-w-xl font-display text-4xl tracking-[-0.03em] text-fg sm:text-5xl">
        Source and snapshots.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-paper">
        The live website is this app — clone the GitHub repository, install, and run it. The HTML /
        CSV / JSON files below are only a copy of today&apos;s board, not the project.
      </p>

      <article className="mt-8 border border-accent/40 bg-surface p-6 sm:p-8">
        <Github className="size-5 text-accent" />
        <h2 className="mt-4 font-display text-2xl tracking-[-0.03em] text-fg">Website source</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          React + TanStack Start. Pulse, Now playing, 2026 rankings, film files, daily report, desk
          bot, wires, methodology, seed data and live ingest. Node.js 22+.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {githubRepo ? (
            <>
              <Button asChild>
                <a href={githubRepo} target="_blank" rel="noopener noreferrer">
                  <Github className="size-4" />
                  Open on GitHub
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={`${githubRepo.replace(/\/$/, "")}/archive/refs/heads/main.zip`}>
                  <Download className="size-4" />
                  Download repo zip
                </a>
              </Button>
            </>
          ) : (
            <Button asChild variant="outline">
              <a href="https://github.com/new" target="_blank" rel="noopener noreferrer">
                <Github className="size-4" />
                Create a GitHub repo
              </a>
            </Button>
          )}
        </div>
        <ol className="mt-6 max-w-xl space-y-2 border-t border-border pt-5 text-sm text-paper">
          <li>1. git clone the repository (this folder is the website root).</li>
          <li>2. npm install && npm run dev</li>
          <li>3. Open http://localhost:8080</li>
          <li>4. Optional: copy env.example to .env and add XAI_API_KEY for the desk analyst.</li>
        </ol>
      </article>

      <div className="mt-8 grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        <Stat label="Titles on file" value={`${pack.films.length}`} />
        <Stat label="Now playing" value={`${pack.playing.filter((m) => m.status === "playing").length}`} />
        <Stat label="Worldwide tracked" value={formatCrCompact(pack.ytdWorldwide)} />
        <Stat label="Sources" value={`${pack.sources.length}`} />
      </div>

      <section className="mt-12">
        <h2 className="font-display text-2xl tracking-[-0.03em] text-fg">Today&apos;s board only</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Snapshots of the live desk after the latest scrape. Useful for a spreadsheet. Not the
          website you can keep building.
        </p>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="border border-border bg-bg-elevated p-6 sm:p-8">
          <Globe className="size-5 text-paper" />
          <h3 className="mt-4 font-display text-xl tracking-[-0.03em] text-fg">HTML snapshot</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            One file with now playing, late run, the year board, film files, wires and method notes
            as they stood this morning.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <FileLink href={fileHref("website")} filename={`${base}.html`} onHint={() => setHint("website")}>
              <Download className="size-4" />
              Save snapshot
            </FileLink>
            <Button asChild variant="outline">
              <a href={fileHref("website", true)} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                Open in a new tab
              </a>
            </Button>
          </div>
          {hint === "website" ? (
            <p className="mt-3 text-xs text-paper">Check the download bar, or the new tab — then use Save.</p>
          ) : (
            <p className="mt-3 text-xs text-subtle">Filename {base}.html</p>
          )}
        </article>

        <div className="grid gap-4">
          <FileCard
            icon={<FileSpreadsheet className="size-4 text-paper" />}
            title="2026 spreadsheet"
            body="Rank, language, India net and worldwide in ₹ crore."
            href={fileHref("rankings")}
            filename={`${base}-rankings.csv`}
            onHint={() => setHint("rankings")}
            hinted={hint === "rankings"}
          />
          <FileCard
            icon={<FileSpreadsheet className="size-4 text-paper" />}
            title="Now playing"
            body="Live and late-run titles: last-day net, occupancy and screens."
            href={fileHref("now")}
            filename={`${base}-now-playing.csv`}
            onHint={() => setHint("now")}
            hinted={hint === "now"}
          />
          <FileCard
            icon={<FileJson className="size-4 text-paper" />}
            title="Data pack"
            body="Machine-readable JSON of every film, source and wire in this snapshot."
            href={fileHref("json")}
            filename={`${base}.json`}
            onHint={() => setHint("json")}
            hinted={hint === "json"}
          />
        </div>
      </section>
    </main>
  );
}

function FileLink({
  href,
  filename,
  onHint,
  className,
  children,
}: {
  href: string;
  filename: string;
  onHint: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Button asChild className={className}>
      <a href={href} download={filename} target="_blank" rel="noopener noreferrer" onClick={onHint}>
        {children}
      </a>
    </Button>
  );
}

function FileCard({
  icon,
  title,
  body,
  href,
  filename,
  onHint,
  hinted,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  href: string;
  filename: string;
  onHint: () => void;
  hinted: boolean;
}) {
  return (
    <article className="border border-border bg-bg-elevated p-5">
      {icon}
      <h3 className="mt-3 font-display text-lg text-fg">{title}</h3>
      <p className="mt-1 text-sm text-muted">{body}</p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <a href={href} download={filename} target="_blank" rel="noopener noreferrer" onClick={onHint}>
          Save file
        </a>
      </Button>
      {hinted ? <p className={cn("mt-2 text-xs text-paper")}>Look for the download bar or a new tab.</p> : null}
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg px-4 py-5 sm:px-5">
      <p className="text-[11px] uppercase tracking-[0.14em] text-subtle">{label}</p>
      <p className="mt-2 font-mono text-lg tabular text-fg">{value}</p>
    </div>
  );
}
