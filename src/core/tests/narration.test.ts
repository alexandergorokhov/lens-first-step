// R2-7 (ROUND2.md): the voice-over. One line per beat of the take, each starting on its "[VID]" mark,
// no two lines at once, each done before the next beat starts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NARRATION, NARRATION_WPS, NARRATION_GAP_S, NARRATION_SLIDE_MAX_S, parseMarks, placeNarration, speakSeconds } from "../narration.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

// The v2 take (Nov 6), as the Lens log printed it.
const V2 = `[VID] 0.00 demo 1: airport, wheelchair
[VID] 24.21 leg 1 to cafeD
[VID] 56.83 arrived at cafeD
[VID] 61.43 leg 2 to accToiletD
[VID] 65.35 arrived at accToiletD
[VID] 69.88 leg 3 to gateC12
[VID] 71.46 announcement
[VID] 75.46 question Re-route to Gate B14?
[VID] 78.05 re-routed to Gate B14
[VID] 94.62 arrived at gateB14
[VID] 94.62 arrived Gate B14. Boarding in 20 min.
[VID] 108.91 demo 2: mall, follow the dog
[VID] 166.64 arrived Food court. Find a table.
[VID] 181.80 demo 3: Free walk with the robot
[VID] 236.71 pointed cafe,threads boxes cafe,threads
[VID] 244.49 END`;

test("N1 the lines are the ROUND2.md voice-over table, in order", () => {
  const md = readFileSync(ROOT + "ROUND2.md", "utf8");
  const table = md.split("### Voice-over script")[1].split("\n###")[0];
  const rows = table.split("\n").filter((l) => /^\| /.test(l) && !/^\| (Beat|---)/.test(l));
  const fromMd = rows.map((r) => {
    const c = r.split("|").map((x) => x.trim());
    return { beat: c[1], line: c[2] };
  });
  assert.equal(NARRATION.length, fromMd.length);
  for (let i = 0; i < fromMd.length; i++) {
    assert.equal(NARRATION[i].line, fromMd[i].line, "line " + i);
    // The table's beat names the mark the line starts on (the table may say "demo 1: airport, wheelchair").
    assert.ok(fromMd[i].beat.startsWith(NARRATION[i].beat) || NARRATION[i].beat.startsWith(fromMd[i].beat), fromMd[i].beat);
  }
});

test("N2 marks: parsed from log lines, other lines skipped", () => {
  const m = parseMarks("x\n" + V2 + "\n[FYW] something");
  assert.equal(m.length, 16);
  assert.deepEqual(m[6], { t: 71.46, what: "announcement" });
});

test("N3 speaking time: about 2.5 words a second", () => {
  assert.equal(NARRATION_WPS, 2.5);
  assert.equal(speakSeconds("one two three four five"), 2);
});

test("N4 placed on the marks in order: a beat matches the next mark starting with its name", () => {
  const p = placeNarration(parseMarks(V2));
  const at = (beat: string, n = 0) => p.placed.filter((x) => x.beat === beat)[n];
  assert.equal(at("demo 1: airport, wheelchair")!.start, 0);
  assert.equal(at("leg 1")!.start, 24.21);
  assert.equal(at("arrived", 0)!.start, 94.62, "demo 1's arrival is the gate, after the question");
  assert.equal(at("arrived", 1)!.start, 166.64, "demo 2's arrival");
  assert.equal(at("END")!.start, 244.49);
});

test("N5 the v2 take misses two beats; the question slides past the announcement line, within the limit", () => {
  const p = placeNarration(parseMarks(V2));
  assert.deepEqual(p.missing, ["talk", "leg"], "no 'talk' mark, no demo-2 'leg' mark");
  assert.deepEqual(p.late, []);
  const q = p.placed.find((x) => x.beat === "question")!;
  const a = p.placed.find((x) => x.beat === "announcement")!;
  assert.ok(Math.abs(q.start - (a.end + NARRATION_GAP_S)) < 1e-9, "starts just after the announcement line");
  assert.ok(q.start - 75.46 > 1 && q.start - 75.46 <= NARRATION_SLIDE_MAX_S);
});

test("N5b a line pushed more than NARRATION_SLIDE_MAX_S off its mark is late", () => {
  const p = placeNarration([{ t: 0, what: "announcement" }, { t: 1, what: "question" }]);
  assert.deepEqual(p.late.map((x) => x.beat), ["question"]);
  assert.ok(p.late[0].by > NARRATION_SLIDE_MAX_S);
});

test("N6 a take with every beat, spaced enough: every line placed, none late, none overlapping", () => {
  // A take that waits for each line (what the v3 take does): each beat is the previous line's end + gap.
  let t = 0;
  const marks: { t: number; what: string }[] = [];
  for (const n of NARRATION) {
    marks.push({ t, what: n.beat + " x" });
    t += speakSeconds(n.line) + NARRATION_GAP_S + 1;
  }
  const p = placeNarration(marks);
  assert.deepEqual(p.missing, []);
  assert.deepEqual(p.late, []);
  assert.equal(p.placed.length, NARRATION.length);
  for (let i = 1; i < p.placed.length; i++) assert.ok(p.placed[i].start >= p.placed[i - 1].end + NARRATION_GAP_S - 1e-9);
});

test("N7 real clip lengths replace the estimate", () => {
  const marks = [{ t: 0, what: "announcement" }, { t: 3, what: "question" }];
  const lens = NARRATION.map(() => 1);
  const p = placeNarration(marks, lens);
  assert.deepEqual(p.late, []);
  assert.equal(p.placed[0].end, 1);
});

// The mix (tools/voice/narration-mix.mjs): each clip delayed to its place in the raw recording.
import { mixClips, mixFilter } from "../../../tools/voice/narration-mix.mjs";

test("N8 mix: clips at their placed start plus where the take's T0 is in the recording", () => {
  const lens = NARRATION.map(() => 2);
  const clips = mixClips(parseMarks(V2), lens, 3.5);
  assert.equal(clips[0].file, "00.wav");
  assert.equal(clips[0].delayMs, 3500, "demo 1 at T0");
  const end = clips.find((c) => c.file === "11.wav")!;
  assert.equal(end.delayMs, Math.round((244.49 + 3.5) * 1000));
  assert.ok(!clips.some((c) => c.file === "01.wav"), "a missing beat has no clip");
  const f = mixFilter(clips, true);
  assert.ok(f.includes("adelay=" + clips[0].delayMs + "|" + clips[0].delayMs), "both channels delayed");
  assert.ok(/amix=inputs=\d+:normalize=0/.test(f), "voice not turned down by the mix");
});
