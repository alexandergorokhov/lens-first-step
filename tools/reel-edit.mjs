// Edits a screen recording of the visual-reel LEAF scenario into the demo video: drops the [REEL]
// CUT-FROM/CUT-TO stretches, and puts each caption in a column beside the Lens view.
//   node tools/reel-edit.mjs <raw.mp4> <reel.log> <recording start HH:MM:SS.s> <out.mp4> [music.wav]
// reel.log holds lines "HH:MM:SS.mmm <reel seconds> <caption | CUT-FROM | CUT-TO>".
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpeg from "ffmpeg-static";

const CAPTURE_LAG_S = 0.6; // ffmpeg's first frame comes this long after the start time is noted
const CUT_MARGIN_S = 0.7; // start a kept stretch a little late, so no set-up shows
const WIDTH = 1920;
const HEIGHT = 1080;
const COLUMN = 800;
const FONT = "C\\:/Windows/Fonts/arialbd.ttf";
const HALF_DAY_S = 12 * 3600;
const MUSIC_LEVEL = 0.8;
const MUSIC_FADE_S = 3;

export function clock(t) {
  const [h, m, s] = t.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

// Parses the log: the stretches to keep (recording seconds) and the captions, timed on the output.
export function plan(logText, startClock, duration) {
  const kept = [];
  const caps = [];
  let from = 0;
  let cutting = true; // nothing before the reel's first CUT-TO
  let end = duration;
  let last = null;
  for (const line of logText.split("\n")) {
    const m = /^(\d\d:\d\d:\d\d\.\d+) ([\d.]+) (.+)$/.exec(line.trim());
    if (!m) continue;
    let at = clock(m[1]) - startClock - CAPTURE_LAG_S;
    if (at < -HALF_DAY_S) at += 2 * HALF_DAY_S; // the log crossed midnight
    if (m[3] === "CUT-FROM") {
      if (!cutting && at > from) kept.push([from, at]);
      cutting = true;
    } else if (m[3] === "CUT-TO") {
      if (!cutting && at > from) kept.push([from, at]);
      cutting = false;
      from = at + CUT_MARGIN_S;
    } else {
      if (last) last.end = at;
      if (m[3] === "(no caption)") end = at; // the reel is over
      last = m[3] === "(no caption)" ? null : { start: at, end: duration, text: m[3] };
      if (last) caps.push(last);
    }
  }
  if (!cutting && end > from) kept.push([from, end]);
  const toOut = (t) => {
    let out = 0;
    for (const [a, b] of kept) {
      if (t >= b) out += b - a;
      else {
        if (t > a) out += t - a;
        break;
      }
    }
    return out;
  };
  return {
    kept,
    captions: caps.map((c) => ({ start: toOut(c.start), end: toOut(c.end), text: c.text })).filter((c) => c.end > c.start + 0.2),
    length: kept.reduce((n, [a, b]) => n + b - a, 0),
  };
}

// The music, faded out to end with the video.
export function musicFilter(lengthS) {
  const fadeFrom = Math.max(0, lengthS - MUSIC_FADE_S);
  return `[1:a]atrim=0:${lengthS.toFixed(2)},volume=${MUSIC_LEVEL},afade=t=out:st=${fadeFrom.toFixed(2)}:d=${MUSIC_FADE_S}[music]`;
}

// Breaks a caption into lines that fit the column.
export function wrap(text, width = 26) {
  const lines = [];
  let line = "";
  for (const w of text.split(" ")) {
    if (line && (line + " " + w).length > width) {
      lines.push(line);
      line = w;
    } else line = line ? line + " " + w : w;
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

function main() {
  const [raw, log, start, out, music] = process.argv.slice(2);
  const probe = spawnSync(ffmpeg, ["-hide_banner", "-i", raw], { encoding: "utf8" }).stderr;
  const d = /Duration: (\d\d:\d\d:\d\d\.\d+)/.exec(probe);
  const p = plan(readFileSync(log, "utf8"), clock(start), clock(d[1]));
  const dir = mkdtempSync(path.join(tmpdir(), "reel-"));
  const parts = p.kept.map(([a, b], i) =>
    `[0:v]trim=${a.toFixed(2)}:${b.toFixed(2)},setpts=PTS-STARTPTS[p${i}]`);
  const inputs = p.kept.map((_, i) => `[p${i}]`).join("");
  const filters = [...parts, `${inputs}concat=n=${p.kept.length}:v=1[all]`,
    `[all]scale=-2:${HEIGHT},pad=${WIDTH}:${HEIGHT}:${WIDTH}-iw:0:color=0x141a2b[base]`];
  let chain = "base";
  p.captions.forEach((c, i) => {
    const file = path.join(dir, `c${i}.txt`).replaceAll("\\", "/").replace(":", "\\:");
    writeFileSync(path.join(dir, `c${i}.txt`), wrap(c.text));
    filters.push(`[${chain}]drawtext=fontfile='${FONT}':textfile='${file}':fontcolor=white:fontsize=50:line_spacing=16:x=56:y=(h-text_h)/2:enable='between(t,${c.start.toFixed(2)},${c.end.toFixed(2)})'[t${i}]`);
    chain = `t${i}`;
  });
  filters.push(`[${chain}]drawtext=fontfile='${FONT}':text='Recorded in the Lens Studio preview':fontcolor=0x9fb3d9:fontsize=26:x=56:y=h-70[out]`);
  if (music) filters.push(musicFilter(p.length));
  const script = path.join(dir, "filters.txt");
  writeFileSync(script, filters.join(";\n"));
  const r = spawnSync(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-i", raw, ...(music ? ["-i", music] : []),
    "-filter_complex_script", script, "-map", "[out]", ...(music ? ["-map", "[music]", "-c:a", "aac", "-b:a", "192k"] : []),
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "24", out], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status || 1);
  console.log(`Wrote ${out}: ${p.length.toFixed(1)} s, ${p.kept.length} parts, ${p.captions.length} captions`);
}

if (process.argv[1] && process.argv[1].endsWith("reel-edit.mjs")) main();
