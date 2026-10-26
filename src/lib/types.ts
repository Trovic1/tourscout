export type EntityKind =
  | "artist"
  | "person"
  | "podcast"
  | "brand"
  | "place"
  | "destination"
  | "locality";

export interface Entity {
  id: string;
  name: string;
  kind: EntityKind | string;
  image?: string;
  /** Global popularity percentile, 0..1 */
  popularity?: number;
  /** Qloo affinity to the input signal, 0..1 */
  affinity?: number;
  description?: string;
  tags?: string[];
  lat?: number;
  lng?: number;
  city?: string;
  country?: string;
  countryCode?: string;
  neighborhood?: string;
  address?: string;
}

export interface Hotspot {
  lat: number;
  lng: number;
  affinity: number;
  popularity: number;
}

export interface CityLead {
  id: string;
  name: string;
  country?: string;
  countryCode?: string;
  lat: number;
  lng: number;
  /** Taste affinity between the act's fans and this city, 0..1 */
  affinity: number;
  popularity?: number;
  hotspots?: Hotspot[];
  venues?: Entity[];
  /** Agent-written reason this city belongs on the tour */
  why?: string;
  /** Great-circle distance from the artist's home city */
  kmFromHome?: number;
  /** The artist's home city: always the opening show */
  home?: boolean;
}

/** An act the same fans love. "support": a bigger act to open for; "peer": a similar-stage act to share bills with. */
export interface BillMate extends Entity {
  tier: "support" | "peer";
}

export interface AudienceProfile {
  age: Record<string, number>;
  gender: Record<string, number>;
}

export interface SponsorLead extends Entity {
  angle?: string;
}

export interface TourStop {
  cityId: string;
  date: string;
  venue?: Entity;
}

export interface TourPlan {
  /** The emerging artist's own name, if given */
  artist?: string;
  /** Acts the artist sounds like, whose fans drove every query */
  refs: Entity[];
  /** References the user picked that Qloo holds no fan data for */
  dropped: Entity[];
  home?: CityLead;
  headline: string;
  summary: string;
  /** Every city ranked, home excluded */
  cities: CityLead[];
  route: TourStop[];
  billMates: BillMate[];
  sponsors: SponsorLead[];
  audience?: AudienceProfile;
  pitches: { venue: string; sponsor: string };
  dataSource: "qloo-live" | "qloo-mock";
  /** "llm" when a language model chose the route and wrote the words; "rules" for the rule-based planner */
  reasoning: "llm" | "rules";
  /** The model that planned it, e.g. "gemini-flash-lite-latest" (absent for the rule-based planner) */
  model?: string;
  /** When the agent produced this plan (examples are planned ahead and cached) */
  plannedAt: string;
}

export type AgentEvent =
  | { type: "status"; message: string }
  | { type: "tool"; id: string; name: string; label: string; args: Record<string, unknown> }
  | { type: "tool_result"; id: string; summary: string; ms: number }
  | { type: "thought"; text: string }
  | { type: "plan"; plan: TourPlan }
  | { type: "error"; message: string };
