# Next session — Round 2 (updated Nov 9, 2026)

Plan and open items: `ROUND2.md`. Branch `companion-polish`, last commit `aad4d4c` + this cleanup; npm test 635.

## Start
1. Open Lens Studio on first-step, Preview 1 tab, `/mcp` reconnect lens-studio.
2. The LEAF runner on `LeafIndex` is saved with `only=visual-demos`, `autoRun=false`. Never save it with
   `autoRun=true` (a take on open freezes Lens Studio).

## Recording a take (v9)
- Lens maximized on the main 4K screen, Preview 1 tab showing, Lens Studio on top (Windows won't bring it forward
  for us: ask Alex to click it). Check the region with a 1-frame grab first.
- `node_modules/ffmpeg-static/ffmpeg.exe -f gdigrab -framerate 24 -draw_mouse 0 -offset_x 1566 -offset_y 351
  -video_size 1176x1344 -i desktop -t 720 ... out.mkv` (mkv survives a forced stop). Set `autoRun=true`, save,
  start ffmpeg, PreviewPanelTool refresh; on `SUMMARY` in the Lens log set `autoRun=false`, save, stop ffmpeg.
- During a take: don't edit Lens scripts (Lens recompiles and restarts it), don't open videos.
- Sync: the first brightness jump (~152 to ~181) is the airport appearing = T0'. Shift the log marks by -5.6 s.
- Edit: `node tools/voice/narration-mix.mjs <raw.mkv> <shifted log> <T0'> <out.mp4> 1156:1258:20:86`
  (quiet stretches 4x, the play kept at 1x). Check it prints no "no mark for" / "late".
- Last: v8 from `demos-raw19.mkv`, T0' 36.5.

## Rules
- Core in `src/core/*.ts`, byte-identical Lens copies via `npm run sync`; core files import nothing.
- `mall.json` must equal the published gist: fix route quirks in code, not the map.
- Test count in `devpost/SCENARIOS.md`, `devpost/PREVIEW-GUIDE.md`, `openspec/specs/README.md`, `README.md`.
- No local paths in `.md` files (T12). Lens scripts are CRLF: edit with the Edit tool.
- LLM: wired via Remote Service Gateway, no token. A token lives in `Assets/Scene.scene` (tracked): never commit it.

## Don't touch / don't commit
- `Assets/Scene.scene` editor churn; the other session's files: `Assets/Tests/Fyw*Video*.ts`, `FywMallVideoBase.ts`,
  its `FindYourWayLeafIndex.ts` edits, `.gitattributes`, `AGENTS.md`, `devpost/PITCH-POLISHED.md`,
  `devpost/README.md`, `devpost/design-brief-clean.md`.
