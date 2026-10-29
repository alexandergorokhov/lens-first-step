# Accessibility Specification

## Purpose

Step-Free (wheelchair) mode must never send the traveller to stairs or an escalator, must fall back
to an assistance point when no step-free route exists, and the guidance must stay usable at seated
eye height.

## Requirements

### Requirement: Step-Free rules
In the Step-Free profile the router SHALL never use edges of kind `stairs` or `escalator`
(`edgeAllowed`); it SHALL use only `walk`, `lift` and `ramp` edges and SHALL pick the shortest such
route. The Walk profile SHALL allow all open edges.

#### Scenario: S2 Step-Free never uses stairs or escalators
- **GIVEN** the airport map
- **WHEN** a Step-Free route is planned for every ordered pair of nodes
- **THEN** no route contains a stairs or escalator edge
- **AND** each equals the brute-force shortest step-free length (or asks staff when none exists)
- Verified by: S2 Step-Free never uses stairs or escalators and is the shortest step-free path, for every pair; S2 Step-Free: same start and gate uses a lift, no stairs or escalator | rule-stepfree-no-stairs-escalator; dc3-stepfree-seated-lift-reroute

#### Scenario: R1 Step-Free never uses stairs or an escalator on any bundled map
- **GIVEN** each bundled map (airport, hospital, campus, room), as shipped and with each closable
  connection closed in turn
- **WHEN** Step-Free routes (and ask-staff assistance routes) are planned for every node pair
- **THEN** none uses stairs or an escalator
- Verified by: airport/hospital/campus/room: Walk is the shortest route and Step-Free never uses stairs or an escalator, for every pair; airport/hospital/campus/room: closing each closable connection keeps Step-Free free of stairs and escalators | rule-stepfree-no-stairs-escalator (3016 routes)

### Requirement: No step-free route → assistance point
When no step-free route reaches the destination, the Lens SHALL show "No step-free route. Ask staff
at the assistance point." and draw the line to the nearest reachable `assistance` node (airport:
Assistance point; hospital: Reception; campus: Campus info desk). The assistance route itself SHALL
be step-free.

#### Scenario: E3 No step-free route (ramp and lift to the C pier closed)
- **GIVEN** the airport map with Lift 2 and the C-pier ramp closed
- **WHEN** a Step-Free route from `sign` to `gateC3` is planned
- **THEN** the status is "askStaff" with the message above and the assistance route is
  `sign>hall>assist`
- **AND** the Walk route to C3 still exists
- Verified by: E3 No step-free route (lift + ramp closed): ask-staff message and a line to the nearest assistance point | e3-no-step-free-ask-staff (Lens variant: both lifts closed, see connection-closure)

### Requirement: Usable at seated height
At seated eye height (about 45 cm lower; Q in the preview) the line SHALL stay on the floor, part of
it SHALL be within 25° below the eye line ahead, and all panels and cards SHALL stay readable and in
view. Controls (sign button ~1.25 m, red sign, ride buttons ~1.15 m) SHALL be within reach of a
seated user.

#### Scenario: DC3 Wheelchair at seated height
- **GIVEN** Step-Free chosen and the traveller seated (feet estimate 0.45 m below the floor)
- **WHEN** the sign is scanned
- **THEN** the route goes round the corner to Lift 1 with no stairs or escalator
- **AND** the line is 1 cm above the floor and some of it is 3°–25° below the seated eye line
- **WHEN** the red sign on Lift 1 is pinched
- **THEN** the route re-plans to Lift 2, still step-free, the card mentions "Lift 1 out of service",
  Lift 1's floor button refuses, and after riding Lift 2 the traveller arrives at B12 ("Gate B12.
  Boarding in 6 min.")
- Verified by: S2 Step-Free: same start and gate uses a lift, no stairs or escalator; S5 Lift out in Step-Free: pinching the red sign closes the lift and the new route avoids stairs/escalators | dc3-stepfree-seated-lift-reroute

#### Scenario: E6 Seated height (Q)
- **GIVEN** the user is at seated height
- **WHEN** they follow a trip
- **THEN** the line and the cards are readable and in view
- Verified by: dc3-stepfree-seated-lift-reroute (line on the floor, within 25° below the eyes); readability: manual (preview) — feel unproven on glasses

### Requirement: Light, readable UI on an additive display
All text and icons SHALL be light (white by default) on rounded panels; nothing SHALL rely on black
or very dark content to be seen. Pinch targets SHALL be big and highlight when aimed at (UI Kit).

#### Scenario: X47 Readable, light UI
- **WHEN** any panel or card is shown standing or seated
- **THEN** its text is light and readable and targets highlight on hover
- Verified by: manual (preview)

## Known gaps

- Out-of-service sign height: the brief asks for about 1.2 m (seated eye level); the code places
  the red sign 1.5 m above the lift floor (`local(n, 150)`).
- Seated height is not detected or adapted to; the Lens works from the camera height (or the
  measured floor). E6 readability on real glasses is "feel unproven".
- Hover highlight relies on UI Kit defaults; not tested.
