# Map From A Floor Plan Specification

## Purpose

A floor-plan draft becomes a map the Lens accepts, or a clear error instead of a broken file. The
draft is what an agent writes after reading floor-plan photos (format: `tools/examples/plan-draft.sample.json`
and `agent/skills/map-from-photo/SKILL.md`). Tool: `tools/map-from-plan.mjs`, run as
`npm run map:from-plan -- <draft.json> [--scale <m per unit>] [--out <folder>] [--name <name>]`.
Output goes to `devpost/maps/` by default: `<name>.map.json` and `<name>.svg`.

## Requirements

### Requirement: A valid map from a draft
The tool SHALL build the map from the draft's floors, points, corridors, links, entrance and
destination, check it with `parseMap`, and require a Walk route from the entrance to the destination.
Plan units become metres by the scale (`--scale` or the draft's `scale`). Floors without a `height` are
4 m apart. Corridors stay on one floor; links (lift, stairs, escalator, ramp) join two different
floors. A ramp is at least 12 times its rise long, stairs and escalators 1.2 times the straight line,
a lift at least its rise.

#### Scenario: MP1 The sample clinic
- **GIVEN** the sample clinic draft
- **THEN** the map parses, has 2 floors, start "door" (a sign), room201 at 4 m, and a lift edge
- **AND** doubling the scale doubles the edge lengths
- Verified by: the sample clinic draft makes a map parseMap accepts; the scale turns plan units into metres (Node, map-from-plan.test.ts) | none (tool, no Lens scenario)

### Requirement: Step-Free honesty
Step-Free SHALL cross floors only through a lift or ramp. When a room has no Step-Free route, the
tool SHALL still build the map (the route is "ask staff") and warn, naming the room.

#### Scenario: MP2 No lift
- **WHEN** the draft's only link is stairs
- **THEN** Walk routes, Step-Free asks staff, and a warning names the room
- Verified by: Step-Free crosses floors only through a lift or ramp (Node) | none (tool)

### Requirement: Clear errors, nothing written
A missing entrance, scale or floor, an unknown point, a duplicate id, an unknown kind, a cross-floor
corridor, a same-floor link, or a room no one can reach SHALL each give an error that says what to
fix. A broken draft writes no files and exits 1.

#### Scenario: MP3 Broken drafts
- **THEN** each broken draft gets its message ("No entrance", "No scale", "cannot be reached", "use \"links\"", ...) and no file is written
- Verified by: a room nobody can walk to is named, with what to fix; a missing entrance, scale, floor or bad corridor each give a clear error; the command writes the map and the SVG, and writes nothing for a broken draft (Node) | none (tool)

## Not tested

- Names and positions are a guess from the plan until someone walks it (the tool prints that
  reminder). Reading the photos is the agent's job and is not tested.
- The result is a file in `devpost/maps/`; getting it into the Lens (`src/core/data`, the gist) is a
  separate manual step.
