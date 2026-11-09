# Specs index and traceability

Capabilities of "Find Your Way Inside" (see `../project.md` for context and conventions).

| Capability | Spec |
|---|---|
| Map file format and validation | [map-format/spec.md](map-format/spec.md) |
| Map download, timeout, fallback, badge source | [map-loading/spec.md](map-loading/spec.md) |
| Shortest routes, off-route re-planning | [routing/spec.md](routing/spec.md) |
| Mode choice, simulated sign scan, phases | [trip-flow/spec.md](trip-flow/spec.md) |
| Floor line look, 10 m window, corners, swing | [route-line/spec.md](route-line/spec.md) |
| Turn arrow when the next turn is out of view | [turn-guidance/spec.md](turn-guidance/spec.md) |
| Lift / escalator / stairs / ramp rides, proximity | [level-changes/spec.md](level-changes/spec.md) |
| Gate / room change | [destination-change/spec.md](destination-change/spec.md) |
| Lift out of service, no-route fallback | [connection-closure/spec.md](connection-closure/spec.md) |
| Arrival within 3 m | [arrival/spec.md](arrival/spec.md) |
| Notice card, chime, map badge | [notices-and-hud/spec.md](notices-and-hud/spec.md) |
| Demo controls: event, restart, map switch | [demo-controls/spec.md](demo-controls/spec.md) |
| Airport, hospital, campus, room maps; stand-in | [sample-maps/spec.md](sample-maps/spec.md) |
| Step-Free rules, assistance point, seated height | [accessibility/spec.md](accessibility/spec.md) |
| Distance pill, floor badge, floor-change cue, line on your floor | [floors-and-distance/spec.md](floors-and-distance/spec.md) |
| Companion on/off, any model, leads/waits/collects | [companion/spec.md](companion/spec.md) |
| Place icons, interests, pointing, Go here? | [places/spec.md](places/spec.md) |
| Play while you wait: Hop and catch | [play/spec.md](play/spec.md) |
| Multi-stop trips (mall) | [multi-stop/spec.md](multi-stop/spec.md) |
| A* beside Dijkstra | [route-search/spec.md](route-search/spec.md) |
| Learn this place (mapping by walking) | [mapping-mode/spec.md](mapping-mode/spec.md) |
| Peek ahead, the mini mall, See map | [peek-ahead/spec.md](peek-ahead/spec.md) |
| Untrusted maps, floors, edge values, tools | [hardening/spec.md](hardening/spec.md) |
| Free walk: dots, offers, companion with no route | [free-walk/spec.md](free-walk/spec.md) |
| Map builder: walk, floors, Mark shop, upload | [map-builder/spec.md](map-builder/spec.md) |
| Go to a place: Say it, Talk, Where to? list and map | [go-to-a-place/spec.md](go-to-a-place/spec.md) |
| Tour of the shops your picks match | [tour/spec.md](tour/spec.md) |
| Seated play and catch by hand | [seated-and-hand-play/spec.md](seated-and-hand-play/spec.md) |
| Floor-plan draft to map (`npm run map:from-plan`) | [map-from-plan/spec.md](map-from-plan/spec.md) |
| Solid walkable backdrop in Lens Studio; companion models | [preview-backdrop/spec.md](preview-backdrop/spec.md) |
| Demo video: smooth camera, voice-over, edit under 3 minutes, demo 2 on one floor | [demo-video/spec.md](demo-video/spec.md) |

## Traceability

Status: **Pass (auto)** = covered by a passing Node test and/or LEAF scenario (Node 630 tests, all passing / 0 todo;
LEAF scenarios listed in `devpost/SCENARIOS.md`); **Partial** = logic tested but
part of the behaviour only manual or untested; **Manual** = checked by hand in the preview only;
**Gap** = no test.

| ID | Scenario | Spec | Node test(s) | LEAF | Status |
|---|---|---|---|---|---|
| S1 | Walk sign → B12 shortest, escalator | routing | S1 Walk: sign at entrance to B12…; S1 Walk route is the shortest possible… | dc1-scan-sign-line-appears, dc2-walk-escalator-corners-arrow, rule-walk-is-shortest | Pass (auto) |
| S2 | Step-Free avoids stairs/escalators, uses lift | accessibility, sample-maps | S2 Step-Free: same start and gate uses a lift…; S2 Step-Free never uses stairs or escalators… | dc3-stepfree-seated-lift-reroute, rule-stepfree-no-stairs-escalator | Pass (auto) |
| S3 | Switch mode mid-route (router logic) / not offered in the Lens | routing, trip-flow | S3 logic: switching mode mid-route… | — | Partial (router logic tested; Lens mode lock untested) |
| S4 | Gate change B12 → C3 while walking | destination-change | S4 Gate change B12 -> C3 while walking… | dc4-gate-change-stairs-and-ramp | Pass (auto) |
| S5 | Lift 1 out in Step-Free → Lift 2 | connection-closure | S5 Lift out in Step-Free… | dc3-stepfree-seated-lift-reroute | Pass (auto) |
| S6 | Arrival within 3 m, card text | arrival | S6 Arrival… | dc5-arrival-card (+ dc2, dc3) | Pass (auto) |
| S7 | Off route > 5 m re-routes from nearest node | routing | S7 Off route… | dc2-walk-escalator-corners-arrow | Pass (auto) |
| S7b | Off route does not re-trigger every frame | routing | S7b Off route: staying off the line… | — | Pass (auto, Node only) |
| S7c | Nearest node on own level | routing | S7c Off route: the nearest node is on the traveller's own level… | dc2-walk-escalator-corners-arrow | Pass (auto) |
| S8 | Turn arrow when next turn out of view | turn-guidance | turn arrow: shows only when…; S8 on the airport… | dc2-walk-escalator-corners-arrow | Pass (auto) |
| S9 | Map download works, "online map" | map-loading | S9/E1 logic ×2; S9 default URL; S9 real download (public gist) | — | Pass (auto); badge by eye |
| E1 | Download fails / > 5 s → offline map | map-loading | E1 logic ×2; S9/E1 logic: a valid download… | dc1-scan-sign-line-appears | Pass (auto) |
| E2 | Invalid map.json → "Map couldn't load" | map-loading, map-format | E2 Invalid map.json…; E2 logic…; E2 parseMap names… | e2-broken-map-fallback | Pass (auto) |
| E3 | No step-free route → assistance point | connection-closure, accessibility | E3 No step-free route…; E3 Both lifts closed…; hospital: both lifts out…; C5 noticeFor… | e3-no-step-free-ask-staff, e3b-no-step-free-at-scan | Pass (auto) |
| E4 | Destination = current position | arrival | E4 Destination = current position… | e4-already-at-destination | Pass (auto) |
| E5 | Unknown sign id | trip-flow, routing | E5 Unknown sign id… | e5-unknown-sign | Pass (auto) |
| E6 | Seated height readable | accessibility | C1 ride reach…; C1 level snap… | dc3-stepfree-seated-lift-reroute, dc3b-seated-lift-ride | Partial (geometry auto; readability manual, feel unproven) |
| DC1 | Scanning the start | trip-flow | S1… | dc1-scan-sign-line-appears | Pass (auto) |
| DC2 | Walking through the building | route-line | S1… | dc2-walk-escalator-corners-arrow | Pass (auto) |
| DC3 | Wheelchair at seated height, Lift 1 → Lift 2 | accessibility | S2…; S5…; C1… | dc3-stepfree-seated-lift-reroute, dc3b-seated-lift-ride | Pass (auto) |
| DC4 | Gate change: stairs (Walk) / ramp (Step-Free) | destination-change | S4… | dc4-gate-change-stairs-and-ramp | Pass (auto) |
| DC5 | Arrival card within 3 m | arrival | S6… | dc5-arrival-card | Pass (auto) |
| R1 | Step-Free rule on all maps and closures | accessibility | <map>: Walk is the shortest route and Step-Free never uses…; <map>: closing each closable connection… | rule-stepfree-no-stairs-escalator | Pass (auto) |
| R2 | Walk is shortest on all maps | routing | S1 Walk route is the shortest possible…; <map>: Walk is the shortest route… | rule-walk-is-shortest | Pass (auto) |
| R3 | Map files valid, consistent, Lens copies identical | map-format | <map>: map file is valid…; <map>: edges are at least…; map.json: every edge is at least… | — | Pass (auto) |
| R4 | Hospital routes | sample-maps | hospital: … (4 tests) | map-switch-cycle (load only) | Pass (auto) |
| R5 | Campus routes | sample-maps | campus: … (5 tests) | map-switch-cycle (load only) | Pass (auto) |
| R6 | Room: short line on the real floor | sample-maps | room: short route on the room floor… | map-switch-cycle (load only) | Pass (auto) |
| R7 | Map switch cycles all maps | demo-controls | — | map-switch-cycle | Pass (auto) |
| R8 | Restart resets cleanly | demo-controls | — | restart-resets-trip | Pass (auto) |
| R9 | Lens maths; router/geometry copies identical | route-line | geometry.test.ts (9 tests) | — | Pass (auto) |
| X1 | Well-formed map parses | map-format | airport: map file is valid… | rule-stepfree-no-stairs-escalator | Pass (auto) |
| X2 | Closed edge in map.json respected | map-format | A closed edge in map.json is respected | — | Pass (auto) |
| X3 | Escalators one-way | map-format | Escalators are one-way… | rule-walk-is-shortest | Pass (auto) |
| X4 | New map = new building, no code change | map-format | hospital: edges are at least…; place… | map-switch-cycle | Partial (look manual) |
| X5 | Built-in maps always parse | map-loading | <map>: map file is valid… | rule-stepfree-no-stairs-escalator | Pass (auto) |
| X6 | Late load after switch/restart ignored | map-loading | — | c12-stale-load-and-closures-kept | Pass (auto) |
| X7 | Unknown start is an error | routing | E5 Unknown sign id… | e5-unknown-sign | Pass (auto) |
| X8 | Walk no-route message | routing | C5 noticeFor… | e3-no-step-free-ask-staff (Step-Free text) | Pass (auto) |
| X9 | Router Lens copy identical | routing | router.ts and its Lens copy are identical | — | Pass (auto) |
| X10 | Phases advance in order | trip-flow | — | dc1-scan-sign-line-appears | Pass (auto) |
| X11 | Mode choice hides panel, shows sign | trip-flow | — | dc1-scan-sign-line-appears, map-switch-cycle | Pass (auto) |
| X12 | Sign 2.5 m ahead in open floor | trip-flow | — | — | Manual |
| X13 | Line 1 cm above floor | route-line | — | dc1-scan-sign-line-appears, dc3-stepfree-seated-lift-reroute | Pass (auto) |
| X14 | Line colour/width/glow | route-line | — | — | Manual |
| X15 | Line clipped to 10 m | route-line | Floor line is clipped to 10 m ahead of the traveller | — | Pass (auto) |
| X16 | Line follows turn, stops at gate | route-line | Floor line follows a turn and stops at the gate | — | Pass (auto) |
| X17 | Line fades at far end | route-line | — | — | Manual |
| X18 | Line stops at lift foot | route-line | the drawn line stops at the foot of a lift… | dc3-stepfree-seated-lift-reroute | Pass (auto) |
| X19 | Line swings on re-route | route-line | — | dc4-gate-change-stairs-and-ramp | Pass (auto) |
| X20 | Next turn = first bend ≥ 25° | turn-guidance | next turn…; headings…; yawTo… | — | Pass (auto) |
| X21 | No arrow for a turn under the traveller | turn-guidance | turn arrow: shows only when… | — | Pass (auto) |
| X22 | Arrow at lower edge, pointing to the turn | turn-guidance | — | — | Manual |
| X23 | Ride buttons from the map | level-changes | — | dc2, dc3 (escalator, lifts) | Partial (others manual) |
| X24 | No escalator button at the top | level-changes | Escalators are one-way… | — | Partial (missing top button untested) |
| X25 | Ride refused away from escalator | level-changes | — | dc2-walk-escalator-corners-arrow | Pass (auto; card text not asserted) |
| X26 | Lift button 2.5 m reach (horizontal, same level) | level-changes | C1 ride reach… | dc3b-seated-lift-ride, dc3-stepfree-seated-lift-reroute | Pass (auto) |
| X27 | Closed lift's button refuses | level-changes | — | dc3-stepfree-seated-lift-reroute | Pass (auto) |
| X28 | Escalator ride carries up 6 m, no re-plan | level-changes | — | dc2-walk-escalator-corners-arrow | Pass (auto) |
| X29 | Lift ride continues route from top | level-changes | — | dc3-stepfree-seated-lift-reroute | Pass (auto) |
| X30 | Ride confirmation card | level-changes | Spec gap: the ride card names the level once | dc3-stepfree-seated-lift-reroute, dc3b-seated-lift-ride | Pass (auto) |
| X31 | Gate change before scan | destination-change | — | dest-change-before-scan-sticks | Pass (auto) |
| X32 | Destination change after arrival resumes nav | destination-change | — | — | Gap |
| X33 | Room change in hospital/campus/room | destination-change | hospital: room change…; campus: room change…; room: short route… | — | Pass (auto, Node); Lens manual |
| X34 | Red sign on Lift 1 | connection-closure | — | dc3-stepfree-seated-lift-reroute | Pass (auto; look manual) |
| X35 | Reopening restores route | connection-closure | S5 Lift out in Step-Free… | restart-resets-trip | Pass (auto) |
| X36 | Closure before scan kept | connection-closure | — | c12-stale-load-and-closures-kept | Pass (auto) |
| X37 | Stays arrived within 5 m | arrival | S6 Arrival… | — | Pass (auto, Node) |
| X38 | Walking away resumes navigation | arrival | S6b after arriving, 5.5 m from B12… | — | Pass (auto, Node) |
| X39 | Hospital arrival text | arrival | — | — | Manual |
| X40 | Gate-change card top-right | notices-and-hud | — | dc4-gate-change-stairs-and-ramp (text) | Partial (position manual) |
| X41 | Card hides after ~5 s | notices-and-hud | — | closure-card-signs-and-5s-hide | Pass (auto) |
| X42 | Chime with gate-change card | notices-and-hud | — | — | Manual |
| X43 | Badge after scan | notices-and-hud | — | dc1, e2-broken-map-fallback, restart-resets-trip | Pass (auto) |
| X44 | Demo controls follow the user | demo-controls | — | — | Manual |
| X45 | Gate change from Demo controls | demo-controls | — | dc4-gate-change-stairs-and-ramp, restart-resets-trip | Pass (auto) |
| X46 | Stand-in labelled and generated | sample-maps | — | — | Manual |
| X47 | Readable light UI, hover highlight | accessibility | — | — | Manual |
| X48 | Small space sets its own distances (room) | arrival | C2 tripSettings…; C2 room ×2 | — | Pass (auto, Node) |
| X49 | Start node is the local origin at any height | route-line | C6 map frame… | — | Pass (auto) |
| E2b | Place block and events validated on parse | map-format | E2b parseMap rejects…; <map>: edges are at least… (validateMap) | e2-broken-map-fallback | Pass (auto) |
| X51 | Ids are plain strings; findRoute never throws | map-format | C8 ×3 | — | Pass (auto) |
| X52 | Arrival needs the same level | arrival | C9 arrival needs the same level… | — | Pass (auto, Node) |
| X53 | Connection-only change is a change | routing | C10 setProfile reports a change… | — | Pass (auto, Node) |
| X54 | Ask-staff guidance tracked; arrival at assistance | routing, arrival | C11 ×2 | e3-no-step-free-ask-staff | Pass (auto) |
| X55 | Sitting down keeps the floor; seated ride | accessibility | C1 ×2 | dc3b-seated-lift-ride, dc3-stepfree-seated-lift-reroute | Pass (auto) |
| X56 | Closure card "Re-routing" only if used | connection-closure | C13 closure card… | closure-card-signs-and-5s-hide | Pass (auto) |
| X57 | Every lift has a red sign at ~1.2 m | connection-closure | Spec gap: every closable lift… | closure-card-signs-and-5s-hide | Pass (auto) |
| X58 | Rebuild for a downloaded map keeps closures | map-loading | — | c12-stale-load-and-closures-kept, dest-change-before-scan-sticks | Pass (auto) |
| X59 | One notice after every route change | notices-and-hud | C5 noticeFor… | e3b-no-step-free-at-scan | Pass (auto) |
| X60 | Looking straight down keeps the heading | trip-flow | C13 yaw… | — | Pass (auto, Node) |
| X61 | Optional map fields typed | map-format | (compile) | (compile) | Pass (review) |
| X62 | Lens copies kept identical by tooling | routing | A1 ×3; A4 no dead helpers… | — | Pass (auto) |
| S10–S14 | Pill, floor badge, cue, line on your floor | floors-and-distance | S10–S14 | fl1-pill-shows-and-counts-down, fl2-cue-post-and-badge-after-escalator | Pass (Node); LEAF passing |
| A1–A14 | Jointed, animated, see-through companions | companion | A1–A14 (anim.test.ts) | visual-rigs (by eye) | Pass (Node) |
| PB4 | "You are here" directory board in the place | preview-backdrop | — | s1-start-at-sign-controls-hidden | Pass (auto) |
| FW7 | Free walk demo button, in the mall | demo-controls | D20 | fw1-free-walk-demo | Pass (auto) |
| MB5 | Map builder demo with the mall behind it | map-builder | — | mb5-builder-in-the-mall | Pass (auto) |
| H1–H36 | Hostile maps, floors, closures, marked shops, edge values | hardening | H1–H36 (hardening.test.ts) | — | Pass (Node) |
| T1–T13 | Tools, ignored keys, nothing private tracked | hardening | T1–T13 (hardening.test.ts) | — | Pass (Node) |
| E1b | End trip, without demo controls | hardening | — | e1b-end-trip | Pass (auto) |
| PM1–PM16 | The mini mall | peek-ahead | PM1–PM16 (peek-place.test.ts) | pk1-peek-ahead-shows-and-hides | Pass (auto) |
| BM1–BM5 | The board's map | peek-ahead | BM1–BM5 (peek-place.test.ts) | s1-start-at-sign-controls-hidden | Pass (auto) |
| P1–P7, Q7, Q8, Q8b | Companion on/off, any model, pick before you walk, leads/waits/collects | companion | P1–P7, Q8b | p1-companion-toggle-and-models, companion-pick-before-walk, p3-companion-waits-at-escalator | Pass (Node); LEAF passing |
| Q1–Q6 | Places, interests, pointing, Go here? | places | Q1–Q6 | q4-points-at-interests-and-sponsored | Pass (Node); LEAF passing |
| G1–G9, P8–P10 | Hop and catch | play | G1–G9, P8, P9 | g1-hop-jump-bump-restart, pc1-throw-and-fetch-any-model | Pass (Node); LEAF passing |
| T1–T4 | Multi-stop mall trip | multi-stop | T1–T4 | t1-mall-multi-stop | Pass (Node); LEAF passing |
| A1–A3 | A* equals Dijkstra | route-search | A1–A3 | — | Pass (auto, Node) |
| M1–M5 | Learn this place | mapping-mode | M1–M5 | m5-learn-this-place-save-route | Pass (Node); LEAF passing |
| Z1–Z3 | Peek ahead | peek-ahead | Z3 | pk1-peek-ahead-shows-and-hides | Pass (Node); LEAF passing |
| H1–H2 | Start at the sign; demo controls hidden | trip-flow, demo-controls | — | s1-start-at-sign-controls-hidden | Pass (Node); LEAF passing |
| FW1 | Three modes after the scan; checkbox list from the map | free-walk | I1 (freewalk.test.ts) | b3-modes-scan-first-preset | Pass (Node); LEAF passing |
| FW2, FW3 | Dot on looking at a front; offer list, at most 3 rows | free-walk | L1–L3, D1–D3, O1, O2 | b3-dc5-companion-off-dots | Pass (Node); LEAF passing |
| FW4 | Companion ahead of you, runs around on a turn | free-walk | A1, A2, C5–C7 | b3-dc3-turn-around | Pass (Node); LEAF passing |
| FW5 | Stops only at matching shops, once per walk | free-walk | C1–C4 | b3-dc2-companion-stops-at-matches | Pass (Node); LEAF passing |
| FW6 | Other-floor bubble and list | free-walk | F1–F3, H1, H1b, H2, H3 | b3-dc4-another-floor | Pass (Node); LEAF passing |
| MB1–MB4 | Map builder: path, floors, Mark shop, upload | map-builder | B1–B16, U1–U3 (builder.test.ts) | b3-dc1-map-builder-two-floors | Pass (Node); LEAF passing; `map:publish` write untested |
| GP1, GP3 | Say it; Where to? list | go-to-a-place | G1–G3 (freewalk.test.ts) | b3-dc6-go-to-a-place | Pass (Node); LEAF passing |
| GP2 | Talk: words reach the matcher | go-to-a-place | G1 (matcher only) | v1-voice-reaches-the-matcher | Partial (words fed in by a test hook; real mic and ASR not tested) |
| GP4 | Where to? as a map, floor by floor | go-to-a-place | U8–U13 (tour.test.ts) | pm1-pick-a-place-on-the-map | Pass (Node); LEAF passing |
| TR1, TR2 | Tour: matching shops, stop by stop | tour | U1–U7 (tour.test.ts) | tr1-tour-stop-by-stop | Pass (Node); LEAF passing |
| SP1–SP3 | Seated play: detect, close short lane, card ends it | seated-and-hand-play | S1–S9 (play.test.ts) | sp1-seated-play | Pass (Node); LEAF passing |
| GT1 | Catch by hand: grab, swing, release | seated-and-hand-play | G1–G4 (play.test.ts, releaseVelocity) | gt1-grab-and-throw | Pass (Node); LEAF passing; hand feel unproven |
| MP1–MP3 | Floor-plan draft to map | map-from-plan | map-from-plan.test.ts (6 tests) | — | Pass (auto, Node) |
| PB1, PB2 | Solid backdrop and wall shops, Lens Studio only | preview-backdrop | — | bg1-backdrop-solid-in-preview | LEAF passing; shop look manual |
| PB3 | Companion model or box fallback | preview-backdrop | — | p1-companion-toggle-and-models, pc1-throw-and-fetch-any-model | Partial (look manual) |

`<map>` = airport, hospital, campus, room (one Node test each). The LEAF `visual-*` ids are
screenshot set-ups, not tests.
