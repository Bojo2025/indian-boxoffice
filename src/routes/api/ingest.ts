import { createFileRoute } from "@tanstack/react-router";
import { ingestIfStale } from "@/lib/boxoffice/ingest";

export const Route = createFileRoute("/api/ingest")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const result = await ingestIfStale({ force: true });
          return Response.json(result);
        } catch (err) {
          const detail = err instanceof Error ? err.message : "Ingest failed";
          return Response.json({ ok: false, error: detail }, { status: 500 });
        }
      },
    },
  },
});
