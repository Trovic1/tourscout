# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Primary: artist teams — managers, booking agents and independent touring acts (musicians, comedians, podcasters) deciding where to tour next. Secondary: promoters and venue buyers deciding which acts their market would buy tickets for (venue mode). Evaluators for the Qloo Agentic Hackathon (Oct 2026) include live-entertainment executives (Live Nation), an entertainer, investors and Qloo's CTO; they will open the hosted demo cold, with no login or setup.

## Product Purpose
TourScout is an AI touring agent. Given an act, it uses Qloo's taste graph to find the cities whose audiences over-index on that act's taste, maps fan hotspots and best-matched venues inside each city, routes and dates a tour, and surfaces taste-matched co-headliners, sponsor brands, audience demographics and ready-to-send booking and sponsor pitches. Success: a manager gets a credible, data-backed routing plan in under a minute, including markets they would not have guessed.

## Positioning
Every city, venue, act and brand comes from Qloo's measured cultural-affinity data, not from an LLM's guess. The LLM (Gemini) only orchestrates tools and writes narrative. Without Qloo the product does not work.

## Operating Context
Used during tour planning and pitching: shortlisting markets, holding dates with promoters, approaching sponsors. Output is meant to be shared with promoters, agents and brands.

## Capabilities and Constraints
- Act mode (primary) and venue/market mode (secondary).
- Live agent trace shows each Qloo tool call as it happens.
- Qloo hackathon API (hackathon.api.qloo.com); Gemini free tier with a rule-based fallback planner; mock data mode until the live key is set, clearly labelled.
- Must be publicly hosted (Vercel), instant to try, open-source licensed.
- Qloo response data must not be committed to the public repo.

## Brand Commitments
Name: TourScout. Tone: industry-neutral professional tool; culture comes from the data shown, not from decoration.

## Evidence on Hand
No customers, testimonials or benchmarks exist. Do not fabricate any. Demo presets (e.g. Burna Boy, Tems, Cedric the Entertainer) are examples only, with no affiliation implied.

## Product Principles
1. Data over vibes: every recommendation shows the Qloo signal behind it.
2. Instant value: a judge or manager sees a full plan from one click.
3. Shareable output: plans read like something you would forward to a promoter.
4. Honest provenance: always label live vs demo data and how the plan was reasoned.
