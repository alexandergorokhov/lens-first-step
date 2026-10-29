# Route Line Specification

## Purpose

Draws the route as a semi-transparent Google-Maps-blue line on the floor in front of the
traveller, showing only the next 10 m, going round corners, and swinging smoothly to a new route
when it re-routes.

## Requirements

### Requirement: Line look
The line SHALL be a ribbon on the floor, 1 cm above it, 30 cm wide with a 12 cm soft glow on each
side, in Google Maps blue #4285F4 at 50 % opacity (`(0.259, 0.522, 0.957, 0.5)`), the same in both
modes. Sharp corners SHALL be rounded (arc radius up to 60 cm) so the line "goes round" corners.

#### Scenario: X13 Line lies 1 cm above the floor
- **WHEN** the line is drawn after the scan
- **THEN** its first building-local point has y ≈ 1 cm (floor + 1 cm)
- Verified by: dc1-scan-sign-line-appears; dc3-stepfree-seated-lift-reroute (still 1 cm when seated)

#### Scenario: X14 Line colour, width and glow match the brief
- **WHEN** the line is visible in the preview
- **THEN** it is semi-transparent blue, about 30 cm wide, with a soft glow, and the floor shows through
- Verified by: manual (preview)

### Requirement: Only the next 10 m are shown
The line SHALL start at the point of the route closest to the traveller and extend forward along
the route for at most `lineAheadM = 10` m (`lineAhead`), fading out over the last 30 % of that
window. It SHALL end at the destination when that is nearer. It SHALL be shown only after the scan
and hidden on arrival, restart and map switch.

#### Scenario: X15 Floor line is clipped to 10 m ahead of the traveller
- **GIVEN** a straight route and the traveller at z = 5 m
- **WHEN** the visible line is computed
- **THEN** it runs from (0, 0, 5) to (0, 0, 15)
- Verified by: Floor line is clipped to 10 m ahead of the traveller | none

#### Scenario: X16 Floor line follows a turn and stops at the gate
- **GIVEN** a route with a corner shortly before its end
- **WHEN** the visible line is computed
- **THEN** it has 3 points, follows the turn and ends exactly at the destination
- Verified by: Floor line follows a turn and stops at the gate | none

#### Scenario: X17 Line fades out at its far end
- **WHEN** the line is visible
- **THEN** it fades out toward its 10 m end
- Verified by: manual (preview)

### Requirement: Line goes round corners and stays up while walking
While the traveller follows the route the line SHALL stay visible and SHALL follow the route's
corners (e.g. the concourse corner toward the B gates).

#### Scenario: DC2 Walking through the building
- **GIVEN** a Walk trip to gate B12
- **WHEN** the traveller follows the line through the hall to the escalator foot, rides the
  escalator up and walks on round the concourse corner to B12
- **THEN** the route is `sign>hall>escFoot>escTop>concourse>bJunction>gateB12` and uses the escalator
- **AND** the line never disappears while walking and is seen bending east round the concourse corner
- **AND** the traveller arrives with "Gate B12. Boarding in 6 min."
- **AND** an arrow shows when the next turn is out of view (see turn-guidance)
- Verified by: S1 Walk: sign at entrance to B12 is the shortest path and uses the escalator | dc2-walk-escalator-corners-arrow

### Requirement: Line stops at the foot of a lift
Because a lift is ridden with its floor button, the drawn line SHALL end at the foot of a vertical
lift segment (height change > 1 m with < 0.5 m horizontal travel) and continue from the lift's
upper end after the ride. It SHALL follow inclined escalator, stairs and ramp segments.

#### Scenario: X18 The drawn line stops at the foot of a lift but follows an escalator
- **WHEN** `stopAtLift` is applied to a polyline containing a lift shaft and one containing an escalator
- **THEN** the first is cut at the lift foot and the second is unchanged
- Verified by: the drawn line stops at the foot of a lift (vertical segment) but follows an escalator | dc3-stepfree-seated-lift-reroute (route continues from the top of Lift 2)

### Requirement: Swing on re-route
On any re-route (destination change, closure, off-route) the old line SHALL fade out while the new
line grows outward from the traveller over `swingSeconds = 0.9` s.

#### Scenario: X19 Line swings round on a gate change
- **WHEN** the gate changes from B12 to C3
- **THEN** the line is in its swing animation immediately afterwards
- Verified by: dc4-gate-change-stairs-and-ramp ("line swings round")

### Requirement: Metres to centimetres
Map points SHALL be converted to building-local centimetres with the start sign at the origin and
map north along −Z (`mapToLocalCm`), and the camera position back to map metres of the feet
(`localCmToMap`, subtracting the eye height); the round trip SHALL be exact.

#### Scenario: R9 Lens maths and Lens copies identical
- **WHEN** the geometry tests run
- **THEN** headings, yaw, next turn, turn-arrow visibility, metres ↔ cm and stop-at-lift behave as
  specified and `geometry.ts`/`router.ts` equal their Lens copies
- Verified by: map metres <-> building cm: the sign is the origin, north is -Z, round trip is exact; geometry.ts and its Lens copy are identical; router.ts and its Lens copy are identical; headings are clockwise from north; wrap keeps angles in -180..180; yawTo is + to the right of the viewer and - to the left; next turn: the first bend of 25 degrees or more, else the end of the route; turn arrow: shows only when the next turn is outside the view and not right under you; the drawn line stops at the foot of a lift (vertical segment) but follows an escalator | none

## Known gaps

- Floor height in the preview depends on `eyeHeightCm = 180` (the preview room returns no floor
  hit); whether the line lies exactly on the preview floor is "not yet confirmed by eye"
  (PREVIEW-GUIDE section 8).
- "Soft glow, smooth fades" polish is judged only by eye.
