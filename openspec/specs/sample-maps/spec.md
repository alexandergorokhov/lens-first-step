# Sample Maps Specification

## Purpose

The Lens ships four maps that prove the same app navigates any place: the demo airport, a hospital
wing, a campus with outdoor paths, and a short line on the preview room's real floor. Each stand-in
is generated from its map at load.

## Requirements

### Requirement: Airport (demo)
The airport map ("Stand-in airport floor") SHALL model one 60 × 40 m floor: ground floor (y 0),
departures (y 6 m) and the C pier (y 5 m); start `sign` (entrance), default destination `gateB12`,
event gate change to `gateC3`, red sign on `lift1`. It SHALL route Walk via the escalator to B12
(57.5 m), Step-Free via Lift 1 (63.1 m), Step-Free with Lift 1 out via Lift 2 (91.8 m), Walk to C3 by
the stairs and Step-Free to C3 by the ramp.

#### Scenario: S2 Step-Free from the same start to the same gate
- **GIVEN** the airport map, Step-Free
- **WHEN** the route `sign → gateB12` is planned
- **THEN** it is `sign>hall>lift1G>lift1U>bJunction>gateB12` and uses a lift, no stairs or escalator
- Verified by: S2 Step-Free: same start and gate uses a lift, no stairs or escalator | dc3-stepfree-seated-lift-reroute

### Requirement: Hospital wing
The hospital map SHALL have a ground floor and Level 1 (y 4 m), start at the main entrance sign,
destination Ward 4, Reception as the assistance point, stairs, Lift A and Lift B, event "Room change
Ward 4 → X-ray" and a red sign "Lift A out of service".

#### Scenario: R4 Hospital routes
- **WHEN** routes are planned on the hospital map
- **THEN** Walk to Ward 4 takes the stairs (33.5 m); Step-Free takes Lift A (37.2 m)
- **AND** with Lift A out Step-Free takes Lift B (45.1 m)
- **AND** the room change re-routes to X-ray on the ground floor (19.9 m from the sign)
- **AND** with both lifts out Step-Free asks staff and points to Reception
- Verified by: hospital: Walk to Ward 4 takes the stairs; Step-Free takes Lift A; hospital: Lift A out of service re-routes Step-Free to Lift B; hospital: room change Ward 4 -> X-ray re-routes on the ground floor; hospital: both lifts out -> Step-Free to Ward 4 asks staff and points to Reception | map-switch-cycle (loads); manual (preview)

### Requirement: Campus
The campus map ("Stand-in campus") SHALL mix outdoor paths (main gate sign → Quad 14 m ahead) with
two buildings (Library, Science building; first floors 4 m up), Campus info desk as the assistance
point, destination Lecture Hall 1, event "Room change Lecture Hall 1 → Lab 2", red sign "Science
lift out of service".

#### Scenario: R5 Campus routes
- **WHEN** routes are planned on the campus map
- **THEN** Walk to Lecture Hall 1 crosses the quad and takes the Science stairs (53 m)
- **AND** Step-Free takes the Science lift (59.3 m); with the lift out it takes the ramp (61.4 m)
- **AND** the room change re-routes to Lab 2 on the Science ground floor
- **AND** the Library Reading Room is reached by stairs (Walk) or the Library lift (Step-Free)
- **AND** the building footprints cover their indoor nodes and destinations have campus icons
- Verified by: campus: Walk to Lecture Hall 1 crosses the quad outdoors and takes the Science stairs; campus: Step-Free to Lecture Hall 1 takes the Science lift; with the lift out it takes the ramp; campus: room change Lecture Hall 1 -> Lab 2 re-routes to the Science ground floor; campus: the Library Reading Room is reached by stairs (Walk) or the Library lift (Step-Free); campus: buildings cover their indoor nodes and the destinations have campus icons | map-switch-cycle (loads); manual (preview)

### Requirement: Preview room floor
The room map SHALL have `standInModel: false` (no stand-in building, label "Line on the room's real
floor"), a sign at the origin, destination "Window spot" 4.3 m away via the middle of the room, and
the event "Change to the door" (card "Destination changed: door").

#### Scenario: R6 Short line on the preview room's floor
- **WHEN** a trip starts on the room map
- **THEN** the route is `sign>mid>window` (4.3 m) and no stand-in model is built
- **AND** "Change to the door" re-routes to `sign>mid>door` (4.1 m)
- Verified by: room: short route on the room floor to the window, and the change to the door | map-switch-cycle (loads); manual (preview)

### Requirement: Stand-in built from the map
For maps with `standInModel` true, the Lens SHALL build a light, translucent box model from the map
at load: floor slabs per level, low perimeter walls, inclined escalator/stairs/ramp slabs, lift
shafts with doors and red plates for closable connections, overhead place signs (destinations,
assistance, lifts, "Escalator ↑", "Stairs", "Ramp"), and a sign with the stand-in label (e.g.
"Stand-in building") so it is never mistaken for a real building.

#### Scenario: X46 Stand-in labelled and generated
- **WHEN** the airport map loads
- **THEN** a light box building appears with a "Stand-in building" sign, gate and lift signs
- Verified by: manual (preview)

## Known gaps

- Brief: "Ship a second small sample map (default: hospital)"; the code ships three (hospital,
  campus, room) — more than asked, not a conflict.
- Non-airport maps are verified in the Lens only for loading (map-switch-cycle); their trips are
  checked by Node tests and by hand.
- The preview room sets its own trip distances (`arrivalRadius 0.6`, `offRouteDistance 1.5`, X48).
- The one list of maps is `src/core/data/index.json` (tests, sync tool, map server); the Lens
  needs literal `requireAsset` paths, so `MAP_SOURCES` and the picker are checked against it.
