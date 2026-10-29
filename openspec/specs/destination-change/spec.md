# Destination Change Specification

## Purpose

A generic "destination changed" event (gate change at the airport, room change in the hospital or
campus) re-routes the traveller from where they are now to the new destination, with a short card
and chime.

## Requirements

### Requirement: Destination change from the map's event
The destination change SHALL be defined by the map's first `destinationChanged` event (`to`,
`button`, `card`); the airport's is `to: gateC3`, button and card "Gate change B12 → C3". Pinching
the event button on Demo controls SHALL show the event's card with a chime, set the Navigator's
destination to `to`, and re-plan from the node nearest the traveller (on their level). If no trip
is running yet, it SHALL set the destination used when the trip starts.

#### Scenario: S4 Gate change B12 → C3 while walking
- **GIVEN** a Walk trip to B12 and the traveller at the top of the escalator
- **WHEN** the user pinches "Gate change B12 → C3" on Demo controls
- **THEN** the destination is `gateC3`
- **AND** the card top-right reads exactly "Gate change B12 → C3" (no colon), with a chime
- **AND** the route is re-planned from the current position (from the concourse area) and the line
  swings round
- Verified by: S4 Gate change B12 -> C3 while walking: card text and re-route from current position | dc4-gate-change-stairs-and-ramp

#### Scenario: DC4 Stairs when the lift is far; ramp for Step-Free
- **GIVEN** a Walk trip, traveller at the top of the escalator
- **WHEN** the gate changes to C3
- **THEN** the route goes `… concourse > cTop > cJunction > gateC3` and takes the stairs down to the
  C pier (from the concourse: 27.4 m)
- **GIVEN** a Step-Free trip from the entrance
- **WHEN** the gate changes to C3
- **THEN** the route takes the ramp (`sign>hall>lift2G>lift2U>cTop>cJunction>gateC3`, 68 m) and
  uses no stairs or escalator
- Verified by: S4 Gate change B12 -> C3 while walking: card text and re-route from current position | dc4-gate-change-stairs-and-ramp

#### Scenario: X31 Gate change before the scan
- **GIVEN** a mode is chosen but the sign is not yet scanned
- **WHEN** the user pinches "Gate change B12 → C3"
- **THEN** the card shows and the trip, once scanned, routes to C3
- Verified by: none (gap)

#### Scenario: X32 Destination change after arrival resumes navigation
- **GIVEN** the traveller has arrived at B12
- **WHEN** the gate changes to C3
- **THEN** the arrival card hides, the phase returns to `nav` and the line to C3 appears
- Verified by: none (gap)

### Requirement: Generic events in other maps
The same button SHALL drive any map's destination change: hospital "Room change Ward 4 → X-ray",
campus "Room change Lecture Hall 1 → Lab 2", room "Change to the door" (card
"Destination changed: door"). A map without a `destinationChanged` event SHALL hide the button.

#### Scenario: X33 Room change in the hospital and campus
- **WHEN** the room change is applied
- **THEN** hospital re-routes to X-ray on the ground floor; campus re-routes to Lab 2 on the Science
  ground floor; room re-routes to the door
- Verified by: hospital: room change Ward 4 -> X-ray re-routes on the ground floor; campus: room change Lecture Hall 1 -> Lab 2 re-routes to the Science ground floor; room: short route on the room floor to the window, and the change to the door | none (Lens button on non-airport maps: manual (preview))

## Known gaps

- `gateChangeMessage` in `router.ts` returns "Gate change: B12 → C3" (with a colon), while the brief
  and the Lens card say "Gate change B12 → C3". The Lens takes the text from the map, so the router
  helper is unused by the Lens and disagrees with the brief; the S4 Node test asserts the colon form.
- Pressing the button again after the change re-shows the card and chime with no route change.
