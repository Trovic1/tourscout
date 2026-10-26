import { cacheLife } from "next/cache";
import { planTour } from "@/lib/agent";
import { EXAMPLES } from "@/lib/examples";
import type { AgentEvent } from "@/lib/types";

/* The five example runs, planned ahead so they open instantly.
 *
 * Each is a full agent run (Qloo + Gemini), computed at build time and kept in the server's
 * cache, then served as a static response. Qloo's hackathon guide allows private server-side
 * caching with no time limit but not Qloo data in a public repo, so nothing here is committed:
 * every deploy plans the examples afresh. */

export const maxDuration = 180;

export function generateStaticParams() {
  return EXAMPLES.map((x) => ({ key: x.key }));
}

// One example at a time: five agent runs at once would trip Gemini's free-tier rate limit.
let queue: Promise<unknown> = Promise.resolve();

async function examplePlan(key: string): Promise<{ ok: boolean; events: AgentEvent[] }> {
  "use cache";
  const example = EXAMPLES.find((x) => x.key === key)!;

  const turn = queue.then(async () => {
    const events: AgentEvent[] = [];
    try {
      await planTour({ home: example.home, refs: example.refs }, (e) => events.push(e));
    } catch (err) {
      events.push({ type: "error", message: err instanceof Error ? err.message : String(err) });
    }
    return events;
  });
  queue = turn.catch(() => undefined);
  const events = await turn;

  const ok = events.some((e) => e.type === "plan");
  // A good plan is kept for weeks. A failed one is kept briefly so the next visitor's request
  // retries it; meanwhile the app falls back to planning the example live.
  if (ok) cacheLife("weeks");
  else cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  return { ok, events };
}

export async function GET(_req: Request, { params }: RouteContext<"/api/examples/[key]">) {
  const { key } = await params;
  if (!EXAMPLES.some((x) => x.key === key)) return Response.json({ ok: false, error: "No such example." }, { status: 404 });
  return Response.json(await examplePlan(key));
}
