# Find Your Way Inside: try it in the Lens Studio preview

No glasses needed. Everything below runs in Lens Studio's Preview panel on your laptop.

## Open it

1. Open `first-step.esproj` in Lens Studio.
2. In the **Preview** panel, set device **SPECS 27**, mode **Interactive** and scene **Plane**. The stand-in building is solid in Lens Studio only, so an empty scene lets it read as a place you walk through.
3. Click **reset preview** (the circular arrow) so the Lens starts fresh. It opens in the shopping mall.

## The three demos (one Inspector setting each)

Select **FindYourWay** in the Scene Hierarchy, pick **Demo preset** in the Inspector, then click **reset preview**.
The Lens opens ready: the sign is scanned for you, the screen stays clear while you walk (only the floor line, the
companion, the turn arrow and the offer boxes), and there are no demo controls. Set it back to **Off** for the full app.

**1. Airport, wheelchair, "in your own words".** Preset **1 Airport, wheelchair**. Seated view, Step-Free picked.
Click **Talk**. In the preview the Lens can't hear you (speech recognition runs on Specs), so the sentence types itself
in: "I need coffee and a bathroom before my flight at gate 12C". The panel shows the plan, Café, then Accessible toilet,
then Gate C12, and the robot sets off. Follow it with W A S D (Shift + A / D to turn): through Lift 1 (click its button
inside the lift), to the café, the accessible toilet, then down the C pier lift to Gate C12. Each stop shows a card for 3 s,
then the robot leads on. **Heard a gate change:** on the way, open **Control** and click **Play announcement**. A sample announcement types in at the bottom in Spanish, then shows in English ("…now boards at gate B14"); the Lens asks **Re-route to Gate B14?** **Yes** sends you there step-free; **No** keeps your trip. Preview only: a sample announcement and translation; on Specs the captions come from live speech. Nothing is recorded or stored.

**2. Mall, follow the dog.** Preset **2 Mall, follow the dog**. Walk picked. Click **Talk**: "Take me to the food
court". Follow the dog; it waits at the foot of the escalator until you get there, then rides up with you.

**3. Free walk with the robot.** Preset **3 Mall, Free walk with the robot**. Coffee and clothes are picked: click
**Keep them and walk**. The robot walks ahead and stops to wave at **Bean There Café** and **Threads**. Look at a shop
(turn toward it) and its two offer boxes appear.

Caption for recordings: "Voice shown as typed in the preview; live speech on Specs."

## Controls

| Do | How |
|---|---|
| Move | W A S D |
| Go down / up (seated height) | Q / E |
| Change floors | Walk along the stairs, ramp or escalator from its foot or top. Its sides are solid, like the walls and shop fronts. Lifts use the button in the lift. |
| Turn your head | Hold Shift and press A or D. Shift+W and Shift+S look up and down. With a mouse: right-drag. |
| Pinch (press a button) | Click. If it only highlights, click again. |

Click inside the Preview panel first so it gets your keys.

## Start

Click **Scan sign**, the panel straight ahead. On real Specs you would look at the sign. The badge says **online map** or **offline map**, and four choices appear: **Free walk**, **Tour**, **Go to a place** and **Map builder**.

## Free walk

1. Click **Free walk**. The companion asks: "Same as last time: Books? Or tell me what you're into."
2. Click **Talk: say what you like** and say it in your own words ("A coffee, and I'm into fashion today").
   The preview has no microphone, so the demo sentence types itself in. Your words become the map's own
   categories (Café, Clothes), shown under **Heard**, and the walk starts. Or click **Same as last time**,
   or **View or change** to tick categories by hand. Your picks are saved on the device for next time.
3. Pick **Dog**, **Robot** or **Rover** on the same panel. Then walk with W.
4. The companion walks ahead at your pace, stops at shops that match and points at them. A card at the
   pointer says why: **Clothes · your pick**.
5. Look at any shop for a moment: a gold button such as **Offers: Bolt Hardware** appears. Click it to see the shop's offers.
6. Turn around and walk: the companion walks calmly round you to lead again. Just looking around doesn't move it.
7. Matches upstairs: it waits at the escalator with a bubble such as "3 picks upstairs".

## Offline mode

**Offline: on** in the Control panel simulates no internet. The map stays (it ships with the Lens, or
the last copy downloaded); the map download and the AI (LLM) are off.

Voice search still works offline. The plain matcher reads the map's own data: place names ("take me
to the food court"), categories and interest words ("coffee and a bathroom", "I'm into fashion") and
codes ("gate 12C"). Only phrases that need the AI ("somewhere my kids can run around") fail. Then it
says "Didn't catch that (offline). Try Where to? or Pick on the map.":

- **Where to?** lists the map's places by name; click one.
- **Pick on the map** shows the floor plan; click a place on it.

Both work without voice and without internet. On Specs you pinch instead of clicking.

## Map and demo switches (Control panel)

- **See map** puts the map at the left of your view, semi-transparent, with you, the route and the gate
  names (C12, B14, ...). The button then says **Hide map**; click it to take the map away.
- **Hide demo controls** takes the Demo controls panel out of sight, for showing a walk by hand (for example
  a Free walk in the mall). **Show demo controls** brings it back.
- The **online map / offline map** badge after the scan says where the map came from: downloaded from the
  web (online), or the copy inside the Lens (offline). Both are the same place.

In Go to a place, pick the place first (Talk, **Where to?** or **Pick on the map**). Walk or Step-Free with
no place picked opens **Where to?** instead of guessing a route. Every place on every map can be reached,
walking and step-free (test R24).

## Tour

Click **Tour**, then keep your preferences. The companion leads you through the matching shops one by one. Click **Next stop** at each.

## Go to a place

1. Click **Go to a place**.
2. Say where to: **Talk** uses the microphone, **Say it** fills in a phrase, and **Where to?** gives a list, or a map with **Show on a map**.
3. Click **Walk** or **Step-Free (wheelchair)**.
4. Follow the blue line. The pill at the bottom shows your floor, the distance, the floors to go and the time. To change floors, walk up the stairs, ramp or escalator, or click the button beside it. Lifts need the button.

## Map builder

1. Click **Map builder** and walk. Your path records itself.
2. Face a shop and click **Mark shop**.
3. Change height and confirm **Stairs**, **Escalator**, **Lift** or **Ramp**, or use **Next floor**.
4. Click **See my map**, then **Upload**. The map goes to the log, and `npm run map:publish` checks and publishes it from the laptop.

## During a walk

The **Options** panel sits at the left of your view (on Specs, at waist height):

- **Dog: on/off** shows or hides the companion. The line stays.
- **Change to …** goes dog → robot → rover, at any point in a walk.
- **Places: on/off** mutes the icons and pointing (Go to a place only).
- **Voice: on/off** mutes the companion's spoken lines and their caption.
- **See map** shows the mini mall with your route on it.
- **Play while you wait** appears on a trip when you stand still with the companion on. Raise a hand to jump, or click **Jump**.
- **Throw a treat** throws for the companion to fetch.
- **End walk** goes back to the four choices. A trip you start next keeps the companion and your preferences.

Pinching and pulling a hand toward you shows a small model of your route. That needs hand tracking, so the mouse cannot do it.

## Other places and the demo

Select **FindYourWay** in the Scene Hierarchy and tick **showDemoControls** in the Inspector. The **Demo controls** panel then offers:

- **Map** cycles the Airport, Hospital, Campus, Preview room and Shopping mall.
- **Play demo** and **Free walk demo** play a scripted run with captions, using the real buttons.
- **Restart trip** starts over.
- A destination change, such as **Gate change B12 → C3** at the airport.

At the airport, hospital and campus, the red sign by a lift closes it. The line swings to another lift or a ramp. With no step-free route left, it leads to the assistance point.

## Checks by hand

These are the things only a person can judge:

- The line lies flat on the floor. If not, change **eyeHeightCm** on `FindYourWay`.
- The start is in open floor, and the sign and panels are in view.
- Every panel and card is readable and inside the view, standing and seated (Q).
- Buttons respond to a click.
- Ride buttons only work when you are next to them.
- The card at a route change is noticeable (no chime: it is off, R2-37).
- The line turns round to the next turn, with an arrow at the bottom of your view when the turn is out of view.

Write **logic proven** next to what tests and the preview show working, and **feel unproven** next to what only real glasses can tell.

## Tests

**Unit tests**, in a terminal, take a minute or two:

```
npm test
```

Expect `pass 628`, `fail 0`. One test downloads the maps from the public gist; with no internet, set `OFFLINE=1` to skip it (`pass 578`, `skipped 1`). The run first checks that the Lens copies match `src/core`. After editing `src/core`, run `npm run sync`.

**LEAF tests** run inside the Lens, pressing the real buttons:

1. Select **LeafIndex** in the Scene Hierarchy and tick **autoRun**. To run a few, type their ids in **only**, separated by commas.
2. Reset the preview.
3. Look for `[FYW-LEAF] RESULT` lines and the `SUMMARY` in the Logger.
4. Untick **autoRun** afterwards.

Run them in short groups, because long batches can hit a tap timeout. `SCENARIOS.md` lists which test covers each scenario.

## Maps online

The Lens downloads **mapBaseUrl** plus the map's file name, and uses its built-in copy if that fails or takes over 5 s. The default is a public gist with the same files as `src/core/data`:

`https://gist.githubusercontent.com/alexandergorokhov/ac59c2c8d02687651f256b320fff27b8/raw/`

After changing a map, update the gist: `gh gist edit ac59c2c8d02687651f256b320fff27b8 --add src/core/data/<file>.json`. `npm test` fails if the two differ. An older online map never replaces the one shipped in the Lens.

`npm run maps` serves the maps locally, but the preview refuses plain `http`, so the Lens then uses its built-in map.

## Concept renders

`tools/demo-video` draws a trip with three.js in a browser. **These are concept renders, not the Lens**, and each frame says so. Only the route engine is shared with the Lens. `npm run demo:watch` plays one live.
