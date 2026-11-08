// Alex's review of v3 (ROUND2.md, Nov 8): the Control tab see-through (R2-12), the pointing line names the
// preference that picked the shop (R2-14), Free walk asks for preferences in free text (R2-15), and a calm
// companion in Free walk (R2-17).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseMap } from "../router.ts";
import type { MapData } from "../router.ts";
import { CONTROL_TAB_OPACITY } from "../dock.ts";
import { demoSettings } from "../demo.ts";
import { FreeWalk, FREE_DEFAULTS, parsePrefs, parsePrefsReply, pointReason, prefsPrompt, prefsQuestion } from "../freewalk.ts";

function mall(): MapData {
  const r = parseMap(readFileSync(new URL("../data/mall.json", import.meta.url), "utf8"));
  if (!r.ok) throw new Error("mall");
  return r.map;
}

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

test("R12 the folded Control tab is see-through: the view shows behind it", () => {
  assert.ok(CONTROL_TAB_OPACITY >= 0.3 && CONTROL_TAB_OPACITY <= 0.6, "opacity " + CONTROL_TAB_OPACITY);
});

test("R14 the pointing line names the preference that picked the shop", () => {
  const m = mall();
  assert.equal(pointReason(m, "threads", ["coffee", "clothes"]), "Clothes · your pick");
  assert.equal(pointReason(m, "cafe", ["coffee", "clothes"]), "Café · your pick");
  // Not one of your picks, or not a shop: nothing to say.
  assert.equal(pointReason(m, "threads", ["coffee"]), null);
  assert.equal(pointReason(m, "nowhere", ["coffee"]), null);
});

test("R14b the walk's frame carries the reason while it points", () => {
  const m = mall();
  const fw = new FreeWalk(m, ["clothes"], { aheadM: 2.5 });
  const threads = m.nodes.filter((n) => n.id === "threads")[0];
  const pos = { x: threads.x, y: 0, z: 7.5 };
  fw.setCompanion(true, pos, 90);
  let reason: string | null = null;
  const dt = 1 / 30;
  for (let i = 0; i < 30 * 8; i++) {
    const f = fw.update({ x: pos.x - 4 + i * 0.01, y: 0, z: 7.5 }, 90, dt, 20 + i * dt);
    if (f.pointing === "threads" && f.reason) reason = f.reason;
  }
  assert.equal(reason, "Clothes · your pick");
});

test("R15 free text to preferences: the map's own categories, in the map's order", () => {
  const m = mall();
  assert.deepEqual(parsePrefs(m, "I'm into fashion and I need a coffee").ids, ["coffee", "clothes"]);
  assert.deepEqual(parsePrefs(m, "something to eat, and books").ids, ["food", "books"]);
  assert.deepEqual(parsePrefs(m, "toys for the kids and some sneakers").ids, ["sport", "kids"]);
  assert.deepEqual(parsePrefs(m, "makeup").ids, ["beauty"]);
  // "Same as last time" keeps what was saved; nothing recognised gives nothing.
  assert.equal(parsePrefs(m, "same as last time").keep, true);
  assert.equal(parsePrefs(m, "yes please, the same").keep, true);
  assert.deepEqual(parsePrefs(m, "the weather is nice").ids, []);
  assert.equal(parsePrefs(m, "the weather is nice").keep, false);
  // A new list wins over "same": "same coffee but also clothes" names its own.
  assert.deepEqual(parsePrefs(m, "coffee, and also clothes this time").ids, ["coffee", "clothes"]);
});

test("R15b the companion's question names the saved preferences, or asks fresh", () => {
  assert.equal(prefsQuestion(["Café", "Clothes"]), "Same as last time: Café, Clothes? Or tell me what you're into.");
  assert.equal(prefsQuestion([]), "What are you into today?");
});

test("R15c the LLM is asked with the map's categories and answers with ids only", () => {
  const m = mall();
  const p = prefsPrompt(m, "I fancy a latte and new jeans");
  for (const id of ["coffee", "clothes", "food", "beauty"]) assert.ok(p.indexOf(id) >= 0, "prompt lists " + id);
  assert.ok(p.indexOf("I fancy a latte and new jeans") >= 0);
  assert.deepEqual(parsePrefsReply(m, '{"interests": ["clothes", "coffee", "spaceships"]}'), ["coffee", "clothes"]);
  assert.deepEqual(parsePrefsReply(m, 'Sure! {"interests":["food"]}'), ["food"]);
  assert.equal(parsePrefsReply(m, "no idea"), null);
});

// Walks the user along z at 1.3 m/s for `s` seconds (heading 0 = north), or stands; returns the frames.
function run(fw: FreeWalk, from: { x: number; z: number }, heading: number, speed: number, t0: number, s: number, look?: (t: number) => number) {
  const dt = 1 / 30;
  const out: { t: number; pet: { x: number; z: number; heading: number; mood: string }; user: { x: number; z: number } }[] = [];
  const dir = { x: Math.sin((heading * Math.PI) / 180), z: Math.cos((heading * Math.PI) / 180) };
  for (let i = 1; i <= Math.round(s / dt); i++) {
    const t = t0 + i * dt;
    const user = { x: from.x + dir.x * speed * i * dt, y: 0, z: from.z + dir.z * speed * i * dt };
    const f = fw.update(user, look ? look(t) : heading, dt, t);
    out.push({ t, pet: { x: f.pet!.pos.x, z: f.pet!.pos.z, heading: f.pet!.heading, mood: f.pet!.mood }, user });
  }
  return out;
}

test("R17 calm companion: it never dashes (walking pace), turns gently, and never runs", () => {
  const m = mall();
  // As in the Lens: 7 m ahead.
  const fw = new FreeWalk(m, ["coffee", "clothes"], { aheadM: 7 });
  const start = { x: 30, y: 0, z: 16 };
  fw.setCompanion(true, start, 0);
  const frames = run(fw, start, 0, 0, 0, 2) // stand
    .concat(run(fw, start, 180, 0, 2, 12)) // turn round and stand: it comes round calmly
    .concat(run(fw, start, 180, 1.3, 14, 6)); // walk south
  let maxSpeed = 0;
  let maxTurn = 0;
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i];
    const dt = b.t - a.t;
    maxSpeed = Math.max(maxSpeed, dist(a.pet, b.pet) / dt);
    const turn = Math.abs(((b.pet.heading - a.pet.heading + 540) % 360) - 180);
    maxTurn = Math.max(maxTurn, turn / dt);
    assert.notEqual(b.pet.mood, "run", "no running at " + b.t.toFixed(2));
  }
  assert.ok(maxSpeed <= FREE_DEFAULTS.runSpeed + 1e-6 && FREE_DEFAULTS.runSpeed <= 2.6, "top speed " + maxSpeed.toFixed(2) + " m/s");
  assert.ok(maxTurn <= 150, "turn rate " + maxTurn.toFixed(0) + " deg/s");
  // In the end it leads again, ahead of the walking direction.
  const last = frames[frames.length - 1];
  assert.ok(last.pet.z < last.user.z - 3, "ahead (south): pet " + JSON.stringify(last.pet) + " user " + JSON.stringify(last.user));
});

test("R17b a look around while standing doesn't send it round you", () => {
  const m = mall();
  const fw = new FreeWalk(m, [], { aheadM: 7 });
  const start = { x: 30, y: 0, z: 16 };
  fw.setCompanion(true, start, 0);
  run(fw, start, 0, 0, 0, 2);
  // Looking left, right and behind for 2 s each while standing: it stays where it was.
  const before = { ...fw.pet!.pos };
  const looks = [270, 90, 180];
  const frames = run(fw, start, 0, 0, 2, 6, (t) => looks[Math.min(2, Math.floor((t - 2) / 2))]);
  const moved = Math.max(...frames.map((f) => dist(f.pet, before)));
  assert.ok(moved < 1.5, "moved " + moved.toFixed(2) + " m");
});

test("R15d the Free walk demo: last time was Books; what you say picks Café and Clothes", () => {
  const m = mall();
  const d = demoSettings("freeWalkRobot")!;
  assert.deepEqual(d.interests, ["books"]);
  assert.equal(prefsQuestion(d.interests.map((id) => m.place!.interests!.filter((i) => i.id === id)[0].label)), "Same as last time: Books? Or tell me what you're into.");
  assert.deepEqual(parsePrefs(m, d.prefsPhrase), { ids: ["coffee", "clothes"], keep: false });
});

test("R11 the food court looks like one: three stalls with menu boards, tables and chairs outside", async () => {
  const { foodHallParts } = await import("../props.ts");
  const parts = foodHallParts(280);
  assert.equal(parts.filter((p) => p.part === "counter").length, 3);
  assert.equal(parts.filter((p) => p.part === "board").length, 3);
  assert.ok(parts.filter((p) => p.part === "table").length >= 4);
  assert.ok(parts.filter((p) => p.part === "chair").length >= 8);
});

test("R11b nothing of it stands in the way: the walk from the sign to the food court never comes within 0.5 m of a table or chair", async () => {
  const { foodHallParts, partAt } = await import("../props.ts");
  const { shopFrontPose } = await import("../freewalk.ts");
  const { Navigator } = await import("../router.ts");
  const m = mall();
  const front = shopFrontPose(m as any, "foodCourt")!;
  const r = new Navigator(m, "sign", "foodCourt", "walk").route;
  assert.equal(r.status, "route");
  const at: { [id: string]: any } = {};
  for (const n of m.nodes) at[n.id] = n;
  const pts = (r as any).nodes.map((id: string) => at[id]).filter((n: any) => Math.abs(n.y - front.y) < 0.5);
  const solids = foodHallParts(280).filter((p) => p.part === "table" || p.part === "chair").map((p) => ({ c: partAt(front, p), r: Math.max(p.w, p.d) / 200 }));
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    for (let s = 0; s <= len; s += 0.1) {
      const q = { x: a.x + ((b.x - a.x) * s) / len, z: a.z + ((b.z - a.z) * s) / len };
      for (const o of solids) assert.ok(Math.hypot(q.x - o.c.x, q.z - o.c.z) > o.r + 0.5, "too near a table/chair at " + JSON.stringify(q));
    }
  }
});

test("R18 Offline mode: the map stays, no LLM and no map download; the Control panel says so", async () => {
  const { connectivity } = await import("../dock.ts");
  assert.deepEqual(connectivity(true, true), { llm: false, downloadMap: false, label: "Offline: map on this device, no AI" });
  assert.deepEqual(connectivity(false, true), { llm: true, downloadMap: true, label: "Online" });
  assert.deepEqual(connectivity(false, false), { llm: false, downloadMap: true, label: "Online (no AI here)" });
});

test("R18b offline, voice still works from the map's own data: names, categories, interest words, gate codes", async () => {
  const { matchDestination, planAsk } = await import("../freewalk.ts");
  const m = mall();
  assert.equal(matchDestination(m as any, "take me to the food court"), "foodCourt");
  assert.deepEqual(parsePrefs(m, "I'm into fashion").ids, ["clothes"]);
  const r = parseMap(readFileSync(new URL("../data/map.json", import.meta.url), "utf8"));
  if (!r.ok) throw new Error("airport");
  assert.equal(matchDestination(r.map as any, "gate 12C"), "gateC12");
  assert.ok(planAsk(r.map as any, "coffee and a bathroom before my flight at gate 12C", r.map.place!.start!, true, () => 1).length >= 3);
});

test("R18c offline and not understood: the reply points to the no-voice ways", async () => {
  const { notCaught } = await import("../dock.ts");
  assert.equal(notCaught(true), "Didn't catch that (offline). Try Where to? or Pick on the map.");
  assert.equal(notCaught(false), "didn't catch that: try Where to?");
});
