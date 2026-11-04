# Silent demo B: a guided trip to the Cinema with the dog (about 70 s)

One take (or two, cut together at shot 4), recorded with OBS from the Lens Studio **Preview** panel. No voice: every shot gets a caption added in the editor. Every frame comes from the real Lens.

> **Status: written Nov 4, NOT yet watched in the preview.** The Lens Studio MCP connection was down for this whole session, so no shot could be checked by screenshot or LEAF in the mall with these settings. The routes below were worked out by hand from `src/core/data/mall.json` and the router (shortest distance; Step-Free never sees stairs or escalators). Where a LEAF scenario already covers the same logic on another map, it is named. Try each shot once before you film.

## Destination: Cinema (first floor, back of the mall)

- **Why the Cinema:** it is on another floor, at the far (back) side from the entrance sign, and the two modes split clearly: **Walk** takes the up escalator (39.7 m: You are here > Centre court (ground) > Up escalator > Back court (first) > Cinema), **Step-Free** takes **Lift B** (66.6 m: You are here > Centre court (ground) > Back court (ground) > Lift B (ground) > Lift B (first) > Back court (first) > Cinema). It also has its own arrival card text: **"Cinema. Doors open in 10 min."**
- **Not the Pharmacy:** it is on the ground floor; both modes take the same 37 m route with no lift.
- **Not the Sky Garden:** Walk and Step-Free both take Lift B there (71.6 m beats 83.3 m by escalators), so there is no contrast.
- **Pixel Arcade** (first floor, far west corner) also works (Walk: escalator 60.7 m; Step-Free: Lift A 69.8 m), but it is on page 5 of **Where to?**, its arrival card is just its name, and video A already shows Lift A.

## Inspector values for B

Select **FindYourWay** in the Scene Hierarchy, **Settings** group:

| Input | B: guided, dog | A: free walk, robot | Airport/Thursday showing |
|---|---|---|---|
| showingPreset | off | off | **on** |
| mapKey | Shopping mall (multi-stop) | Shopping mall (multi-stop) | Shopping mall (multi-stop) |
| startAtSign | on | on | on |
| showDemoControls | off | off | off |
| companionModel | **Dog** | Robot (bolts) | Dog |
| companionOnAtStart | **on** | on | off |
| multiStops | **(empty)** | `pharmacy,iceCream,sushi` | (empty) |
| presetPreferences | `coffee,clothes,hardware` (unchanged) | unchanged | unchanged |

**multiStops must be empty for B**: with a list, **Go to a place** runs the multi-stop trip instead of the destination you pick. Everything else (tryOnlineMap, eyeHeightCm, offsets) stays as it is. Save the scene after switching.

## Set up (once)

1. Open `first-step.esproj`. Preview panel: device **SPECS 27**, mode **Interactive**, scene **Plane**.
2. Set the "B" column above, save.
3. Click **reset preview**, then click inside the Preview panel so it gets your keys.

Keys: **W A S D** walk, hold **Shift + A / D** to turn your head, **Q / E** down / up. A click is a pinch; if a button only highlights, click it again.

## Shots

| # | Time (≈ s) | What you do | What must be on screen | Caption | Checked |
|---|---|---|---|---|---|
| 1 | 0:00–0:06 (6) | Nothing for 2 s, then click **Scan sign** | The "You are here" sign at the main entrance, then the four choices: Free walk, Tour, Go to a place, Map builder | "Find one shop in a big mall." | ⬜ Not watched in B. Same start as A shot 1 (✅ there, screenshots) |
| 2 | 0:06–0:14 (8) | Click **Go to a place**, then **Where to?**. Click **More** twice (page 3 of 8), then **Cinema** (3rd row) | The Go to a place panel, the **Where to?** list (5 names a page, "Page 3 of 8"), then back on the panel with **To: Cinema** | "Pick where you're going." | ⬜ Not watched. Page and row worked out from the list order (alphabetical, 37 places); `To: Cinema` is also the mall's default, so the line already reads that before you pick |
| 3 | 0:14–0:22 (8) | Click **Walk**. Let the line draw, hold **W** 2 s | The blue line going left to the **Up escalator**; the floor cue "In … m: escalator up to First floor"; the dog in front | "Walk: the shortest way, up the escalator." | ⬜ Not watched. Route from the map; Walk vs Step-Free logic: LEAF `dc2`, `dc3` (airport) |
| 4 | 0:22–0:30 (8) | Click **End walk** > **Go to a place** (check it still says To: Cinema; if not, repeat shot 2's picks) > **Step-Free (wheelchair)** | The line now goes straight on, past Centre court to the back of the mall and right to **Lift B**; no escalator | "Step-Free: never stairs or escalators. The lift instead." | ⬜ Not watched. If End walk drops the destination, cut between two takes instead |
| 5 | 0:30–0:45 (15) | Walk with **W** along the line. At **Back court** stop, hold **Shift+A** to look away, then back | The line on the floor; the **turn arrow** at the bottom when the turn is out of view; the **distance pill** (Ground floor, metres, 1 floor to go, time); the floor cue "In … m: lift up to First floor" | "One line, one arrow, the metres left." | ⬜ Not watched. Pill: LEAF `fl1`; cue badge: `fl2`; turn arrow: `dc2` (airport) |
| 6 | 0:45–0:58 (13) | Keep walking to **Lift B**. The dog gets there first: let it sit and wait 2 s. Walk right up to the lift and click **Ride to First floor** | The dog sitting at the lift door, looking back at you; after the ride the pill's floor changes to **First floor** and the dog is with you, leading again | "It waits at the lift for you." | ⬜ Not watched. Wait at a floor change: LEAF `p3` (escalator); ride button: `dc3b` (airport lift). The button only works close up (`ride … refused: N m away` in the log) |
| 7 | 0:58–1:10 (12) | Follow the line out of the lift, left along the back court to the **Cinema** | The arrival card **"Cinema. Doors open in 10 min."** over the door; the dog stops at the destination and turns to face you; the dog's treat count goes up by one | "Arrived. The dog says so too." | ⬜ Not watched. Arrival card: LEAF `dc5`; the dog's `arrived` mood (stops and faces you) and the last treat are in `src/core/pet.ts` |

End on a 3 s title card: "Find Your Way Inside: any building, mapped by walking."

Total about 70 s plus the title card. The Step-Free walk is 66.6 m, so cut the long straight between Centre court and Back court in the editor if it runs long.

## Optional

- **(8) Play while you wait**, mid-route with no card on screen: stand still 2 s, click **Play while you wait**, then **Jump** a few times. Video A could not use it because LEAF `sp1`/`g1` failed with the companion on at start; both scenarios are now fixed to check the companion's state instead of toggling it (re-run them before relying on this shot).

## Skip

- **Sky Garden as the destination**: no Walk/Step-Free contrast (both use Lift B).
- **"Show on a map"** in Where to?: it shows only the floor you are on (ground), and the Cinema is on the first floor.
- **"Say it"**: its phrase is "Take me to Bolt Hardware", not the Cinema.
