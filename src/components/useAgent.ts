"use client";

import { useCallback, useRef, useState } from "react";
import type { AgentEvent, TourPlan } from "@/lib/types";

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

export function useAgent() {
  const [state, setState] = useState<RunState>("idle");
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [plan, setPlan] = useState<TourPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const run = useCallback(async (input: PlanInput) => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setState("running");
    setSteps([]);
    setNotes([]);
    setError(null);

    const apply = (e: AgentEvent) => {
      if (e.type === "tool") setSteps((s) => [...s, { id: e.id, name: e.name, label: e.label }]);
      else if (e.type === "tool_result")
        setSteps((s) => s.map((x) => (x.id === e.id ? { ...x, summary: e.summary, ms: e.ms, failed: e.summary.startsWith("failed") } : x)));
      else if (e.type === "status" || e.type === "thought") setNotes((n) => [...n, e.type === "status" ? e.message : e.text]);
      else if (e.type === "plan") {
        setPlan(e.plan);
        setState("done");
      } else if (e.type === "error") {
        setError(e.message);
        setState("error");
      }
    };

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
      let gotPlan = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as AgentEvent;
          if (ev.type === "plan") gotPlan = true;
          apply(ev);
        }
      }
      if (!gotPlan) setState((s) => (s === "error" ? s : "error"));
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }, []);

  const reset = useCallback(() => {
    abort.current?.abort();
    setPlan(null);
    setSteps([]);
    setNotes([]);
    setError(null);
    setState("idle");
  }, []);

  return { state, steps, notes, plan, error, run, reset };
}
