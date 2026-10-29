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

Status as of the last run: Node 96 passed, 0 failed, 0 todo.
LEAF 19 of 19 passed.

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
