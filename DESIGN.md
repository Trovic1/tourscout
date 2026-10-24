# Design

TourScout's interface follows the taste skill's app-screen rules, style **True-black flat** (seed 1481519971, kind *creator*). Gigs happen at night and artists check this on their phones in short sessions, so the screen is dark, flat and quiet, and colour is kept for the data.

## The move

Elevation by lightness alone: ground `#000`, card `#111`, nested panel `#2a2a2a`. No borders or shadows on cards (the only shadow sits on the floating picker menu). The one primary control is inverted: a white 36px pill with black text. Secondary controls are outlined pills.

## The face

- **One hue, stage-light amber `#f2b33d`**, the colour of tungsten bulbs in small rooms, in place of the dealt lime. It appears only on data: the route line, the selected stop and the affinity bar. Never on buttons, tabs or navigation. The logo mark is the only other place it appears.
- **The signature element**: the route map and the run sheet, side by side. The run sheet is set like the dates on the back of a tour T-shirt.
- **The intake as the first run**: the form sits where the plan will appear, with real example runs (and the reference artists' photos from Qloo) underneath.

## Type

Inter 400/500/600 for everything. Source Serif 4 600 has one job: the 48px greeting on the first screen (30px on phones). App sizes: title 24, section 16, figures 24, body 14, meta 12. Tabular figures on every number.

## Screens

- **Intake.** Question: "What do I need to give you?" Artist name (optional), home city, up to three sound-alike acts. Each pick is checked against Qloo and shown struck through if it holds no fan data.
- **Plan.** Question: "Where should this artist play first, and in what order?" Answered by the biggest block (map + run sheet). The line under the title states the one finding (where these fans over-index most against home). Below: two stacks that end level, with the selected stop, emails, audience and all ranked cities on the left, and who to play with, brands, and how the plan was made on the right.

## Motion

Feedback only: press, hover, focus. The route legs draw in order when a plan lands; they are visible by default and only animate once the browser is painting frames, so a background tab or screenshot never shows an empty route. Reduced motion turns it off.

## Checks

`lint.mjs --app` and `inspect.mjs --app` from the taste skill pass with 0 FAIL on both screens at 1440, 768 and 390. One defended warning: the intake's 48px serif greeting, which the sheet's home pattern specifies.
