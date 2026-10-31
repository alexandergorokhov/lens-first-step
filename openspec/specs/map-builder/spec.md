# Map Builder Specification

## Purpose

Walk a place and get a map (design-brief-3). Unlike the older "Learn this place" in `mapping-mode`,
the traveller names nothing: the path, the floors and the shops are recorded as they walk. Logic:
mapping.ts (`WalkTracer`, `MapRecorder`, `guessConnection`, `mapLogLines`, `parseMapLog`). Lens:
`FindYourWayMain` (`mapMarkShop`, `mapUndo`, `saveMapping`). Laptop: `tools/map-publish.mjs`
(`npm run map:publish`).

## Requirements

### Requirement: The path records itself
After the scan and choosing Map builder, the walk SHALL be recorded with no set-up: a sample every
0.5 m (`SAMPLE_GAP`), corners kept past 1 m (`CORNER_TOLERANCE`), a crossing within 1.5 m
(`JOIN_RADIUS`) joined to the old stretch (so a shortcut exists). Standing still adds nothing. Undo
removes the last point, and a join's split too.

#### Scenario: MB1 Straight walk, corner, crossing, undo
- **WHEN** the traveller walks a straight line, a corner, wobbles under 1 m, and crosses an old stretch
- **THEN** a straight walk is one stretch, the corner is kept, the wobble is not, the crossing is joined; Undo restores the earlier state
- Verified by: B1, B2, B3, B4, B5 (Node, builder.test.ts) | b3-dc1-map-builder-two-floors

### Requirement: Floors found by height
A height change of at least 1 m (`FLOOR_RISE`) held for 2 s (`FLOOR_HOLD`) SHALL start a new floor;
heights within 0.3 m of a floor are on it. The Lens guesses the connection: lift if under 1.5 m was
walked sideways, ramp if gentle (run at least 5 times the rise), escalator if the climb was steady
(speed jitter at most 0.15), else stairs. Until confirmed it SHALL save as stairs, so Step-Free never
uses it. One pinch confirms the guess or picks another kind. "Next floor" is the manual fallback and
assumes 4 m (`MANUAL_FLOOR_RISE`). A wobble under 1 m, or under 2 s, is no floor.

#### Scenario: MB2 Second floor
- **WHEN** the traveller climbs 1 m or more and stays 2 s
- **THEN** a floor starts, saved as stairs until the pinch confirms the guess
- **AND** Next floor adds a floor when the height did not change
- Verified by: B6, B7, B8, B9, B10 (Node, builder.test.ts) | b3-dc1-map-builder-two-floors

### Requirement: Mark shop
One pinch on Mark shop SHALL store a shop node (kind `place`, category `shop`, plain name "Shop 1",
"Shop 2") and its `front`: 6 m wide (`SHOP_WIDTH`), 1.5 m ahead (`SHOP_AHEAD`), square to the facing
direction. Marking within 2 m (`SHOP_REPLACE`) of an existing shop replaces it; Undo puts it back.
The walk goes on from where the traveller stood, not from the shop. The recorder writes and restores
place nodes, category, `front` and `offer`.

#### Scenario: MB3 Two shops per floor
- **WHEN** the traveller marks two shops on each of two floors
- **THEN** the map has four shops, each with a front, and a walking mode can route on it for both profiles
- Verified by: B11, B12, B13, B14, B15 (Node, builder.test.ts) | b3-dc1-map-builder-two-floors

### Requirement: Review and upload
"See my map" SHALL show a small model of every stretch, every shop and the traveller's dot. Upload
SHALL write the map text to the log between `[FYW-MAP]` markers (lines of at most 700 characters
(`LOG_CHUNK`), with a part count and a checksum); a Lens never holds a git token.
`npm run map:publish -- --log <file>` reads the last complete block, refuses a cut-off or changed one,
validates with `parseMap`, and says what it will publish. `--dry-run` changes nothing.

#### Scenario: MB4 Upload and publish
- **WHEN** Upload is pinched and the log is read back
- **THEN** the last complete block wins; a map that fails `parseMap` is refused
- Verified by: B16, U1, U2, U3 (Node, builder.test.ts) | b3-dc1-map-builder-two-floors

## Not tested

- `map:publish` without `--dry-run` (writes `src/core/data` and updates the public gist): not run in tests.
- Naming the shops and adding offers is done by hand in the map JSON; no editing tool exists.
- Lift detection on real Specs (the cabin may look still to tracking), position drift on long walks,
  and whether a large map survives the log: untested; only real Specs can answer the first two.
