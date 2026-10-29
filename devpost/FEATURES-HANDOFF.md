# CLAD handoff: plan the 5 new features for Find Your Way Inside

How to start (on your PC):
1. Open Lens Studio with `C:\Sasha\Projects\Lens\first-step\first-step\first-step.esproj`.
2. In PowerShell: `cd C:\Sasha\Projects\Lens\first-step\first-step` then `claude` (use `npx.cmd`, not `npx`, for any npx command).
3. Paste everything inside the box below.

Evaluation doc (the reasoning behind this prompt): https://claude.ai/artifact/MMxXeRQSgMvEd8Le4SpHCF

```
/plan-lens

This is a PLANNING session for new features in the existing Lens in this folder. Don't write Lens code or change the scene yet. The only exception is the 30-minute voice test in step 3, which goes in a throwaway scene or branch and gets removed afterwards.

Read first: devpost/design-brief.md (approved), devpost/SCENARIOS.md (96 Node tests and 19 of 19 LEAF passing), openspec/specs/, src/core/router.ts and src/core/data/map.json. Everything building-specific must keep coming from the map file, never from code.

Contest: Learn AR with SPECS, due Nov 9 19:00 ART. Build runs Nov 1-8, about one evening a day; about 2 evenings are reserved for polish and the 3-minute video, so new features get about 5 evenings. The video is recorded in the Lens Studio preview (no camera feed, no GPS, map preloaded or downloaded). Snap design rules: UI panels 0.6 to 1.6 m away, glanceable cues, big pinch targets that highlight, additive display (no dark UI), content in the ~32° view during the task.

The 5 features, in my priority order, with the suggested design:

FLOORS ARE A FIRST-CLASS PART OF EVERY FEATURE (this matters most to me). The Lens already routes across levels (place.levels in the map; lift, stairs, escalator, ramp edges; Step-Free never uses stairs/escalators; ride buttons and the "Lift up to Departures" card, see openspec/specs/level-changes). Check what exists first, then plan only what's missing:
   a. Floor badge: always-visible small "Ground floor" / "Departures" next to the distance pill; it changes the moment a ride ends.
   b. Floor-change cue ahead: ~15 m before a lift/stairs/escalator/ramp on the route, a card "In 15 m: lift up to Departures" (Step-Free: always the lift or ramp), plus an icon on the line where it changes floor. Shows the destination's floor too: "Gate C3 is on C pier, 1 floor down".
   c. The line on other floors: only the current floor's part is drawn; the part above/below shows as a short vertical marker at the lift/stairs, not a line through the ceiling.
   d. Floors in distance and time: count floor changes and add time for them (defaults a map can override: lift wait + ride ~45 s, escalator ~20 s, stairs ~15 s per floor).
   e. Places and voice are floor-aware: icons only for my floor (others as "1 floor up" if asked for); a voice/"Where to?" destination on another floor says which floor and how you get there.
   f. Mapping: every dropped point carries its floor; lifts/stairs join points across floors; the photo-to-map tool takes one plan per floor.
   g. GOING DOWN MUST WORK AS WELL AS GOING UP, for every connection. Lifts, stairs and ramps already run both ways in the router, and lifts have a "Ride to Ground floor" button, but the tests mostly ride up. Escalators are one-way by design (from -> to), and the airport has only an up escalator, so going down uses the stairs. Plan: add a down escalator beside the up one in the airport map (its own edge, top -> foot, "Ride escalator down" button at the top), and make the cues say "down" ("In 15 m: lift down to Ground floor"). Also consider a lift that is out of service on one floor only.
   Tests for each (Node + LEAF), including: a trip that starts upstairs and ends downstairs; riding a lift down; stairs down; the new escalator down on Walk; Step-Free going down only by lift or ramp; and a 3-level route on the airport (ground -> departures -> C pier).

1. DISTANCE (must, ~0.5 evening). A small light pill at the lower edge of the view, ~1 m ahead: "Gate C3 · 140 m · 1 floor down · 3 min". Walk 1.3 m/s, Step-Free 1.0 m/s, plus the floor-change times above. Shows after the scan, counts down, updates on any re-route, hides at arrival. Tests: equals route length, drops as you walk, updates after a re-route, floor count right.

2. PLACES ALONG THE WAY + MUTE (should, ~1.5 evenings). Small round semi-transparent (~40%) icons for coffee, toilet, accessible toilet, pharmacy, food, on the real shop front at eye height. Only within ~15 m and near the route, max 3 at once, name shows only when looked at directly. Step-Free shows accessible toilets and lifts first. "Places on/off" toggle on a small waist-height app panel; hides icons, keeps the line. Pinch an icon -> "Go here?" -> becomes the destination (same re-route as a gate change). Map: new nodes kind "place" with a "category". Tests: never more than 3 icons, mute hides all, mute never changes the route.

3. VOICE "TAKE ME TO..." (should, spike first). Speech -> text via Snap's ASR module -> plain-code match against the map's place and destination names (no AI model). Two matches -> two big buttons to pinch. Always a "Where to?" panel listing destinations as the fallback. STRETCH: an AI to talk to via Remote Service Gateway (Gemini or OpenAI) with the map's place list as context; it must answer with a place id from the map, never invent a route; optional text-to-speech. The API token is made in Lens Studio (Windows -> Remote Service Gateway Token) and must never be committed.
   Snap's docs say ASR and the gateway are "only available on Spectacles" and say nothing about the preview. So:
   STEP 3 TEST (ask me before starting it): in a throwaway scene, add the ASR module, speak into the laptop mic in Interactive Preview and log the text; then send one Gemini request through the gateway. Report what worked. If voice doesn't work in the preview, plan a clearly labelled stand-in ("on real Specs: say the place"), like the sign scan.

4. HAND ZOOM -> "PEEK AHEAD" (stretch). A real zoom of the world can't work: there's no camera feed in the preview and the display only adds light. Replace it with: pinch and pull toward you -> a small 3D model of the building ~0.6 m in front, waist high, remaining route glowing, a dot for me; let go to hide. Cheaper alternative: looking toward a far place shows its name bigger, near me. Ask me which one, or to drop it.

5. EASY MAPPING OF A NEW PLACE (should for the photo version). (a) One command: give the agent a photo of a floor/evacuation plan -> it writes map.json + SVG and runs the validator. ~0.5 evening + a 15 s video beat. (b) STRETCH ~2 evenings: in-Lens "Map this place" mode: walk, pinch "Point here" at corners/doors/lifts, each point joins the previous one, tag a stretch as stairs or step-free with one pinch, name points from a short list (or voice if feature 3 works), save to persistent storage, then route on it at once. Video: map the sample room in 20 s, then navigate it.

6. PET GUIDE (should, ~1.5-2 evenings, makes it prettier and films well). Instead of only the line, a small animated pet (dog, cat or fox; ask me which) walks the route about 2-3 m ahead of me on the real floor. It keeps my pace and stops when I stop, waits and looks back at each turn, wags/sits by the lift door or escalator and rides with me (also going DOWN), runs the new way when the route changes, and sits by the gate on arrival. Guide setting on the mode panel: "Line", "Pet" or "Pet + faint line" (default, so the route stays clear when the pet is behind a corner or out of the ~32° view; the turn arrow points to the pet). In Step-Free mode it only takes lifts and ramps, like the line. Assets: a light low-poly pet with walk, idle, sit and look-back animations from the Lens Studio Asset Library, well inside the 25 MB limit. Tests: the pet stays on the route, stays 2-3 m ahead, never takes stairs in Step-Free, ends at the destination.

What I want from this session:
- Start with floors: show me what already works across floors and what's missing from a-g, then interview me on it.
- Interview me on the open design calls (where the distance pill and floor badge sit, how early the floor-change cue shows, icon set and limits, where the mute toggle lives, voice fallback, peek ahead vs drop, which mapping version).
- Update the brief: don't overwrite devpost/design-brief.md; write devpost/design-brief-2.md with the new features merged in (including changing "Voice: none" if I approve voice), new "Where things live", "When things show", done criteria, video beats that fit under 3 minutes, and a cut order.
- Add new scenarios (S10 onward, E7 onward) to a proposed section in devpost/SCENARIOS.md, marked "proposed", each with the Node/LEAF test that will cover it.
- An evening-by-evening plan for Nov 1-8, voice test on Nov 1.
- Don't git commit anything; I'll say when.
- When you finish, tell me the full paths of what you wrote.
```
