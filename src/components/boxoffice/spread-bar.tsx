import { formatCr } from "@/lib/boxoffice/format";
import type { SourceSpread } from "@/lib/boxoffice/types";

export function SpreadBar({
  spread,
  field = "indiaNet",
}: {
  spread: SourceSpread[];
  field?: "indiaNet" | "worldwide";
}) {
  const values = spread.map((s) => s[field]).filter((v): v is number => v != null && v > 0);
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.16em] text-muted">Source spread</p>
        <p className="font-mono text-xs text-subtle tabular">
          {formatCr(min, 1)} – {formatCr(max, 1)}
        </p>
      </div>
      <div className="relative h-2 rounded-full bg-surface">
        <div
          className="absolute inset-y-0 rounded-full bg-accent/70"
          style={{ left: "0%", width: "100%" }}
        />
      </div>
      <ul className="space-y-2">
        {spread
          .filter((s) => s[field] != null)
          .sort((a, b) => (b[field] ?? 0) - (a[field] ?? 0))
          .map((s) => {
            const v = s[field] ?? 0;
            const pct = ((v - min) / span) * 100;
            return (
              <li key={s.sourceId} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-paper">{s.sourceName}</span>
                    <span className="font-mono text-xs text-muted tabular">{formatCr(v)}</span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-surface">
                    <div
                      className="h-1 rounded-full bg-paper/70"
                      style={{ width: `${Math.max(8, pct)}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
