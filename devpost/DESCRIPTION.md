# Devpost description: Find Your Way Inside

Draft for the Devpost project page. Check the comparison section against the current products before you submit, and write "What I learned" yourself.

---

## Tagline

Any building, mapped by walking. No camera, step-free safe, with a companion to keep you company while you wait.

## Inspiration

There is no GPS indoors. In a big airport, hospital, campus or mall, a phone map makes you stop, look down and work out which way you're facing, usually while you're carrying bags, pushing a stroller or wheeling a chair. Glasses can put the way on the floor in front of you and keep your hands free.

## What it does

You look at the "You are here" sign at the entrance. Its code tells the Lens where you stand, and its web address downloads the building's map. Then you choose:

- **Go to a place.** Say where you're going, or pick it from a list or a floor-by-floor map. A blue line on the floor leads you there, showing only the next 10 m, with an arrow at the edge of your view when the next turn is out of sight. A pill shows your floor, the distance, the floors to go and the time, and a cue warns you before each floor change.
  - **Walk** takes the shortest route, escalators included.
  - **Step-Free** never uses stairs or escalators. If a lift goes out of service, the line swings to another lift or a ramp. If no step-free route is left, it leads you to the assistance point instead of leaving you stuck.
  - If your gate changes, the line swings to the new one from where you're standing.
- **Free walk.** No destination, just browsing. A small companion (a dog, a robot or a rover) walks ahead of you. It stops at the shops that match your preferences and points at them, and when there are matches on another floor it waits at the escalator and says "3 picks upstairs". Look at any shop to see up to three offers, or ignore it. Sponsored shops are always labelled, and paying never changes a route.
- **Tour.** You're shown round the shops you like, stop by stop, in the shortest order.
- **Map builder (Learn this place).** Who makes the maps? You do, by walking. Your path records itself, a height change starts a new floor, and the **Mark shop** button marks the shop you're facing. Upload hands the map to a laptop tool that checks and publishes it, so the Lens never holds a publishing token.
- **While you wait,** play with the companion: Hop (raise a hand and it jumps obstacles), catch (grab a treat, throw it, and it brings it back) and a seated version for the gate lounge. Play never changes your route, and a gate-change card ends it at once.

The same Lens runs an airport, a hospital, a campus, a room and a two-floor shopping mall. Everything building-specific comes from one small JSON map file, never from code.

## Who it's for

- Wheelchair users and anyone avoiding stairs (strollers, crutches, heavy luggage).
- First-time visitors to big buildings: travellers, patients, students.
- Building owners who don't have an indoor map yet, because they can make one by walking.

## How it's different

Based on the public descriptions of each product, to be checked before submitting:

| | Phone indoor AR navigation | Spectacles navigation sample | Find Your Way Inside |
|---|---|---|---|
| Device | Phone held up | Specs | Specs, hands free |
| Where are you? | Camera matched against pre-captured imagery | Localization against a scanned Custom Location | The building's "You are here" sign; no camera recognition |
| Who makes the map? | The provider | The developer scans the place | Anyone, by walking it with the Lens |
| Route | Arrows on screen | An arrow to a place | A line on the floor, round corners, across floors |
| Floors | Yes | No | Yes, with a cue before each change |
| Step-free | A wheelchair-accessible option | No | Never uses stairs or escalators; falls back to the assistance point |
| Changes on the way | Re-route | No | Gate change and closed lift re-route from where you stand |
| Company while you wait | No | No | A companion, plus games |

The "phone indoor AR navigation" column is Google Maps Indoor Live View, and the "Spectacles navigation sample" column is Snap's Navigation Kit. Name them on Devpost only after checking their current features.

## How I built it

- **Planned before building.** The Devpost Learn `/plan-lens` interview turned the idea into an approved design brief, and two more briefs added floors, the companion and the three modes.
- **Built with an AI coding agent** using Snap's CLAD plugin and the Lens Studio MCP server. I made the design calls, and the agent wrote the code test-first. Through the MCP, the agent ran the LEAF scenarios in the preview and read their results from the log, captured preview screenshots for review, and generated the companion models and the chime with CLAD's generators.
- **A shared TypeScript core** (routing, maps, floors, companion, play) runs both in Node, with 460 unit tests (offline: 459 pass, 1 skipped), and inside the Lens, as byte-identical copies.
- **Routing** is a plain Dijkstra search over the map graph. Step-Free is the same search with stairs and escalators left out, and a test checks that Walk is the shortest route between every pair of points. A* for big buildings is tested to give exactly the same routes.
- **LEAF tests** run inside the Lens and press the real buttons. In the last full run (2026-11-03), 39 of 48 scenarios passed first time. The 8 that failed on timing in the long batches passed when rerun, and 1 test's own path check was too slow for Lens Studio and was fixed, after which it passed.
- **The demo video** is recorded from the Lens Studio preview, so every shot is the real Lens.

## What's simulated

No Specs hardware was used. Everything was built and shown in the Lens Studio preview.

- **The sign scan** is a button labelled "on real Specs: look at the sign".
- **The building** is a stand-in model built from the map, shown in Lens Studio only.
- **Lifts** use a button, because the preview can't ride one. You walk up the stand-in stairs and escalators.
- **Shop names, offers, sponsored places and saved preferences** are invented demo data.
- **Live speech** is wired to Snap's speech module but not yet tried with a microphone; the "Say it" button and the list do the same job.
- **Real-world feel isn't proven yet:** comfort, hand tracking, position drift on long walks and lift detection.

## Challenges

- Making one Lens work for any building, by moving everything building-specific into the map file.
- Long LEAF runs stalled Lens Studio, so the suite runs in batches of about 30.
- Designing for a narrow, additive display: no dark UI, everything kept in view, and arrows for what isn't.

## What I learned

_(Alex: write this part in your own words.)_

## What's next

- Try it on real Specs in a real building.
- Detect lifts from motion, with a "Next floor" button as the fallback.
- Let venues edit shop names and offers without touching JSON.
