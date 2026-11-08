# Demo Video Specification

## Purpose

The contest video: the real Lens running in the Lens Studio preview, recorded from the screen, edited and
narrated. Rules: under 3 minutes, on YouTube, no renders made outside Lens Studio, no trademarks, no
copyrighted music. Take: LEAF `visual-demos` (`Assets/Tests/FywDemoVideoScenario.ts`). Camera:
`src/core/camera.ts`. Voice-over and edit: `src/core/narration.ts`, `tools/voice/`.

## Requirements

### Requirement: A smooth, elegant camera (R2-13)
The take's camera SHALL never jump (each frame within walking pace), turn at most 60°/s, start and stop
eased, round corners by at most 1.6 m, ride an escalator straight along its axis at 0.6 m/s stepping on and
off in line, and stop 1.8 m in front of a lift facing its doors (the floor change is a dissolve). It walks
away from a door before a scene plays there.

#### Scenario: VID-R13 Camera
- Verified by: CAM1, CAM2, CAM3, CAM4 (Node, camera.test.ts) | visual-demos

### Requirement: Voice-over on the beats, edit under 3 minutes (R2-7, R2-16)
Each voice-over line SHALL start on its beat's mark (or just after the line before, at most 1.5 s late).
The edit SHALL keep every line and beat at 1x, play quiet stretches 3x faster, cut each lift ride into a
0.5 s dissolve, and refuse an edit of 179 s or more.

#### Scenario: VID-R16 Under 3 minutes
- Verified by: N1-N9 (Node, narration.test.ts)

### Requirement: Demo 2 on one floor; no walking inside stairs (R2-30, R2-31)
Demo 2 SHALL go to the Bakery on the ground floor ("Take me to the Bakery"), so the video and a by-hand
showing have no floor change; the Bakery is dressed as a little café (`dressedAsDining`). Walking by hand,
a stair or escalator body SHALL block (beside it mid-height, or over its opening above), by its drawn width,
except along a map corridor that the map itself leads across it (the mall's fBW-fBM over the up escalator,
kept until the gist map is updated).

#### Scenario: VID-R31 One floor
- Verified by: R30, R31, R31b (Node) | demo-mall-pet
