# Devpost description: Find Your Way Inside

Draft for the Devpost project page. Check the comparison section against the current products before you submit, and check that "What I learned" sounds like you.

---

## Tagline

Any building, mapped by walking. No camera, step-free safe, with a companion to keep you company while you wait.

## Inspiration

There is no GPS indoors. In a big airport, hospital, campus or mall, a phone map makes you stop, look down and work out which way you're facing, usually while you're carrying bags, pushing a stroller or wheeling a chair. Glasses can put the way on the floor in front of you and keep your hands free.

## What it does

You look at the "You are here" sign at the entrance. Its code tells the Lens where you stand, and its web address downloads the building's map. Then you choose:

- **Go to a place.** Say where you're going, or pick it from a list or a floor-by-floor map. You can say it in your own words: "I need coffee and a bathroom before my flight at gate 12C" becomes Café, Accessible toilet, Gate C12, in the shortest order. When the plain words find no place ("where can my kids run around"), an AI model picks from the building's place list on Specs; it can only name real places, and the route planner still plans every leg, so Step-Free stays step-free. A blue line on the floor leads you there, showing only the next 10 m, with an arrow at the edge of your view when the next turn is out of sight. A pill shows your floor, the distance, the floors to go and the time, and a cue warns you before each floor change.
  - **Walk** takes the shortest route, escalators included.
  - **Step-Free** never uses stairs or escalators. If a lift goes out of service, the line swings to another lift or a ramp. If no step-free route is left, it leads you to the assistance point instead of leaving you stuck.
  - If your gate changes, the line swings to the new one from where you're standing.
  - **Live captions** show speech around you in two rows, translated into your language. When an announcement names another gate ("…now boards at gate B14"), the Lens asks **Re-route to Gate B14?** Yes re-routes in your mode; No keeps your trip. Nothing is recorded or stored.
- **Free walk.** No destination, just browsing. A small animated companion (a dog or a robot) walks ahead of you. It stops at the shops that match your preferences and points at them, and when there are matches on another floor it waits at the escalator and says "3 picks upstairs". Look at any shop to see up to three offers, or ignore it. Sponsored shops are always labelled, and paying never changes a route.
- **The companion speaks,** in short lines with the same words as a caption at its side: "Step-free route, no stairs.", "Wait here, I'll hold the lift.", "Coffee on your right.", "Your gate moved. New route.", "You're here." One line at a time, never the same one twice in 8 s, and a Voice button turns it off.
- **Tour.** You're shown round the shops you like, stop by stop, in the shortest order.
- **Map builder (Learn this place).** Who makes the maps? You do, by walking. Your path records itself, a height change starts a new floor, and the **Mark shop** button marks the shop you're facing. Upload hands the map to a laptop tool that checks and publishes it, so the Lens never holds a publishing token.
- **While you wait,** play with the companion: Hop (raise a hand and it jumps obstacles), catch (grab a treat, throw it, and it brings it back) and a seated version for the gate lounge. Play never changes your route, and a gate-change card ends it at once.

The same Lens runs an airport, a hospital, a campus, a room and a two-floor shopping mall. Three demo presets show it end to end: an airport trip in a wheelchair, following the dog to the mall's food court, and a Free walk with the robot. Everything building-specific comes from one small JSON map file, never from code.

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
| Announcements | No | No | Live captions, translated; a heard gate change offers to re-route |

The "phone indoor AR navigation" column is Google Maps Indoor Live View, and the "Spectacles navigation sample" column is Snap's Navigation Kit. Name them on Devpost only after checking their current features.

## How I built it

- **Planned before building.** The Devpost Learn `/plan-lens` interview turned the idea into an approved design brief, and two more briefs added floors, the companion and the three modes.
- **Built with an AI coding agent** using Snap's CLAD plugin and the Lens Studio MCP server. I made the design calls, and the agent wrote the code test-first. Through the MCP, the agent ran the LEAF scenarios in the preview and read their results from the log, captured preview screenshots for review, and generated the companion models and the chime with CLAD's generators.
- **A shared TypeScript core** (routing, maps, floors, companion, play) runs both in Node, with 579 unit tests (offline: 578 pass, 1 skipped), and inside the Lens, as byte-identical copies.
- **Routing** is a plain Dijkstra search over the map graph. Step-Free is the same search with stairs and escalators left out, and a test checks that Walk is the shortest route between every pair of points. A* for big buildings is tested to give exactly the same routes.
- **LEAF tests** run inside the Lens and press the real buttons. In the last full run (2026-11-07), all 62 scenarios passed first time, in two batches of about 30.
- **The demo video** is recorded from the Lens Studio preview, so every shot is the real Lens.

## What's simulated

No Specs hardware was used. Everything was built and shown in the Lens Studio preview.

- **The sign scan** is a button labelled "on real Specs: look at the sign".
- **The building** is shown in Lens Studio only: the airport is a concept model of the terminal, the other places are stand-ins built from the map.
- **Lifts** use a button, because the preview can't ride one. You walk up the stand-in stairs and escalators.
- **Shop names, offers, sponsored places and saved preferences** are invented demo data.
- **Live speech** is wired to Snap's speech module but not yet tried with a microphone. In the preview, Talk types the sentence in, and the announcement and the people you meet are scripted lines with a fixed translation.
- **The AI model** (OpenAI through Snap's Remote Service Gateway) is wired for Specs but not run in the preview; the tests use a stand-in that answers like it, including a bad answer and no answer.
- **The companion's voice** is a set of clips made beforehand with an open TTS model (Kokoro), not live speech.
- **Real-world feel isn't proven yet:** comfort, hand tracking, position drift on long walks and lift detection.

## Challenges

- Making one Lens work for any building, by moving everything building-specific into the map file.
- Long LEAF runs stalled Lens Studio, so the suite runs in batches of about 30.
- Designing for a narrow, additive display: no dark UI, everything kept in view, and arrows for what isn't.

## What I learned

- **You can build for glasses without the glasses.** I never had Specs. Lens Studio's preview, a stand-in building and tests that press the real buttons were enough to build and check the whole trip. What I still can't know is how it feels on your face, and I say so.
- **Tests first works for AR too.** Writing the LEAF scenario before the feature caught things I would never have seen by eye: a caption left over from the last demo, a gate question about the wrong gate, a route that crossed a shop.
- **Step-free has to be a rule, not a filter.** If the AI picks a place, the router still checks it. In a wheelchair the bathroom becomes the accessible toilet, and a place with no step-free way in is dropped.
- **An additive display changes the design.** Black is invisible, so there are no dark panels. Small text and anything off to the side get lost, so the screen stays almost empty while you walk.
- **Working with an AI agent is a skill.** Claude did the typing through Lens Studio's MCP. My job was to decide what the product is, say no to extras, and check every claim against a test or the preview.
- **Read the version before you install.** The newest Remote Service Gateway needed packages this project didn't have. The older 2.0.1 had everything I needed.

## What's next

- Try it on real Specs in a real building.
- Detect lifts from motion, with a "Next floor" button as the fallback.
- Let venues edit shop names and offers without touching JSON.
