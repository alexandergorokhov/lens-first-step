# Scenarios: Find Your Way Inside

Approved test scenarios. Each pure-logic scenario has a test in
`src/core/tests/router.test.ts` whose name starts with its ID (run `npm test`).
Scenarios that only the Lens can show are marked pending until Prototypes B and C,
where they become LEAF tests or preview checks.

| # | Scenario | Expected result | Test status |
|---|---|---|---|
| S1 | Walk: pinch sign at entrance, gate B12, Walk | Shortest path; may use escalator; length matches Dijkstra | Logic: passing |
| S2 | Step-Free: same start and gate | No stairs/escalator edge; uses lift or ramp | Logic: passing |
| S3 | Switch mode mid-route | Redraws from current position within 1 s with other mode's rules | Logic: passing. Redraw within 1 s: pending (Prototype B) |
| S4 | Gate change B12 → C3 while walking | Card "Gate change: B12 → C3"; re-route from current position within 1 s | Logic and card text: passing. On-screen card and 1 s redraw: pending (Prototype B) |
| S5 | Lift out in Step-Free | Pinching red sign closes lift edge; new route avoids stairs/escalators | Logic: passing. The pinch itself: Prototype B |
| S6 | Arrival | Within 3 m the line stops; card "Gate C3. Boarding in 6 min." | Logic and card text: passing |
| S7 | Off route | >5 m from the line re-routes from nearest node | Logic: passing |
| S8 | Next turn out of view | Edge arrow toward next turn | Pending (Prototype B) |
| S9 | Map download works | Downloads map.json from URL; "online map" badge | Map choice logic: passing. Download and badge: pending (Prototype C) |
| E1 | Download fails or >5 s | Built-in map; "offline map" badge; route works | Fallback logic: passing. Timeout and badge: pending (Prototype C) |
| E2 | Invalid map.json | "Map couldn't load"; falls back to built-in map; no crash | Logic: passing |
| E3 | No step-free route (lift + ramp closed) | "No step-free route. Ask staff at the assistance point"; line to nearest assistance point | Logic: passing |
| E4 | Destination = current position | Arrival card right away; no line | Logic: passing |
| E5 | Unknown sign id | "This sign isn't in the map"; nothing drawn | Logic: passing |
| E6 | Seated height (Q) | Line and cards readable and in view at seated eye height | Pending (Prototype B) |

## Notes on the logic

- Distances are in metres in `map.json`; the Lens converts to centimetres.
- "Current position" re-routes start from the map node nearest the traveller.
- Arrival radius 3 m and off-route distance 5 m are constants in `router.ts`
  (`ARRIVAL_RADIUS`, `OFF_ROUTE_DISTANCE`).
- E3 uses the `assist` node (kind `assistance`) by the check-in hall; the
  route to it is returned with the ask-staff result so the Lens can draw it.
