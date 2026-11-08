// Mixes the voice-over (ROUND2.md R2-7) into a screen recording of the visual-demos take: each clip
// from tools/voice/make-narration.py starts where src/core/narration.ts places it on the take's marks.
//   node tools/voice/narration-mix.mjs <raw.mp4> <take.log> <T0 in the recording, s> <out.mp4>
// take.log: the Lens log of the take (its "[VID] <s> <what>" lines). T0: the recording second where the
// take's "[VID] 0.00 demo 1" view shows. The Lens sound (captions' speech, companion) stays under the voice.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpeg from "ffmpeg-static";
import { parseMarks, placeNarration } from "../../src/core/narration.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLIPS = path.join(HERE, "..", "..", "devpost", "video", "narration");
const LENS_LEVEL = 0.45;

// The clips to mix: file name and delay (ms) from the recording's start.
export function mixClips(marks, lengths, t0) {
  return placeNarration(marks, lengths).placed.map((p) => ({
    file: String(p.index).padStart(2, "0") + ".wav",
    delayMs: Math.round((p.start + t0) * 1000),
  }));
}

// ffmpeg filter: input 0 is the recording, inputs 1.. the clips in order.
export function mixFilter(clips, rawHasAudio) {
  const parts = clips.map((c, i) => `[${i + 1}:a]aformat=channel_layouts=stereo,adelay=${c.delayMs}|${c.delayMs}[v${i}]`);
  const ins = clips.map((_, i) => `[v${i}]`);
  if (rawHasAudio) {
    parts.push(`[0:a]volume=${LENS_LEVEL}[lens]`);
    ins.unshift("[lens]");
  }
  parts.push(`${ins.join("")}amix=inputs=${ins.length}:normalize=0:duration=first[aout]`);
  return parts.join(";\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [raw, log, t0, out] = process.argv.slice(2);
  if (!out) {
    console.error("usage: node tools/voice/narration-mix.mjs <raw.mp4> <take.log> <T0 s> <out.mp4>");
    process.exit(1);
  }
  const lengthsFile = path.join(CLIPS, "lengths.json");
  if (!existsSync(lengthsFile)) throw new Error("run tools/voice/make-narration.py first");
  const lengths = JSON.parse(readFileSync(lengthsFile, "utf8"));
  const marks = parseMarks(readFileSync(log, "utf8"));
  const p = placeNarration(marks, lengths);
  if (p.missing.length) console.warn("no mark for:", p.missing.join(", "));
  for (const l of p.late) console.warn("late:", l.beat, "by", l.by.toFixed(2), "s");
  const clips = mixClips(marks, lengths, Number(t0));
  const probe = spawnSync(ffmpeg, ["-hide_banner", "-i", raw], { encoding: "utf8" }).stderr;
  const rawHasAudio = /Stream #0:\d.*Audio/.test(probe);
  const script = path.join(mkdtempSync(path.join(tmpdir(), "narr-")), "mix.txt");
  writeFileSync(script, mixFilter(clips, rawHasAudio));
  const r = spawnSync(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-i", raw,
    ...clips.flatMap((c) => ["-i", path.join(CLIPS, c.file)]),
    "-filter_complex_script", script, "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", out],
    { stdio: "inherit" });
  process.exit(r.status ?? 1);
}
