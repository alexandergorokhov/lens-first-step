# Companion Specification

## Purpose

A small companion that walks ahead on the route: a feature the traveller turns on or off, any model
(dog, robot, rover), never changing the route (brief 2, feature 6; addendum B). Logic: pet.ts
(`PetGuide`). Lens: `FindYourWayCompanionView`, app panel `FindYourWayAppPanelUI`.

## Requirements

### Requirement: On or off, the line always shows
The app panel (waist height, to the left, shown during a trip) SHALL have a toggle labelled with the
companion's name ("Pet: on/off"). On: the companion and the line (alpha 0.5). Off: just the line.
`companionOnAtStart` (Inspector, default off) turns it on when a trip starts. Toggling SHALL never
change the route; the score SHALL survive off/on and re-routes.

#### Scenario: P1 Toggle
- **WHEN** the traveller pinches "Pet: off"
- **THEN** the companion shows, the line still shows, the chip reads "Treats 0 of N"
- **AND** pinching again hides it, keeps the line, hides the chip; the route is unchanged
- Verified by: P1, P7, Q7 (Node) | p1-companion-toggle-and-models (LEAF written, not run yet)

### Requirement: Any model
The Inspector `companionModel` (dog / robot / rover) and the "Swap model" button SHALL change only
the model, its name ("Pet" / "Robot" / "Rover") and its collectible (treats / bolts / stars).

#### Scenario: Q8 Swap
- **WHEN** "Swap model" is pinched twice from the dog
- **THEN** the model is the robot ("Bolts …"), then the rover; the route is unchanged
- Verified by: Q8 (Node) | p1-companion-toggle-and-models (LEAF written, not run yet)

### Requirement: Leads, waits, collects
It SHALL walk ~2.5 m ahead on the route, sit at the foot of a floor change until the traveller gets
there (never on another floor before them), stop and look back when they are > 6 m behind, hop at
arrival. Collectibles at turns, floor changes, the destination and every ~7 m are collected within
1.5 m; arrival shows "All N treats found!" in the chip.

#### Scenario: P3 Waits at the escalator
- **GIVEN** the traveller 1.5 m before the escalator foot with the companion on
- **THEN** after 3 s the companion is within 1 m of the foot, on the ground floor
- Verified by: P2–P6 (Node) | p3-companion-waits-at-escalator (LEAF written, not run yet)
