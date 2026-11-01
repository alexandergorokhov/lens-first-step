# Level Changes Specification

## Purpose

The preview cannot ride a moving lift or escalator, so each level-changing connection (lift,
escalator, stairs, ramp) has a ride button at its end. Pinching it carries the traveller to the
other end — but only when they are standing there and the connection is open.

## Requirements

### Requirement: Ride buttons from the map
For every `lift` edge, and every `escalator`, `stairs` or `ramp` edge whose ends differ in height by
at least 0.3 m, the Lens SHALL create a ride button at each end it can be ridden from (escalators:
only the `from` end; others: both ends). Labels SHALL be:
lift "Ride to <level name of the other end>" (e.g. "Ride to Departures"),
escalator "Ride escalator up" / "Ride escalator down",
stairs "Take stairs up" / "Take stairs down",
ramp "Take ramp up" / "Take ramp down".
Lift buttons SHALL sit inside the shaft on the side wall (1.15 m up); others beside the foot,
facing the way in (1.15 m up).

#### Scenario: X23 Airport ride buttons
- **GIVEN** the airport map
- **WHEN** the place is built
- **THEN** there is a "Ride escalator up" button at `escFoot` only (none at `escTop`)
- **AND** "Take stairs up/down" at both stair ends, "Ride to Departures" / "Ride to Ground floor"
  in both lifts, and "Take ramp down" at `cTop` / "Take ramp up" at `cJunction`
- Verified by: dc2-walk-escalator-corners-arrow (escalator button exists at escFoot); dc3-stepfree-seated-lift-reroute (lift buttons at lift1G, lift2G); other buttons: manual (preview)

#### Scenario: X24 Escalators are one-way in the Lens
- **GIVEN** the traveller is at the top of the escalator
- **WHEN** they look for a ride button
- **THEN** there is none; going down uses the stairs
- Verified by: Escalators are one-way: going down uses the stairs on Walk | none for the missing top button (gap)

### Requirement: Proximity rule
Reach is horizontal distance on the same level (feet within 1 m of a level count as on it), so a
seated or crouching traveller can ride; 2.5 m for lifts and 3.5 m for the others are defaults a map
can change with `place.rideReach`.
A ride SHALL only work from the end the traveller is standing at: within 2.5 m (`levelDistance`)
of a lift node, or within 3.5 m of the foot of an escalator, stairs or ramp. Otherwise the Lens
SHALL refuse, leave the traveller where they are and show "Walk to <node label> first" for 3 s
(e.g. "Walk to Escalator (bottom) first").

#### Scenario: X25 Ride refused away from the escalator
- **GIVEN** a Walk trip and the traveller 1.5 m in front of the entrance sign
- **WHEN** they pinch "Ride escalator up"
- **THEN** nothing moves (ride offset stays 0) and the card reads "Walk to Escalator (bottom) first"
- Verified by: dc2-walk-escalator-corners-arrow (offset unchanged; card text not asserted)

#### Scenario: X26 Lift button works only inside or next to the lift (2.5 m)
- **GIVEN** a Step-Free trip
- **WHEN** the traveller is 3 m from Lift 2 (ground) and pinches "Ride to Departures"
- **THEN** the ride is refused
- **WHEN** they move inside the lift and pinch again
- **THEN** they are carried up 6 m
- Verified by: C1 ride reach: seated traveller (feet −0.45 m) 0.5 m from lift2G can ride (also: 3 m away and another level refuse) | dc3b-seated-lift-ride, dc3-stepfree-seated-lift-reroute

### Requirement: Walls in the preview
The preview's keys walk through anything. In Lens Studio only, the outer walls, shop fronts, lift shafts
and the sides of stairs, ramps and escalators SHALL stop the traveller 1.15 m away, so panels 1 m ahead
stay in front of them, and SHALL let them slide along. All of it comes from the map. The map's own
walkways SHALL always stay open, a ride or reset SHALL never be held back, and a step that starts inside
a wall SHALL pass. On Specs the real building does this.
- Verified by: W1–W11 (Node, walls.test.ts); checked with the real preview camera at Bolt Hardware's front

### Requirement: Walking up in the preview
The preview's keys keep the traveller at one height. In Lens Studio only, walking along open stairs,
a ramp or an escalator SHALL lift the feet to its height, and stepping off SHALL land on the nearest
floor. An escalator SHALL only carry its own way. On Specs the traveller's own climbing does this.

#### Scenario: S18 Walk up the stairs
- **GIVEN** Free walk at the foot of the stairs
- **WHEN** the traveller walks along them to the top
- **THEN** they are on the next floor, and walking back brings them down
- Verified by: S18 (Node) | walk-up-the-stairs

### Requirement: Closed connections cannot be ridden
If the ride's edge is closed, pinching its button SHALL do nothing but show "<node label> is out of
service" for 3 s (e.g. "Lift 1 (ground) is out of service"), and the button label SHALL read
"Out of service" after the closure.

#### Scenario: X27 A closed lift's floor button refuses
- **GIVEN** Lift 1 has been marked out of service
- **WHEN** the traveller stands in Lift 1 (ground) and pinches its floor button
- **THEN** the ride offset stays 0
- Verified by: dc3-stepfree-seated-lift-reroute

### Requirement: Riding carries the traveller without re-planning
A successful ride SHALL move the stand-in building by the end-to-end offset (so the traveller is now
at the other end), keep the planned route unchanged, and show a 2.5 s card naming the connection and
the new level.

#### Scenario: X28 Riding the escalator up
- **GIVEN** a Walk trip and the traveller at the escalator foot
- **WHEN** they pinch "Ride escalator up"
- **THEN** they are carried up 6 m (ride offset y = 600 cm) to `escTop`
- **AND** the route is not re-planned (it still starts at `sign`)
- Verified by: dc2-walk-escalator-corners-arrow

#### Scenario: X29 Riding a lift continues the route from its top
- **GIVEN** a Step-Free trip re-routed to Lift 2, traveller inside Lift 2 (ground)
- **WHEN** they pinch "Ride to Departures"
- **THEN** they are carried up 6 m and the route continues from `lift2U` to B12, ending in arrival
- Verified by: dc3-stepfree-seated-lift-reroute

#### Scenario: X30 Ride confirmation card
- **WHEN** a ride succeeds
- **THEN** a card shows for 2.5 s naming the connection and level, e.g. "escalator up — Departures"
- Verified by: Spec gap: the ride card names the level once ("Lift up to Departures", "Stairs down to C pier") | dc3-stepfree-seated-lift-reroute, dc3b-seated-lift-ride

## Known gaps

- **Fixed (review round):** the ride card names the level once ("Lift up to Departures", was
  "Departures — Departures"), built by `rideCard` in the shared place module (X30).
- **Fixed (review round):** reach thresholds are tested (X26) and use horizontal distance on the
  same level (a seated traveller could not ride before).
- Brief mentions "E" (move up) as an alternative way up in the preview; the Lens and its tests
  only support the ride buttons (E is used for seated/standing height). Untested.
- Real riding feel is unproven (brief risk).
