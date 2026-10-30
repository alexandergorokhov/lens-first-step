# Multi-Stop Trips Specification

## Purpose

Visit several shops in one trip (handoff item 12). Logic: trip.ts (`orderStops`, `MultiStopTrip`).
Map: `mall` (2 floors, 14 places, escalators up and down, stairs, two lifts).

## Requirements

### Requirement: Shortest order, stop by stop
When the map has at least two of the Inspector's `multiStops` place ids (default
"pharmacy,iceCream,sushi"), the Lens SHALL order them for the least total distance (every order up
to 6 stops, nearest-neighbour beyond), guide to the first, show "Stop n of N: <name>" at the start
and on each arrival card, and show "Next stop" on the app panel at every stop but the last. Every
leg SHALL obey the profile (Step-Free: no stairs or escalators). A destination change or "Go here?"
ends the multi-stop trip.

#### Scenario: T1–T3 Three shops in the mall
- **GIVEN** the mall, Walk or Step-Free
- **THEN** three stops in the best order; arriving at each shows "Stop i of 3: …"; Next stop goes on
- **AND** on Step-Free no leg uses stairs or an escalator
- Verified by: T1–T4 (Node) | t1-mall-multi-stop (LEAF written, not run yet)
