import { planTour, type PlanRequest } from "@/lib/agent";
import type { AgentEvent } from "@/lib/types";

export const maxDuration = 120;

// Finished runs are kept briefly so repeat demos don't burn the free Gemini quota.
const recent = new Map<string, { at: number; events: AgentEvent[] }>();
const KEEP = 1000 * 60 * 30;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<PlanRequest>;
  const query = String(body.query ?? "").trim().slice(0, 80);
  const mode = body.mode === "venue" ? "venue" : "act";
  const brief = body.brief ? String(body.brief).slice(0, 300) : undefined;
  if (!query) return Response.json({ error: "query required" }, { status: 400 });

  const key = `${mode}:${query.toLowerCase()}:${brief ?? ""}`;
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: AgentEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      const hit = recent.get(key);
      if (hit && Date.now() - hit.at < KEEP) {
        for (const e of hit.events) send(e);
        controller.close();
        return;
      }
      const log: AgentEvent[] = [];
      try {
        await planTour({ mode, query, brief }, (e) => {
          log.push(e);
          send(e);
        });
        if (log.some((e) => e.type === "plan")) recent.set(key, { at: Date.now(), events: log });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
