import { createServerFn } from "@tanstack/react-start";
import { num } from "./format";

function hashPrompt(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) | 0;
  return `h${Math.abs(h).toString(16)}-${input.length}`;
}

type MovieSnap = {
  title: string;
  language: string;
  status: string;
  verdict: string;
  budget: number | null;
  indiaNet: number;
  worldwide: number;
  disagreement: number | null;
  dayNumber: number;
};

async function snapshot(): Promise<MovieSnap[]> {
  const { ensureSeeded } = await import("./seed");
  const { getSql } = await import("@/lib/db");
  await ensureSeeded();
  const sql = await getSql();
  const rows = await sql<{
    title: string;
    language: string;
    status: string;
    verdict: string;
    budget_cr: string | number | null;
    india_net: string | number;
    worldwide: string | number;
    disagreement_pct: string | number | null;
    day_number: number;
  }>`
    select m.title, m.language, m.status, m.verdict, m.budget_cr,
      greatest(
        coalesce((select sum(c.india_net) from consensus_days c where c.movie_id = m.id), 0),
        coalesce((select max(r.india_net) from readings r where r.movie_id = m.id and r.note like 'lifetime%'), 0)
      ) as india_net,
      greatest(
        coalesce((select sum(c.worldwide) from consensus_days c where c.movie_id = m.id), 0),
        coalesce((select max(r.worldwide) from readings r where r.movie_id = m.id and r.note like 'lifetime%'), 0)
      ) as worldwide,
      (select disagreement_pct from consensus_days c where c.movie_id = m.id order by report_date desc limit 1) as disagreement_pct,
      coalesce((select day_number from consensus_days c where c.movie_id = m.id order by report_date desc limit 1), 0) as day_number
    from movies m
    order by worldwide desc
    limit 20
  `;
  return rows.map((r) => ({
    title: r.title,
    language: r.language,
    status: r.status,
    verdict: r.verdict,
    budget: r.budget_cr == null ? null : num(r.budget_cr),
    indiaNet: num(r.india_net),
    worldwide: num(r.worldwide),
    disagreement: r.disagreement_pct == null ? null : num(r.disagreement_pct),
    dayNumber: num(r.day_number),
  }));
}

const SYSTEM = `You are the IBO Desk, the staff analyst of Indian Box Office — an independent consensus desk covering theatrical collections in India.

Rules:
- Figures are in ₹ crore. Prefer India nett for domestic, worldwide gross for global.
- India has no official box-office auditor. Never present a single source as fact. Name the spread.
- Sacnilk and Koimoi are all-India trackers. Bollywood Hungama is often Hindi-weighted and can read ~50% low on pan-India films (Toxic Day 1 is the exhibit).
- Producer statements are claims. Log them, do not launder them into consensus.
- Be a trade paper, not a fan account. Short sentences. No hype words (wow, insane, explosive) unless quoting a drop or a hold.
- If asked for a verdict, use: All Time Blockbuster / Blockbuster / Super Hit / Hit / Average / Flop / Pending, and show recovery vs budget when you have it.
- If data is missing, say so. Do not invent day-wise numbers that are not in the snapshot.
- Keep replies under 450 words unless the user asks for a full report.`;

async function complete(user: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "The desk model is not available in this environment." };
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      max_tokens: 900,
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) return { ok: false, error: `Desk model error ${res.status}` };
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) return { ok: false, error: "Empty desk reply." };
  return { ok: true, text };
}

export const askDesk = createServerFn({ method: "POST" })
  .validator((input: { question: string; movieTitle?: string }) => input)
  .handler(async ({ data }) => {
    const question = data.question.trim().slice(0, 800);
    if (question.length < 4) return { ok: false as const, error: "Ask a real question." };
    const snap = await snapshot();
    const focus = data.movieTitle
      ? snap.find((m) => m.title.toLowerCase() === data.movieTitle!.toLowerCase())
      : undefined;
    const table = snap
      .slice(0, 12)
      .map(
        (m) =>
          `${m.title} (${m.language}, ${m.status}, day ${m.dayNumber}): India net ${m.indiaNet} Cr, WW ${m.worldwide} Cr, spread ${m.disagreement ?? 0}%, budget ${m.budget ?? "n/a"}, ${m.verdict}`,
      )
      .join("\n");
    const prompt = `Snapshot date: today at the Indian Box Office desk.\n${focus ? `Focus film: ${JSON.stringify(focus)}\n` : ""}Board:\n${table}\n\nQuestion: ${question}`;
    const key = hashPrompt(`${focus?.title ?? ""}|${question}`);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const cached = await sql<{ body: string }>`select body from analyses where prompt_hash = ${key} limit 1`;
    if (cached[0]) return { ok: true as const, text: cached[0].body, cached: true };
    const result = await complete(prompt);
    if (!result.ok) return result;
    await sql`
      insert into analyses (movie_id, prompt_hash, body)
      values (${focus ? focus.title : null}, ${key}, ${result.text})
      on conflict (prompt_hash) do nothing
    `;
    return { ok: true as const, text: result.text, cached: false };
  });

export const generateDailyReport = createServerFn({ method: "POST" })
  .validator((input: { force?: boolean } = {}) => input)
  .handler(async ({ data }) => {
    const snap = await snapshot();
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const todayRows = await sql<{ report_date: string }>`
      select report_date::text as report_date from reports order by report_date desc limit 1
    `;
    if (todayRows[0] && !data.force) {
      const existing = await sql<{
        report_date: string;
        headline: string;
        lede: string;
        body: string;
        generated_at: string;
        origin: string;
      }>`select report_date::text as report_date, headline, lede, body, generated_at::text as generated_at, origin from reports where report_date = ${todayRows[0].report_date}`;
      if (existing[0] && !data.force) {
        return { ok: true as const, report: existing[0], reused: true };
      }
    }
    const table = snap
      .map(
        (m) =>
          `${m.title} | ${m.language} | ${m.status} | day ${m.dayNumber} | net ${m.indiaNet} | ww ${m.worldwide} | spread ${m.disagreement ?? 0} | ${m.verdict}`,
      )
      .join("\n");
    const prompt = `Write today's Indian Box Office daily report as markdown.\nFirst line: HEADLINE: <max 12 words>\nSecond line: LEDE: <one sentence>\nThen the report with ## sections: The board / The year / The argument (source disagreement) / What to watch tomorrow.\nBoard:\n${table}`;
    const result = await complete(prompt);
    if (!result.ok) return result;
    const lines = result.text.split("\n");
    const headline = (lines.find((l) => l.startsWith("HEADLINE:")) ?? "").replace(/^HEADLINE:\s*/i, "") || "Monday numbers, with the spread attached";
    const lede = (lines.find((l) => l.startsWith("LEDE:")) ?? "").replace(/^LEDE:\s*/i, "") || result.text.slice(0, 180);
    const body = result.text.replace(/^HEADLINE:.*$/m, "").replace(/^LEDE:.*$/m, "").trim();
    const deskDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    await sql`
      insert into reports (report_date, headline, lede, body, origin)
      values (${deskDate}, ${headline}, ${lede}, ${body}, ${"model"})
      on conflict (report_date) do update set headline = excluded.headline, lede = excluded.lede, body = excluded.body, origin = excluded.origin, generated_at = now()
    `;
    return {
      ok: true as const,
      report: {
        report_date: deskDate,
        headline,
        lede,
        body,
        generated_at: new Date().toISOString(),
        origin: "model",
      },
      reused: false,
    };
  });
