"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAgent } from "./useAgent";
import { RouteMap } from "./RouteMap";
import { Trace } from "./Trace";
import { Details } from "./Details";
import type { CityLead, TourPlan } from "@/lib/types";
import { STATUS_META, cityCode, fmtDate, pct, runCities, stopStatus } from "@/lib/present";
import { km } from "@/lib/geo";

type Mode = "act" | "venue";

const PRESETS: Record<Mode, string[]> = {
  act: ["Burna Boy", "Tems", "Asake", "Cedric the Entertainer"],
  venue: ["Atlanta", "London", "Lagos"],
};

const TOUR_WINDOW_DAYS = 42;

export function App() {
  const [mode, setMode] = useState<Mode>("act");
  const [query, setQuery] = useState("Burna Boy");
  const agent = useAgent();
  const { plan, state } = agent;
  // Selection belongs to one plan; a new plan falls back to its first stop.
  const [pick, setPick] = useState<{ plan: TourPlan; id: string }>();
  const selected = pick && pick.plan === plan ? pick.id : plan?.mode === "act" ? runCities(plan)[0]?.id : plan?.market?.id;
  const setSelected = (id: string) => plan && setPick({ plan, id });

  // First visit: show a finished plan, not an empty form.
  useEffect(() => {
    agent.run("act", "Burna Boy");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (m: Mode, q: string) => {
    const v = q.trim();
    if (!v) return;
    setMode(m);
    setQuery(v);
    agent.run(m, v);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar mode={mode} query={query} setQuery={setQuery} setMode={(m) => { setMode(m); setQuery(PRESETS[m][0]); }} submit={submit} running={state === "running"} plan={plan} />
      {agent.error && state === "error" && (
        <div role="alert" className="border-b border-tape-red/40 bg-tape-red/10 px-6 py-3 text-[14px] text-chalk">
          The run stopped: {agent.error} Check the spelling or try one of the presets.
        </div>
      )}
      {plan ? (
        plan.mode === "act" ? (
          <ActBoard plan={plan} agent={agent} selected={selected} onSelect={setSelected} />
        ) : (
          <MarketBoard plan={plan} agent={agent} />
        )
      ) : (
        <Loading agent={agent} />
      )}
      {plan && <Details plan={plan} selected={selected} onSelect={setSelected} />}
      <Footer plan={plan} />
    </div>
  );
}

/* --------------------------------- top bar --------------------------------- */

function TopBar({
  mode, query, setQuery, setMode, submit, running, plan,
}: {
  mode: Mode; query: string; setQuery: (q: string) => void; setMode: (m: Mode) => void;
  submit: (m: Mode, q: string) => void; running: boolean; plan: TourPlan | null;
}) {
  return (
    <header className="sticky top-0 z-20 bg-case-950/95 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="stencil text-[28px] leading-none font-black tracking-[0.04em]">
          Tour<span className="text-tape-yellow">Scout</span>
        </Link>
        <div role="tablist" aria-label="Planning mode" className="flex rounded-[3px] border border-case-600 p-0.5">
          {(["act", "venue"] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-[2px] px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                mode === m ? "bg-chalk text-case-950" : "text-alu-300 hover:text-chalk"
              }`}
            >
              {m === "act" ? "Route an act" : "Program a market"}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(mode, query);
          }}
          className="flex min-w-[260px] flex-1 items-stretch"
        >
          <label htmlFor="q" className="sr-only">
            {mode === "act" ? "Artist, comedian or podcast" : "City"}
          </label>
          <input
            id="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === "act" ? "Any artist, comedian or podcast" : "Any city"}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-l-[3px] border border-r-0 border-case-600 bg-case-900 px-3 py-2 text-[15px] text-chalk placeholder:text-alu-500 focus:border-tape-yellow focus:outline-none"
          />
          <button
            type="submit"
            disabled={running}
            className="rounded-r-[3px] bg-tape-yellow px-4 text-[14px] font-bold text-case-950 transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {running ? "Scouting…" : mode === "act" ? "Route it" : "Program it"}
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS[mode].map((p) => (
            <button
              key={p}
              onClick={() => submit(mode, p)}
              disabled={running}
              className="rounded-[2px] border border-case-600 px-2 py-1 text-[12px] font-medium text-alu-300 transition-colors hover:border-alu-400 hover:text-chalk disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
        {plan && <SourceBadge plan={plan} />}
      </div>
      <div className="alu-rail h-[3px] opacity-70" />
    </header>
  );
}

function SourceBadge({ plan }: { plan: TourPlan }) {
  const live = plan.dataSource === "qloo-live";
  return (
    <span
      title={live ? "Every city, venue, act and brand comes from the live Qloo API." : "Demo data shaped like Qloo responses; set QLOO_API_KEY for live data."}
      className={`ml-auto flex items-center gap-2 rounded-[2px] border px-2 py-1 text-[11px] font-semibold tracking-[0.06em] uppercase ${
        live ? "border-tape-green/50 text-tape-green" : "border-tape-red/60 text-tape-red"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {live ? "Live Qloo data" : "Demo data"}
    </span>
  );
}

/* -------------------------------- act board -------------------------------- */

function ActBoard({ plan, agent, selected, onSelect }: { plan: TourPlan; agent: ReturnType<typeof useAgent>; selected?: string; onSelect: (id: string) => void }) {
  const run = useMemo(() => runCities(plan), [plan]);
  const lead = plan.cities.find((c) => c.id === selected) ?? run[0];
  const [showLog, setShowLog] = useState(false);
  const running = agent.state === "running";

  return (
    <main className="grid flex-1 border-b border-case-700 lg:h-[calc(100vh-68px)] lg:min-h-[620px] lg:grid-cols-[minmax(280px,22rem)_1fr_minmax(320px,24rem)]">
      {lead && <LeadPanel plan={plan} city={lead} run={run} />}

      <div className="relative min-h-[380px] overflow-hidden border-case-700 bg-case-950 lg:border-x">
        <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-3 p-4">
          <div className="max-w-xl">
            <h1 className="text-[clamp(1.4rem,2.2vw,2rem)] leading-tight font-bold tracking-[-0.01em] text-balance">{plan.headline}</h1>
            <p className="mt-1 max-w-prose text-[14px] leading-relaxed text-chalk-dim">{plan.summary}</p>
          </div>
          <Legend />
        </div>
        <div className="absolute inset-0">
          <RouteMap run={run} others={plan.cities} selected={selected} onSelect={onSelect} playKey={plan.headline + run.length} insetTop={110} />
        </div>
        <div className="absolute bottom-3 left-3 z-10 w-[min(26rem,calc(100%-1.5rem))]">
          {running || showLog ? (
            <div className="laminate border border-case-600 p-3 shadow-[0_8px_24px_rgb(0_0_0/0.5)]">
              <Trace steps={agent.steps} state={agent.state} notes={agent.notes} compact />
              {!running && (
                <button onClick={() => setShowLog(false)} className="mt-2 text-[12px] font-semibold text-alu-300 underline underline-offset-4 hover:text-chalk">
                  Hide log
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowLog(true)}
              className="laminate rounded-[2px] border border-case-600 px-3 py-2 text-[12px] font-semibold text-alu-300 transition-colors hover:text-chalk"
            >
              Agent log · <span className="tnum">{agent.steps.length}</span> Qloo calls
            </button>
          )}
        </div>
      </div>

      <RunList plan={plan} run={run} selected={selected} onSelect={onSelect} />
    </main>
  );
}

function Legend() {
  return (
    <ul className="flex gap-3 text-[11px] font-semibold tracking-[0.06em] text-alu-300 uppercase" aria-label="Stop status">
      {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]).map((k) => (
        <li key={k} className="flex items-center gap-1.5" title={STATUS_META[k].note}>
          <span className={`tape ${STATUS_META[k].form} w-6`} style={{ color: STATUS_META[k].color }} />
          {STATUS_META[k].label}
        </li>
      ))}
    </ul>
  );
}

function LeadPanel({ plan, city, run }: { plan: TourPlan; city: CityLead; run: CityLead[] }) {
  const idx = run.findIndex((c) => c.id === city.id);
  const rank = plan.cities.findIndex((c) => c.id === city.id) + 1;
  const st = idx >= 0 ? stopStatus(city, run) : undefined;
  return (
    <aside key={city.id} className="laminate relative flex flex-col overflow-x-hidden overflow-y-auto border-b border-case-700 lg:border-b-0">
      <div className="px-5 pt-5">
        <p className="text-[12px] font-semibold tracking-[0.08em] text-alu-400 uppercase">
          {idx >= 0 ? `Stop ${idx + 1} of ${run.length}` : "Reserve market"} · rank {rank}
        </p>
      </div>
      {/* poster-scale code, cropped by the panel edge */}
      <div aria-hidden className="stencil stamp-in -mr-6 -ml-1 overflow-hidden text-[clamp(6rem,10vw,9.5rem)] leading-[0.82] font-black whitespace-nowrap text-chalk">
        {cityCode(city.name)}
      </div>
      <div className="flex flex-1 flex-col gap-5 px-5 pb-5">
        <div>
          <h2 className="text-[26px] leading-tight font-bold">{city.name}</h2>
          {city.country && <p className="text-[14px] text-alu-400">{city.country}</p>}
        </div>
        <div className="flex items-end gap-4">
          <div>
            <p className="tnum text-[56px] leading-none font-extrabold tracking-[-0.03em]">{pct(city.affinity)}</p>
            <p className="mt-1 text-[12px] font-semibold tracking-[0.06em] text-alu-400 uppercase">Taste affinity / 100</p>
          </div>
          {st && (
            <div className="mb-2 flex flex-col gap-1">
              <span className={`tape ${STATUS_META[st].form} w-16`} style={{ color: STATUS_META[st].color }} />
              <span className="text-[12px] font-semibold" style={{ color: STATUS_META[st].color }}>
                {STATUS_META[st].label}
              </span>
            </div>
          )}
        </div>
        {city.why && <p className="text-[15px] leading-relaxed text-chalk-dim">{city.why}</p>}
        <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-3 border-t border-case-700 pt-4 text-[13px]">
          <div className="col-span-2">
            <dt className="text-alu-400">Best-matched room</dt>
            <dd className="text-[15px] font-semibold">{city.venues?.[0]?.name ?? "Not scanned yet"}</dd>
          </div>
          <div>
            <dt className="text-alu-400">Heat cells mapped</dt>
            <dd className="tnum text-[15px] font-semibold">{city.hotspots?.length ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-alu-400">Venues matched</dt>
            <dd className="tnum text-[15px] font-semibold">{city.venues?.length ?? "—"}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}

function RunList({ plan, run, selected, onSelect }: { plan: TourPlan; run: CityLead[]; selected?: string; onSelect: (id: string) => void }) {
  const first = plan.route[0]?.date;
  const last = plan.route[plan.route.length - 1]?.date;
  const days = first && last ? Math.round((Date.parse(last) - Date.parse(first)) / 864e5) + 1 : 0;
  const dist = run.slice(1).reduce((a, c, i) => a + km(run[i], c), 0);
  return (
    <aside className="laminate flex min-h-0 flex-col">
      <div className="border-b border-case-700 px-5 pt-5 pb-4">
        <h2 className="text-[13px] font-semibold tracking-[0.08em] text-alu-300 uppercase">The run</h2>
        <div className="mt-3 flex h-3 w-full overflow-hidden bg-case-700" role="img" aria-label={`${days} of ${TOUR_WINDOW_DAYS} days used`}>
          <div className="h-full bg-tape-yellow" style={{ width: `${Math.min(100, (days / TOUR_WINDOW_DAYS) * 100)}%` }} />
        </div>
        <p className="tnum mt-2 text-[13px] text-chalk-dim">
          {days} of {TOUR_WINDOW_DAYS} days · {run.length} shows · {Math.round(dist).toLocaleString("en-GB")} km
        </p>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto">
        {plan.route.map((s, i) => {
          const c = run[i];
          if (!c) return null;
          const d = fmtDate(s.date);
          const st = stopStatus(c, run);
          const hop = i > 0 ? km(run[i - 1], c) : 0;
          const on = selected === c.id;
          return (
            <li key={s.cityId}>
              <button
                onClick={() => onSelect(c.id)}
                aria-current={on ? "true" : undefined}
                className={`grid w-full grid-cols-[3.4rem_1fr] gap-3 border-b border-case-800 px-5 py-3 text-left transition-colors ${on ? "bg-case-800" : "hover:bg-case-850"}`}
              >
                <span className="flex flex-col items-start leading-none">
                  <span className="text-[10px] font-bold tracking-[0.1em] text-alu-400">{d.dow}</span>
                  <span className="tnum text-[24px] font-extrabold">{d.day}</span>
                  <span className="text-[10px] font-bold tracking-[0.1em] text-alu-400">{d.mon}</span>
                </span>
                <span className="min-w-0">
                  <span className="flex items-baseline gap-2">
                    <span className={`stencil text-[20px] leading-none font-extrabold ${on ? "text-tape-yellow" : ""}`}>{cityCode(c.name)}</span>
                    <span className="truncate text-[14px] font-semibold">{c.name}</span>
                    <span className="tnum ml-auto text-[13px] font-semibold text-chalk">{pct(c.affinity)}</span>
                  </span>
                  <span className="mt-1 block truncate text-[12px] text-alu-400">{s.venue?.name ?? "Venue to confirm"}{hop ? ` · ${Math.round(hop).toLocaleString("en-GB")} km in` : ""}</span>
                  <span className={`tape ${STATUS_META[st].form} mt-2 block w-full`} style={{ color: STATUS_META[st].color }} aria-label={STATUS_META[st].label} />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

/* ------------------------------- market board ------------------------------- */

function MarketBoard({ plan, agent }: { plan: TourPlan; agent: ReturnType<typeof useAgent> }) {
  const m = plan.market!;
  const lineup = plan.lineup ?? [];
  return (
    <main className="grid flex-1 border-b border-case-700 lg:grid-cols-[minmax(280px,22rem)_1fr_minmax(320px,24rem)]">
      <aside className="laminate flex flex-col overflow-hidden">
        <p className="px-5 pt-5 text-[12px] font-semibold tracking-[0.08em] text-alu-400 uppercase">Market</p>
        <div aria-hidden className="stencil stamp-in -mr-6 -ml-1 overflow-hidden text-[clamp(6rem,10vw,9.5rem)] leading-[0.82] font-black whitespace-nowrap">
          {cityCode(m.name)}
        </div>
        <div className="flex flex-col gap-3 px-5 pb-5">
          <h2 className="text-[26px] font-bold">{m.name}</h2>
          {m.country && <p className="-mt-3 text-[14px] text-alu-400">{m.country}</p>}
          <p className="text-[15px] leading-relaxed text-chalk-dim">{plan.summary}</p>
        </div>
      </aside>
      <section className="border-case-700 px-5 py-5 lg:border-x">
        <h1 className="text-[clamp(1.4rem,2.2vw,2rem)] font-bold text-balance">{plan.headline}</h1>
        <p className="mb-5 text-[14px] text-alu-400">Acts {m.name}&apos;s audience over-indexes on, on one shared 0–100 affinity scale.</p>
        <ol className="flex flex-col">
          {lineup.slice(0, 12).map((e, i) => (
            <li key={e.id} className="grid grid-cols-[2.2rem_1fr_minmax(8rem,40%)] items-center gap-3 border-b border-case-800 py-2.5">
              <span className="tnum text-[13px] font-bold text-alu-400">{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0 truncate text-[15px] font-semibold">
                {e.name}
                {(e.popularity ?? 1) < 0.8 && <span className="ml-2 text-[12px] font-semibold text-tape-red">Rising</span>}
              </span>
              <span className="flex items-center gap-2">
                <span className="relative h-2 flex-1 bg-case-700">
                  <span className="absolute inset-y-0 left-0 bg-tape-blue" style={{ width: `${(e.affinity ?? 0) * 100}%` }} />
                </span>
                <span className="tnum w-7 text-right text-[13px] font-semibold">{pct(e.affinity)}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <aside className="laminate p-5">
        <Trace steps={agent.steps} state={agent.state} notes={agent.notes} />
      </aside>
    </main>
  );
}

function Loading({ agent }: { agent: ReturnType<typeof useAgent> }) {
  return (
    <main className="grid flex-1 place-items-center px-6 py-16">
      <div className="laminate w-full max-w-lg border border-case-600 p-5">
        <Trace steps={agent.steps} state={agent.state} notes={agent.notes} />
      </div>
    </main>
  );
}

function Footer({ plan }: { plan: TourPlan | null }) {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 text-[12px] text-alu-400 sm:px-6">
      <span>
        Cultural-affinity data: Qloo taste graph{plan ? ` (${plan.dataSource === "qloo-live" ? "live" : "demo"})` : ""} · Reasoning:{" "}
        {plan?.reasoning === "gemini" ? "Gemini agent" : "rule-based planner"} · Dates are proposals, not confirmed holds.
      </span>
      <a href="https://github.com/Trovic1/tourscout" className="underline underline-offset-4 hover:text-chalk">
        Source on GitHub
      </a>
    </footer>
  );
}
