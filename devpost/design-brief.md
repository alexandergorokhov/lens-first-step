---
status: approved
---

# Design brief: Find Your Way Inside

A Lens for Snap Specs. You walk through a big building with a small companion that knows what you like, and it can guide you anywhere inside.

## The one spatial moment

You scan the "You are here" sign at the entrance of a shopping mall. Your dog, robot or rover walks ahead of you on the floor. It stops at the shops you would like and points at them, and if you turn around it runs round you to stay in front. When you know where you want to go, say the place: a blue line appears on the floor and leads you there, floor by floor.

## Why it belongs on glasses

- **It draws in the world.** The line and the companion are on the real floor, where you are going.
- **It leaves your body free.** Hands stay on a wheelchair, a stroller or your bags, and eyes stay up.
- **It beats a phone.** There is no GPS indoors, and a phone map makes you look down and work out which way you are facing. Here the shops stay in front of you, and information only comes when you look at one.

## Product or overlay

An overlay on a real building, using a map rather than recognition.

- **What the real version senses:** the "You are here" sign, your position and your head direction. The sign's code says where you stand, and its web address downloads that building's map. Shops are never recognised with the camera. "Looking at a shop" means your head direction crosses that shop's front line.
- **Maps:** every building is a small JSON file of nodes and edges. The Lens downloads it, with a 5 s timeout, and falls back to a copy inside the Lens. A badge says "online map" or "offline map".
- **Any place:** everything building-specific comes from the map, never from code: shops, offers, categories, floors, the stand-in model and the card texts. The Lens ships an airport, a hospital, a campus, a room and a shopping mall.

**Stand-ins in the preview.** The Lens is built and shown in Lens Studio's preview. No Specs device was available.

| Real version | In the preview |
|---|---|
| Look at the sign | A button labelled "on real Specs: look at the sign" |
| The building around you | A stand-in model built from the map, shown in Lens Studio only |
| Your saved preferences | A preset labelled "Saved preset (demo)" |
| Speech | **Talk** uses Snap's speech module; **Say it** fills in a phrase and runs the same matcher |

## How it works

After the scan, four choices appear.

**Free walk: browse with no destination.**
- Pick your preferences and your companion: dog, robot or rover.
- The companion keeps ahead of you on the walkable paths, about 7 m by default. It follows your walking direction, so glancing at a shop does not swing it round.
- It stops at each matching shop ahead of you and points at it, once per walk.
- Look at any shop and a gold button appears in your view: "Offers: Bolt Hardware", or "Sponsored: Bean There Café" for a promoted shop. Open it to see up to 3 offers, or ignore it and nothing happens.
- When matches are on another floor, it waits at the stairs or escalator with a bubble: "3 picks upstairs".

**Tour: be shown round.** The companion leads you through the shops that match your preferences, stop by stop, in the shortest order.

**Go to a place: you know where you are going.** Say it, or pick from a list or a map. Choose Walk or Step-Free once. The blue line leads you there and re-routes when plans change.
- **Walk** takes the shortest route, escalators included.
- **Step-Free** is for wheelchairs, strollers and crutches. It never uses stairs or escalators.
- A distance pill shows your floor, the distance, the floors to go and the time. A cue warns you before each floor change.
- If a lift is out of service, or the destination changes, the line swings to the new route. If no step-free route is left, the line leads to the assistance point.

**Map builder: walk a place and it becomes a map.** This answers who makes the maps.
- Your path records itself as you walk.
- A height change starts a new floor, and one pinch confirms stairs, escalator, lift or ramp.
- **Mark shop** stores the shop you are facing and its front line.
- **See my map** shows it as a small model, and **Upload** hands it to a laptop tool that checks and publishes it. A Lens never holds a publishing token.

**While you wait.** When you stand still with the companion on, you can play. In Hop it jumps obstacles when you raise a hand. In catch you grab a treat, throw it, and the companion brings it back. Seated play moves closer and shorter. Play never changes your route.

## Rules that hold everywhere

- Step-Free never uses stairs or an escalator.
- The companion and play never change the route, the distance or the destination.
- Paying never changes a route and never makes the companion stop at a shop. In Free walk it only lists a matching shop first on the other-floor list. Sponsored places always show their tag.
- Offers are read-only.
- The Lens does not record, identify or follow people.

## Where things live

| Thing | Where |
|---|---|
| Route line | On the floor, 30 cm wide, Google Maps blue at 50% so the floor shows through, fading 10 m ahead |
| Companion | On the floor ahead of you, see-through so it never hides the floor |
| Distance pill and floor cue | Bottom centre of the view, a little below eye level |
| Offers button | Right of centre in the view, gold, naming what it opens |
| Offer list | Right side of the view, about 1 m away |
| Panels | About 1 m ahead, a little below eye level, readable standing or seated |
| Options panel | Waist height to the left, shown only during a walk or trip |
| Mini mall | A small 3D model of the place, with your route on it |
| Turn arrow | Edge of the view, only when the next turn is out of view |
| Red sign on a lift | About 1.2 m up, readable seated |

The Specs display is additive, so black renders as transparent. UI text stays light, and nothing depends on dark colours to be seen.

## Hands and input

- Everything is a pinch on a large target that highlights when aimed at.
- Raise a hand to jump in Hop.
- Grab and throw a treat in catch.
- Pinch and pull toward you to peek at a small model of your route.
- Say a place with **Talk**. A list and a map do the same job with no voice.

## When things show

- Offers button: after about 0.5 s of looking at a shop, gone about 2 s after you look away.
- Offer list: on a pinch, gone on the close pinch or when you walk about 5 m away.
- Line: from the scan until you arrive, showing only the next 10 m.
- Arrival card: within 3 m of the destination.
- Change cards: when a route changes, with a chime, for about 5 s.

## Done criteria

Each one can be checked in Lens Studio's preview. `SCENARIOS.md` lists the test behind each.

1. Scanning the sign places you at the entrance and the line appears.
2. In Walk, the line goes round corners and up the escalator, with an arrow when the next turn is out of view.
3. In Step-Free at seated height, the line uses the lift, and closing a lift re-routes to another.
4. A destination change swings the line: stairs in Walk, ramp in Step-Free.
5. Within 3 m of the destination the line stops and the arrival card shows.
6. Map builder: walk two floors, mark shops, upload. The map passes validation and can be routed on.
7. Free walk: the companion stops at shops that match and walks past those that do not.
8. Turn around and the companion runs round you and carries on in front.
9. Matches on another floor: the companion stops at the stairs with the bubble, and the button lists the shops.
10. With the companion off, every shop still gets the button, and ignoring it changes nothing.
11. Go to a place: say or pick a shop, and the line leads to it.

## Out of scope

- Camera recognition of shops or signs, eye tracking and real indoor positioning.
- Acting on an offer: buying, booking or "go here" from an offer.
- A map editor. Shop names and offers are edited in the map file.
- Publishing a map directly from the Lens.

## What only real glasses can tell

The logic is proven by tests in the preview. These are unproven, because nothing has run on Specs hardware:

- How the line and the companion feel at walking and wheeling speed, and comfort over time.
- Whether a button that follows your head is easy to pinch.
- Whether stopping at every match gets annoying. The limits are Inspector settings.
- Position drift on long walks, and whether a lift is detected, since the cabin looks still to tracking. **Next floor** is the fallback.
- Real hand tracking, real speech and a real sign scan.

## Built with

- Lens Studio, Spectacles Interaction Kit and UI Kit, in TypeScript.
- A shared core in `src/core` that runs in the Lens and in Node, tested first. `SCENARIOS.md` lists the scenarios and their tests, and `openspec/specs` holds the full requirements.
- `PREVIEW-GUIDE.md` shows how to try it, with no glasses needed.
