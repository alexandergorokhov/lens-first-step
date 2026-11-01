# Turn Guidance Specification

## Purpose

When the next turn of the route is out of view (SPECS' view is narrow, about 32° wide), a small
arrow at the lower edge of the view points toward it, so the traveller never loses the line.

## Requirements

### Requirement: Next turn
The next turn SHALL be the first point along the route ahead of the traveller where the direction
bends by at least `minTurnDeg = 25°`, or the end of the route when there is no such bend
(`nextTurnAlong`). Headings SHALL be degrees clockwise from map north, wrapped to −180..180, and
yaw SHALL be positive to the right of the viewer.

#### Scenario: X20 Next turn is the first bend of 25° or more
- **GIVEN** a route ahead with a 10° wiggle and then a 90° corner
- **WHEN** the next turn is computed
- **THEN** it is the 90° corner; with no bend it is the end of the route
- Verified by: next turn: the first bend of 25 degrees or more, else the end of the route; headings are clockwise from north; wrap keeps angles in -180..180; yawTo is + to the right of the viewer and - to the left | none

### Requirement: Arrow shows only when the next turn is out of view
The turn arrow SHALL show only when the next turn is more than `halfViewDeg = 16°` off the
traveller's heading and at least 1.5 m away (`turnOutOfView`), and SHALL hide otherwise, on arrival,
restart and map switch. When the traveller looks straight up or down, the last valid heading SHALL
be kept.

#### Scenario: S8 Next turn out of view
- **GIVEN** a Walk trip to B12 and the traveller at the top of the escalator (escTop + 0.5 m north)
- **WHEN** they face back south (heading 180°)
- **THEN** the turn arrow shows
- **WHEN** they face north (heading 0°), toward the concourse turn
- **THEN** the arrow hides
- Verified by: turn arrow: shows only when the next turn is outside the view and not right under you; S8 on the airport: at the escalator top facing back, the concourse turn is out of view | dc2-walk-escalator-corners-arrow

#### Scenario: X21 No arrow for a turn right under the traveller
- **GIVEN** the next turn is less than 1.5 m away
- **WHEN** it is behind the traveller
- **THEN** no arrow shows
- Verified by: turn arrow: shows only when the next turn is outside the view and not right under you | none

### Requirement: Arrow placement
The arrow SHALL be a small blue chevron (4.5 cm, colour `(0.259, 0.522, 0.957, 0.9)`) fixed to the
view 60 cm ahead and 10 cm below centre (lower edge), shifted up to 4 cm sideways toward the turn
and rotated to point toward it (rotation clamped to ±150°), drawn on top of everything.

#### Scenario: X22 Arrow sits at the lower edge pointing toward the turn
- **WHEN** the arrow shows for a turn to the right
- **THEN** it appears at the lower edge of the view, nudged right, pointing right
- Verified by: manual (preview) — PREVIEW-GUIDE "Checks by hand"

## Known gaps

- Whether the arrow is noticeable on real glasses is "feel unproven".
