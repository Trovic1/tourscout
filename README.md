# TourScout

**Plan a first tour from who you sound like.**

Big acts know where to tour two years out. The artist who can't plan is the one Google hasn't heard of yet: no streaming history, no data, no booking agent. TourScout is for them.

The artist names up to three acts they sound like and the city they're based in. TourScout's agent treats **the fans of those acts as the artist's future fans** and uses [Qloo](https://qloo.com)'s taste graph to plan a first run:

1. **Cities, ranked** by how strongly local taste overlaps with those fans, each with its distance from home, so the first run stays affordable: opening night at home, mostly within a drive or a short flight, at most one long-haul market.
2. **Rooms that fit**: the music venues in each city whose crowd matches those fans, plus where in the city the fans cluster.
3. **A route with dates**, ordered to cut travel and held about 12 weeks out so rooms can still be booked.
4. **Who to play with**: bigger acts with the same fans to ask for a support slot, and acts at a similar stage to share bills with.
5. **Brands to pitch** that those fans already buy, with a small, realistic ask for each.
6. **Emails ready to send** to a venue booker and a brand, written from the data and never inflated.

Qloo lists many acts it holds no fan data for. TourScout checks every reference act up front, tells the artist which ones can't be used, and plans only from those that carry a real signal.

## Why it needs Qloo

An LLM on its own can only guess where an unknown Lagos singer should play. TourScout's agent **never invents a city, venue, act or brand**: every entity in the plan comes from a Qloo call, and the model only orchestrates those calls and writes the words. Remove Qloo and nothing is left to plan with.

| Agent step | Qloo call |
| --- | --- |
| `check_references` | `/v2/insights` per reference act, to confirm it carries fan data |
| `locate_home` | `/search` over localities |
| `rank_cities` | `/v2/insights`, `filter.type=urn:entity:destination`, the reference acts as the signal, a popularity floor so villages and resorts drop out |
| `scan_city` | `urn:heatmap` and music-venue place insights around the city's coordinates |
| `find_bill_mates` | artist insights with the references as the signal, split by reach into acts to open for and peers |
| `find_sponsors` | brand insights with the references as the signal |
| `audience_profile` | `urn:demographics` per reference act, averaged |

## How it works

- **Next.js 16** (App Router) and **Tailwind v4**. The page streams the agent's progress as NDJSON, so you watch every Qloo call land.
- **Bring your own model.** A language model runs a function-calling loop over the Qloo tools and finishes with `finalize_plan`. It can be:
  - **any OpenAI-compatible API** (OpenAI, Claude through Anthropic's compatibility endpoint, Groq, OpenRouter, Mistral, a local Ollama model...), set with `LLM_BASE_URL`, `LLM_API_KEY` and `LLM_MODEL`;
  - **Google Gemini**, set with `GEMINI_API_KEY` (the hosted demo uses `gemini-flash-lite-latest`, the fastest at tool calls);
  - **no model at all**: a rule-based planner builds the plan from the same Qloo data.

  Whichever model you use gets a 70-second budget and retries on rate limits; if it fails or runs out of time, the rule-based planner finishes the run, so a plan always arrives. Each plan shows which model made it.
- Qloo responses are cached briefly on the server (allowed by the hackathon terms) and never committed to this repo.
- Example runs open directly: `/?example=lagos`, `london`, `atlanta`, `nairobi`, `accra`.

## Run it locally

```bash
npm install
cp .env.example .env.local   # add QLOO_API_KEY, then pick a model option (see the comments)
npm run dev
```

`.env.example` explains the three model options. With no Qloo key, the app runs on built-in demo data shaped like Qloo's responses and says so in the footer.

## License

MIT, see [LICENSE](LICENSE). Example runs name real artists only as reference points for an unnamed artist's sound; no affiliation is implied.
