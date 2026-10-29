# CLAD addendum 1: pet points to places, line at 50%, TDD

Paste the box below into the Claude session that is already running in `C:\Sasha\Projects\Lens\first-step\first-step`.

```
ADDENDUM to the feature plan (from devpost/FEATURES-HANDOFF.md). Fold these into the plan, design-brief-2.md and the proposed scenarios. Ask me if anything conflicts with what we already decided.

A. BUILD EVERYTHING WITH TDD. For every feature: write the failing Node test (and the LEAF scenario where it's about the scene) first, run it and show me it fails, then write the code until it passes, then refactor. Keep the existing 96 Node + 19 LEAF tests green after each step. Each new scenario in SCENARIOS.md names its test before the code exists.

B. THE ROUTE LINE STAYS ~50% TRANSPARENT in every guide mode, including "Pet + line" (the brief's #4285F4 at 50% opacity), so I can see the floor and the flow through it. Replace "faint line" with "Pet + line (50%)". Test: the line material's opacity is 0.5 in all modes.

C. THE PET POINTS OUT PLACES WHILE I WALK (feature 6 + feature 2 together).
   - Interests: on the mode panel I pick what I care about (coffee, food, shopping, toilets, pharmacy; Step-Free adds accessible toilets). Default: none picked = the pet points at nothing except sponsored places, and only if I haven't muted places.
   - When we pass a matching place within ~10 m of the route, the pet stops, turns and points at it (nose/paw toward the shop front, small hop), and that place's icon brightens with its name. Optionally it trots 1-2 m toward it and comes straight back. Then it carries on ahead of me. The whole thing takes about 3 s.
   - THE ROUTE NEVER CHANGES because the pet pointed. The line, distance, ETA and destination stay exactly the same. Only if I pinch the place's "Go here?" does it become the new destination (same re-route as a gate change).
   - Limits so it doesn't nag: at most one point per 30 s and per 20 m, never within 10 m of a turn or a floor change (lift, stairs, escalator, ramp), never while a gate-change or out-of-service card is showing. "Places off" (mute) also stops the pointing.
   - PAID / SPONSORED PLACES (business idea, show it in the demo): a place in the map can have "sponsored": true. Sponsored places count as an interest match, follow the same limits, and always show a small "Sponsored" tag so it's honest. They can never change the route or the destination. Put this in the brief and in one short video beat ("shops can pay to be pointed out; the route never changes"). Demo sponsored data is made up and labelled as demo.
   - Map: places are kind "place" nodes with "category" and optional "sponsored"; nothing shop-specific in code.
   - Tests first (TDD), at least: pointing never changes the route points, distance or destination; no point within 10 m of a turn or floor change; at most one point per 30 s / 20 m; muted = no points; a non-interest, non-sponsored place is never pointed at; a sponsored place always shows "Sponsored"; "Go here?" re-routes and keeps Step-Free rules; the pet resumes 2-3 m ahead after pointing.

When you've folded this in, show me the updated plan for the pet + places and the list of new tests (red first) before writing code.
```
