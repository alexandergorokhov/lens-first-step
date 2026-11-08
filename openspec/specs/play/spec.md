# Play While You Wait Specification

## Purpose

Something to do while waiting (at a gate, a lift, a lounge), only with the companion on: Hop (raise
a hand to make it jump over obstacles) and catch (throw a treat, it fetches). Neither reads or
changes the route. Logic: play.ts. Lens: `FindYourWayMain.updateCompanion`, lane in
`FindYourWayCompanionView`, buttons on the app panel.

## Requirements

### Requirement: Only while standing still
Play SHALL be offered (the "Play while you wait" button, a hint under the pill) after 2 s standing
still (sway ≤ 0.6 m) with the companion on and no card showing. Walking off, a ride, or turning the
companion off SHALL end it at once.

#### Scenario: G0 Offered when still
- **WHEN** you stand still for 2 s with the companion on and no card
- **THEN** Play shows, and walking off ends it
- Verified by: G1–G9 (Node) | g1-hop-jump-bump-restart

### Requirement: Hop
The lane SHALL start ~3 m ahead (`HOP_AHEAD_M`, a couple of steps, so the whole game shows) along where the traveller looked, the companion at its near end
seen from behind. Obstacles appear at the far end (6 m) and come toward it, speeding up slightly per
obstacle cleared (3 → 5 m/s); gaps always leave time to land and jump again. A raised hand (either
wrist within 20 cm of head height, once per raise, re-armed below 45 cm; preview: the Jump button)
SHALL make it jump (~0.63 m, ~0.6 s; no double jump). A hit: it shakes for 1.2 s and the game stops;
then a raised hand (or the button) starts again with the score at 0, keeping the best. The line
under the pill reads "Raise your hand: Pet jumps", "Jumps n · best b" or "Bump! Raise your hand to
play again".

#### Scenario: G1/G5 Bump and restart
- **GIVEN** the companion on and the traveller standing still
- **WHEN** Play is pinched and no hand is raised
- **THEN** an obstacle comes, the companion is bumped and shakes, the line reads "Bump! …"
- **AND** a raised hand after the shake starts a new game at score 0
- **AND** walking 2 m ends play and hides the lane; the route never changed
- Verified by: G1–G9 (Node) | g1-hop-jump-bump-restart

### Requirement: Catch
"Throw a <collectible>" SHALL throw it ahead (lands on your floor, ≤ 5 m); the companion runs to it,
catches it (chime), brings it back and drops it ~0.7 m from you, then guides again. Not while
moving, within 10 m of a floor change, or while a card shows. Any model plays the same game.
The button throws straight ahead; grab-and-throw by hand, and seated play, are in
`seated-and-hand-play`.

#### Scenario: P9 Fetch
- **WHEN** the treat is thrown while standing still
- **THEN** the companion fetches it and the catch count goes up; the rover does the same
- Verified by: P8, P9 (Node) | pc1-throw-and-fetch-any-model
