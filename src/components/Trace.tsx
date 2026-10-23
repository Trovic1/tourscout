"use client";

import type { RunState, TraceStep } from "./useAgent";

const TOOL_CODE: Record<string, string> = {
  find_act: "ACT",
  rank_cities: "MKT",
  scan_city: "MAP",
  find_co_headliners: "BIL",
  find_sponsors: "BRD",
  audience_profile: "AUD",
  find_market: "MKT",
  market_lineup: "LNP",
  scan_market: "VEN",
};

export function Trace({ steps, state, notes, compact }: { steps: TraceStep[]; state: RunState; notes: string[]; compact?: boolean }) {
  const total = steps.reduce((a, s) => a + (s.ms ?? 0), 0);
  const fallback = notes.find((n) => n.startsWith("Reasoning model unavailable"));
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3 text-[11px] font-semibold tracking-[0.08em] text-alu-400 uppercase">
        <span>{state === "running" ? "Agent loading the truck" : "Agent log"}</span>
        <span className="tnum">
          {steps.length} Qloo calls{total ? ` · ${(total / 1000).toFixed(1)}s` : ""}
        </span>
      </div>
      <ol className={`flex flex-col gap-1 ${compact ? "max-h-56 overflow-auto pr-1" : ""}`}>
        {steps.map((s) => {
          const pending = s.summary === undefined;
          return (
            <li key={s.id} className="stamp-in grid grid-cols-[2.6rem_1fr] items-start gap-2 text-[13px] leading-snug">
              <span
                className={`stencil mt-[1px] rounded-[2px] px-1 py-[1px] text-center text-[12px] font-extrabold ${
                  pending ? "bg-case-700 text-alu-300" : s.failed ? "bg-tape-red text-case-950" : "bg-chalk text-case-950"
                }`}
              >
                {TOOL_CODE[s.name] ?? "QLO"}
              </span>
              <span className="min-w-0">
                <span className="text-chalk">{s.label}</span>
                <span className={`block text-[12px] ${s.failed ? "text-tape-red" : "text-alu-400"}`}>
                  {pending ? <span className="animate-pulse">querying…</span> : `${s.summary}${s.ms ? ` · ${s.ms}ms` : ""}`}
                </span>
              </span>
            </li>
          );
        })}
        {state === "running" && !steps.length && <li className="text-[13px] text-alu-400">Briefing the agent…</li>}
      </ol>
      {fallback && <p className="text-[12px] text-alu-400">Gemini was unavailable, so the rule-based planner finished the run on the same Qloo data.</p>}
    </div>
  );
}
