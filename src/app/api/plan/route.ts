import { planTour, type PlanRequest } from "@/lib/agent";
import type { AgentEvent } from "@/lib/types";

// The agent budgets ~70s for Gemini and then finishes with rules; this leaves ample headroom.
export const maxDuration = 180;

// Finished runs are kept briefly so repeat demos don't burn the free Gemini quota.
const recent = new Map<string, { at: number; events: AgentEvent[] }>();
const KEEP = 1000 * 60 * 30;

const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<PlanRequest>;
  const home = clean(body.home, 80);
  const artist = clean(body.artist, 80) || undefined;
  const brief = clean(body.brief, 300) || undefined;
  const refs = (Array.isArray(body.refs) ? body.refs : [])
    .map((r) => ({ id: clean(r?.id, 80), name: clean(r?.name, 80) }))
    .filter((r) => r.id && r.name)
    .slice(0, 3);
  if (!home) return Response.json({ error: "Add the city the artist is based in." }, { status: 400 });
  if (!refs.length) return Response.json({ error: "Add at least one act the artist sounds like." }, { status: 400 });

  const key = JSON.stringify([artist?.toLowerCase(), home.toLowerCase(), refs.map((r) => r.id).sort(), brief]);
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
        await planTour({ artist, home, refs, brief }, (e) => {
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
