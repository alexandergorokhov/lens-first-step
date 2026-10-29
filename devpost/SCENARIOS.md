# Scenarios: Find Your Way Inside

Approved test scenarios and where each is tested.

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

Status as of the last run: Node 144 passed, 0 failed, 1 skipped (the live gist download, run
offline; it needs the gist updated with the new map.json). LEAF 19 of 19 passed (before the floors work; the proposed S10–S17 LEAF tests are not
written yet).

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
| S9 | Map download works | Downloads map.json from a URL; "online map" badge | Node: "S9/E1 logic: a valid download is used online…", "S9/E1 logic: loadMapWithTimeout uses the download when it arrives in time". Node: "S9 map URL: the map server base folder + the map's file name…" (mapDownloadUrl). Node (serve-maps.test.ts): "map server: serves src/core/data/map.json as JSON with CORS, 404 for anything else". Node: "S9 Lens default mapBaseUrl is the public https map copy", "S9 real download: every map downloads from the public URL, matches src/core/data and loads online" | Passing. The Lens downloads mapBaseUrl + file name; the default is a public gist copy of src/core/data (https, since the repo is private). "online map" badge in the preview: confirm by eye |
| E1 | Download fails or > 5 s | Built-in map; "offline map" badge; route works | Node: "E1 logic: a download slower than the timeout…", "E1 logic: a failed or throwing download…". LEAF: `dc1-scan-sign-line-appears` (real request returns 404 → "offline map", route works) | Passing |
| E2 | Invalid map.json | "Map couldn't load"; falls back to built-in map; no crash | Node: "E2 Invalid map.json…", "E2 logic: an invalid download in time…", "E2 parseMap names what is wrong…". LEAF: `e2-broken-map-fallback` | Passing |
| E3 | No step-free route | "No step-free route. Ask staff at the assistance point."; line to the nearest assistance point | Node: "E3 No step-free route (lift + ramp closed)…", "E3 Both lifts closed…", "hospital: both lifts out…". "C5 noticeFor…" (Walk gets "No route right now…"), "C11 askStaff…" ×2. LEAF: `e3-no-step-free-ask-staff` (red sign on Lift 1 + Lift 2 closed; arriving at the assistance point shows "Assistance point"), `e3b-no-step-free-at-scan` (the card shows right after the scan) | Passing |
| E4 | Destination = current position | Arrival card right away; no line | Node: "E4 Destination = current position…". LEAF: `e4-already-at-destination` | Passing |
| E5 | Unknown sign id | "This sign isn't in the map"; nothing drawn | Node: "E5 Unknown sign id…". LEAF: `e5-unknown-sign` | Passing |
| E6 | Seated height (Q) | Line and cards readable and in view at seated eye height; a seated traveller can ride | Node: "C1 ride reach…", "C1 level snap…". LEAF: `dc3-stepfree-seated-lift-reroute` (sits down before choosing: the floor stays at standing height, line 1 cm above it and within 25° below the eyes), `dc3b-seated-lift-ride` (0.5 m from Lift 2, feet −0.45 m: rides; card "Lift up to Departures") | Logic passing. Real readability on glasses: feel unproven |

## Proposed: floors and distance (brief 2, features a–d, g and 1)

Status "proposed": the route-engine logic is built and passes in Node
(`src/core/tests/floors.test.ts`) and shows in the demo video; the Lens UI and its LEAF tests
come next, once Lens Studio is connected.

| # | Scenario | Expected result | Tests | Status |
|---|---|---|---|---|
| S10 | Distance pill | "Gate C3 · 140 m · 1 floor down · 3 min" at the bottom centre after the scan; equals the route length at the start, drops as you walk, updates after a re-route, hides at arrival | Node: "S10 Distance: at the start…", "S10 Distance drops as you walk…", "S10 Distance updates after a re-route…", "S10 Pill text…". LEAF (to write): `fl1-pill-shows-and-counts-down` | Proposed: logic passing |
| S11 | Floors and time | Floors counted in storeys (a level's `floor` in the map, else height order; the airport's C pier shares storey 1 with Departures); Walk 1.3 m/s, Step-Free 1.0 m/s; +20 s escalator, +45 s lift, +15 s per floor of stairs; a map can override; mid-escalator still counts from the floor you left | Node: "S11 Floors…", "S11 Time…", "S11 A map can override…", "S11 Halfway up the escalator…" | Proposed: logic passing |
| S12 | Floor badge | First chip of the pill names your floor; changes when a ride ends (from the route, not feet height: C pier and Departures are 1 m apart) | Node: "S12 Floor badge…". LEAF (to write): `fl2-badge-changes-after-lift` | Proposed: logic passing |
| S13 | Floor-change cue | Within 15 m of a lift/escalator/stairs/ramp: "In 15 m: lift up to Departures" ("Now:" within 2 m), above the pill; after the scan or a gate change: "Gate C3 is on C pier, 1 floor down"; Step-Free cues are only lifts or ramps | Node: "S13 Floor-change cue…", "S13 Cue texts…", "S13 Step-Free cues…". LEAF (to write): `fl3-cue-before-escalator` | Proposed: logic passing |
| S14 | Line on your floor | The line ends at the foot of the next floor change with an up/down marker; drawn up an escalator/stairs/ramp once you are on it; in a lift only the marker | Node: "S14 Line on your floor…" (`lineOnLevel`) | Proposed: logic passing |
| S15 | Down escalator | Airport has a down escalator beside the up one (`escDownTop` → `escDownFoot`); Walk going down rides it, with it closed takes the stairs; the up one is never ridden down | Node: "S15 Going down on Walk…", "S15 The up escalator is never ridden down…", "Escalators are one-way…" | Proposed: logic passing |
| S16 | Going down by lift and stairs | Step-Free from Departures to the entrance takes a lift down; Departures → C pier: Walk stairs down, Step-Free ramp down | Node: "S16 Riding a lift down…", "S16 Stairs down on Walk…" | Proposed: logic passing |
| S15b | Escalator feet and tops joined | A re-route at the foot of the up escalator never sends you back through the hall | Node: "S15 Re-routing at the foot of the up escalator…" | Proposed: logic passing |
| S17 | Three levels, both directions | Ground → Departures → C pier is cued up then down; a trip from upstairs to the entrance arrives | Node: "S17 Three levels…", "S17 A trip that starts upstairs…" | Proposed: logic passing |

## Proposed: the companion and places (brief 2, features 2 and 6, addendum B and C)

Status "proposed": logic built test-first and passing in Node (`src/core/tests/pet.test.ts`,
`src/core/tests/places.test.ts`), shown in the demo videos (`npm run demo:pet`,
`-- --companion robot|rover`); Lens UI and LEAF tests next.

| # | Scenario | Expected result | Tests | Status |
|---|---|---|---|---|
| P1 | Companion on/off | A toggle on the app panel; the line shows either way (at 50%); toggling never changes the route | Node: "P1 Pet on/off…" | Proposed: logic passing |
| P2 | It leads | ~2.5 m ahead along the route, on the route | Node: "P2 The pet trots ~2.5 m ahead…" | Proposed: logic passing |
| P3 | It waits at floor changes | Sits at the foot of the escalator/lift; never on another floor before you; trots up, never jumps | Node: "P3 The pet waits at the foot…" | Proposed: logic passing |
| P4 | It waits for you | More than 6 m behind: it stops and looks back | Node: "P4 The pet stops and looks back…" | Proposed: logic passing |
| P5 | Step-Free companion | Only ever on the step-free route | Node: "P5 Step-Free with the pet…" | Proposed: logic passing |
| P6 | Collectibles | At turns, floor changes, the gate and every ~7 m; each collected once; arrival never re-lays or double-counts (real Navigator, airport and room) | Node: "P6 Treats…", "P6 Arrival through a real Navigator…" | Proposed: logic passing |
| P7 | Score kept | Off/on and a re-route keep the score | Node: "P7 Turning the pet off keeps the score…" | Proposed: logic passing |
| Q1 | Places from the map | `kind: "place"` + `category`; nothing shop-specific in code; adding places changes no route | Node: "Q1 …" (2 tests) | Proposed: logic passing |
| Q2 | Icons + mute | ≤3, my floor, ≤15 m and near the route; Step-Free: accessible toilets and lifts first; mute hides all and never changes the route | Node: "Q2 …" (3 tests) | Proposed: logic passing |
| Q3 | Interests | coffee, food, shopping, toilets, pharmacy (+ accessible toilets on Step-Free); none by default | Node: "Q3 …" | Proposed: logic passing |
| Q4 | Pointing rules | Only interests or sponsored; "Sponsored" always shown; muted: none; ≤1 per 30 s and 20 m; never within 10 m of a turn/floor change or while a card shows; never behind you; never changes route, distance or destination | Node: "Q4 …" (7 tests) | Proposed: logic passing |
| Q5 | Point, then carry on | Steps ~1.2 m off the line toward the place, stays ahead in view, faces it ~3 s, then back on the line 2–3 m ahead | Node: "Q5 …" | Proposed: logic passing |
| Q6 | Go here? | The place becomes the destination; Step-Free rules kept | Node: "Q6 …" | Proposed: logic passing |
| Q7 | Line at 50% | In every guide mode; Lens default alpha 0.5; video line 0.5 | Node: "Q7 …" | Proposed: logic passing |
| Q8 | Any companion | dog / robot / rover: same logic, own name, model and collectible | Node: "Q8 …" | Proposed: logic passing |

## Done criteria (design brief)

| # | Done criterion | LEAF scenario | Status |
|---|---|---|---|
| 1 | Scanning the start | `dc1-scan-sign-line-appears` | Passing |
| 2 | Walking through the building (escalator, corners, turn arrow) | `dc2-walk-escalator-corners-arrow` | Passing |
| 3 | Wheelchair at seated height; red sign on Lift 1 → Lift 2 | `dc3-stepfree-seated-lift-reroute` | Passing |
| 4 | Gate change: stairs (Walk) / ramp (Step-Free) | `dc4-gate-change-stairs-and-ramp` | Passing |
| 5 | Arrival card within 3 m | `dc5-arrival-card` | Passing |

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
- The shared core is `src/core/{router,geometry,demo,place}.ts`; `npm run sync` copies it and the
  maps listed in `src/core/data/index.json` into `Assets/`.
- E3 uses the map's `assistance` node; the route to it is returned with the ask-staff result
  so the Lens can draw it.
