"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoEqualEarth, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
import land110 from "world-atlas/land-110m.json";
import type { CityLead } from "@/lib/types";

// SVG presentation attributes can't read CSS variables, so the few colours used are mirrored here.
const C = { land: "#1c1c1c", accent: "#f2b33d", ink: "#ffffff", muted: "#b4b4b4", faint: "#949494", dot: "#5a5a5a", ground: "#111111", leader: "#444444" };

const LAND = feature(land110 as unknown as Topology, (land110 as unknown as Topology).objects.land) as unknown as FeatureCollection<Geometry>;

interface Props {
  run: CityLead[];
  /** Ranked cities not on the run, drawn faint for context */
  others: CityLead[];
  selected?: string;
  onSelect?: (id: string) => void;
  /** Changes when a new plan lands, replaying the route animation */
  playKey: string;
}

const LABEL_H = 18;
/** Space reserved above the route for the panel caption. */
const TOP = 88;
const charW = 7.2; // Inter 12px, average advance

export function RouteMap({ run, others, selected, onSelect, playKey }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 420 });

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
    const pts = run.map((c) => [c.lng, c.lat] as [number, number]);
    const proj = geoEqualEarth();
    const pad = Math.min(72, W * 0.1);
    if (pts.length >= 2) {
      proj.fitExtent([[pad, TOP], [W - pad, H - 36]], { type: "MultiPoint", coordinates: pts });
      // Neighbouring cities would otherwise zoom to street level.
      const maxScale = Math.max(W, H) * 1.8;
      if (proj.scale() > maxScale) {
        const mid = (TOP + H - 36) / 2;
        const centre = proj.invert!([W / 2, mid])!;
        proj.scale(maxScale).translate([W / 2, mid]);
        const off = proj(centre)!;
        proj.translate([W - off[0], 2 * mid - off[1]]);
      }
    } else {
      proj.fitExtent([[16, 16], [W - 16, H - 16]], { type: "Sphere" });
    }
    return { path: geoPath(proj), project: (c: CityLead) => proj([c.lng, c.lat]) };
  }, [run, W, H]);

  // Labels: try positions around each stop and take the first that collides with nothing;
  // in a dense cluster the label moves further out on a 1px leader.
  const labels = useMemo(() => {
    const pts = run.map((c) => project(c));
    const placed: { x: number; y: number; w: number }[] = [];
    const free = (x: number, y: number, w: number) =>
      x > 4 && x + w < W - 4 && y > TOP - 24 && y + LABEL_H < H - 4 &&
      !placed.some((p) => x < p.x + p.w + 6 && x + w + 6 > p.x && y < p.y + LABEL_H + 2 && y + LABEL_H + 2 > p.y) &&
      !pts.some((p) => p && p[0] > x - 6 && p[0] < x + w + 6 && p[1] > y - 6 && p[1] < y + LABEL_H + 6);
    return run.map((c, i) => {
      const p = pts[i];
      if (!p) return null;
      const w = c.name.length * charW + 4;
      for (const r of [10, 34, 62, 94]) {
        for (let a = 0; a < 12; a++) {
          const ang = (a * Math.PI) / 6;
          const cx = p[0] + Math.cos(ang) * r;
          const cy = p[1] + Math.sin(ang) * r;
          const x = cx >= p[0] ? cx : cx - w;
          const y = cy - LABEL_H / 2;
          if (free(x, y, w)) {
            placed.push({ x, y, w });
            return { p, x, y, w, far: r > 10 };
          }
        }
      }
      placed.push({ x: p[0] + 8, y: p[1] - LABEL_H, w });
      return { p, x: p[0] + 8, y: p[1] - LABEL_H, w, far: false };
    });
  }, [run, project, W, H]);

  const runIds = new Set(run.map((c) => c.id));

  // Draw the legs in route order. The lines are visible by default; the draw-in starts only
  // once the browser is painting frames, so a background tab or a screenshot never sees an empty route.
  const legs = useRef<SVGGElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const raf = requestAnimationFrame(() => {
      legs.current?.querySelectorAll("path").forEach((p, i) =>
        p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
          duration: 520,
          delay: 200 + i * 160,
          easing: "cubic-bezier(0.25, 1, 0.5, 1)",
          fill: "backwards",
        }),
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [playKey, W, H]);

  return (
    <div ref={box} className="h-full w-full">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Route: ${run.map((c) => c.name).join(", then ")}`}>
        <path d={path(LAND) ?? ""} fill={C.land} />

        {others
          .filter((c) => !runIds.has(c.id))
          .map((c) => {
            const p = project(c);
            if (!p || p[0] < 0 || p[0] > W || p[1] < 0 || p[1] > H) return null;
            return (
              <g key={c.id} transform={`translate(${p[0]},${p[1]})`} className="cursor-pointer" onClick={() => onSelect?.(c.id)}>
                <circle r={9} fill="transparent" />
                <circle r={2.5} fill={selected === c.id ? C.ink : C.dot} />
                <title>{`${c.name}: affinity ${Math.round(c.affinity * 100)}, not on this run`}</title>
              </g>
            );
          })}

        <g key={playKey} ref={legs}>
          {run.slice(1).map((c, i) => {
            const d = path({ type: "LineString", coordinates: [[run[i].lng, run[i].lat], [c.lng, c.lat]] }) ?? "";
            return (
              <path
                key={`${run[i].id}-${c.id}`}
                d={d}
                fill="none"
                stroke={C.accent}
                strokeWidth={2}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray="1"
              />
            );
          })}
        </g>

        {run.map((c, i) => {
          const l = labels[i];
          if (!l) return null;
          const sel = selected === c.id;
          const lx = Math.min(Math.max(l.p[0], l.x), l.x + l.w);
          const ly = l.y + LABEL_H / 2;
          return (
            <g key={c.id} className="cursor-pointer" onClick={() => onSelect?.(c.id)}>
              {l.far && <line x1={l.p[0]} y1={l.p[1]} x2={lx} y2={ly} stroke={C.leader} strokeWidth={1} />}
              <circle cx={l.p[0]} cy={l.p[1]} r={14} fill="transparent" />
              {c.home && <circle cx={l.p[0]} cy={l.p[1]} r={8} fill="none" stroke={sel ? C.accent : C.ink} strokeWidth={1.5} />}
              <circle cx={l.p[0]} cy={l.p[1]} r={sel ? 5 : 4} fill={sel ? C.accent : C.ink} stroke={C.ground} strokeWidth={2} />
              <text x={l.x + 2} y={ly + 4} fontSize={12} fontWeight={sel ? 600 : 500} fill={sel ? C.ink : C.muted}>
                {c.name}
              </text>
              <title>{`${i + 1}. ${c.name}${c.home ? " (home)" : ""}: affinity ${Math.round(c.affinity * 100)}`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
