# TourScout

**An AI touring agent that routes a tour on real fan taste.**

Give TourScout any touring act (a musician, a comedian, a podcast) and its agent uses [Qloo](https://qloo.com)'s taste graph to:

1. **Rank the world's cities** by how strongly local cultural taste overlaps with the act's audience, including markets the act has never played.
2. **Map fan hotspots** inside the strongest cities with Qloo's geospatial heatmaps, and find the **best-matched live-music venues**.
3. **Route and date the run** with a nearest-neighbour route that starts in the strongest market, then tag each stop as *Anchor*, *Hold* or *Scout*.
4. Surface **taste-matched co-headliners** (including rising, affordable support acts), **sponsor brands** with the highest audience overlap, and the audience's **age and gender skew**.
5. Draft **ready-to-send pitch emails** for promoters and the top sponsor.

**Market mode** works the other way round, for promoters and venue buyers: enter a city and get the acts its audience over-indexes on, with under-the-radar names flagged.

## Why it needs Qloo

An LLM on its own can only guess that an Afrobeats star should play London. TourScout's agent **never invents a city, venue, act or brand**: every entity in the plan comes from a Qloo tool call, and Gemini only orchestrates those calls and writes the narrative. Remove Qloo and nothing is left to plan with.

| Agent tool | Qloo call |
| --- | --- |
| `find_act` | `/search` over artists, people and podcasts |
| `rank_cities` | `/v2/insights` with `filter.type=urn:entity:destination` and the act as the signal |
| `scan_city` | `/v2/insights` with `urn:heatmap` + place insights filtered to music venues in that city |
| `find_co_headliners` | artist / person insights with the act as the signal (`filter.popularity.max` for rising acts) |
| `find_sponsors` | brand insights with the act as the signal |
| `audience_profile` | `urn:demographics` insights |
| `find_market` / `market_lineup` | locality search, then artist insights with the city as the signal |

## How it works

- **Next.js 16** (App Router) and **Tailwind v4**. The UI streams the agent's progress as NDJSON, so you watch every Qloo call land.
- **Gemini** (`gemini-2.5-flash`, free tier) runs a function-calling loop over the Qloo tools and finishes with `finalize_plan`. If Gemini is unavailable or rate-limited, a **rule-based planner** completes the same run on the same Qloo data, so the demo never dead-ends.
- Qloo responses are cached briefly on the server (allowed by the hackathon terms) and are never committed to this repo.

## Run it locally

```bash
npm install
cp .env.example .env.local   # add QLOO_API_KEY and GEMINI_API_KEY
npm run dev
```

With no keys, the app runs on built-in demo data shaped like Qloo's responses and labels itself **Demo data**.

## License

MIT, see [LICENSE](LICENSE). Demo presets name real artists only as examples; no affiliation is implied.
