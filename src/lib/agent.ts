import { GoogleGenAI, type Content, type FunctionDeclaration } from "@google/genai";
import { Toolkit, orderRoute, scheduleRoute } from "./tools";
import { km } from "./geo";
import type { AgentEvent, CityLead, Entity, TourPlan } from "./types";

// Flash-Lite answers tool calls in 1-3 s; the full Flash model was taking 20-40 s per turn on the
// free tier, which pushed whole runs past their time budget.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest";
const MAX_TURNS = 10;
/** Gemini gets this long in total; after that the rule-based planner finishes from the data
 * already gathered, so a slow model can never push a run past the server's time limit. */
const GEMINI_BUDGET_MS = 70_000;
/** A first run: home plus this many shows. */
const SHOWS = 6;

type Emit = (e: AgentEvent) => void;

export interface PlanRequest {
  /** The emerging artist's own name; optional, and usually unknown to Qloo */
  artist?: string;
  /** Where the artist is based: the opening show */
  home: string;
  /** Acts the artist sounds like, already resolved to Qloo ids by the picker */
  refs: { id: string; name: string }[];
  /** optional free-text goal, e.g. "West Africa only, small rooms" */
  brief?: string;
}

interface Narrative {
  headline: string;
  summary: string;
  city_notes: { city: string; why: string }[];
  route_cities: string[];
  venue_pitch: string;
  sponsor_pitch: string;
  sponsor_angles: { brand: string; angle: string }[];
}

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required });

const TOOLS: FunctionDeclaration[] = [
  {
    name: "rank_cities",
    description:
      "Rank cities by how strongly their residents' taste overlaps with fans of the reference acts. Returns affinity 0-100 and kmFromHome. Worldwide results are limited to sizeable markets; pass countryCode to rank cities inside one country (do this for the home country).",
    parametersJsonSchema: obj({
      take: { type: "integer", description: "max 30" },
      countryCode: { type: "string", description: "ISO-2 country code" },
      minPopularity: { type: "number", description: "0-1 floor on city size, default 0.6" },
    }),
  },
  {
    name: "scan_city",
    description: "For one city: where the fans cluster (heatmap) and the music venues best matched to them.",
    parametersJsonSchema: obj({ city: { type: "string" } }, ["city"]),
  },
  {
    name: "find_bill_mates",
    description:
      'Acts the same fans already love. tier "support" = bigger acts the artist could open for; tier "peer" = acts at a similar stage to share bills or swap support slots with.',
    parametersJsonSchema: obj({ tier: { type: "string", enum: ["support", "peer"] }, take: { type: "integer" } }),
  },
  { name: "find_sponsors", description: "Brands with the strongest taste overlap with these fans.", parametersJsonSchema: obj({ take: { type: "integer" } }) },
  { name: "audience_profile", description: "Age and gender lean of the reference acts' audience.", parametersJsonSchema: obj({}) },
];

const FINALIZE: FunctionDeclaration = {
  name: "finalize_plan",
  description: "Call exactly once, after gathering data. Only reference cities, venues, acts and brands returned by the tools.",
  parametersJsonSchema: obj(
    {
      headline: { type: "string", description: "Name for this first run, max 6 words, no hype words" },
      summary: { type: "string", description: "2-3 plain sentences: the route's logic and the single most useful data-backed insight" },
      city_notes: {
        type: "array",
        items: obj({ city: { type: "string" }, why: { type: "string", description: "One sentence on why this stop, adding what the numbers alone don't show" } }, ["city", "why"]),
      },
      route_cities: { type: "array", items: { type: "string" }, description: `${SHOWS - 2}-${SHOWS} cities from rank_cities, NOT including the home city (it is added as opening night)` },
      venue_pitch: { type: "string", description: "Short, honest email from the artist's team to a small-room booker. Say that fans of the reference acts over-index in their city (Qloo taste data). The artist has no stats yet: never claim streams, listeners, sales or press, for the artist or anyone." },
      sponsor_pitch: { type: "string", description: "Short email to the best-fit local brand, grounded in audience overlap. Ask for something small and real (drinks, travel, merch)." },
      sponsor_angles: { type: "array", items: obj({ brand: { type: "string" }, angle: { type: "string", description: "One-line activation an unknown act could actually get" } }, ["brand", "angle"]) },
    },
    ["headline", "summary", "city_notes", "route_cities", "venue_pitch", "sponsor_pitch", "sponsor_angles"],
  ),
};

function systemPrompt(req: PlanRequest, kit: Toolkit) {
  const s = kit.state;
  const today = new Date().toISOString().slice(0, 10);
  const refs = s.refs.map((r) => r.name).join(", ");
  const home = s.home ? `${s.home.name}${s.home.country ? `, ${s.home.country}` : ""} (country code ${s.home.countryCode ?? "unknown"})` : req.home;
  return `You are TourScout. You plan a FIRST tour for an emerging artist the world doesn't know yet. Today is ${today}.
The artist${s.artist ? `, ${s.artist},` : ""} is based in ${home}. They sound like ${refs}. The artist is not in any database: the fans of ${refs} stand in for their future fans, and every query uses them as the signal.${s.dropped.length ? ` (${s.dropped.map((d) => d.name).join(", ")} had no fan data and was left out.)` : ""}${req.brief ? `\nThe artist's brief: "${req.brief}".` : ""}

Rules:
- Every claim comes from the tools. Never invent cities, venues, acts, brands or numbers.
- This is a first run on a small budget: ${SHOWS - 1}-${SHOWS} shows plus opening night at home. Favour cities reachable by road or a short flight (see kmFromHome). Include a long-haul city only if its affinity is clearly exceptional, and at most one.
- Small rooms, not arenas. Bigger acts are people to open for, not peers.
- Affinity and reach are 0-100; quote them that way ("affinity 94"), never as decimals.
- Write like a booking agent talking to a friend: plain, specific, no hype.
- Call independent tools in parallel.

Strategy: rank_cities (take 20) and rank_cities for the home country (take 10) and audience_profile and find_bill_mates (support) and find_bill_mates (peer) and find_sponsors -> scan_city for the home city and the 4-5 strongest reachable cities -> finalize_plan.`;
}

async function dispatch(kit: Toolkit, name: string, args: Record<string, unknown>) {
  const a = args as never;
  switch (name) {
    case "rank_cities": return kit.rankCities(a);
    case "scan_city": return kit.scanCity(a);
    case "find_bill_mates": return kit.findBillMates(a);
    case "find_sponsors": return kit.findSponsors(a);
    case "audience_profile": return kit.audienceProfile();
    default: throw new Error(`Unknown tool ${name}`);
  }
}

// Flash models hit "high demand" 503s at peak times; retry once, then try the next model.
const MODELS = [...new Set([MODEL, "gemini-3-flash-preview", "gemini-flash-latest"])];
const transient = (msg: string) => /\b(429|500|503|504)\b|high demand|overloaded|deadline|unavailable|fetch failed/i.test(msg);

async function generate(ai: GoogleGenAI, req: Omit<Parameters<GoogleGenAI["models"]["generateContent"]>[0], "model">, deadline: number) {
  let last: unknown;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (Date.now() > deadline) throw new Error("time budget spent");
      try {
        return await ai.models.generateContent({ ...req, model });
      } catch (err) {
        last = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (!transient(msg)) throw err;
        // A rate limit will not clear in a second; move straight to the next model.
        if (/429|quota|rate/i.test(msg)) break;
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }
  throw last;
}

async function geminiAgent(req: PlanRequest, kit: Toolkit, emit: Emit): Promise<Narrative | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  // A hung connection should fall back to the rule-based planner fast, not stall the run.
  const ai = new GoogleGenAI({ apiKey: key, httpOptions: { timeout: 25000 } });
  const deadline = Date.now() + GEMINI_BUDGET_MS;
  const tools = [{ functionDeclarations: [...TOOLS, FINALIZE] }];
  const contents: Content[] = [{ role: "user", parts: [{ text: "Plan the first tour." }] }];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (Date.now() > deadline) throw new Error("time budget spent");
    const res = await generate(ai, { contents, config: { systemInstruction: systemPrompt(req, kit), tools, temperature: 0.4 } }, deadline);
    const parts = res.candidates?.[0]?.content?.parts ?? [];
    contents.push({ role: "model", parts });
    const text = parts.map((p) => p.text).filter(Boolean).join(" ").trim();
    if (text) emit({ type: "thought", text: text.slice(0, 400) });

    const calls = res.functionCalls ?? [];
    if (!calls.length) {
      contents.push({ role: "user", parts: [{ text: "Call the remaining tools you need, then finalize_plan." }] });
      continue;
    }
    const fin = calls.find((c) => c.name === "finalize_plan");
    if (fin) return fin.args as unknown as Narrative;

    const responses = await Promise.all(
      calls.map(async (c) => {
        try {
          const result = await dispatch(kit, c.name!, (c.args ?? {}) as Record<string, unknown>);
          return { functionResponse: { id: c.id, name: c.name, response: { result } } };
        } catch (err) {
          return { functionResponse: { id: c.id, name: c.name, response: { error: err instanceof Error ? err.message : String(err) } } };
        }
      }),
    );
    contents.push({ role: "user", parts: responses });
  }
  return null;
}

/* ---------- deterministic fallback: same tools, template narrative ---------- */

const ORD = ["1st", "2nd", "3rd"];
const ordinal = (i: number) => ORD[i] ?? `${i + 1}th`;

function whyCity(c: CityLead, i: number, n: number, refs: string) {
  const parts = [`Ranks ${ordinal(i)} of ${n} cities for fans of ${refs}.`];
  const hot = c.hotspots?.filter((h) => h.affinity > 0.8).length ?? 0;
  if (hot) parts.push(`They cluster in ${hot} districts, so one well-placed room can carry the night.`);
  if (c.kmFromHome !== undefined && c.kmFromHome < 1200) parts.push(`${c.kmFromHome.toLocaleString("en-GB")} km from home: drivable or a short flight.`);
  return parts.join(" ");
}

/** A first tour weighs taste against travel cost: long-haul cities need a much stronger match. */
const reachScore = (c: CityLead) => c.affinity - Math.min(c.kmFromHome ?? 0, 9000) / 30000;
const LONG_HAUL_KM = 5000;

/** Qloo lists boroughs and neighbouring towns as separate cities (New York, Brooklyn, Newark);
 * on a tour they are one market, so stops this close count as the same place. */
const SAME_MARKET_KM = 60;
const sameMarket = (a: CityLead, b: CityLead) => km(a, b) < SAME_MARKET_KM;

/** Drop stops that repeat a market already on the run (or home), keeping the first. */
function oneStopPerMarket(stops: CityLead[], home?: CityLead) {
  const out: CityLead[] = [];
  for (const c of stops) if (!(home && sameMarket(c, home)) && !out.some((o) => sameMarket(o, c))) out.push(c);
  return out;
}

/** The best-scoring stops, one per market, with at most one long-haul city. */
function pickStops(cities: CityLead[], n: number, home?: CityLead) {
  const out: CityLead[] = [];
  for (const c of [...cities].sort((a, b) => reachScore(b) - reachScore(a))) {
    if ((c.kmFromHome ?? 0) > LONG_HAUL_KM && out.some((o) => (o.kmFromHome ?? 0) > LONG_HAUL_KM)) continue;
    if ((home && sameMarket(c, home)) || out.some((o) => sameMarket(o, c))) continue;
    out.push(c);
    if (out.length === n) break;
  }
  return out;
}

async function rulesAgent(kit: Toolkit): Promise<Narrative> {
  const s = kit.state;
  await Promise.all([
    s.cities.length ? null : kit.rankCities({ take: 20 }).catch(() => null),
    s.home?.countryCode && !s.cities.some((c) => c.countryCode === s.home?.countryCode)
      ? kit.rankCities({ take: 10, countryCode: s.home.countryCode }).catch(() => null)
      : null,
    s.audience ? null : kit.audienceProfile().catch(() => null),
    s.billMates.some((b) => b.tier === "support") ? null : kit.findBillMates({ tier: "support", take: 6 }).catch(() => null),
    s.billMates.some((b) => b.tier === "peer") ? null : kit.findBillMates({ tier: "peer", take: 8 }).catch(() => null),
    s.sponsors.length ? null : kit.findSponsors({ take: 8 }).catch(() => null),
  ]);
  const pick = pickStops(s.cities, SHOWS - 1, s.home);
  if (s.home && !s.home.venues) await kit.scanCity({ city: s.home.name }).catch(() => null);
  for (const c of pick.slice(0, 4)) if (!c.venues) await kit.scanCity({ city: c.name }).catch(() => null);

  const refs = s.refs.map((r) => r.name).join(" + ");
  const who = kit.who;
  const top = [...pick].sort((a, b) => b.affinity - a.affinity)[0];
  const support = s.billMates.find((b) => b.tier === "support");
  const brand = s.sponsors[0];
  return {
    headline: s.home ? `${who === "this artist" ? "First run" : who}: ${s.home.name} and out` : `${who}: first run`,
    summary: `Fans of ${refs} over-index most in ${top?.name ?? "these cities"} (affinity ${Math.round((top?.affinity ?? 0) * 100)}). The route opens at home and stays mostly within reach, so the first run can pay for itself.${support ? ` ${support.name}'s audience overlaps closely: their tour is the one to ask for a support slot on.` : ""}`,
    city_notes: pick.map((c) => ({ city: c.name, why: whyCity(c, s.cities.indexOf(c), s.cities.length, refs) })),
    route_cities: pick.map((c) => c.name),
    venue_pitch: `Hi, I'm booking a first run for ${who === "this artist" ? "an artist I manage" : who}, whose sound sits close to ${refs}. Qloo's taste data shows fans of those acts over-index in your city, and your room matches them better than most. We're looking at a weeknight in the window below and can bring a local support act. Could we talk about a date?`,
    sponsor_pitch: `Hi, ${brand?.name ?? "your brand"}'s customers and fans of ${refs} overlap more than almost any other brand we checked. ${who === "this artist" ? "We're" : `${who} is`} playing a first run of small rooms${s.home ? ` starting in ${s.home.name}` : ""}. Would you support it with product for the shows in return for presence at the merch table and on our posts?`,
    sponsor_angles: s.sponsors.slice(0, 4).map((b) => ({ brand: b.name, angle: "Product at the shows in exchange for merch-table presence" })),
  };
}

/** Models sometimes write line breaks as a literal backslash-n inside function arguments. */
const unescape = (s = "") => s.replace(/\\n/g, "\n").trim();

function assemble(kit: Toolkit, n: Narrative, reasoning: TourPlan["reasoning"]): TourPlan {
  const s = kit.state;
  const refs = s.refs.map((r) => r.name).join(" + ");
  const notes = new Map(n.city_notes?.map((c) => [c.city.toLowerCase(), c.why]) ?? []);
  // The model notes only some cities; the rest get the rule-based note so no stop is left blank.
  s.cities.forEach((c, i) => {
    c.why = notes.get(c.name.toLowerCase()) ?? c.why ?? whyCity(c, i, s.cities.length, refs);
  });
  if (s.home) s.home.why = notes.get(s.home.name.toLowerCase()) ?? "Opening night at home, where the first fans already are.";

  const homeName = s.home?.name.toLowerCase();
  const wanted = (n.route_cities ?? []).map((x) => x.toLowerCase()).filter((x) => x !== homeName);
  let stops = oneStopPerMarket(
    s.cities.filter((c) => wanted.includes(c.name.toLowerCase())),
    s.home,
  );
  if (stops.length < 3) stops = pickStops(s.cities, SHOWS - 1, s.home);
  // Smaller models sometimes pick only two or three cities; top a short run up to a full first
  // run with the best reachable markets they left out, still one stop per market.
  if (stops.length < SHOWS - 1) {
    const extra = pickStops(
      s.cities.filter((c) => !stops.some((x) => sameMarket(x, c))),
      SHOWS - 1 - stops.length,
      s.home,
    ).filter((c) => !(c.kmFromHome !== undefined && c.kmFromHome > LONG_HAUL_KM && stops.some((x) => (x.kmFromHome ?? 0) > LONG_HAUL_KM)));
    stops = [...stops, ...extra];
  }
  const routeCities = orderRoute(s.home ? [s.home, ...stops] : stops);
  const angles = new Map(n.sponsor_angles?.map((x) => [x.brand.toLowerCase(), x.angle]) ?? []);

  return {
    artist: s.artist,
    refs: s.refs,
    dropped: s.dropped,
    home: s.home,
    headline: n.headline,
    summary: n.summary,
    cities: s.cities,
    route: scheduleRoute(routeCities),
    billMates: s.billMates,
    sponsors: s.sponsors.map((b) => ({ ...b, angle: angles.get(b.name.toLowerCase()) })),
    audience: s.audience,
    pitches: { venue: unescape(n.venue_pitch), sponsor: unescape(n.sponsor_pitch) },
    dataSource: kit.q.live ? "qloo-live" : "qloo-mock",
    reasoning,
    plannedAt: new Date().toISOString(),
  };
}

export async function planTour(req: PlanRequest, emit: Emit) {
  const refs: Entity[] = req.refs.map((r) => ({ id: r.id, name: r.name, kind: "artist" }));
  const kit = new Toolkit(emit, refs, req.artist?.trim() || undefined);
  emit({ type: "status", message: "Agent started" });

  // Setup: these must succeed (references) or are worth trying once (home) before any planning.
  const [refsOk] = await Promise.allSettled([kit.checkReferences(), kit.locateHome(req.home)]);
  if (refsOk.status === "rejected") throw refsOk.reason;

  let narrative: Narrative | null = null;
  let reasoning: TourPlan["reasoning"] = "gemini";
  try {
    narrative = await geminiAgent(req, kit, emit);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit({ type: "status", message: `Reasoning model unavailable (${msg.slice(0, 80)}); continuing with rule-based planner` });
  }
  if (!narrative) {
    reasoning = "rules";
    narrative = await rulesAgent(kit);
  }
  // Make sure the essentials exist even if the model skipped a tool.
  if (!kit.state.cities.length) await kit.rankCities({ take: 20 });
  if (!kit.state.cities.length) throw new Error("Qloo returned no cities for these acts. Try adding a better-known reference act.");
  emit({ type: "plan", plan: assemble(kit, narrative, reasoning) });
}
