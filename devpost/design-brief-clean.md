---
status: clean copy of the approved brief (design-brief.md, Oct 29), with what was added during the build (Nov 9)
---

# Pathpal: design brief

*Planned with the Devpost Learn `/plan-lens` interview. Working title during planning: "Find Your Way Inside".*

**Pathpal is a Lens for Snap Specs that guides you through big indoor places with a companion you follow.** Scan the "You are here" sign, say where you want to go, and a dog or a robot walks ahead of you on the floor, step-free if you need it.

| | |
|---|---|
| **Problem** | Big buildings rely on signs and wall maps. There is no GPS indoors. |
| **For** | Anyone in a big building; wheelchair, stroller and luggage users; people who are deaf or hard of hearing; travellers abroad |
| **Core moment** | A companion and a line on the real floor, leading you there, floor by floor |
| **Platform** | Snap Specs, built and tested in the Lens Studio preview |

---

## 1. The one spatial moment

You scan the "You are here" sign at the entrance of a shopping mall. Your companion walks ahead of you on the floor. It stops at the shops you would like and points at them. If you turn around, it runs round you to stay in front. When you know where you want to go, say the place: a line appears on the floor and leads you there, floor by floor.

## 2. Why it belongs on glasses

- **It draws in the world.** The line and the companion are on the real floor, where you are going.
- **It leaves your body free.** Hands stay on a wheelchair, a stroller or your bags. Eyes stay up.
- **It beats a phone.** A phone map makes you look down and work out which way you face. Here, information comes only when you look at something.

## 3. How it works

After the scan, four modes:

| Mode | What it does |
|---|---|
| **Go to a place** | Say it, or pick from a list or the map. Choose **Walk** (shortest, escalators included) or **Step-Free** (lifts and ramps only). The line re-routes if a lift closes or the destination changes; with no step-free route left, it leads to the assistance point. |
| **Free walk** | No destination. The companion points out shops that match your preferences. Look at a shop for half a second to see its offers. |
| **Tour** | The companion leads you past every matching shop, in the shortest order. |
| **Map builder** | Walk a place and it becomes a map: your path records itself, a pinch marks stairs, lifts and shops, and the result is checked and published from a laptop tool. |

**While you wait:** play with your companion. It jumps obstacles when you raise a hand, or fetches a treat you throw. Play never changes your route.

## 4. Maps

- Every building is one small **JSON file** of points and paths, with floors, lifts, stairs and shops. Nothing building-specific is in the code.
- The Lens downloads the map (5 s timeout) and falls back to a saved copy, so **routing works offline**.
- The Lens ships five maps: airport, shopping mall, hospital, campus and a room.

## 5. Rules that hold everywhere

- Step-Free never uses stairs or an escalator.
- The companion and play never change the route, the distance or the destination.
- **Paying never changes a route.** Sponsored shops can be pointed out, always with a "Sponsored" tag.
- The AI only picks places. The route planner plans every step.
- Offers are read-only. Nothing heard is stored. The Lens does not record, identify or follow people.

## 6. Where things live

| Thing | Where |
|---|---|
| Route line | On the floor, 30 cm wide, 50% see-through, showing the next 10 m |
| Companion | On the floor about 7 m ahead, see-through so it never hides the floor |
| Distance and floor cue | Bottom centre, a little below eye level |
| Offers | Right of centre, after 0.5 s of looking at a shop |
| Captions | Two rows at the bottom of the view |
| Panels | About 1 m ahead, readable standing or seated |
| Turn arrow | Edge of the view, only when the next turn is out of view |

The Specs display is additive (black is transparent), so text stays light.

## 7. Input

Everything is a pinch on a large target. Raise a hand to play. Say a place with **Talk**; a list and a map do the same job without voice.

## 8. Done criteria

Each is checked in the Lens Studio preview; `SCENARIOS.md` lists the test behind each.

1. Scanning the sign places you at the entrance and the line appears.
2. In Walk, the line goes round corners and up the escalator.
3. In Step-Free at seated height, the line uses the lift; closing a lift re-routes to another.
4. A destination change swings the line.
5. Within 3 m of the destination, the arrival card shows.
6. Map builder: walk two floors, mark shops; the map passes validation and can be routed on.
7. Free walk: the companion stops at matching shops only.
8. Turn around and the companion runs round you.
9. Matches on another floor: the companion waits at the stairs and lists them.
10. With the companion off, every shop still shows its offers.
11. Go to a place: say or pick a shop, and the line leads to it.

## 9. Added during the build (after this brief was approved)

| Added | Notes |
|---|---|
| **Name: Pathpal** | Replaced the working title |
| **Voice search with AI** | "Coffee, then a bathroom, then gate 12C." Plain matching first; an LLM picks places only when that fails. Specs only. |
| **Speech transcription and translation** | What people say to you, as two rows of text, translated. Specs only; the preview plays a labelled sample. |
| **Offline mode** | A switch that turns off downloads and the AI; routing keeps working. |
| **Spoken cues** | Short lines such as "Lift on your left", pre-made with an open TTS model. |
| **3D companions** | An animated robot and dog (CC0 models). |

## 10. Stand-ins in the preview

No Specs device was available.

| Real version | In the preview |
|---|---|
| Look at the sign | A button labelled "on real Specs: look at the sign" |
| The building | A stand-in model built from the map |
| Speech, AI and translation | The phrase types itself in; the announcement is scripted |
| Saved preferences | A preset labelled as a demo |

## 11. Out of scope

Camera recognition, eye tracking, real indoor positioning, buying from an offer, and publishing a map directly from the Lens.

## 12. What only real glasses can tell

How the line and companion feel at walking and wheeling speed; whether head-following buttons are easy to pinch; position drift on long walks and lift detection; real speech, hand tracking and the sign scan.

## 13. Built with

Lens Studio, Spectacles Interaction Kit and UI Kit, in TypeScript. A shared core in `src/core`, tested first in Node and in the preview (LEAF). Requirements in `openspec/specs`. Try it with `PREVIEW-GUIDE.md`.
