import { qloo, type QlooSource } from "./qloo";
import { km } from "./geo";
import type { AgentEvent, AudienceProfile, CityLead, Entity, SponsorLead, TourStop } from "./types";

/** Everything the agent has learned so far. The final plan is assembled from this, so
 * every city, venue, act and brand in the output comes from Qloo, never from the LLM. */
export interface ToolState {
  mode: "act" | "venue";
  act?: Entity;
  market?: CityLead;
  cities: CityLead[];
  coHeadliners: Entity[];
  lineup: Entity[];
  sponsors: SponsorLead[];
  audience?: AudienceProfile;
}

type Emit = (e: AgentEvent) => void;

const ACT_TYPES = ["urn:entity:artist", "urn:entity:person", "urn:entity:podcast"];

export class Toolkit {
  q: QlooSource = qloo();
  state: ToolState;
  private n = 0;

  constructor(private emit: Emit, mode: "act" | "venue") {
    this.state = { mode, cities: [], coHeadliners: [], lineup: [], sponsors: [] };
  }

  /** Wraps a tool call with progress events for the live "agent trace" UI. */
  async run<T>(name: string, label: string, args: Record<string, unknown>, fn: () => Promise<[T, string]>) {
    const id = `t${++this.n}`;
    this.emit({ type: "tool", id, name, label, args });
    const t0 = Date.now();
    try {
      const [out, summary] = await fn();
      this.emit({ type: "tool_result", id, summary, ms: Date.now() - t0 });
      return out;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.emit({ type: "tool_result", id, summary: `failed: ${msg.slice(0, 120)}`, ms: Date.now() - t0 });
      throw err;
    }
  }

  private requireAct() {
    if (!this.state.act) throw new Error("Call find_act first.");
    return this.state.act;
  }

  /* ------------------------------ act mode ------------------------------ */

  async findAct({ name }: { name: string }) {
    return this.run("find_act", `Looking up “${name}” in Qloo's taste graph`, { name }, async () => {
      const hits = await this.q.search(name, ACT_TYPES, 5);
      if (!hits.length) throw new Error(`No act named ${name}`);
      const same = hits.filter((h) => h.name.toLowerCase() === name.toLowerCase());
      // Qloo often has both a person and an artist record; the artist record carries the music taste signal.
      const exact = same.find((h) => h.kind === "artist") ?? same[0];
      const act = exact ?? hits[0];
      this.state.act = act;
      return [act, `${act.name} (${act.kind})`];
    });
  }

  async rankCities({ take = 14, countryCode, minPopularity = 0.6 }: { take?: number; countryCode?: string; minPopularity?: number }) {
    const act = this.requireAct();
    const label = countryCode
      ? `Ranking ${countryCode} cities by fan-taste affinity`
      : `Ranking world cities by taste affinity with ${act.name}'s audience`;
    return this.run("rank_cities", label, { take, countryCode }, async () => {
      const ents = await this.q.insights({
        "filter.type": "urn:entity:destination",
        "signal.interests.entities": act.id,
        "filter.geocode.country_code": countryCode,
        // Touring needs real markets: without a floor Qloo surfaces villages and resort towns.
        "filter.popularity.min": countryCode ? Math.min(minPopularity, 0.3) : minPopularity,
        take: Math.min(take, 30),
      });
      // Qloo can list the same city twice (separate destination records); keep the stronger one.
      const seen = new Set(this.state.cities.map((c) => `${c.name}|${c.countryCode}`));
      const leads: CityLead[] = ents
        .filter((e) => e.lat !== undefined && e.lng !== undefined)
        .filter((e) => {
          const k = `${e.name}|${e.countryCode}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .map((e) => ({
          id: e.id,
          name: e.name,
          country: e.country,
          countryCode: e.countryCode,
          lat: e.lat!,
          lng: e.lng!,
          affinity: e.affinity ?? 0,
          popularity: e.popularity,
        }));
      for (const l of leads) if (!this.state.cities.some((c) => c.id === l.id)) this.state.cities.push(l);
      this.state.cities.sort((a, b) => b.affinity - a.affinity);
      return [
        leads.map(({ id, name, country, affinity }) => ({ id, name, country, affinity: Math.round(affinity * 100) })),
        `${leads.length} cities · top: ${leads.slice(0, 3).map((l) => l.name).join(", ")}`,
      ];
    });
  }

  /** Rooms tagged as music venues; where Qloo has none (e.g. Lagos), fall back to concert halls. */
  private async venuesIn(city: string, signal: string | undefined, take: number): Promise<Entity[]> {
    for (const tag of VENUE_TAGS) {
      const found = await this.q
        .insights({
          "filter.type": "urn:entity:place",
          "filter.location.query": city,
          "filter.tags": tag,
          "signal.interests.entities": signal,
          take,
        })
        .catch(() => [] as Entity[]);
      if (found.length) return found;
    }
    return [];
  }

  async scanCity({ city }: { city: string }) {
    const act = this.requireAct();
    return this.run("scan_city", `Mapping ${act.name} fan hotspots and venues in ${city}`, { city }, async () => {
      const lead = this.state.cities.find((c) => c.name.toLowerCase() === city.toLowerCase());
      const [heat, venues] = await Promise.all([
        this.q
          .heatmap({ "filter.location.query": city, "signal.interests.entities": act.id, take: 50 })
          .catch(() => []),
        this.venuesIn(city, act.id, 5),
      ]);
      const hotspots = [...heat].sort((a, b) => b.affinity - a.affinity).slice(0, 40);
      if (lead) {
        lead.hotspots = hotspots;
        lead.venues = venues;
      }
      return [
        {
          city,
          hotspots: hotspots.slice(0, 3).map((h) => ({ lat: +h.lat.toFixed(3), lng: +h.lng.toFixed(3), affinity: Math.round(h.affinity * 100) })),
          venues: venues.map((v) => ({ name: v.name, affinity: v.affinity === undefined ? undefined : Math.round(v.affinity * 100), neighborhood: v.neighborhood })),
        },
        `${hotspots.length} heat cells · ${venues.length} venues${venues[0] ? ` (best: ${venues[0].name})` : ""}`,
      ];
    });
  }

  async findCoHeadliners({ take = 8, rising = false }: { take?: number; rising?: boolean }) {
    const act = this.requireAct();
    const type = act.kind === "person" ? "urn:entity:person" : act.kind === "podcast" ? "urn:entity:podcast" : "urn:entity:artist";
    return this.run(
      "find_co_headliners",
      rising ? `Finding rising acts ${act.name}'s fans already love` : `Finding taste-matched co-headliners for ${act.name}`,
      { take, rising },
      async () => {
        const ents = await this.q.insights({
          "filter.type": type,
          "signal.interests.entities": act.id,
          "filter.exclude.entities": act.id,
          "filter.popularity.max": rising ? 0.9 : undefined,
          take,
        });
        const fresh = ents.filter((e) => e.id !== act.id && !this.state.coHeadliners.some((c) => c.id === e.id));
        this.state.coHeadliners.push(...fresh);
        return [fresh.map((e) => ({ name: e.name, affinity: e.affinity === undefined ? undefined : Math.round(e.affinity * 100), popularity: e.popularity === undefined ? undefined : Math.round(e.popularity * 100) })), `${fresh.length} acts · ${fresh.slice(0, 3).map((e) => e.name).join(", ")}`];
      },
    );
  }

  async findSponsors({ take = 8 }: { take?: number }) {
    const signal = this.state.act ?? this.state.market;
    if (!signal) throw new Error("Need an act or market first.");
    return this.run("find_sponsors", `Finding brands whose audience overlaps ${signal.name}'s`, { take }, async () => {
      const ents = await this.q.insights({
        "filter.type": "urn:entity:brand",
        ...(this.state.act ? { "signal.interests.entities": signal.id } : { "signal.location.query": signal.name }),
        take,
      });
      this.state.sponsors = ents;
      return [ents.map((e) => ({ id: e.id, name: e.name, affinity: e.affinity === undefined ? undefined : Math.round(e.affinity * 100) })), `${ents.length} brands · ${ents.slice(0, 3).map((e) => e.name).join(", ")}`];
    });
  }

  async audienceProfile() {
    const act = this.requireAct();
    return this.run("audience_profile", `Profiling the demographics of ${act.name}'s audience`, {}, async () => {
      const a = await this.q.demographics(act.id);
      this.state.audience = a;
      if (!a) return [null, "no demographic data"];
      const topAge = Object.entries(a.age).sort((x, y) => y[1] - x[1])[0];
      return [a, `skews ${topAge[0].replace(/_/g, " ")}`];
    });
  }

  /* ----------------------------- venue mode ----------------------------- */

  async findMarket({ city }: { city: string }) {
    return this.run("find_market", `Locating ${city} in Qloo's taste graph`, { city }, async () => {
      const hits = await this.q.search(city, ["urn:entity:locality"], 3);
      const m = hits[0];
      if (!m) throw new Error(`No market named ${city}`);
      this.state.market = {
        id: m.id,
        name: m.name,
        country: m.country,
        countryCode: m.countryCode,
        lat: m.lat ?? 0,
        lng: m.lng ?? 0,
        affinity: 1,
      };
      return [this.state.market, `${m.name}${m.country ? `, ${m.country}` : ""}`];
    });
  }

  async marketLineup({ take = 12, rising = false }: { take?: number; rising?: boolean }) {
    const m = this.state.market;
    if (!m) throw new Error("Call find_market first.");
    return this.run(
      "market_lineup",
      rising ? `Finding under-the-radar acts ${m.name} over-indexes on` : `Ranking acts ${m.name}'s audience would buy tickets for`,
      { take, rising },
      async () => {
        const ents = await this.q.insights({
          "filter.type": "urn:entity:artist",
          "signal.location.query": m.name,
          "filter.popularity.max": rising ? 0.85 : undefined,
          take,
        });
        const fresh = ents.filter((e) => !this.state.lineup.some((l) => l.id === e.id));
        this.state.lineup.push(...fresh);
        return [fresh.map((e) => ({ name: e.name, affinity: e.affinity === undefined ? undefined : Math.round(e.affinity * 100), popularity: e.popularity === undefined ? undefined : Math.round(e.popularity * 100) })), `${fresh.length} acts · ${fresh.slice(0, 3).map((e) => e.name).join(", ")}`];
      },
    );
  }

  async scanMarket() {
    const m = this.state.market;
    if (!m) throw new Error("Call find_market first.");
    return this.run("scan_market", `Scanning live-music venues in ${m.name}`, {}, async () => {
      const venues = await this.venuesIn(m.name, this.state.lineup[0]?.id, 6);
      m.venues = venues;
      return [venues.map((v) => v.name), `${venues.length} venues`];
    });
  }
}

const VENUE_TAGS = ["urn:tag:setting:qloo:music_venue", "urn:tag:category:place:concert_hall"];

/* ------------------------------ routing ------------------------------ */

const pathKm = (r: CityLead[]) => r.slice(1).reduce((a, c, i) => a + km(r[i], c), 0);

/** Nearest-neighbour from the strongest market, then 2-opt to remove crossings.
 * The first stop stays fixed: the tour opens where the audience is strongest. */
export function orderRoute(cities: CityLead[]): CityLead[] {
  if (cities.length < 3) return cities;
  const left = [...cities];
  let out = [left.shift()!];
  while (left.length) {
    const last = out[out.length - 1];
    let best = 0;
    for (let i = 1; i < left.length; i++) if (km(last, left[i]) < km(last, left[best])) best = i;
    out.push(left.splice(best, 1)[0]);
  }
  for (let improved = true, guard = 0; improved && guard < 50; guard++) {
    improved = false;
    for (let i = 1; i < out.length - 1; i++)
      for (let j = i + 1; j < out.length; j++) {
        const next = [...out.slice(0, i), ...out.slice(i, j + 1).reverse(), ...out.slice(j + 1)];
        if (pathKm(next) + 1 < pathKm(out)) {
          out = next;
          improved = true;
        }
      }
  }
  return out;
}

/** Festive dead zone: promoters rarely route shows Dec 20 - Jan 6. */
const dead = (d: Date) => (d.getUTCMonth() === 11 && d.getUTCDate() >= 20) || (d.getUTCMonth() === 0 && d.getUTCDate() <= 6);

export function scheduleRoute(cities: CityLead[], start = new Date()): TourStop[] {
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + 84); // ~12 weeks of lead time to hold rooms
  while (d.getUTCDay() !== 4) d.setUTCDate(d.getUTCDate() + 1); // open on a Thursday
  return cities.map((c, i) => {
    if (i > 0) {
      const hop = km(cities[i - 1], c);
      d.setUTCDate(d.getUTCDate() + (hop > 3000 ? 4 : hop > 800 ? 3 : 2));
    }
    while (dead(d)) d.setUTCDate(d.getUTCDate() + 1);
    return { cityId: c.id, date: d.toISOString().slice(0, 10), venue: c.venues?.[0] };
  });
}
