const IST = "Asia/Kolkata";

export function deskDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function formatDeskLong(isoDate: string): string {
  const d = parseIsoDate(isoDate);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatDeskShort(isoDate: string): string {
  const d = parseIsoDate(isoDate);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    day: "numeric",
    month: "short",
  }).format(d);
}

export function parseIsoDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00+05:30`);
}

export function addDays(isoDate: string, days: number): string {
  const d = parseIsoDate(isoDate);
  d.setDate(d.getDate() + days);
  return deskDate(d);
}

export function dayNumberOn(releaseDate: string, reportDate: string): number {
  const a = parseIsoDate(releaseDate).getTime();
  const b = parseIsoDate(reportDate).getTime();
  return Math.floor((b - a) / 86_400_000) + 1;
}

export function weekdayName(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    weekday: "short",
  }).format(parseIsoDate(isoDate));
}

export function num(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function formatCr(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-IN", {
    minimumFractionDigits: abs >= 100 ? 1 : digits,
    maximumFractionDigits: abs >= 100 ? 1 : digits,
  });
  return `₹${formatted} Cr`;
}

export function formatCrCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 100) {
    return `₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`;
  }
  return `₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} Cr`;
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function formatInt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return Math.round(value).toLocaleString("en-IN");
}

export function recovery(indiaNet: number, budget: number | null): number | null {
  if (!budget || budget <= 0) return null;
  return (indiaNet / budget) * 100;
}
