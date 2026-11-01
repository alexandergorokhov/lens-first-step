# Places Specification

## Purpose

Shops, cafés, toilets and lifts along the way, and the companion pointing out what the traveller
cares about — never changing the route. Logic: places.ts. Lens:
`FindYourWayPlacesUI`, interests on `FindYourWayModePanelUI`.

## Requirements

### Requirement: Icons near the route
Each map place SHALL have a small sign (icon, name; sponsored places always "Sponsored · <tag>")
~1.75 m up at the node, shown only when `visiblePlaces` lists it (your floor, ≤ 15 m, ≤ 10 m from the
route, at most 3, Step-Free: accessible toilets and lifts first). "Places: on/off" on the app panel
SHALL hide all icons and stop the pointing.

### Requirement: Interests and pointing
The mode panel SHALL offer interests (Coffee, Food, Shops, Toilets, Pharmacy, Acc. toilets), none
picked by default. `PointingCoach` decides when to point (interests or sponsored only; ≤ 1 per 30 s
and 20 m; not within 10 m of a turn or floor change; not while a card shows; never behind you). The
pointed place's sign brightens with its name, tag and a "Go here?" button; the companion steps
~1.2 m off the line toward it for 3 s.

#### Scenario: Q0 Icons and pointing
- **WHEN** a picked place comes near the route
- **THEN** its icon shows, the companion points, and Places: off stops both
- Verified by: Q1–Q6 (Node) | q4-points-at-interests-and-sponsored

### Requirement: Go here?
"Go here?" SHALL make the place the destination: the same re-route as a gate change, Step-Free rules
kept; a multi-stop trip ends.

#### Scenario: Q4 Pointing on the way to B12
- **GIVEN** interests = coffee, the companion on, walking sign → hall → escalator
- **THEN** every place pointed at is coffee or sponsored; sponsored ones show "Sponsored"
- **AND** the route, its length and the destination never change; muting shows no icons
- **AND** "Go here?" on a pointed place makes it the destination
- Verified by: Q1–Q6 (Node) | q4-points-at-interests-and-sponsored
