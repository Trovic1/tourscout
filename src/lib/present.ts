import type { CityLead, TourPlan } from "./types";

const CODES: Record<string, string> = {
  london: "LON", lagos: "LOS", accra: "ACC", johannesburg: "JNB", nairobi: "NBO", paris: "PAR",
  amsterdam: "AMS", brussels: "BRU", berlin: "BER", milan: "MIL", lisbon: "LIS", madrid: "MAD",
  dublin: "DUB", manchester: "MAN", "new york": "NYC", "new york city": "NYC", atlanta: "ATL",
  houston: "HOU", dallas: "DAL", chicago: "CHI", "washington dc": "WAS", washington: "WAS",
  "los angeles": "LAX", miami: "MIA", memphis: "MEM", "st. louis": "STL", "saint louis": "STL",
  detroit: "DTW", charlotte: "CLT", toronto: "YYZ", montreal: "YUL", dubai: "DXB",
  "são paulo": "SAO", "sao paulo": "SAO", "mexico city": "MEX", kingston: "KIN", sydney: "SYD",
  tokyo: "TYO", singapore: "SIN", barcelona: "BCN", rome: "ROM", stockholm: "STO",
  copenhagen: "CPH", oslo: "OSL", vienna: "VIE", zurich: "ZRH", prague: "PRG", glasgow: "GLA",
  birmingham: "BHX", "cape town": "CPT", "abu dhabi": "AUH", doha: "DOH", boston: "BOS",
  philadelphia: "PHL", seattle: "SEA", "san francisco": "SFO", "las vegas": "LAS",
  "new orleans": "MSY", baltimore: "BWI", vancouver: "YVR", "rio de janeiro": "RIO",
};

export function cityCode(name: string) {
  const k = name.toLowerCase().split(",")[0].trim();
  return CODES[k] ?? k.replace(/[^a-z]/g, "").slice(0, 3).toUpperCase();
}

export type StopStatus = "anchor" | "hold" | "scout";

/** Anchor/hold/scout by thirds of the run's own affinity range. */
export function stopStatus(c: CityLead, run: CityLead[]): StopStatus {
  const vals = run.map((r) => r.affinity).sort((a, b) => b - a);
  const hi = vals[Math.floor(vals.length / 3)] ?? 1;
  const lo = vals[Math.floor((vals.length * 2) / 3)] ?? 0;
  if (c.affinity >= hi) return "anchor";
  if (c.affinity >= lo) return "hold";
  return "scout";
}

export const STATUS_META: Record<StopStatus, { label: string; color: string; hex: string; form: string; note: string }> = {
  anchor: { label: "Anchor", color: "var(--color-tape-white)", hex: "#f2f0ea", form: "tape-solid", note: "Strongest taste match in the run. Propose the headline date here." },
  hold: { label: "Hold", color: "var(--color-tape-red)", hex: "#ec5a43", form: "tape-dashed", note: "Solid match. Ask the promoter for a hold." },
  scout: { label: "Scout", color: "var(--color-alu-400)", hex: "#a9afb5", form: "tape-chevron", note: "Emerging market. Test it in a smaller room." },
};

export function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return {
    dow: d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }).toUpperCase(),
    day: d.toLocaleDateString("en-GB", { day: "2-digit", timeZone: "UTC" }),
    mon: d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }).toUpperCase(),
  };
}

export function runCities(plan: TourPlan): CityLead[] {
  const byId = new Map(plan.cities.map((c) => [c.id, c]));
  return plan.route.map((s) => byId.get(s.cityId)).filter((c): c is CityLead => !!c);
}

export const pct = (v?: number) => (v === undefined ? "—" : `${Math.round(v * 100)}`);

/** Affinity is always shown on one 0-100 scale. */
export const score = (v: number) => Math.round(v * 100);

export const AGE_LABELS: Record<string, string> = {
  "24_and_younger": "≤24",
  "25_to_29": "25–29",
  "30_to_34": "30–34",
  "35_to_44": "35–44",
  "45_to_54": "45–54",
  "55_and_older": "55+",
};
