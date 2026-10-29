# Routing Specification

## Purpose

Plans the route from where the traveller is to the destination over the map graph, using
shortest distance under the chosen profile (Walk or Step-Free), and keeps it current as the
traveller moves (off-route re-planning from the nearest node on their own level).

## Requirements

### Requirement: Shortest route by distance
`findRoute(map, from, to, profile)` SHALL return the route of minimum total edge length (Dijkstra)
using only open edges allowed by the profile, honouring one-way escalators. The result SHALL list
the node ids, the edges and the length (rounded to 1 mm). Walk allows every open edge kind.

#### Scenario: S1 Walk from the entrance sign to gate B12
- **GIVEN** the airport map, Walk profile
- **WHEN** the route from `sign` to `gateB12` is planned
- **THEN** it is `sign > hall > escFoot > escTop > concourse > bJunction > gateB12`, 57.5 m
- **AND** it uses the escalator and equals the brute-force shortest length
- Verified by: S1 Walk: sign at entrance to B12 is the shortest path and uses the escalator | dc1-scan-sign-line-appears; dc2-walk-escalator-corners-arrow; rule-walk-is-shortest (live trip)

#### Scenario: R2 Walk is the shortest route on every bundled map
- **GIVEN** each bundled map (airport, hospital, campus, room)
- **WHEN** a Walk route is planned for every ordered pair of nodes
- **THEN** its length equals an independent brute-force search over all simple paths
- **AND** pairs with no path return a non-route result
- Verified by: S1 Walk route is the shortest possible, for every pair of nodes; airport/hospital/campus/room: Walk is the shortest route and Step-Free never uses stairs or an escalator, for every pair | rule-walk-is-shortest (796 routes + the live trip)

### Requirement: Unknown endpoints and same-node routes
`findRoute` SHALL return `status: "error"` with "unknown start <id>" / "unknown destination <id>"
when an endpoint is not in the map, and `status: "arrived"` with no edges and length 0 when
`from === to`.

#### Scenario: X7 Unknown start node is an error, not a crash
- **WHEN** a route is requested from `sign-T9-404` to `gateB12`
- **THEN** the status is "error"
- Verified by: E5 Unknown sign id: 'This sign isn't in the map', nothing drawn | e5-unknown-sign

### Requirement: No route falls back to the nearest assistance point
When the destination is unreachable under the profile, `findRoute` SHALL return
`status: "askStaff"` with the message "No step-free route. Ask staff at the assistance point."
(Step-Free) or "No route right now. Ask staff at the assistance point." (Walk), plus the shortest
path to the nearest reachable node of kind `assistance` when one exists.

#### Scenario: X8 Walk with no route asks staff with the Walk message
- **GIVEN** a Walk trip whose destination is unreachable
- **WHEN** the route is planned
- **THEN** the status is "askStaff" with "No route right now. Ask staff at the assistance point."
- Verified by: C5 noticeFor: askStaff on Walk says NO_ROUTE_MESSAGE… | e3-no-step-free-ask-staff (Step-Free text)

### Requirement: Re-plan from the traveller's current position
`Navigator` SHALL hold the map, start, destination and profile. Once a position is known, every
re-plan (destination change, closure, off-route) SHALL start from `nearestNode(position)`, where
nearness is `levelDistance` = horizontal distance + 5 × |height difference| (`LEVEL_PENALTY = 5`),
so the start is on the traveller's own level. A re-plan SHALL report a change only when the
planned node list (or status) changed.

#### Scenario: S3 logic: switching profile mid-route re-routes from the current position
- **GIVEN** a Walk Navigator and the traveller 1 m past the check-in hall
- **WHEN** the profile is switched to Step-Free (router level only)
- **THEN** the new route starts at `hall` and obeys the Step-Free rules
- Verified by: S3 logic: switching mode mid-route re-routes from the current position with the other mode's rules | none (the Lens does not offer a mid-trip switch; see trip-flow)

### Requirement: Off-route re-planning
On every position update, if the route is a `route` and the traveller is more than
`OFF_ROUTE_DISTANCE = 5` m from the route polyline, the Navigator SHALL re-plan from the nearest
node. It SHALL return "rerouted" only if the planned nodes changed, otherwise "onRoute", so that
standing off the line does not re-trigger a re-route every frame. Within 5 m it SHALL return
"onRoute" without re-planning. The Lens SHALL redraw the line with the swing animation only on
"rerouted".

#### Scenario: S7 Off route by more than 5 m re-routes from the nearest node
- **GIVEN** a Walk trip `sign → gateB12`
- **WHEN** the traveller stands at (34, 0, 5), within 5 m of the line
- **THEN** the result is "onRoute"
- **WHEN** the traveller stands 1 m from Lift 2 (ground)
- **THEN** the result is "rerouted" and the new route starts at `lift2G` and ends at `gateB12`
- Verified by: S7 Off route: more than 5 m from the line re-routes from the nearest node | dc2-walk-escalator-corners-arrow

#### Scenario: S7b Staying off the line does not re-trigger every frame
- **GIVEN** the traveller has just been re-routed while off the line
- **WHEN** the next position update arrives at the same spot with an unchanged plan
- **THEN** the result is "onRoute", not "rerouted", and the route is unchanged
- Verified by: S7b Off route: staying off the line with an unchanged plan reports onRoute, not rerouted every frame | none

#### Scenario: S7c The nearest node is on the traveller's own level
- **GIVEN** a Walk trip on the airport map and the traveller on the ground floor at (30, 0, 30),
  under the departures landing
- **WHEN** the position update re-plans
- **THEN** the route starts at `escFoot` (ground), not at the landing 6 m overhead
- Verified by: S7c Off route: the nearest node is on the traveller's own level, not the one overhead | dc2-walk-escalator-corners-arrow ("re-planned from the ground floor")

### Requirement: Lens router copy identical
The shared core (router, geometry, demo, place) and the bundled maps are copied to the Lens by
`npm run sync`; `npm run sync:check` (first step of `npm test`, and of the pre-commit hook enabled by
`npm run hooks`) fails when a copy differs.
`Assets/Scripts/FindYourWayRouter.ts` SHALL be byte-identical to `src/core/router.ts`.

#### Scenario: X9 Router Lens copy identical
- **WHEN** the Node tests run
- **THEN** the two files are identical
- Verified by: router.ts and its Lens copy are identical | none

#### Scenario: X53 A change of connection alone is a route change
- **GIVEN** a Walk trip from the C pier top to C3 by the stairs
- **WHEN** the profile switches to Step-Free (same nodes, ramp instead of stairs)
- **THEN** `setProfile` reports a change (change detection compares nodes and connections)
- Verified by: C10 setProfile reports a change when only the connection kind changes

#### Scenario: X54 Ask-staff guidance follows the traveller
- **GIVEN** a Step-Free trip with no step-free route, guided to the assistance point
- **WHEN** the traveller walks more than the off-route distance from that line
- **THEN** the assistance path is re-planned from their nearest node ("rerouted" only when it changes)
- Verified by: C11 askStaff: walking off the assistance line re-plans from the nearest node

#### Scenario: X38b Leaving the destination re-plans from the nearest other node
- **GIVEN** an arrived trip
- **WHEN** the traveller walks beyond the off-route distance, still nearest to the destination node
- **THEN** a route back is planned from the nearest other node, reported once, not every frame
- Verified by: S6b after arriving, 5.5 m from B12 does not report rerouted on consecutive frames and is not stuck

#### Scenario: X62 Lens copies stay identical by tooling
- **GIVEN** a Lens copy that drifted from `src/core`
- **WHEN** `npm run sync:check` runs
- **THEN** it lists the copy and fails; `npm run sync` fixes it
- Verified by: A1 sync:check passes on the repo, reports a drifted copy, and sync fixes it; A1 npm test runs sync:check first…

## Known gaps

- **Fixed (review round):** the Walk "no route" message is shown in Walk mode (X8, via `noticeFor`).
- **Fixed (review round):** change detection includes connections (X53); ask-staff guidance is
  tracked (X54); leaving the destination is no longer stuck (X38b).
- Off-route re-routes are silent (no card or chime); the brief does not ask for one.
