import { createFileRoute } from "@tanstack/react-router";
import {
  archiveBasename,
  archiveJson,
  buildArchiveHtml,
  nowPlayingCsv,
  rankingsCsv,
  type ArchivePack,
} from "@/lib/boxoffice/archive";
import { getNewsPage, getRankings, getReportPage } from "@/lib/boxoffice/queries";

async function loadPack(): Promise<ArchivePack> {
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
}

function asciiFilename(name: string): string {
  return name.replace(/[^\w.-]+/g, "-");
}

export const Route = createFileRoute("/api/desk-file")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const kind = url.searchParams.get("kind") ?? "website";
        const view = url.searchParams.get("view") === "1";
        const pack = await loadPack();
        const base = archiveBasename(pack.today);

        let filename = `${base}.html`;
        let body = "";
        let mime = "text/html; charset=utf-8";

        if (kind === "rankings") {
          filename = `${base}-rankings.csv`;
          body = rankingsCsv(pack.films);
          mime = "text/csv; charset=utf-8";
        } else if (kind === "now") {
          filename = `${base}-now-playing.csv`;
          body = nowPlayingCsv(pack.playing);
          mime = "text/csv; charset=utf-8";
        } else if (kind === "json") {
          filename = `${base}.json`;
          body = archiveJson(pack);
          mime = "application/json; charset=utf-8";
        } else {
          filename = `${base}.html`;
          body = buildArchiveHtml(pack);
          mime = "text/html; charset=utf-8";
        }

        const safe = asciiFilename(filename);
        const inline = view && kind === "website";
        const disposition = inline ? "inline" : "attachment";
        const encoded = encodeURIComponent(safe);

        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": inline ? mime : "application/octet-stream",
            "Content-Disposition": `${disposition}; filename="${safe}"; filename*=UTF-8''${encoded}`,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
