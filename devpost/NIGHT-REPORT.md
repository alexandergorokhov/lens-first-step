# Night report, 2026-11-03 → 11-04

## Morning report (00:50)

**Done: all 8 tasks (0–7), on `review-prep`, committed locally, not pushed.**

| Commit | Task |
|---|---|
| `e33e89a` | 2: LEAF fixes (rule-walk test too slow, dc4 swing, longer waits for timing flakes) |
| `eaf0bca` | 3: the companion points but stays in view, plus the floor arrow (Free walk, Go to a place, Tour) |
| `0809d51` | 4: showing preset, Restart showing, Demo: gate change, Airport ↔ Preview room switch |
| `085880d` | 5: reel captions ("gold offer button"), walk up the stairs, companion-off check |
| `3119d74` | 6: README verified list and DESCRIPTION run date |

**LEAF:** full run of 48 non-visual scenarios on yesterday's code: 39 passed in two batches, the 8 timing failures passed 8/8 when rerun, and rule-walk-is-shortest hung on its own test code (fixed, now passes). New tonight: vw1, vw2, vw3 and sh1 pass. 14 affected scenarios rerun on the final code: all pass. `visual-reel` plays end to end (230 s).
**npm test** (`OFFLINE=1`): 459 tests, 458 pass, 0 fail, 1 skipped (the online download). Up from 441.

**For you to do or decide:**
1. **Lead distance:** the spec says the companion returns to 2–3 m ahead; I kept the Inspector's 7 m (the floor only enters the Specs view from ~5.4 m). Say if you want 2.5 m.
2. **Showing preset is off in the scene.** Tick `showingPreset` on FindYourWay before Thursday. I put Restart showing, Demo: gate change and the map switch on the **Options panel**. It only shows during a trip or a walk, not at the scan sign. "Airport route panel" was unclear to me.
3. **Floor arrow in the reel:** it flicks on and off when the reel turns the camera. Check that it looks fine before you record on Wednesday.
4. vw3 (Tour) passed but pointed 0 times on its leg; Node V13 covers Tour pointing.
5. Look at the new behaviour by eye: Free walk now stops ~1 m from its lead spot instead of walking to the shop front.

**Skipped / not done:** the final video (yours, Wednesday). No new npm dependencies. No pushes. Not committed: `.gitattributes` and `Echopark.hdr.meta`. The runner's `autoRun` is off and `only` is empty, and the scene isn't saved. Lens Studio is left open.
**Watch out:** WSL's VM held ~15 GB of RAM all night (free memory fell to 0.8 GB). I left it running. Restart it if Lens Studio stalls.

## Log

### Task 0: status (22:24)
- Branch `review-prep`. Uncommitted: `.gitattributes`, `Assets/Render/Echopark.hdr.meta` (both to be left out).
- Last 5 commits: `66bae94` showing preset decisions · `9cb1be3` showing preset plan · `99fcc60` review fixes · `0684bf4` video plan · `81e0169` Devpost description draft.
- `npm test`: 441 tests, 441 pass, 0 fail (77 s).

### Task 1: full LEAF re-run (started 22:28)
- 48 non-visual scenarios, in two batches of 24 through `FindYourWayLeafRunner` (`autoRun` + `only`).
- Batch A started 22:28:57. The `rule-*` scenarios take 4–9 min each (as in earlier runs: 228–404 s), so batch A runs past the 22:57 token refresh.
- dc4-gate-change-stairs-and-ramp FAILED: `line swings round` (the swing lasts 0.9 s; it may already be over after the tap's wait).
- 22:57 token refresh reset the preview; the runner restarted batch A. dc4 then **passed** (timing flake).
- `rule-walk-is-shortest` hung both times: `TimeoutError: Javascript execution has timed out` (23:07:45) inside the test's own `bruteShortest` (`Assets/Tests/FindYourWayLeafSupport.ts:116`), which searches every simple path in one frame. The runner never gets past it, so I restarted the batch at 23:17 with the 17 ids after it.
- **Batch A result: 21 / 24.**
  - Passed: dc1–dc5, rule-stepfree, e2, e3, e4, e5, e1b, map-switch, restart, demo-autoplay, dc3b, dest-change, e3b, c12, closure-card, fl1, fl2.
  - FAILED rule-walk-is-shortest — JS timeout in the brute-force check (test code).
  - FAILED s1-start-at-sign-controls-hidden — `Timed out waiting for: scan sign`.
  - FAILED p1-companion-toggle-and-models — `Timed out waiting for: tap on 'RestartButton' (enabled now: true)`.
- System memory: WSL's `vmmemWSL` holds ~15 GB of 31.7; free RAM fell to 0.8 GB and Claude Code killed one background wait. Not touched (not mine to stop).
- Batch B started 23:28 (24 ids). **Result: 18 / 24.** FAILED: m5 (`Timed out waiting for: scan sign`), b3-modes, b3-dc1, sp1, gt1 (tap on `NextMapButton` timed out), mb5 (tap on `RestartButton` timed out).
- Rerun of the 8 timing failures together after the 23:47 refresh: **8 / 8 passed** (s1, p1, m5, b3-modes, b3-dc1, sp1, gt1, mb5). They are flakes that build up over long batches.
- **Task 1 total: 47 / 48 non-visual scenarios pass on today's code** (with reruns); the one real failure is rule-walk-is-shortest's test code. Time: ~85 min.

### Task 2: fix the LEAF failures (23:53–23:58) — commit `e33e89a`
- rule-walk-is-shortest: `bruteShortest` now uses Bellman-Ford (same rules, still independent of the router): 66 s, no JS timeout.
- dc4: counts the line swing (`getLineSwingCount`) instead of catching the 0.9 s swing mid-way.
- Flakes (no behaviour change): tap timeout 12 → 20 s; scan-sign waits 3 → 8 s (support files) and 4 → 12 s (s1, m5).
- rule-walk + dc4 alone: 2 / 2. `OFFLINE=1 npm test`: 441, 440 pass, 1 skipped.
- Note: `git stash` re-checks files out with CRLF (autocrlf), which breaks `sync:check` byte equality; fixed by restoring LF. Content unchanged.

### Task 3: companion points but stays in view (22:35–00:22) — commit `eaf0bca`
- Core `src/core/view.ts`: `clampToView` (±15°, 1.5 m to max(6 m, lead + 1.5 m), never behind), `asideSpot`, `PointMachine` (lead → aside → point → return → lead, once per shop, 10 s), `OutOfViewTimer` (2 s; out of view = more than ±20° off), `shopTrigger`.
- `PetGuide` (Go to a place, Tour): `keepInView` hook + `look`, `pointState`. `PointingCoach`: 8 m, within 6 m of the route, 10 s apart (was 10 m / 10 m / 30 s + 20 m).
- `FreeWalk`: steps at most 1.2 m from its lead spot toward the shop (was: walked to the shop front), kept in view, 10 s cooldown, shops within 8 m measured to the front; floor hints keep 12 m.
- Lens: floor arrow in `FindYourWayCompanionView` (20% opacity, 0.8 m ahead of your feet toward the companion), wired in `FindYourWayMain.updateFloorArrow`; Main sets the view clamp on both guides.
- Node: V1–V15 (+ Q4 updated to 10 s). LEAF: vw1 (Go to a place), vw2 (Free walk), vw3 (Tour) pass, plus p1, p3, q4, b3-dc2, b3-dc3, b3-dc5, fw1, tr1 (10/11, then vw1 2/2 after a test fix: the arrow check now faces the companion first; at a ride's foot it sits at your feet).
- b3-dc2's start pose moved 3 m east (27 → 30) so Threads' front is inside the new 8 m.
- **Decide:** the spec says "lead 2–3 m ahead"; the Lens keeps `companionAheadM` = 7 m because the floor only enters the Specs view from ~5.4 m. Not changed.
- vw3 (Tour) pointed 0 times on its leg (no matching place near that leg); it checks the in-view rule and the floor arrow, and Node V13 covers Tour pointing.
- `OFFLINE=1 npm test`: 459 tests, 458 pass, 1 skipped.

### Task 4: showing preset (00:22–00:35) — commit `0809d51`
- Node: `SHOWING` / `showingSettings()` in `src/core/demo.ts` (SH1–SH3, in `eaf0bca`).
- LEAF `sh1-showing-preset` written first: FAILED (`preset: airport`), then built: `showingPreset` input, `restartShowing()`, Walk preselected (▶ on the button), Options panel rows Restart showing / Demo: gate change (airport trips, until the gate changes) / Map: Preview room ↔ Airport.
- sh1 + restart, map-switch, s1, dc4, p1, g1, sp1: 8 / 8. npm test 459 / 458 / 1 skipped.

### Task 5: reel (00:36–00:44) — commit `085880d`
- Captions: "Look at the stairs: a button shows what's up there", "Look at a shop. Open its offers, or ignore them".
- `freeWalkAlone`: `PrefsCompanionButton` still turns it off (log: `companion dog off`); a warning prints if not.
- `stairs`: now walks up (feet follow the steps); reached the top (`stops at stairsTop`).
- `visual-reel` ran once after the 00:37 refresh: PASSED (230 s). Video not recorded.

### Task 6: README (00:45) — commit `3119d74`
- Verified list now cites the 2026-11-03 run and adds pointing in view + floor arrow, showing preset, walking up stairs, the companion picker. Test counts were updated in `eaf0bca` (441 → 459).

### Task 3 (started early, Node only, while LEAF runs)
Drafted while LEAF runs, so no Lens file is touched mid-batch. What exists today:
- Guided (Go to a place and Tour): `PointingCoach.check` (`src/core/places.ts:188`) picks a place; `PetGuide.point` / `update` (`src/core/pet.ts:313`, `:337`) step `SIDE_STEP` 1.2 m square to the line at the companion's lead spot (`sideStepSpot`, `pet.ts:142`) for `POINT_SECONDS` 3 s, then `stepPet` takes it back to the lead. No view check. Once per place; 30 s and 20 m between points.
- Free walk: `FreeWalk.nextStop` (`src/core/freewalk.ts:499`) picks a matching shop within 12 m in a 40° cone; the companion walks to 1.2 m outside the shop's front (`stopSpot`), which can be far from you, and points 3 s. No cooldown. Back to lead via `move` to `spotAhead`.
- Off-screen: only the HUD turn arrow, in Free walk, while pointing (`FindYourWayFreeWalkView.ts:84`). No floor arrow.
- Lead distance in the Lens: `companionAheadM` = 7 m (Inspector), because "the floor only enters the view from about 5.4 m".
