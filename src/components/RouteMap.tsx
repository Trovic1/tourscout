"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoEqualEarth, geoPath, geoGraticule10 } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
import land110 from "world-atlas/land-110m.json";
import type { CityLead } from "@/lib/types";
import { STATUS_META, cityCode, stopStatus } from "@/lib/present";

// SVG presentation attributes cannot read CSS variables, so the tape palette is mirrored here.
const C = {
  yellow: "#f2c230",
  red: "#ec5a43",
  green: "#4fbf68",
  chalk: "#f2f0ea",
  case: "#0d0d0d",
  chip: "#161616",
  alu: "#8d9399",
  alu4: "#a9afb5",
};
const STATUS_HEX = { anchor: C.green, hold: C.yellow, scout: C.red } as const;

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
}

const CHIP_W = 54;
const CHIP_H = 25;

export function RouteMap({ run, others, selected, onSelect, playKey, insetTop = 0 }: Props) {
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
    const padX = Math.min(110, W * 0.12);
    const top = insetTop + 40;
    if (pts.length >= 2) {
      proj.fitExtent([[padX, top], [W - padX, H - 70]], { type: "MultiPoint", coordinates: pts });
      const maxScale = Math.max(W, H) * 1.6;
      if (proj.scale() > maxScale) {
        const centre = proj.invert!([W / 2, (top + H - 70) / 2])!;
        proj.scale(maxScale).translate([W / 2, (top + H - 70) / 2]);
        const off = proj(centre)!;
        proj.translate([W - off[0], top + H - 70 - off[1]]);
      }
    } else {
      proj.fitExtent([[20, top], [W - 20, H - 20]], { type: "Sphere" });
    }
    return { path: geoPath(proj), project: (c: CityLead) => proj([c.lng, c.lat]) };
  }, [run, others, W, H, insetTop]);

  const legs = run.slice(1).map((c, i) => ({
    d: path({ type: "LineString", coordinates: [[run[i].lng, run[i].lat], [c.lng, c.lat]] }) ?? "",
    key: `${run[i].id}-${c.id}`,
  }));
  const runIds = new Set(run.map((c) => c.id));

  // Greedy label placement: try four corners around each stop, keep the first free one.
  const labels = useMemo(() => {
    const placed: { x: number; y: number }[] = [];
    const hit = (x: number, y: number) =>
      placed.some((p) => x < p.x + CHIP_W + 3 && x + CHIP_W + 3 > p.x && y < p.y + CHIP_H + 3 && y + CHIP_H + 3 > p.y);
    return run.map((c) => {
      const p = project(c);
      if (!p) return null;
      const options = [
        [9, -CHIP_H - 6],
        [-CHIP_W - 9, -CHIP_H - 6],
        [9, 8],
        [-CHIP_W - 9, 8],
        [9, -2 * CHIP_H - 12],
        [-CHIP_W - 9, CHIP_H + 14],
      ];
      const [dx, dy] = options.find(([dx, dy]) => !hit(p[0] + dx, p[1] + dy)) ?? options[0];
      placed.push({ x: p[0] + dx, y: p[1] + dy });
      return { p, dx, dy };
    });
  }, [run, project]);

  return (
    <div ref={box} className="h-full w-full">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Tour route map: ${run.map((c) => c.name).join(" to ")}`}>
        <defs>
          <pattern id="dots" width="5" height="5" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.95" fill="#44484c" />
          </pattern>
        </defs>
        <path d={path(geoGraticule10()) ?? ""} fill="none" stroke="#1b1b1b" strokeWidth={0.6} />
        <path d={path(LAND) ?? ""} fill="url(#dots)" stroke="#2e3134" strokeWidth={0.8} />

        {others
          .filter((c) => !runIds.has(c.id))
          .map((c) => {
            const p = project(c);
            if (!p) return null;
            return (
              <g key={c.id} transform={`translate(${p[0]},${p[1]})`} className="cursor-pointer" onClick={() => onSelect?.(c.id)}>
                <circle r={7} fill="transparent" />
                <circle r={2.6} fill={selected === c.id ? C.yellow : "#6c7177"} />
                <title>{`${c.name} · reserve market · affinity ${Math.round(c.affinity * 100)}`}</title>
              </g>
            );
          })}

        <g key={playKey}>
          {legs.map((l, i) => (
            <path
              key={l.key}
              d={l.d}
              pathLength={1}
              fill="none"
              stroke={C.yellow}
              strokeOpacity={0.92}
              strokeWidth={4}
              strokeLinecap="butt"
              strokeDasharray="1"
              style={{ ["--len" as string]: 1, animation: `tape-lay 560ms var(--ease-out-expo) ${300 + i * 170}ms backwards` }}
            />
          ))}
        </g>

        {run.map((c, i) => {
          const l = labels[i];
          if (!l) return null;
          const st = stopStatus(c, run);
          const sel = selected === c.id;
          return (
            <g key={`${playKey}-${c.id}`} transform={`translate(${l.p[0]},${l.p[1]})`} className="cursor-pointer" onClick={() => onSelect?.(c.id)}>
              <g style={{ animation: `stamp 420ms var(--ease-out-expo) ${200 + i * 170}ms backwards`, transformBox: "fill-box", transformOrigin: "center" }}>
                <line x1={0} y1={0} x2={l.dx < 0 ? l.dx + CHIP_W : l.dx} y2={l.dy < 0 ? l.dy + CHIP_H : l.dy} stroke={C.alu} strokeWidth={1} />
                <circle r={4.5} fill={STATUS_HEX[st]} stroke={C.case} strokeWidth={2} />
                <g transform={`translate(${l.dx},${l.dy})`}>
                  <rect width={CHIP_W} height={CHIP_H - 3} rx={2} fill={sel ? C.yellow : C.chip} stroke={sel ? "none" : C.alu} strokeWidth={1} />
                  <text x={6} y={16} fontFamily="var(--font-bss)" fontSize={17} fontWeight={800} fill={sel ? C.case : C.chalk}>
                    {cityCode(c.name)}
                  </text>
                  <text x={CHIP_W - 6} y={9} textAnchor="end" fontSize={8} fontWeight={700} fill={sel ? C.case : C.alu4} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {String(i + 1).padStart(2, "0")}
                  </text>
                  <rect y={CHIP_H - 3} width={CHIP_W} height={3} fill={STATUS_HEX[st]} />
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
