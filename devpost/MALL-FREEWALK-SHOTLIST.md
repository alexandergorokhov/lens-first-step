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

> **Status: checked on Nov 4.** The scene is already set up (the table above, "Mall demo"). Shot 1 was checked by screenshot in the preview; shots 2–8 by the LEAF scenarios named in each row, run in the preview with these settings, plus the route log. The LEAF runs move the traveller by script, so the exact framing of your take is still yours to judge. The draft's escalator shot was wrong for this route (see Skip); the lift replaces it.

## Set up (once)

1. Open `first-step.esproj`. In the **Preview** panel: device **SPECS 27**, mode **Interactive**, scene **Plane**.
2. The **FindYourWay** settings are already saved in the scene (the "Mall demo" column above). Check them in the Inspector (**Settings** group) if in doubt.
3. Click **reset preview**, then click inside the Preview panel so it gets your keys.
4. **Afterwards**, put the Thursday values back (the table at the top) and save.

Keys: **W A S D** walk, hold **Shift + A / D** to turn your head (Shift + W / S looks up and down), **Q / E** down / up (seated height). A click is a pinch; if a button only highlights, click it again. If the preview seems frozen, click inside it.

## Shots

| # | Time | What you do | What must be on screen | Caption | Checked |
|---|---|---|---|---|---|
| 1 | 0:00–0:08 | Nothing for 3 s, then click **Scan sign** | The mall entrance (Bolt Hardware ahead), the map sign, the "You are here" card, then the four choices: Free walk, Tour, Go to a place, Map builder | "Lost in a big mall? Look at the 'You are here' sign." · small line: "On Specs you look at it; here a button stands in" | ✅ Screenshots: the sign card at start, the four choices after |
| 2 | 0:08–0:20 | Click **Free walk**. In **Your preferences**, click **Robot** in the model row if it isn't ticked (✓ Robot), then **Keep them and walk**. Hold **W** for about 4 s | The robot appears and walks ahead of you | "A robot guide walks ahead. It never changes your route." | ✅ LEAF `companion-pick-before-walk` |
| 3 | 0:20–0:32 | Keep walking with **W**, a little to the left (**A**) toward Bean There Café. Stop | The robot stops and points at a shop that matches your picks (coffee, clothes, hardware); a sponsored shop's sign says **Sponsored** | "It stops at shops you like. Paid places are always labelled." | ✅ LEAF `b3-dc2` (in the mall it stopped at Threads, a clothes shop) and `q4` (pointing + Sponsored). Bean There Café is coffee and sponsored in the mall data; which shop it stops at first depends on your path |
| 4 | 0:32–0:42 | Face a shop front and hold still for about 1 s. Click the gold **Offers: …** button, wait 2 s, click **Close** | The gold button ("Offers: Bolt Hardware" for example), then the offer list (up to 3 lines with prices) | "Look at any shop to see its offers." | ✅ LEAF `b3-dc5` (Bolt Hardware: button, list of ≤ 3, Close) |
| 5 | 0:42–0:50 | Hold **Shift+D** until you face back the way you came (about half a turn) | The robot runs round you (at least 1 m away) and ends up in front again | "Turn round: it stays in front of you." | ✅ LEAF `b3-dc3` |
| 6 | 0:50–1:02 | Click **End walk** → **Go to a place** → **Walk** (no destination: the multi-stop list is used). Walk with **W** along the blue line toward the **Pharmacy** | The blue line on the floor; the pill at the bottom (floor, metres, floors to go, time); place icons along the route | "Three stops, in the shortest order." | ✅ LEAF `t1-mall-multi-stop` (stops: pharmacy > iceCream > sushi; first leg sign > West mall > Pharmacy, all on the ground floor) and `fl1` (the pill) |
| 7 | 1:02–1:12 | Walk until the arrival card shows, then click **Next stop** | "Stop 1 of 3: Pharmacy" card with the bolt line under it (for example "1 of 3 bolts found": the robot's collectibles along the line); the robot turns to face you; the line swings to the Ice Cream | "Stop 1 of 3. Next stop is one pinch away." | ✅ LEAF `t1-mall-multi-stop` |
| 8 | 1:12–1:22 | Follow the line to **Lift A** (just north of the Pharmacy). Walk right up to it, then click its **Ride to …** button | The line ends at the lift; after the ride the floor in the pill changes to the first floor and the line goes on to the Ice Cream (Sponsored) | "Lift up. The pill counts down floors and metres." | ✅ Route log: leg 2 is Pharmacy > Lift A > first floor > Ice Cream. Ride button: LEAF `dc3b` (airport lift). Not watched in the mall itself |
| (9) | 1:22–1:32 | Optional, mid-route with no card showing: stand still for 2 s, click **Play while you wait**, then **Jump (or raise a hand)** a few times | The play lane with the robot | "Waiting? Play with your robot." | ❌ Not checked with these settings. LEAF `sp1` and `g1` both assume the companion starts off and tap **Robot: on** to turn it on; with companionOnAtStart on, that tap turns it off, so they time out ("play offered after standing still"). The code offers play when the robot is on, you've stood still 2 s and no card shows, so it should work; try it before you film |

End on a 3 s title card: "Find Your Way Inside: any building, mapped by walking."

## Plan B: the scripted free walk

If a hand-driven take keeps going wrong, tick **showDemoControls** and click **Free walk demo** on the Demo controls panel. It presses the real buttons for you and shows its own captions (for example "More picks upstairs? It waits and says so"). The catch: the Demo controls panel is in frame and overlaps the Options panel on the left, so crop the left third out in the editor. ✅ LEAF `fw1-free-walk-demo`: all 8 beats ran in the mall with the robot.

## Skip

- **The escalator shot (draft shot 7).** With `pharmacy,iceCream,sushi` and **Walk**, the route never uses an escalator: Pharmacy → Ice Cream goes by **Lift A**, and Ice Cream → Sushi stays on the first floor (checked in the route log). The lift shot (8) replaces it. A ride button only works when you stand close to it (the log shows `ride … refused: 10.0 m away` from afar).
- **"Go here?" on a place icon.** The icons and **Go here?** appear only during a Go-to-a-place trip, not in Free walk. If you need it, add it after shot 6 and click an icon's **Go here?**. Note that this ends the multi-stop list. Not checked in the mall.
- **The robot's "3 picks upstairs" bubble at the escalator:** it depends on your path. Not checked.
- **"Play while you wait" at an arrival card:** the button only shows with no card on screen, so don't film shot 9 right after shot 7.
