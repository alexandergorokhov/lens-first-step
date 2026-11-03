# Review fixes and checks (before Thu Nov 5)

## 0. Showing preset: do this first, right after the LEAF re-run in section 1

Alex shows the project to the judges on Thursday. One switch should put the Lens in the showing state, and one button should get back to it.

**What to build (test-first):**
1. **Write the LEAF scenario first:** `sh1-showing-preset`. With the preset on and the preview reset, it asserts:
   - the map is `airport` and the phase is `scan`, with the traveller at the entrance sign facing in (`startAtSign`)
   - the demo controls are hidden
   - the companion is on and is the dog, with no robot or rover
   - Walk is preselected, so after Scan sign → Go to a place the Walk choice is already highlighted and one pinch starts it; Step-Free stays one pinch away
   - the `room` map is loaded and ready, so the Map switch reaches it in one press for Learn this place
   - pressing **Restart showing** after a trip, a lift closure, a gate change and a model swap brings all of the above back, with the closures cleared, the destination back to B12 and the companion back to the dog

   Run it and confirm it fails.
2. **Add the preset:** a `showingPreset` bool input on FindYourWay (Inspector), next to the existing `mapKey`, `startAtSign`, `showDemoControls`, `companionModel` and `companionOnAtStart`. When on, it overrides them at startup (`airport`, `true`, `false`, `"dog"`, `true`) and preselects Walk. Keep the logic in `src/core` where possible, with Node tests (for example `showingState()` returning the settings) so `npm test` covers it.
3. **Add Restart showing:** a button on the Options panel, shown only when the preset is on, that does the reset above. It's not a demo control, so it stays visible with demo controls hidden.
4. Run `sh1-showing-preset` plus the existing restart and map-switch LEAF scenarios. Keep `OFFLINE=1 npm test` green, then commit.

**Showing order** (the same as the video; see VIDEO-SHOTLIST.md):

| # | Beat | In the Lens |
|---|---|---|
| 1 | Pitch | Spoken, with the Lens at the airport sign |
| 2 | Scan sign | Click **Scan sign** ("on real Specs: look at the sign") |
| 3 | Walk vs Step-Free, same sign | Walk: the line goes up the escalator. **Restart showing**, then Step-Free: the line goes to the lift |
| 4 | Distance and floor cue | Walk toward the escalator or lift; the pill and the "next: …" cue show |
| 5 | Lift 1 out, then gate change | In Step-Free, click the red sign on Lift 1: the line swings to the other lift. Then click **Gate change B12 → C3**, which needs the demo controls, or a hidden hotkey if one is added |
| 6 | Companion | Already on (dog); show it leading and waiting at the ride |
| 7 | Arrival, then 10 s of seated play | Within 3 m of C3 the arrival card shows. Press **Q**, stand still, then **Play while you wait**: pinch to jump. Say that the preview view doesn't lower when seated |
| 8 | Learn this place | Map switch to **Preview room**, Scan sign, then **Map builder**: walk, Mark shop, See my map |
| 9 | Tests | The Logger with `[FYW-LEAF] SUMMARY` from a short LEAF run |

**Open question for step 5:** the gate change is a demo control, but the preset hides the demo controls. Choose one: a **Gate change** button that shows only under the preset (labelled "Demo: gate change"), or turning demo controls on just for that beat. The first is cleaner for the judges.

I made these suggestions on 2026-11-03 without Lens Studio. None of them is applied, because each needs the preview to verify. Do them in a session started in this folder with Lens Studio open, writing a failing LEAF test first wherever behaviour changes.

## 1. Re-run the whole LEAF suite on today's code

The last full run was **2026-10-31 14:30**: 43 of 45 passed, and e5 and the closure card passed when run alone. Every commit since then (`0704a77` … `767b914`, Oct 31 21:39 to Nov 1 17:59) changed Lens code, so the README's "verified" list needs this run.

Plan, in batches of about 30 or fewer, because long batches stall Lens Studio:
1. Open `first-step.esproj`. Set the preview to SPECS 27, Interactive, Plane, then reset it.
2. Start right after an OAuth token refresh; the preview resets about every 50 minutes (see NEXT-SESSION.md).
3. Batch A: LeafIndex `autoRun` on, `only` = the first ~30 non-visual ids from `FindYourWayLeafIndex`. Reset the preview, then read the `[FYW-LEAF] RESULT` lines and the `SUMMARY`.
4. Batch B: the remaining non-visual ids.
5. Rerun any failure alone. A failure that passes alone is a timing flake: note it.
6. Untick `autoRun`, clear `only`, and don't save the runner settings into the scene.
7. Update the "Verified in the Lens Studio preview" list in README.md, and the run date in it and in DESCRIPTION.md.

## 2. The reel scenario after the Nov 1 changes (`Assets/Tests/FywReelScenario.ts`)

- **Captions still say "dot"** (lines 178 and 209), but `7d0dc3d` made offers a gold button that names the shop. Suggested captions:
  - "Look at the stairs: a button shows what's up there"
  - "Look at a shop. Open its offers, or ignore them"
- **Check `freeWalkAlone()`**: since `a973e9e` you pick the companion before walking. Make sure `PrefsCompanionButton` still turns it off.
- **Check `stairs()`**: it still presses the stairs ride button, but since `88a8df7` you can walk up. Walking may look better in the video.
- Then re-record `visual-reel`; see VIDEO-SHOTLIST.md.

## 3. Lens Studio version

- Installed: **5.23.2**. `first-step.esproj` says **5.24.1**. The 5.23.2 switch was made on Oct 30 because of stalls and crashes.
- Before the public release, say in the README which version you tested last. The README currently says it was built with 5.24.1 and runs in 5.23.2.
- Don't let 5.23.2 rewrite the `.esproj` version without checking that 5.24.1 still opens it.

## 4. Files to leave out of commits

These are changed by Lens Studio 5.23.2 and are **not** to be committed:
- `.gitattributes`
- `Assets/Render/Echopark.hdr.meta`

Also never commit:
- `ls-live-instance.json`, which is no longer ignored under 5.23.2
- `.mcp.json`, which holds the Lens Studio access token
- the runner's `autoRun` / `only` saved into the scene

## 5. Before the repo goes public

- Confirm where the UI icons in `Assets/Icons` come from, and their licence; the README's credits line says to check.
- `spk_debug_key.pem` is in the project root, and Lens Studio's managed `.gitignore` lists it. Check it's not tracked: `git ls-files spk_debug_key.pem` should print nothing.
- Merge `floors-distance-companion` (and this `review-prep` branch) to `master`.
