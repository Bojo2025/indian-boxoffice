import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askDesk } from "@/lib/boxoffice/analyst";
import { getDashboard } from "@/lib/boxoffice/queries";

export const Route = createFileRoute("/desk")({
  loader: () => getDashboard(),
  component: DeskPage,
});

const PROMPTS = [
  "Why do Sacnilk and Hungama disagree on Toxic?",
  "Is Toxic recovering after the weekend, or is the drop structural?",
  "Compare Awarapan 2's hold with Welcome To The Jungle.",
  "What is the 2026 India box office story so far?",
];

type Turn = { role: "user" | "desk"; text: string };

function DeskPage() {
  const dash = Route.useLoaderData();
  const [question, setQuestion] = useState("");
  const [movie, setMovie] = useState("");
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "desk",
      text: "IBO Desk on. The board in front of me is the live scrape — Sacnilk, Hungama, Wikipedia and the wires. Ask about holds, source conflict, recovery versus budget. I will not invent a day-wise number that is not on the file.",
    },
  ]);
  const [busy, setBusy] = useState(false);

  async function submit(q: string) {
    const trimmed = q.trim();
    if (trimmed.length < 4 || busy) return;
    setBusy(true);
    setQuestion("");
    setTurns((t) => [...t, { role: "user", text: trimmed }]);
    const res = await askDesk({ data: { question: trimmed, movieTitle: movie || undefined } });
    setTurns((t) => [
      ...t,
      { role: "desk", text: res.ok ? res.text : res.error },
    ]);
    setBusy(false);
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-accent">Analyst</p>
        <h1 className="mt-2 font-display text-4xl tracking-[-0.03em] text-fg">The desk</h1>
        <p className="mt-3 max-w-xl text-sm text-muted">
          A trade analyst over the live consensus board. Questions are user-initiated. Identical
          questions are served from cache.
        </p>

        <div className="mt-8 space-y-4">
          {turns.map((t, i) => (
            <article
              key={i}
              className={
                t.role === "user"
                  ? "ml-8 rounded-lg bg-surface px-4 py-3 text-sm text-fg"
                  : "rounded-xl bg-bg-elevated px-4 py-4 text-sm leading-relaxed text-paper shadow-[var(--shadow-border)] whitespace-pre-wrap"
              }
            >
              {t.role === "desk" ? (
                <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted">IBO Desk</p>
              ) : null}
              {t.text}
            </article>
          ))}
          {busy ? <p className="text-sm text-muted">Reading the board…</p> : null}
        </div>

        <form
          className="mt-8 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(question);
          }}
        >
          <label className="block text-xs uppercase tracking-[0.14em] text-muted" htmlFor="q">
            Question
          </label>
          <Input
            id="q"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Why is Hungama half of Sacnilk on Toxic Day 1?"
            maxLength={800}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={busy}>
              Send to desk
            </Button>
            <select
              value={movie}
              onChange={(e) => setMovie(e.target.value)}
              className="h-11 rounded-md bg-surface px-3 text-sm text-fg shadow-[var(--shadow-border)]"
            >
              <option value="">No focus film</option>
              {dash.playing.map((m) => (
                <option key={m.id} value={m.title}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>
        </form>
      </div>
      <aside className="space-y-3">
        <p className="text-xs uppercase tracking-[0.16em] text-muted">Suggested</p>
        {PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            className="block w-full rounded-lg bg-surface px-3 py-3 text-left text-sm text-paper hover:text-fg"
            onClick={() => void submit(p)}
          >
            {p}
          </button>
        ))}
      </aside>
    </main>
  );
}
