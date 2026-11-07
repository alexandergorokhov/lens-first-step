# Pathpal demo plan (Nov 6 to Nov 9)

## ROUND 2 (Nov 7): see ROUND2.md (current state, checklist, voice-over script)

## HANDOFF (updated Nov 6, 12:20 — read first)

**Nov 7, 04:30:** pushed `961bc85` Devpost "What I learned" draft + devpost/SOCIAL.md; `021da8a` add-on A, the companion speaks (14 Kokoro af_heart clips in Assets/Voice via tools/voice/make-clips.py, caption at the companion, Voice on/off; Node SP1-SP6, LEAF sa1). Node 570/570. Full LEAF 62/62 first time. Runner off.

**Nov 7, 00:55:** pushed `18a2562` add-on B (the AI picks the place; RSG v2.0.1 — v4 needs newer UIKit/IK, removed), toilet doors in the airport GLB, gist updated; `0b3232f` captions cleared on restart; `fbc9e6b` gate agent speaks of your gate. New video devpost/video/pathpal-demos-v2.mp4 (2:55). Node 564/564. Left for Alex: Devpost text, repo public; a gateway token only on his PC (never commit; test R10).

**Nov 6, 21:15:** committed (NOT pushed): `ad9fff0` offers card clear of menus, `a4fc878` vw1 pace, `a76344d`
add-on D "heard a gate change" (Play announcement -> Spanish caption -> "Re-route to Gate B14?" Yes/No; LEAF cr1)
+ no empty band on "Where would you like to go?" (mp1) + bg1 updated for the airport model. Full LEAF run: 60
scenarios, 58 first time, vw3 passed on rerun (flake), bg1 updated -> pass. Node 558, 557 pass; S9 (online) fails
until the public gist map is updated (needs Alex's OK). Runner autoRun OFF. Left for Alex: play the 3 presets by
hand, toilet-block detail, re-record video, gist update, Devpost text, repo public, push.

Everything below is committed and pushed on `companion-polish` (see `git log`). Node: 544 tests (offline 543 pass,
1 skipped). LEAF: all demo/affected scenarios pass (last batch 8/8; full regression 59/59 earlier). LEAF runner
autoRun is OFF in the saved scene, Demo preset "Off": a preview reset gives the app, ready to play by hand.

### Done
- Task 0-4 as planned, plus Alex's extras:
  - **Ask in your own words** (Talk): "I need coffee and a bathroom before my flight at gate 12C" -> Café > Accessible
    toilet > Gate C12, step-free, each stop leading on to the next (`planAsk`, `src/core/freewalk.ts`; LLM prompt and
    reply check ready, not wired to Snap's gateway: needs Alex's tokens on his PC only).
  - **Wheelchair only by lifts**: the C pier ramp is now a lift (`liftC`, lobby `cLiftHall` off the concourse).
    Walk takes the stairs (quickest). Test V6 + AM1-AM3.
  - **The concept video's airport** is the airport in the preview: `npm run airport:glb` exports
    `tools/demo-video/airport.js` to `Assets/Models/Airport/airport.glb` (StandIn `airportModel` input). Its solids
    (`npm run airport:solids` -> airport-solids.json) stop hand walking in the preview; tests check no demo leg
    crosses shops, desks, seats, people or lift glass. Seats/people are data in `tools/demo-video/layout.mjs`.
  - **Mall**: upper floors have openings over escalators/stairs (no riding through the ceiling); real stair treads,
    nosings and handrails; 44 CC0 props (`npm run props`).
  - **Offers**: look at a shop 2 s -> small glass card top right, max 2 offers, bigger text (HUD `OffersCard`).
  - **Live captions** (add-on C): 2 rows at the bottom, translated (`src/core/captions.ts`,
    `FindYourWayLiveCaptions`). In the preview a person (CC0 Quaternius, `Assets/Models/People`) stands in front
    of you on arrival and speaks: gate agent at Gate C12 (Spanish -> English), food court host (French -> English).
    On Specs: Snap ASR; translation needs the LLM gateway (not wired).
  - Animated Quaternius robot + Shiba Inu companions, rover removed; theme (`src/core/theme.ts`), pop-in panels.
- Video takes: `devpost/video/pathpal-demos.mp4` (first cut, before the airport model) and `demos-raw2.mp4` (raw,
  with the airport model; before the lift/collision/people fixes). Gitignored.

### Offers fix (Nov 6, 12:40, pushed but NOT yet run in the preview)
- Alex: "when I look at the shops I do not see offers in the mall". Data is fine: every mall shop has 1-2
  offers (except the cash machine); sponsored: Bean There Café, Second Skin, Ice Cream.
- Cause: the 2 s look only ran during a trip or a Free walk, and off a trip `followAppPanel` hid the card
  every frame. Fixed in FindYourWayMain: the look runs before a trip (choose / mode / prefs), on it and after
  arriving; only scan / loading / mapping / error hide the card.
- New LEAF `o1-offers-anywhere` (FywO1OffersAnywhereScenario): in the mall before any trip, look at Threads
  -> nothing at 1.2 s, its offers by ~2 s (1-2 lines); look at Bean There Café -> card says Sponsored; look
  away -> hidden. **Ran Nov 6 16:48: PASSED (75 s).** Screenshot at the Threads look: card top right, 2 lines,
  readable, but it sits over the "What would you like to do?" panel (and the "online map" badge covers the shop
  sign). FIXED in ad9fff0 (not pushed): the card moves to a clear corner, always inside the view (Node
  offers-slot.test.ts; o1 checks overlap 0 + in view). Regression batch 16/16 after a4fc878 (vw1 walked too
  fast to see its point; now at walking pace). Not pushed. Next: Alex plays the 3 presets by hand.

1. Open Lens Studio, `/mcp` reconnect. Play each preset by hand once (Inspector "Demo preset", reset preview):
   airport (Talk, lift 1, café, toilet, C pier lift, Gate C12 + gate agent speaking), mall dog (escalator, food court
   host), mall robot (stops at Bean There Café and Threads, look 2 s for offers).
2. Fix what looks off. Known small things: the concept toilet block sits by the accessible-toilet node; the Go to a
   place panel keeps an empty band where the interest chips were; the gate agent's talk clip is "Interact"/"Wave"
   (no real talk animation in the CC0 pack).
3. Re-record: runner only=visual-demos (FywDemoVideoScenario), ffmpeg gdigrab of the Lens Studio window only
   (`title=...`, never the desktop), crop to the preview; edit with titles + caption line (see the session's
   `edit.txt` recipe: trim, 1.2x, drawtext titles, "voice shown as typed" caption). Lens Studio must be in front.
4. Update the gist map copy (Gate C12, C pier lift) only with Alex's OK; README/Devpost text; make the repo public.

Lens Studio crashed twice on a preview refresh right after a recompile: save first, pause before refreshing.

## The demo (what Alex will show, by hand, in the Lens Studio preview)

1. **Airport, wheelchair, A to B by voice.** Seated view, Step-Free. Alex asks "Take me to gate 12C"; the line and
   the companion lead through the lift and the C pier ramp to Gate C12.
2. **Mall, follow the pet, A to B by voice.** Walk mode. Alex asks for a shop on another floor (suggested: "Take me
   to the Sushi Bar", first floor); the dog leads, waits at the escalator, arrives.
3. **Free walk with the robot.** The robot leads and points at **2 businesses**: Bean There Café and Threads (both on
   the mall's ground floor, two offers each). Alex looks at each and sees its offers.
4. **A clean screen and professional-looking models** in all three.

The AI add-ons (spoken companion, LLM) are optional, at the end of this file. Build them only after Task 5.

## Schedule

| Day | Work |
| --- | --- |
| Thu Nov 5 night | Task 0 (sync) |
| Fri Nov 6 | Task 1 (clean screen), Task 2 (voice + Gate C12) |
| Sat Nov 7 | Task 3 (demo presets): all three demos work end to end by Saturday midday. Then Task 4 (models, look) |
| Sun Nov 8 | Finish Task 4, Task 5 (rehearse, full test run, freeze at night) |
| Mon Nov 9 | Alex: video, README, Devpost, repo public, submit before 19:00 ART |

If Task 4 runs over, the demo still works with the old companion bodies. Add-ons only if Sunday has time left.

## Voice in the preview: say it plainly

Snap's speech recognition (ASR) is documented as "only available on Spectacles", and the Talk button has never been
heard in the preview. So:

- The demo uses a **preview stand-in**: pressing Talk in the preview shows the request typing in as if heard
  ("Take me to gate 12C"), then runs the **real** matcher and router on that text. On Specs, the same button uses
  live ASR, with no code change.
- Alex can say the line out loud while recording, but the Lens is not hearing him in the preview.
- The video and Devpost text must say so, for example a caption: "Voice shown as typed in the preview; live speech
  on Specs."
- Try live ASR in the preview once (Task 2); if it does work, keep it and drop the label.

## How to run this plan

1. Open Lens Studio with `first-step.esproj` first.
2. In PowerShell: `cd` into the project folder (the one with first-step.esproj), then `claude` (use `npx.cmd` if you need npx).
3. Check `/mcp` shows **lens-studio** connected and `/plugin` shows **ls-clad**.
4. Say: `Follow POLISH-PLAN.md. Do the next unchecked task. Stop at the end of each task and show me.`

Tick the boxes in this file as tasks finish, so the next session knows where we are.

## Ground rules (every task)

- **Use CLAD.** Load the skills named in each task (`/lens-studio-router` first if unsure). Check every change with
  `/verify-preview` and show Alex a preview screenshot.
- **Test first.** Write the failing Node test (`src/core/tests`) or LEAF scenario (`Assets/Tests`) first, see it fail,
  then write the code. Run `npm test` before saying a task is done.
- **Where things live.** Shared logic is in `src/core` and is copied into `Assets/Scripts` by `npm run sync` (run it
  after every `src/core` edit; `npm test` fails if the copies differ). Maps are in `src/core/data` and copied to
  `Assets/Maps`: the **airport is `src/core/data/map.json`** (Lens copy `Assets/Maps/airport.json`), the mall is
  `mall.json`. Never edit `Assets/Maps` or the synced copies by hand.
- **Lens Studio MCP only through its MCP tools.** Never call it over HTTP (no curl/fetch to localhost). If the MCP is
  missing, stop and tell Alex (see AGENTS.md).
- **Don't use the simulated hand-pinch preview tool** (PreviewInteractTool / `/specs-preview-interaction`). On Nov 4 it
  auto-installed packages and broke the TypeScript build. Use LEAF scenarios to press buttons instead.
- **Alex drives the preview.** Running LEAF resets the preview, so ask Alex before each LEAF run.
- **No GitHub Actions or CI files.** All checks run locally.
- **Commit per task** on `companion-polish` with a short message. **Don't push** unless Alex says so.
- Don't commit the uncommitted video-take files (`Assets/Tests/Fyw*VideoScenario.ts`, `FywMallVideoBase.ts` and their
  LeafIndex entries) or this file, unless Alex says so. You may read them: they already script the airport
  wheelchair trip and the mall trips and are a good starting point for the demo checks in Task 3.
- Run LEAF in batches of about 30 (long batches stall Lens Studio). Untick LeafIndex **autoRun** afterwards.
- Keep the Lens under 25 MB.

## Task 0: get the Nov 5 fixes onto this PC (15 min)

The fixes for Alex's Nov 5 feedback (shops flat on the walls, the airport keeps its own look, clear picks in Free
walk) are commit **039f03f** on GitHub `companion-polish`. If `git log -1` already shows 039f03f, only the last two
steps are left.

- [x] `git fetch origin companion-polish`
- [x] `git status` and show Alex the list. Don't stash, reset or discard anything.
- [x] `git merge --ff-only origin/companion-polish`. If it refuses, stop and ask Alex.
- [x] `npm test` (set `OFFLINE=1` if offline).
- [ ] Alex checks in the preview: no mid-floor shops in the mall, the airport isn't dressed as a mall, Free walk shows
      which interests and companion are picked. Anything still wrong goes to the top of Task 1.

## Task 1: clean screen, no announcements (Must, ~0.5 day)

Goal: while walking, the view holds only the floor line, the companion, the turn arrow when needed, and the offer boxes
in Free walk. No banners, toasts, hints, badges or pop-up cards.

CLAD skills: `/specs-build-ui`, `/verify-preview`, `/specs-leaf-write-scenarios`.

- [ ] List every text or panel that can appear on its own during a trip (search the `*UI.ts` scripts and
      FindYourWayHudUI): for example the "online/offline map" badge, score chip, play hint, "3 picks upstairs" note,
      floor cue, distance pill, plan-change card, ride card, arrival card, demo controls, debug text. Show Alex the
      list before changing anything.
- [ ] Add an Inspector switch `cleanScreen` (Task 3's demo presets turn it on). With it on:
    - Badges, hints, score chip, debug and demo controls: never shown.
    - Floor cue and ride card: replaced by the companion's own cue (it waits and turns toward the lift or escalator).
      The ride button itself stays, small, at the lift or escalator, since the trip needs it.
    - Arrival: one small card for 3 s, then gone.
    - The Control tab stays folded; it opens only when Alex taps it.
- [ ] Test first: LEAF scenario `FywCs1CleanScreenScenario` with `cleanScreen` on, on two existing trips (airport
      Step-Free to Gate B12, mall Walk to a first-floor shop) and a short Free walk. It fails if any text other than the
      allowed set (offer boxes, ride button, arrival card, voice caption) is visible during the walk. Task 3 adds the
      demo presets to it.
- [ ] `/verify-preview` screenshots mid-walk in the airport and the mall.
- [ ] Commit: "Clean screen while walking".

## Task 2: "Take me to…" by voice, with the preview stand-in (Must, ~0.5 day)

CLAD skills: `/specs-asr`, `/verify-preview`.

- [ ] **Try live ASR once** (5 min, with Alex): open Go to a place, press Talk, speak. Note what the Logger says. If it
      transcribes in the preview, keep it as the main path.
- [ ] **Add Gate C12** to the airport map (`src/core/data/map.json`, then `npm run sync`). Today the C pier has only
      Gate C3, off `cJunction` (reached from `cTop` by stairs or by `rampC`). Add `gateC12` as a gate off `cJunction`,
      inside the map's footprint, with a walk edge. Test first: the Step-Free route from the entrance sign to Gate C12
      uses a lift and the ramp, no stairs or escalators; the Walk route exists too.
- [ ] **Matcher for gate codes** (`matchDestination` in `src/core/freewalk.ts`). Test first: "take me to gate 12C",
      "gate 12 C", "gate C12", "C 12" all match Gate C12; "gate 12" alone doesn't silently pick C12; "take me to gate
      B12" still matches Gate B12. Existing matcher tests stay green.
- [ ] **Preview stand-in in the Talk button.** If ASR isn't available or gives nothing within about 1.5 s, the button
      runs the map's demo phrase (`place.sayIt`): the caption types it in word by word over about 1.5 s ("Heard: Take me
      to gate 12C"), then the real matcher and router take over. Airport `sayIt` = "Take me to gate 12C". Mall `sayIt`
      = "Take me to the Sushi Bar" (it is "Take me to Bolt Hardware" today).
- [ ] Hint under Talk in the preview: "Preview: voice shown as typed. Live speech on Specs." (the clean screen allows
      it on the Go to a place panel, not during the walk).
- [ ] LEAF scenario `FywV2VoiceStandInScenario`: Talk in the airport → caption shows the phrase → destination Gate C12
      → Step-Free route through a lift. The existing `FywV1VoiceScenario` stays green.
- [ ] Commit: "Talk: gate codes and the preview stand-in".

## Task 3: the three demo presets (Must, ~0.5 day)

Goal: Alex picks one Inspector setting and presses Reset preview; the scene opens ready for that demo, then he drives
it by hand (W A S D, Shift + A / D to turn the head, Q / E seated or standing, click to pinch).

- [ ] Replace the single `showingPreset` switch with `demo` = `off | airportWheelchair | mallPet | freeWalkRobot`
      (`off` keeps today's Inspector settings; move the old preset's extras, such as Restart showing, into all three
      demos). All demos: `cleanScreen` on, demo controls hidden, start at the map's entrance sign.
    - **airportWheelchair:** airport map, dog, Step-Free preselected, seated view (eyes about 45 cm lower), Go to a
      place open with Talk ready.
    - **mallPet:** mall map, dog, Walk preselected, standing, Go to a place open with Talk ready.
    - **freeWalkRobot:** mall map, robot, Free walk with interests coffee and clothes, so the robot points at Bean
      There Café (`cafe`, sponsored) and Threads (`threads`). Looking at each shop shows its two offer boxes.
- [ ] Check the walk in demo 3 passes both shops within about 8 m and the robot's points stay in view (the existing
      in-view rules). If not, change which shops match, not the shops.
- [ ] Test first: one LEAF scenario per demo (`FywDemoAirportScenario`, `FywDemoMallPetScenario`,
      `FywDemoFreeWalkRobotScenario`) that sets the preset, plays the trip quickly (reuse the moves from the uncommitted
      video-take scenarios) and checks: arrival at Gate C12 through a lift; arrival at the Sushi Bar with the dog
      waiting at the escalator; the robot pointed at both shops and both offer boxes opened. Add the three presets to
      `FywCs1CleanScreenScenario`. Update `FywSh1ShowingPresetScenario` for the new switch.
- [ ] Update `devpost/PREVIEW-GUIDE.md` with one short section per demo: the setting to pick and the keys to press.
- [ ] Commit: "Three demo presets".

## Task 4: professional 3D models and look (Must, ~1 day, robot timeboxed)

Goal: the dog and robot look like real, animated characters, not shapes built from spheres. The panels look like one
product. The demos already work at this point, so a failed model swap costs nothing but time.

### 4a. Companion models

Today `FindYourWayRigMesh` builds the companions from coloured spheres. Replace the body only; keep all behaviour
(7 m lead, waits at stairs/escalators/lifts, stops at shop doors, points at shops, Hop, catch).

Models (both CC0, free for the public repo and video). **Ask Alex to download them first**; nothing is in the repo yet:
- Robot: Quaternius **Animated Robot** https://quaternius.com/packs/animatedrobot.html (FBX; idle, run, wave, yes,
  no, thumbs up, jump, sitting). Convert FBX to GLB in Blender if Lens Studio drops the animations.
- Dog: Quaternius **Ultimate Animated Animals** https://quaternius.com/packs/ultimateanimatedanimals.html (glTF; walk,
  gallop, jump, idle). Check the zip has a dog (husky or shiba) before starting.

CLAD skills: `/scene-construction`, `/materials`, `/specs-optimize-lens-mesh`, `/verify-preview`.

- [ ] Robot first (it stars in demo 3). Test first: add a LEAF check that the robot plays walk/run while moving, idle
      while waiting and wave/point while pointing at a shop. The companion scenarios (FywCompanionScenario,
      FywCompanionPickScenario, FywVw1-3, FywP3WaitsAtEscalator, FywPlay, FywGt1, FywPc1) and the three demo
      scenarios stay green.
- [ ] Import into `Assets/Models/Robot/`. Bright material that reads on an additive display (no near-black parts).
      About 45 cm tall. Soft round shadow on the floor under it.
- [ ] Swap only the body: FindYourWayPet / FindYourWayCompanionView keep deciding where it goes; the model plays clips
      by state.
- [ ] **Stop rule:** if the robot isn't walking correctly after about 4 hours, stop, revert the body swap, and tell
      Alex. Fallback: keep the sphere bodies with the new palette, a floor shadow and smoother motion.
- [ ] Then the dog (stars in demos 1 and 2): walk, idle, sit while waiting at the lift or escalator.
- [ ] Check triangle counts; decimate anything over about 10k triangles.
- [ ] Remove the **rover** from the companion picker (dog and robot only). Update tests that expect 3 companions.
- [ ] Add a "Credits" section to README.md: Quaternius models (CC0), font, icons.
- [ ] Commit: "Animated robot and dog companions (Quaternius, CC0)".

### 4b. One look

CLAD skills: `/specs-build-ui`, `/font-selector`, `/materials`.

- [ ] Test first: LEAF check that no visible panel is darker than 0.5 luminance and all text opacity is 0.9 or more.
- [ ] Add `Assets/Scripts/FindYourWayTheme.ts` that every UI script reads. Colours with one job each: route and "you"
      teal; Step-free blue (with the wheelchair icon); plan changed amber; arrived green; Sponsored gold, always with
      the word "Sponsored". White see-through panels at 3 opacities only, no dark backing (black is invisible on
      Specs). One free font (Manrope or Inter, OFL) in 3 sizes.
- [ ] Panels and offer boxes fade and scale in over about 200 ms; no pop-in.
- [ ] Commit: "One theme for panels, cards and offers".

## Task 5: rehearse and freeze (Sun Nov 8)

- [ ] Alex runs each demo by hand twice. Anything that looks off goes to a short fix list; fix only those.
- [ ] Full LEAF run in batches of about 30, rerun timing failures once, write the real numbers in README (one set of
      numbers everywhere).
- [ ] `npm test` green. Commit, then ask Alex whether to push.

## Monday Nov 9 (Alex)

- Alex records the video by hand from the preview (under 3 min, no music or trademarks), with the voice caption label.
- README and Devpost text: what each demo shows, "How it was built" (CLAD, the MCP, test-first), disclosures
  (preview footage, voice shown as typed in the preview, CC0 models, AI help).
- Make the repo public. Alex submits before 19:00 ART.

---

## Add-ons (optional, only after Task 5)

Not part of the demo. Build behind an Inspector switch `aiAssistant`, default **off**, so they can never break a demo.
Do A first; B and C share the same LLM call, so build B's parts once and reuse them in C.

### Add-on A: the companion speaks (works in the preview)

Live TTS through Snap's services isn't shown working in the preview, so use short clips made beforehand with an open
TTS model (Kokoro, voice af_heart, the same as the narration). Ask Alex for them: Claude in the project thread makes
them; they go in `Assets/Voice/`.

| Key | Line |
| --- | --- |
| `start` | Found you. Where to? |
| `step_free` | Step-free route, no stairs. |
| `lift_left` | Lift on your left. |
| `hold_lift` | Wait here, I'll hold the lift. |
| `up_floor` | Up one floor. |
| `coffee_right` | Coffee on your right. |
| `clothes_left` | Clothes on your left. |
| `gate_moved` | Your gate moved. New route. |
| `arrived` | You're here. |

- [ ] Test first (Node): `speechFor(event)` in `src/core` maps trip events to a key, and never repeats a line within 8 s.
- [ ] `FindYourWaySpeech.ts` plays one clip at a time through one AudioComponent and shows the same words as a small
      caption under the companion (counts as allowed in the clean screen). **Mute** in the Control panel.
- [ ] Commit: "The companion speaks". CLAD skills: `/specs-audio`.

### Add-on B: LLM picks one place (live on Specs only)

For requests the plain matcher can't place, like "somewhere quiet to sit near my gate" or "I need something for a
headache".

Flow:
1. Speech to text: Snap ASR (already wired in FindYourWayVoice).
2. The plain matcher tries first. If it finds a place, route as today; no LLM call.
3. Otherwise send the LLM the text plus the map's place list only (id, name, floor, category), through Snap's
   **Remote Service Gateway** (package from the Asset Library; OpenAI `gpt-4.1-nano` or Gemini
   `gemini-2.5-flash-lite`). Ask for JSON only: `{"placeId": "...", "reply": "..."}`, `placeId` null if unsure.
4. **The LLM never routes.** Check `placeId` exists in the map, then the normal router plans it, so Step-Free rules and
   "sponsored never changes the route" stay guaranteed. Unknown id, bad JSON or timeout (3 s) → "Didn't catch that,
   try the list".
5. The reply shows as the caption (and speaks, on Specs, through OpenAI TTS on the same gateway).

- [ ] Test first (Node, `src/core/ask.ts`): `parsePick(json, map)` with a fake LLM reply: good id, unknown id,
      malformed JSON, null. `buildPrompt(text, map)` lists only place ids, names, floors and categories.
- [ ] Lens side: `FindYourWayAsk.ts` sends the prompt through the gateway and hands the parsed id to Main. Can't be
      run in the preview; describe it in Devpost as "built for Specs, not shown in the preview".
- [ ] Commit: "Ask: the LLM picks a place". CLAD skills: `/specs-ai-remote-service`, `/specs-asr`.

Safety and setup:
- Gateway tokens are tied to Alex's Snapchat account and **must never be committed**. Enter them only in the
  `RemoteServiceGatewayCredentials` component on the PC; check `git diff` before every commit; revoke if one leaks.
- The gateway needs Lens Studio 5.10.1+ and a recent Specs OS; the experimental-API setting adds a watermark and blocks
  publishing, so check which mode it needs before turning it on.

### Add-on C: "Ask in your own words": a sentence becomes ordered stops

Example: "I need coffee and a bathroom before my flight" becomes **Café → Accessible toilet → Gate C12** (step-free) or
**Café → Toilets → Gate C12** (walk), in the shortest order, with the gate last.

**The LLM only picks the places. The route engine orders and routes them.** Dijkstra (`findRoute`) gives every leg,
and `orderStops` in `src/core/trip.ts` picks the shortest order, as multi-stop trips already do.

Flow:
1. The traveller says or types the sentence (Talk, or the preview stand-in below).
2. The LLM gets the sentence plus the map's place list (id, name, floor, category) and returns JSON only:
   `{"needs": [{"category": "coffee", "placeId": "cafeD"}, {"category": "toilet", "placeId": null}], "end": "gateC12",
   "reply": "Coffee, then the toilets, then your gate."}`. It may name a category instead of a place.
3. Plain code checks and fills it in: every `placeId` must exist in the map; a category with no place becomes the
   **nearest** place of that category from where you stand (by route length, for the current mode, so Step-Free picks
   the accessible toilet); `end` must be a destination in the map, or the trip's current destination, or none.
4. `orderStops` orders the stops; the end stop stays last. The trip runs as a normal multi-stop trip ("Stop 1 of 3:
   Café"), companion and clean screen included.
5. Anything invalid → no trip starts; the caption says "Didn't catch that, try the list".

**Preview stand-in (same idea as the Talk stand-in):** the gateway doesn't run in the preview, so with `aiAssistant`
on, Talk types in the map's `askIt` phrase ("I need coffee and a bathroom before my flight") and an **offline
picker** returns the same JSON shape from keywords (coffee, bathroom/toilet, food, pharmacy, gate + code). The
caption says "Preview: offline stand-in for the AI. Live on Specs." On Specs the LLM replaces the offline picker; the
checking, ordering and routing code is the same in both.

- [ ] Test first (Node, `src/core/ask.ts` and `src/core/tests/ask.test.ts`):
    - `parseStops(json, map)`: unknown ids dropped; a category resolves to the nearest place of that category for
      the mode (Step-Free → accessible toilet); `end` kept last; malformed JSON → nothing.
    - `orderStopsWithEnd(start, stops, end, dist)` in `src/core/trip.ts`: shortest order of the stops, `end` always
      last; existing `orderStops` tests stay green.
    - `offlinePick(sentence, map)`: "I need coffee and a bathroom before my flight" → coffee + toilet, end = the
      trip's gate; "take me to gate 12C" → no stops, end Gate C12.
    - The full sentence on the airport map, from the sign, Step-Free → Café, Accessible toilet, Gate C12, every leg
      step-free.
- [ ] Lens side: wire Talk (with `aiAssistant` on) through `offlinePick` in the preview and the gateway on Specs, then
      start the multi-stop trip. Add `askIt` to the airport map's `place`.
- [ ] LEAF scenario `FywAsk1OwnWordsScenario`: airport, Step-Free, Talk → caption shows the sentence → trip starts as
      "Stop 1 of 3" with the café first and the gate last.
- [ ] Commit: "Ask in your own words: stops in order".

Use in the demo only if it is solid by Sunday afternoon: it would extend demo 1 ("I need coffee and a bathroom before
my flight"), with the "offline stand-in" caption visible.

### Add-on D: "Heard a gate change": captions that keep the trip right (deaf or hard of hearing; idea from Alex, Nov 6)

**Alex wants this on Fri Nov 6 if it fits in a day (Alex travels Sat Nov 7).** Do it right after the current work is committed (the
HANDOFF "Left" list: commit per task first, so nothing is lost), before the video. Behind an Inspector switch
`liveCaptions`; the `airportWheelchair` demo preset turns it on. Timebox: one working day; stop rule below.

**Today's scope (preview-first, reuse what exists):**
1. Caption panel: reuse the voice caption (word-by-word typing, `typingSeconds`) and the clean-screen allowed caption.
2. "Play announcement" button in the Control panel (and a key in the demo preset) types the sample announcement.
3. Gate spotting: reuse `joinCodes` / `matchDestination` on the caption text; also flag boarding/delayed/cancelled.
4. "Re-route to B14?" card; pinch yes → new route to B14, same mode (Step-Free stays step-free). No → card goes away.
5. Translate switch, preview only as a fixed pair: the announcement is in Spanish ("Atención: el vuelo 212 a Madrid
   embarca ahora por la puerta B14"), the caption shows English big, Spanish small. Label: "Preview: sample
   announcement and translation. Live on Specs."
6. Live path on Specs: a thin `FindYourWayCaptions.ts` adapter that sends AsrModule continuous results into the same
   caption code. It can't be tested without paired Specs, so say so in README; don't spend more than 30 min on it.
**Cut today:** live LLM translation over the Remote Service Gateway (needs tokens + device); keyword flags beyond the
gate code; any new art. **Stop rule:** if the re-route card isn't working by mid-afternoon, ship steps 1 to 3 only
(caption + highlighted gate) and keep the rest for after the trip.

Why this shape (research, Nov 6): plain live captions on Spectacles already exist many times over (Snaption Live at
DubHacks '24, EchoLens, VisibleVoice, HandSpeaker and SnapSign in Snap's hackathon showcase, plus Snap OS translation
and caption glasses like XRAI, AirCaps and Captify). What none of them do is act on what was heard. Pathpal's angle:
a deaf traveller misses the spoken "Flight 212 now boards at gate B14"; Pathpal shows it as a caption, spots the gate
code, and offers "Re-route to B14?" on the step-free route.

- Caption: speech around the wearer shown under the line of sight, two lines at most, fading after 4 s. It is the one
  allowed caption on the clean screen; never covers the floor line or the companion.
- Trip words: flag "gate", "boarding", "delayed", "cancelled" and any gate code in the map (reuse the Task 2 gate-code
  matcher). A gate code that is not the current destination → a "Re-route to B14?" card; accept → new route keeps the
  current mode (Step-Free stays step-free).
- On Specs: Snap ASR (`AsrModule`, as used by Talk in FindYourWayVoice) in continuous mode. Docs say ASR is only
  available on Spectacles, so it cannot run in the preview.
- In the preview: a "Play announcement" button in the Control panel feeds a fixed sentence through the same caption
  and keyword code, word by word, with the label "Preview: sample announcement. Live speech on Specs." Same honesty
  rule as the voice stand-in.
- Privacy line in the Lens and on Devpost: nothing is recorded or stored.
- Tests: Node for the caption logic (line breaking, fade timing, gate-code and keyword flags, no re-route offer when the
  heard gate is the current one); LEAF `FywCaptionsRerouteScenario`: airport, Step-Free, heading to C12 → play
  announcement → caption shows → "Re-route to B14?" → accept → route ends at B14 with no stairs.
- [ ] Commit: "Heard a gate change: captions and re-route offer".

Demo beat (about 30 s, at the end of demo 1, airport, Step-Free, heading to Gate C12 with the dog):
1. Press "Play announcement". The Spanish announcement types in; the caption shows "Flight 212 to Madrid now boards at
   gate B14", with the Spanish in small text below.
2. B14 is highlighted; the card asks "Re-route to B14?".
3. Pinch yes. The floor line turns toward B14, still through the lift; the dog follows the new line.
4. Narration/Devpost line: "Can't hear the announcement? Pathpal shows it, translates it, and re-routes you step-free."
