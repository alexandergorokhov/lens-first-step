# Demo Controls Specification

## Purpose

A panel, clearly marked as not part of the real app, that lets a presenter trigger the map's
destination change, restart the trip, and switch between the bundled maps to prove that the same
Lens runs any building.

## Requirements

### Requirement: Demo controls panel
The panel SHALL be titled "Demo controls" with the note "Not part of the real app", and SHALL hold:
the map's destination-change button (airport "Gate change B12 → C3"; hidden for a map without such an
event), "Restart trip", "Map: <title> (switch)", and a status line ("Choose a mode to start",
"Mode: Walk", "Walk · offline map", …). It SHALL follow the user low and to their left, smoothly,
facing the eyes.

#### Scenario: X44 Panel follows the user
- **WHEN** the user walks and turns
- **THEN** the panel stays low on their left and turns to face them
- Verified by: manual (preview)

### Requirement: Restart trip
"Restart trip" SHALL reload the current built-in map and reset everything: phase `mode`, mode panel
shown, scan sign hidden, profile cleared, no line, no turn arrow, no notice or arrival card, badge
hidden, all closures reopened, destination back to the map default, ride offset 0, test overrides
cleared, world re-anchored.

#### Scenario: R8 Restart trip resets cleanly
- **GIVEN** a Walk trip with Lift 1 closed and the gate changed to C3
- **WHEN** the user pinches "Restart trip"
- **THEN** the phase is `mode`, the mode panel shows, the scan sign is hidden, no line, no card,
  no arrival card, the badge is cleared, `lift1` is open, the destination is `gateB12` and the
  ride offset is 0
- Verified by: restart-resets-trip

### Requirement: Map switch
"Map: … (switch)" SHALL cycle Airport → Hospital → Campus → Preview room → Airport, and each switch
SHALL restart at the mode panel with nothing drawn. The button label SHALL show the new map's title.

#### Scenario: R7 Map switch cycles all maps
- **GIVEN** the airport map
- **WHEN** the user pinches the map button four times
- **THEN** the map keys are hospital, campus, room, airport in turn
- **AND** after each switch the phase is `mode`, the mode panel shows, the scan sign is hidden and
  no line is drawn
- Verified by: map-switch-cycle

### Requirement: Demo event button
The destination-change button SHALL trigger the map's `destinationChanged` event (see
destination-change).

#### Scenario: X45 Gate change from Demo controls
- **WHEN** the user pinches "Gate change B12 → C3"
- **THEN** the destination becomes `gateC3`
- Verified by: dc4-gate-change-stairs-and-ramp; restart-resets-trip

### Requirement: Hidden by default
The demo controls SHALL be hidden unless `showDemoControls` (Inspector) is on; the LEAF suite turns
them on with a test hook. The ride buttons in the building stay (the preview can't change floors).

#### Scenario: H2 Hidden
- Verified by: s1-start-at-sign-controls-hidden (LEAF written, not run yet)

## Known gaps

- Placement: the brief says "waist height, to the user's left"; the code places it 15 cm left,
  16 cm below the eyes, 80 cm ahead of the head (low-left but inside the ~32° view, per the code
  comment), not at waist height. PREVIEW-GUIDE describes it as "low on your left".
- **Fixed (review round):** the Inspector `mapKey` picker lists all four maps, including Campus
  (checked against `src/core/data/index.json` by "A1/C13 the maps index is the one list…").
