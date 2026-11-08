// Add-on D, "Heard a gate change": the caption of an announcement names a gate; when it is not where
// you are going, Pathpal offers "Re-route to Gate B14?" and the new route keeps your mode.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findRoute, parseMap } from "../router.ts";
import type { MapData } from "../router.ts";
import { gateChangeOffer } from "../freewalk.ts";
import { GATE_CHANGE_SPEECH, demoSpeechFor } from "../captions.ts";

function airport(): MapData {
  const r = parseMap(readFileSync(new URL("../data/map.json", import.meta.url), "utf8"));
  if (!r.ok) throw new Error(r.error);
  return r.map;
}

test("the sample announcement: Spanish heard, English shown, naming gate B14", () => {
  assert.match(GATE_CHANGE_SPEECH.heard, /puerta B14/);
  assert.equal(GATE_CHANGE_SPEECH.lang, "es");
  assert.match(GATE_CHANGE_SPEECH.english, /gate B14/);
});

test("heading to C12, the announcement offers Gate B14, flagged boarding", () => {
  const o = gateChangeOffer(airport(), GATE_CHANGE_SPEECH.english, "gateC12");
  assert.deepEqual(o, { gate: "gateB14", label: "Gate B14", flags: ["boarding"], beta: true });
});

test("no offer when the heard gate is already the destination", () => {
  assert.equal(gateChangeOffer(airport(), GATE_CHANGE_SPEECH.english, "gateB14"), null);
  assert.equal(gateChangeOffer(airport(), "Attention please: flight IB3104 to Lisbon is now boarding at gate C12.", "gateC12"), null);
});

test("no offer without a gate of this airport (a flight number is not a gate)", () => {
  assert.equal(gateChangeOffer(airport(), "Flight 212 is delayed.", "gateC12"), null);
  assert.equal(gateChangeOffer(airport(), "Flight 212 now boards at gate Z99.", "gateC12"), null);
  assert.equal(gateChangeOffer(airport(), "", "gateC12"), null);
});

test("no offer for a place that is not a gate (the café)", () => {
  assert.equal(gateChangeOffer(airport(), "Coffee is now served at the café.", "gateC12"), null);
});

test("delayed and cancelled are flagged too; with no trip the gate is still offered", () => {
  const d = gateChangeOffer(airport(), "Flight 88 to Rome is delayed, now leaving from gate B16.", "gateC12");
  assert.deepEqual(d && d.flags, ["delayed"]);
  const c = gateChangeOffer(airport(), "Flight 9 is cancelled. Please see the desk at gate B18.", null);
  assert.deepEqual(c && { gate: c.gate, flags: c.flags }, { gate: "gateB18", flags: ["cancelled"] });
});

test("accepting keeps Step-Free: the route to B14 from the C pier has no stairs or escalators", () => {
  const map = airport();
  const r = findRoute(map, "cTop", "gateB14", "stepFree");
  assert.equal(r.status, "route");
  if (r.status !== "route") return;
  for (const e of r.edges) assert.ok(e.kind !== "stairs" && e.kind !== "escalator", "step-free edge: " + e.id + " " + e.kind);
});

test("GC8 the gate agent you meet on arrival speaks of the gate you are at, so no re-route is offered there", () => {
  const m = airport();
  for (const [gate, code] of [["gateC12", "C12"], ["gateB14", "B14"], ["gateB12", "B12"]]) {
    const d = demoSpeechFor("airport", code)!;
    assert.ok(d.heard.indexOf("puerta " + code) >= 0 && d.english.indexOf("gate " + code) >= 0, code);
    assert.equal(gateChangeOffer(m, d.english, gate), null, "at " + gate);
  }
  // No gate (arriving somewhere else): the line as written; the mall's host is unchanged.
  assert.ok(demoSpeechFor("airport", null)!.english.indexOf("gate C12") >= 0);
  assert.ok(demoSpeechFor("mall", "B14")!.english.indexOf("table") >= 0);
  assert.equal(demoSpeechFor("moon", null), null);
});
