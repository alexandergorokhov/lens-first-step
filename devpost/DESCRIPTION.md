# Pathpal: Devpost text

The text for the Devpost project page (from the Nov 7 polished pitch, updated Nov 9). Only features that exist today.

---

## Tagline

No GPS indoors? Pathpal is your companion: it leads you step-free, hands free, and captions what's said around you.

## Full pitch

For the full pitch details, see the presentation: `Pathpal presentation.pdf` in the repo root (9 slides).

## Demo video

https://www.youtube.com/watch?v=B4anmB5f2Lo (2:58): the real Lens running in the Lens Studio preview, narrated, ending with a short run recorded by hand in the preview. To replay
each demo yourself, see "Replay the demos from the video" in `devpost/PREVIEW-GUIDE.md`.

## Inspiration

There is no GPS indoors. Big airports, malls and hospitals are hard to find your way in, and a phone map makes
you stop and look down, which is hard with bags, a stroller or a wheelchair. Many places give no guidance for
wheelchair users at all: you find the stairs when you reach them. And when you travel, what's said around you,
a gate agent, an announcement, a host, may be in a language you don't speak, or something you can't hear.

## What it does

Scan the QR code on the building's "You are here" sign. Pathpal knows where you are and downloads the map.

- **Just say it.** Tell Pathpal what you need in your own words: "coffee and a bathroom before my flight 212 at
  gate 12C". An AI model matches your words to real places on the map, and the route planner puts the stops in
  the best order. No internet? Offline mode still understands the map's own names, and you can pick the place
  from a list or the floor map.
- **Follow your companion.** A friendly robot or dog walks about 7 m ahead of you, with a faint line on the
  floor. It's easier to follow someone you can see than a map. It waits for you at lifts and escalators, and it
  talks, in short lines with a caption: "Step-free route, no stairs.", "Wait here, I'll hold the lift."
- **Step-free for wheelchairs.** Step-Free mode only uses lifts and ramps, never stairs or escalators. If a lift
  is out of service, the route swings to another one.
- **Live captions in your language.** What people say to you appears on the lens, translated into your
  language. A translator when you travel, and captions if you're deaf or hard of hearing.
- **Gate changes, for your flight only.** Give your flight number and Pathpal listens for it. When an
  announcement moves your flight to a new gate, it asks "Re-route to Gate B14?". It never changes your trip
  without your Yes, and it stays step-free.
- **Free walk.** No destination? The companion asks what you're into today, and you just say it. It walks
  ahead, points at shops that match and says why ("Clothes · your pick"). Look at a shop for two seconds to see
  its offers. Sponsored places are always labelled.
- **While you wait.** A quick game with your companion: it hops over obstacles when you raise your hand.
- **Almost screenless.** While you walk you see only the floor line and the companion; everything else folds
  into one small Control tab.
- **Add-on: Map builder.** Any building can get a map by walking it: your path records itself, a new floor is
  detected, and you mark shops as you pass.

## Built for

- Wheelchair users, and anyone avoiding stairs (strollers, crutches, luggage).
- Travellers in a country whose language they don't speak.
- People who are deaf or hard of hearing.
- Anyone lost in a big building.

## Safe by design

- The AI only picks places. The route planner plans every step, so the AI can never send a wheelchair user to
  the stairs.
- Paying never changes a route.
- The mic only listens while captions are on. Nothing heard is stored: only the line on screen, which clears
  after 4 seconds.
- The AI gateway token stays on the developer's PC: a test fails if one is saved in the project.

## How I built it

- Planned with the Devpost Learn `/plan-lens` interview, then built with an AI coding agent using Snap's CLAD
  plugin and the Lens Studio MCP. I made the design calls; the agent wrote the code test first.
- One TypeScript core (routes, floors, companion, captions, Free walk) runs in Node with 635 unit tests and
  inside the Lens. Over 80 LEAF scenarios press the real buttons in the preview.
- Routing is Dijkstra over the map graph; Step-Free is the same search without stairs and escalators.
- The companion's voice and the video's voice-over are made with Kokoro (open TTS). No music.

## What's simulated

No Specs hardware was used; everything runs in the Lens Studio preview.

- The QR scan is a button. Lifts are a button too.
- Speech and the AI model only run on Specs, so in the preview the request is typed in and the announcements
  are scripted lines with a fixed translation.
- The companion's voice is pre-made clips.
- Shops and offers are demo data.

## What's next

- Try it on real Specs in a real building.
- Let the AI read an announcement and suggest what to do (re-route, wait, ask the gate agent), always with your
  Yes.
