"use client";

import { useMemo, useState } from "react";
import { RouteMap } from "./RouteMap";
import { RunLog } from "./RunLog";
import type { RunState, TraceStep } from "./useAgent";
import type { BillMate, CityLead, TourPlan } from "@/lib/types";
import { AGE_LABELS, fmtDate, kmFmt, refList, runCities, score } from "@/lib/present";
import { km } from "@/lib/geo";

interface Props {
  plan: TourPlan;
  steps: TraceStep[];
  notes: string[];
  state: RunState;
}

const panel = "rounded-[20px] bg-surface p-[22px]";

export function PlanView({ plan, steps, notes, state }: Props) {
  const run = useMemo(() => runCities(plan), [plan]);
  const [selectedId, setSelectedId] = useState(run[0]?.id);
  const all = useMemo(() => [...(plan.home ? [plan.home] : []), ...plan.cities], [plan]);
  const selected = all.find((c) => c.id === selectedId) ?? run[0];
  const refs = refList(plan.refs.map((r) => r.name));

  const first = plan.route[0]?.date;
  const last = plan.route[plan.route.length - 1]?.date;
  const days = first && last ? Math.round((Date.parse(last) - Date.parse(first)) / 864e5) + 1 : 0;
  const travel = run.slice(1).reduce((a, c, i) => a + km(run[i], c), 0);
  const rooms = plan.route.filter((s) => s.venue).length;

  // The one finding: where these fans over-index most, against home.
  const top = [...run].filter((c) => !c.home).sort((a, b) => b.affinity - a.affinity)[0];
  const home = plan.home;
  const finding =
    top && home && home.affinity && top.affinity > home.affinity
      ? `Fans of ${refs} over-index more in ${top.name} (${score(top.affinity)}) than at home in ${home.name} (${score(home.affinity)}).`
      : top
        ? `Fans of ${refs} over-index most in ${top.name}, affinity ${score(top.affinity)} out of 100.`
        : plan.summary;

  return (
    <main className="mx-auto w-full max-w-[1208px] px-4 pt-8 pb-16 sm:px-6">
      {/* title row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-[760px]">
          <h1 className="text-[24px] leading-8 font-semibold tracking-[-0.01em]">{plan.headline}</h1>
          <p className="mt-1 text-[15px] leading-6 text-muted">{finding}</p>
          <p className="mt-1 text-[12px] text-faint">
            {plan.artist ? `${plan.artist} · ` : ""}based in {home?.name ?? "—"} · sounds like {refs}
            {plan.dropped.length ? ` · ${refList(plan.dropped.map((d) => d.name))} left out (no fan data in Qloo)` : ""}
          </p>
        </div>
        <CopyRun plan={plan} run={run} />
      </div>

      {/* figures */}
      {/* one container split by 1px seams: the gap shows the rule colour underneath */}
      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[20px] bg-rule md:grid-cols-4">
        <Figure label="Shows" value={String(run.length)} />
        <Figure label="On the road" value={String(days)} unit={days === 1 ? "day" : "days"} />
        <Figure label="Travel" value={Math.round(travel).toLocaleString("en-GB")} unit="km" />
        <Figure label="Rooms found" value={String(rooms)} unit={`of ${run.length}`} />
      </dl>

      {/* route: the screen's answer */}
      <div className="mt-[14px] grid gap-[14px] lg:grid-cols-12">
        <section className="relative h-[320px] overflow-hidden rounded-[20px] bg-surface sm:h-[420px] lg:col-span-8 lg:h-auto lg:min-h-[440px]" aria-labelledby="route-h">
          <h2 id="route-h" className="pointer-events-none absolute top-[22px] left-[22px] z-10 text-[16px] font-semibold">
            Route
          </h2>
          <p className="pointer-events-none absolute top-[44px] left-[22px] z-10 text-[12px] text-faint">Ring marks home. Grey dots are other matched cities.</p>
          <div className="absolute inset-0">
            <RouteMap run={run} others={plan.cities} selected={selected?.id} onSelect={setSelectedId} playKey={plan.headline + run.length} />
          </div>
        </section>

        <section className={`${panel} lg:col-span-4`} aria-labelledby="run-h">
          <h2 id="run-h" className="text-[16px] font-semibold">
            The run
          </h2>
          {first && last && (
            <p className="text-[12px] text-faint">
              {fmtDate(first).dow} {fmtDate(first).day} {fmtDate(first).mon} to {fmtDate(last).dow} {fmtDate(last).day} {fmtDate(last).mon}, proposed dates
            </p>
          )}
          <ol className="mt-3 flex flex-col gap-1">
            {plan.route.map((s, i) => {
              const c = run[i];
              if (!c) return null;
              const d = fmtDate(s.date);
              const on = selected?.id === c.id;
              return (
                <li key={s.cityId}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    aria-current={on ? "true" : undefined}
                    className={`grid min-h-[52px] w-full grid-cols-[52px_1fr_auto] items-center gap-3 rounded-[12px] px-2.5 text-left transition-colors ${on ? "bg-nested" : "hover:bg-raised"}`}
                  >
                    <span className="flex flex-col leading-4">
                      <span className="text-[12px] text-faint">{d.dow}</span>
                      <span className="num text-[15px] font-medium whitespace-nowrap">
                        {d.day} {d.mon}
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-medium">
                        {c.name}
                        {c.home && <span className="font-normal text-faint"> · home</span>}
                      </span>
                      <span className="block truncate text-[12px] text-faint">{s.venue?.name ?? "Room to find"}</span>
                    </span>
                    <span className="num text-[13px] text-muted" title="Affinity with these fans, 0 to 100">
                      {score(c.affinity) || "—"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      {/* Two stacks rather than rows: panel heights vary with the data (rooms found, acts
          matched), and each stack's last panel grows so both columns end on one line. */}
      <div className="mt-[14px] grid gap-[14px] lg:grid-cols-12">
        <div className="flex flex-col gap-[14px] lg:col-span-7">
          {selected && <StopDetail plan={plan} city={selected} run={run} refs={refs} />}
          <Pitches plan={plan} />
          <Audience plan={plan} />
          <Ranked
            plan={plan}
            run={run}
            onSelect={(id) => {
              setSelectedId(id);
              document.getElementById("stop-h")?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          />
        </div>
        <div className="flex flex-col gap-[14px] lg:col-span-5">
          <BillMates mates={plan.billMates} />
          <Brands plan={plan} />
          <section className={`${panel} flex-1`} aria-labelledby="how-h">
            <h2 id="how-h" className="text-[16px] font-semibold">
              How this was planned
            </h2>
            <p className="text-[12px] text-faint">
              {steps.length} Qloo calls · {plan.reasoning === "gemini" ? "Gemini chose the route" : "rule-based planner"}
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer text-[14px] text-muted hover:text-ink">Show every step</summary>
              <div className="mt-2">
                <RunLog steps={steps} state={state} notes={notes} />
              </div>
            </details>
          </section>
        </div>
      </div>
    </main>
  );
}

function Figure({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bg-surface px-[22px] py-[18px]">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="num mt-1 text-[24px] leading-8">
        {value}
        {unit && <span className="ml-1 text-[14px] text-faint">{unit}</span>}
      </dd>
    </div>
  );
}

function CopyRun({ plan, run }: { plan: TourPlan; run: CityLead[] }) {
  const [copied, setCopied] = useState(false);
  const text = [
    plan.headline,
    `Sounds like ${refList(plan.refs.map((r) => r.name))}`,
    "",
    ...plan.route.map((s, i) => {
      const d = fmtDate(s.date);
      return `${d.dow} ${d.day} ${d.mon}  ${run[i]?.name ?? ""}  ${s.venue?.name ?? "room to find"}`;
    }),
    "",
    "Planned with TourScout from Qloo taste data. Dates are proposals.",
  ].join("\n");
  return (
    <button
      type="button"
      className="btn-primary flex-none"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* clipboard blocked: nothing to undo */
        }
      }}
    >
      {copied ? "Copied" : "Copy run sheet"}
    </button>
  );
}

function StopDetail({ plan, city, run, refs }: { plan: TourPlan; city: CityLead; run: CityLead[]; refs: string }) {
  const idx = run.findIndex((c) => c.id === city.id);
  const stop = idx >= 0 ? plan.route[idx] : undefined;
  const d = stop ? fmtDate(stop.date) : undefined;
  const aff = score(city.affinity) ?? 0;
  const hot = city.hotspots?.filter((h) => h.affinity > 0.8).length ?? 0;
  const homeName = plan.home?.name;

  return (
    <section className={panel} aria-labelledby="stop-h">
      <h2 id="stop-h" className="text-[20px] leading-7 font-semibold">
        {city.name}
        {city.country && <span className="font-normal text-faint">, {city.country}</span>}
      </h2>
      <p className="text-[13px] text-muted">
        {stop && d
          ? `Stop ${idx + 1} of ${run.length} · ${d.dow} ${d.day} ${d.mon}${city.home ? " · opening night at home" : city.kmFromHome !== undefined && homeName ? ` · ${kmFmt(city.kmFromHome)} from ${homeName}` : ""}`
          : `Not on this run${city.kmFromHome !== undefined && homeName ? ` · ${kmFmt(city.kmFromHome)} from ${homeName}` : ""}`}
      </p>

      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-muted">Affinity with fans of {refs}</span>
          <span className="num text-[20px]">
            {city.affinity ? aff : "—"}
            <span className="text-[13px] text-faint"> /100</span>
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-nested" role="img" aria-label={`${aff} out of 100`}>
          <div className="h-full rounded-full bg-accent" style={{ width: `${aff}%` }} />
        </div>
      </div>

      {city.why && <p className="mt-5 text-[15px] leading-6">{city.why}</p>}

      <h3 className="mt-6 text-[14px] font-semibold">Rooms that fit</h3>
      {city.venues?.length ? (
        <ul className="mt-1">
          {city.venues.slice(0, 4).map((v) => (
            <li key={v.id} className="flex items-baseline gap-3 border-b border-rule py-2.5 last:border-0">
              <span className="min-w-0 flex-1 truncate text-[14px]">{v.name}</span>
              {v.neighborhood && <span className="hidden truncate text-[12px] text-faint sm:block">{v.neighborhood}</span>}
              <span className="num w-8 text-right text-[13px] text-muted">{score(v.affinity) ?? "—"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[14px] text-muted">
          {city.venues
            ? "Qloo has no music venues tagged here yet. Ask local promoters which rooms hold 200 to 500 people."
            : "The agent didn't scan rooms here. It scans home and the strongest stops first."}
        </p>
      )}
      {hot > 0 && <p className="mt-3 text-[13px] text-faint">Those fans cluster in {hot} districts of the city: book a room inside one of them.</p>}
    </section>
  );
}

function MateList({ title, note, mates }: { title: string; note: string; mates: BillMate[] }) {
  return (
    <div>
      <h3 className="text-[14px] font-semibold">{title}</h3>
      <p className="text-[12px] text-faint">{note}</p>
      {mates.length ? (
        <ul className="mt-1">
          {mates.slice(0, 5).map((m) => (
            <li key={m.id} className="flex items-baseline justify-between gap-3 border-b border-rule py-2 last:border-0">
              <span className="truncate text-[14px]">{m.name}</span>
              <span className="num flex-none text-[12px] text-faint">reach {score(m.popularity) ?? "—"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[14px] text-muted">None found for these fans.</p>
      )}
    </div>
  );
}

function BillMates({ mates }: { mates: BillMate[] }) {
  return (
    <section className={panel} aria-labelledby="mates-h">
      <h2 id="mates-h" className="text-[16px] font-semibold">
        Who to play with
      </h2>
      <div className="mt-4 flex flex-col gap-6">
        <MateList title="Open for" note="Bigger acts with the same fans: ask their team for a support slot." mates={mates.filter((m) => m.tier === "support")} />
        <MateList title="Share bills with" note="Acts at your stage: co-headline or swap support slots." mates={mates.filter((m) => m.tier === "peer")} />
      </div>
    </section>
  );
}

function Pitches({ plan }: { plan: TourPlan }) {
  const [tab, setTab] = useState<"venue" | "sponsor">("venue");
  const [copied, setCopied] = useState(false);
  const text = tab === "venue" ? plan.pitches.venue : plan.pitches.sponsor;
  const subject = tab === "venue" ? `Date request: ${plan.artist ?? "first run"}` : `Partnership: ${plan.artist ?? "first run"}`;
  return (
    <section className={panel} aria-labelledby="pitch-h">
      <h2 id="pitch-h" className="text-[16px] font-semibold">
        Emails to send
      </h2>
      <div role="tablist" className="mt-3 flex gap-5 border-b border-rule">
        {(
          [
            ["venue", "To a venue booker"],
            ["sponsor", "To a brand"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 pb-2 text-[14px] transition-colors ${tab === k ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-4 rounded-[12px] bg-nested p-4 text-[14px] leading-[22px] whitespace-pre-wrap">{text}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-quiet"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {
              /* clipboard blocked */
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <a className="btn-quiet" href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`}>
          Open in email
        </a>
      </div>
    </section>
  );
}

function Brands({ plan }: { plan: TourPlan }) {
  return (
    <section className={panel} aria-labelledby="brands-h">
      <h2 id="brands-h" className="text-[16px] font-semibold">
        Brands to pitch
      </h2>
      <p className="text-[12px] text-faint">Brands these fans already buy, by taste match</p>
      {plan.sponsors.length ? (
        <ul className="mt-2">
          {plan.sponsors.slice(0, 6).map((b) => (
            <li key={b.id} className="border-b border-rule py-2.5 last:border-0">
              <span className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[14px]">{b.name}</span>
                <span className="num flex-none text-[12px] text-faint">{score(b.affinity) ?? "—"}</span>
              </span>
              {b.angle && <span className="block text-[13px] text-muted">{b.angle}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[14px] text-muted">Qloo found no brands with a clear match for these fans.</p>
      )}
    </section>
  );
}

function Ranked({ plan, run, onSelect }: { plan: TourPlan; run: CityLead[]; onSelect: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const inRun = new Set(run.map((c) => c.id));
  const rows = all ? plan.cities : plan.cities.slice(0, 8);
  return (
    <section className={`${panel} flex-1`} aria-labelledby="rank-h">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="rank-h" className="text-[16px] font-semibold">
          Every city matched
        </h2>
        <span className="num text-[12px] text-faint">{plan.cities.length} cities</span>
      </div>
      <table className="mt-2 w-full text-[14px]">
        <thead>
          <tr className="text-[12px] text-faint">
            <th className="py-2 text-left font-normal">City</th>
            <th className="hidden py-2 text-left font-normal sm:table-cell">Country</th>
            <th className="py-2 text-right font-normal">Affinity</th>
            <th className="py-2 text-right font-normal">From home</th>
            <th className="w-16 py-2 text-right font-normal">On run</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="cursor-pointer border-t border-rule hover:bg-raised" onClick={() => onSelect(c.id)}>
              <td className="py-2.5">
                <button type="button" className="text-left hover:underline" onClick={() => onSelect(c.id)}>
                  {c.name}
                </button>
              </td>
              <td className="hidden py-2.5 text-muted sm:table-cell">{c.country ?? "—"}</td>
              <td className="num py-2.5 text-right">{score(c.affinity)}</td>
              <td className="num py-2.5 text-right text-muted">{c.kmFromHome !== undefined ? kmFmt(c.kmFromHome) : "—"}</td>
              <td className="py-2.5 text-right">{inRun.has(c.id) ? <span className="text-ink">Yes</span> : <span className="text-faint">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {plan.cities.length > 8 && (
        <button type="button" className="mt-3 text-[14px] text-muted hover:text-ink" onClick={() => setAll((v) => !v)}>
          {all ? "Show fewer" : `Show all ${plan.cities.length}`}
        </button>
      )}
    </section>
  );
}

function Audience({ plan }: { plan: TourPlan }) {
  const a = plan.audience;
  return (
    <section className={panel} aria-labelledby="aud-h">
      <h2 id="aud-h" className="text-[16px] font-semibold">
        Who these fans are
      </h2>
      {a ? (
        <>
          <p className="text-[12px] text-faint">Lean against the average listener, by age</p>
          <ul className="mt-3 flex flex-col gap-2">
            {Object.entries(a.age).map(([k, v]) => (
              <li key={k} className="grid grid-cols-[88px_1fr_40px] items-center gap-3 text-[13px]">
                <span className="text-muted">{AGE_LABELS[k] ?? k}</span>
                <span className="relative h-2" aria-hidden>
                  <span className="absolute inset-y-0 left-1/2 w-px bg-control" />
                  <span
                    className="absolute inset-y-0 rounded-full bg-muted"
                    style={v >= 0 ? { left: "50%", width: `${Math.min(50, v * 50)}%` } : { right: "50%", width: `${Math.min(50, -v * 50)}%` }}
                  />
                </span>
                <span className="num text-right">{v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-1 text-[14px] text-muted">Qloo has no age or gender data for these acts yet.</p>
      )}
    </section>
  );
}
