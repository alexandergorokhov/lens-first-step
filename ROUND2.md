# Pathpal — Round 2 (Nov 7): what we have, what's planned

Shared between two sessions:
- **Builder session** (Claude, in Lens Studio + Node): works the checklist below, test first (TDD), ticks boxes,
  commits each finished item on `companion-polish`.
- **Iteration session** (Alex + another Claude): edits the **"Open for iteration"** parts only — the voice-over
  script, the café look, priorities. Don't edit code files the builder is on (listed per item) to avoid clashes.

## What we have now (pushed, `021da8a`)

Three demos, played from the Inspector's **Demo preset** (or recorded in one take by LEAF `visual-demos`):

1. **Airport, wheelchair** — Talk: "I need coffee and a bathroom before my flight at gate 12C". The plan is
   Café > Accessible toilet > Gate C12, all step-free (lifts only). On the way, a Spanish gate-change
   announcement is captioned in English; "Re-route to Gate B14?" Yes; the companion leads to B14, where the gate
   agent speaks (Spanish -> English captions).
2. **Mall, follow the dog** — Talk: "Take me to the food court". Walk mode; the dog waits at the escalator; the
   food court host speaks (French -> English).
3. **Free walk with the robot** — no destination; the robot leads and points at Bean There Café and Threads;
   look 2 s at a shop -> offers card.

Also in: the companion speaks (Kokoro clips + a caption at the companion, Voice on/off), AI picks the place
(LLM via Snap's Remote Service Gateway on Specs; offline matcher in the preview), live captions with
translation, clean screen, theme, animated Quaternius robot and Shiba Inu.

Video: `devpost/video/pathpal-demos-v2.mp4` (2:55).

How the gate change works today: the announcement is captioned (and translated by the LLM on Specs); a
**rule matcher** (`gateChangeOffer`, `src/core/freewalk.ts`) spots another gate code in the caption and asks
"Re-route to Gate B14?". On Yes the route changes, keeping Step-Free. The LLM does not choose the action.

## Alex's review of v2 (Nov 7)

"You walk through walls; the café needs more detail; it feels like you walk over stuff. Wheelchair demo: robot.
Companion 7 m ahead. Bigger transcript. Add a voice-over explaining what happens and the features. Keep the render
polished. Overall: I like it."

Root causes found:
- **Upper floors were missing in the Lens airport.** `export-airport.mjs` skipped every mesh with two materials,
  which is every floor slab. In the Lens you rolled through the air over the ground floor; the "bars" were the
  check-in stanchions 6 m below.
- **Shops are solid white boxes behind pale glass.** The demo stops 1.8 m from the café, so the view is one flat
  blue panel. Same at the toilet door.
- **Companion lead is already 7 m** (`companionLeadM`) but the view clamp (`VIEW_FAR_M` 6) pulls it in; check in
  the take.
- **Captions are small:** Body text at 70 cm on a 27 cm-wide band.

## Checklist (builder) — TDD: failing test, fix, green, tick

- [x] R2-1 Floors back in the GLB: `tools/demo-video/glb-parts.mjs` (one part per material), test
      `airport-glb.test.ts` GLB1-2. Re-export `npm run airport:glb` (with R2-3).
- [x] R2-2 Nothing walked through: AM tests also check balustrades, outer walls, glass fronts; the demo stops
      ≥ 3 m from a front / door, facing it. Files: `airport-model.test.ts`, `Assets/Tests/FywDemoSupport.ts`.
- [x] R2-3 Café with detail (open front, counter, espresso machine, pastry case, menu boards, barista, tables
      outside as FURNITURE); other shops get open fronts with shelves. Files: `tools/demo-video/airport.js`,
      `layout.mjs`; then `npm run airport:glb`, `npm run airport:solids`.
- [x] R2-4 Wheelchair demo uses the robot (`demo.ts`, test D2).
- [ ] R2-5 Companion 7 m ahead in all three demos. Core holds 7 m at wheelchair pace (pet.test P-R2); the Lens
      already has `companionLeadM` 7. Left: measure it in the new take (R2-8).
- [ ] R2-6 Bigger transcript: live captions, "Heard: …" line, companion caption about 2x (sizes in core, test).
      **Code done, `8f1658b` (not pushed: SSH to github timed out).** Sizes in `TRANSCRIPT` (`src/core/captions.ts`,
      test CP-R2-6/6b): captions 2x, band 40 cm, 33 chars a row; Heard 1.5x (2x needs ~5 lines in the 31 cm
      panel), grows to 3 rows via `setTextHeight`; companion 2x, 100 cm. npm test 581/581, TS compiles.
      **Left (needs the Preview panel open):** run `visual-demos` / capture: band inside the view at y -11.5
      (`FindYourWayHudUI.ts`), Heard panel grows and doesn't overlap, companion caption readable. Then tick.
- [ ] R2-7 Voice-over: one line per beat, Kokoro clips (`tools/voice`), placed at the take's `[VID]` marks and
      mixed into the edit. Test: `narration.ts` (every beat has a line, no overlap, fits before the next beat).
- [ ] R2-8 Stills check (`tools/demo-video/airport-shots.mjs`) at each demo pose, then Lens Studio: LEAF
      `visual-demos`, re-record, edit with voice-over -> `pathpal-demos-v3.mp4`. Needs the lens-studio MCP.

- [ ] R2-10 Gate change only for MY flight (beta). Lower priority than R2-2..R2-8; test first.
      Today `gateChangeOffer` (`src/core/freewalk.ts`) offers "Re-route to Gate X?" for ANY announcement naming
      another gate, so someone else's flight would trigger it.
      1. The trip holds an optional flight code ("IB3104", "212"), set from what I say or type ("my flight is
         212", or a flight code inside the Talk sentence), parsed in core, no LLM.
      2. `gateChangeOffer` takes the flight code. If set: offer only when the announcement names that flight AND
         a different gate. If not set: today's behaviour, and the card says "Beta: is this your flight?".
      3. Never re-route without my Yes. Listening stays tied to the captions switch.
      4. Demo 1: the trip's flight is 212, so GATE_CHANGE_SPEECH ("flight 212 ... gate B14") still triggers. Add a
         second scripted line for another flight and check it does NOT trigger.
      Tests first: flight parsed from "coffee and a bathroom before my flight 212 at gate 12C"; offer when flight +
      new gate match; no offer for another flight; no offer for my own gate; no flight set gives the old
      behaviour + Beta label. Lens copies byte-identical (`npm run sync`), `npm test`, commit on companion-polish.
- [ ] R2-11 Demo 2 destination: a restaurant instead of the food court (Alex: "asking for a table for two").
      Easier option: **Sushi Bar** — already in the mall map, same floor as the food court (y 5), so the same
      escalator leg and dog wait; change the Talk phrase ("Take me to the Sushi Bar"), the destination check in
      the take, and the host's line (French -> "A table for two? Right this way."). The sunglasses option (Luma
      Optics, also y 5, "how much are the Acme sunglasses?") needs a shop-assistant reply and a price in the
      offers data: more work. Tests: matcher -> sushi, host line on arrival, LEAF take.

## Open for iteration (the other session edits these)

### Voice-over script (R2-7 reads this table)
Updated Nov 7 by the pitch session to match the story (pitch/pathpal-story.md). Short, plain, one or two sentences a beat; about 2.5 words per second. Beat = the `[VID]` mark it starts on.

| Beat | Line |
| --- | --- |
| demo 1: airport, wheelchair | There's no GPS indoors. Pathpal guides you on Snap Specs, hands free. Here, an airport, in a wheelchair. |
| talk | I just say what I need: coffee, a bathroom, then my gate. |
| leg 1 | It plans the stops in order, step-free: lifts only, never stairs or escalators. I just follow my robot. |
| announcement | An announcement in Spanish, captioned in English. It names a new gate. |
| question | Pathpal asks first; it never changes my trip on its own. Yes: re-routed to B14, still step-free. |
| arrived | The gate agent speaks Spanish; I read it in English. Captions help if you can't hear, too. |
| demo 2: mall, follow the dog | In a mall, I just follow my dog. Easier than reading a map. |
| leg | It waits for me at the escalator, then leads on to the food court. |
| arrived | The host speaks French; I read it in English. |
| demo 3: Free walk with the robot | No destination? Free walk. The robot suggests places I'll like. |
| pointed | I look at a shop for two seconds and its offers appear, always labelled as sponsored. |
| END | Pathpal. No GPS indoors? Follow your companion. |

### Café look (R2-3)
Ideas welcome: colours, a name ("Café" today), what's on the counter, seating.

### Questions for Alex
- R2-9: should the **LLM** read the announcement and propose the action (re-route / keep / ask the gate
  agent), with you confirming? Today a rule matcher proposes it.
