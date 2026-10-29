# Find Your Way Inside: try it in the Lens Studio preview

No glasses needed. Everything below runs in Lens Studio's Preview panel on your laptop.

## 1. Open it

1. Open `C:\Sasha\Projects\Lens\first-step\first-step\first-step.esproj` in Lens Studio.
2. In the **Preview** panel, check the settings: device **SPECS 27**, mode **Interactive**, room **Sunlit Room**.
3. Click the **reset preview** button (circular arrow) so the Lens starts fresh.

## 2. Controls

| Do | How |
|---|---|
| Move | W A S D |
| Go down / up (seated height) | Q / E |
| Look around | Right-drag (or hold Shift and move the mouse) |
| Pinch (press a button) | Click. If it only highlights, click again. |

Click inside the Preview panel first so it gets your keys.

## 3. What you see at the start

- **Mode panel** ("How are you getting there?"): about 1 m ahead, a little right and below eye level.
- **Demo controls**: low on your left; they follow you. Buttons: **Gate change B12 → C3**, **Restart trip**, **Map: Airport (switch)**, **Play demo**. These are for the demo, not part of the real app.

Just want to watch? Click **Play demo** (see section 10).

Tip: the building is laid out from where you stand and face when you pick a mode. Walk forward (W) about 2 m into open floor first, away from the sofa.

## 4. Walk run (escalator)

1. Click **Walk**.
2. A "You are here" sign appears 2.5 m ahead. Click **Scan sign** (the label says "on real Specs: look at the sign").
3. Top-left badge: **offline map** (normal for now). A blue line starts at the sign.
4. Follow the line forward through the check-in hall to the escalator foot (about 16 m).
5. Click the gold **Ride escalator up** button next to the escalator foot. You're now on Departures.
6. Follow the line: forward to the concourse, right to the B gates, on to **Gate B12**.
7. Within 3 m of the gate the line stops: **"Gate B12. Boarding in 6 min."**
8. Turn away from the next turn: a small blue arrow at the bottom of your view points the way.

## 5. Gate change (Walk)

1. Any time after scanning, click **Gate change B12 → C3** on Demo controls.
2. A card shows top-right with a chime, and the line swings round.
3. From the concourse go left to the top of the C pier.
4. Click **Take stairs down**.
5. Follow the line to **Gate C3**: **"Gate C3. Boarding in 6 min."**

## 6. Wheelchair run (Step-Free)

1. On Demo controls, click **Restart trip**. Hold **Q** to drop to seated height.
2. Click **Step-Free (wheelchair)**, then **Scan sign**.
3. The line goes through the hall and right to **Lift 1** (about 18 m). No escalator, no stairs.
4. Click the red **Lift 1 out of service** sign by the lift (about 1.2 m up). Card: "Lift 1 out of service. Re-routing.", a chime, and the line swings to **Lift 2** (back through the hall, left and forward).
5. Walk into Lift 2 and click **Ride to Departures** (works seated too). It only works within 2.5 m of the lift on its floor. Card: **"Lift up to Departures"**.
   - Lift 2 has its own red sign too: pinch both lifts to see **"No step-free route. Ask staff at the assistance point."** and a line to the assistance point (arriving there shows "Assistance point"). Pinching a lift your route doesn't use only says it's out of service.
6. Follow the line to Gate B12.
7. Click **Gate change B12 → C3**: the route goes to the top of the C pier, then **Take ramp down** to Gate C3.

## 7. Other places (same app, different map)

Click **Map: … (switch)** on Demo controls. It cycles **Airport → Hospital → Campus → Preview room** and restarts at the mode panel.

- **Hospital:** Ward 4 on Level 1. Walk uses the stairs, Step-Free uses Lift A. Red signs on Lift A (re-routes to Lift B) and Lift B. Demo controls has **Room change Ward 4 → X-ray**.
- **Campus** (outdoor paths + two buildings, first floors 4 m up):
  - Main gate sign → the **Quad** 14 m ahead. Info desk (assistance point) just left of the quad. **Science building** to the right, **Library** to the left.
  - **Walk to Lecture Hall 1 (53 m):** quad → Science entrance → **Take stairs up** (stairs foot, 4 m right and 5 m ahead of the entrance) → Lecture Hall 1.
  - **Step-Free (59 m):** quad → Science entrance → lift (8 m right, 5 m ahead of the entrance) → **Ride to First floor** → Lecture Hall 1.
  - Red sign on the Science lift: Step-Free re-routes to **Take ramp up** (4 m left, 4 m ahead of the entrance). The Library lift has its own red sign.
  - **Room change Lecture Hall 1 → Lab 2** on Demo controls: both modes re-route to Lab 2 on the ground floor.
- **Preview room:** a short blue line on the room's real floor to the Window, no stand-in building. Arrival is within 0.6 m, off-route at 1.5 m (set in the map). **Change to the door** on Demo controls re-routes.

The **mapKey** setting on `FindYourWay` (Inspector) picks the start map: Airport, Hospital, Campus or Preview room.

## 8. Check these yourself (not yet confirmed by eye)

- [ ] **Floor height:** the blue line should lie flat on the floor, not float or sink. If it's off, select `FindYourWay` in the Scene Hierarchy and change **eyeHeightCm** in the Inspector (now 180). Larger moves the line down.
- [ ] **Start position:** the sign and the start of the line should be in open floor, not behind the sofa.
- [ ] **Map switch:** the Map button cycles all four maps (a LEAF test checks this; confirm it by clicking).
- [ ] **Online map:** with internet, the badge says **online map** after scanning the sign (maps download from the public gist, see section 11). Without internet it says "offline map".

## 9. How to test it (no glasses needed)

Three layers, fastest first.

### a. Unit tests (route logic, seconds, no Lens Studio)

In a terminal:

```
cd C:\Sasha\Projects\Lens\first-step\first-step
npm test
```

It first checks the Lens copies (`npm run sync:check`). Expect `pass 96`, `fail 0` (one test downloads the maps from the public gist; set `OFFLINE=1` to skip it with no internet). Covers: Walk and Step-Free routes on all four maps, Step-Free never uses stairs or escalators, Walk is always shortest, closures and re-routes, destination changes, broken maps, unknown signs, the turn arrow maths, the map download URL, the local map server, the demo's beats and walking speed, and that the Lens copies of the code and maps match `src/core`.

After editing anything in `src/core`, run `npm run sync` to copy it into `Assets/`. `npm run hooks` (once) makes git run `npm test` before every commit.

### b. LEAF tests (the running Lens, about 2 minutes)

1. In Lens Studio's Scene Hierarchy select **LeafIndex**, tick **autoRun** in the Inspector. (To run just one, type its id in **only**, e.g. `dc4-gate-change-stairs-and-ramp`.)
2. Reset the preview.
3. In the **Logger** panel look for `[FYW-LEAF] RESULT` lines and `SUMMARY 19/19 passed`.
4. Untick **autoRun** afterwards so the preview opens straight into the demo.

The 14 scenarios: your 5 done criteria (dc1–dc5), the two route rules, broken map (e2), no step-free route (e3), already at the destination (e4), unknown sign (e5), map switch, restart, and the whole autoplay demo at 10× speed (`demo-autoplay-completes`). `devpost/SCENARIOS.md` lists which test covers each scenario.

### c. By hand in the preview (what tests can't judge)

Run sections 4–7 above and tick:

- [ ] Every panel and card is readable and inside the view, standing and seated (Q).
- [ ] The blue line lies on the floor and is easy to follow; it fades 10 m ahead.
- [ ] Buttons respond to a click (click twice if the first only highlights).
- [ ] Ride/Take buttons only work when you're next to them.
- [ ] The gate-change card and chime are noticeable in the top-right corner.
- [ ] Each map (Airport, Hospital, Campus, Room) loads and routes correctly in both modes.

Write **"logic proven"** next to what tests and the preview show working, and **"feel unproven"** next to what only real glasses could tell (comfort, real hand tracking, real sign recognition, real floor detection).

## 10. Watch the demo (no clicking)

The demo plays the brief's video beats by itself, using the real app: it presses the same buttons you would (through the same click handlers) and walks along the live blue line at walking pace (1.4 m/s; long straights go 3× faster after the first 12 m). A short caption at the top of your view says what is happening.

**Start:** click **Play demo** on Demo controls. Or, to start it on every preview reset, select **FindYourWay → DemoRunner** in the Scene Hierarchy and tick **autoplayDemo** in the Inspector.
**Stop:** the same button now says **Stop demo**. Click it any time; you're left where the demo stopped, and **Restart trip** starts over.
**Speed:** **speed** on DemoRunner (1 = walking pace) and **holdSeconds** (how long each caption stays before the action). The whole demo takes about 4 minutes at speed 1.

What each beat shows:

| Beat | Caption | What happens |
|---|---|---|
| 1 | Find Your Way Inside: stand-in airport | Switches to the airport map and restarts |
| 2 | Choose Walk, once for the whole trip | Presses **Walk** |
| 3 | Scan the 'you are here' sign | Stands in front of the sign, presses **Scan sign**; the badge and line appear |
| 4 | Follow the blue line through the hall | Walks the line to the escalator foot |
| 5 | Ride the escalator up | Presses **Ride escalator up** |
| 6 | On to the departures concourse | Walks to the concourse |
| 7 | Gate change B12 → C3 | Presses **Gate change**: card top-right, chime |
| 8 | The line swings round to the C pier | Walks the new line |
| 9 | Stairs down to the C pier | Presses **Take stairs down** |
| 10 | Within 3 m of Gate C3: arrived | Walks to C3; arrival card "Gate C3. Boarding in 6 min." |
| 11 | Restart: now in a wheelchair | Presses **Restart trip** |
| 12 | Choose Step-Free, seated height | Presses **Step-Free**; eyes 45 cm lower |
| 13 | Same sign, same gate B12 | Presses **Scan sign** |
| 14 | The line goes round the corner to Lift 1 | Walks to Lift 1 |
| 15 | Lift 1 is out: pinch the red sign | Presses the red sign: card, chime, re-route |
| 16 | Re-routed to Lift 2 | Walks back through the hall to Lift 2 |
| 17 | Ride Lift 2 up to Departures | Presses **Ride to Departures** |
| 18 | Step-free all the way to Gate B12 | Walks to B12; arrival card |
| 19 | Same Lens, another map: a campus | Switches to the campus map, presses **Step-Free** |
| 20 | Step-Free to Lecture Hall 1 | Scans the main gate sign, walks across the quad |
| 21 | Science lift out: re-routed | Presses the red sign on the Science lift |
| 22 | Up the ramp instead | Walks to the ramp, presses **Take ramp up** |
| 23 | Arrived at Lecture Hall 1 | Walks to the hall; arrival card |
| 24 | That's the demo. Find Your Way Inside. | End card |

During the demo the stand-in building moves so your view follows the demo's position; the room around you doesn't move. Afterwards (or after **Stop demo**) the view goes back to your own position.

## 11. Local map server ("online map")

The Lens tries to download each map before falling back to its built-in copy (5 s timeout). The download address is **mapBaseUrl** + the map's file name (`map.json`, `hospital.json`, `campus.json`, `room.json`).

1. In a terminal: `npm run maps`. It serves `src/core/data/*.json` at `http://localhost:8787/<name>.json` (CORS on). `PORT=9000 npm run maps` picks another port.
2. In Lens Studio select **FindYourWay**, set **mapBaseUrl** in the Inspector. Leave it empty to always use the built-in map.
3. Scan the sign. The Logger shows `[FYW] map download: …` and the badge top-left says **online map** or **offline map**.

**Default: the public gist.** The repo is private, so its files can't be downloaded. **mapBaseUrl** defaults to a public gist holding the same four files as `src/core/data`:
`https://gist.githubusercontent.com/alexandergorokhov/ac59c2c8d02687651f256b320fff27b8/raw/`
(gist: https://gist.github.com/alexandergorokhov/ac59c2c8d02687651f256b320fff27b8). The preview only allows **https**, which the gist provides, so the badge says **online map**.

If you change a map in `src/core/data`, update the gist too: `gh gist edit ac59c2c8d02687651f256b320fff27b8 --filename map.json src/core/data/map.json` (same for the others). `npm test` fails if the gist copy differs. GitHub may serve the old copy for a few minutes after an edit.

**Local server:** `http://localhost:8787/` is refused by the preview (*"URL is not secure (Experimental API must be enabled to access insecure URLs)"*), so the Lens falls back to its built-in map ("offline map"). Turning on the Experimental API would allow it, but Lenses that use experimental APIs can't be published.

## 12. Demo video (no Lens Studio needed)

A first-person video of the trip through a 3D stand-in airport: walking (with the gate change B12 → C3), then in a wheelchair at seated height (Lift 1 out, re-routed to Lift 2). The route, every re-route and both arrivals come from the Lens's own route engine (`src/core/router.ts`); a small inset shows the traveller from behind.

- `npm run demo:watch` plays it live in your browser.
- `npm run demo:video` renders `devpost/video/find-your-way-demo.mp4` (about 3 minutes, 1280×720, needs Google Chrome).
- `npm run demo:video -- --stills 12,30,88.9` saves single frames at those seconds.
- The main video also shows the distance pill with the floor badge, the cue before each floor change and the up/down post where the line leaves the floor.
- `npm run demo:pet` renders `devpost/video/find-your-way-pet.mp4` (about 1 minute): the companion turned on from the app panel (line stays at 50%), coffee picked as an interest, the sponsored juice bar and the café pointed out, the wait at the escalator, off/on, the treats game. `npm run demo:pet:watch` plays it live.
- The companion is any model: `node tools/demo-video/record.mjs --companion robot` (or `rover`) renders `find-your-way-robot.mp4` / `find-your-way-rover.mp4`, the same clip with another model and collectible.

- `npm run demo:hospital` renders `find-your-way-hospital.mp4` (~1:45): walking up the stairs to Ward 4, a room change back down to X-ray; then in a wheelchair: Lift A out (re-routed to Lift B), Lift B out too, so no step-free route and the line leads to Reception.
- `npm run demo:campus` renders `find-your-way-campus.mp4` (~2:20): outdoors across the quad with the rover companion (it points at the coffee cart), walking off the line and being re-routed, a room change down to Lab 2; then in a wheelchair: the science lift is out, so up the ramp.
- Hospital and campus use a stand-in building made from their map files (`place-layout.mjs` works out floors, doorways, rooms, desks, lifts and railings; `building.js` draws them), so any new map gets a video the same way. Tests check that no video walks through a wall, room, desk, shop, railing or a lift's glass.

The code is in `tools/demo-video/`: `timeline.mjs` (what happens each frame), `scenarios.mjs` (hospital and campus), `airport.js` (the airport model), `place-layout.mjs` + `building.js` (stand-in buildings from any map), `pet.js` (the companions and collectibles), `server.mjs` (local page server), `index.html` (drawing and the on-screen panels).

## Tips for the video

Real distances are long (B12 is about 57 m of route). Record each run, then cut the walking between the key moments: scan, ride, gate change, red sign, arrival.
