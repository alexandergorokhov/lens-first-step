# Companion Specification

## Purpose

A small companion that walks ahead on the route: a feature the traveller turns on or off, any model
(dog, robot, rover), never changing the route. Logic: pet.ts
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
- Verified by: P1, P7, Q7 (Node) | p1-companion-toggle-and-models

### Requirement: Any model
The Inspector `companionModel` (dog / robot / rover) and the "Swap model" button SHALL change only
the model, its name ("Pet" / "Robot" / "Rover") and its collectible (treats / bolts / stars).

#### Scenario: Q8 Swap
- **WHEN** "Swap model" is pinched twice from the dog
- **THEN** the model is the robot ("Bolts …"), then the rover; the route is unchanged
- Verified by: Q8 (Node) | p1-companion-toggle-and-models

### Requirement: Pick the companion before you walk
The preferences panel, shown for Free walk and Tour, SHALL offer every companion as one row of
buttons with the chosen one ticked. Picking one SHALL also turn the companion on.

#### Scenario: Q8b Pick
- **GIVEN** the preferences panel with the companion off
- **WHEN** "Robot" is pinched
- **THEN** "Robot" is ticked, the toggle reads "Robot: on", and the robot walks with the traveller
- Verified by: Q8b (Node) | companion-pick-before-walk

### Requirement: Leads, waits, collects
It SHALL walk `companionAheadM` ahead on the route (7 m by default, so it is in view), sit at the foot of a floor change until the traveller gets
there (never on another floor before them), stop and look back when they are > 6 m behind, hop at
arrival. Collectibles at turns, floor changes, the destination and every ~7 m are collected within
1.5 m; arrival shows "All N treats found!" in the chip.

#### Scenario: P3 Waits at the escalator
- **GIVEN** the traveller 1.5 m before the escalator foot with the companion on
- **THEN** after 3 s the companion is within 1 m of the foot, on the ground floor
- Verified by: P2–P6 (Node) | p3-companion-waits-at-escalator

### Requirement: Jointed, animated companions
The dog, robot and rover SHALL be built from jointed parts in code, with the light baked into their
vertices, so they move on Specs without scene lights. Each frame's pose SHALL come from
`poseFor(model, {mood, speedMs, travelledM, t})` in `src/core/anim.ts`. Legs and wheels SHALL keep time
with the distance really moved, so they don't slide or run on the spot. Feet SHALL stay on the floor
when sitting.

#### Scenario: A4 The dog trots
- **WHEN** the dog walks at 1.4 m/s
- **THEN** diagonal legs move together, opposite to the other pair, and its tail wags
- Verified by: A4, A5, A6, A13 (Node, anim.test.ts) | visual-rigs (by eye)

#### Scenario: A8 Pointing is a clear pose
- **WHEN** the mood is point
- **THEN** the dog lifts a paw, the robot raises an arm, the rover tips its camera
- Verified by: A8 (Node, anim.test.ts) | visual-rigs (by eye)

#### Scenario: A10 Rover wheels roll with the distance
- **WHEN** the rover moves a quarter of a wheel's circumference
- **THEN** its wheels turn 90 degrees, and they stop when it stops
- Verified by: A10 (Node, anim.test.ts) | visual-rigs (by eye)

#### Scenario: A12 Sitting stays on the floor
- **WHEN** the dog or the robot sits
- **THEN** every foot is within 1.5 cm of the floor
- Verified by: A7, A12 (Node, anim.test.ts) | visual-rigs (by eye)
