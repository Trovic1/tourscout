"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoEqualEarth, geoPath, geoGraticule10 } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
import land110 from "world-atlas/land-110m.json";
import type { CityLead } from "@/lib/types";
import { STATUS_META, cityCode, stopStatus, type StopStatus } from "@/lib/present";

// SVG presentation attributes cannot read CSS variables, so the palette is mirrored here.
const C = { yellow: "#f2c230", chalk: "#f2f0ea", case: "#121212", field: "#161616", chip: "#1d1d1d", alu: "#8d9399", alu4: "#a9afb5" };

const LAND = feature(
  land110 as unknown as Topology,
  (land110 as unknown as Topology).objects.land,
) as unknown as FeatureCollection<Geometry>;

interface Props {
  run: CityLead[];
  others: CityLead[];
  selected?: string;
  onSelect?: (id: string) => void;
  /** changes to replay the tape-laying animation for a new plan */
  playKey: string;
  /** top inset reserved for overlaid copy */
  insetTop?: number;
  insetBottom?: number;
}

const CHIP_W = 74;
const CHIP_H = 28;
const TAPE = 7;

/** Spike tape is laid by status: solid white gaff (anchor), dashed red (hold), chevron aluminium (scout). */
function tapeStroke(st: StopStatus) {
  if (st === "hold") return { stroke: STATUS_META.hold.hex, dash: "14 9", cap: "butt" as const };
  if (st === "scout") return { stroke: "url(#chevron)", dash: undefined, cap: "square" as const };
  return { stroke: STATUS_META.anchor.hex, dash: undefined, cap: "square" as const };
}

export function RouteMap({ run, others, selected, onSelect, playKey, insetTop = 0, insetBottom = 0 }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1000, h: 600 });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w: W, h: H } = size;

  const { path, project } = useMemo(() => {
    const pts = (run.length ? run : others).map((c) => [c.lng, c.lat] as [number, number]);
    const proj = geoEqualEarth();
    const padX = Math.min(120, W * 0.12);
    const top = insetTop + 50;
    const bottom = H - insetBottom - 50;
    if (pts.length >= 2) {
      proj.fitExtent([[padX, top], [W - padX, bottom]], { type: "MultiPoint", coordinates: pts });
      const maxScale = Math.max(W, H) * 1.6;
      if (proj.scale() > maxScale) {
        const mid = (top + bottom) / 2;
        const centre = proj.invert!([W / 2, mid])!;
        proj.scale(maxScale).translate([W / 2, mid]);
        const off = proj(centre)!;
        proj.translate([W - off[0], 2 * mid - off[1]]);
      }
    } else {
      proj.fitExtent([[20, top], [W - 20, bottom]], { type: "Sphere" });
    }
    return { path: geoPath(proj), project: (c: CityLead) => proj([c.lng, c.lat]) };
  }, [run, others, W, H, insetTop, insetBottom]);

  const runIds = new Set(run.map((c) => c.id));

  // Label placement: rings of candidate offsets, first free slot wins; leader lines keep dense clusters readable.
  const labels = useMemo(() => {
    const pts = run.map((c) => project(c));
    const placed: { x: number; y: number }[] = [];
    const free = (x: number, y: number) =>
      x > 4 && x + CHIP_W < W - 4 && y > insetTop && y + CHIP_H < H - insetBottom &&
      !placed.some((p) => x < p.x + CHIP_W + 4 && x + CHIP_W + 4 > p.x && y < p.y + CHIP_H + 4 && y + CHIP_H + 4 > p.y) &&
      !pts.some((p) => p && p[0] > x - 5 && p[0] < x + CHIP_W + 5 && p[1] > y - 5 && p[1] < y + CHIP_H + 5);
    return pts.map((p) => {
      if (!p) return null;
      for (const r of [14, 44, 78, 112]) {
        for (let a = 0; a < 16; a++) {
          const ang = (-Math.PI / 4) + (a * Math.PI) / 8;
          const cx = p[0] + Math.cos(ang) * r;
          const cy = p[1] + Math.sin(ang) * r;
          const x = cx >= p[0] ? cx : cx - CHIP_W;
          const y = cy >= p[1] ? cy : cy - CHIP_H;
          if (free(x, y)) {
            placed.push({ x, y });
            return { p, x, y };
          }
        }
      }
      const x = p[0] + 10;
      const y = p[1] - CHIP_H - 10;
      placed.push({ x, y });
      return { p, x, y };
    });
  }, [run, project, W, H, insetTop, insetBottom]);

  return (
    <div ref={box} className="h-full w-full">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Tour route map: ${run.map((c) => c.name).join(" to ")}`}>
        <defs>
          <pattern id="dots" width="5" height="5" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#4a4e53" />
          </pattern>
          <pattern id="chevron" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="4.5" height="9" fill={STATUS_META.scout.hex} />
          </pattern>
          {run.slice(1).map((c, i) => (
            <mask key={`m-${playKey}-${i}`} id={`lay-${i}`} maskUnits="userSpaceOnUse">
              <path
                d={path({ type: "LineString", coordinates: [[run[i].lng, run[i].lat], [c.lng, c.lat]] }) ?? ""}
                pathLength={1}
                fill="none"
                stroke="#fff"
                strokeWidth={TAPE + 6}
                strokeDasharray="1"
                style={{ ["--len" as string]: 1, animation: `tape-lay 620ms var(--ease-out-expo) ${300 + i * 180}ms backwards` }}
              />
            </mask>
          ))}
        </defs>

        <rect width={W} height={H} fill={C.field} />
        <path d={path(geoGraticule10()) ?? ""} fill="none" stroke="#202020" strokeWidth={0.6} />
        <path d={path(LAND) ?? ""} fill="url(#dots)" stroke="#33373b" strokeWidth={0.8} />

        {others
          .filter((c) => !runIds.has(c.id))
          .map((c) => {
            const p = project(c);
            if (!p) return null;
            return (
              <g key={c.id} transform={`translate(${p[0]},${p[1]})`} className="cursor-pointer" onClick={() => onSelect?.(c.id)}>
                <circle r={8} fill="transparent" />
                <circle r={2.8} fill={selected === c.id ? C.yellow : "#70757b"} />
                <title>{`${c.name} · reserve market · affinity ${Math.round(c.affinity * 100)}`}</title>
              </g>
            );
          })}

        {/* tape legs: each leg takes the form of the stop it arrives at */}
        <g key={playKey}>
          {run.slice(1).map((c, i) => {
            const t = tapeStroke(stopStatus(c, run));
            return (
              <path
                key={`${run[i].id}-${c.id}`}
                d={path({ type: "LineString", coordinates: [[run[i].lng, run[i].lat], [c.lng, c.lat]] }) ?? ""}
                fill="none"
                stroke={t.stroke}
                strokeWidth={TAPE}
                strokeLinecap={t.cap}
                strokeDasharray={t.dash}
                strokeOpacity={0.95}
                mask={`url(#lay-${i})`}
              />
            );
          })}
        </g>

        {run.map((c, i) => {
          const l = labels[i];
          if (!l) return null;
          const st = stopStatus(c, run);
          const sel = selected === c.id;
          const lx = Math.min(Math.max(l.p[0], l.x), l.x + CHIP_W);
          const ly = Math.min(Math.max(l.p[1], l.y), l.y + CHIP_H);
          return (
            <g key={`${playKey}-${c.id}`} className="cursor-pointer" onClick={() => onSelect?.(c.id)}>
              <g style={{ animation: `stamp 420ms var(--ease-out-expo) ${200 + i * 180}ms backwards`, transformBox: "fill-box", transformOrigin: "center" }}>
                <line x1={l.p[0]} y1={l.p[1]} x2={lx} y2={ly} stroke={sel ? C.yellow : C.alu} strokeWidth={1.2} />
                <rect x={l.p[0] - 5} y={l.p[1] - 5} width={10} height={10} fill={sel ? C.yellow : STATUS_META[st].hex} stroke={C.case} strokeWidth={2} />
                <g transform={`translate(${l.x},${l.y})`}>
                  <rect width={CHIP_W} height={CHIP_H - 4} rx={2} fill={sel ? C.yellow : C.chip} stroke={sel ? C.yellow : C.alu} strokeWidth={1} />
                  <text x={7} y={18} fontFamily="var(--font-bss)" fontSize={18} fontWeight={800} fontStretch="75%" fill={sel ? C.case : C.chalk}>
                    {cityCode(c.name)}
                  </text>
                  <text x={CHIP_W - 6} y={17} textAnchor="end" fontSize={10.5} fontWeight={700} fill={sel ? C.case : C.alu4} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {String(i + 1).padStart(2, "0")}
                  </text>
                  {st === "hold" ? (
                    <line x1={0} y1={CHIP_H - 2} x2={CHIP_W} y2={CHIP_H - 2} stroke={STATUS_META.hold.hex} strokeWidth={4} strokeDasharray="8 4" />
                  ) : (
                    <rect y={CHIP_H - 4} width={CHIP_W} height={4} fill={st === "scout" ? "url(#chevron)" : STATUS_META.anchor.hex} />
                  )}
                </g>
              </g>
              <title>{`${i + 1}. ${c.name} · affinity ${Math.round(c.affinity * 100)} · ${STATUS_META[st].label}`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
