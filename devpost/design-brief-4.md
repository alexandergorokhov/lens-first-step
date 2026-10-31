# Design brief 4: the companion is the product

Status: approved direction from the user, 2026-10-31. Deadline: Nov 9, 22:00 UTC.

## The story changes

**Core:** Free walk with a companion, and navigation. You wander a big building with a companion that
knows what you like, and it can guide you anywhere.

**Extension:** Map builder. The video explains how a place gets mapped, in about 20 seconds. It isn't
the headline.

## What to build, in order

1. **Companion animation.** The generated dog, robot and rover are one solid mesh each, so they can only
   slide along the floor. The user didn't like the dog. Rebuild all three from jointed parts so they move:
   - Dog: trots with its legs, wags its tail, sits and looks back when it waits, points with its nose.
   - Robot: walks with its legs, swings its arms, turns its head, raises an arm to point.
   - Rover: wheels spin at the speed it moves, the mast leans and looks around.
   The pose comes from a pure function in `src/core` (mood, speed, time), tested in Node. The Lens only
   applies it. The jointed models replace the three generated ones; the planter stays generated.
2. **The demo uses the mall.** `Play demo` and the default map become the mall.
3. **Free walk on the demo controls.** A button that starts a scripted Free walk with the companion, so
   the core is one click away.
4. **Map builder demo with buildings behind it.** The user's description of it:
   - The person stands in the mall, looks at a building and marks it. It becomes a node on the map.
   - They walk, and their path connects the nodes.
   - They mark stairs and lifts along the way.
   What exists: `WalkTracer` traces the walk and connects points, `markShop` marks what you look at,
   and floor changes ask stairs or lift. What's missing: it runs in an empty room, so there is nothing
   to look at. It needs the mall behind it, with the map drawn as you go.
5. **Design pass.** Panels, the HUD and the app look at a higher level.
6. **Code quality pass.** Split `FindYourWayMain.ts` (2,187 lines). Each step keeps LEAF at 43 of 43.
7. **The 3-minute video.** Good looking, silent, with captions.

## The 3-minute video

| Time | Beat | Shows |
|---|---|---|
| 0:00 | Hook | Lost in a big mall. Scan the "You are here" sign. |
| 0:12 | Free walk | Your preferences. The dog trots ahead with no destination. |
| 0:30 | It knows you | It stops and points at a shop you'd like. Turn around and it runs round you. |
| 0:50 | Offers | Look at a shop, a subtle dot, open it or ignore it. |
| 1:05 | Upstairs | "4 picks upstairs" at the escalator. |
| 1:20 | Navigation | "Take me to Bolt Hardware". The line, floor by floor. |
| 1:50 | Plans change | "Meet at the food court": the line swings to the new place. |
| 2:05 | Waiting | Hop, or throw a treat. Your route never changes. |
| 2:20 | Any companion | Dog, robot, rover. |
| 2:30 | Extension | Walk a place, mark the shops and stairs, and it becomes a map. |
| 2:50 | Close | Built and tested in the Lens Studio preview. Name and end card. |

No music, by the user's choice: captions in the side column carry it. Voiceover stays an option.
Honest labels stay: recorded in the Lens Studio preview, not on Specs.

## Known limits

- Nothing has run on real Specs hardware.
- Real speech is untested until someone speaks to Talk.
- Lens Studio has crashed twice right after a preview reset, cause unknown.
- The preview view doesn't drop when you sit, so seated play can't be filmed well.
