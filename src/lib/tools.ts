import type { Params } from "./qloo";
import { qloo, type QlooSource } from "./qloo";
import { km } from "./geo";
import type { AgentEvent, AudienceProfile, BillMate, CityLead, Entity, SponsorLead, TourStop } from "./types";

/** Everything the agent has learned so far. The final plan is assembled from this, so
 * every city, venue, act and brand in the output comes from Qloo, never from the LLM. */
export interface ToolState {
  /** The emerging artist's own name, if given. They are usually not in Qloo; that's the point. */
  artist?: string;
  /** Acts the artist sounds like. Their fans are the signal for every query. */
  refs: Entity[];
  /** References Qloo knows but holds no taste data for; reported, not used. */
  dropped: Entity[];
  home?: CityLead;
  cities: CityLead[];
  billMates: BillMate[];
  sponsors: SponsorLead[];
  audience?: AudienceProfile;
}

type Emit = (e: AgentEvent) => void;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const regions = new Intl.DisplayNames(["en"], { type: "region" });
const countryName = (code: string) => {
  try {
    return regions.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
};

export class Toolkit {
  q: QlooSource = qloo();
  state: ToolState;
  private n = 0;

  constructor(private emit: Emit, refs: Entity[], artist?: string) {
    this.state = { artist, refs, dropped: [], cities: [], billMates: [], sponsors: [] };
  }

  /** How the artist is named in copy: their own name, or "your sound". */
  get who() {
    return this.state.artist || "this artist";
  }

  private get signal() {
    if (!this.state.refs.length) throw new Error("No reference acts with taste data.");
    return this.state.refs.map((r) => r.id).join(",");
  }

  private get refNames() {
    return this.state.refs.map((r) => r.name).join(" + ");
  }

  /** Wraps a tool call with progress events for the live log. */
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

  /* ----------------------------- setup steps ----------------------------- */

  /** Qloo lists many acts it has no listening data for; using one as a signal fails or
   * silently returns generic results. Keep only references that carry a real signal. */
  async checkReferences() {
    const all = [...this.state.refs];
    return this.run("check_references", `Checking Qloo has fan data for ${all.map((r) => r.name).join(", ")}`, {}, async () => {
      const ok = await Promise.all(all.map((r) => this.q.hasSignal(r.id)));
      this.state.refs = all.filter((_, i) => ok[i]);
      this.state.dropped = all.filter((_, i) => !ok[i]);
      if (!this.state.refs.length)
        throw new Error(
          `Qloo has no fan data for ${all.map((r) => r.name).join(" or ")} yet. Add an act your sound is close to that more people know.`,
        );
      const kept = this.state.refs.map((r) => r.name).join(", ");
      return [this.state.refs, this.state.dropped.length ? `using ${kept} · no data for ${this.state.dropped.map((d) => d.name).join(", ")}` : `using ${kept}`];
    });
  }

  async locateHome(city: string) {
    return this.run("locate_home", `Finding ${city} on the map`, { city }, async () => {
      const hits = await this.q.search(city, ["urn:entity:locality"], 5);
      if (!hits.length) throw new Error(`Couldn't find a city called ${city}.`);
      // Several localities share a name; the most popular exact match is the city people mean.
      const exact = hits.filter((h) => h.name.toLowerCase() === city.toLowerCase() && h.lat !== undefined);
      const m = [...(exact.length ? exact : hits)].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))[0];
      this.state.home = {
        id: m.id,
        name: m.name,
        country: m.country,
        countryCode: m.countryCode,
        lat: m.lat ?? 0,
        lng: m.lng ?? 0,
        affinity: 0,
        home: true,
      };
      return [this.state.home, `${m.name}${m.country ? `, ${m.country}` : ""}`];
    });
  }

  /* ------------------------------ agent tools ----------------------------- */

  async rankCities({ take = 14, countryCode, minPopularity = 0.6 }: { take?: number; countryCode?: string; minPopularity?: number }) {
    const label = countryCode
      ? `Ranking cities in ${countryName(countryCode)} by how much they like ${this.refNames}`
      : `Ranking world cities where fans of ${this.refNames} cluster`;
    return this.run("rank_cities", label, { take, countryCode }, async () => {
      const ents = await this.q.insights({
        "filter.type": "urn:entity:destination",
        "signal.interests.entities": this.signal,
        "filter.geocode.country_code": countryCode,
        // Touring needs real markets: without a floor Qloo surfaces villages and resort towns.
        "filter.popularity.min": countryCode ? Math.min(minPopularity, 0.3) : minPopularity,
        take: Math.min(take, 30),
      });
      // Qloo can list the same city twice (separate destination records); keep the first.
      const seen = new Set(this.state.cities.map((c) => `${c.name}|${c.countryCode}`));
      const home = this.state.home;
      const leads: CityLead[] = ents
        .filter((e) => e.lat !== undefined && e.lng !== undefined && e.affinity !== undefined)
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
          affinity: e.affinity!,
          popularity: e.popularity,
          kmFromHome: home ? Math.round(km(home, { lat: e.lat!, lng: e.lng! })) : undefined,
        }));
      for (const l of leads) {
        // The home city is already the opening show; carry its score over instead of listing it twice.
        if (home && l.name.toLowerCase() === home.name.toLowerCase()) {
          home.affinity = l.affinity;
          continue;
        }
        this.state.cities.push(l);
      }
      this.state.cities.sort((a, b) => b.affinity - a.affinity);
      return [
        leads.map(({ name, country, affinity, kmFromHome }) => ({ name, country, affinity: Math.round(affinity * 100), kmFromHome })),
        leads.length ? `${plural(leads.length, "city", "cities")} · top: ${leads.slice(0, 3).map((l) => l.name).join(", ")}` : "no cities with a taste match",
      ];
    });
  }

  /** Rooms tagged as music venues; where Qloo has none (e.g. Lagos), fall back to concert halls. */
  private async venuesIn(where: Params, take: number): Promise<Entity[]> {
    for (const tag of VENUE_TAGS) {
      const found = await this.q
        .insights({ "filter.type": "urn:entity:place", ...where, "filter.tags": tag, "signal.interests.entities": this.signal, take })
        .catch(() => [] as Entity[]);
      if (found.length) return found;
    }
    return [];
  }

  async scanCity({ city }: { city: string }) {
    return this.run("scan_city", `Mapping where the fans are in ${city}, and the rooms that fit`, { city }, async () => {
      const home = this.state.home;
      const lead =
        home && home.name.toLowerCase() === city.toLowerCase()
          ? home
          : this.state.cities.find((c) => c.name.toLowerCase() === city.toLowerCase());
      const where = near(lead) ?? { "filter.location.query": city };
      const [heat, venues] = await Promise.all([
        this.q.heatmap({ ...where, "signal.interests.entities": this.signal, take: 50 }).catch(() => []),
        this.venuesIn(where, 5),
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
        `${plural(hotspots.length, "fan hotspot")} · ${plural(venues.length, "room")}${venues[0] ? ` (best: ${venues[0].name})` : ""}`,
      ];
    });
  }

  /** Acts the same fans already love. "support": bigger acts to open for. "peer": acts at a
   * similar stage to share a bill or swap support slots with. */
  async findBillMates({ tier = "peer", take = 8 }: { tier?: "peer" | "support"; take?: number }) {
    const label = tier === "support" ? `Finding bigger acts whose fans would take to ${this.who}` : `Finding acts at a similar stage to share bills with`;
    return this.run("find_bill_mates", label, { tier, take }, async () => {
      const ents = await this.q.insights({
        "filter.type": "urn:entity:artist",
        "signal.interests.entities": this.signal,
        "filter.exclude.entities": this.signal,
        // Qloo tags some models and authors as artists; a reach floor keeps this to working acts.
        "filter.popularity.min": tier === "support" ? 0.8 : 0.3,
        "filter.popularity.max": tier === "support" ? undefined : 0.8,
        take,
      });
      const fresh = ents
        .filter((e) => !this.state.billMates.some((b) => b.id === e.id) && !this.state.refs.some((r) => r.id === e.id))
        .map((e) => ({ ...e, tier }));
      this.state.billMates.push(...fresh);
      return [
        fresh.map((e) => ({ name: e.name, affinity: e.affinity === undefined ? undefined : Math.round(e.affinity * 100), reach: e.popularity === undefined ? undefined : Math.round(e.popularity * 100) })),
        `${plural(fresh.length, "act")} · ${fresh.slice(0, 3).map((e) => e.name).join(", ")}`,
      ];
    });
  }

  async findSponsors({ take = 8 }: { take?: number }) {
    return this.run("find_sponsors", `Finding brands the same fans already buy`, { take }, async () => {
      const ents = await this.q.insights({ "filter.type": "urn:entity:brand", "signal.interests.entities": this.signal, take });
      this.state.sponsors = ents;
      return [
        ents.map((e) => ({ name: e.name, affinity: e.affinity === undefined ? undefined : Math.round(e.affinity * 100) })),
        `${plural(ents.length, "brand")} · ${ents.slice(0, 3).map((e) => e.name).join(", ")}`,
      ];
    });
  }

  /** Qloo returns demographics per entity only, so the profile is the average of the references. */
  async audienceProfile() {
    return this.run("audience_profile", `Profiling who listens to ${this.refNames}`, {}, async () => {
      const each = (await Promise.all(this.state.refs.map((r) => this.q.demographics(r.id).catch(() => undefined)))).filter(
        (a): a is AudienceProfile => !!a,
      );
      if (!each.length) return [null, "no demographic data"];
      const avg = (pick: (a: AudienceProfile) => Record<string, number>) => {
        const keys = Object.keys(pick(each[0]));
        return Object.fromEntries(keys.map((k) => [k, +(each.reduce((s, a) => s + (pick(a)[k] ?? 0), 0) / each.length).toFixed(2)]));
      };
      const a: AudienceProfile = { age: avg((x) => x.age), gender: avg((x) => x.gender) };
      this.state.audience = a;
      const topAge = Object.entries(a.age).sort((x, y) => y[1] - x[1])[0];
      return [a, `skews ${topAge[0].replace(/_/g, " ")}`];
    });
  }
}

/** Search by coordinates: names like "Washington" are ambiguous (Qloo resolves it to the state). */
function near(c?: { lat: number; lng: number }): Params | undefined {
  if (!c || (!c.lat && !c.lng)) return undefined;
  return { "filter.location": `POINT(${c.lng} ${c.lat})`, "filter.location.radius": 25000 };
}

const VENUE_TAGS = ["urn:tag:setting:qloo:music_venue", "urn:tag:category:place:concert_hall"];

/* ------------------------------ routing ------------------------------ */

const pathKm = (r: CityLead[]) => r.slice(1).reduce((a, c, i) => a + km(r[i], c), 0);

/** Nearest-neighbour from the first stop, then 2-opt to remove crossings.
 * The first stop stays fixed: a first tour opens at home, where the artist already has a room. */
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

export const routeKm = pathKm;

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
