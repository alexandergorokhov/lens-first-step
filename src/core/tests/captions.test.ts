// Live captions for people who are deaf or hard of hearing: speech around you as at most two rows at
// the bottom of the view, newest words kept, translated into your language when it is another one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { captionRows, CaptionFeed, translatePrompt, parseTranslation, CAPTION_HOLD_S, DEMO_SPEECH } from "../captions.ts";

test("CP1 at most two rows, word-wrapped, the newest words kept", () => {
  assert.deepEqual(captionRows("", 20), []);
  assert.deepEqual(captionRows("Hello there", 20), ["Hello there"]);
  const long = "Attention please flight IB3104 to Lisbon is now boarding at gate C12";
  const rows = captionRows(long, 24);
  assert.equal(rows.length, 2);
  for (const r of rows) assert.ok(r.length <= 24, r);
  assert.ok(rows[1].endsWith("gate C12"), "the newest words stay");
  assert.ok(long.endsWith(rows.join(" ")), "rows are the tail of what was said");
});

test("CP2 the feed shows live words, keeps the final words for 4 s, then clears", () => {
  const f = new CaptionFeed(30);
  assert.equal(CAPTION_HOLD_S, 4);
  f.push("Attention please", false, 0);
  assert.deepEqual(f.rows(0.5), ["Attention please"]);
  f.push("Attention please, boarding now", true, 1);
  assert.deepEqual(f.rows(4.9), ["Attention please, boarding now"]);
  assert.deepEqual(f.rows(5.1), [], "gone after 4 s");
  f.push("Next", false, 6);
  assert.deepEqual(f.rows(6), ["Next"]);
});

test("CP3 translation: the prompt asks for the target language only; the reply is trimmed, quotes and labels removed", () => {
  const p = translatePrompt("Atención: el vuelo a Lisboa embarca por la puerta C12.", "English");
  assert.ok(p.indexOf("English") >= 0 && p.indexOf("puerta C12") >= 0);
  assert.equal(parseTranslation('  "Attention: the flight to Lisbon is boarding at gate C12."  '), "Attention: the flight to Lisbon is boarding at gate C12.");
  assert.equal(parseTranslation("Translation: Hello"), "Hello");
  assert.equal(parseTranslation("   "), null);
});

test("CP4 the preview's demo speech (no microphone there): an airport announcement in Spanish with its English", () => {
  const a = DEMO_SPEECH.airport;
  assert.ok(a.heard.indexOf("C12") >= 0 && a.lang === "es");
  assert.ok(a.english.indexOf("gate C12") >= 0);
});
