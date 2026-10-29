# Project: Find Your Way Inside

## Purpose

"Find Your Way Inside" is a Lens for Snap SPECS that guides a traveller through an indoor (or
mixed indoor/outdoor) place with a semi-transparent blue line on the floor. The traveller picks
**Walk** or **Step-Free (wheelchair)** once, "scans" the "you are here" sign at the entrance, and
the line leads them to their destination (an airport gate in the demo). The line re-routes when
the destination changes (gate change B12 → C3), when a connection closes (a lift out of service),
or when the traveller walks off it, and stops with an arrival card within 3 m of the destination.
Step-Free routes never use stairs or escalators.

The design intent is in `devpost/design-brief.md` (status: approved). Approved scenarios and
done criteria are in `devpost/SCENARIOS.md`; how to try it by hand is in `devpost/PREVIEW-GUIDE.md`.

## Context

- Built for the **Learn AR with SPECS** hackathon (https://learn-specs.devpost.com).
- **Preview-only.** No SPECS device is available. Everything is demonstrated and tested in Lens
  Studio's Interactive Preview (device SPECS 27, room "Sunlit Room"): WASD to move, Q/E for
  down/up (seated height), click = pinch.
- The "you are here" sign scan is **simulated** by a pinch button on the sign ("on real Specs:
  look at the sign"). Real sign recognition, real positioning and real airports are out of scope.
- The building is a **stand-in** box model generated from the map file and labelled as such.
- Anything the preview cannot judge (comfort, readability on glasses, real hand tracking, real
  floor detection) is labelled "feel unproven" and is not specified as verified.

## Tech stack

- Lens Studio (SPECS target), TypeScript components extending `BaseScriptComponent`.
- Spectacles Interaction Kit (SIK) and Spectacles UI Kit for all pinchable controls (so they work
  with the mouse in Interactive Preview and with LEAF).
- `InternetModule.fetch` for the map download; `WorldQueryModule` hit test for floor detection.
- Pure route engine in plain TypeScript (no Lens APIs): `src/core/router.ts`,
  `src/core/geometry.ts`, maps in `src/core/data/*.json`.
- Node (>= 22.18) built-in test runner: `npm test` runs `src/core/tests/*.test.ts`.
- LEAF (Lens Studio in-Lens test framework): scenarios in `Assets/Tests/`, registered in
  `Assets/Tests/FindYourWayLeafIndex.ts`.

## Architecture (where behaviour lives)

| Area | File(s) |
|---|---|
| Routing, map parsing, map download with timeout, Navigator (re-route, arrival, off-route) | `src/core/router.ts` (Lens copy `Assets/Scripts/FindYourWayRouter.ts`) |
| Guidance maths (headings, next turn, turn-arrow visibility, metres↔cm, line stops at a lift) | `src/core/geometry.ts` (Lens copy `Assets/Scripts/FindYourWayGeometry.ts`) |
| Bundled maps, place info read from the map, map frame | `Assets/Scripts/FindYourWayMapLibrary.ts`, `Assets/Maps/*.json` |
| Trip orchestration (phases, rides, closures, destination change, per-frame update, test hooks) | `Assets/Scripts/FindYourWayMain.ts` |
| Floor line rendering | `Assets/Scripts/FindYourWayRouteLine.ts` |
| Turn arrow | `Assets/Scripts/FindYourWayTurnArrow.ts` |
| Stand-in building | `Assets/Scripts/FindYourWayStandIn.ts` |
| UI views (mode panel, building signs/buttons, HUD card + badge, arrival card, demo controls) | `Assets/Scripts/FindYourWay*UI.ts` |

## Conventions

- **Units.** Map files are in **metres**: `x` east, `y` up, `z` north. The Lens works in
  **centimetres** (Lens Studio world units). Conversion is `mapToLocalCm` / `localCmToMap` in
  `geometry.ts`.
- **Orientation.** Building-local frame: the start sign node is the origin; **map north = Lens −Z**
  (straight ahead of the user at the sign, since an identity camera faces −Z); `y` up.
  Headings are degrees clockwise from map north.
- **Height on a level.** "Nearest node" uses `levelDistance` = horizontal distance + 5 × height
  difference, so a traveller snaps to nodes on their own level.
- **Duplicated core.** `router.ts` and `geometry.ts` are duplicated byte-for-byte into
  `Assets/Scripts/FindYourWayRouter.ts` and `FindYourWayGeometry.ts`; maps are duplicated from
  `src/core/data/` into `Assets/Maps/` (`map.json` → `airport.json`). Node tests assert the copies
  are identical. Edit `src/core` first, then copy.
- **Map-driven.** Everything building-specific (nodes, edges, labels, destinations, levels, card
  texts, demo events, stand-in model) comes from the map file, never from code.
- **Constants** (router.ts): `ARRIVAL_RADIUS = 3` m, `OFF_ROUTE_DISTANCE = 5` m,
  `DOWNLOAD_TIMEOUT_MS = 5000`, `LEVEL_PENALTY = 5`. Lens tunables (FindYourWayMain inputs):
  `lineAheadM = 10`, `halfViewDeg = 16`, `eyeHeightCm = 180`, `signOffset = (0,0,-250)` cm.
- **Spec language.** Requirements use SHALL/MUST. Each scenario title carries a traceability ID.

## Scenario IDs

- `S1`–`S9`, `E1`–`E6`, `DC1`–`DC5`: from `devpost/SCENARIOS.md` and the design brief.
- `R1`–`R9`: the "Other checks" table of `devpost/SCENARIOS.md`, numbered in table order
  (R1 Step-Free rule, R2 Walk shortest, R3 map files valid, R4 hospital, R5 campus, R6 room,
  R7 map switch, R8 restart, R9 Lens maths).
- `X1`…: behaviour found in the code or brief that SCENARIOS.md does not list (proximity
  refusals, one-way escalators, line clipping, card timing, …).

## How tests map to specs

- Every scenario ends with `- Verified by: <Node test name(s)> | <LEAF scenario id>`, or
  `manual (preview)` (checked by hand per `devpost/PREVIEW-GUIDE.md` section 9c), or
  `none (gap)`.
- **Node tests** (`npm test`) verify pure logic: routing rules, map validity, download fallback,
  Navigator behaviour, guidance maths. Node test names begin with the scenario ID where one exists.
- **LEAF scenarios** (`Assets/Tests/Fyw*.ts`) run in the live Lens in the Preview: they pinch the
  real SIK/UIKit buttons by SceneObject name and simulate walking, seated height and the scanned
  sign through test hooks on `FindYourWayMain` (`debugSetPose`, `debugSetDownloadOverride`,
  `debugSetStartOverride`, `debugSetDestinationOverride`, `debugCloseEdge`). Each prints
  `[FYW-LEAF] RESULT <id> PASSED|FAILED`. The `visual-*` ids are screenshot set-ups, not tests.
- The full traceability table is in `openspec/specs/README.md`.

## Change workflow

Future behaviour changes follow the OpenSpec flow: propose under `openspec/changes/<change-id>/`
(`proposal.md`, `tasks.md`, delta specs), apply, then archive into `openspec/specs/`.

## Working-tree note

At the time of writing, uncommitted work in progress existed in the repo (not specified here):
a configurable map server base URL (`mapBaseUrl`, default `http://localhost:8787/`, `npm run maps`)
replacing the per-map `url`, and an autoplay demo (`src/core/demo.ts`,
`Assets/Scripts/FindYourWayDemo.ts`). See the Known gaps of `map-loading`.
