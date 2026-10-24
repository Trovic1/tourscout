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

/** Dates read in sentence case: "Thu", "21", "Jan". */
export function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  const f = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });
  return { dow: f({ weekday: "short" }), day: f({ day: "numeric" }), mon: f({ month: "short" }) };
}

/** Every stop of the run in order, home included. */
export function runCities(plan: TourPlan): CityLead[] {
  const byId = new Map([...plan.cities, ...(plan.home ? [plan.home] : [])].map((c) => [c.id, c]));
  return plan.route.map((s) => byId.get(s.cityId)).filter((c): c is CityLead => !!c);
}

/** Affinity and reach are always shown on one 0-100 scale. */
export const score = (v?: number) => (v === undefined ? undefined : Math.round(v * 100));

export const kmFmt = (n: number) => `${Math.round(n).toLocaleString("en-GB")} km`;

export const refList = (names: string[]) =>
  names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

export const AGE_LABELS: Record<string, string> = {
  "24_and_younger": "24 and under",
  "25_to_29": "25 to 29",
  "30_to_34": "30 to 34",
  "35_to_44": "35 to 44",
  "45_to_54": "45 to 54",
  "55_and_older": "55 and over",
};
