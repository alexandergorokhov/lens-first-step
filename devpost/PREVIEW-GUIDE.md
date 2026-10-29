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
- **Demo controls**: low on your left; they follow you. Buttons: **Gate change B12 → C3**, **Restart trip**, **Map: Airport (switch)**. These are for the demo, not part of the real app.

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
4. Click the red **Lift 1 out of service** sign by the lift. Card: "Lift 1 out of service. Re-routing.", a chime, and the line swings to **Lift 2** (back through the hall, left and forward).
5. Walk into Lift 2 and click **Ride to Departures**. It only works when you're inside or next to the lift.
6. Follow the line to Gate B12.
7. Click **Gate change B12 → C3**: the route goes to the top of the C pier, then **Take ramp down** to Gate C3.

## 7. Other places (same app, different map)

Click **Map: … (switch)** on Demo controls. It cycles **Airport → Hospital → Campus → Preview room** and restarts at the mode panel.

- **Hospital:** Ward 4 on Level 1. Walk uses the stairs, Step-Free uses Lift A. The red sign is on Lift A (re-routes to Lift B). Demo controls has **Room change Ward 4 → X-ray**.
- **Campus** (outdoor paths + two buildings, first floors 4 m up):
  - Main gate sign → the **Quad** 14 m ahead. Info desk (assistance point) just left of the quad. **Science building** to the right, **Library** to the left.
  - **Walk to Lecture Hall 1 (53 m):** quad → Science entrance → **Take stairs up** (stairs foot, 4 m right and 5 m ahead of the entrance) → Lecture Hall 1.
  - **Step-Free (59 m):** quad → Science entrance → lift (8 m right, 5 m ahead of the entrance) → **Ride to First floor** → Lecture Hall 1.
  - Red sign on the Science lift: Step-Free re-routes to **Take ramp up** (4 m left, 4 m ahead of the entrance).
  - **Room change Lecture Hall 1 → Lab 2** on Demo controls: both modes re-route to Lab 2 on the ground floor.
- **Preview room:** a short blue line on the room's real floor to the Window, no stand-in building. **Change to the door** on Demo controls re-routes.

## 8. Check these yourself (not yet confirmed by eye)

- [ ] **Floor height:** the blue line should lie flat on the floor, not float or sink. If it's off, select `FindYourWay` in the Scene Hierarchy and change **eyeHeightCm** in the Inspector (now 180). Larger moves the line down.
- [ ] **Start position:** the sign and the start of the line should be in open floor, not behind the sofa.
- [ ] **Map switch:** the Map button cycles all four maps (a LEAF test checks this; confirm it by clicking).
- [ ] **Online map:** the badge says "offline map" until the map file is at a public web address (your repo public, or another URL set in `Assets/Scripts/FindYourWayMapLibrary.ts`).

## 9. How to test it (no glasses needed)

Three layers, fastest first.

### a. Unit tests (route logic, seconds, no Lens Studio)

In a terminal:

```
cd C:\Sasha\Projects\Lens\first-step\first-step
npm test
```

Expect `pass 62`, `fail 0`, `todo 1` (the todo is the real online download, which needs a public map URL). Covers: Walk and Step-Free routes on all four maps, Step-Free never uses stairs or escalators, Walk is always shortest, closures and re-routes, destination changes, broken maps, unknown signs, the turn arrow maths, and that the Lens copies of the code and maps match `src/core`.

### b. LEAF tests (the running Lens, about 2 minutes)

1. In Lens Studio's Scene Hierarchy select **LeafIndex**, tick **autoRun** in the Inspector. (To run just one, type its id in **only**, e.g. `dc4-gate-change-stairs-and-ramp`.)
2. Reset the preview.
3. In the **Logger** panel look for `[FYW-LEAF] RESULT` lines and `SUMMARY 13/13 passed`.
4. Untick **autoRun** afterwards so the preview opens straight into the demo.

The 13 scenarios: your 5 done criteria (dc1–dc5), the two route rules, broken map (e2), no step-free route (e3), already at the destination (e4), unknown sign (e5), map switch, and restart. `devpost/SCENARIOS.md` lists which test covers each scenario.

### c. By hand in the preview (what tests can't judge)

Run sections 4–7 above and tick:

- [ ] Every panel and card is readable and inside the view, standing and seated (Q).
- [ ] The blue line lies on the floor and is easy to follow; it fades 10 m ahead.
- [ ] Buttons respond to a click (click twice if the first only highlights).
- [ ] Ride/Take buttons only work when you're next to them.
- [ ] The gate-change card and chime are noticeable in the top-right corner.
- [ ] Each map (Airport, Hospital, Campus, Room) loads and routes correctly in both modes.

Write **"logic proven"** next to what tests and the preview show working, and **"feel unproven"** next to what only real glasses could tell (comfort, real hand tracking, real sign recognition, real floor detection).

## Tips for the video

Real distances are long (B12 is about 57 m of route). Record each run, then cut the walking between the key moments: scan, ride, gate change, red sign, arrival.
