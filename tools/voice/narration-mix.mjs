// Edits and voices the visual-demos take (ROUND2.md R2-7, R2-16): from a screen recording of the take, the
// edit keeps every voice-over line and beat at 1x, plays quiet walking EDIT.fast times faster, and cuts each
// lift ride into a short dissolve (src/core/narration.ts editPlan); each clip from
// tools/voice/make-narration.py starts where its line lands in the edit. The edit must be under 3 minutes
// (contest rule): longer, and it stops with an error.
//   node tools/voice/narration-mix.mjs <raw.mp4> <take.log> <T0 in the recording, s> <out.mp4> [crop w:h:x:y]
// take.log: the Lens log of the take (its "[VID] <s> <what>" lines). T0: the recording second where the
// take's "[VID] 0.00 demo 1" view shows.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpeg from "ffmpeg-static";
import { EDIT, editPlan, parseMarks, placeNarration } from "../../src/core/narration.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLIPS = path.join(HERE, "..", "..", "devpost", "video", "narration");

// The clips to mix: file name and delay (ms) in the edited video.
export function mixClips(lines) {
  return lines.map((l) => ({ file: String(l.index).padStart(2, "0") + ".wav", delayMs: Math.round(l.at * 1000) }));
}

// ffmpeg filter for the picture: input 0 is the recording; each segment trimmed (take time + t0), sped,
// then joined in order: a dissolve where the segment says so, else a plain cut.
export function videoFilter(segs, t0, crop = "") {
  const parts = [];
  segs.forEach((s, i) => {
    parts.push(`[0:v]trim=start=${(s.from + t0).toFixed(3)}:end=${(s.to + t0).toFixed(3)},setpts=(PTS-STARTPTS)/${s.speed},${crop ? "crop=" + crop + "," : ""}fps=24,format=yuv420p,settb=AVTB[s${i}]`);
  });
  let cur = "s0";
  let len = (segs[0].to - segs[0].from) / segs[0].speed;
  for (let i = 1; i < segs.length; i++) {
    const out = "j" + i;
    const segLen = (segs[i].to - segs[i].from) / segs[i].speed;
    if (segs[i].dissolve) {
      parts.push(`[${cur}][s${i}]xfade=transition=fade:duration=${EDIT.xfadeS}:offset=${(len - EDIT.xfadeS).toFixed(3)}[${out}]`);
      len += segLen - EDIT.xfadeS;
    } else {
      parts.push(`[${cur}][s${i}]concat=n=2:v=1:a=0[${out}]`);
      len += segLen;
    }
    cur = out;
  }
  parts.push(`[${cur}]format=yuv420p[vout]`);
  return parts.join(";\n");
}

// ffmpeg filter for the sound: inputs 1.. the clips in order.
export function mixFilter(clips) {
  const parts = clips.map((c, i) => `[${i + 1}:a]aformat=channel_layouts=stereo,adelay=${c.delayMs}|${c.delayMs}[v${i}]`);
  parts.push(`${clips.map((_, i) => `[v${i}]`).join("")}amix=inputs=${clips.length}:normalize=0:duration=longest[aout]`);
  return parts.join(";\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [raw, log, t0, out, crop] = process.argv.slice(2);
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
  const cut = marks.filter((m) => m.what === "CUT")[0];
  const end = cut ? cut.t : marks[marks.length - 1].t + 3;
  const plan = editPlan(marks, lengths, end);
  console.log("edit: " + plan.length.toFixed(1) + " s from " + end.toFixed(1) + " s, " + plan.segs.length + " segments");
  if (plan.length >= EDIT.maxS) {
    console.error("too long for the contest (under 3 minutes): " + plan.length.toFixed(1) + " s");
    process.exit(2);
  }
  const clips = mixClips(plan.lines);
  const dir = mkdtempSync(path.join(tmpdir(), "narr-"));
  const script = path.join(dir, "edit.txt");
  writeFileSync(script, videoFilter(plan.segs, Number(t0), crop || "") + ";\n" + mixFilter(clips));
  const r = spawnSync(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-i", raw,
    ...clips.flatMap((c) => ["-i", path.join(CLIPS, c.file)]),
    "-filter_complex_script", script, "-map", "[vout]", "-map", "[aout]", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-t", plan.length.toFixed(2), out],
    { stdio: "inherit" });
  process.exit(r.status ?? 1);
}
