import { createFileRoute } from "@tanstack/react-router";
import { SOURCES } from "@/lib/boxoffice/catalog";

export const Route = createFileRoute("/sources")({
  component: SourcesPage,
});

function SourcesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.2em] text-accent">Methodology</p>
      <h1 className="mt-2 font-display text-4xl tracking-[-0.03em] text-fg">How the desk counts</h1>
      <div className="mt-8 space-y-5 text-sm leading-relaxed text-paper">
        <p>
          India has no official theatrical auditor. Every public number is an estimate: a trade
          tracker, a newsroom repeating a tracker, a producer statement, or a Wikipedia compilation
          of those. Indian Box Office does not pretend to own a primary count. It publishes a{" "}
          <strong className="text-fg">weighted median</strong> of what those desks have already printed,
          and it prints the spread beside it.
        </p>
        <p>
          <strong className="text-fg">India nett</strong> is the working unit for domestic performance
          (distributor share after entertainment tax / GST).{" "}
          <strong className="text-fg">Worldwide</strong> is gross. Mixing them is how most viral posts
          lie.
        </p>
        <p>
          Bollywood Hungama is treated as a Hindi-weighted trade table. On a pan-India film it can
          read at roughly half of Sacnilk/Koimoi on opening day — Toxic, 26 August 2026, is the
          exhibit (₹50.31 Cr vs ₹101.10 Cr). That is not a bug in our math. It is a coverage gap, and
          the film page says so.
        </p>
        <p>
          Producer statements are logged as claims and given the lowest weight. They never set
          consensus on their own. Range titles (Peddi ₹330–400 Cr) sit at the midpoint with a
          disagreement flag.
        </p>
        <p>
          Live ingest hits Sacnilk film pages (day-wise India net, gross, shows, occupancy and
          lifetime worldwide), Bollywood Hungama 2026 worldwide table plus per-title day-wise pages,
          Wikipedia compiled 2026 ranking, Pinkvilla box-office desk, Box Office India trade notes,
          ETimes RSS and The Hindu entertainment feed. Koimoi and Indian Express HTML are routinely
          bot-walled; when a tracker refuses the request we keep the last published table on the
          file and mark the source blocked on Wires.
        </p>
      </div>
      <ul className="mt-10 divide-y divide-border">
        {SOURCES.map((s) => (
          <li key={s.id} className="py-4">
            <div className="flex items-baseline justify-between gap-3">
              {s.homepage.startsWith("http") ? (
                <a href={s.homepage} className="text-fg hover:text-paper" target="_blank" rel="noreferrer">
                  {s.name}
                </a>
              ) : (
                <span className="text-fg">{s.name}</span>
              )}
              <span className="font-mono text-xs text-subtle">w {s.weight.toFixed(2)} · {s.kind}</span>
            </div>
            <p className="mt-1 text-sm text-muted">{s.notes}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
