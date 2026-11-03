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

Re-record `visual-reel` on today's code. It's the same script, so it's quick. Then add three short preview captures, and record the voice-over last.

| Time | Shot | Source | How to capture it in Lens Studio |
|---|---|---|---|
| 0:00–0:15 | **Hook:** the mall, the sign, "Scan sign" | Reel beat 1 | Comes from the reel. The caption on screen must stay: "on real Specs: look at the sign". |
| 0:15–0:40 | **Go to a place in the mall:** Say it, then the line leads up the escalator, with the floor cue and pill | Reel beat 5, trimmed | From the reel. Keep the moment the pill changes floor. |
| 0:40–1:05 | **Walk vs Step-Free, lift out, re-route** at the airport | **New capture** | Demo controls on (FindYourWay > showDemoControls). Map → Airport, then Restart trip and Scan sign. Go to a place (the airport's default destination is Gate B12; pick it if asked) → **Step-Free**. Press **Q** (seated height). Walk with W to the lift, then click the red sign on the lift: the line swings to the other lift. Then click **Gate change B12 → C3**: the card and chime show and the line swings. |
| 1:05–1:15 | **Arrival** | **New capture** | Same session: walk to within 3 m of C3 and the arrival card shows. Or use the Tour's arrival from reel beat 9. |
| 1:15–1:45 | **Free walk with the companion:** walks ahead, points at a matching shop, "3 picks upstairs", runs round when you turn, and the gold Offers button | Re-recorded reel beats 2–4 | Re-record `visual-reel`. Keep the gold button naming the shop. |
| 1:45–2:00 | **While you wait:** catch by hand, then dog, robot, rover | Reel beats 6 and 7 | From the reel. Seated play only with a caption, "Seated play: tested; the preview view can't sit down", or leave it out. |
| 2:00–2:25 | **Map builder:** walk, mark a shop, take the stairs, See my map, Upload | Reel beat 10 | From the reel. |
| 2:25–2:38 | **How it was built:** the agent at work, the Lens Studio MCP connected, and the Logger showing `[FYW-LEAF] SUMMARY` | **New capture** | Screen-record the terminal with Claude Code and CLAD for 3 s, and `/mcp` showing lens-studio for 2 s. Then LeafIndex > autoRun on, **only** = 4 or 5 quick ids (for example `s1-start-at-sign-controls-hidden,fl1-pill-shows-and-counts-down,p1-companion-toggle-and-models`), reset the preview, and record the Logger as the RESULT lines and SUMMARY appear. Untick autoRun afterwards. |
| 2:38–2:48 | **Close:** title card | Reel beat 11 | "Find Your Way Inside", with the pitch line. |

**Recording tips** (from NEXT-SESSION.md):
- Start right after an OAuth token refresh, because the preview resets about every 50 minutes.
- Keep Lens Studio on top; in the last take the terminal covered it twice.
- Record with ffmpeg gdigrab.

## Voice-over script

About 330 words, roughly 2:30 at a calm pace. Read it over the cut; it needs no music.

> **(0:00)** Indoors there's no GPS. In a big airport or mall your phone makes you stop, look down and guess which way you're facing.
>
> **(0:10)** With Find Your Way Inside, you look at the "You are here" sign. Its code says where you stand, and it downloads this building's map. Here in the preview, a button stands in for the scan.
>
> **(0:17)** Say where you're going, and a line on the floor leads you there, floor by floor. The pill shows your floor, the distance and the time.
>
> **(0:40)** At the airport, I choose Step-Free: it never uses stairs or escalators. I'm seated. The lift is out of service, so I pinch its red sign, and the line swings to the other lift. Then my gate changes, and the route changes with me.
>
> **(1:05)** Within three metres of the gate, I've arrived.
>
> **(1:15)** In Free walk there's no destination. My companion walks ahead, stops at shops I'd like and points at them. If there are matches upstairs, it waits at the escalator and tells me. Turn around, and it runs round to stay in front. Look at any shop and its offers are one pinch away. Sponsored shops are always labelled, and they never change a route.
>
> **(1:45)** While I wait, I can play catch. It's a dog, a robot or a rover, and play never changes my route.
>
> **(2:00)** So who makes the maps? Anyone, by walking. My path records itself, I mark the shops I face, the stairs start a new floor, and I upload it. The same Lens runs an airport, a hospital, a campus and a mall from one small map file.
>
> **(2:25)** I planned it with the Learn skill pack, then built it with an AI coding agent, Snap's CLAD and the Lens Studio MCP, test-first. Routing is plain Dijkstra, with over four hundred unit tests plus LEAF tests that press the real buttons inside the Lens.
>
> **(2:38)** Find Your Way Inside. Any building, mapped by walking.

## Before you upload

- [ ] Every shot is from the Lens Studio preview, and the sign-scan stand-in is labelled on screen.
- [ ] No three.js clips, no copyrighted music, and no real brand names on screen.
- [ ] Length under 2:50.
- [ ] The YouTube video is public, and its link is in the Devpost form.
