---
status: draft
---

# Design brief 2: Find Your Way Inside — floors, distance, the companion and places

Builds on `devpost/design-brief.md` (approved, unchanged). Folds in the feature handoff, addendum 1
and the decisions of 2026-10-29 (local notes, not in git). Everything building-specific still comes
from the map file.

**Hard requirement: everything must work in the app (the Lens).** A feature is done only when it
runs in the Lens in the Lens Studio preview and passes its LEAF test, not when it passes in Node or
shows in a three.js video. The three.js videos are concept renders.

Items marked **(built)** have their logic and Node tests done **and their Lens UI written and
type-checked** (2026-10-29, fifth round), with LEAF scenarios written test-first. They are **not
done** until those LEAF scenarios pass in the preview (they have not been run yet: Lens Studio must
be connected).
Items marked **(default)** were not decided by you; change them freely.

## The one spatial moment (unchanged, extended)
The blue line on the floor leads you through the airport. Now it also tells you how far, how long
and which floor, warns you before every floor change, and — if you turn it on — a small companion
walks ahead of you, waits at the escalator, and points out the places you care about without ever
changing your route.

## What's new

### Floors everywhere (your top priority)
- **a. Floor badge (built):** the first chip of the distance pill names your floor ("Ground floor",
  "Departures"). It comes from the route, not the feet height (C pier and Departures are 1 m apart),
  and changes when a ride ends.
- **b. Floor-change cue (built):** within 15 m of a lift, escalator, stairs or ramp:
  "In 15 m: lift up to Departures" ("Now: …" within 2 m), just above the pill. Step-Free cues are
  only lifts and ramps. Right after the scan or a gate change: "Gate C3 is on C pier, 1 floor up".
- **c. The line on your floor (built):** the line ends at the foot of the next floor change, where a
  short glowing up/down post stands instead of a line through the ceiling. Once you are on the
  escalator, stairs or ramp it is drawn up it; in a lift only the post shows.
- **d. Floors in distance and time (built):** floors are counted in storeys: a map level may give
  its `floor` number (the airport's C pier shares storey 1 with Departures), else levels count in
  height order. Time: Walk 1.3 m/s, Step-Free 1.0 m/s; +45 s per lift, +20 s per escalator,
  +15 s per storey of stairs; a map can override (`place.speeds`, `place.rideTimes`).
- **e. Places are floor-aware (built for icons and pointing):** only places on your floor show or
  get pointed at. "1 floor up" for places on other floors waits for voice/"Where to?" (feature 3).
- **f. Mapping per floor:** not started (feature 5).
- **g. Going down (built):** the airport has a down escalator beside the up one (its own one-way
  edge, top → foot, walk links between the two feet and the two tops). Walk going down rides it;
  with it closed, the stairs. Lifts, stairs and ramps ride down; cues say "down".
  Open: a lift out of service on one floor only.

### 1. Distance pill (built)
"Gate C3 · 140 m · 1 floor up · 3 min" at the bottom centre, ~1 m ahead, light glass, the floor badge
as its first chip. Shows after the scan, counts down, updates on any re-route, hides at arrival.

### 2. Places along the way + mute (built: logic and video)
- Places are map nodes of kind `place` with a `category` (coffee, food, shopping, toilet, pharmacy,
  accessibleToilet) and optional `sponsored` / `sponsorTag`. Nothing shop-specific in code.
- Small round icons, ~40% see-through, on the shop front at eye height: only on your floor, within
  15 m of you and 10 m of the route, at most 3 at once; Step-Free lists accessible toilets and lifts
  first. Names show when pointed at (looking straight at one: Lens-only, to build).
- "Places on/off" (mute) on the small waist-height app panel (default): hides the icons and stops
  the pointing; never changes the route.
- "Go here?" on a place makes it the destination: the same re-route as a gate change, Step-Free
  rules kept.

### 6. The companion (built: logic and video) — a feature you turn on or off
- A toggle on the app panel (labelled with the companion's name). Off: just the line. On: the
  companion **and** the line, which stays at 50% (addendum B).
- Any model: a dog ("Pet", collects treats), a robot ("Robot", bolts) or a rover ("Rover", stars).
  Same logic; only the model and the words change. Default: the dog.
- It trots ~2.5 m ahead along the route, always on your floor; sits at the foot of a lift,
  escalator, stairs or ramp until you get there, then rides up just ahead; stops and looks back if
  you are more than 6 m away; hops at the gate.
- **The game:** collectibles at every turn, every floor change, the destination, and every ~7 m
  along long stretches. Walking within 1.5 m collects one; "Treats 3 of 7" sits under the map
  badge; arriving says "All 7 treats found!". The score survives turning it off and on and a
  re-route; arriving never re-lays or double-counts.
- **Play catch (built; the Lens throws with a "Throw a treat" button, grab-and-throw with the hand
  is still to do):** while you wait (at a lift, the gate, the lounge) you can grab the small
  treat by your hand and throw it (standard grab and throw); the companion runs to where it lands,
  catches it and brings it back. The dog fetches a treat, the robot catches a bolt, the rover scoops a
  star: same game, different model. Lands only on your floor within ~5 m; never changes the route;
  not while walking a turn or floor change or while a card shows.
- **Pointing out places (addendum C):** pick interests on the mode panel (coffee, food, shopping,
  toilets, pharmacy; Step-Free adds accessible toilets; none by default). When you pass a matching
  place within 10 m of the route, the companion steps ~1.2 m off the line toward it (still
  ahead of you and in view, never on the line, never behind you), faces it and points (paw / arm /
  camera head) for 3 s; the icon brightens with its name and "Go here?"; then it steps back onto the
  line 2–3 m ahead. You follow the companion; the companion follows the line.
  Limits: one point per 30 s and per 20 m; never within 10 m of a turn or floor change; never
  while a gate-change or out-of-service card shows; never at a place behind you; mute stops it.
- **Sponsored places:** count as a match, follow the same limits, and always show their tag
  ("Sponsored · demo" in the demo map; the data is made up). They can never change the route or
  the destination. Video beat: "Shops can pay to be pointed out. The route never changes."

### 7. Play while you wait: Hop (built) — the user's game
A part of the companion feature (only when it is on). While you stand still (~2 s), "Play while you
wait" puts a short lane on the floor ~1.3 m ahead, the companion at the near end seen from behind.
Obstacles come from the far end; raise a hand (either wrist near head height, once per raise) and it
jumps; a hit makes it shake, then a raised hand plays again. Score and best under the pill. Walking
off ends it. Never touches the route. In the preview a "Jump" button stands in for the raised hand.
Scenarios G1–G9.

### 8. Shopping mall, several shops (built)
New `mall` map; the Inspector's `multiStops` are ordered for the shortest walk and guided stop by
stop ("Stop 2 of 3: Ice Cream", Next stop). Scenarios T1–T4. A* (`src/core/astar.ts`) is built and
proven equal to Dijkstra on every pair (A1–A3); the Lens still uses the plain Dijkstra.

### 3. Voice "Take me to…" — built (Talk button; the live mic still needs a person to try it)
Spike on Nov 1 (ask first, throwaway scene): ASR in Interactive Preview, then one Gemini request
through the Remote Service Gateway. Fallback either way: a "Where to?" panel listing destinations
and places. Keep "Voice: none" until the spike passes.

### 4. Peek ahead (hand zoom) — built (stretch)
No camera needed. Pinch and pull toward you: a small 3D model of the building appears ~0.6 m ahead
at waist height, the rest of the route glowing on it and a dot for you; let go to hide it. Built from
the map (the stand-in geometry plus the route points), so it works on Specs and in the preview. The
route never changes. Proposed LEAF: Z1–Z3 in SCENARIOS.md.

### 5. "Learn this place" (mapping mode) — built (+1 Innovation: who makes the map?)
An in-Lens mode: the person walks around and tags places, and that walk is the map. The first point is the entrance sign. Walk and pinch **Point here** at corners,
doors and lifts; each point joins the previous one. One pinch tags a stretch as stairs, lift, ramp or
step-free; points are named from a short list. **Save** writes a map.json in the `src/core` format
(checked with `parseMap`) to persistent storage, and the Lens routes on it at once.
Tests first: Node for the `src/core` logic (proposed M1–M5 in SCENARIOS.md), then LEAF: map 4
points in the preview room, save, route, reload. The photo-to-map tool (one plan per floor) stays
an agent-side helper.

## Where things live
- Distance pill with the floor badge: bottom centre of the view, ~1 m ahead, a little below eye level.
- Floor-change cue / destination-floor note: just above the pill.
- Collectibles score: under the online/offline map badge, top left.
- Up/down post: on the floor at the foot of the floor change.
- Companion: on the floor, ~2.5 m ahead on the route.
- Place icons: on the shop front, ~1.75 m up.
- App panel (companion toggle, Places on/off): waist height, to your left (default).
- Interests: on the mode panel, below Walk / Step-Free.

## When things show
- Pill: from the scan to arrival. Cue: within 15 m of a floor change. Destination note: ~3.5 s after
  the scan or a gate change.
- Up/down post: while the next floor change is within the 12 m of line drawn.
- Companion and collectibles: while the toggle is on.
- Icons: within 15 m, max 3; pointing: per the limits above, 3 s each.

## Done criteria (checkable in the preview)
1. After the scan the pill reads "Gate B12 · 58 m · 1 floor up · 1 min" and counts down as you walk.
2. 15 m before the escalator: "In 15 m: escalator up to Departures"; the line ends at its foot with
   an up post; after riding, the badge reads "Departures".
3. From Departures to the entrance on Walk you ride the down escalator; on Step-Free, a lift down.
4. Turning the companion on shows it ~2.5 m ahead with the line still at 50%; it waits at the
   escalator foot; turning it off keeps the score.
5. With "coffee" picked, the companion points at the café on the B pier walk; the sponsored juice bar
   shows "Sponsored · demo"; the route, distance and gate never change; "Places off" stops it all.

## Video beats (under 3 minutes)
1. 0:00–0:15 the problem, "stand-in building".
2. 0:15–0:30 choose Walk + interests (coffee), scan the sign; pill and destination floor.
3. 0:30–1:00 Walk: cue before the escalator, the up post, badge changes at the top.
4. 1:00–1:15 gate change → C3, "stairs down" cue.
5. 1:15–1:45 companion on: it waits at the escalator, points out the sponsored juice bar ("the
   route never changes") and the café; collectibles.
6. 1:45–2:25 Step-Free seated: lift cue, Lift 1 out, Lift 2.
7. 2:25–2:45 the robot / rover swap (one shot) and the down escalator.
8. 2:45–3:00 how it was built: the map file, a plain Dijkstra over the map graph (Step-Free just
   removes stairs and escalators: `shortestTree` in `src/core/router.ts`), the tests.

## Technical beats
- Routing is a plain Dijkstra over the map graph (`shortestTree` in `src/core/router.ts`, ~25 lines,
  linear scan for the next node: the maps are small). Both modes minimise distance; Step-Free never
  sees stairs or escalator edges. Caption for the video: "Plain Dijkstra over the map graph;
  Step-Free removes stairs and escalators."

## What to cut first if behind
1. The voice stretch (AI).
2. Robot/rover models (keep the dog).
3. Collectibles game (keep the companion guiding and pointing); play catch goes with it.
4. Pointing at interests (keep sponsored + icons).
5. Up/down post (keep the cue card).
6. "Learn this place" (mapping mode), then peek ahead (stretch, below mapping).

## Risks and open questions
- The Lens UI for all of the above is written and type-checks, but has **not run in the preview
  yet**; 11 LEAF scenarios are written and waiting. Expect fixes on the first run.
- Map changes shift the Lens's ride ids (`"r"+index`) and add a second escalator to the
  "escalator" visual baseline; the LEAF scenarios look ids up by node, but re-run them all.
- Stand-in model: the Lens draws place nodes' walk edges like corridors (check it looks right).
- No pill while following the ask-staff line (askStaff route): decide whether to show one.
- Lift out of service on one floor only: not modelled.
- The online map gist must be updated with the new map.json (the live download test compares them).
- Feel unproven: pointing frequency on real glasses; companion size and opacity on the additive display.

## Evening plan, Nov 1–8 (TDD: LEAF scenario red first, then the Lens code)
- **Nov 1:** voice spike (ask first, throwaway scene): ASR + one gateway request; report. Then wire
  the pill + floor badge into the Lens (`tripAhead`, `tripPill`); LEAF `fl1`, `fl2`.
- **Nov 2:** floor-change cue + up/down post (`floorCueFor`, `lineOnLevel`); down-escalator ride
  button at the top; re-run all 19 LEAF; refresh the escalator visual baseline. LEAF `fl3`.
- **Nov 3:** place icons + "Places off" + "Go here?" on the app panel (`visiblePlaces`). LEAF for Q2, Q6.
- **Nov 4:** companion toggle + dog model + collectibles (`PetGuide`); LEAF for P1, P3.
- **Nov 5:** interests on the mode panel + pointing (`PointingCoach`, `PetGuide.point`); LEAF for Q4, Q5.
- **Nov 6:** feature 5a photo-to-map (one plan per floor) or voice "Where to?" panel, per the spike.
- **Nov 7:** polish + record the 3-minute video in the preview.
- **Nov 8:** buffer, submit.
