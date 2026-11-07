// The companion speaks: trip events map to short pre-made lines, one at a time, never the same line
// twice within 8 s, silent when muted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { speechFor, speechTopic, sideOf, SpeechGate, SPEECH_LINES, SPEECH_REPEAT_S, SPEECH_HOLD_M, SPEECH_LIFT_M } from "../speech.ts";

test("SP1 every event maps to its line; nothing for what the companion doesn't talk about", () => {
  assert.equal(speechFor({ kind: "found" }), "start");
  assert.equal(speechFor({ kind: "tripStart", stepFree: true }), "step_free");
  assert.equal(speechFor({ kind: "tripStart", stepFree: false }), null, "Walk: no step-free line");
  assert.equal(speechFor({ kind: "rideAhead", ride: "lift", metres: 8, side: "left" }), "lift_left");
  assert.equal(speechFor({ kind: "rideAhead", ride: "lift", metres: 8, side: "right" }), "lift_right");
  assert.equal(speechFor({ kind: "rideAhead", ride: "lift", metres: 8, side: "ahead" }), "lift_ahead");
  assert.equal(speechFor({ kind: "rideAhead", ride: "lift", metres: SPEECH_HOLD_M - 1, side: "left" }), "hold_lift");
  assert.equal(speechFor({ kind: "rideAhead", ride: "lift", metres: SPEECH_LIFT_M + 1, side: "left" }), null, "too far yet");
  assert.equal(speechFor({ kind: "rideAhead", ride: "stairs", metres: 5, side: "left" }), null, "only lifts are named");
  assert.equal(speechFor({ kind: "floorChanged", up: true, floors: 1 }), "up_floor");
  assert.equal(speechFor({ kind: "floorChanged", up: false, floors: 1 }), "down_floor");
  assert.equal(speechFor({ kind: "floorChanged", up: true, floors: 2 }), null, "the line says one floor");
  assert.equal(speechFor({ kind: "passing", category: "coffee", side: "right" }), "coffee_right");
  assert.equal(speechFor({ kind: "passing", category: "clothes", side: "left" }), "clothes_left");
  assert.equal(speechFor({ kind: "passing", category: "books", side: "left" }), null);
  assert.equal(speechFor({ kind: "passing", category: "coffee", side: "ahead" }), null);
  assert.equal(speechFor({ kind: "gateMoved" }), "gate_moved");
  assert.equal(speechFor({ kind: "arrived" }), "arrived");
});

test("SP2 every key speechFor can give has a line and a clip in Assets/Voice", () => {
  const sides = ["left", "right", "ahead"] as const;
  const keys = new Set<string>();
  const add = (k: string | null) => { if (k) keys.add(k); };
  add(speechFor({ kind: "found" }));
  add(speechFor({ kind: "tripStart", stepFree: true }));
  for (const s of sides) {
    add(speechFor({ kind: "rideAhead", ride: "lift", metres: 8, side: s }));
    for (const c of ["coffee", "clothes"]) add(speechFor({ kind: "passing", category: c, side: s }));
  }
  add(speechFor({ kind: "rideAhead", ride: "lift", metres: 1, side: "left" }));
  for (const up of [true, false]) add(speechFor({ kind: "floorChanged", up, floors: 1 }));
  add(speechFor({ kind: "gateMoved" }));
  add(speechFor({ kind: "arrived" }));
  assert.deepEqual([...keys].sort(), Object.keys(SPEECH_LINES).sort(), "no unused line, no line without a key");
  for (const k of keys) assert.ok(existsSync(new URL("../../../Assets/Voice/" + k + ".wav", import.meta.url)), k + ".wav");
});

test("SP3 never the same line within 8 s; one line at a time", () => {
  const g = new SpeechGate();
  assert.equal(SPEECH_REPEAT_S, 8);
  assert.equal(g.say("lift_left", 0, 1.5), true);
  assert.equal(g.say("arrived", 1, 1), false, "still speaking");
  assert.equal(g.say("arrived", 1.6, 1), true, "free after the clip");
  assert.equal(g.say("lift_left", 7.9, 1), false, "repeat within 8 s");
  assert.equal(g.say("lift_left", 8.1, 1), true, "after 8 s");
  assert.equal(g.say("nope", 20), false, "unknown key");
  assert.equal(g.say(null, 20), false);
});

test("SP6 the lift is named once as you come up to it, whichever side it is on", () => {
  assert.equal(speechTopic("lift_ahead"), "lift");
  assert.equal(speechTopic("coffee_right"), "coffee");
  assert.equal(speechTopic("hold_lift"), "hold_lift");
  assert.equal(speechTopic("step_free"), "step_free");
  const g = new SpeechGate();
  assert.equal(g.say("lift_ahead", 0, 1), true);
  assert.equal(g.say("lift_right", 1.5, 1), false, "same lift, now on the right");
  assert.equal(g.say("hold_lift", 3, 1), true, "holding it is another line");
  assert.equal(g.say("coffee_left", 5, 1), true);
  assert.equal(g.say("coffee_right", 6, 1), false);
});

test("SP4 muted says nothing; reset forgets what was said", () => {
  const g = new SpeechGate();
  g.muted = true;
  assert.equal(g.say("start", 0), false);
  g.muted = false;
  assert.equal(g.say("start", 0, 1), true);
  g.reset();
  assert.equal(g.say("start", 0.5, 1), true, "a restart can greet again");
});

test("SP5 left and right: facing -Z, +X is on the right", () => {
  assert.equal(sideOf(0, 0, 0, -1, 5, -1), "right");
  assert.equal(sideOf(0, 0, 0, -1, -5, -1), "left");
  assert.equal(sideOf(0, 0, 0, -1, 0, -5), "ahead");
  assert.equal(sideOf(0, 0, 1, 0, 1, 5), "right", "facing +X, +Z is on the right");
  assert.equal(sideOf(0, 0, 0, -1, 0, 0), "ahead", "standing on it");
});
