# Video plan: airport showing, recorded from the preview, with a voice-over

The target is under 2:50 on YouTube. Every frame comes from the real Lens in the Lens Studio preview: no three.js concept renders, and no music unless it's royalty-free and you have written permission. A voice-over alone is fine.

## What exists

- `devpost/video/pathpal-demos-v2.mp4` (**latest, Nov 7**): 2:55, no sound, the three demo presets in one take by LEAF `visual-demos` from the Lens Studio preview, cut and titled with ffmpeg (1.35x). Airport in a wheelchair: café, to the accessible toilet door, the gate change heard in Spanish and re-routed to B14 step-free; mall, follow the dog; Free walk with the robot (points at the café and Threads, offers on a look).
- `devpost/video/find-your-way-demo-final.mp4`: 2:41, no sound, recorded from the preview on **Nov 1 around 02:00** by the LEAF scenario `visual-reel` (`Assets/Tests/FywReelScenario.ts`). It's a mall walkthrough, recorded before the Nov 1 and Nov 3–4 changes.
- `visual-reel` was updated in `085880d`: its captions now name the gold offers button, and it walks up the stairs. It plays end to end on the Nov 3–4 code (230 s) but **hasn't been re-recorded**. Footage from it can fill beats 6 and 8 below if needed.
- `[REEL] <seconds> <caption>` lines in the Logger give each beat's exact time. `npm run reel:edit -- <raw> <reel.log> <start> <out>` cuts the marked stretches and times the captions.
- **Not in any reel:** Walk vs Step-Free, a lift out of service with a re-route, the arrival card, and the how-it-was-built beat. These are recorded new below.

## The plan

The video follows the same order as the judges' showing (REVIEW-FIXES.md section 0). It's a new airport capture with the **showing preset** on (`showingPreset` on FindYourWay): the airport's entrance sign, demo controls hidden, the dog on and Walk preselected. **Restart showing**, **Demo: gate change** and the **Map: Preview room** switch sit on the Options panel, which shows during a trip or a walk. Record the shots, then add the voice-over last.

Seated play isn't in the video, because the preview view doesn't drop when you sit.

| Time | Beat | Source | How to capture it in Lens Studio |
|---|---|---|---|
| 0:00–0:12 | **1. Pitch** | New | The airport sign in view, with the showing preset on. Voice-over only. |
| 0:12–0:20 | **2. Scan sign** | New | Click **Scan sign**. The caption must stay on screen: "on real Specs: look at the sign". Then **Go to a place**. |
| 0:20–0:50 | **3. Walk vs Step-Free, same sign** | New | Walk (preselected): walk with W until the line goes up the escalator. **Restart showing** → Scan sign → Go to a place → **Step-Free**: the line goes to the lift. Cut between the two. |
| 0:50–1:05 | **4. Distance and floor cue** | New | Walk toward the lift with W. Keep the pill (floor, metres, floors to go, time) and the "next: lift up" cue in frame. |
| 1:05–1:30 | **5. Lift 1 out, then gate change B12 → C3** | New | Click the red sign on Lift 1: the card and chime show and the line swings to the other lift. Then click **Demo: gate change**: the card "Gate change B12 → C3" shows and the line swings. |
| 1:30–1:50 | **6. Companion** | New, or `visual-reel` | The dog (on under the preset) leads and waits at the foot of the ride. A 3 s swap to robot and rover can come from the reel. |
| 1:50–2:00 | **7. Arrival** | New | Walk to within 3 m of C3: the arrival card shows and the line stops. |
| 2:00–2:22 | **8. Map builder (Learn this place) on the room map** | New, or `visual-reel` | **Map: Preview room** on the Options panel → Scan sign → **Map builder (Learn this place)**: walk, press the **Mark shop** button, then **See my map**. Route on it if it fits in time. |
| 2:22–2:45 | **9. How it was built** | New | (a) About 10 s of Claude Code calling the Lens Studio MCP: ask it to run one LEAF scenario (for example `sh1-showing-preset`), and show the tool call and the `PASSED` line in the Logger. (b) About 10 s of a short LEAF batch: LeafIndex autoRun on, **only** = 3 or 4 quick ids (for example `sh1-showing-preset,s1-start-at-sign-controls-hidden,fl1-pill-shows-and-counts-down`), reset the preview, and record the RESULT lines and `[FYW-LEAF] SUMMARY`. Untick autoRun afterwards. |
| 2:45–2:49 | Close | New | Title card: "Find Your Way Inside: any building, mapped by walking." |

**Recording tips** (from NEXT-SESSION.md):
- Start right after an OAuth token refresh, because the preview resets about every 50 minutes.
- Keep Lens Studio on top.
- Record with ffmpeg gdigrab.

## Voice-over script

About 300 words, roughly 2:20 at a calm pace. Read it over the cut; it needs no music.

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
> **(1:50)** Within three metres of the gate, I've arrived.
>
> **(2:00)** So who makes the maps? Anyone, by walking. Here I map this room: my path records itself, I mark what I face, and it becomes a map I can route on. The same Lens runs an airport, a hospital, a campus and a mall from one small map file.
>
> **(2:22)** I planned it with the Learn skill pack and built it with an AI coding agent, Snap's CLAD and the Lens Studio MCP, test-first. Here the agent runs a test inside Lens Studio: over four hundred unit tests, plus LEAF tests that press the real buttons inside the Lens.
>
> **(2:45)** Find Your Way Inside. Any building, mapped by walking.

## Before you upload

- [ ] Every shot is from the Lens Studio preview, and the sign-scan stand-in is labelled on screen.
- [ ] No three.js clips, no copyrighted music, and no real brand names on screen.
- [ ] Length under 2:50.
- [ ] The YouTube video is public, and its link is in the Devpost form.
