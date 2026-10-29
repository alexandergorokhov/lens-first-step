# Next session: make the Lens "the real thing", check it in the preview, LEAF the new features

Decided 2026-10-29:

1. **Start at the entrance sign.** After the mode is picked and the map is loaded (on real Specs: you
   look at the sign), the building is laid out with the user standing at the entrance sign, facing
   into the building. The line starts at the user's feet. No virtual sign 2.5 m ahead to walk to
   (today: `signOffset` {0,0,-250} and `SCAN_SIGN_CM` in `Assets/Scripts/FindYourWayMain.ts`).
   In the preview, the scan stays a labelled button ("on real Specs: look at the sign").
2. **Hide Demo controls by default** (gate change, restart, map switch, play demo); an Inspector
   toggle brings them back for the video. Keep the ride buttons (lift, escalator, stairs): the
   preview can't physically change floors.
3. **TDD:** a failing LEAF test first for each change, then the code. Keep Node 144 and LEAF 19 green.
4. **LEAF for the proposed features** (S10 to S17, P1 to P7, Q1 to Q7 in SCENARIOS.md). Their Lens UI
   isn't built yet, so each needs its Lens UI plus a LEAF scenario (`fl1-pill-shows-and-counts-down`,
   `fl2-badge-changes-after-lift`, `fl3-cue-before-escalator`, ...).
5. **Manual checks** (PREVIEW-GUIDE.md section 8) through the Lens Studio MCP: the line flat on the
   floor (`eyeHeightCm`), the start in open floor, the map switch. Capture screenshots.
6. **Record the demo from the Lens Studio preview** (the real Lens), not three.js. Label the three.js
   clips as concept renders.

The real-Specs run is the user's job: Lens Studio, then Preview Lens / Send to paired Specs, then the
Preview room map in a real room.
