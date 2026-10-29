# Scenarios: Find Your Way Inside

Approved test scenarios and where each is tested.

- **Node** tests (pure logic, run `npm test`): `src/core/tests/router.test.ts`,
  `src/core/tests/maps.test.ts`, `src/core/tests/geometry.test.ts`. Node test names start
  with the scenario ID where there is one.
- **LEAF** scenarios run inside the Lens in Lens Studio's Interactive Preview
  (`Assets/Tests`, registered in `FindYourWayLeafIndex.ts`). To run them, tick **autoRun** on
  the `LeafIndex` scene object and reset the Preview; each prints
  `[FYW-LEAF] RESULT <id> PASSED|FAILED`. LEAF pinches the real SIK/UIKit buttons; walking,
  seated height and the scanned sign are simulated with test hooks on `FindYourWayMain`
  (LEAF cannot drive WASD/Q/E).

Status as of the last run: Node 62 passed, 0 failed, 1 todo (S9 real download).
LEAF 13 of 13 passed.

## Approved scenarios

| # | Scenario | Expected result | Tests | Status |
|---|---|---|---|---|
| S1 | Walk: pinch sign at entrance, gate B12, Walk | Shortest path; may use escalator; length matches Dijkstra | Node: "S1 Walk: sign at entrance to B12…", "S1 Walk route is the shortest possible, for every pair of nodes". LEAF: `dc1-scan-sign-line-appears`, `rule-walk-is-shortest` | Passing |
| S2 | Step-Free: same start and gate | No stairs/escalator edge; uses lift or ramp | Node: "S2 Step-Free: same start and gate uses a lift…", "S2 Step-Free never uses stairs or escalators…". LEAF: `dc3-stepfree-seated-lift-reroute`, `rule-stepfree-no-stairs-escalator` | Passing |
| S3 | Switch mode mid-route | Redraws with the other mode's rules | Node: "S3 logic: switching mode mid-route re-routes…" (router logic only) | Lens part removed: the Lens chooses the mode once per trip (brief: out of scope) |
| S4 | Gate change B12 → C3 while walking | Card "Gate change B12 → C3"; re-route from current position; line swings | Node: "S4 Gate change B12 -> C3 while walking…". LEAF: `dc4-gate-change-stairs-and-ramp` | Passing. The card text follows the brief (no colon); `gateChangeMessage` in the router still returns "Gate change: B12 → C3" and the Lens takes its card text from the map |
| S5 | Lift out in Step-Free | Pinching the red sign closes the lift; new route avoids stairs/escalators | Node: "S5 Lift out in Step-Free…". LEAF: `dc3-stepfree-seated-lift-reroute` (pinches the red sign; re-routes to Lift 2; a closed lift's floor button refuses) | Passing |
| S6 | Arrival | Within 3 m the line stops; card "Gate C3. Boarding in 6 min." | Node: "S6 Arrival…". LEAF: `dc5-arrival-card`; arrival after riding the escalator / a lift in `dc2-…` and `dc3-…` | Passing |
| S7 | Off route | > 5 m from the line re-routes from the nearest node, on the traveller's own level, without re-triggering every frame | Node: "S7 Off route…", "S7b Off route: staying off the line…", "S7c Off route: the nearest node is on the traveller's own level…". LEAF: `dc2-walk-escalator-corners-arrow` (ground floor under the landing re-plans from escFoot) | Passing |
| S8 | Next turn out of view | Edge arrow toward the next turn | Node (geometry.test.ts): "turn arrow: shows only when the next turn is outside the view…", "S8 on the airport: at the escalator top facing back…". LEAF: `dc2-walk-escalator-corners-arrow` | Passing |
| S9 | Map download works | Downloads map.json from a URL; "online map" badge | Node: "S9/E1 logic: a valid download is used online…", "S9/E1 logic: loadMapWithTimeout uses the download when it arrives in time". Node todo: "S9 Lens: a real map.json download from a public URL…" | Logic passing. Real download: todo until the repo (and its map.json URL) is public; today the URL returns 404 and the Lens shows "offline map" |
| E1 | Download fails or > 5 s | Built-in map; "offline map" badge; route works | Node: "E1 logic: a download slower than the timeout…", "E1 logic: a failed or throwing download…". LEAF: `dc1-scan-sign-line-appears` (real request returns 404 → "offline map", route works) | Passing |
| E2 | Invalid map.json | "Map couldn't load"; falls back to built-in map; no crash | Node: "E2 Invalid map.json…", "E2 logic: an invalid download in time…", "E2 parseMap names what is wrong…". LEAF: `e2-broken-map-fallback` | Passing |
| E3 | No step-free route | "No step-free route. Ask staff at the assistance point."; line to the nearest assistance point | Node: "E3 No step-free route (lift + ramp closed)…", "E3 Both lifts closed…", "hospital: both lifts out…". LEAF: `e3-no-step-free-ask-staff` (red sign on Lift 1 + Lift 2 closed) | Passing |
| E4 | Destination = current position | Arrival card right away; no line | Node: "E4 Destination = current position…". LEAF: `e4-already-at-destination` | Passing |
| E5 | Unknown sign id | "This sign isn't in the map"; nothing drawn | Node: "E5 Unknown sign id…". LEAF: `e5-unknown-sign` | Passing |
| E6 | Seated height (Q) | Line and cards readable and in view at seated eye height | LEAF: `dc3-stepfree-seated-lift-reroute` (seated pose: line on the floor and within 25° below the eyes) | Logic passing. Real readability on glasses: feel unproven |

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
| Lens maths (headings, next turn, metres ↔ cm, line stops at a lift) and router/geometry Lens copies identical | Node: geometry.test.ts | Passing |

## Notes on the logic

- Distances are in metres in the map files; the Lens converts to centimetres (`src/core/geometry.ts`).
- "Current position" re-routes start from the nearest map node on the traveller's level
  (`levelDistance`: horizontal distance + 5 × height difference).
- Arrival radius 3 m and off-route distance 5 m are constants in `router.ts`
  (`ARRIVAL_RADIUS`, `OFF_ROUTE_DISTANCE`).
- E3 uses the map's `assistance` node; the route to it is returned with the ask-staff result
  so the Lens can draw it.
