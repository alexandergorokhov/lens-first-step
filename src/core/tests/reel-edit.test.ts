// The video edit: what the [REEL] log keeps and cuts, and how captions wrap.
import { test } from "node:test";
import assert from "node:assert/strict";
import { clock, plan, wrap, musicFilter } from "../../../tools/reel-edit.mjs";

const LOG = `10:00:10.000 0.0 CUT-FROM
10:00:15.000 5.0 CUT-TO
10:00:15.000 5.0 First caption
10:00:25.000 15.0 Second caption
10:00:30.000 20.0 CUT-FROM
10:00:40.000 30.0 CUT-TO
10:00:50.000 40.0 (no caption)
10:00:50.100 done
`;

test("R1 keeps only what lies between the cuts and stops at the reel's end", () => {
  const p = plan(LOG, clock("10:00:00.600"), 90);
  assert.equal(p.kept.length, 2);
  assert.ok(p.kept[0][0] > 14 && p.kept[0][0] < 15.5);
  assert.ok(Math.abs(p.kept[1][1] - 48.8) < 0.01);
  assert.ok(p.length < 30);
});

test("R2 captions are timed on the edited video, in order", () => {
  const p = plan(LOG, clock("10:00:00.600"), 90);
  assert.deepEqual(p.captions.map((c) => c.text), ["First caption", "Second caption"]);
  assert.ok(p.captions[0].start < 0.1);
  assert.ok(p.captions[1].start > 8 && p.captions[1].start < 10);
  assert.ok(p.captions[1].end <= p.length + 0.01);
});

test("R3 long captions wrap, words stay whole", () => {
  const out = wrap("Someone names the shops and adds offers", 16);
  assert.ok(out.split("\n").every((l) => l.length <= 16));
  assert.equal(out.replace(/\n/g, " "), "Someone names the shops and adds offers");
});

test("R4 The music is cut to the video's length and fades out at its end", () => {
  const f = musicFilter(150);
  assert.match(f, /atrim=0:150\.00/);
  assert.match(f, /afade=t=out:st=147\.00:d=3/);
  assert.match(musicFilter(1), /st=0\.00/);
});
