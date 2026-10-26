"use client";

import { useCallback, useRef, useState } from "react";
import type { AgentEvent, TourPlan } from "@/lib/types";
import type { Example } from "@/lib/examples";

export interface PlanInput {
  artist?: string;
  home: string;
  refs: { id: string; name: string }[];
}

export interface TraceStep {
  id: string;
  name: string;
  label: string;
  summary?: string;
  ms?: number;
  failed?: boolean;
}

export type RunState = "idle" | "running" | "done" | "error";

interface View {
  state: RunState;
  steps: TraceStep[];
  notes: string[];
  plan: TourPlan | null;
  error: string | null;
}

const EMPTY: View = { state: "idle", steps: [], notes: [], plan: null, error: null };

/** One agent event applied to what the screen shows. Used for live streams and cached replays alike. */
function fold(v: View, e: AgentEvent): View {
  switch (e.type) {
    case "tool":
      return { ...v, steps: [...v.steps, { id: e.id, name: e.name, label: e.label }] };
    case "tool_result":
      return {
        ...v,
        steps: v.steps.map((x) => (x.id === e.id ? { ...x, summary: e.summary, ms: e.ms, failed: e.summary.startsWith("failed") } : x)),
      };
    case "status":
      return { ...v, notes: [...v.notes, e.message] };
    case "thought":
      return { ...v, notes: [...v.notes, e.text] };
    case "plan":
      return { ...v, plan: e.plan, state: "done" };
    case "error":
      return { ...v, error: e.message, state: "error" };
  }
}

export function useAgent() {
  const [view, setView] = useState<View>(EMPTY);
  const abort = useRef<AbortController | null>(null);

  const run = useCallback(async (input: PlanInput) => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setView({ ...EMPTY, state: "running" });

    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal: ctl.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `The planner returned ${res.status}. Try again in a moment.`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) {
            const ev = JSON.parse(line) as AgentEvent;
            setView((v) => fold(v, ev));
          }
        }
      }
      // A stream that ends without a plan or an error was cut off.
      setView((v) =>
        v.state === "running" ? { ...v, state: "error", error: "The planner stopped before finishing. Try again in a moment." } : v,
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setView((v) => ({ ...v, state: "error", error: err instanceof Error ? err.message : String(err) }));
    }
  }, []);

  /** Example runs are planned ahead on the server; replay the cached run in one step, or plan it live if it isn't ready. */
  const openExample = useCallback(
    async (ex: Example) => {
      abort.current?.abort();
      const ctl = new AbortController();
      abort.current = ctl;
      setView({ ...EMPTY, state: "running" });
      try {
        const res = await fetch(`/api/examples/${ex.key}`, { signal: ctl.signal });
        const body = (await res.json()) as { ok?: boolean; events?: AgentEvent[] };
        if (res.ok && body.ok && body.events?.length) {
          setView(body.events.reduce(fold, { ...EMPTY, state: "running" }));
          return;
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
      await run({ home: ex.home, refs: ex.refs });
    },
    [run],
  );

  const reset = useCallback(() => {
    abort.current?.abort();
    setView(EMPTY);
  }, []);

  return { ...view, run, openExample, reset };
}
