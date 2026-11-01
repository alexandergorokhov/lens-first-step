---
status: approved
---

# Design brief: Find Your Way Inside

## The one spatial moment
You stand at the "you are here" sign at the airport entrance, choose Walk or wheelchair (Step-Free) once, and a semi-transparent Google Maps blue line on the floor leads you through the building to your gate. Walking, it takes you up the escalator (or the stairs when they're quicker). In a wheelchair, the same trip goes round the corner to the lift. When "Gate change B12 → C3" comes up, the line swings round to the new gate.

## Why it belongs on glasses
- Uses: draws in the world (the line is on the real floor) and leaves your body free (hands on the wheelchair, the luggage or the stroller, eyes up).
- Why it's better than the phone or laptop version: indoors there's no GPS and a phone map makes you look down and work out which way you're facing. Here the route is on the floor in front of you, so a wheelchair user never has to hold a phone.

## Product or overlay
- Type: overlay. The line responds to a real building.
- What the real version would sense: the "you are here" sign at the entrance. Its code says where you stand, and its web address downloads that building's map.
- Stand-in for the preview: the sign scan is simulated. A sign in the stand-in building with a pinch button labelled "on real Specs: look at the sign" places you at the `sign` node. Everything after it is real: routing, the line, re-routing.
- Stand-in building: a simple box model of one airport floor (60 x 40 m, ground level and departures level 6 m up, C pier at 5 m), labelled "stand-in building", built from `map.json`. Never claim it finds you in a real airport.
- Map: the Lens tries to download a small `map.json` from a web address (5 s timeout). If that fails, it uses the built-in map. A small badge says "online map" or "offline map".

## Where things live
- Where the user is looking during the main task: down and ahead, at the floor 2 to 10 m in front.
- Mode panel: shows first, before the sign scan. About 1 m in front, a little below eye level, so it's readable standing or seated (default). Two big buttons: "Walk" and "Step-Free (wheelchair)". The choice holds for the whole trip.
- Sign scan button: on the "you are here" sign at the entrance, about 1.2 m off the floor (default).
- Route line: on the floor, about 1 cm above it, 30 cm wide (default). Semi-transparent Google Maps blue (about #4285F4 at 50% opacity, default) so the floor shows through. Same look in both modes (default). It fades out 10 m ahead.
- Turn arrow: a small arrow at the edge of the view pointing to the next turn when it's out of view (default: lower edge, toward the turn).
- Gate-change card: top-right corner of the view (learner's choice), short text "Gate change B12 → C3".
- Out-of-service sign: a red sign on the lift door, at eye level for a seated user (about 1.2 m, default).
- Arrival card: over the gate, within 3 m: "Gate C3. Boarding in 6 min."
- Demo controls panel: labelled "Demo controls", waist height, to the user's left, follows as they walk (default). Holds the "Gate change B12 → C3" button. Clearly not part of the real app.
- Also show the line on the sample room's real floor (a short route in the preview room).
- Look: the learner wants it pretty. Clean and polished, like modern airport signage (default): rounded panels, light text, soft glow on the line, smooth fades and a gentle swing animation when the line re-routes. Stand-in building in light, simple materials so the blue line stands out.

## Hands and input
- Choose mode: pinch Walk or Step-Free on the mode panel, once.
- Scan the sign: pinch the sign button (simulated scan).
- Lift out of service: pinch the red sign on the lift. The lift closes and the route re-plans.
- Gate change: pinch the button on the Demo controls panel.
- Lift ride: step into the lift and pinch the floor button to move up a level (default; the preview can't ride a moving lift).
- Targets are big and highlight when aimed at.
- Voice: none.

## When things show
- Mode panel: shows at start, hides once a mode is picked.
- Sign button: shows after the mode is picked, hides after the scan.
- Line: shows after the scan, shows only the next 10 m, hides on arrival.
- Turn arrow: shows only when the next turn is out of view.
- Gate-change card: shows when the gate changes, hides after about 5 s (default).
- Arrival card: shows within 3 m of the gate.
- If something needs attention out of view: the turn arrow, plus a short chime with the gate-change card (default).

## Done criteria
Each one can be checked in Lens Studio's preview.
1. Scanning the start: after choosing a mode, pinching the "you are here" sign places you at the entrance and a blue line appears on the floor toward gate B12.
2. Walking through the building: in Walk mode, following the line takes you through the hall and up the escalator to B12, and the line goes round corners with an arrow when the next turn is out of view.
3. Wheelchair: in Step-Free mode, at seated height (Q), the line goes round the corner to the lift and never uses stairs or an escalator. Pinching the red sign on Lift 1 re-routes to Lift 2.
4. Stairs when the lift is far: in Walk mode, after "Gate change B12 → C3" (pinched on Demo controls), the line swings round and takes the stairs down to the C pier. In Step-Free mode the same gate change takes the ramp.
5. Arrival: within 3 m of the gate the line stops and "Gate C3. Boarding in 6 min." shows.

## Video beats (default, to iterate later)
1. 0:00–0:20: the problem. No GPS indoors; wheelchair users get sent to stairs. "Stand-in building" label shown.
2. 0:20–0:40: the sign. Choose Walk, pinch the sign ("on real Specs: look at the sign"), the map loads (online/offline badge).
3. 0:40–1:15: Walk run. Follow the line up the escalator toward B12.
4. 1:15–1:30: gate change. "Gate change B12 → C3" top right, the line swings round, down the stairs to C3, arrival card.
5. 1:30–2:20: wheelchair run. Restart, choose Step-Free, Q to seated height. Same sign, same gate: the line goes to the lift instead. Pinch the red sign on Lift 1: re-routes to Lift 2. Gate change: the line takes the ramp.
6. 2:20–2:40: the line on the sample room's real floor.
7. 2:40–3:00: how it was built. The agent turned a floor-plan image into the route graph and the stand-in model; LEAF tests pass (Step-Free never uses stairs or escalators; Walk is the shortest).

## Any building, not just an airport
The learner wants it ready to navigate any indoor or open place: a random building, a hospital, a university campus.
- The structure is the same for every place (same map format, same router, same UI); only the map changes.
- Everything building-specific comes from the map file, never from code: node and edge positions, labels, destinations, the stand-in model, the card texts.
- Destinations are generic (`kind: "destination"` with a type such as gate, ward, lecture hall, room). "Gate" is just the airport map's word.
- Events are generic: "destination changed" (gate change, room change) and "connection closed" (lift out, door locked, path closed).
- Maps can mix indoor and outdoor edges (a campus path between buildings) and several levels.
- The stand-in model is built from the map at load, so a new map gives a new building with no code change.
- The demo stays the airport. Ship a second small sample map (a hospital or campus wing, default: hospital) to prove a map swap works.

## Out of scope
- Switching mode mid-trip (mode is chosen once).
- Real sign recognition, real positioning, real airports.
- Staff/porter mode (stretch). A full hospital or campus experience; only a small sample map proves the swap.
- Voice.

## What to cut first if behind (default order)
1. Staff/porter mode, then the second sample map (keep the code generic anyway).
2. The line on the sample room's floor.
3. The live map download (keep the built-in map and the offline badge).
4. The 10 m fade (show the whole line).
5. The turn arrow (keep the line on the corners).

## Risks and open questions
- Gate-change card in the top-right corner of the view: kept by the learner so it doesn't block the view. Risk: SPECS' view is narrow (about 32° wide), so a corner card may be missed while looking down at the line. The chime helps.
- Riding the lift and escalator in the preview: the user moves up with E or a floor button; real movement feel is unproven.
- Map download may fail in the preview; the built-in map must work on its own.
- Feel unproven: following a floor line at walking and wheeling speed, readability at seated height on real glasses.

## Existing work to reuse
- The route engine already exists in `` (the Lens Studio project): `src/core/router.ts` (Dijkstra with Walk and Step-Free rules, re-route, arrival, off-route, `loadMapWithTimeout`) and `src/core/data/map.json`.
- Route-graph format: nodes + edges JSON (`map.json`). Nodes have `kind` (sign, junction, lift, gate, assistance); edges have `kind` (walk, escalator, stairs, lift, ramp) and `open`.
- Approved scenarios S1–S9 and E1–E6 are in `devpost/SCENARIOS.md`. S3 (switch mode mid-route) is dropped from the Lens.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
