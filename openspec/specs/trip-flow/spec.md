# Trip Flow Specification

## Purpose

Defines the sequence of a trip: choose Walk or Step-Free once, pinch the simulated "you are here"
sign scan, load the map, navigate, arrive — and how the start sign places the traveller and the
stand-in building in the world.

## Requirements

### Requirement: Trip phases
A trip SHALL move through the phases `mode → scan → loading → nav → arrived`, with `error` when the
scanned sign is not in the map. Restart trip or a map switch SHALL return to `mode`.

#### Scenario: X10 Phases advance in order on the happy path
- **GIVEN** a fresh start on the airport map
- **WHEN** the user pinches Walk, then Scan sign
- **THEN** the phase goes `mode → scan → loading → nav`
- Verified by: dc1-scan-sign-line-appears (via startTrip: waits for "scan", then "nav")

### Requirement: Mode panel shown first, mode chosen once
At start the mode panel SHALL show about 1 m in front of the user and a little below eye level
(offset right 8 cm, up −4 cm, forward 100 cm from the head), titled "How are you getting there?"
with the subtitle "Choose once for the whole trip" and two big buttons "Walk" and
"Step-Free (wheelchair)" (30 × 7.5 cm). Pinching one SHALL set the profile for the whole trip, hide
the panel and show the scan sign. Mode choice SHALL be ignored outside the `mode` phase; there is
no way to switch mode mid-trip except Restart trip.

#### Scenario: S3 Switch mode mid-route is not offered in the Lens
- **GIVEN** a trip in progress (phase `scan`, `nav` or `arrived`)
- **WHEN** a mode button event arrives
- **THEN** it is ignored and the profile is unchanged
- **AND** the only way to change mode is Restart trip (brief: switching mode mid-trip is out of scope)
- Verified by: none (gap) — the mode panel is hidden after the choice; the phase guard in `chooseMode` is untested. Router-level re-route logic: S3 logic: switching mode mid-route re-routes from the current position with the other mode's rules

#### Scenario: X11 Choosing a mode hides the panel and shows the sign
- **WHEN** the user pinches "Walk"
- **THEN** the mode panel hides, the "You are here" sign with "Scan sign" appears, and Demo
  controls status reads "Mode: Walk" ("Mode: Step-Free" for Step-Free)
- Verified by: dc1-scan-sign-line-appears; map-switch-cycle (panel shown, sign hidden before choice)

### Requirement: Building anchored where the user chooses
When a mode is chosen, the world anchor SHALL be placed at the user's head position and yaw, and
the start sign (map origin) SHALL stand `signOffset` = 250 cm straight ahead on the floor, so the
user can first step into clear floor and then choose. The floor is `eyeHeightCm` (default 180) below
the eyes unless a downward hit test finds the real floor (accepted eye heights 90–230 cm).

#### Scenario: X12 Sign stands 2.5 m ahead in open floor
- **GIVEN** the user has walked into open floor
- **WHEN** they pinch a mode
- **THEN** the "You are here" sign appears about 2.5 m ahead, its button about 1.25 m above the floor
- Verified by: manual (preview) — PREVIEW-GUIDE section 8 "Start position" and "Floor height"

### Requirement: Simulated sign scan
The scan sign SHALL show the map's `scanSign` texts: title "You are here", the stand-in label (e.g.
"Stand-in building"), a big "Scan sign" button and the hint "on real Specs: look at the sign".
Pinching "Scan sign" SHALL hide the sign, start the map load, and locate the traveller at the map's
start `sign` node. Everything after the scan (routing, line, re-routing) SHALL be real.

#### Scenario: DC1 Scanning the start
- **GIVEN** the airport map and Walk chosen
- **WHEN** the user stands 1.5 m in front of the sign and pinches "Scan sign"
- **THEN** the phase becomes `nav`, the sign button hides, the destination is `gateB12`
- **AND** the route starts at `sign` and ends at `gateB12`
- **AND** a blue line appears on the floor starting at the entrance sign and heading north into
  the building, 1 cm above the floor
- **AND** the badge reads "online map" or "offline map"
- Verified by: S1 Walk: sign at entrance to B12 is the shortest path and uses the escalator | dc1-scan-sign-line-appears

### Requirement: Unknown sign
If the scanned sign id is not a node of kind `sign` in the loaded map, the Lens SHALL enter the
`error` phase, show the notice card "This sign isn't in the map", draw nothing and plan no route.

#### Scenario: E5 Unknown sign id
- **GIVEN** the scanned sign id is `sign-T9-404`
- **WHEN** the scan completes
- **THEN** the phase is `error`, the card reads "This sign isn't in the map", no line is visible
  and the route status is "none"
- Verified by: E5 Unknown sign id: 'This sign isn't in the map', nothing drawn | e5-unknown-sign

## Known gaps

- Mode panel position: the brief says "about 1 m in front, a little below eye level"; the code also
  shifts it 8 cm right (matches PREVIEW-GUIDE "a little right"). Cosmetic.
- No test covers the mid-trip mode lock (S3 in the Lens).
- Sign recognition is simulated by design (brief: out of scope).
