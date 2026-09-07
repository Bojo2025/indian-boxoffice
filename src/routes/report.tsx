import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ReportBody } from "@/components/boxoffice/report-body";
import { Button } from "@/components/ui/button";
import { generateDailyReport } from "@/lib/boxoffice/analyst";
import { formatDeskLong } from "@/lib/boxoffice/format";
import { getReportPage } from "@/lib/boxoffice/queries";
import type { DailyReport } from "@/lib/boxoffice/types";

export const Route = createFileRoute("/report")({
  loader: () => getReportPage(),
  component: ReportPage,
});

function ReportPage() {
  const data = Route.useLoaderData();
  const [reports, setReports] = useState<DailyReport[]>(data.reports);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = reports[0];

  async function regenerate() {
    setBusy(true);
    setError(null);
    const res = await generateDailyReport({ data: { force: true } });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const next: DailyReport = {
      reportDate: res.report.report_date,
      headline: res.report.headline,
      lede: res.report.lede,
      body: res.report.body,
      generatedAt: res.report.generated_at,
      origin: res.report.origin,
    };
    setReports((prev) => [next, ...prev.filter((r) => r.reportDate !== next.reportDate)]);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.2em] text-accent">Daily report · {formatDeskLong(data.today)}</p>
      {current ? (
        <>
          <h1 className="mt-3 font-display text-4xl tracking-[-0.03em] text-fg">{current.headline}</h1>
          <p className="mt-4 text-lg leading-relaxed text-paper">{current.lede}</p>
          <p className="mt-3 text-xs text-subtle">
            {current.origin === "model" ? "Written by the IBO Desk model" : "Staff desk copy"} · {current.reportDate}
          </p>
          <ReportBody body={current.body} className="mt-8" />
        </>
      ) : (
        <p className="mt-6 text-muted">No report on file.</p>
      )}
      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={regenerate} disabled={busy}>
          {busy ? "Writing…" : "Generate today's model report"}
        </Button>
        <p className="text-xs text-subtle">Uses the desk model. Cached per day after the first run.</p>
      </div>
      {error ? <p className="mt-3 text-sm text-loss">{error}</p> : null}
    </main>
  );
}
