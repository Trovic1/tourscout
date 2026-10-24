import { qloo } from "@/lib/qloo";

/** The "sounds like" picker.
 *  GET /api/acts?q=tay  -> matching artists
 *  GET /api/acts?check=<id> -> whether Qloo holds fan data for that act */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = qloo();

  const check = url.searchParams.get("check")?.trim();
  if (check) {
    try {
      return Response.json({ id: check, ok: await q.hasSignal(check.slice(0, 80)) });
    } catch {
      return Response.json({ error: "Couldn't reach Qloo. Try again." }, { status: 502 });
    }
  }

  const term = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
  if (term.length < 2) return Response.json({ results: [] });
  try {
    const hits = await q.search(term, ["urn:entity:artist"], 6);
    return Response.json({
      results: hits.map((h) => ({
        id: h.id,
        name: h.name,
        image: h.image,
        reach: h.popularity === undefined ? undefined : Math.round(h.popularity * 100),
        about: h.description,
      })),
    });
  } catch {
    return Response.json({ error: "Couldn't reach Qloo. Try again." }, { status: 502 });
  }
}
