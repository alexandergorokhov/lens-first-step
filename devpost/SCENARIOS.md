# Scenarios: Find Your Way Inside

Every scenario and where it is tested.

- **Node** tests (pure logic, run `npm test`): `src/core/tests/router.test.ts`,
  `src/core/tests/maps.test.ts`, `src/core/tests/geometry.test.ts`, `src/core/tests/demo.test.ts`,
  `src/core/tests/serve-maps.test.ts`, `src/core/tests/review.test.ts` (review findings C1–C13),
  `src/core/tests/sync.test.ts` (Lens copies, maps index, hook, cleanups). `npm test` first runs
  `npm run sync:check`. Node test names start with the scenario ID where there is one.
- **LEAF** scenarios run inside the Lens in Lens Studio's Interactive Preview
  (`Assets/Tests`, registered in `FindYourWayLeafIndex.ts`). To run them, tick **autoRun** on
  the `LeafIndex` scene object and reset the Preview; each prints
  `[FYW-LEAF] RESULT <id> PASSED|FAILED`. LEAF pinches the real SIK/UIKit buttons; walking,
  seated height and the scanned sign are simulated with test hooks on `FindYourWayMain`
  (LEAF cannot drive WASD/Q/E).

Node 474 tests, all passing (with `OFFLINE=1` the live gist download is skipped).
`src/core/tests/docs.test.ts` checks this count, the test list and every test named below. LEAF
scenarios have each passed in the preview; run them in short groups, because long batches can hit a
tap timeout.

## Approved scenarios

| # | Scenario | Expected result | Tests | Status |
|---|---|---|---|---|
| S1 | Walk: pinch sign at entrance, gate B12, Walk | Shortest path; may use escalator; length matches Dijkstra | Node: "S1 Walk: sign at entrance to B12…", "S1 Walk route is the shortest possible, for every pair of nodes". LEAF: `dc1-scan-sign-line-appears`, `rule-walk-is-shortest` | Passing |
| S2 | Step-Free: same start and gate | No stairs/escalator edge; uses lift or ramp | Node: "S2 Step-Free: same start and gate uses a lift…", "S2 Step-Free never uses stairs or escalators…". LEAF: `dc3-stepfree-seated-lift-reroute`, `rule-stepfree-no-stairs-escalator` | Passing |
| S3 | Switch mode mid-route | Redraws with the other mode's rules | Node: "S3 logic: switching mode mid-route re-routes…" (router logic only) | Lens part removed: the Lens chooses the mode once per trip (brief: out of scope) |
| S4 | Gate change B12 → C3 while walking | Card "Gate change B12 → C3"; re-route from current position; line swings | Node: "S4 Gate change B12 -> C3 while walking…". LEAF: `dc4-gate-change-stairs-and-ramp` | Passing. The card text comes from the map event ("Gate change B12 → C3"); the airport-only router helper was removed. A change made before the scan is kept: LEAF `dest-change-before-scan-sticks` |
| S5 | Lift out in Step-Free | Pinching the red sign closes the lift; new route avoids stairs/escalators | Node: "S5 Lift out in Step-Free…". LEAF: `dc3-stepfree-seated-lift-reroute` (pinches the red sign; re-routes to Lift 2; a closed lift's floor button refuses) | Passing |
| S6 | Arrival | Within 3 m (horizontal, on the destination's level) the line stops; card "Gate C3. Boarding in 6 min."; walking away re-plans once | Node: "S6 Arrival…", "S6b after arriving, 5.5 m from B12 does not report rerouted on consecutive frames and is not stuck", "C9 arrival needs the same level…". LEAF: `dc5-arrival-card`; arrival after riding the escalator / a lift in `dc2-…` and `dc3-…` | Passing |
| S7 | Off route | > 5 m from the line re-routes from the nearest node, on the traveller's own level, without re-triggering every frame | Node: "S7 Off route…", "S7b Off route: staying off the line…", "S7c Off route: the nearest node is on the traveller's own level…". LEAF: `dc2-walk-escalator-corners-arrow` (ground floor under the landing re-plans from escFoot) | Passing |
| S8 | Next turn out of view | Edge arrow toward the next turn | Node (geometry.test.ts): "turn arrow: shows only when the next turn is outside the view…", "S8 on the airport: at the escalator top facing back…". LEAF: `dc2-walk-escalator-corners-arrow` | Passing |
| S9 | Map download works | Downloads map.json from a URL; "online map" badge | Node: "S9/E1 logic: a valid download is used online…", "S9/E1 logic: loadMapWithTimeout uses the download when it arrives in time". Node: "S9 map URL: the map server base folder + the map's file name…" (mapDownloadUrl). Node (serve-maps.test.ts): "map server: serves src/core/data/map.json as JSON with CORS, 404 for anything else". Node: "S9 Lens default mapBaseUrl is the public https map copy", "S9 real download: every map downloads from the public URL, matches src/core/data and loads online" | Passing. The Lens downloads mapBaseUrl + file name; the default is a public gist copy of src/core/data (https). |
| E1 | Download fails or > 5 s | Built-in map; "offline map" badge; route works | Node: "E1 logic: a download slower than the timeout…", "E1 logic: a failed or throwing download…". LEAF: `dc1-scan-sign-line-appears` (real request returns 404 → "offline map", route works) | Passing |
| E2 | Invalid map.json | "Map couldn't load"; falls back to built-in map; no crash | Node: "E2 Invalid map.json…", "E2 logic: an invalid download in time…", "E2 parseMap names what is wrong…". LEAF: `e2-broken-map-fallback` | Passing |
| E3 | No step-free route | "No step-free route. Ask staff at the assistance point."; line to the nearest assistance point | Node: "E3 No step-free route (lift + ramp closed)…", "E3 Both lifts closed…", "hospital: both lifts out…". "C5 noticeFor…" (Walk gets "No route right now…"), "C11 askStaff…" ×2. LEAF: `e3-no-step-free-ask-staff` (red sign on Lift 1 + Lift 2 closed; arriving at the assistance point shows "Assistance point"), `e3b-no-step-free-at-scan` (the card shows right after the scan) | Passing |
| E4 | Destination = current position | Arrival card right away; no line | Node: "E4 Destination = current position…". LEAF: `e4-already-at-destination` | Passing |
| E5 | Unknown sign id | "This sign isn't in the map"; nothing drawn | Node: "E5 Unknown sign id…". LEAF: `e5-unknown-sign` | Passing |
| E6 | Seated height (Q) | Line and cards readable and in view at seated eye height; a seated traveller can ride | Node: "C1 ride reach…", "C1 level snap…". LEAF: `dc3-stepfree-seated-lift-reroute` (sits down before choosing: the floor stays at standing height, line 1 cm above it and within 25° below the eyes), `dc3b-seated-lift-ride` (0.5 m from Lift 2, feet −0.45 m: rides; card "Lift up to Departures") | Logic passing. Real readability on glasses: feel unproven |

## Floors and distance

The route-engine logic passes in Node (`src/core/tests/floors.test.ts`); the Lens shows the
pill (floor badge first, bottom centre), the cue / destination note above it and the up/down post
(`FindYourWayMain.updatePill`, `lineOnLevel`); LEAF `fl1-pill-shows-and-counts-down` and
`fl2-cue-post-and-badge-after-escalator` pass in the preview.

| # | Scenario | Expected result | Tests | Status |
|---|---|---|---|---|
| S10 | Distance pill | "Gate C3 · 140 m · 1 floor down · 3 min" at the bottom centre after the scan; equals the route length at the start, drops as you walk, updates after a re-route, hides at arrival | Node: "S10 Distance: at the start…", "S10 Distance drops as you walk…", "S10 Distance updates after a re-route…", "S10 Pill text…". LEAF: `fl1-pill-shows-and-counts-down` | Passing |
| S11 | Floors and time | Floors counted in storeys (a level's `floor` in the map, else height order; the airport's C pier shares storey 1 with Departures); Walk 1.3 m/s, Step-Free 1.0 m/s; +20 s escalator, +45 s lift, +15 s per floor of stairs; a map can override; mid-escalator still counts from the floor you left | Node: "S11 Floors…", "S11 Time…", "S11 A map can override…", "S11 Halfway up the escalator…" | Passing |
| S12 | Floor badge | First chip of the pill names your floor; changes when a ride ends (from the route, not feet height: C pier and Departures are 1 m apart) | Node: "S12 Floor badge…". LEAF: `fl2-cue-post-and-badge-after-escalator` | Passing |
| S13 | Floor-change cue | Within 15 m of a lift/escalator/stairs/ramp: "In 15 m: lift up to Departures" ("Now:" within 2 m), above the pill; after the scan or a gate change: "Gate C3 is on C pier, 1 floor down"; Step-Free cues are only lifts or ramps | Node: "S13 Floor-change cue…", "S13 Cue texts…", "S13 Step-Free cues…". LEAF: `fl2-cue-post-and-badge-after-escalator` | Passing |
| S14 | Line on your floor | The line ends at the foot of the next floor change with an up/down marker; drawn up an escalator/stairs/ramp once you are on it; in a lift only the marker | Node: "S14 Line on your floor…" (`lineOnLevel`). LEAF: `fl2-cue-post-and-badge-after-escalator` | Passing |
| S15 | Down escalator | Airport has a down escalator beside the up one (`escDownTop` → `escDownFoot`); Walk going down rides it, with it closed takes the stairs; the up one is never ridden down | Node: "S15 Going down on Walk…", "S15 The up escalator is never ridden down…", "Escalators are one-way…" | Passing |
| S16 | Going down by lift and stairs | Step-Free from Departures to the entrance takes a lift down; Departures → C pier: Walk stairs down, Step-Free ramp down | Node: "S16 Riding a lift down…", "S16 Stairs down on Walk…" | Passing |
| S18 | Walk up in the preview | Walking along open stairs, a ramp or an escalator lifts you to its height; stepping off lands on the nearest floor; an escalator only carries its own way | Node: "S18 Walking along stairs…", "S18 Stairs also work…", "S18 Beside the stairs…", "S18 A closed connection…", "S18 An escalator only…", "S18 Every stairs…". LEAF: `walk-up-the-stairs` | Passing |
| W1–W11 | Walls in the preview | Outer walls, shop fronts, lift shafts and the sides of stairs, ramps and escalators stop you and let you slide along them; you walk under a high escalator end; every walkway stays open; a ride or reset is never held back | Node: "W1 every node…", "W2 every walkway…", "W2b every open stairs…", "W3 the outer wall…", "W4 a shop front…", "W5 a stairs' side…", "W6 you can walk under…", "W7 once on the stairs…", "W8 a rail stops you…", "W9 a ride or a jump…", "W10 inside a wall…", "W11 a map with no footprint…" | Passing |
| S15b | Escalator feet and tops joined | A re-route at the foot of the up escalator never sends you back through the hall | Node: "S15 Re-routing at the foot of the up escalator…" | Passing |
| S17 | Three levels, both directions | Ground → Departures → C pier is cued up then down; a trip from upstairs to the entrance arrives | Node: "S17 Three levels…", "S17 A trip that starts upstairs…" | Passing |

## The companion and places

Logic passing in Node (`pet.test.ts`, `places.test.ts`, `play.test.ts`); in the Lens the
companion is a feature you turn on or off on the app panel (waist height, left: "Pet: on/off",
"Change to …", "Places: on/off", play buttons), drawn by `FindYourWayCompanionView` (dog / robot /
rover from light primitives), place icons by `FindYourWayPlacesUI`, interests on the mode panel.
LEAF passing in the preview: `p1-companion-toggle-and-models`, `p3-companion-waits-at-escalator`,
`q4-points-at-interests-and-sponsored`, `pc1-throw-and-fetch-any-model`.

| # | Scenario | Expected result | Tests | Status |
|---|---|---|---|---|
| P1 | Companion on/off | A toggle on the app panel; the line shows either way (at 50%); toggling never changes the route | Node: "P1 Pet on/off…". LEAF: `p1-companion-toggle-and-models` | Passing |
| P2 | It leads | Ahead along the route, on the route | Node: "P2 The pet trots ~2.5 m ahead…" | Passing |
| P3 | It waits at floor changes | Sits at the foot of the escalator/lift; never on another floor before you; trots up, never jumps | Node: "P3 The pet waits at the foot…". LEAF: `p3-companion-waits-at-escalator` | Passing |
| P4 | It waits for you | More than 6 m behind: it stops and looks back | Node: "P4 The pet stops and looks back…" | Passing |
| P5 | Step-Free companion | Only ever on the step-free route | Node: "P5 Step-Free with the pet…" | Passing |
| P6 | Collectibles | At turns, floor changes, the gate and every ~7 m; each collected once; arrival never re-lays or double-counts (real Navigator, airport and room) | Node: "P6 Treats…", "P6 Arrival through a real Navigator…" | Passing |
| P7 | Score kept | Off/on and a re-route keep the score | Node: "P7 Turning the pet off keeps the score…" | Passing |
| P8 | Play catch: throw | Throw the treat: it lands on your floor within ~5 m; no throw while walking, near a turn/floor change or while a card shows. | Node: "P8 A throw lands on your floor…", "P8 No throw while walking…". LEAF: `pc1-throw-and-fetch-any-model` | Passing |
| P9 | Play catch: fetch | The companion runs to the landing spot, catches it (chime), brings it back, then returns to guiding; route, distance and destination never change | Node: "P9 Fetch: the companion runs to the landing spot…". LEAF: `pc1-throw-and-fetch-any-model` | Passing |
| P10 | Any model plays | Dog (treat), robot (bolt), rover (star): the same game, only the model, object and colour change | Node: "G9 Any companion plays…". LEAF: `pc1-throw-and-fetch-any-model` (rover) | Passing |
| Q1 | Places from the map | `kind: "place"` + `category`; nothing shop-specific in code; adding places changes no route | Node: "Q1 …" (2 tests) | Passing |
| Q2 | Icons + mute | ≤3, my floor, ≤15 m and near the route; Step-Free: accessible toilets and lifts first; mute hides all and never changes the route | Node: "Q2 …" (3 tests). LEAF: `q4-points-at-interests-and-sponsored` | Passing |
| Q3 | Interests | coffee, food, shopping, toilets, pharmacy (+ accessible toilets on Step-Free); none by default | Node: "Q3 …" | Passing |
| Q4 | Pointing rules | Only interests or sponsored; "Sponsored" always shown; muted: none; ≤1 per 30 s and 20 m; never within 10 m of a turn/floor change or while a card shows; never behind you; never changes route, distance or destination | Node: "Q4 …" (7 tests). LEAF: `q4-points-at-interests-and-sponsored` | Passing |
| Q5 | Point, then carry on | Steps ~1.2 m off the line toward the place, stays ahead in view, faces it ~3 s, then back on the line 2–3 m ahead | Node: "Q5 …". LEAF: `q4-points-at-interests-and-sponsored` | Passing |
| Q6 | Go here? | The place becomes the destination; Step-Free rules kept | Node: "Q6 …". LEAF: `q4-points-at-interests-and-sponsored` | Passing |
| Q7 | Line at 50% | In every guide mode; Lens default alpha 0.5; video line 0.5 | Node: "Q7 …". LEAF: `p1-companion-toggle-and-models` (line stays) | Passing |
| Q8 | Any companion | dog / robot / rover: same logic, own name, model and collectible | Node: "Q8 …". LEAF: `p1-companion-toggle-and-models` | Passing |
| Q8b | Pick before you walk | Dog / Robot / Rover on the preferences panel; the pick is ticked and turns the companion on | Node: "Q8b …". LEAF: `companion-pick-before-walk` | Passing |

## "Learn this place": mapping by walking

`src/core/mapping.ts` (`MapRecorder`) passes in Node (`mapping.test.ts`); in the Lens,
"Learn this place" on the mode panel opens `FindYourWayMappingPanelUI` (Point here, Stairs / Lift /
Ramp / Step-free, Next name + Name it, Next floor, Undo, Cancel, Save and route). Save checks the map
with `parseMap`, keeps it in persistent storage and loads it as "My place" (after the bundled maps
in the map switch). LEAF `m5-learn-this-place-save-route` passes in the preview. A real reload of the
Lens is a manual check (LEAF checks the stored copy).

| # | Scenario | Expected result | Tests | Status |
|---|---|---|---|---|
| M1 | Start at the sign | The first point is the entrance sign (kind "sign"); a new map has one node | Node: M1 (2 tests in mapping.test.ts). LEAF: `m5-learn-this-place-save-route` | Passing |
| M2 | Point here | Each pinch adds a node at the feet and a walk edge from the previous point, length = distance walked (never less than the straight line); < 0.5 m from the previous point is ignored; near another point it joins it | Node: M2 (3 tests). LEAF: `m5-learn-this-place-save-route` | Passing |
| M3 | Tag a stretch | One pinch turns the last stretch into stairs / lift / ramp / step-free; Step-Free routing then avoids stairs; Next floor starts a new level | Node: M3 (3 tests). LEAF: `m5-learn-this-place-save-route` | Passing |
| M4 | Name a point | Names come from a short list (Entrance sign, Gate, Room, Toilet, Lift, Stairs, Exit, Café, Shop); duplicates become "Room 2"; named points are destinations | Node: M4 (2 tests). LEAF: `m5-learn-this-place-save-route` | Passing |
| M5 | Save and route | Save writes map.json in the `src/core` format, `parseMap` accepts it, routing works on it at once and after a reload (`fromJson`); undo | Node: M5 (4 tests). LEAF: `m5-learn-this-place-save-route` | Passing |

## Peek ahead: hand zoom

`src/core/peek.ts` (`peekModel`) passes in Node (`peek.test.ts`); in the Lens
`FindYourWayPeekView` shows the route model ~60 cm ahead at waist height while you pinch and pull a
hand toward you (SIK hand tracking), and hides it when you let go. LEAF
`pk1-peek-ahead-shows-and-hides` (passing) uses a test hook, since LEAF can't pinch
with a tracked hand.

| # | Scenario | Expected result | Tests | Status |
|---|---|---|---|---|
| Z1 | Pinch and pull | A small model of the route appears ~0.6 m ahead at waist height, the rest of the route glowing and a dot for you | LEAF: `pk1-peek-ahead-shows-and-hides` | Passing |
| Z2 | Let go | Releasing the pinch hides the model | LEAF: `pk1-peek-ahead-shows-and-hides` | Passing |
| Z3 | Route unchanged | Showing or hiding the model never changes the route, distance or destination | Node: Z3 (5 tests in peek.test.ts). LEAF: `pk1-peek-ahead-shows-and-hides` | Passing |

## Play while you wait: Hop

While you stand still with the companion on, a short lane appears on the floor ~1.3 m ahead with
the companion at the near end, seen from behind. Obstacles come from the far end; raise a hand (on
Specs: either wrist near head height, once per raise; in the preview: the Jump button) and it jumps.
A hit: it shakes; raise a hand again (or Play again) to restart. Walking off ends it. Logic:
`src/core/play.ts` (`PlayGate`, `RaiseDetector`, `HopGame`); Lens: `FindYourWayMain.updateCompanion`,
lane and obstacles in `FindYourWayCompanionView`, the line under the pill shows the score.

| # | Scenario | Expected result | Tests | Status |
|---|---|---|---|---|
| G1 | Only while you wait | Offered after 2 s standing still (sway ≤ 0.6 m) with the companion on and no card; walking off or turning the companion off ends it | Node: "G1 Play is offered only while you stand still…". LEAF: `g1-hop-jump-bump-restart` | Passing |
| G2 | Raise a hand to jump | One jump per raise (re-arms when the hand comes down); no double jump in the air; ~0.63 m high, ~0.6 s | Node: G2 (2 tests). LEAF: `g1-hop-jump-bump-restart` (Jump button / test hook) | Passing |
| G3 | Obstacles come from far | They appear at the far end (6 m) and come toward the companion at the game speed | Node: "G3 Obstacles appear at the far end…". LEAF: `g1-hop-jump-bump-restart` | Passing |
| G4 | Jump or bump | Not jumping hits the first obstacle; a well-timed jump clears it | Node: "G4 Not jumping hits the first obstacle…" | Passing |
| G5 | Shake and restart | A hit: it shakes 1.2 s, the game stops; then raise a hand (or Play again) to restart; the best score is kept | Node: G5 (2 tests). LEAF: `g1-hop-jump-bump-restart` | Passing |
| G6 | Always jumpable | Gaps always leave time to land and jump again: a good player never crashes in 2 min (25 seeds) | Node: "G6 Every obstacle can be jumped…" | Passing |
| G7 | Score and speed | Each cleared obstacle counts once; it speeds up a little, up to a cap | Node: "G7 The score counts obstacles cleared…" | Passing |
| G8 | Start and stop | Nothing runs before start or after stop; stop clears it | Node: "G8 The game never runs before start…" | Passing |
| G9 | Any companion | The same game for the dog, robot and rover; their own words | Node: "G9 Any companion plays…" | Passing |

## Shopping mall, several shops

New map `mall` (`src/core/data/mall.json`: 3 floors, 32 places, up and down escalators, stairs,
two lifts, Lift A out-of-service event). The Lens orders the Inspector's `multiStops`
("pharmacy,iceCream,sushi") for the shortest total walk and guides stop by stop ("Stop 2 of 3:
Pharmacy" on the arrival card, Next stop on the app panel). Logic: `src/core/trip.ts`.

| # | Scenario | Expected result | Tests | Status |
|---|---|---|---|---|
| T1 | Best order | The order is no longer than the picked order or any other (every order up to 6 stops), Walk and Step-Free | Node: "T1 best order is no longer…". LEAF: `t1-mall-multi-stop` | Passing |
| T2 | Step-Free legs | Every leg of a Step-Free trip avoids stairs and escalators | Node: "T2 every leg of a Step-Free trip…". LEAF: `t1-mall-multi-stop` | Passing |
| T3 | Stop by stop | Arriving shows "Stop n of N"; Next stop draws the line to the next; then it ends | Node: "T3 arriving and pressing Next…". LEAF: `t1-mall-multi-stop` | Passing |
| T4 | Labels | "Stop 2 of 3: Pharmacy" from the map's names | Node: "T4 labels read…" | Passing |

## A*

`src/core/astar.ts`: A* with a binary heap and a straight-line heuristic (scaled by the map's
smallest edge-to-straight-line ratio, so `EDGE_SLACK` can't make it inexact). Kept beside the plain
Dijkstra (`shortestTree`), which the Lens still uses; A* is for big maps (a mall, a mapped campus).

| # | Scenario | Expected result | Tests | Status |
|---|---|---|---|---|
| A1 | Same as Dijkstra | For every pair of nodes on every map (incl. the mall), Walk and Step-Free: the same length, and no route exactly when Dijkstra finds none | Node: "A1 A* length equals Dijkstra…" | Passing (Node) |
| A2 | Closures | Every closable edge closed, and all lifts closed at once | Node: "A2 closed connections are respected…" | Passing (Node) |
| A3 | One-way and edge cases | Escalators one-way; unknown nodes; a predicate that allows nothing | Node: "A3 one-way escalators…" | Passing (Node) |

## Start at the sign; demo controls hidden

| # | Scenario | Expected result | Tests | Status |
|---|---|---|---|---|
| H1 | Start at the sign | With `startAtSign` (on by default) the building is laid out with you at the entrance sign, facing in; the line starts at your feet; the scan panel floats ~1.2 m ahead (on Specs you look at the sign) | LEAF: `s1-start-at-sign-controls-hidden` | Passing |
| H2 | Demo controls hidden | Off by default (`showDemoControls`); the LEAF suite and recordings turn them on | LEAF: `s1-start-at-sign-controls-hidden` | Passing |

## Done criteria

| # | Done criterion | LEAF scenario | Status |
|---|---|---|---|
| 1 | Scanning the start | `dc1-scan-sign-line-appears` | Passing |
| 2 | Walking through the building (escalator, corners, turn arrow) | `dc2-walk-escalator-corners-arrow` | Passing |
| 3 | Wheelchair at seated height; red sign on Lift 1 → Lift 2 | `dc3-stepfree-seated-lift-reroute` | Passing |
| 4 | Gate change: stairs (Walk) / ramp (Step-Free) | `dc4-gate-change-stairs-and-ramp` | Passing |
| 5 | Arrival card within 3 m | `dc5-arrival-card` | Passing |
| 6 | Map builder: two floors, shops marked, upload | `b3-dc1-map-builder-two-floors` | Passing |
| 7 | The companion stops at shops that match | `b3-dc2-companion-stops-at-matches` | Passing |
| 8 | Turn around: it runs round you | `b3-dc3-turn-around` | Passing |
| 9 | Matches on another floor | `b3-dc4-another-floor` | Passing |
| 10 | Companion off: the offers button still works | `b3-dc5-companion-off-dots` | Passing |
| 11 | Go to a place | `b3-dc6-go-to-a-place` | Passing |

## Other checks

| Check | Tests | Status |
|---|---|---|
| Step-Free never uses stairs or an escalator (all bundled maps, all node pairs, each closable connection closed) | Node: "<map>: Walk is the shortest route and Step-Free never uses stairs…", "<map>: closing each closable connection…" (airport, hospital, campus, room). LEAF: `rule-stepfree-no-stairs-escalator` (3016 routes) | Passing |
| Walk is the shortest route (all bundled maps, all node pairs, brute force) | Node: "<map>: Walk is the shortest route…". LEAF: `rule-walk-is-shortest` (796 routes + the live trip) | Passing |
| Map files valid, self-consistent, and Lens copies identical | Node: "<map>: map file is valid and its Lens copy … is identical", "<map>: edges are at least the straight-line distance…" | Passing |
| Hospital map: stairs vs Lift A, Lift A out → Lift B, room change → X-ray | Node: "hospital: …" tests | Passing |
| Campus map: outdoor quad, Science stairs vs lift, lift out → ramp, room change → Lab 2, Library | Node: "campus: …" tests | Passing |
| Preview room map: short line on the real floor | Node: "room: short route on the room floor…" | Passing |
| Map switch cycles Airport → Hospital → Campus → Room, each restarting at the mode panel | LEAF: `map-switch-cycle` | Passing |
| Restart trip resets cleanly (mode panel, no line, no stale cards, closures reopened) | LEAF: `restart-resets-trip` | Passing |
| Autoplay demo: every beat reached in order, every button press found its button, the three arrival cards showed | Node (demo.test.ts): beat order, polyline walking at 1.4 m/s with 3× on long straights. LEAF: `demo-autoplay-completes` (whole demo at 10× speed) | Passing |
| Local map server (`npm run maps`) | Node (serve-maps.test.ts) | Passing |
| Lens maths (headings, next turn, metres ↔ cm, line stops at a lift) and router/geometry Lens copies identical | Node: geometry.test.ts | Passing |

## Review fixes (independent review, fixed test-first)

| Finding | Test(s) | Status |
|---|---|---|
| C1 Seated Step-Free could not ride; anchoring followed the crouch | Node: "C1 ride reach…", "C1 level snap…". LEAF: `dc3b-seated-lift-ride`, `dc3-stepfree-seated-lift-reroute` | Passing |
| C2 Per-map trip distances (room) | Node: "C2 tripSettings…", "C2 room: one metre past the sign is still onRoute", "C2 room: change to the door from mid-room gives a route" | Passing |
| C3 Stuck re-reporting "rerouted" after leaving the destination | Node: "S6b after arriving, 5.5 m from B12…" | Passing |
| C4 Destination change before the scan lost | LEAF: `dest-change-before-scan-sticks` | Passing |
| C5 One notice after every route change (Walk message, error text, at scan) | Node: "C5 noticeFor…". LEAF: `e3b-no-step-free-at-scan` | Passing |
| C6 Map frame ignored the start node's height | Node: "C6 map frame: start node is the local origin even at y=4…" | Passing |
| C7 Place block / events / version not validated | Node: "E2b parseMap rejects place/event refs…" | Passing |
| C8 Ids like "toString" broke lookups | Node: "C8 …" ×3 (incl. findRoute never throws) | Passing |
| C9 Arrival through a floor | Node: "C9 arrival needs the same level…" | Passing |
| C10 Connection-only change not detected | Node: "C10 setProfile reports a change when only the connection kind changes" | Passing |
| C11 Ask-staff guidance not tracked; no arrival at the assistance point | Node: "C11 askStaff…" ×2. LEAF: `e3-no-step-free-ask-staff` | Passing |
| C12 Stale map load; rebuild lost closures | LEAF: `c12-stale-load-and-closures-kept` | Passing |
| C13 Campus in the picker; yaw looking down; "Re-routing" only if used | Node: "C13 yaw…", "C13 closure card…", "A1/C13 the maps index…". LEAF: `closure-card-signs-and-5s-hide` | Passing |
| Spec gaps: red sign ~1.2 m, ride card text, a red sign for every lift, 5 s card hide | Node: "Spec gap: the ride card…", "Spec gap: every closable lift…". LEAF: `closure-card-signs-and-5s-hide`, `dc3-…` | Passing |
| A1 `npm run sync` / `sync:check` / `hooks`, maps index | Node: "A1 sync:check…", "A1 npm test runs sync:check first…", "A1/C13 the maps index…" | Passing |
| A2 Pure place module (`src/core/place.ts`) | Node: "A2 place.ts: placeOf defaults, levelName, approachDir, arrivalText" | Passing |
| A4 Dead code, airport-only helpers, `setGate`, `* 0 +` | Node: "A4 no dead helpers…" | Passing |

## Notes on the logic

- Distances are in metres in the map files; the Lens converts to centimetres (`src/core/geometry.ts`).
- "Current position" re-routes start from the nearest map node on the traveller's level
  (`levelDistance`: horizontal distance + 5 × height difference), never the destination itself.
  Feet within 1 m of a level count as on it (`snapToLevel`), so a seated traveller is on the floor.
- Arrival radius 3 m, off-route distance 5 m and ride reach 2.5 m (lift) / 3.5 m (others) are
  defaults in `router.ts`; a map's `place` block can override them (`tripSettings`; the preview
  room uses 0.6 m / 1.5 m). Arrival and ride reach are horizontal, on the same level.
- The shared core is `src/core/{router,geometry,demo,place,pet,places,play,mapping,peek,trip,astar}.ts`; `npm run sync` copies it and the
  maps listed in `src/core/data/index.json` into `Assets/`.
- E3 uses the map's `assistance` node; the route to it is returned with the ask-staff result
  so the Lens can draw it.

## Voice, the map picker, Tour, seated play, catch by hand

| ID | Scenario | Test |
|---|---|---|
| v1 | Talk: what you say reaches the plain-code matcher; no match says so | LEAF `v1-voice-reaches-the-matcher` (words fed in; the live mic is a manual check) |
| pm1 | "Where to?" as a map, floor by floor; a pinch picks the place | LEAF `pm1-pick-a-place-on-the-map`, Node U1-U13 |
| tr1 | Tour: preferences, then the matching shops stop by stop | LEAF `tr1-tour-stop-by-stop`, Node U1-U13 |
| sp1 | Seated: play moves close and short, a pinch jumps, standing up ends it | LEAF `sp1-seated-play`, Node S1-S9 |
| gt1 | Catch by hand: pinch the treat, swing, let go; it lands within reach | LEAF `gt1-grab-and-throw`, Node G1-G3 |
| R1-R3 | The video edit keeps the right stretches and times the captions | Node `reel-edit.test.ts` |
| Map 5a | A floor-plan photo to a map: `npm run map:from-plan` | Node `map-from-plan.test.ts` |
