# Arrival Specification

## Purpose

Within 3 m of the destination the line stops and an arrival card with the destination's text shows
over it.

## Requirements

### Requirement: Arrival within 3 m
The arrival radius is measured horizontally on the destination's own level; 3 m is the default and a
map's `place.arrivalRadius` can change it (the preview room uses 0.6 m).
When the traveller's position is within `ARRIVAL_RADIUS = 3` m (3-D distance) of the destination
node, the Navigator SHALL report "arrived"; the Lens SHALL enter the `arrived` phase, clear the line,
hide the turn arrow, and show the arrival card 2 m above the destination, billboarded, with the
node's `arrivalCard` text (fallback: its label) and icon.

#### Scenario: S6 Arrival
- **GIVEN** a Navigator to gate C3
- **WHEN** the traveller is 3.5 m from C3
- **THEN** the result is "onRoute"
- **WHEN** the traveller is 2.9 m from C3
- **THEN** the result is "arrived", there is no line to draw, and the card text is
  "Gate C3. Boarding in 6 min."
- Verified by: S6 Arrival: within 3 m of the gate the line stops and the card reads 'Gate C3. Boarding in 6 min.' | dc5-arrival-card; dc2-walk-escalator-corners-arrow (B12 after the escalator); dc3-stepfree-seated-lift-reroute (B12 after a lift)

#### Scenario: DC5 Arrival card in the Lens
- **GIVEN** a Walk trip after "Gate change B12 → C3"
- **WHEN** the traveller stands 3.5 m from C3
- **THEN** the phase is `nav` and no arrival card shows
- **WHEN** they stand 2.9 m from C3
- **THEN** the phase is `arrived`, the line is hidden and the card reads "Gate C3. Boarding in 6 min."
- Verified by: S6 Arrival: within 3 m of the gate the line stops and the card reads 'Gate C3. Boarding in 6 min.' | dc5-arrival-card

### Requirement: Arrival is sticky until clearly leaving
Once arrived, the Navigator SHALL stay "arrived" while the traveller is within `OFF_ROUTE_DISTANCE
= 5` m of the destination. Beyond 5 m it SHALL re-plan; the Lens SHALL then hide the arrival card
and resume navigation.

#### Scenario: X37 Stays arrived at 4 m
- **GIVEN** the traveller has arrived at C3
- **WHEN** they step to 4 m from it
- **THEN** the status is still "arrived"
- Verified by: S6 Arrival: within 3 m of the gate the line stops and the card reads 'Gate C3. Boarding in 6 min.' | none

#### Scenario: X38 Walking away resumes navigation
- **GIVEN** the traveller has arrived
- **WHEN** they walk more than 5 m away
- **THEN** the arrival card hides and the line reappears from their position
- Verified by: S6b after arriving, 5.5 m from B12 does not report rerouted on consecutive frames and is not stuck

### Requirement: Already at the destination
If the start is the destination, the trip SHALL arrive immediately: no line, arrival card shown.

#### Scenario: E4 Destination = current position
- **GIVEN** the destination is set to the start sign
- **WHEN** the sign is scanned
- **THEN** the phase is `arrived`, no line is visible and the arrival card shows
- Verified by: E4 Destination = current position: arrival right away, no line | e4-already-at-destination

### Requirement: Arrival texts come from the map
Arrival texts SHALL be the map's: airport "Gate B12. Boarding in 6 min." / "Gate C3. Boarding in 6
min."; hospital "Ward 4. Visiting hours until 8 pm." / "X-ray. Please take a seat."; campus "Lecture
Hall 1. Lecture starts in 10 min." / "Lab 2. Practical starts in 10 min." / "Reading Room. Quiet
study until 10 pm."; room "Window. You made it." / "Door. You made it."

#### Scenario: X39 Hospital arrival text
- **WHEN** a hospital trip arrives at Ward 4
- **THEN** the card reads "Ward 4. Visiting hours until 8 pm."
- Verified by: manual (preview)

#### Scenario: X52 Arrival needs the same level
- **GIVEN** a destination on a mezzanine 2.8 m up
- **WHEN** the traveller stands right under it on the floor below
- **THEN** that is not arrival; standing 0.5 m from it on the mezzanine is
- Verified by: C9 arrival needs the same level: standing under a mezzanine destination is not arrival

#### Scenario: X48 A small space sets its own distances
- **GIVEN** the preview room map (`arrivalRadius 0.6`, `offRouteDistance 1.5`)
- **WHEN** the traveller is 1 m past the sign, or changes to the door from mid-room
- **THEN** the trip is still on route (not "arrived" at a window 2.9 m away), and the door change
  gives the route `mid>door`
- Verified by: C2 tripSettings: defaults 3 m arrival / 5 m off-route…; C2 room: one metre past the sign is still onRoute; C2 room: change to the door from mid-room gives a route

#### Scenario: X54b Reaching the assistance point is an arrival there
- **GIVEN** a Step-Free trip with no step-free route (both airport lifts out)
- **WHEN** the traveller reaches the assistance point
- **THEN** the trip arrives there and the arrival card reads "Assistance point"
- Verified by: C11 askStaff: reaching the assistance point counts as arrival | e3-no-step-free-ask-staff

## Known gaps

- The brief's "Boarding in 6 min." is a fixed text in the map (the node's `arrivalCard`), not a
  live time. The airport-only router helper `arrivalMessage` was removed (review A4).
- **Fixed (review round):** arrival is horizontal and on the destination's level (X52), not 3-D.
- **Fixed (review round):** walking 5–5.4 m away after arriving no longer re-reports "rerouted"
  every frame while staying stuck in "arrived" (X38).
