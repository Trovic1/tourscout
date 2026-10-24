import type { AudienceProfile, Entity, Hotspot } from "./types";
import { mockQloo } from "./mock";

const BASE = process.env.QLOO_BASE_URL ?? "https://hackathon.api.qloo.com";

export type Params = Record<string, string | number | boolean | undefined>;

export interface QlooSource {
  live: boolean;
  search(query: string, types: string[], take?: number): Promise<Entity[]>;
  insights(params: Params): Promise<Entity[]>;
  heatmap(params: Params): Promise<Hotspot[]>;
  demographics(entityId: string): Promise<AudienceProfile | undefined>;
  tags(query: string, take?: number): Promise<{ id: string; name: string }[]>;
}

// Private server-side cache (allowed by Qloo's hackathon terms; never committed).
const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 1000 * 60 * 60 * 6;

async function get<T>(path: string, params: Params): Promise<T> {
  const key = process.env.QLOO_API_KEY;
  if (!key) throw new Error("QLOO_API_KEY missing");
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const url = `${BASE}${path}?${qs.toString()}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.data as T;

  const res = await fetch(url, {
    headers: { "X-Api-Key": key, accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Qloo ${path} ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as T;
  cache.set(url, { at: Date.now(), data });
  return data;
}

/* ---------- normalisers: Qloo payloads are verbose and vary by type ---------- */

type Raw = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown) => (typeof v === "string" && v.length ? v : undefined);

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
function countryName(code?: string) {
  if (!code) return undefined;
  try {
    return regionNames.of(code.toUpperCase());
  } catch {
    return undefined;
  }
}

export function normalizeEntity(raw: Raw): Entity {
  const p = (raw.properties ?? {}) as Raw;
  const geo = (p.geocode ?? {}) as Raw;
  const loc = (raw.location ?? p.location ?? {}) as Raw;
  const q = (raw.query ?? {}) as Raw;
  const img = (p.image ?? {}) as Raw;
  const subtype = str(raw.subtype) ?? str(raw.type) ?? (Array.isArray(raw.types) ? str(raw.types[0]) : undefined) ?? "";
  // Localities carry their country in an ancestors list, not a geocode block.
  const ancestors = Array.isArray(p.ancestors) ? (p.ancestors as Raw[]) : [];
  const ancCountry = ancestors.find((a) => a.place === "country");
  const code = str(geo.country_code) ?? str(p.country_code);
  const tags = Array.isArray(raw.tags)
    ? (raw.tags as Raw[]).map((t) => str(t.name)).filter((t): t is string => !!t)
    : undefined;

  return {
    id: String(raw.entity_id ?? raw.id ?? raw.name),
    name: String(raw.name ?? "Unknown"),
    kind: subtype.replace("urn:entity:", ""),
    image: str(img.url) ?? str(p.image_url),
    popularity: num(raw.popularity),
    affinity: num(q.affinity) ?? num(raw.affinity),
    description: str(p.short_description) ?? str(p.description),
    tags: tags?.slice(0, 8),
    lat: num(loc.lat) ?? num(loc.latitude) ?? num(p.lat),
    lng: num(loc.lon) ?? num(loc.lng) ?? num(loc.longitude) ?? num(p.lon),
    city: str(geo.city) ?? str(geo.name) ?? str(p.city),
    country: str(geo.country) ?? str(p.country) ?? countryName(code) ?? str(ancCountry?.name),
    countryCode: code,
    neighborhood: str(geo.neighborhood) ?? str(p.neighborhood),
    address: str(p.address),
  };
}

const liveQloo: QlooSource = {
  live: true,
  async search(query, types, take = 5) {
    const data = await get<{ results?: Raw[] }>("/search", {
      query,
      types: types.join(","),
      take,
    });
    return (data.results ?? []).map(normalizeEntity);
  },
  async insights(params) {
    const data = await get<{ results?: { entities?: Raw[] } }>("/v2/insights", params);
    return (data.results?.entities ?? []).map(normalizeEntity);
  },
  async heatmap(params) {
    const data = await get<{ results?: { heatmap?: Raw[] } }>("/v2/insights", {
      ...params,
      "filter.type": "urn:heatmap",
    });
    return (data.results?.heatmap ?? []).map((h) => {
      const l = (h.location ?? {}) as Raw;
      const q = (h.query ?? {}) as Raw;
      return {
        lat: num(l.latitude) ?? 0,
        lng: num(l.longitude) ?? 0,
        affinity: num(q.affinity) ?? 0,
        popularity: num(q.popularity) ?? 0,
      };
    });
  },
  async demographics(entityId) {
    const data = await get<{ results?: { demographics?: Raw[] } }>("/v2/insights", {
      "filter.type": "urn:demographics",
      "signal.interests.entities": entityId,
    });
    const q = (data.results?.demographics?.[0]?.query ?? undefined) as
      | AudienceProfile
      | undefined;
    return q && q.age ? q : undefined;
  },
  async tags(query, take = 8) {
    const data = await get<{ results?: { tags?: Raw[] } }>("/v2/tags", {
      "filter.query": query,
      take,
    });
    return (data.results?.tags ?? []).map((t) => ({
      id: String(t.id ?? t.tag_id),
      name: String(t.name),
    }));
  },
};

export function qloo(): QlooSource {
  return process.env.QLOO_API_KEY ? liveQloo : mockQloo;
}
