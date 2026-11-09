# Pathpal — Round 2: what we have, what's open

Branch `companion-polish`. Work test first (TDD), keep specs, tests and docs in step, commit and push each batch.
The voice-over table below is read by test N1 (`src/core/tests/narration.test.ts`): change it together with
`src/core/narration.ts`.

## What we have now (Nov 9, `aad4d4c`, npm test 635)

Three demos, played from the Inspector's **Demo preset** (steps for judges: `devpost/PREVIEW-GUIDE.md`, "Replay
the demos from the video"), or recorded in one take by LEAF `visual-demos`:

1. **Airport, wheelchair, robot**: Talk "coffee and a bathroom before my flight 212 at gate 12C". Café > accessible
   toilet > gate, step-free (lifts only). A Spanish gate-change announcement for flight 212, captioned in English;
   "Re-route to Gate B14?" Yes; the gate agent speaks Spanish, captioned in English.
2. **Mall, follow the dog**: Talk "Bakery", one floor; the baker speaks French; then a 7 s Hop game with the dog,
   5 m ahead.
3. **Free walk with the robot**: it asks what you're into, goes on about 8 m and points at matching shops with a
   big reason card ("Clothes · your pick"); a 2 s look shows the offers card (1.5x, marked sponsored).

Also: companion voice and captions, live captions with translation, Offline mode, See map, clean screen, lean
Control panel in the demos (folded tab upper left, see-through), Restart always there, no chime.

Video: `devpost/video/pathpal-demos-v8.mp4` (2:29, narrated, git-ignored). Leaves ~30 s for Alex's own hand run.

## Done (tests in `src/core/tests/*-review.test.ts`, `camera.test.ts`, `narration.test.ts`, `captions.test.ts`)

- v2 review: floors back in the airport GLB (R2-1), nothing walked through (R2-2), café with detail (R2-3), robot
  in demo 1 (R2-4), companion 7 m ahead (R2-5), transcript 2x (R2-6), voice-over (R2-7), take re-recorded (R2-8).
- R2-10 gate change only for my flight; R2-11 demo 2 to a real place (now the Bakery, one floor).
- v3 review: R2-12 see-through tab, R2-13 smooth take camera, R2-14/25 reason card, R2-15 preferences by voice,
  R2-16 video under 3 min, R2-17 calm companion, R2-18 Offline mode, R2-19 Hide demo controls, R2-20 See map,
  R2-21 airport stairs contrast, R2-22 gate names on the map, R2-23 pick a place first, R2-24 all places reachable,
  R2-27 play with the pet, R2-29 the gate agent names flight 212.
- v6 review: R2-32/38 play 5 m ahead in the mall, R2-33 tab upper left, R2-34/39 robot points from ~8 m,
  R2-35/40 reason card 2x, R2-36 Go to a place panel ordered, R2-37 no chime, R2-41 no detour to the Bakery,
  R2-43 play 7 s at 1x, R2-44 last view, R2-45 tab label bigger, R2-46 offers 1.5x, R2-47 lean Control panel,
  R2-48 Restart, R2-49 judge replay guide.

## Open

- [ ] R2-50 Re-record (v9) so the video shows R2-45..48 (bigger tab label and offers, lean panel, Restart).
- [ ] R2-51 Alex's hand-run clip (~30 s): mall A to B, then Free walk and a sponsored shop; join it after v9.
- [ ] R2-26/30 Mall floor change: escalator sides walkable by hand, the floor line cuts through you going up;
      the fBW-fBM corridor runs over the up escalator (needs a gist map update: Alex's OK). Demo 2 avoids it.
- [ ] R2-30 Far shops popping in and out, seen by hand once (not reproduced; no distance hiding in code).
- [ ] R2-28 Free walk: the robot passes close to a vending fridge.
- [ ] R2-9 (question for Alex) Should the LLM read the announcement and propose the action? Today a rule matcher
      does; you always confirm.
- [ ] Final submission: upload to YouTube, Devpost text (`devpost/DESCRIPTION.md`), make the repo public after
      the `devpost/` polish.

## Contest rules (hard limits)

Under 3 minutes, on YouTube, the real Lens in the Lens Studio preview (narrated screen recording is fine). No
renders made outside Lens Studio, no trademarks, no copyrighted music.

### Voice-over script (R2-7 reads this table)
Short, plain, one or two sentences a beat; about 2.5 words per second. Beat = the `[VID]` mark it starts on.

| Beat | Line |
| --- | --- |
| demo 1: airport, wheelchair | There's no GPS indoors. Pathpal guides you on Snap Specs, hands free. Here, an airport, in a wheelchair. |
| talk | I say what I need, and my flight number, so it listens for my flight: coffee, a bathroom, my gate. |
| leg 1 | It plans the stops in order, step-free: lifts only, never stairs or escalators. I just follow my robot. |
| announcement | An announcement in Spanish, captioned in English. It names a new gate. |
| question | Pathpal asks first; it never changes my trip on its own. Yes: re-routed to B14, still step-free. |
| arrived | The gate agent speaks Spanish; I read it in English. Captions help if you can't hear, too. |
| demo 2: mall, follow the dog | In a mall, I just follow my dog. Easier than reading a map. |
| leg | It leads the way to the bakery, and waits for me whenever I stop. |
| arrived | The baker speaks French; I read it in English. |
| play | Waiting for a table? A quick game with my dog. |
| demo 3: Free walk with the robot | No destination? Free walk. It asks what I'm into today, and I just say it. |
| pointed | It points at shops that match, and says why. A two-second look shows offers, always marked sponsored. |
| END | Pathpal. No GPS indoors? Follow your companion. |
