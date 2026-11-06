// The Nov 6-9 demo polish (POLISH-PLAN.md): a clean screen while walking, Gate C12 and gate codes by
// voice with the preview fallback, the three demo presets, and two companions (dog and robot).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Navigator, parseMap } from "../router.ts";
import type { MapData } from "../router.ts";
import { OptionsDock, walkingHud, cleanAllows, arrivalCardOn, CLEAN_ARRIVAL_S } from "../dock.ts";
import { CLEAN_FREE_WALK, FreeWalk, matchDestination, sayItPhrase, typedSoFar, VOICE_FALLBACK_S } from "../freewalk.ts";
import { demoSettings, DEMO_PRESETS } from "../demo.ts";
import { COMPANIONS, companionChoices } from "../pet.ts";

function load(file: string): MapData {
  const r = parseMap(readFileSync(new URL("../data/" + file, import.meta.url), "utf8"));
  if (!r.ok) throw new Error(file);
  return r.map;
}

// ── Task 1: clean screen ──────────────────────────────────────────────────

test("CS1 clean screen: no pill, cue, badge, score or play line, on a trip or off it", () => {
  for (const trip of [true, false]) {
    for (const standing of [true, false]) {
      for (const arrived of [true, false]) {
        assert.deepEqual(walkingHud(trip, standing, arrived, true), { pill: false, cue: false, badge: false, score: false, playLine: false });
      }
    }
  }
  // Off, nothing changes.
  assert.deepEqual(walkingHud(true, true, false, false), walkingHud(true, true, false));
});

test("CS2 clean screen: the Control tab stays folded even when a button in it is needed; a tap opens it", () => {
  const d = new OptionsDock();
  d.update(true, true, true);
  assert.equal(d.isCollapsed(), true, "never opens by itself");
  d.toggle();
  d.update(true, true, true);
  assert.equal(d.isCollapsed(), false, "Alex's tap opens it");
});

test("CS3 clean screen: only the offer boxes, the arrival card, the voice caption and the Control tab may show", () => {
  const allowed = ["offerBoxes", "offerCard", "arrival", "voiceCaption", "controlTab", "captions"];
  const banned = ["badge", "pill", "cue", "score", "playLine", "notice", "rideCard", "placeIcons", "bubble", "offerList", "demoControls", "debug"];
  for (const k of allowed) assert.equal(cleanAllows(k, true, true), true, k);
  for (const k of banned) assert.equal(cleanAllows(k, true, true), false, k);
  for (const k of banned) assert.equal(cleanAllows(k, false, true), true, "clean screen off: " + k);
  // Before a trip a notice (map failed to load, say) still shows; badges and demo controls never do.
  assert.equal(cleanAllows("notice", true, false), true);
  assert.equal(cleanAllows("badge", true, false), false);
  assert.equal(cleanAllows("demoControls", true, false), false);
});

test("CS4 clean screen: the arrival card shows for 3 s, then goes", () => {
  assert.equal(CLEAN_ARRIVAL_S, 3);
  assert.equal(arrivalCardOn(0, true), true);
  assert.equal(arrivalCardOn(2.9, true), true);
  assert.equal(arrivalCardOn(3.1, true), false);
  assert.equal(arrivalCardOn(60, false), true, "off: it stays");
});

// ── Task 3: Gate C12, gate codes and the preview fallback ─────────────────

test("V1 Gate C12 is on the C pier, after Gate C3, and the Step-Free route to it takes a lift, no stairs or escalators", () => {
  const m = load("map.json");
  const c12 = m.nodes.filter((n) => n.id === "gateC12")[0];
  assert.ok(c12, "Gate C12 exists");
  assert.equal(c12.label, "Gate C12");
  assert.equal(c12.y, 5, "on the C pier");
  const r = new Navigator(m, "sign", "gateC12", "stepFree").route;
  assert.equal(r.status, "route");
  if (r.status !== "route") return;
  const kinds = r.edges.map((e) => e.kind);
  assert.ok(kinds.indexOf("lift") >= 0, "a lift: " + kinds.join(","));
  assert.ok(kinds.indexOf("stairs") < 0 && kinds.indexOf("escalator") < 0, kinds.join(","));
  assert.ok(r.nodes.indexOf("cJunction") >= 0, "through the C gates");
});

test("V2 gate codes: 'gate 12C', 'gate 12 C', 'gate C12', 'C 12' all mean Gate C12", () => {
  const m = load("map.json");
  for (const said of ["take me to gate 12C", "Take me to gate 12 C", "gate C12", "C 12", "Gate c 12 please", "go to gate 12c"]) {
    assert.equal(matchDestination(m, said), "gateC12", said);
  }
});

test("V3 'gate 12' alone does not pick C12 silently; other gates and names still match", () => {
  const m = load("map.json");
  assert.equal(matchDestination(m, "take me to gate 12"), null);
  assert.equal(matchDestination(m, "gate B12"), "gateB12");
  assert.equal(matchDestination(m, "take me to gate 3 c"), "gateC3");
  assert.equal(matchDestination(m, "take me to the pharmacy"), "pharmacyD");
  assert.equal(matchDestination(m, "a"), null);
});

test("V4 the demo phrases: the airport's sentence ends at Gate C12 (ask.test plans it), the mall's matches the food court", () => {
  const a = load("map.json");
  assert.equal(sayItPhrase(a), "I need coffee and a bathroom before my flight at gate 12C");
  assert.equal(matchDestination(a, "take me to gate 12C"), "gateC12");
  const mall = load("mall.json");
  assert.equal(sayItPhrase(mall), "Take me to the food court");
  assert.equal(matchDestination(mall, sayItPhrase(mall)), "foodCourt");
});

test("V4b the mall demo walks up an escalator (where the dog waits): the Sushi Bar would take the stairs", () => {
  const mall = load("mall.json");
  const kinds = (id: string) => {
    const r = new Navigator(mall, "sign", id, "walk").route;
    return r.status === "route" ? r.edges.map((e) => e.kind) : [];
  };
  assert.ok(kinds("foodCourt").indexOf("escalator") >= 0, kinds("foodCourt").join(","));
  assert.ok(kinds("sushi").indexOf("stairs") >= 0);
});

test("V5 the preview fallback types the phrase in word by word over about 1.5 s", () => {
  assert.equal(VOICE_FALLBACK_S, 1.5);
  const p = "Take me to gate 12C";
  assert.equal(typedSoFar(p, 0), "");
  assert.equal(typedSoFar(p, 0.25), "Take");
  assert.equal(typedSoFar(p, 0.75), "Take me to");
  assert.equal(typedSoFar(p, 1.5), p);
  assert.equal(typedSoFar(p, 9), p);
  assert.equal(typedSoFar("", 1), "");
});

// ── Task 4: the three demo presets ────────────────────────────────────────

test("D1 three demo presets, plus off", () => {
  assert.deepEqual(DEMO_PRESETS, ["off", "airportWheelchair", "mallPet", "freeWalkRobot"]);
  assert.equal(demoSettings("off"), null);
  assert.equal(demoSettings("nonsense"), null);
});

test("D2 airportWheelchair: airport, dog, Step-Free, seated (45 cm lower), Go to a place open", () => {
  const s = demoSettings("airportWheelchair")!;
  assert.deepEqual(s, { mapKey: "airport", companionModel: "dog", preselect: "stepFree", seatedDropCm: 45, open: "goTo", interests: [] });
});

test("D3 mallPet: mall, dog, Walk, standing, Go to a place open", () => {
  const s = demoSettings("mallPet")!;
  assert.deepEqual(s, { mapKey: "mall", companionModel: "dog", preselect: "walk", seatedDropCm: 0, open: "goTo", interests: [] });
});

test("D4 freeWalkRobot: mall, robot, Free walk for coffee and clothes", () => {
  const s = demoSettings("freeWalkRobot")!;
  assert.deepEqual(s, { mapKey: "mall", companionModel: "robot", preselect: null, seatedDropCm: 0, open: "freeWalk", interests: ["coffee", "clothes"] });
});

test("D5 Free walk for coffee and clothes from the mall sign: with the clean screen's settings the robot stops at Bean There Café, then Threads", () => {
  const m = load("mall.json");
  const fw = new FreeWalk(m as any, ["coffee", "clothes"], { aheadM: 7, pointSeconds: 3, pointRadiusM: 12, maxStops: 0, lookRangeM: 12, ...CLEAN_FREE_WALK });
  const sign = m.nodes.filter((n) => n.id === "sign")[0];
  let pos = { x: sign.x, y: sign.y, z: sign.z };
  fw.setCompanion(true, pos, 0);
  const stops: string[] = [];
  let t = 0;
  // Walk along the ground floor's front row, west then east, following the companion.
  const path = [{ x: 30, z: 7 }, { x: 14, z: 7 }, { x: 40, z: 7 }];
  for (const target of path) {
    for (let i = 0; i < 400; i++) {
      const dx = target.x - pos.x, dz = target.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.1) break;
      const step = Math.min(d, 0.05);
      pos = { x: pos.x + (dx / d) * step, y: 0, z: pos.z + (dz / d) * step };
      const heading = (Math.atan2(dx, dz) * 180) / Math.PI;
      t += 1 / 30;
      const f = fw.update(pos, heading, 1 / 30, t);
      if (f.stopped && stops.indexOf(f.stopped) < 0) stops.push(f.stopped);
    }
  }
  assert.deepEqual(stops.slice(0, 2), ["cafe", "threads"], stops.join(","));
});

test("D6 the clean screen has no 'picks upstairs' stop (its bubble is hidden): no floor hints", () => {
  assert.deepEqual(CLEAN_FREE_WALK, { hintRadiusM: -1 });
});

// ── Task 2a: two companions ───────────────────────────────────────────────

test("C1 two companions in the picker: the dog and the robot", () => {
  assert.deepEqual(Object.keys(COMPANIONS), ["dog", "robot"]);
  assert.deepEqual(companionChoices().map((c) => c.id), ["dog", "robot"]);
});

test("C2 the animated models play a clip for each mood: walk or run by speed, idle while waiting, wave while pointing", async () => {
  const { clipFor } = await import("../anim.ts");
  assert.deepEqual(clipFor("robot", "lead", 1.3).clip, "Walking");
  assert.deepEqual(clipFor("robot", "run", 3).clip, "Running");
  assert.deepEqual(clipFor("robot", "lead", 0).clip, "Idle");
  assert.deepEqual(clipFor("robot", "wait", 0).clip, "Idle");
  assert.deepEqual(clipFor("robot", "point", 0).clip, "Wave");
  assert.deepEqual(clipFor("robot", "arrived", 0).clip, "ThumbsUp");
  assert.deepEqual(clipFor("dog", "lead", 1.3).clip, "Walk");
  assert.deepEqual(clipFor("dog", "lead", 3.5).clip, "Gallop");
  assert.deepEqual(clipFor("dog", "sit", 0).clip, "Idle_2_HeadLow");
  assert.deepEqual(clipFor("dog", "wait", 0).clip, "Idle");
  assert.deepEqual(clipFor("dog", "point", 0).clip, "Idle_2");
  // Feet keep time with the ground: the walk plays faster when it walks faster, within limits.
  assert.ok(clipFor("dog", "lead", 2).rate > clipFor("dog", "lead", 1).rate);
  assert.ok(clipFor("dog", "lead", 50).rate <= 2 && clipFor("dog", "lead", 0.2).rate >= 0.5);
  assert.equal(clipFor("robot", "wait", 0).rate, 1);
});

test("V6 the wheelchair takes lifts only: every Step-Free route in the airport goes by lift (no ramp, stairs or escalator); Walk takes the stairs to the C pier", () => {
  const m = load("map.json");
  assert.ok(m.edges.every((e) => e.kind !== "ramp"), "no ramp left at the airport");
  const dests = m.nodes.filter((n) => n.kind === "destination" || n.kind === "place").map((n) => n.id);
  for (const d of dests) {
    const r = new Navigator(m, "sign", d, "stepFree").route;
    if (r.status !== "route") continue;
    assert.ok(r.edges.every((e) => e.kind === "walk" || e.kind === "lift"), d + ": " + r.edges.map((e) => e.kind).join(","));
  }
  const c12 = new Navigator(m, "sign", "gateC12", "stepFree").route;
  assert.ok(c12.status === "route" && c12.edges.filter((e) => e.kind === "lift").length === 2, "two lifts to Gate C12");
  const walk = new Navigator(m, "concourse", "gateC12", "walk").route;
  assert.ok(walk.status === "route" && walk.edges.some((e) => e.kind === "stairs"), "walking: the stairs, the quickest");
});

test("O1 offers show after you look at a shop for 2 s, not before; at most 2, with Sponsored kept", async () => {
  const { OFFER_LOOK_S, ShopLook, offerPeek, frontTargets } = await import("../freewalk.ts");
  assert.equal(OFFER_LOOK_S, 2);
  const m = load("mall.json");
  const look = new ShopLook(m as any, [], { dotShowSeconds: OFFER_LOOK_S });
  // Stand in front of Threads and look at it.
  const t = (frontTargets(m as any) as any[]).filter((x) => x.id === "threads")[0];
  assert.ok(t, "Threads has a front");
  const c = { x: (t.x1 + t.x2) / 2, z: (t.z1 + t.z2) / 2 };
  const pos = { x: c.x, y: 0, z: c.z + 4 };
  const heading = (Math.atan2(c.x - pos.x, c.z - pos.z) * 180) / Math.PI;
  assert.equal(look.update(pos, heading, 0, 10), null);
  assert.equal(look.update(pos, heading, 0, 11.9), null, "not yet at 1.9 s");
  assert.equal(look.update(pos, heading, 0, 12.05), "threads", "shown at 2 s");
  const p = offerPeek(m as any, "threads", [], 0)!;
  assert.ok(p.lines.length >= 1 && p.lines.length <= 2);
});
