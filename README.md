# Find Your Way Inside

**Any building, mapped by walking. No camera, step-free safe, with a companion to keep you company while you wait.**

A Lens for Snap Specs, built for the Learn AR with SPECS hackathon. Everything runs and is demoed in the Lens Studio preview: no Specs hardware was used.

## The problem

There is no GPS indoors. In a big airport, hospital, campus or mall, a phone map makes you look down and work out which way you are facing. That's hardest for the people who most need help: wheelchair users, parents with strollers, people carrying bags, and first-time visitors.

Find Your Way Inside puts the route on the floor in front of you. You scan the "You are here" sign once: its code tells the Lens where you stand, and its web address downloads that building's map. A line leads you to where you're going, floor by floor, and a small companion can walk ahead of you.

## What it does

### Verified in the Lens Studio preview

Each feature below passed its LEAF test, run inside the Lens and pressing the real buttons, in the full run of **2026-11-07**: all 62 scenarios, run in two batches, passed first time. That run includes the companion picker, walking up stairs, the offers card, the three demo presets, the heard gate change, the AI picking a place (with a stand-in for the AI) and the companion speaking.

- **Route line on the floor:** shows the next 10 m only, goes round corners, and has an arrow at the edge of the view when the next turn is out of view.
- **Walk and Step-Free.** Walk takes the shortest route, escalators included. Step-Free never uses stairs or escalators.
- **No step-free route?** Then the line leads to the nearest assistance point.
- **Plans change:** a destination change (such as a gate change) or a closed lift re-routes from where you are, with a card and a chime.
- **Floors:** a distance pill with your floor, the distance, the floors to go and the time, plus a cue before each floor change.
- **Arrival** card within 3 m of the destination.
- **Any building from one map file:** an airport, a hospital, a campus, a room and a two-floor shopping mall all run with no code change. Maps download with a 5 s timeout and fall back to the copy in the Lens; a badge says "online map" or "offline map".
- **Walk up stairs, ramps and escalators** in the preview: the feet follow the steps.
- **Map builder (Learn this place):** walk a place and it becomes a map. Your path records itself, a height change starts a new floor, and the **Mark shop** button stores the shop you face. Upload hands the map to a laptop tool that checks and publishes it. A saved map survives a reload.
- **Companion (dog, robot or rover):** stays about 7 m ahead of you, drawn almost solid,, waits at the foot of stairs, escalators and lifts, stops at a shop's door instead of walking in, and never changes the route. Pick it before a walk.
- **Pointing that stays in view:** at a matching shop within about 8 m the companion steps aside from its 7 m lead, points for a few seconds in the view you look along (never behind you) and goes back to the lead, about 10 s apart, in Free walk, Go to a place and Tour. If it has been out of view for 2 s, a faint arrow on the floor near your feet points to it.
- **Showing preset:** one Inspector switch (`showingPreset` on FindYourWay) starts at the airport's entrance sign with demo controls hidden, the dog on and Walk preselected. The Options panel adds **Restart showing**, **Demo: gate change** and an Airport ↔ Preview room map switch.
- **Free walk:** browse with no destination. The companion stops at shops matching your preferences, stays in front when you turn around, and says when there are "3 picks upstairs". Look at any shop and a small card shows Sponsored (if paid) and two of its offers; pinch the gold button for up to 3. Sponsored shops are always labelled, and paying never changes a route.
- **The floor line:** a 34 cm band with a soft glow and white chevrons every 70 cm pointing the way, 60% see-through so the floor shows (the look of the first airport videos).
- **Full line while you follow:** with the companion on, the whole route on your floor is drawn, not just the next 10 m.
- **Almost screenless while walking:** only the floor line and the companion (and the turn arrow) stay in front of you. Everything else lives in one panel, **Control**, folded to a small tab once the trip starts: tap it to open (floor, metres and time to go, companion, places, end trip), **Hide** folds it, and it opens by itself when you need **Next stop** or **Stop playing**. The score chip and play hint come back when you stand still.
- **Look at a shop:** two small see-through boxes appear at the shop, one offer each (Sponsored on paid places), each with an x that closes them for that shop.
- **Tour:** visit the shops you like, stop by stop. **Multi-stop:** pick several shops and they're visited in the shortest order.
- **Go to a place:** say it, or pick from a list or a floor-by-floor map.
- **While you wait:** Hop (raise a hand and the companion jumps obstacles), catch (grab a treat, throw it, it fetches) and seated play. None of these ever changes the route.
- **The companion speaks:** short lines in a real voice, with the same words as a small caption at the companion: "Found you. Where to?", "Step-free route, no stairs.", the lift named once as you come up to it, "Wait here, I'll hold the lift.", "Up one floor.", coffee or clothes on your left or right, "Your gate moved. New route." and "You're here." One line at a time, never the same line within 8 s. **Voice: on/off** in the Control panel. The clips were made beforehand with Kokoro (open TTS, voice af_heart), so it works in the preview and offline.
- **Peek ahead:** pinch and pull toward you for a small model of your route.
- **Three demo presets** (Inspector **Demo preset**): airport in a wheelchair, mall following the dog, Free walk with the robot. Each opens ready, with a clean screen and the companion on. The panel closes up where the hidden options were.
- **Ask in your own words:** "I need coffee and a bathroom before my flight at gate 12C" becomes Café, Accessible toilet, Gate C12, in the shortest order, each leg step-free. In the preview the sentence types itself in (no microphone there).
- **Offline mode:** a switch in the Control panel simulates no internet: the map stays, the AI and the map download are off. Voice search still works from the map's own names, categories and codes; when it can't, **Where to?** (a list) and **Pick on the map** select a place without voice.
- **Preferences by voice (Free walk):** the companion asks "Same as last time: Books? Or tell me what you're into"; what you say becomes the map's categories (plain words, or the AI on Specs), and the pointer card says why it points ("Clothes · your pick").
- **The AI picks the place (Specs):** when the plain words find no place ("where can my kids run around"), an LLM (OpenAI through Snap's Remote Service Gateway) gets the sentence and the map's place list and answers with place ids only. The router checks them and plans the route, so Step-Free still holds (a toilet becomes the accessible toilet); no valid answer in 3 s and it says "didn't catch that". The gateway token stays on the PC: a test fails if one is saved in the scene. In the preview a LEAF test stands in for the LLM.
- **Offers anywhere:** look at a shop for 2 s, before, during or after a trip, and a small card shows its offers. It moves to a free corner so it never covers an open menu, and always stays in view.
- **Live captions and "heard a gate change":** speech around you shows as two rows at the bottom, translated. When a caption names another gate ("…now boards at gate B14"), the Lens asks **Re-route to Gate B14?**: Yes re-routes in your mode (Step-Free stays step-free), No keeps the trip. In the preview a sample Spanish announcement plays from **Control > Play announcement**; on Specs it is live speech. Nothing is recorded or stored.

### In progress or unproven

- **Live voice:** the **Talk** button is wired to Snap's speech module, but nobody has spoken into it yet. **Say it** and the list do the same job.
- **Seated play** passes its test, but the preview view doesn't drop when you sit, so it isn't in the demo video.
- **Photo of a floor plan to a map** (`npm run map:from-plan`): tested in Node only.
- **Real glasses:** comfort, hand tracking, tracking drift and lift detection can only be judged on Specs.

## Try it in the preview

1. Open `first-step.esproj` in Lens Studio. It was built with 5.24.1 and also runs in 5.23.2; if 5.24 gives you trouble signing in or stalls, use 5.23.2.
2. In the **Preview** panel, set device **SPECS 27**, mode **Interactive** and scene **Plane**, then reset the preview.
3. Click inside the preview so it gets your keys. **W A S D** move, **Q / E** go to seated or standing height, **Shift + A / D** turns your head, and a click is a pinch.
4. Click **Scan sign**, then pick **Free walk**, **Tour**, **Go to a place** or **Map builder (Learn this place)**.

[`devpost/PREVIEW-GUIDE.md`](devpost/PREVIEW-GUIDE.md) walks through every mode and the demo controls.

## Tests

**Unit tests** (Node 22.18 or later):

```
npm test
```

There are 622 tests (offline: 578 pass, 1 skipped). One downloads the maps from the public gist; offline, set `OFFLINE=1` to skip it. The run first checks that the Lens's copies of the core files match `src/core`; after editing `src/core`, run `npm run sync`.

**LEAF tests** run inside the Lens:
1. Select **LeafIndex** in the Scene Hierarchy and tick **autoRun**. To run only some, type their ids in **only**, separated by commas.
2. Reset the preview.
3. Read the `[FYW-LEAF] RESULT` lines and the `SUMMARY` in the Logger.
4. Untick **autoRun** afterwards.

Run them in batches of about 30, because long batches can stall Lens Studio. [`devpost/SCENARIOS.md`](devpost/SCENARIOS.md) lists every scenario and the test that covers it.

All tests run locally; no CI service is used.

## How it was built

- **Planned first.** The Devpost Learn `/plan-lens` interview produced the design brief in [`devpost/design-brief.md`](devpost/design-brief.md). Requirements are in `openspec/specs`.
- **Built with an AI coding agent** using Snap's CLAD plugin and the Lens Studio MCP server, test-first: a failing Node or LEAF test, then the code. Through the MCP, the agent ran the LEAF scenarios in the preview and read their results from the log, captured preview screenshots for review, and generated the companion models and the chime with CLAD's generators.
- **One shared core.** `src/core` is plain TypeScript with no Lens APIs. It runs in Node for tests, and the Lens keeps byte-identical copies in `Assets/Scripts` (checked by `npm run sync:check`).
- **Routing** is a plain Dijkstra search over the map's graph: `shortestTree` in [`src/core/router.ts`](src/core/router.ts). Step-Free is the same search with stairs and escalators left out. An A* version for big maps is tested to give exactly the same routes.
- **Lens:** Lens Studio, Spectacles Interaction Kit and UI Kit, in TypeScript.

## What's simulated in the preview

- **The sign scan** is a button labelled "on real Specs: look at the sign".
- **The building** is a stand-in model built from the map file. It shows in Lens Studio only, because on Specs you see the real building.
- **Saved preferences** are a preset labelled as a demo.
- **Shop names, offers and sponsored places** are invented demo data.
- **Voice and captions:** the preview has no microphone. Talk types in a set sentence, and the captions play a sample announcement with a set translation. On Specs both use Snap's speech recognition; live translation needs the LLM gateway, which is not wired yet.
- **Floor changes:** you walk up stand-in stairs and escalators, and lifts use a button, because the preview can't ride a lift.

## Credits

- **Companions:** "Animated Robot" and "Shiba Inu" by Quaternius (quaternius.com), CC0 1.0, via poly.pizza
  (`Assets/Models/Robot`, `Assets/Models/Dog`).
- **Props** (`Assets/Models/Props`), all CC0 1.0 via poly.pizza: plants, bench, palm tree, bin, floor lamp, sushi plate,
  luggage bag, info board and drinks fridge by Quaternius; coffee cup, coffee machine, coat rack, shopping bag, airport
  seat and screen by Kenney; gift box by CreativeTrio; suitcase by smallbigsquare.
- The older planter models and the gate-change chime were generated in Lens Studio with CLAD's asset generators (`Assets/GeneratedMeshes`, `Assets/GeneratedSFX`).
- UI icons in `Assets/Icons` are from an open-source icon set. Confirm the set and its licence before publishing.
- **Companion voice** (`Assets/Voice`): made with Kokoro-82M (Apache 2.0), voice af_heart, by `tools/voice/make-clips.py`.
- Lens Studio packages: Spectacles Interaction Kit, Spectacles UI Kit and Utilities, by Snap Inc.

No pre-existing code; built from Oct 28, 2026, during the submission period.
