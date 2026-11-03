# Video plan: re-cut the preview reel and add a voice-over

The target is under 2:50 on YouTube. Every frame comes from the real Lens in the Lens Studio preview: no three.js concept renders, and no music unless it's royalty-free and you have written permission. A voice-over alone is fine.

## What exists

- `devpost/video/find-your-way-demo-final.mp4`: 2:41, no sound, recorded from the preview on **Nov 1 around 02:00** by the LEAF scenario `visual-reel` (`Assets/Tests/FywReelScenario.ts`). The raw take is `reel-raw8.mp4`.
- Beat order in the reel:
  1. "Lost in a big mall? Scan the 'You are here' sign"
  2. Free walk with the companion: walks ahead, "picks upstairs" at the escalator, points at a shop, runs round when you turn
  3. Look at the stairs to see what's up there
  4. Free walk with the companion off: look at a shop
  5. Go to a place: Say it, Walk, the line, the companion on, See map
  6. Catch by hand
  7. Dog, robot, rover
  8. Plans change
  9. Tour
  10. Map builder: walk, mark shops, take the stairs, See my map, Upload
  11. Title card
- `[REEL] <seconds> <caption>` lines in the Logger give each beat's exact time. `npm run reel:edit -- <raw> <reel.log> <start> <out>` cuts the marked stretches and times the captions.

## What the reel misses

**Changed after the reel was recorded (Nov 1 commits):**
- `7d0dc3d`: offers now open from a clear gold button that names the shop ("Offers: Bolt Hardware"). The reel's captions still say "a dot" (beats 3 and 4). Re-record, or at least change the captions; see REVIEW-FIXES.md.
- `a973e9e`: you pick the companion before walking. The reel turns it off with `PrefsCompanionButton`, so check that this still works.
- `88a8df7`: you can walk up stairs, ramps and escalators. The reel still uses the ride button for the stairs.
- `79f244b`: preview walls, promoted shop labels and an in-view Options panel.
- `767b914`: the demo walk now works end to end.

**Story beats that were never in the reel:**
- Walk vs Step-Free
- A lift out of service, then a re-route (or the assistance point)
- An arrival card at the destination. The Tour shows "arrived" briefly.
- Seated play. The preview's view doesn't drop when you sit, so this can only be shown with a caption.
- The how-it-was-built beat: the agent, the Lens Studio MCP and the LEAF SUMMARY

## The plan

The video follows the same order as the judges' showing (REVIEW-FIXES.md section 0). Most of it is a new airport capture made with the **showing preset**; only the companion and Learn this place can reuse reel footage. Build and test the preset first, then record. The voice-over goes on last.

| Time | Beat | Source | How to capture it in Lens Studio |
|---|---|---|---|
| 0:00–0:12 | **1. Pitch** | New | The airport sign in view, with the showing preset on. Voice-over only. |
| 0:12–0:20 | **2. Scan sign** | New | Click **Scan sign**. The caption must stay on screen: "on real Specs: look at the sign". Then **Go to a place**. |
| 0:20–0:50 | **3. Walk vs Step-Free, same sign** | New | Walk (preselected): walk with W until the line goes up the escalator. **Restart showing** → Scan sign → Go to a place → **Step-Free**: the line goes to the lift. Cut between the two. |
| 0:50–1:05 | **4. Distance and floor cue** | New | Walk toward the lift with W. Keep the pill (floor, metres, floors to go, time) and the "next: lift up" cue in frame. |
| 1:05–1:30 | **5. Lift 1 out, then gate change B12 → C3** | New | Click the red sign on Lift 1: the card and chime show and the line swings to the other lift. Then **Gate change B12 → C3**: the card shows and the line swings. Use the preset's gate-change button if one is added; otherwise turn on showDemoControls just for this shot. |
| 1:30–1:50 | **6. Companion** | New, or reel beat 2 | Dog on (preset): it leads and waits at the foot of the ride. A 3 s swap to robot and rover can come from reel beat 7. |
| 1:50–2:10 | **7. Arrival, then 10 s of seated play** | New | Walk to within 3 m of C3: arrival card. Press **Q**, stand still for 2 s, click **Play while you wait**, then click to jump. Caption: "Seated play: the preview view can't sit down". |
| 2:10–2:32 | **8. Learn this place on the room map** | New, or reel beat 10 | Map switch → **Preview room** → Scan sign → **Map builder**: walk, **Mark shop**, **See my map**. Then route on it if it fits in time. |
| 2:32–2:45 | **9. Tests: LEAF SUMMARY** | New | LeafIndex autoRun on, **only** = 4 or 5 quick ids (for example `sh1-showing-preset,s1-start-at-sign-controls-hidden,fl1-pill-shows-and-counts-down`), reset the preview, and record the Logger as the RESULT lines and SUMMARY appear. Add 3 s of Claude Code with CLAD and `/mcp` showing lens-studio. Then untick autoRun. |
| 2:45–2:49 | Close | New | Title card: "Find Your Way Inside: any building, mapped by walking." |

**Recording tips** (from NEXT-SESSION.md):
- Start right after an OAuth token refresh, because the preview resets about every 50 minutes.
- Keep Lens Studio on top; in the last take the terminal covered it twice.
- Record with ffmpeg gdigrab.

## Voice-over script

About 320 words, roughly 2:30 at a calm pace. Read it over the cut; it needs no music.

> **(0:00)** Indoors there's no GPS. In a big airport, your phone makes you stop, look down and guess which way you're facing.
>
> **(0:12)** With Find Your Way Inside, you look at the "You are here" sign. Its code says where you stand, and it downloads this building's map. Here in the preview, a button stands in for the scan.
>
> **(0:20)** From the same sign, Walk takes the shortest way, up the escalator. Step-Free never uses stairs or escalators, so the line goes to the lift instead.
>
> **(0:50)** The pill shows my floor, the distance and the time, and a cue warns me before every floor change.
>
> **(1:05)** Lift 1 is out of service. One pinch on its red sign, and the line swings to the other lift. Then my gate changes from B12 to C3, and the route changes with me, from where I'm standing.
>
> **(1:30)** I can turn on a companion. It walks ahead, waits for me at the lift, and never changes my route.
>
> **(1:50)** Within three metres of the gate, I've arrived. And while I wait, seated at the gate, I can play with it.
>
> **(2:10)** So who makes the maps? Anyone, by walking. Here I map this room: my path records itself, I mark what I face, and it becomes a map I can route on. The same Lens runs an airport, a hospital, a campus and a mall from one small map file.
>
> **(2:32)** I planned it with the Learn skill pack and built it with an AI coding agent, Snap's CLAD and the Lens Studio MCP, test-first: over four hundred unit tests, plus LEAF tests that press the real buttons inside the Lens.
>
> **(2:45)** Find Your Way Inside. Any building, mapped by walking.

## Before you upload

- [ ] Every shot is from the Lens Studio preview, and the sign-scan stand-in is labelled on screen.
- [ ] No three.js clips, no copyrighted music, and no real brand names on screen.
- [ ] Length under 2:50.
- [ ] The YouTube video is public, and its link is in the Devpost form.
