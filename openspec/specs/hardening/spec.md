# Hardening Specification

## Purpose

What the adversarial review of the branch asked for: a downloaded map is untrusted, you always know
which floor you are on, every walk has a way out, and edge values never hang or crash a module.
Logic: `router.ts`, `freewalk.ts`, `mapping.ts`, `tour.ts`, `trip.ts`, `pet.ts`, `anim.ts`, `geometry.ts`,
`demo.ts`, `place.ts`. Tests: `src/core/tests/hardening.test.ts`.

## Requirements

### Requirement: A hostile map is refused, never thrown
`parseMap` SHALL return `{ok: false}` for anything it can't use and SHALL never throw, including
values that can't be turned into text. Edge ends SHALL be text. Footprints, buildings, levels (at most
`MAX_LEVELS`), buildings (at most `MAX_BUILDINGS`) and every shown string SHALL be checked. Names of
object internals SHALL not be accepted as an edge id or an icon.

#### Scenario: H1–H6 Hostile fields
- **GIVEN** a map whose version, edge ends, ids or place fields are hostile
- **THEN** `parseMap` returns a readable refusal
- Verified by: H1–H6 (Node)

### Requirement: Maps come from a trusted address
`mapDownloadUrl` SHALL only give https addresses, or http on this computer. A place walked on the device
SHALL never be replaced by a download.

#### Scenario: H7 Only https, or this computer
- **WHEN** the base is `http://example.com/` or `file:///`
- **THEN** no download is tried
- Verified by: H7 (Node)

### Requirement: Distances from a map stay sane
`tripSettings` SHALL keep `arrivalRadius` within 0.5–50 m and `offRouteDistance` within 1–100 m.

#### Scenario: H8 Extreme distances are clamped
- Verified by: H8 (Node)

### Requirement: The log can't be used to plant a map
Text from a download SHALL reach the log through `logSafe`: one line, at most 200 characters, with no
map block marker. Speech SHALL not be logged, only its length.

#### Scenario: H9, T13 Logs stay clean
- Verified by: H9, T13 (Node)

### Requirement: Off the route means on your floor
Distance from the line SHALL count height as `levelDistance` does, so walking the floor above the route
re-plans. Re-planning SHALL start from the nearest node on your floor with a way through, never another
floor. With no assistance point a stuck route SHALL still re-plan as you walk.

#### Scenario: H10–H12 Re-planning
- Verified by: H10, H11, H11b, H12 (Node)

### Requirement: You stay on your floor when you sit
`LevelTracker` SHALL keep you on your level until your feet are within `LEVEL_CLEAR` of another level or
further than `LEVEL_SNAP` from any. `Navigator`, rides and the floor under the companion SHALL use it.

#### Scenario: H13–H15 Seated on close floors
- **GIVEN** floors at 5 m and 6 m
- **WHEN** you sit 0.55 m low on the upper one
- **THEN** you are still on it, and you arrive there
- Verified by: H13, H14, H15 (Node)

### Requirement: Free walk knows about closures
A closed connection SHALL give no floor hint and no picks, and `FreeWalk.setMap` SHALL take a new map.

#### Scenario: H16–H18 Closed connections
- Verified by: H16, H17, H18 (Node)

### Requirement: Shops marked in Map builder can be picked
A map with marked shops SHALL list a `shop` interest, kept beside the map's own interests.

#### Scenario: H19, H20 A marked shop is reachable
- Verified by: H19, H20 (Node)

### Requirement: Map builder edge cases
Undoing Next floor SHALL cancel the floor. A restored map with junk fields SHALL be refused. A walk can't
be undone past its sign. A replaced shop with no stretch of its own SHALL leave other stretches alone. A
walked map's log block SHALL round-trip.

#### Scenario: H21–H24, H35 Undo, restore, replace, upload
- Verified by: H21, H22, H23, H24, H35 (Node)

### Requirement: Edge values in every module
An exact name SHALL win when spoken. Odd ids SHALL give the default companion. `wrap` SHALL never hang. A
NaN distance SHALL stand at the start. Floors SHALL count by height. A stop you can't reach SHALL go last.
Laying out thousands of dots SHALL not freeze a frame. A long frame SHALL not eat a card's life. Turning
the companion off and on at arrival SHALL keep the score.

#### Scenario: H25–H34, H36 Boundaries
- Verified by: H25–H34, H36 (Node). H26 passes before its fix too, so it locks the behaviour rather than
  proving the reported bug.

### Requirement: Every walk has a way out
Without demo controls, a trip SHALL have an End trip button on the app panel, back to the three modes and
starting from where you stand. A sign that isn't in the map SHALL stay up to scan again. A map that fails
after loading SHALL fall back to the built-in one.

#### Scenario: E1b End trip
- **WHEN** you press End trip on a trip
- **THEN** the line and pill go, and the three modes show
- Verified by: e1b-end-trip

#### Scenario: E5b The sign stays
- Verified by: e5-unknown-sign

### Requirement: Tools and what goes public
The map server SHALL listen on this computer unless `--lan` is given. `map:publish` SHALL refuse bundled
names and upload nothing without `--yes`. Keys and machine-local files SHALL stay ignored outside Lens
Studio's managed blocks. No tracked file SHALL hold a token, a private key or, in the docs, a home path.

#### Scenario: T1–T12 Tools
- Verified by: T1–T12 (Node). T2–T4 were not run against the old `map-publish`, because it uploads.

## Not tested
Device behaviour: none of this has run on Specs. Depth stopping after the floor probe (`setFloorProbe`) and
the removal of delayed events are compile- and preview-checked only.
