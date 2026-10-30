# Peek Ahead Specification

## Purpose

See the rest of the route as a small model in your hand space (brief 2, feature 4). Logic: peek.ts
(`peekModel`). Lens: `FindYourWayPeekView`.

## Requirements

### Requirement: Pinch and pull
While a tracked hand pinches and has pulled ≥ 8 cm toward the head, the Lens SHALL show a ~40 cm
model of the route ~60 cm ahead and 45 cm below the eyes (walked part faint, the rest glowing, a dot
for you, aligned with the building's north); releasing the pinch hides it. It SHALL never change the
route, its length or the destination.

#### Scenario: Z1–Z3 Show and hide
- Verified by: Z3 (Node) | pk1-peek-ahead-shows-and-hides (LEAF written, not run yet, via a test hook)
