# Silent demo: the shopping mall with the robot (60–90 s)

> **Switch back for Thursday's showing.** The scene is saved with the mall-demo settings below. Before Thursday, select **FindYourWay** and put these values back (they were in the scene on Nov 4, before the mall demo):
>
> | Input | Thursday showing (old) | Mall demo (now) |
> |---|---|---|
> | showingPreset | **on** | off |
> | mapKey | Shopping mall (multi-stop) | Shopping mall (multi-stop) |
> | startAtSign | on | on |
> | showDemoControls | off | off |
> | companionModel | Dog | Robot (bolts) |
> | companionOnAtStart | off | on |
> | multiStops | *(empty)* | `pharmacy,iceCream,sushi` |
> | presetPreferences | `coffee,clothes,hardware` | unchanged |
>
> With showingPreset on, the preset overrides map, start at sign, demo controls, companion model and on-at-start anyway, so the two that really matter are **showingPreset on** and **multiStops empty**. Save the scene after.

One take, recorded with OBS from the Lens Studio **Preview** panel. There's no voice, so every shot gets a caption that you add in the editor (or as an OBS text source). Every frame comes from the real Lens.

> **Status: draft.** I checked shot 1 in the preview (the mall loads at the sign). The preview then broke on a package the MCP installed by itself, so shots 2–8 aren't checked yet. They're built from the code and the LEAF tests that cover them. Each shot says which.

## Set up (once)

1. Open `first-step.esproj`. In the **Preview** panel: device **SPECS 27**, mode **Interactive**, scene **Plane**.
2. Select **FindYourWay** in the Scene Hierarchy and set these in the Inspector (**Settings** group):

   | Input | Value | Why |
   |---|---|---|
   | showingPreset | **off** | The preset forces the dog |
   | mapKey | **Shopping mall (multi-stop)** | |
   | startAtSign | **on** | Start at the "You are here" sign |
   | showDemoControls | **off** | No demo panel in frame |
   | companionModel | **Robot (bolts)** | |
   | companionOnAtStart | **on** | The robot walks on every trip |
   | multiStops | `pharmacy,iceCream,sushi` | The multi-stop route in shot 7 |

   Leave the rest as they are (presetPreferences `coffee,clothes,hardware`).
3. Click **reset preview**, then click inside the Preview panel so it gets your keys.
4. **Afterwards**, turn **showingPreset** back on and clear **multiStops** to put the judges' showing back.

Keys: **W A S D** walk, **Shift+A / Shift+D** turn your head, **Q** sit (seated height). A click is a pinch; if a button only highlights, click it again.

## Shots

| # | Time | What you do | What must be on screen | Caption | Checked |
|---|---|---|---|---|---|
| 1 | 0:00–0:08 | Nothing for 3 s, then click **Scan sign** | The mall entrance, the "You are here" sign, then the four choices | "Lost in a big mall? Look at the 'You are here' sign." · small line: "On Specs you look at it; here a button stands in" | ✅ The mall loads at the sign |
| 2 | 0:08–0:20 | Click **Free walk**. In **Your preferences**, click **Robot** (if it isn't ticked), then **Keep them and walk**. Hold **W** for about 4 s | The robot appears and walks about 5 m ahead of you | "A robot guide walks ahead. It never changes your route." | ⏳ LEAF `companion-pick` |
| 3 | 0:20–0:32 | Keep walking with **W**, a little to the left (**A**) toward Bean There Café. Stop | The robot stops and points at a shop that matches; the shop's sign says **Sponsored** | "It stops at shops you like. Paid places are always labelled." | ⏳ LEAF `fw1` (free walk demo) |
| 4 | 0:32–0:42 | Face a shop front and hold still for about 1 s. Click the gold **Offers: …** button, wait 2 s, click **Close** | The gold button, then the offer list (up to 3 lines with prices) | "Look at any shop to see its offers." | ⏳ LEAF `look` |
| 5 | 0:42–0:50 | **Shift+D** twice to turn round | The robot runs round you to stay in front | "Turn round: it stays in front of you." | ⏳ LEAF `companion` |
| 6 | 0:50–1:05 | Click **End walk** → **Go to a place** → **Walk** (no destination: the multi-stop list is used). Walk with **W** along the blue line | The blue line on the floor; the pill at the bottom (floor, metres, floors to go, time); place icons along the route | "Three stops, in the shortest order." | ⏳ LEAF `t1-mall-multi-stop` |
| 7 | 1:05–1:15 | Follow the line to the escalator and walk up it with **W** (or click the button beside it) | The "next: escalator up" cue, then the floor chip in the pill changing to the first floor | "Up the escalator. The pill counts down floors and metres." | ⏳ LEAF `fl1`, `walk-stairs` |
| 8 | 1:15–1:25 | Walk until the arrival card shows, then click **Next stop** | "Stop 1 of 3: …" card with the bolt count ("3 of 5 bolts found" — the robot's collectibles along the line); the robot turns back to face you; the line swings to the next stop | "Stop 1 of 3. Next stop is one pinch away." | ⏳ LEAF `t1-mall-multi-stop` |
| (9) | 1:25–1:35 | Optional: stand still for 2 s, click **Play while you wait**, then **Jump** a few times | The play lane with the robot | "Waiting? Play with your robot. (The preview can't sit down.)" | ⏳ LEAF `sp1-seated-play` |

End on a 3 s title card: "Find Your Way Inside: any building, mapped by walking."

## Plan B: the scripted free walk

If a hand-driven take keeps going wrong, tick **showDemoControls** and click **Free walk demo** on the Demo controls panel. It presses the real buttons for you and shows its own captions (for example "More picks upstairs? It waits and says so"). The catch: the Demo controls panel is in frame, so crop it out in the editor.

## Skip

Not checked in the preview yet; I'll update this after the check:

- **"Go here?" on a place icon.** The icons and **Go here?** appear only during a Go-to-a-place trip, not in Free walk. If you need it, add it after shot 6 and click an icon's **Go here?**. Note that this ends the multi-stop list.
- The robot's "3 picks upstairs" bubble at the escalator: it depends on your path.
