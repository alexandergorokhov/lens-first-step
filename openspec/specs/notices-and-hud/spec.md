# Notices and HUD Specification

## Purpose

Head-locked feedback that must reach the user even when they are looking down at the line: a short
notice card in the top-right corner of the view (gate change, closures, errors) with a chime, and a
small badge saying whether the online or offline map is in use.

## Requirements

### Requirement: Notice card top-right
The notice card SHALL be fixed to the view in the top-right corner (7 cm right, 7 cm up, 70 cm ahead
of the eyes, inside the ~32° view), with an icon and light text, a gentle pop-in, and SHALL hide
after `cardSeconds = 5` s unless a shorter time is given (rides 2.5 s, ride refusals 3 s). A new
notice SHALL replace the current one. Texts used: "Gate change B12 → C3" (and the other maps' event
cards), "Lift 1 out of service. Re-routing.", "No step-free route. Ask staff at the assistance
point.", "Map couldn't load", "This sign isn't in the map", "Walk to <place> first",
"<place> is out of service".

#### Scenario: X40 Gate-change card shows top-right
- **WHEN** the gate changes
- **THEN** the card "Gate change B12 → C3" shows in the top-right corner of the view
- Verified by: dc4-gate-change-stairs-and-ramp (text); manual (preview) for position — PREVIEW-GUIDE 9c

#### Scenario: X41 Card hides after about 5 s
- **GIVEN** the gate-change card is showing
- **WHEN** 5 s pass
- **THEN** the card hides
- Verified by: none (gap)

### Requirement: Chime with attention notices
A short chime SHALL play with the destination-change card and the connection-closed card
(the things that need attention while the user may be looking elsewhere).

#### Scenario: X42 Chime with the gate-change card
- **WHEN** the user pinches "Gate change B12 → C3"
- **THEN** a chime plays together with the card
- Verified by: manual (preview) — PREVIEW-GUIDE 9c "gate-change card and chime are noticeable"

### Requirement: Map badge
A small badge SHALL show top-left in the view (−8, 8, −70 cm): "loading map…" during the load, then
"online map" or "offline map". It SHALL be hidden before the scan and cleared by Restart / map
switch. Demo controls status SHALL echo it, e.g. "Walk · offline map".

#### Scenario: X43 Badge after the scan
- **WHEN** the scan finishes and the download failed
- **THEN** the badge reads "offline map"
- Verified by: dc1-scan-sign-line-appears; e2-broken-map-fallback; restart-resets-trip (badge cleared)

## Known gaps

- Risk noted in the brief: a top-right card may be missed while looking down at the line on SPECS'
  narrow view; the chime mitigates it. "Feel unproven".
- The card's 5 s hide has no automated test.
