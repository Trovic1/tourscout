"use client";

import { useEffect } from "react";
import { useAgent } from "./useAgent";
import { EXAMPLES } from "@/lib/examples";
import { Intake } from "./Intake";
import { PlanView } from "./PlanView";

export function App() {
  const agent = useAgent();
  const { plan, state } = agent;
  const showPlan = plan && state !== "running";
  const { run } = agent;
  const startOver = () => {
    window.history.replaceState(null, "", "/");
    agent.reset();
  };

  // Deep link to an example run, e.g. /?example=lagos, so a finished plan can be shared.
  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("example")?.toLowerCase();
    const ex = EXAMPLES.find((x) => x.home.toLowerCase() === key);
    if (ex) run({ home: ex.home, refs: ex.refs });
  }, [run]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-12 w-full max-w-[1208px] items-center justify-between px-4 sm:px-6">
        <button type="button" onClick={startOver} className="flex items-center gap-2.5" aria-label="TourScout, start over">
          <Mark />
          <span className="text-[15px] font-semibold">TourScout</span>
        </button>
        {showPlan && (
          <button type="button" onClick={startOver} className="btn-quiet h-8 px-3.5 text-[13px]">
            Plan another run
          </button>
        )}
      </header>

      <div className="flex-1">
        {showPlan ? (
          <PlanView plan={plan} steps={agent.steps} notes={agent.notes} state={state} />
        ) : (
          <Intake state={state} steps={agent.steps} notes={agent.notes} error={agent.error} onPlan={agent.run} />
        )}
      </div>

      <footer className="mx-auto flex w-full max-w-[1208px] flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-4 py-8 text-[12px] text-faint sm:px-6">
        <span>
          Fan data from Qloo&apos;s taste graph{plan?.dataSource === "qloo-mock" ? " (demo data)" : ""}. Routes planned by Gemini. Dates are proposals, not
          confirmed holds.
        </span>
        <a href="https://github.com/Trovic1/tourscout" className="text-muted hover:text-ink">
          Source on GitHub
        </a>
      </footer>
    </div>
  );
}

/** A route: home ring, one leg, the next stop. */
function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <circle cx="5" cy="15" r="3.25" fill="none" stroke="#f2b33d" strokeWidth="1.5" />
      <path d="M7.6 13.2 C10 8, 13 6.5, 16.2 7" fill="none" stroke="#f2b33d" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="17.5" cy="7" r="2.5" fill="#f2b33d" />
    </svg>
  );
}
