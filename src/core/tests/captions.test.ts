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

// R2-6 (ROUND2.md): the transcript about twice the v2 size. v2: live captions Body (39) at 70 cm on a 26 cm
// row, 44 characters; "Heard: …" Headline2 (48) at 100 cm on a 31 cm line; the companion's caption
// Caption (38) at 200 cm, 60 cm wide.
import { TRANSCRIPT, CAPTION_ROW_CHARS, CHAR_CM_PER_SIZE } from "../captions.ts";

test("CP-R2-6 transcript about 2x: live captions, Heard line, companion caption", () => {
  assert.ok(TRANSCRIPT.captions.scale >= 1.8, "live captions about 2x");
  assert.ok(TRANSCRIPT.heard.scale >= 1.5, "Heard line bigger");
  assert.ok(TRANSCRIPT.companion.scale >= 1.8, "companion caption about 2x");
  // Size of a role at a distance, as the Lens computes it (roleSize): size * distance / 110.
  const size = (role: number, dist: number, scale: number) => role * (dist / 110) * scale;
  // The v2 band: 44 characters on 26 cm at Body 70 cm gives the character width per unit of size.
  assert.ok(Math.abs(CHAR_CM_PER_SIZE - 26 / 44 / size(39, 70, 1)) < 0.002);
  // Every row still fits its width at the new size.
  const fits = (chars: number, sz: number, w: number) => chars * CHAR_CM_PER_SIZE * sz <= w + 0.01;
  const c = TRANSCRIPT.captions;
  assert.ok(fits(CAPTION_ROW_CHARS, size(39, 70, c.scale), c.rowWidthCm), "caption row fits");
  assert.ok(CAPTION_ROW_CHARS >= 28, "still a useful row");
  // The band stays inside the view at 70 cm (Specs: about 46 cm wide there).
  assert.ok(c.rowWidthCm + 1 <= 44, "band inside the view");
  const h = TRANSCRIPT.heard;
  // A row of v2 Body at 70 cm took 1.7 cm: line height per unit of size.
  const line = 1.7 / size(39, 70, 1);
  assert.ok(h.lines >= 2 && h.heightCm >= h.lines * line * size(48, 100, h.scale) - 0.01, "Heard has room for its lines");
  assert.ok(c.rowHeightCm >= line * size(39, 70, c.scale) - 0.01, "caption row tall enough");
  const p = TRANSCRIPT.companion;
  assert.ok(fits(p.rowChars, size(38, 200, p.scale), p.widthCm), "companion row fits");
  // The longest companion line wraps to at most two rows.
  assert.ok(p.rowChars * 2 >= "Wait here, I'll hold the lift.".length);
});

import { textLines, LINE_CM_PER_SIZE } from "../captions.ts";
test("CP-R2-6b lines a text needs at a size and width (the Heard panel grows with it)", () => {
  assert.ok(Math.abs(LINE_CM_PER_SIZE - 1.7 / (39 * 70 / 110)) < 1e-9);
  const size = 48 * (100 / 110) * TRANSCRIPT.heard.scale;
  assert.equal(textLines("", 31, size), 1);
  assert.equal(textLines("To: Café", 31, size), 1);
  assert.equal(textLines("Heard: I need coffee and a bathroom before my flight at gate 12C", 31, size), 4);
  assert.equal(textLines("Heard: take me\nThinking…", 31, size), 2, "a new line starts a line");
});
