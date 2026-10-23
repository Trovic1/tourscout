"use client";

import { useMemo, useState } from "react";
import type { CityLead, Entity, TourPlan } from "@/lib/types";
import { AGE_LABELS, STATUS_META, cityCode, pct, runCities, stopStatus } from "@/lib/present";

type Tab = "markets" | "venues" | "cobill" | "sponsors" | "audience" | "pitches";

export function Details({ plan, selected, onSelect }: { plan: TourPlan; selected?: string; onSelect: (id: string) => void }) {
  const act = plan.mode === "act";
  const tabs: { id: Tab; label: string; count?: number }[] = act
    ? [
        { id: "markets", label: "Markets", count: plan.cities.length },
        { id: "venues", label: "Venues & hotspots", count: plan.cities.filter((c) => c.venues?.length).length },
        { id: "cobill", label: "Co-bill", count: plan.coHeadliners.length },
        { id: "sponsors", label: "Sponsors", count: plan.sponsors.length },
        { id: "audience", label: "Audience" },
        { id: "pitches", label: "Pitches" },
      ]
    : [
        { id: "cobill", label: "Lineup", count: plan.lineup?.length },
        { id: "venues", label: "Venues", count: plan.market?.venues?.length },
        { id: "sponsors", label: "Sponsors", count: plan.sponsors.length },
        { id: "pitches", label: "Pitches" },
      ];
  const [tab, setTab] = useState<Tab>(tabs[0].id);
  const current = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;

  return (
    <section className="laminate border-t border-case-700">
      <div role="tablist" aria-label="Plan details" className="flex gap-1 overflow-x-auto border-b border-case-700 px-4 sm:px-6">
        {tabs.map((t) => {
          const on = t.id === current;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.id)}
              className={`relative shrink-0 px-3 py-3 text-[13px] font-semibold tracking-[0.04em] uppercase transition-colors ${
                on ? "text-chalk" : "text-alu-400 hover:text-chalk"
              }`}
            >
              {t.label}
              {t.count !== undefined && <span className="tnum ml-1.5 text-alu-500">{t.count}</span>}
              {on && <span className="absolute inset-x-2 -bottom-px h-[3px] bg-tape-yellow" />}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="px-4 py-6 sm:px-6">
        {current === "markets" && <Markets plan={plan} selected={selected} onSelect={onSelect} />}
        {current === "venues" && <Venues plan={plan} selected={selected} onSelect={onSelect} />}
        {current === "cobill" && <Acts list={act ? plan.coHeadliners : plan.lineup ?? []} act={act} />}
        {current === "sponsors" && <Sponsors plan={plan} />}
        {current === "audience" && <Audience plan={plan} />}
        {current === "pitches" && <Pitches plan={plan} />}
      </div>
    </section>
  );
}

/* One fixed 0-100 scale for every affinity bar in the app. */
function AffinityBar({ v, color = "var(--color-tape-blue)" }: { v?: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-full min-w-16 bg-case-700">
        <div className="absolute inset-y-0 left-0" style={{ width: `${Math.max(2, (v ?? 0) * 100)}%`, background: color }} />
      </div>
      <span className="tnum w-7 text-right text-[13px] font-semibold text-chalk">{pct(v)}</span>
    </div>
  );
}

function Markets({ plan, selected, onSelect }: { plan: TourPlan; selected?: string; onSelect: (id: string) => void }) {
  const [sort, setSort] = useState<"affinity" | "name">("affinity");
  const run = runCities(plan);
  const runIdx = new Map(run.map((c, i) => [c.id, i]));
  const rows = useMemo(
    () => [...plan.cities].sort((a, b) => (sort === "affinity" ? b.affinity - a.affinity : a.name.localeCompare(b.name))),
    [plan.cities, sort],
  );
  const th = "py-2 pr-4 text-left text-[11px] font-semibold tracking-[0.08em] text-alu-400 uppercase";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b border-case-700">
            <th className={`${th} w-12`}>#</th>
            <th className={th}>
              <button onClick={() => setSort("name")} className={sort === "name" ? "text-chalk" : "hover:text-chalk"}>
                Market {sort === "name" && "↓"}
              </button>
            </th>
            <th className={`${th} w-[40%]`}>
              <button onClick={() => setSort("affinity")} className={sort === "affinity" ? "text-chalk" : "hover:text-chalk"}>
                Taste affinity {sort === "affinity" && "↓"}
              </button>
            </th>
            <th className={th}>In run</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => {
            const ri = runIdx.get(c.id);
            const st = ri !== undefined ? stopStatus(c, run) : undefined;
            return (
              <tr
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`cursor-pointer border-b border-case-800 transition-colors hover:bg-case-800 ${selected === c.id ? "bg-case-800" : ""}`}
              >
                <td className="tnum py-2.5 pr-4 text-[13px] text-alu-400">{String(i + 1).padStart(2, "0")}</td>
                <td className="py-2.5 pr-4">
                  <span className="stencil mr-2 text-[17px] font-extrabold">{cityCode(c.name)}</span>
                  <span className="text-[14px]">{c.name}</span>
                  {c.country && <span className="ml-2 text-[13px] text-alu-400">{c.country}</span>}
                </td>
                <td className="py-2.5 pr-4">
                  <AffinityBar v={c.affinity} />
                </td>
                <td className="py-2.5 pr-4 text-[13px]">
                  {st ? (
                    <span className="flex items-center gap-2">
                      <span className={`tape ${STATUS_META[st].form} w-8`} style={{ color: STATUS_META[st].color }} />
                      {STATUS_META[st].label} · stop {ri! + 1}
                    </span>
                  ) : (
                    <span className="text-alu-500">Reserve</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CityHeat({ city }: { city: CityLead }) {
  const pts = city.hotspots ?? [];
  const venues = (city.venues ?? []).filter((v) => v.lat !== undefined && v.lng !== undefined);
  const all = [...pts, ...venues.map((v) => ({ lat: v.lat!, lng: v.lng! }))];
  if (!all.length) return <p className="text-[13px] text-alu-400">No geospatial data returned for {city.name}.</p>;
  const lats = all.map((p) => p.lat);
  const lngs = all.map((p) => p.lng);
  const [a0, a1, o0, o1] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const S = 320;
  const pad = 24;
  const span = Math.max(a1 - a0, (o1 - o0) * Math.cos((city.lat * Math.PI) / 180), 0.01);
  const x = (lng: number) => pad + (((lng - o0) * Math.cos((city.lat * Math.PI) / 180)) / span) * (S - pad * 2);
  const y = (lat: number) => S - pad - ((lat - a0) / span) * (S - pad * 2);
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="aspect-square w-full max-w-[320px] bg-case-950" role="img" aria-label={`Fan hotspots in ${city.name}`}>
      {pts.map((p, i) => (
        <circle key={i} cx={x(p.lng)} cy={y(p.lat)} r={6 + p.affinity * 16} fill="#f2c230" opacity={0.08 + p.affinity * 0.32} />
      ))}
      {venues.map((v, i) => (
        <g key={v.id} transform={`translate(${x(v.lng!)},${y(v.lat!)})`}>
          <rect x={-8} y={-8} width={16} height={16} fill="#0d0d0d" stroke="#f2f0ea" />
          <text y={4} textAnchor="middle" fontSize={10} fontWeight={800} fill="#f2f0ea" className="tnum">
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Venues({ plan, selected, onSelect }: { plan: TourPlan; selected?: string; onSelect: (id: string) => void }) {
  const scanned = plan.mode === "venue" ? (plan.market ? [plan.market] : []) : plan.cities.filter((c) => c.venues?.length || c.hotspots?.length);
  const city = scanned.find((c) => c.id === selected) ?? scanned[0];
  if (!city) return <p className="text-[14px] text-alu-400">The agent did not scan any cities on this run.</p>;
  return (
    <div className="flex flex-col gap-5">
      {scanned.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Scanned cities">
          {scanned.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              aria-pressed={c.id === city.id}
              className={`stencil rounded-[2px] border px-2.5 py-1 text-[16px] font-extrabold transition-colors ${
                c.id === city.id ? "border-tape-yellow bg-tape-yellow text-case-950" : "border-alu-500 text-chalk hover:border-chalk"
              }`}
            >
              {cityCode(c.name)}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-2">
          <CityHeat city={city} />
          <p className="text-[12px] text-alu-400">Yellow glow: where {plan.act?.name ?? "this market"}&apos;s taste concentrates (Qloo heatmap). Numbered squares: venues.</p>
        </div>
        <ol className="flex flex-col divide-y divide-case-700 border-y border-case-700">
          {(city.venues ?? []).map((v, i) => (
            <li key={v.id} className="grid grid-cols-[2rem_1fr_9rem] items-center gap-3 py-3">
              <span className="tnum text-[13px] font-bold text-alu-400">{i + 1}</span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold">{v.name}</span>
                <span className="block truncate text-[12px] text-alu-400">{[v.neighborhood, v.address ?? v.city].filter(Boolean).join(" · ") || city.name}</span>
              </span>
              <AffinityBar v={v.affinity} color="var(--color-tape-yellow)" />
            </li>
          ))}
          {!city.venues?.length && <li className="py-3 text-[14px] text-alu-400">No matched venues returned for {city.name}.</li>}
        </ol>
      </div>
    </div>
  );
}

function Acts({ list, act }: { list: Entity[]; act: boolean }) {
  if (!list.length) return <p className="text-[14px] text-alu-400">No acts returned on this run.</p>;
  return (
    <div className="grid gap-x-8 sm:grid-cols-2">
      {list.map((e, i) => {
        const rising = (e.popularity ?? 1) < 0.8;
        return (
          <div key={e.id} className="grid grid-cols-[2rem_1fr_8rem] items-center gap-3 border-b border-case-800 py-3">
            <span className="tnum text-[13px] font-bold text-alu-400">{String(i + 1).padStart(2, "0")}</span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{e.name}</span>
              <span className="text-[12px] text-alu-400">
                {rising ? <span className="font-semibold text-tape-red">Rising · affordable {act ? "support" : "booking"}</span> : act ? "Co-headline calibre" : "Proven draw"}
                {e.popularity !== undefined && ` · popularity ${pct(e.popularity)}`}
              </span>
            </span>
            <AffinityBar v={e.affinity} />
          </div>
        );
      })}
    </div>
  );
}

function Sponsors({ plan }: { plan: TourPlan }) {
  if (!plan.sponsors.length) return <p className="text-[14px] text-alu-400">No brand matches returned on this run.</p>;
  return (
    <ol className="grid gap-x-8 sm:grid-cols-2">
      {plan.sponsors.map((b, i) => (
        <li key={b.id} className="grid grid-cols-[2rem_1fr_8rem] items-start gap-3 border-b border-case-800 py-3">
          <span className="tnum pt-0.5 text-[13px] font-bold text-alu-400">{String(i + 1).padStart(2, "0")}</span>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold">{b.name}</span>
            {b.angle && <span className="block text-[13px] text-chalk-dim">{b.angle}</span>}
          </span>
          <AffinityBar v={b.affinity} color="var(--color-tape-green)" />
        </li>
      ))}
    </ol>
  );
}

function Audience({ plan }: { plan: TourPlan }) {
  const a = plan.audience;
  if (!a) return <p className="text-[14px] text-alu-400">Qloo returned no demographic data for this act.</p>;
  const max = Math.max(...Object.values(a.age).map(Math.abs), 0.1);
  const g = a.gender;
  return (
    <div className="grid gap-10 md:grid-cols-[1.4fr_1fr]">
      <div>
        <h3 className="mb-1 text-[15px] font-semibold">Age affinity</h3>
        <p className="mb-4 text-[13px] text-alu-400">Bars right of the rule over-index versus the average audience.</p>
        <div className="flex flex-col gap-2">
          {Object.entries(a.age).map(([k, v]) => (
            <div key={k} className="grid grid-cols-[3.5rem_1fr_3rem] items-center gap-3">
              <span className="tnum text-[13px] text-alu-300">{AGE_LABELS[k] ?? k}</span>
              <div className="relative h-4">
                <div className="absolute inset-y-[-3px] left-1/2 w-px bg-alu-500" />
                <div
                  className="absolute inset-y-0"
                  style={{
                    left: v >= 0 ? "50%" : `${50 - (Math.abs(v) / max) * 50}%`,
                    width: `${(Math.abs(v) / max) * 50}%`,
                    background: v >= 0 ? "var(--color-tape-blue)" : "var(--color-case-600)",
                  }}
                />
              </div>
              <span className={`tnum text-right text-[13px] font-semibold ${v >= 0 ? "text-chalk" : "text-alu-400"}`}>
                {v > 0 ? "+" : ""}
                {Math.round(v * 100)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-1 text-[15px] font-semibold">Gender skew</h3>
        <p className="mb-4 text-[13px] text-alu-400">Relative affinity, not head count.</p>
        {Object.entries(g).map(([k, v]) => (
          <div key={k} className="mb-3 grid grid-cols-[4rem_1fr_3rem] items-center gap-3">
            <span className="text-[13px] capitalize text-alu-300">{k}</span>
            <div className="h-2 bg-case-700">
              <div className="h-full" style={{ width: `${Math.max(2, 50 + v * 100)}%`, background: "var(--color-tape-blue)" }} />
            </div>
            <span className="tnum text-right text-[13px] font-semibold">
              {v > 0 ? "+" : ""}
              {Math.round(v * 100)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Pitches({ plan }: { plan: TourPlan }) {
  const items = [
    { title: plan.mode === "act" ? "To promoters & talent buyers" : "To the artist's agent", body: plan.pitches.booking },
    { title: `To ${plan.sponsors[0]?.name ?? "the top sponsor"}`, body: plan.pitches.sponsor },
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {items.map((p) => (
        <Pitch key={p.title} {...p} />
      ))}
    </div>
  );
}

function Pitch({ title, body }: { title: string; body: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <article className="flex flex-col border border-case-700 bg-case-950">
      <header className="flex items-center justify-between gap-3 border-b border-case-700 px-4 py-2.5">
        <h3 className="text-[13px] font-semibold tracking-[0.04em] uppercase text-alu-300">{title}</h3>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(body);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
          className="rounded-[2px] border border-alu-500 px-2.5 py-1 text-[12px] font-semibold text-chalk transition-colors hover:border-tape-yellow hover:text-tape-yellow"
        >
          {copied ? "Copied" : "Copy email"}
        </button>
      </header>
      <p className="whitespace-pre-line px-4 py-4 text-[15px] leading-relaxed text-chalk">{body}</p>
    </article>
  );
}
