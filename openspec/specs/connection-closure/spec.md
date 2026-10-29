# Connection Closure Specification

## Purpose

A generic "connection closed" event (lift out of service, door locked, path closed): the user
pinches a red sign on the connection, the connection closes, and the route re-plans around it.

## Requirements

### Requirement: Red out-of-service sign from the map's events
For each `connectionClosed` event in the map (`edge`, `at`, `sign`, `card`) the Lens SHALL place a
red sign on the connection at the `at` node (on the lift door plate, facing the approach), titled
"Out of service?" with a button labelled with the event's `sign` text (airport: "Lift 1 out of
service" on `lift1G`; hospital: "Lift A out of service"; campus: "Science lift out of service").
Every lift in a bundled map has its own event (airport Lift 1 and Lift 2, hospital Lift A and B,
campus Science and Library lifts); the sign hangs about 1.2 m above the floor.

#### Scenario: X34 Red sign on Lift 1
- **GIVEN** the airport map
- **WHEN** the place is built
- **THEN** a red "Lift 1 out of service" sign stands by the Lift 1 (ground) door
- Verified by: dc3-stepfree-seated-lift-reroute (pinches ClosureButton_lift1); manual (preview) for look and placement

### Requirement: Pinching closes the connection and re-routes
Pinching the red sign SHALL close the edge (once; repeats are ignored), relabel the sign button
"Closed — re-routing", dim the stand-in's red plate, relabel that connection's ride buttons
"Out of service", re-plan the route from the traveller's nearest node with the line swing, and show
the event card with a chime (airport: "Lift 1 out of service. Re-routing.").

#### Scenario: S5 Lift out in Step-Free
- **GIVEN** a Step-Free trip from the entrance to B12 via Lift 1
  (`sign>hall>lift1G>lift1U>bJunction>gateB12`, 63.1 m)
- **WHEN** the user pinches the red sign on Lift 1
- **THEN** Lift 1 is closed and the route re-plans to Lift 2
  (`sign>hall>lift2G>lift2U>cTop>concourse>bJunction>gateB12`, 91.8 m)
- **AND** the new route uses no stairs or escalator
- **AND** the card reads "Lift 1 out of service. Re-routing." and the line is still drawn
- Verified by: S5 Lift out in Step-Free: pinching the red sign closes the lift and the new route avoids stairs/escalators | dc3-stepfree-seated-lift-reroute

#### Scenario: X35 Reopening a connection restores the original route (router)
- **GIVEN** Lift 1 closed in a Navigator
- **WHEN** it is reopened with `setEdgeOpen("lift1", true)`
- **THEN** the route returns to Lift 1
- Verified by: S5 Lift out in Step-Free: pinching the red sign closes the lift and the new route avoids stairs/escalators | restart-resets-trip (Restart reopens lift1)

### Requirement: Closure before the scan is kept
A connection closed before the map finishes loading SHALL stay closed in the trip.

#### Scenario: X36 Closing Lift 1 before scanning
- **GIVEN** Step-Free chosen, sign not yet scanned
- **WHEN** the user pinches the Lift 1 red sign and then scans
- **THEN** the trip routes via Lift 2
- Verified by: c12-stale-load-and-closures-kept (part b: closed before the scan, downloaded map differs, sign/plate/ride button still show closed)

### Requirement: No step-free route → assistance point
If after a closure no step-free route remains, the card SHALL read "No step-free route. Ask staff at
the assistance point." and the line SHALL lead to the nearest reachable assistance point instead.

#### Scenario: E3 No step-free route
- **GIVEN** a Step-Free trip on the airport map
- **WHEN** Lift 1 (red sign) and Lift 2 are both closed
- **THEN** the route status is "askStaff" and the card reads "No step-free route. Ask staff at the
  assistance point."
- **AND** from the check-in hall the line ends at the Assistance point (`assist`, via
  `sign>hall>assist`)
- Verified by: E3 No step-free route (lift + ramp closed): ask-staff message and a line to the nearest assistance point; E3 Both lifts closed: Step-Free to B12 also asks staff and points to the assistance point; hospital: both lifts out -> Step-Free to Ward 4 asks staff and points to Reception | e3-no-step-free-ask-staff

#### Scenario: X56 The card says "Re-routing" only when the route used the connection
- **GIVEN** a Step-Free trip whose route uses Lift 1
- **WHEN** the traveller pinches Lift 2's red sign
- **THEN** the card reads "Lift 2 out of service" (no "Re-routing") and the route is unchanged
- **AND** a closure that leaves no route shows the route's own notice instead (ask staff)
- Verified by: C13 closure card only says 'Re-routing' when the route used that connection | closure-card-signs-and-5s-hide

#### Scenario: X57 Every lift has its own red sign at about 1.2 m
- **GIVEN** any bundled map
- **WHEN** the place is built
- **THEN** each lift edge has a `connectionClosed` event whose sign hangs at one of its nodes, about
  120 cm above the floor
- Verified by: Spec gap: every closable lift has its own red out-of-service sign in the map | closure-card-signs-and-5s-hide

## Known gaps

- **Fixed (review round):** every lift has a red sign (X57), so E3 can now be reached by hand in
  the airport preview (pinch Lift 1 and Lift 2).
- **Fixed (review round):** the notice after a closure comes from `noticeFor(route)`: Walk with no
  route says "No route right now. Ask staff at the assistance point."; Step-Free says the step-free
  text (X8, X59).
- **Fixed (review round):** reaching the assistance point is an arrival there (X54b).
