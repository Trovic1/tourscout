# Design: Road Case

TourScout looks like touring road cases: matte laminate panels with brushed-aluminium edging, stencilled case codes, and spike tape whose colour and form mark each stop's status. It is an Operate surface. The standard app shell (top bar, three-column board, tabbed detail section) comes first, and the world shows up only through type, palette, density and one signature move.

## Tokens (src/app/globals.css `@theme`)

| Role | Token | Value |
| --- | --- | --- |
| Page / map ground | `case-950` | `#121212` (map field `#161616`) |
| Panel laminate | `case-900` | `#1a1a1a` + 3px fibre dot texture (`.laminate`) |
| Raised / selected row | `case-850` / `case-800` | `#1f1f1f` / `#242424` |
| Hairline dividers | `case-700` | `#303234` |
| Control borders | `case-600` | `#43474b` |
| Aluminium text / edging | `alu-500/400/300` | `#8d9399` / `#a9afb5` / `#c4c9ce` |
| Ink | `chalk` / `chalk-dim` | `#f2f0ea` / `#b8b5ad` |

Each spike-tape colour has exactly one job:

| Colour | Token | Job |
| --- | --- | --- |
| Yellow `#f2c230` | `tape-yellow` | Selection, the next/primary action, run capacity. Never data. |
| Red `#ec5a43` | `tape-red` | Hold status, alerts, demo-data badge |
| Blue `#4f86f0` | `tape-blue` | Every data series: affinity bars, heat glow, "Rising", live-data badge |
| White `#f2f0ea` | `tape-white` | Anchor status (white gaff tape) |
| Aluminium chevron | `alu-400` | Scout status |

There is no green. Every date is a proposal, and nothing may read as "confirmed".

## Type

- **Saira Stencil**, width 75, weight 800 (`.stencil`, or `stencilDisplay` for mixed case). Used only for 3-letter city codes, the wordmark, the tour headline and "The run". The letter L must keep its foot.
- **Archivo** (variable width): all UI and body text. Use `.tnum` for every number.
- Scale: poster code `clamp(11rem,17vw,16rem)` (52vw on mobile), cropped by the panel's trailing edge only. Headline `clamp(1.6rem,2.6vw,2.4rem)`. Body 14–15px. Labels 11–12px uppercase, tracked 0.04–0.08em.

## Status system

`present.ts → stopStatus` splits the run's own affinity range into thirds: **Anchor** (white, solid), **Hold** (red, dashed), **Scout** (aluminium, chevron). Every place a status appears uses both the colour and the form: `.tape-solid`, `.tape-dashed`, `.tape-chevron`, the map leg strokes and the chip sills.

## Affinity

One 0–100 scale everywhere (`pct`, `score`). Never show decimals. Bars are 8px tall on a `case-700` track.

## Components

- **Aluminium edging** (`.alu-t/.alu-b/.alu-l/.alu-r`): a 2px brushed gradient, the divider between case panels.
- **Plate** (`.plate`): a raised label plate for the city record and the mobile stop strip.
- **Map chip**: 74×24 plate with the stencil code, a 10.5px stop number and a 4px status sill. A leader line runs to a square node. Labels are placed on rings around their stop to avoid collisions.
- **Run row**: date block (day / DD / month), stencil code, city, 0–100 score, venue + km in, full-width status tape.

## Motion

There is one authored sequence. Map legs lay down as spike tape in route order (`tape-lay`, 620ms expo-out, staggered 180ms) while stop chips stamp in (`stamp`, 420ms). The trace stamps each Qloo call as it lands. Elements are visible by default and animate from hidden, and reduced motion collapses everything to 1ms.

## Layout

- Desktop: header plus a three-column board fill `100dvh` (lead panel 300–368px · map · run list 320–384px), with the detail tabs below.
- Mobile: a non-sticky header, then a strip of stop plates, then the lead panel, map and run list.
