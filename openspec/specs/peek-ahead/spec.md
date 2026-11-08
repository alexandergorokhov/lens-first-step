# Peek Ahead Specification

## Purpose

See the whole place as a small model in your hand space, with your route glowing in it. Logic: peek.ts (`peekPlace`, `boardModel`). Lens: `FindYourWayPeekView`.

## Requirements

### Requirement: Pinch and pull
While a tracked hand pinches and has pulled ≥ 8 cm toward the head, or See map is on, the Lens SHALL show
a ~40 cm model of the place ~60 cm ahead and 45 cm below the eyes (aligned with the building's north);
releasing the pinch hides it. It works on a trip and in Free walk. It SHALL never change the route, its
length or the destination.

#### Scenario: Z1–Z3 Show and hide
- Verified by: Z3 (Node) | pk1-peek-ahead-shows-and-hides (via a test hook)

### Requirement: The mini mall
The model SHALL stack every floor evenly apart (`PEEK_FLOOR_GAP`), with its corridors, its places coloured
by group (food, fun, service, shop), the connections between floors (closed ones red), your floor brighter,
the walked route faint, the rest glowing, a dot for you and a mark at the destination. Halfway up a
connection you are halfway between two floors. The floors SHALL not be rebuilt while only you move.

#### Scenario: PM1–PM16 What the model holds
- **GIVEN** the mall with a route to the Sky Garden
- **THEN** three floors show, full of shops, with the route climbing through them
- Verified by: PM1–PM16 (Node) | pk1-peek-ahead-shows-and-hides

### Requirement: See map
The app panel SHALL have a See map button that shows and hides the mini mall, for when a hand can't pinch
and pull (the preview). End trip and Restart SHALL turn it off.

#### Scenario: PM17 See map
- Verified by: by eye in the preview

### Requirement: The board shows your floor
The "You are here" board SHALL draw your floor flat, north up, with places in the same colour groups.

#### Scenario: BM1–BM5 The board
- Verified by: BM1–BM5 (Node) | s1-start-at-sign-controls-hidden

### Requirement: See map at the left, see-through, gates named (R2-20, R2-22)
**See map** SHALL show the map at the left of the view (30 cm left, 110 cm ahead), at alpha 0.55, with
you, the route, and the short codes of coded places (gates "C12", "B14") as labels facing you. The
button then says **Hide map**, which removes it.

#### Scenario: PA-R20 Map on the left
- Verified by: R20, R22 (Node); by eye in the preview
