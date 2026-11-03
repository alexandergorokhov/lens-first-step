# Review fixes and checks (before Thu Nov 5)

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
