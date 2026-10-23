import { GoogleGenAI, type Content, type FunctionDeclaration } from "@google/genai";
import { Toolkit, orderRoute, scheduleRoute } from "./tools";
import type { AgentEvent, CityLead, TourPlan } from "./types";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const MAX_TURNS = 10;

type Emit = (e: AgentEvent) => void;

export interface PlanRequest {
  mode: "act" | "venue";
  query: string;
  /** optional free-text goal, e.g. "first UK + Europe run, 10 dates" */
  brief?: string;
}

interface Narrative {
  headline: string;
  summary: string;
  city_notes: { city: string; why: string }[];
  route_cities: string[];
  booking_pitch: string;
  sponsor_pitch: string;
  sponsor_angles: { brand: string; angle: string }[];
}

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required });

const ACT_TOOLS: FunctionDeclaration[] = [
  { name: "find_act", description: "Resolve an artist, comedian or podcast to a Qloo entity. Always call first.", parametersJsonSchema: obj({ name: { type: "string" } }, ["name"]) },
  { name: "rank_cities", description: "Rank cities worldwide (or within one country) by how strongly their residents' cultural taste overlaps with the act's audience. Returns affinity 0-1.", parametersJsonSchema: obj({ take: { type: "integer", description: "max 30" }, countryCode: { type: "string", description: "ISO-2 country code to rank cities inside one country" } }) },
  { name: "scan_city", description: "For one city from rank_cities: geospatial heatmap of where the act's fans cluster, plus the best-matched live music venues.", parametersJsonSchema: obj({ city: { type: "string" } }, ["city"]) },
  { name: "find_co_headliners", description: "Acts whose fans share this act's taste. rising=true limits to less-famous acts (good openers / affordable support).", parametersJsonSchema: obj({ take: { type: "integer" }, rising: { type: "boolean" } }) },
  { name: "find_sponsors", description: "Brands with the highest audience-taste overlap with the act.", parametersJsonSchema: obj({ take: { type: "integer" } }) },
  { name: "audience_profile", description: "Age and gender affinity of the act's audience.", parametersJsonSchema: obj({}) },
];

const VENUE_TOOLS: FunctionDeclaration[] = [
  { name: "find_market", description: "Resolve a city to a Qloo locality. Always call first.", parametersJsonSchema: obj({ city: { type: "string" } }, ["city"]) },
  { name: "market_lineup", description: "Acts that this city's audience over-indexes on. rising=true limits to less-famous acts (cheaper to book, higher upside).", parametersJsonSchema: obj({ take: { type: "integer" }, rising: { type: "boolean" } }) },
  { name: "scan_market", description: "Live music venues in the market best matched to its taste.", parametersJsonSchema: obj({}) },
  { name: "find_sponsors", description: "Brands with the highest taste overlap with this market.", parametersJsonSchema: obj({ take: { type: "integer" } }) },
];

const FINALIZE: FunctionDeclaration = {
  name: "finalize_plan",
  description: "Call exactly once, after gathering data, to deliver the plan. Only reference cities, venues, acts and brands returned by the tools.",
  parametersJsonSchema: obj(
    {
      headline: { type: "string", description: "Punchy tour/season name, max 6 words" },
      summary: { type: "string", description: "2-3 sentences: the strategy and the single most surprising data-backed insight" },
      city_notes: { type: "array", items: obj({ city: { type: "string" }, why: { type: "string", description: "One sentence, cite the affinity or hotspot data" } }, ["city", "why"]) },
      route_cities: { type: "array", items: { type: "string" }, description: "Act mode: 6-10 cities to play, chosen from rank_cities. Venue mode: empty." },
      booking_pitch: { type: "string", description: "Short email to a promoter/booker (act mode) or to an act's agent (venue mode), grounded in the data" },
      sponsor_pitch: { type: "string", description: "Short email to the top sponsor, grounded in audience overlap" },
      sponsor_angles: { type: "array", items: obj({ brand: { type: "string" }, angle: { type: "string", description: "One-line activation idea" } }, ["brand", "angle"]) },
    },
    ["headline", "summary", "city_notes", "route_cities", "booking_pitch", "sponsor_pitch", "sponsor_angles"],
  ),
};

function systemPrompt(req: PlanRequest) {
  const today = new Date().toISOString().slice(0, 10);
  const common = `You are TourScout, a touring strategist for the live-entertainment industry. Today is ${today}.
You have no opinions about where people live or what they like: every claim must come from the Qloo taste-graph tools.
Work efficiently: call independent tools in parallel when possible. Never invent cities, venues, acts or brands.
Finish by calling finalize_plan exactly once.`;
  if (req.mode === "act")
    return `${common}
Goal: build a data-backed tour for the act "${req.query}".${req.brief ? ` The user's brief: "${req.brief}".` : ""}
Strategy: find_act -> rank_cities (take 20) and audience_profile and find_co_headliners and find_sponsors -> scan_city for the 4-6 most promising cities (favour high affinity, and flag markets the act may be under-playing) -> finalize_plan.`;
  return `${common}
Goal: program the live-music calendar for the market "${req.query}" — tell a promoter which acts its audience would buy tickets for.${req.brief ? ` The user's brief: "${req.brief}".` : ""}
Strategy: find_market -> market_lineup (take 12) and market_lineup (rising=true) -> scan_market and find_sponsors -> finalize_plan.`;
}

async function dispatch(kit: Toolkit, name: string, args: Record<string, unknown>) {
  const a = args as never;
  switch (name) {
    case "find_act": return kit.findAct(a);
    case "rank_cities": return kit.rankCities(a);
    case "scan_city": return kit.scanCity(a);
    case "find_co_headliners": return kit.findCoHeadliners(a);
    case "find_sponsors": return kit.findSponsors(a);
    case "audience_profile": return kit.audienceProfile();
    case "find_market": return kit.findMarket(a);
    case "market_lineup": return kit.marketLineup(a);
    case "scan_market": return kit.scanMarket();
    default: throw new Error(`Unknown tool ${name}`);
  }
}

async function geminiAgent(req: PlanRequest, kit: Toolkit, emit: Emit): Promise<Narrative | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const ai = new GoogleGenAI({ apiKey: key });
  const tools = [{ functionDeclarations: [...(req.mode === "act" ? ACT_TOOLS : VENUE_TOOLS), FINALIZE] }];
  const contents: Content[] = [{ role: "user", parts: [{ text: req.mode === "act" ? `Plan a tour for ${req.query}.` : `Program the calendar for ${req.query}.` }] }];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: { systemInstruction: systemPrompt(req), tools, temperature: 0.4 },
    });
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

async function rulesAgent(req: PlanRequest, kit: Toolkit): Promise<Narrative> {
  const s = kit.state;
  if (req.mode === "act") {
    if (!s.act) await kit.findAct({ name: req.query });
    await Promise.all([
      s.cities.length ? null : kit.rankCities({ take: 20 }),
      s.audience ? null : kit.audienceProfile().catch(() => null),
      s.coHeadliners.length ? null : kit.findCoHeadliners({ take: 8 }).catch(() => null),
      s.sponsors.length ? null : kit.findSponsors({ take: 8 }).catch(() => null),
    ]);
    const pick = s.cities.slice(0, 8);
    for (const c of pick.slice(0, 5)) if (!c.venues) await kit.scanCity({ city: c.name }).catch(() => null);
    const act = s.act!;
    const top = pick[0];
    const surprise = pick.find((c, i) => i > 2 && c.countryCode && c.countryCode !== top?.countryCode) ?? pick[3];
    return {
      headline: `${act.name}: The Affinity Tour`,
      summary: `${act.name}'s audience over-indexes most in ${top?.name} (affinity ${top?.affinity.toFixed(2)}). ${surprise ? `${surprise.name} ranks higher than its market size suggests, which makes it a strong opportunity.` : ""}`,
      city_notes: pick.map((c) => ({ city: c.name, why: `Taste affinity ${c.affinity.toFixed(2)} with ${act.name}'s fans${c.venues?.[0] ? `; best-matched room: ${c.venues[0].name}` : ""}.` })),
      route_cities: pick.map((c) => c.name),
      booking_pitch: `Hi — we're routing ${act.name} and Qloo's taste data puts your market in our top ${pick.length} worldwide by audience affinity. We'd love to hold a date. Can we talk avails?`,
      sponsor_pitch: `Hi — ${act.name}'s audience shows one of the strongest taste overlaps we measured with ${s.sponsors[0]?.name ?? "your brand"}. We'd like to explore a tour partnership across ${pick.slice(0, 4).map((c) => c.name).join(", ")}.`,
      sponsor_angles: s.sponsors.slice(0, 4).map((b) => ({ brand: b.name, angle: `Co-branded fan experience at each stop` })),
    };
  }
  if (!s.market) await kit.findMarket({ city: req.query });
  if (!s.lineup.length) {
    await kit.marketLineup({ take: 12 });
    await kit.marketLineup({ take: 8, rising: true }).catch(() => null);
  }
  if (!s.market!.venues) await kit.scanMarket().catch(() => null);
  if (!s.sponsors.length) await kit.findSponsors({ take: 6 }).catch(() => null);
  const m = s.market!;
  return {
    headline: `${m.name}: Next Season`,
    summary: `${m.name}'s audience over-indexes on ${s.lineup.slice(0, 3).map((a) => a.name).join(", ")}. The lower-popularity names on this list are where the margin is.`,
    city_notes: [],
    route_cities: [],
    booking_pitch: `Hi — Qloo's taste data shows ${m.name} over-indexes on your artist's audience. We'd like to discuss a headline date.`,
    sponsor_pitch: `Hi — your brand's audience overlaps strongly with ${m.name}'s live-music crowd. Let's talk season sponsorship.`,
    sponsor_angles: s.sponsors.slice(0, 4).map((b) => ({ brand: b.name, angle: "Season presenting partner" })),
  };
}

function assemble(req: PlanRequest, kit: Toolkit, n: Narrative, reasoning: TourPlan["reasoning"]): TourPlan {
  const s = kit.state;
  const notes = new Map(n.city_notes?.map((c) => [c.city.toLowerCase(), c.why]) ?? []);
  for (const c of s.cities) c.why = notes.get(c.name.toLowerCase()) ?? c.why;

  let routeCities: CityLead[] = [];
  if (req.mode === "act") {
    const wanted = (n.route_cities ?? []).map((x) => x.toLowerCase());
    routeCities = s.cities.filter((c) => wanted.includes(c.name.toLowerCase()));
    if (routeCities.length < 4) routeCities = s.cities.slice(0, 8);
    routeCities = orderRoute(routeCities);
  }
  const angles = new Map(n.sponsor_angles?.map((x) => [x.brand.toLowerCase(), x.angle]) ?? []);

  return {
    mode: req.mode,
    act: s.act,
    market: s.market,
    headline: n.headline,
    summary: n.summary,
    cities: s.cities,
    route: scheduleRoute(routeCities),
    coHeadliners: s.coHeadliners,
    lineup: s.lineup,
    sponsors: s.sponsors.map((b) => ({ ...b, angle: angles.get(b.name.toLowerCase()) })),
    audience: s.audience,
    pitches: { booking: n.booking_pitch, sponsor: n.sponsor_pitch },
    dataSource: kit.q.live ? "qloo-live" : "qloo-mock",
    reasoning,
  };
}

export async function planTour(req: PlanRequest, emit: Emit) {
  const kit = new Toolkit(emit, req.mode);
  let narrative: Narrative | null = null;
  let reasoning: TourPlan["reasoning"] = "gemini";
  try {
    emit({ type: "status", message: "Agent started" });
    narrative = await geminiAgent(req, kit, emit);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit({ type: "status", message: `Reasoning model unavailable (${msg.slice(0, 80)}); continuing with rule-based planner` });
  }
  if (!narrative) {
    reasoning = "rules";
    narrative = await rulesAgent(req, kit);
  }
  // Make sure the essentials exist even if the LLM skipped a tool.
  if (req.mode === "act" && !kit.state.cities.length) await kit.rankCities({ take: 20 });
  emit({ type: "plan", plan: assemble(req, kit, narrative, reasoning) });
}
