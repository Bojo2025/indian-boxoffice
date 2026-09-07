import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCr, weekdayName } from "@/lib/boxoffice/format";
import type { ConsensusDay } from "@/lib/boxoffice/types";

export function CollectionChart({ days }: { days: ConsensusDay[] }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const data = days.map((d) => ({
    day: `D${d.dayNumber}`,
    label: `${weekdayName(d.reportDate)} D${d.dayNumber}`,
    net: d.indiaNet,
    ww: d.worldwide,
  }));

  if (!ready) {
    return <div className="h-64 rounded-lg bg-surface" />;
  }

  if (data.length < 2) {
    return (
      <p className="rounded-lg bg-surface px-4 py-8 text-sm text-muted">
        Not enough day-wise points for a curve. Lifetime compilers only filed a single snapshot.
      </p>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: "var(--color-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}`}
            width={36}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              color: "var(--color-fg)",
            }}
            formatter={(value) => formatCr(Number(value))}
            labelFormatter={(_, payload) => (payload?.[0]?.payload?.label as string) ?? ""}
          />
          <Area type="monotone" dataKey="net" stroke="var(--color-accent)" fill="url(#netFill)" strokeWidth={2} name="India net" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
