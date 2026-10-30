# Floors and Distance Specification

## Purpose

Tell the traveller how far, how long and which floor, and warn them before every floor change
(brief 2, features a–d, g and 1). Logic: `tripAhead` (router.ts), `tripPill`, `floorCueFor`,
`destinationFloorText` (place.ts), `lineOnLevel` (geometry.ts). Lens: `FindYourWayMain.updatePill`,
`FindYourWayHudUI` (pill, cue), `FindYourWayCompanionView.setPost`.

## Requirements

### Requirement: Distance pill with the floor badge
From the scan to arrival the Lens SHALL show one pill at the bottom centre (~70 cm ahead, 9 cm
below the eyes): "<floor> · <destination> · <metres> m · <n floor(s) up|down> · <minutes> min",
the floor part left out on the same floor. The floor badge (first chip) SHALL come from the route,
not the feet height. The pill SHALL count down as the traveller walks, update on any re-route and
hide at arrival.

#### Scenario: S10/S12 Pill after the scan
- **GIVEN** a Walk trip to Gate B12 on the airport
- **WHEN** the sign is scanned
- **THEN** the pill reads "<Ground level> · Gate B12 · <route length> m · 1 floor up · <n> min"
- **AND** after walking to the hall the metres are lower; at arrival the pill is hidden
- Verified by: S10 (Node) | fl1-pill-shows-and-counts-down (LEAF written, not run yet)

### Requirement: Floor-change cue and destination note
Within 15 m of a lift, escalator, stairs or ramp on the route the Lens SHALL show "In <n> m: <kind>
<up|down> to <level>" ("Now: …" within 2 m) just above the pill. For 3.5 s after the scan or a
destination change, when no cue shows, it SHALL show "<destination> is on <level>, <n> floor(s)
up|down" (or "is on this floor").

#### Scenario: S13 Cue before the escalator
- **GIVEN** the traveller 8 m before the escalator foot
- **THEN** the cue reads "In 8 m: escalator up to Departures"
- Verified by: S13 (Node) | fl2-cue-post-and-badge-after-escalator (LEAF written, not run yet)

### Requirement: The line stays on your floor
The drawn line SHALL end at the foot of the next floor change, where an up/down post stands; once
the traveller is on an escalator, stairs or ramp it SHALL be drawn up it; in a lift only the post.

#### Scenario: S14 Line ends at the escalator foot
- **GIVEN** the traveller approaching the escalator
- **THEN** every drawn line point is on the ground floor and the up post shows
- **AND** after riding, the pill's badge names the upper floor
- Verified by: S14 (Node) | fl2-cue-post-and-badge-after-escalator (LEAF written, not run yet)
