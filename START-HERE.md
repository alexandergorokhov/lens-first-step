# Start here (for a developer or a coding agent)

Pathpal ("Find Your Way Inside"): an indoor-navigation Lens for Snap Specs, built for the Learn AR with SPECS
hackathon. A companion (dog or robot) walks ahead of you to where you're going, step-free when you need it, and
points at shops you like in Free walk. Everything runs in the Lens Studio preview; no Specs hardware was used.

Read this page first, then the file for your task (table at the end).

## 1. Set up (once)

- Node 22.18 or later. `npm install`, then `npm run hooks` (runs `npm test` before each commit).
- Lens Studio 5.24.1 (5.23.2 also works). Open `first-step.esproj`.
- Preview panel: device **SPECS 27**, mode **Interactive**, scene **Plane**, then reset the preview.
- A coding agent drives Lens Studio through the Lens Studio MCP server (CLAD plugin). If its tools fail, ask the
  user to reconnect it (`/mcp`). Never call Lens Studio over raw HTTP.

## 2. Check that it works

1. `npm test`: expect every test to pass (the count is in `README.md`, "There are N tests"). With no internet set
   `OFFLINE=1` (one test downloads the maps from the public gist).
2. In the preview: click inside it, then **W A S D** walk, **Shift + A / D** turn, a click is a pinch. Click
   **Scan sign** and try **Free walk**.
3. The three demos: Inspector, object **FindYourWay**, field **Demo preset**, then reset the preview. Steps per
   demo: `devpost/PREVIEW-GUIDE.md`, "Replay the demos from the video".

## 3. How the code is laid out

| Where | What |
| --- | --- |
| `src/core/*.ts` | All the logic (routing, companion, Free walk, play, captions, narration, ...). Plain TypeScript, no Lens APIs, **no imports**, not even from each other. Runs in Node for tests. |
| `src/core/tests/*.test.ts` | Node tests; each new file must also be added to the `test` script in `package.json`. |
| `src/core/data/*.json` | The maps (airport, mall, hospital, campus, room). Must equal the published gist (a test checks): fix route quirks in code, not in the map. |
| `Assets/Scripts/FindYourWay*.ts` | The Lens. `FindYourWayMain.ts` runs everything; `*UI.ts` are panels; the core files have byte-identical copies here (`FindYourWayRouter.ts` = `router.ts`, ...). |
| `Assets/Tests/Fyw*Scenario.ts` | LEAF tests that run inside the Lens and press the real buttons. Registered in `Assets/Tests/FindYourWayLeafIndex.ts`. |
| `Assets/Tests/FywDemoVideoScenario.ts` | The demo-video take (LEAF id `visual-demos`), helpers in `FywDemoSupport.ts`. |
| `tools/` | `sync-core.mjs` (copy core into the Lens), `voice/` (voice clips and the video edit), `demo-video/` (airport model and GLB export), map tools. |
| `openspec/specs/*/spec.md` | The requirements, one folder per feature. |

## 4. How to change something (the workflow)

1. Write a failing Node test in `src/core/tests` (or a LEAF scenario for something only the Lens can show).
2. Change `src/core`, then `npm run sync` to copy it into `Assets/Scripts`. `npm test` fails if the copies differ.
3. Wire it in the Lens scripts; recompile in Lens Studio and check the preview (or run the LEAF test).
4. Update the spec in `openspec/specs`, and `devpost/SCENARIOS.md` (every scenario names its test).
5. If the test count changed, update it in four places (a docs test checks them): `README.md`,
   `devpost/PREVIEW-GUIDE.md`, `devpost/SCENARIOS.md`, `openspec/specs/README.md`.
6. Commit and push on the working branch (`companion-polish`).

Gotchas:
- Lens scripts use CRLF line endings: edit them with a proper editor, not `sed` or heredocs.
- No local paths (a drive letter or a home folder) in `.md` files (a test fails).
- Editing a Lens script while the preview runs a LEAF test recompiles and restarts it.

## 5. LEAF tests (inside the Lens)

Select **LeafIndex** in the Scene Hierarchy. Type scenario ids in **only** (comma-separated) and tick **autoRun**,
reset the preview, and read `[FYW-LEAF] RESULT` and `SUMMARY` in the Logger. Run about 30 at a time.
**Always untick autoRun and save afterwards**: a project saved with autoRun on starts a take when it opens and can
freeze Lens Studio.

## 6. Secrets

The AI part (an LLM through Snap's Remote Service Gateway, `FindYourWayAsk.ts`) needs a token pasted into the
`RemoteServiceGatewayCredentials` field in the Inspector. `Assets/Scene.scene` is tracked by git: never commit
it with a token (a security test checks). Without a token the plain offline matcher answers. Don't paste tokens
into a chat.

## 7. Where to read next

| Task | File |
| --- | --- |
| Current state, open items, the voice-over script | `ROUND2.md` |
| Starting a work session; recording and editing the demo video | `NEXT-SESSION-ROUND2.md` |
| What the Lens does, for anyone | `README.md` |
| Every mode in the preview, step by step | `devpost/PREVIEW-GUIDE.md` |
| Which test covers which scenario | `devpost/SCENARIOS.md` |
| The original plan (approved; never edit) | `devpost/design-brief.md` |
| Requirements | `openspec/specs/README.md` |
| Lens Studio basics for agents | `AGENTS.md` |
