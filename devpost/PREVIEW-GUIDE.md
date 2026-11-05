# Find Your Way Inside: try it in the Lens Studio preview

No glasses needed. Everything below runs in Lens Studio's Preview panel on your laptop.

## Open it

1. Open `first-step.esproj` in Lens Studio.
2. In the **Preview** panel, set device **SPECS 27**, mode **Interactive** and scene **Plane**. The stand-in building is solid in Lens Studio only, so an empty scene lets it read as a place you walk through.
3. Click **reset preview** (the circular arrow) so the Lens starts fresh. It opens in the shopping mall.

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

1. Click **Free walk**. **Your preferences** opens.
2. Pick **Dog**, **Robot** or **Rover**. Picking one turns the companion on. **View or change** lets you tick what you like.
3. Click **Keep them and walk**, then walk with W.
4. The companion walks ahead, stops at shops that match and points at them.
5. Look at any shop for a moment: a gold button such as **Offers: Bolt Hardware** appears. Click it to see the shop's offers.
6. Turn around: the companion runs round you to stay in front.
7. Matches upstairs: it waits at the escalator with a bubble such as "3 picks upstairs".

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
- The card and chime at a route change are noticeable.
- The line turns round to the next turn, with an arrow at the bottom of your view when the turn is out of view.

Write **logic proven** next to what tests and the preview show working, and **feel unproven** next to what only real glasses can tell.

## Tests

**Unit tests**, in a terminal, take a minute or two:

```
npm test
```

Expect `pass 499`, `fail 0`. One test downloads the maps from the public gist; with no internet, set `OFFLINE=1` to skip it (`pass 498`, `skipped 1`). The run first checks that the Lens copies match `src/core`. After editing `src/core`, run `npm run sync`.

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
