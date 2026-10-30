---
status: approved
---

# Design brief 3: Find Your Way Inside: three modes (Free walk, Map builder, Go to a place)

Builds on `devpost/design-brief.md` and `devpost/design-brief-2.md`, which stay unchanged. Written from the
plan-lens interview of 2026-10-30. Values marked **(default)** were not chosen by you; change them freely.

Standing rule from brief 2: a feature is done only when it runs in the Lens in the preview and passes its
LEAF test. Everything building-specific comes from the map file, never from code.

## The one spatial moment
You walk through a shopping mall with no destination, browsing. Your pet, robot or rover walks ahead of you,
stops at the shops that match your preferences and points at them. If you turn around, it runs around to stay
in front of you. Look at any shop and a subtle dot appears in the corner of your view. Open it and you see up
to 3 things the shop wants to show you. If you don't open it, nothing happens.

## Why it belongs on glasses
- Uses: it draws in the world (the companion on the floor) and leaves your body free (eyes up, hands free,
  browsing while you walk). It also responds to where you look, using head direction rather than the camera.
- Why it's better than the phone or laptop version: on a phone you look down at a list of shops. Here the
  shops stay in front of you, and the information only comes when you look at one.

## Product or overlay
- Type: overlay. It responds to a real building, using a walked map rather than recognition.
- What the real version would sense: the "You are here" sign, your position and your head direction. It never
  recognises a shop with the camera. "Looking at a shop" means your head direction crosses that shop's `front`
  line from the outside (option B).
- Stand-ins for the preview:
  - Sign: a labelled scan button ("on real Specs: look at the sign"), as today.
  - The mall: the stand-in mall building.
  - Saved preferences: a saved preset labelled "Saved preset (demo)".
  - Voice: a labelled "Say it" button that fills in a preset phrase (see Go to a place).
  - Upload from the Lens: see Map builder.

## The three modes
After the sign scan, a panel offers **Free walk**, **Go to a place** and **Map builder**. This moves the scan
before the mode choice; today it comes after.

### Free walk: browsing
- **Preferences:** a pop-up asks whether to view or change them. It shows a list of 6 categories as checkboxes
  (Café, Food, Clothes, Sport, Hardware, Books (default list)). The list comes from the map (`place.interests`).
  The demo starts from a saved preset of Café, Clothes and Hardware (default).
- **Companion on:**
  - **Where it walks:** it stays ahead of you or near you. If you turn, it corrects its path to your new
    "ahead"; if you turn around, it runs around you (default: staying at least 1 m away) and carries on in front.
  - **What "ahead" means (default):** your walking direction while you walk, so glancing at a shop doesn't swing
    it around; your head direction once you've stood still for 1 s. Its spot is kept on the map's walkable paths.
  - **Pointing:** it stops at every shop that matches your preferences and points at it for 3 s (default). Each
    shop is pointed at once per walk (default). Only matching shops make it stop, and paying doesn't change that.
    The limits are Inspector settings so they can be tuned, because stopping at every shop may get annoying.
- **Any shop gets a dot when you look at it**, with the companion on or off, whether or not it matches.
- **Companion off:** no pointing. You just look at shops and open their dots.
- **Offers are read-only.** You read them and decide whether to go in. There is no "go here" in Free walk.
- **Other floors:** when matching shops are on another floor, the companion stops at the stairs, escalator or
  lift and points at it, with a small bubble above its head: "3 picks upstairs" (or "downstairs"). Looking at
  the stairs gives the same dot as a shop; opening it lists the first 3 matching shops, then "and more" if there
  are others. Paying is how a shop gets on that list: paid shops come first and show their "Sponsored" tag. The
  bubble needs no pinch and explains the stop. The list gives the detail, and also works with the companion off.
- **Free walk has no Step-Free option.** Step-Free stays in Go to a place.

### Go to a place: you know where you want to go
- You scan the sign and say where you want to go. Then today's flow runs: line, distance pill, floor cues,
  Walk or Step-Free, companion optional.
- **Voice in the preview:** a labelled "Say it" button stands in for speech. It fills in a preset phrase
  ("Take me to Bolt Hardware") and runs the real plain-code matcher against the map's names. A "Where to?" list
  does the same job as a button.
- On Specs the phrase comes from Snap's ASR module. The Nov 1 spike checks whether the laptop mic works in the
  preview. If it does, the demo can use it; if not, the stand-in stays.

### Map builder: walk the place, then it can be used
1. **Walk:** scan the sign, choose Map builder, nothing else to set up. The path is recorded automatically:
   samples every 0.5 m, corners simplified at 1 m tolerance, crossings joined within 1.5 m (default values).
2. **Floors:** a height change of at least 1 m held for 2 s starts a new floor (default). The Lens guesses lift,
   stairs, escalator or ramp, and you confirm with one pinch. Until confirmed it saves as stairs, so Step-Free
   never uses it. "Next floor" stays as a manual fallback.
3. **Mark a shop:** stand in front of the shop, face it and pinch **Mark shop**. That one pinch stores a shop node
   and its `front`, 1.5 m ahead of you and 6 m wide, square to your facing direction (default values). Nodes get
   plain names: "Shop 1", "Shop 2".
4. **Review and upload:** "See my map" shows the small Peek model; then **Upload**.
5. **Publish:** someone later assigns each shop a name and promotions, using short invented names in the demo.
   The Lens downloads that map during walking modes from the existing online map location.

**Upload (default):** a Lens must not hold a git token. So Upload writes the map text to the log between markers.
A laptop tool (`npm run map:publish`) reads it, validates it with `parseMap`, and adds it to `src/core/data` and the
gist that `mapBaseUrl` points at, using your own login. The person running the tool sees what will be published.

**Fixing mistakes:** Undo removes the last point (default). Marking a shop within 2 m of an existing one replaces it
(default). Anything else is edited in the map's JSON metadata, the same place products and offers are added. A better
way is a future decision.

## Map format changes
```json
{"id": "boltHardware", "x": 30, "y": 0, "z": 27, "kind": "place",
 "label": "Bolt Hardware", "category": "hardware",
 "front": {"x1": 27, "z1": 26, "x2": 33, "z2": 26},
 "offer": [
   {"image": "drill", "text": "Cordless drill", "price": "$59"},
   {"text": "Paint weekend", "price": "-20%"}
 ]}
```
- `front`: optional on any node, on that node's floor. The outside is the side the node's walk edge arrives from.
  A node with no `front` gets no dot. Stairs, escalators and lifts get one too.
- `offer`: at most 3 items, each with short text, a price and an optional `image`. `image` picks from a small set
  of pictures bundled in the Lens (default), because the map file is text. Remote images are out of scope.
- `place.interests`: the checkbox list. Maps without it keep today's interests.
- `parseMap` validates all of these, and `MapRecorder` writes and restores them.
- Offers on a sponsored place always show its "Sponsored" tag. Paying never makes the companion stop at a shop in
  Free walk; it only puts a matching shop first on the other-floor list.
- **Mall (default names, all made-up demo data):**
  - Add on the ground floor: Bolt Hardware, Threads (clothes) and Aurora Sport.
  - Add upstairs: Anvil Tools (hardware) and Second Skin (clothes), so the preset has at least 4 upstairs matches
    and "and more" appears.
  - Fashion moves to `clothes` and Bookshop to `books`.
  - Add a `front` to the shops and to the stairs, escalators and lifts, and offers to the shops in the demo.

## Where things live
- Where the user is looking during the main task: ahead, at the shops and the companion.
- Companion: on the floor, ~2.5 m ahead (default).
- Companion bubble: just above its head, in world space, small.
- Dot: the upper-right corner of the view, ~1 m away, roughly 28 cm right and 18 cm up (default), about 2 cm across
  with a larger invisible pinch area (default). Subtle and not blocking the view.
- Offer list: a short expansion on the right side of the view, ~1 m away, about 24 x 18 cm (default), with the shop
  name on top and at most 3 rows.
- Mode panel, preferences and Map builder panel: ~1 m ahead, a little below eye level.

## Hands and input
- Choose a mode, tick a preference: pinch.
- Open the dot, close the list: pinch. Standard pinch stands in for "a hand gesture", because custom gestures can't
  be shown in the preview.
- Mark shop, confirm floor change, Undo, Upload: pinch big panel buttons.
- Targets are big and highlight when aimed at.
- Voice and the button that does the same job: "Say it" (preset phrase in the preview), and the "Where to?" list.

## When things show
- Dot: shows after ~0.5 s of looking at a front (default), hides ~2 s after you look away (default). If you don't
  open it, nothing happens.
- Offer list: shows on pinch, hides on the close pinch or when you walk ~5 m away (default).
- Pointing: for 3 s at each match, once per walk (default).
- Companion bubble: while it waits at the floor change, then it hides (default: up to 5 s).
- If something needs attention out of view: the companion is the hint. If it's out of view, the existing turn arrow
  points to it, with a light chime when it stops at a match (default).

## Done criteria
Each one can be checked in Lens Studio's preview.
1. **Map builder:** from the sign, walk two floors of the room, mark two shops on each floor and upload. The map
   passes `parseMap`, and a walking mode can route on it.
2. **Companion and preferences:** set preferences, then walk Free walk. The companion stops at shops that match and
   walks past those that don't.
3. **Turning around:** turn around and the companion runs around you and carries on walking in front of you.
4. **Another floor:** the companion stops at the stairs and shows the bubble. Opening the dot lists up to 3 matching
   upstairs shops and "and more". You then go up and find one of them.
5. **Companion off:** look at several shops. Each gets a dot, including non-matching ones. Opening a dot shows at
   most 3 items, and ignoring it changes nothing.
6. **Go to a place:** scan, use "Say it" or "Where to?", and the line leads to the shop.

## Video: 120 seconds
1. 0:00–0:10 the problem; scan the sign; the three modes.
2. 0:10–0:35 Map builder: two floors, two shops on each, upload.
3. 0:35–0:45 naming the shops and adding offers; the Lens downloads the map.
4. 0:45–1:20 Free walk with the companion: preferences, stops at matches, turning around.
5. 1:20–1:35 the stairs bubble, then going upstairs.
6. 1:35–1:50 Free walk without the companion: look at stores, open offers.
7. 1:50–2:00 Go to a place: voice stand-in, the line.

## Out of scope
- Camera recognition of shops, eye tracking, and custom hand gestures.
- Acting on an offer: buying, booking or "go here" from an offer.
- A real upload from the Lens, or any token inside the Lens.
- A map-editing tool. Names, products, offers and fixes are edited in the map's JSON metadata.
- Remote images in offers.
- Saved preferences as a shown feature. They may be stored, but the demo uses the preset.
- Step-Free in Free walk.

## Risks and open questions
- **Corner dot (your choice, kept):** it follows your head, and a small target at the edge of the view is harder to
  aim at than something on the shop. The larger invisible pinch area is there to help. Feel unproven.
- **The dot doesn't say which shop it belongs to** until it's opened. Check in the preview whether that's confusing.
- **Stopping at every match may annoy.** It's configurable; tune it after trying it.
- **Auto-detected lifts on real Specs:** the cabin looks still to the tracking, so height may not change. "Next floor"
  is the fallback. Untested, and only real Specs can answer it.
- **Position drift on long walks:** only real Specs can show how much.
- **Map size through the log:** a big map may be cut off when written to the log. Test this first; 256 KB is the
  `parseMap` limit.
- **Publishing:** `npm run map:publish` updates the gist, so it needs your login and is a public change. The gist copy
  must match the repo (the live download test compares them).
- **Moving the scan before the mode choice** changes the start of every existing LEAF scenario. Rerun them all.
- **One-pinch shop fronts are estimates.** The 6 m width and 1.5 m distance may need adjusting at the naming step.

## Build order and tests
Tests first: a failing Node test, and a failing LEAF scenario where it's about the scene, then the code. Keep Node
and LEAF green after each step. Run LEAF one scenario at a time.
1. **Spike (ask first):** does the laptop mic reach ASR in the preview? Does a large map survive the log?
2. **Map format and mall:** `front`, `offer`, `place.interests`, `parseMap`, `npm run sync`, the gist.
3. **Mode flow:** scan first, then three modes; rerun existing LEAF.
4. **Look detection and dot:** front crossing, dot, offer list (done criterion 5).
5. **Free walk companion:** "ahead", clamping to paths, turn-around run, no-route pointing, Inspector limits
   (done criteria 2 and 3).
6. **Floor hint:** bubble, stairs dot, list (done criterion 4).
7. **Map builder:** path tracing, floor detection, Mark shop, Peek review, upload, `map:publish` (done criterion 1).
8. **Go to a place:** "Say it", matcher, "Where to?" (done criterion 6).
9. **Mall look**, then record the video in the preview.

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
