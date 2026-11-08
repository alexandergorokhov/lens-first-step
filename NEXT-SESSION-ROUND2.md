# Next session — Round 2 builder (left Nov 7, 2026)

Plan: `ROUND2.md` (builder checklist). Branch: `companion-polish`. Work test first (TDD), commit each finished item.

## Where it stands
- R2-1..R2-4: done.
- **R2-6 Bigger transcript: code done, commit `8f1658b`** (+ `87cb410` status note). npm test 581/581, TypeScript compiles.
  - Sizes live in `TRANSCRIPT` in `src/core/captions.ts` (Lens copy `Assets/Scripts/FindYourWayCaptions.ts`, `npm run sync`).
    Tests: CP-R2-6 and CP-R2-6b in `src/core/tests/captions.test.ts`.
  - Live captions 2x, band 40 cm, 33 characters a row, at y -11.5 (`FindYourWayHudUI.ts`).
  - "Heard: …" line 1.5x (2x would need about 5 lines in the 31 cm panel); grows to at most 3 rows
    (`setNote` in `FindYourWayModePanelUI.ts`, `setTextHeight` in `FindYourWayWidgetsUI.ts`).
  - Companion caption 2x, 100 cm wide (`FindYourWayCompanionSays.ts`).
  - **Not checked in the Preview yet** (the Preview panel was closed), so R2-6 is not ticked.
- **Not pushed:** SSH to GitHub (port 22) timed out.

## Do next, in order
1. `git push` (once the connection to GitHub works).
2. Open the Preview panel in Lens Studio. Check:
   - the caption band fits on screen;
   - the "Heard" panel grows without covering anything;
   - the companion caption is easy to read.
   Adjust if needed, then tick R2-6 in `ROUND2.md` and commit.
3. R2-5: measure that the companion stays 7 m ahead in the new take.
4. R2-7 voice-over: write the `narration.ts` test first (every beat has a line, no overlap, fits before the next beat).
   The lines are in the `ROUND2.md` voice-over table. Kokoro clips via `tools/voice`.
5. R2-8: stills check, LEAF `visual-demos`, re-record, edit with the voice-over -> `devpost/video/pathpal-demos-v3.mp4`.
6. R2-10 (gate change only for my flight), then R2-11 (Sushi Bar in demo 2).

## Don't touch
- The other session's uncommitted files: `Assets/Tests/Fyw*Video*.ts` (marked TEMPORARY),
  the `FindYourWayLeafIndex.ts` edits, `.gitattributes`.
- Lens scripts use CRLF line endings: edit them with the Edit tool, not raw Python string replace.
- When the test count changes, update it in `devpost/SCENARIOS.md`, `devpost/PREVIEW-GUIDE.md`,
  `openspec/specs/README.md` and `README.md` (the docs test checks it).
- No local paths (`C:\...`) in `.md` files (test T12 fails).
