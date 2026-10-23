/**
 * Offline stand-in for the Qloo API, shaped like the normalised live responses.
 * Used only when QLOO_API_KEY is absent (local dev before the hackathon key arrives).
 */
import type { QlooSource, Params } from "./qloo";
import type { AudienceProfile, Entity, Hotspot } from "./types";

type City = [id: string, name: string, country: string, cc: string, lat: number, lng: number, venues: string[]];

export const CITIES: City[] = [
  ["lon", "London", "United Kingdom", "GB", 51.5072, -0.1276, ["O2 Academy Brixton", "Roundhouse", "KOKO", "Electric Brixton"]],
  ["lag", "Lagos", "Nigeria", "NG", 6.5244, 3.3792, ["Eko Convention Centre", "Muri Okunola Park", "Hard Rock Cafe Lagos", "Terra Kulture"]],
  ["acc", "Accra", "Ghana", "GH", 5.6037, -0.187, ["Accra Sports Stadium", "+233 Jazz Bar", "Untamed Empire"]],
  ["jnb", "Johannesburg", "South Africa", "ZA", -26.2041, 28.0473, ["Constitution Hill", "Kitcheners", "The Marks Park"]],
  ["nbo", "Nairobi", "Kenya", "KE", -1.2921, 36.8219, ["Carnivore Grounds", "KICC Amphitheatre", "Alchemist Bar"]],
  ["par", "Paris", "France", "FR", 48.8566, 2.3522, ["Le Bataclan", "La Cigale", "Le Trianon", "Élysée Montmartre"]],
  ["ams", "Amsterdam", "Netherlands", "NL", 52.3676, 4.9041, ["Paradiso", "Melkweg", "AFAS Live"]],
  ["bru", "Brussels", "Belgium", "BE", 50.8503, 4.3517, ["Ancienne Belgique", "Botanique", "Forest National"]],
  ["ber", "Berlin", "Germany", "DE", 52.52, 13.405, ["Columbiahalle", "Huxleys Neue Welt", "Astra Kulturhaus"]],
  ["mil", "Milan", "Italy", "IT", 45.4642, 9.19, ["Alcatraz", "Fabrique", "Magazzini Generali"]],
  ["lis", "Lisbon", "Portugal", "PT", 38.7223, -9.1393, ["Coliseu dos Recreios", "LAV", "Musicbox"]],
  ["mad", "Madrid", "Spain", "ES", 40.4168, -3.7038, ["La Riviera", "Sala But", "Teatro Barceló"]],
  ["dub", "Dublin", "Ireland", "IE", 53.3498, -6.2603, ["Vicar Street", "The Academy", "3Olympia Theatre"]],
  ["man", "Manchester", "United Kingdom", "GB", 53.4808, -2.2426, ["O2 Victoria Warehouse", "Albert Hall", "Band on the Wall"]],
  ["nyc", "New York", "United States", "US", 40.7128, -74.006, ["Brooklyn Steel", "Terminal 5", "Webster Hall", "Apollo Theater"]],
  ["atl", "Atlanta", "United States", "US", 33.749, -84.388, ["The Tabernacle", "Coca-Cola Roxy", "Variety Playhouse"]],
  ["hou", "Houston", "United States", "US", 29.7604, -95.3698, ["House of Blues Houston", "White Oak Music Hall", "Bayou Music Center"]],
  ["dal", "Dallas", "United States", "US", 32.7767, -96.797, ["The Bomb Factory", "House of Blues Dallas", "Granada Theater"]],
  ["chi", "Chicago", "United States", "US", 41.8781, -87.6298, ["The Riviera", "Metro", "Chicago Theatre"]],
  ["dc", "Washington DC", "United States", "US", 38.9072, -77.0369, ["9:30 Club", "The Anthem", "Howard Theatre"]],
  ["la", "Los Angeles", "United States", "US", 34.0522, -118.2437, ["The Novo", "The Wiltern", "The Fonda"]],
  ["mia", "Miami", "United States", "US", 25.7617, -80.1918, ["The Fillmore Miami Beach", "Club Space", "Bayfront Park"]],
  ["mem", "Memphis", "United States", "US", 35.1495, -90.049, ["Minglewood Hall", "Orpheum Theatre", "Levitt Shell"]],
  ["stl", "St. Louis", "United States", "US", 38.627, -90.1994, ["The Pageant", "Fabulous Fox", "Delmar Hall"]],
  ["det", "Detroit", "United States", "US", 42.3314, -83.0458, ["The Fillmore Detroit", "Fox Theatre", "Saint Andrew's Hall"]],
  ["clt", "Charlotte", "United States", "US", 35.2271, -80.8431, ["The Fillmore Charlotte", "Ovens Auditorium", "Neighborhood Theatre"]],
  ["tor", "Toronto", "Canada", "CA", 43.6532, -79.3832, ["History", "Danforth Music Hall", "The Opera House"]],
  ["mtl", "Montreal", "Canada", "CA", 45.5019, -73.5674, ["MTELUS", "Club Soda", "Théâtre Corona"]],
  ["dxb", "Dubai", "United Arab Emirates", "AE", 25.2048, 55.2708, ["Coca-Cola Arena", "Dubai Opera", "Soul Beach"]],
  ["sao", "São Paulo", "Brazil", "BR", -23.5505, -46.6333, ["Audio", "Cine Joia", "Tokio Marine Hall"]],
  ["mex", "Mexico City", "Mexico", "MX", 19.4326, -99.1332, ["Pepsi Center WTC", "Foro Indie Rocks!", "El Plaza Condesa"]],
  ["kgs", "Kingston", "Jamaica", "JM", 18.0179, -76.8099, ["Mas Camp", "Hope Gardens", "Emancipation Park"]],
  ["syd", "Sydney", "Australia", "AU", -33.8688, 151.2093, ["Enmore Theatre", "Metro Theatre", "Hordern Pavilion"]],
  ["tyo", "Tokyo", "Japan", "JP", 35.6762, 139.6503, ["Zepp Haneda", "Shibuya O-East", "Liquidroom"]],
  ["sgp", "Singapore", "Singapore", "SG", 1.3521, 103.8198, ["The Coliseum", "Esplanade", "Capitol Theatre"]],
];

type Profile = {
  kind: "artist" | "person" | "podcast";
  image?: string;
  description: string;
  popularity: number;
  /** strongest markets, in rough order */
  markets: string[];
  peers: string[];
  brands: string[];
  audience: AudienceProfile;
};

const AFRO_PEERS = ["Tems", "Ayra Starr", "Asake", "Rema", "Wizkid", "Davido", "Tyla", "Uncle Waffles", "Fireboy DML", "Omah Lay", "Black Sherif", "Libianca", "Ruger", "Kizz Daniel"];
const AFRO_BRANDS = ["Puma", "Hennessy", "Jameson", "Boohoo", "Spotify", "Pepsi", "Beats by Dre", "Martell", "Nike", "Bolt"];

const PROFILES: Record<string, Profile> = {
  "burna boy": {
    kind: "artist",
    description: "Nigerian singer, songwriter and Grammy winner; self-styled 'African Giant'.",
    popularity: 0.991,
    markets: ["lon", "lag", "par", "ams", "bru", "tor", "hou", "atl", "nyc", "acc", "dxb", "jnb", "man", "dc", "mil", "ber", "dub", "nbo"],
    peers: AFRO_PEERS,
    brands: AFRO_BRANDS,
    audience: { age: { "24_and_younger": 0.32, "25_to_29": 0.41, "30_to_34": 0.18, "35_to_44": -0.06, "45_to_54": -0.38, "55_and_older": -0.52 }, gender: { male: 0.07, female: -0.07 } },
  },
  tems: {
    kind: "artist",
    description: "Nigerian singer-songwriter and producer known for 'Free Mind' and 'Love Me JeJe'.",
    popularity: 0.962,
    markets: ["lon", "lag", "nyc", "atl", "tor", "par", "la", "acc", "ams", "dc", "hou", "jnb", "man", "chi", "dxb", "nbo"],
    peers: ["Ayra Starr", "Tyla", "SZA", "Burna Boy", "Wizkid", "Ari Lennox", "Summer Walker", "Asa", "Snoh Aalegra", "Cleo Sol", "Libianca", "Omah Lay"],
    brands: ["Fenty Beauty", "Glossier", "Nike", "Spotify", "Apple Music", "Savage X Fenty", "Telfar", "Ciroc"],
    audience: { age: { "24_and_younger": 0.38, "25_to_29": 0.36, "30_to_34": 0.11, "35_to_44": -0.12, "45_to_54": -0.41, "55_and_older": -0.55 }, gender: { male: -0.14, female: 0.14 } },
  },
  asake: {
    kind: "artist",
    description: "Nigerian Afrobeats and Amapiano-fusion star, 'Mr. Money'.",
    popularity: 0.944,
    markets: ["lag", "lon", "acc", "ams", "hou", "atl", "dub", "man", "tor", "par", "bru", "jnb", "dxb", "nyc", "dc"],
    peers: AFRO_PEERS.filter((p) => p !== "Asake").concat(["Olamide", "Seyi Vibez", "Shallipopi"]),
    brands: ["Puma", "Pepsi", "Bolt", "Hennessy", "Jameson", "Boohoo", "PlayStation", "Audiomack"],
    audience: { age: { "24_and_younger": 0.45, "25_to_29": 0.34, "30_to_34": 0.06, "35_to_44": -0.18, "45_to_54": -0.44, "55_and_older": -0.58 }, gender: { male: 0.12, female: -0.12 } },
  },
  "cedric the entertainer": {
    kind: "person",
    description: "American stand-up comedian, actor and TV host; one of the Original Kings of Comedy.",
    popularity: 0.982,
    markets: ["atl", "hou", "chi", "mem", "stl", "dal", "det", "dc", "clt", "la", "nyc", "mia", "tor", "lon"],
    peers: ["Steve Harvey", "D.L. Hughley", "Kevin Hart", "Mike Epps", "Sommore", "Bernie Mac", "Katt Williams", "Chris Tucker", "Tiffany Haddish", "Earthquake", "Deon Cole", "Lil Rel Howery"],
    brands: ["Coors Light", "State Farm", "Crown Royal", "Buick", "Popeyes", "Old Navy", "Lowe's", "Uber Eats"],
    audience: { age: { "24_and_younger": -0.35, "25_to_29": -0.14, "30_to_34": 0.09, "35_to_44": 0.33, "45_to_54": 0.29, "55_and_older": 0.06 }, gender: { male: 0.04, female: -0.04 } },
  },
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

function idFor(name: string) {
  return `mock-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function profileFor(name: string): Profile {
  const p = PROFILES[name.toLowerCase().trim()];
  if (p) return p;
  // Unknown act: deterministic but plausible global spread.
  const ranked = [...CITIES].sort((a, b) => hash(name + a[0]) - hash(name + b[0])).map((c) => c[0]);
  return {
    kind: "artist",
    description: "Touring act (demo profile).",
    popularity: 0.6 + hash(name) * 0.35,
    markets: ranked.slice(0, 16),
    peers: [...AFRO_PEERS].sort((a, b) => hash(name + a) - hash(name + b)),
    brands: [...AFRO_BRANDS].sort((a, b) => hash(name + a) - hash(name + b)),
    audience: PROFILES["burna boy"].audience,
  };
}

const byId = new Map<string, string>(); // mock id -> act name
function actEntity(name: string): Entity {
  const p = profileFor(name);
  const id = idFor(name);
  byId.set(id, name);
  return { id, name: titleCase(name), kind: p.kind, popularity: p.popularity, description: p.description };
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

function cityEntity(c: City, affinity: number): Entity {
  return {
    id: `mock-city-${c[0]}`,
    name: c[1],
    kind: "destination",
    country: c[2],
    countryCode: c[3],
    lat: c[4],
    lng: c[5],
    affinity,
    popularity: 0.7 + hash(c[0]) * 0.3,
  };
}

function signalName(params: Params) {
  const id = String(params["signal.interests.entities"] ?? "");
  return byId.get(id) ?? id.replace(/^mock-/, "").replace(/-/g, " ");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mockQloo: QlooSource = {
  live: false,
  async search(query, types) {
    await sleep(120);
    if (types.some((t) => t.includes("locality") || t.includes("destination"))) {
      const c = CITIES.find((c) => c[1].toLowerCase().startsWith(query.toLowerCase().trim()));
      return c ? [cityEntity(c, 1)] : [];
    }
    return [actEntity(query)];
  },

  async insights(params) {
    await sleep(160);
    const type = String(params["filter.type"]);
    const take = Number(params.take ?? 10);
    const sigId = String(params["signal.interests.entities"] ?? "");

    // Venue mode: a city as the signal -> acts its audience over-indexes on.
    if (sigId.startsWith("mock-city-") && type === "urn:entity:artist") {
      const code = sigId.replace("mock-city-", "");
      const fans = Object.entries(PROFILES).filter(([, p]) => p.markets.includes(code));
      const local = fans.flatMap(([n, p]) => [n, ...p.peers.slice(0, 6)]);
      const uniq = [...new Set(local.map((n) => n.toLowerCase()))];
      return uniq.slice(0, take).map((n, i) => ({
        ...actEntity(n),
        affinity: +(0.97 - i * 0.03 - hash(n + code) * 0.02).toFixed(3),
        popularity: +(0.55 + hash(n) * 0.44).toFixed(3),
      }));
    }

    const p = profileFor(signalName(params));

    if (type === "urn:entity:destination") {
      return p.markets.slice(0, take).map((code, i) => {
        const c = CITIES.find((c) => c[0] === code)!;
        return cityEntity(c, +(0.98 - i * 0.035 - hash(code + sigId) * 0.02).toFixed(3));
      });
    }
    if (type === "urn:entity:artist" || type === "urn:entity:person") {
      return p.peers.slice(0, take).map((n, i) => ({
        ...actEntity(n),
        kind: p.kind,
        affinity: +(0.95 - i * 0.025).toFixed(3),
        popularity: +(0.5 + hash(n) * 0.48).toFixed(3),
      }));
    }
    if (type === "urn:entity:brand") {
      return p.brands.slice(0, take).map((n, i) => ({
        id: idFor(n),
        name: n,
        kind: "brand",
        affinity: +(0.93 - i * 0.03).toFixed(3),
        popularity: +(0.7 + hash(n) * 0.3).toFixed(3),
      }));
    }
    if (type === "urn:entity:place") {
      const loc = String(params["filter.location.query"] ?? params["filter.geocode.name"] ?? "");
      const c = CITIES.find((c) => c[1].toLowerCase() === loc.toLowerCase()) ?? CITIES[0];
      return c[6].slice(0, take).map((v, i) => ({
        id: idFor(v),
        name: v,
        kind: "place",
        city: c[1],
        country: c[2],
        lat: c[4] + (hash(v) - 0.5) * 0.06,
        lng: c[5] + (hash(v + "x") - 0.5) * 0.06,
        affinity: +(0.9 - i * 0.05).toFixed(3),
        tags: ["Music Venue", "Live Music"],
      }));
    }
    return [];
  },

  async heatmap(params) {
    await sleep(140);
    const loc = String(params["filter.location.query"] ?? "");
    const c = CITIES.find((c) => c[1].toLowerCase() === loc.toLowerCase()) ?? CITIES[0];
    const seed = signalName(params) + c[0];
    const pts: Hotspot[] = [];
    for (let i = 0; i < 40; i++) {
      pts.push({
        lat: c[4] + (hash(seed + i) - 0.5) * 0.22,
        lng: c[5] + (hash(seed + i + "g") - 0.5) * 0.3,
        affinity: +hash(seed + i + "a").toFixed(3),
        popularity: +hash(seed + i + "p").toFixed(3),
      });
    }
    return pts.sort((a, b) => b.affinity - a.affinity);
  },

  async demographics(entityId) {
    await sleep(100);
    return profileFor(byId.get(entityId) ?? entityId.replace(/^mock-/, "")).audience;
  },

  async tags(query) {
    await sleep(80);
    if (/music|venue|concert|live/i.test(query))
      return [
        { id: "urn:tag:genre:place:music_venue", name: "Music Venue" },
        { id: "urn:tag:genre:place:concert_hall", name: "Concert Hall" },
      ];
    return [];
  },
};
