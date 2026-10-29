# Map Format Specification

## Purpose

Defines the JSON route-graph format that describes any place (airport, hospital, campus, room) so
that the same router, UI and stand-in builder work for every building with no code change, and
how untrusted map text is validated.

## Requirements

### Requirement: Route graph structure
A map file SHALL be a JSON object with `version` (number), optional `name` and `units` ("m"),
a non-empty `nodes` array and an `edges` array. Positions SHALL be in metres with `x` east,
`y` up and `z` north.

Each node SHALL have a unique non-empty string `id`, finite numeric `x`, `y`, `z`, and a string
`kind`. Recognised node kinds are `sign` (a "you are here" start sign), `junction`, `lift`,
`assistance` (an assistance point / staff desk) and `destination` (legacy `gate` is also accepted
as a destination). Nodes MAY carry `label`, `type` (e.g. "gate", "ward", "lecture hall", "room"),
`arrivalCard` (the arrival card text) and `icon`.

Each edge SHALL reference two existing nodes in `from` and `to`, have a `kind` in
`walk | stairs | escalator | lift | ramp`, a positive numeric `length` in metres, and a boolean
`open`. Edges MAY carry an `id` (required for edges that can be closed, e.g. `lift1`).

#### Scenario: X1 A well-formed bundled map parses
- **GIVEN** the bundled airport map `src/core/data/map.json`
- **WHEN** it is passed to `parseMap`
- **THEN** the result is `ok: true` with 17 nodes and 20 edges
- Verified by: airport: map file is valid and its Lens copy (Assets/Maps/airport.json) is identical | rule-stepfree-no-stairs-escalator (parses every bundled map)

### Requirement: Readable validation errors
`parseMap` SHALL never throw on bad input. It SHALL return `ok: false` with a readable error that
names the problem: "map.json is not valid JSON", "map.json must be an object",
"map.json has no nodes", "map.json has no edges", "a node is missing its id",
"duplicate node id <id>", "node <id> has a bad <axis>", "node <id> has no kind",
"edge <from> -> <to> points at an unknown node", "edge <from> -> <to> has unknown kind <kind>",
"edge <from> -> <to> needs a positive length", "edge <from> -> <to> needs open true/false".

#### Scenario: E2 parseMap names what is wrong with a broken map file
- **WHEN** `parseMap` receives text that is not JSON, has no nodes, a duplicate id, a non-numeric
  coordinate, an edge to an unknown node, an unknown edge kind, a non-positive length or a
  missing `open`
- **THEN** it returns `ok: false` with an error naming that problem
- **AND** it does not throw
- Verified by: E2 parseMap names what is wrong with a broken map file | none

### Requirement: Closed edges in the file are respected
An edge with `open: false` in the map file SHALL never be used by the router, in either profile.

#### Scenario: X2 A closed edge in map.json is respected
- **GIVEN** a map in which an edge is stored with `open: false`
- **WHEN** a route is planned across that part of the graph
- **THEN** the route does not use that edge
- Verified by: A closed edge in map.json is respected | none

### Requirement: Escalators are one-way
Edges of kind `escalator` SHALL be traversable only from `from` to `to`. All other edge kinds
SHALL be two-way.

#### Scenario: X3 Escalators are one-way: going down uses the stairs on Walk
- **GIVEN** the airport escalator `escFoot → escTop` (up only)
- **WHEN** a Walk route is planned from `escTop` to `escFoot`
- **THEN** the route is `escTop > concourse > stairsTop > stairsFoot > hall > escFoot` (42.2 m)
  and uses the stairs, not the escalator
- Verified by: Escalators are one-way: going down uses the stairs on Walk | rule-walk-is-shortest (brute force honours one-way escalators)

### Requirement: Map files are self-consistent
Every edge `length` SHALL be at least the straight-line 3-D distance between its end nodes
(to 0.1 m). The `place` block's `start`, `destination`, event `to`/`edge`/`at` references and all
destinations SHALL point at real nodes/edges.

#### Scenario: R3 Map files valid, self-consistent, and Lens copies identical
- **GIVEN** each bundled map (airport, hospital, campus, room)
- **WHEN** the map tests run
- **THEN** each map parses, every edge is at least its straight-line length, every place/event
  reference resolves
- **AND** each `src/core/data` file is byte-identical to its Lens copy in `Assets/Maps/`
- Verified by: airport/hospital/campus/room: map file is valid and its Lens copy (Assets/Maps/<map>.json) is identical; airport/hospital/campus/room: edges are at least the straight-line distance (to 0.1 m); place, events and destinations point at real nodes; map.json: every edge is at least as long as the straight line; key nodes exist | none

### Requirement: Place block carries everything building-specific
A map MAY carry a `place` object; the Lens SHALL read from it, with defaults when absent:
`title` (default map `name` or "Map"), `standInLabel` (default "Stand-in building"),
`standInModel` (default true), `start` (default: first `sign` node), `destination` (default: first
destination node), `levels` (`[{y, name}]`, default `[{y: 0, name: "Ground"}]`), `footprint`,
`buildings` (campus-style footprints), `scanSign` (`title` default "You are here", `button`
default "Scan sign", `hint` default "on real Specs: look at the sign"), and `events`.
Events SHALL be generic: `destinationChanged` (`to`, `button`, `card`) and `connectionClosed`
(`edge`, `at`, `sign`, `card`). No building-specific literal SHALL live in code.

#### Scenario: X4 A new map gives a new building with no code change
- **GIVEN** the hospital map with `place.events` `roomChange` (to `xray`) and `liftAOut` (edge `liftA`)
- **WHEN** the Lens switches to it
- **THEN** the stand-in, signs, demo event button ("Room change Ward 4 → X-ray") and red sign
  ("Lift A out of service") come from the map
- Verified by: hospital: edges are at least the straight-line distance (to 0.1 m); place, events and destinations point at real nodes | map-switch-cycle; manual (preview)

#### Scenario: E2b Place block and events are checked when a map is parsed
- **GIVEN** a map whose `place.start` is not a sign, whose destination or an event points at an
  unknown node or edge, whose lift has no id, or whose `version` is not 1
- **WHEN** it is parsed (bundled or downloaded)
- **THEN** `parseMap` rejects it with a message naming the problem (`validateMap`), so a
  downloaded map with a bad place block falls back to the built-in map
- Verified by: E2b parseMap rejects place/event refs to unknown nodes/edges and unsupported version; <map>: edges are at least the straight-line distance… (calls validateMap on every bundled map)

#### Scenario: X51 Ids are plain strings
- **GIVEN** a map with a node called "constructor", or an edge pointing at "toString"
- **WHEN** it is parsed and routed
- **THEN** "constructor" is an ordinary node with a route; the edge to the missing "toString" is
  rejected; and `findRoute` never throws for any map `parseMap` accepts
- Verified by: C8 parseMap rejects an edge to 'toString'; C8 parseMap accepts a node called 'constructor'; C8 findRoute never throws for any map parseMap accepts

#### Scenario: X61 Optional fields are typed
- **GIVEN** `MapNode` (type, code, icon, arrivalCard), `MapEdge` (outdoor) and `MapData.place`
  (`MapPlace`: levels, events, footprint, buildings, arrivalRadius, offRouteDistance, rideReach)
- **THEN** the router, the place module and the Lens read them without `any` casts
- Verified by: review (code); all Node tests and LEAF scenarios compile against the types

## Known gaps

- The brief lists node kinds `sign, junction, lift, gate, assistance`; the bundled maps use the
  generic `destination` kind with `type: "gate"` (as the brief's "Any building" section asks).
  The Lens accepts both `destination` and `gate`.
- **Fixed (review round):** `parseMap` validates the `place` block and the version (E2b) and uses
  prototype-free id tables (X51).
