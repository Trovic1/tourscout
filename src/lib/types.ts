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
  mode: "act" | "venue";
  act?: Entity;
  /** venue mode: the market being programmed */
  market?: CityLead;
  headline: string;
  summary: string;
  cities: CityLead[];
  route: TourStop[];
  coHeadliners: Entity[];
  /** venue mode: acts the market would buy tickets for */
  lineup?: Entity[];
  sponsors: SponsorLead[];
  audience?: AudienceProfile;
  pitches: { booking: string; sponsor: string };
  dataSource: "qloo-live" | "qloo-mock";
  reasoning: "gemini" | "rules";
}

export type AgentEvent =
  | { type: "status"; message: string }
  | { type: "tool"; id: string; name: string; label: string; args: Record<string, unknown> }
  | { type: "tool_result"; id: string; summary: string; ms: number }
  | { type: "thought"; text: string }
  | { type: "plan"; plan: TourPlan }
  | { type: "error"; message: string };
