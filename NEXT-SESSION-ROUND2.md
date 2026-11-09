# Next session — Round 2 builder (left Nov 7, 2026)

Plan: `ROUND2.md` (builder checklist). Branch: `companion-polish`. Work test first (TDD), commit each finished item.

## Where it stands
- R2-1..R2-4: done.
- **R2-6 Bigger transcript: code done, commit `8f1658b`** (+ `87cb410` status note). npm test 581/581, TypeScript compiles.
  - Sizes live in `TRANSCRIPT` in `src/core/captions.ts` (Lens copy `Assets/Scripts/FindYourWayCaptions.ts`, `npm run sync`).
    Tests: CP-R2-6 and CP-R2-6b in `src/core/tests/captions.test.ts`.
  - Live captions 2x, band 40 cm, 33 characters a row, at y -11.5 (`FindYourWayHudUI.ts`).
  - "Heard: …" line 1.5x (2x would need about 5 lines in the 31 cm panel); grows to at most 3 rows
    (`setNote` in `FindYourWayModePanelUI.ts`, `setTextHeight` in `FindYourWayWidgetsUI.ts`).
  - Companion caption 2x, 100 cm wide (`FindYourWayCompanionSays.ts`).
  - **Not checked in the Preview yet** (the Preview panel was closed), so R2-6 is not ticked.
- Pushed (the SSH timeout cleared).
- **R2-7 voice-over: Node side done** (see the R2-7 note in `ROUND2.md`). npm test 590/590.
  - Lines: `src/core/narration.ts` (= the `ROUND2.md` table; test N1 checks). Clips made:
    `devpost/video/narration/00..11.wav` + `lengths.json` (git-ignored, re-make with `make-narration.py`;
    the Kokoro model and venv are in an earlier session's scratchpad `tts` folder, or download as in `make-clips.py`).
  - Mix: `node tools/voice/narration-mix.mjs <raw.mp4> <take.log> <T0 s> <out.mp4>`.
  - The take `Assets/Tests/FywDemoVideoScenario.ts` (+ `mallPetTrip(run, beforeWalk)` in `FywDemoSupport.ts`)
    now marks "talk" and the demo-2 "leg" and waits for each line. **Not compiled in Lens yet.**
- lens-studio MCP was down this session: run `/mcp` -> Reconnect.

## Nov 8 update
- v3 recorded and mixed: `devpost/video/pathpal-demos-v3.mp4` (4:25, voice-over, git-ignored). Take passed (270 s),
  mix: no missing or late lines. Raw: `demos-raw6.mp4` + `demos-raw7.mp4` (joined at offset 249.7 s) -> `demos-take6.mp4`,
  starting at T0 + 5.6 s (the preview froze ~6 s while the airport loaded); marks shifted by -5.6 s, T0 0.
- Record with the Preview tab visible; gdigrab `title=` fails if the title has `*`: save first, then start ffmpeg, then
  PreviewPanelTool refresh (a recompile did not reset the preview). The take starts ~2 min after the refresh.
- Last night's 41-min freeze at the take's start did not come back today (sp1 and visual-demos both ran fine).
- Seen in v3: during the gate change (about 1:10-1:25) the view faces a flat blue wall; fix the pose (R2-2).

## Nov 8, later: Alex's v3 review (plan in ROUND2.md "Alex's review of v3")
Done and pushed (`cbd820f`, `b87a364`, `4161355`; npm test 609/609; tests in `src/core/tests/v3-review.test.ts`):
R2-12 see-through Control tab; R2-14 pointer card "Clothes · your pick"; R2-15 Free walk asks for preferences
by voice (demo: last time Books, says "A coffee, and I'm into fashion today"); R2-17 calm companion; R2-11 food
court that looks like one (stalls, boards, tables; map unchanged because the gist test compares mall.json);
R2-18 Offline mode (LEAF `offline-mode` passes); R2-19 Hide demo controls; R2-20 See map on the left,
see-through, gate labels; R2-23 pick a place first; R2-24 all places reachable; R2-21 airport stairs contrast
(GLB re-exported). LEAF `demo-free-walk-robot` and `demo-mall-pet` pass on the new code.
**Not yet looked at in the preview:** the new food court tables (refined after the first look), See map on
the left with labels, Hide demo controls, the darker stairs. Boxes not ticked in ROUND2.md until seen.
**Left:** R2-13 smooth camera in the take (lift: stop facing the doors + dissolve in the edit; escalator:
straight on/off along its axis; café/toilet: stop 4+ m out; turn away from the toilet door before the gate
change), then R2-16 v4 under 3 minutes (narration table: demo 3 lines for voice preferences).
`Assets/Tests/FindYourWayLeafIndex.ts`: only my offline-mode lines are committed (the other session's edits stay
unstaged; stage with `git hash-object` + `git update-index` as done for `4161355`'s parent).

## Nov 8, end of session (Lens Studio quit at the end: reopen first-step, Preview 1 tab, /mcp reconnect)
- Pushed up to `452cfbc`; npm test 619/619. v4 video: `devpost/video/pathpal-demos-v4.mp4` (2:40, Alex likes
  it and the voice). Edit: `node tools/voice/narration-mix.mjs <raw> <take.log shifted> <T0 s> <out>`.
- **First:** recompile in Lens: R2-10 Lens wiring (trip flight in Main, `rerouteQuestion`) is not compiled yet.
- Then, in order: R2-30 (floor changes: walking through stairs/escalator sides, the floor line cutting through
  you going up; far shops popping in and out: check the stand-in shop meshes / camera far plane) or keep
  demo 2 on one floor; R2-25 bigger pointer card; R2-27 a short "play with the pet" moment in the video;
  R2-28 v4 fixes (crop shows a toolbar sliver: record region offset 1524,351 or crop 14 px; lift white
  frame; café stop farther out; escalator top facing a wall; Free walk brushes a vending fridge); voice-over
  talk line mentions the flight number; then re-record (save, start ffmpeg by screen region, refresh).

## Nov 8, evening
- v6: `devpost/video/pathpal-demos-v6.mp4` (2:39): flight 212 named on Talk, play moment at B14, demo 2 to the
  Bakery on one floor, toolbar cropped. Edit: `node tools/voice/narration-mix.mjs devpost/video/demos-raw10.mp4
  <take10 marks shifted -5.6 s> 37.1 out.mp4 1156:1258:20:86`. Record region: gdigrab desktop offset 1566,351
  size 1176x1344 (Lens maximized on the main 4K screen, Preview 1 tab showing).
- Pushed `55bd6be`; npm test 622/622. Still open: far shops popping in and out (not found in code: no
  distance hiding, camera far 100 m; check in the preview by hand), the mall map's fBW-fBM corridor over the up
  escalator (needs a gist map update, Alex's OK), the Free walk robot near a vending fridge.

## Do next, in order
1. `/mcp` reconnect lens-studio; recompile; fix any TS errors in `FywDemoVideoScenario.ts` / `FywDemoSupport.ts`.
2. Open the Preview panel in Lens Studio. Check:
   - the caption band fits on screen;
   - the "Heard" panel grows without covering anything;
   - the companion caption is easy to read.
   Adjust if needed, then tick R2-6 in `ROUND2.md` and commit.
3. R2-5: measure that the companion stays 7 m ahead in the new take.
4. R2-8: stills check, LEAF `visual-demos` (record the screen), save the take's `[VID]` lines from the Lens log,
   find T0 in the recording, `narration-mix.mjs` -> `devpost/video/pathpal-demos-v3.mp4`. Check the mix prints
   no "no mark for" / "late" warnings. Then tick R2-7 and R2-8.
6. R2-10 (gate change only for my flight), then R2-11 (Sushi Bar in demo 2).

## Don't touch
- The other session's uncommitted files: `Assets/Tests/Fyw*Video*.ts` (marked TEMPORARY),
  the `FindYourWayLeafIndex.ts` edits, `.gitattributes`.
- Lens scripts use CRLF line endings: edit them with the Edit tool, not raw Python string replace.
- When the test count changes, update it in `devpost/SCENARIOS.md`, `devpost/PREVIEW-GUIDE.md`,
  `openspec/specs/README.md` and `README.md` (the docs test checks it).
- No local paths (`C:\...`) in `.md` files (test T12 fails).

## Nov 8, night: v7
- v7: `devpost/video/pathpal-demos-v7.mp4` (2:20, leaves ~40 s for Alex's own hand-run clip under 3 min).
  Edit: `node tools/voice/narration-mix.mjs devpost/video/demos-raw16.mkv <take16 marks shifted -5.6 s> 35.17
  out.mp4 1156:1258:20:86`; quiet stretches now 4x (`EDIT.fast`).
- Recording: write `.mkv` (survives a forced stop), `-t 720`, and keep Lens Studio on top (another window over
  it was recorded once). Don't edit Lens scripts during a take: Lens recompiles and restarts it.
- The take's camera can look down (`debugSetPitch`, `tiltTo`): the preview's view is narrow vertically, so the
  floor within ~8 m sits at the bottom edge when level.
- LLM: wired (`FindYourWayAsk.ts`, Remote Service Gateway) but no token is set, so the plain matcher answers.
  A token would be saved in `Assets/Scene.scene` (tracked): keep it out of commits.
- v8: `devpost/video/pathpal-demos-v8.mp4` (2:29): the play kept whole at 1x, last view walks on behind the robot.
  Raw `demos-raw19.mkv`, T0' 36.5. Don't open videos while recording (a Media Player window got recorded once).
