"use client";

import type { RunState, TraceStep } from "./useAgent";

/** The agent's work as it happens: one row per Qloo call, with what came back. */
export function RunLog({ steps, state, notes }: { steps: TraceStep[]; state: RunState; notes: string[] }) {
  const fallback = notes.find((n) => n.startsWith("Reasoning model unavailable"));
  return (
    <div>
      <ol className="flex flex-col" aria-live="polite">
        {steps.map((s) => {
          const done = s.summary !== undefined;
          return (
            <li key={s.id} className="grid grid-cols-[20px_1fr_auto] items-start gap-3 py-2.5">
              <span className="mt-[3px] grid size-3.5 place-items-center" aria-hidden>
                {!done ? (
                  <span className="size-2 rounded-full border border-muted" />
                ) : s.failed ? (
                  <span className="size-2 rounded-full bg-negative" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <path d="M3 7.5l2.5 2.5L11 4.5" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="min-w-0">
                <span className={`block ${done ? "text-ink" : "text-muted"}`}>{s.label}</span>
                {done && <span className={`block text-[13px] ${s.failed ? "text-negative" : "text-faint"}`}>{s.summary}</span>}
              </span>
              <span className="num text-[12px] text-faint">{s.ms !== undefined ? `${(s.ms / 1000).toFixed(1)} s` : ""}</span>
            </li>
          );
        })}
        {state === "running" && (
          <li className="grid grid-cols-[20px_1fr] gap-3 py-2.5 text-muted">
            <span />
            <span>{steps.length ? "Thinking about the route…" : "Starting the agent…"}</span>
          </li>
        )}
      </ol>
      {fallback && (
        <p className="mt-2 text-[13px] text-faint">Gemini was busy, so the rule-based planner wrote this plan from the same Qloo data.</p>
      )}
    </div>
  );
}
