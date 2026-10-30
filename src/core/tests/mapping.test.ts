// "Learn this place" (M1-M5 in devpost/SCENARIOS.md): mapping a place by walking it. Points are
// pinched at the feet, stretches tagged, points named, and the result is a map.json the router uses.
import { test } from "node:test";
import assert from "node:assert/strict";
import { findNode, findRoute, parseMap, validateMap, EDGE_SLACK, type MapData, type Vec3 } from "../router.ts";
import { MAPPING_NAMES, MapRecorder, tripAfterSaving } from "../mapping.ts";

const d3 = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// Walks from a to b in 0.1 m steps, telling the recorder each frame.
function walkTo(rec: MapRecorder, a: Vec3, b: Vec3) {
  const n = Math.max(1, Math.ceil(d3(a, b) / 0.1));
  for (let k = 1; k <= n; k++) rec.walked({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
}

function parsed(rec: MapRecorder): MapData {
  const r = parseMap(rec.toJson());
  if (!r.ok) throw new Error(r.error);
  return r.map;
}

// A small two-floor place: sign -> corner -> (stairs up) -> landing -> room; plus a lift.
function twoFloors(): MapRecorder {
  const rec = new MapRecorder("Test hall");
  const sign = { x: 0, y: 0, z: 0 };
  const corner = { x: 4, y: 0, z: 0 };
  const top = { x: 8, y: 4, z: 0 };
  const room = { x: 8, y: 4, z: 5 };
  rec.start(sign);
  walkTo(rec, sign, corner);
  rec.pointHere(corner);
  rec.nextFloor();
  walkTo(rec, corner, top);
  rec.pointHere(top);
  rec.tagLast("stairs");
  walkTo(rec, top, room);
  rec.pointHere(room);
  rec.name("Room");
  return rec;
}

test("M1 start(feet) makes the entrance sign the first and only node, and the map's start", () => {
  const rec = new MapRecorder("My room");
  rec.start({ x: 1, y: 0, z: 2 });
  const map = rec.toMap();
  assert.equal(map.nodes.length, 1);
  assert.equal(map.edges.length, 0);
  const n = map.nodes[0];
  assert.deepEqual([n.id, n.kind, n.label, n.x, n.y, n.z], ["sign", "sign", "Entrance sign", 1, 0, 2]);
  assert.equal(map.place!.start, "sign");
  assert.equal(map.place!.title, "My room");
});

test("M1 points before start are ignored; a default title is used", () => {
  const rec = new MapRecorder();
  assert.equal(rec.pointHere({ x: 3, y: 0, z: 0 }), null);
  assert.equal(rec.toMap().nodes.length, 0);
  rec.start({ x: 0, y: 0, z: 0 });
  assert.ok(typeof rec.toMap().place!.title === "string" && rec.toMap().place!.title!.length > 0);
});

test("M2 pointHere adds a node at the feet and a walk edge from the previous point, length = distance walked", () => {
  const rec = new MapRecorder();
  const a = { x: 0, y: 0, z: 0 };
  const b = { x: 3, y: 0, z: 0 };
  const c = { x: 3, y: 0, z: 4 };
  rec.start(a);
  // Walk a detour: 3 m out and back sideways (2 x 1 m) then to b.
  walkTo(rec, a, { x: 0, y: 0, z: 1 });
  walkTo(rec, { x: 0, y: 0, z: 1 }, a);
  walkTo(rec, a, b);
  const id = rec.pointHere(b);
  assert.ok(id);
  walkTo(rec, b, c);
  rec.pointHere(c);
  const map = rec.toMap();
  assert.equal(map.nodes.length, 3);
  const nb = findNode(map, id!)!;
  assert.deepEqual([nb.x, nb.y, nb.z], [3, 0, 0]);
  assert.equal(map.edges.length, 2);
  const [e1, e2] = map.edges;
  assert.deepEqual([e1.from, e1.to, e1.kind, e1.open], ["sign", id, "walk", true]);
  assert.ok(Math.abs(e1.length - 5) < 0.05, "walked 5 m, got " + e1.length);
  assert.ok(Math.abs(e2.length - 4) < 0.05, String(e2.length));
});

test("M2 an edge is never shorter than the straight line (no walk samples), so parseMap accepts it", () => {
  const rec = new MapRecorder();
  rec.start({ x: 0, y: 0, z: 0 });
  rec.pointHere({ x: 6, y: 0, z: 8 }); // teleported: nothing walked
  const map = rec.toMap();
  assert.ok(map.edges[0].length >= 10 - 1e-9);
  assert.equal(validateMap(map), null);
  for (const e of map.edges) {
    const a = findNode(map, e.from)!;
    const b = findNode(map, e.to)!;
    assert.ok(e.length >= d3(a, b) - EDGE_SLACK);
  }
});

test("M2 a point under 0.5 m from the previous one is ignored", () => {
  const rec = new MapRecorder();
  rec.start({ x: 0, y: 0, z: 0 });
  assert.equal(rec.pointHere({ x: 0.3, y: 0, z: 0.3 }), null);
  assert.equal(rec.toMap().nodes.length, 1);
  assert.ok(rec.pointHere({ x: 0.6, y: 0, z: 0 }));
  assert.equal(rec.toMap().nodes.length, 2);
});

test("M3 tagLast changes the last stretch's kind; stepFree means walk; a lift gets an id", () => {
  const rec = new MapRecorder();
  assert.equal(rec.tagLast("stairs"), false); // nothing to tag yet
  rec.start({ x: 0, y: 0, z: 0 });
  rec.pointHere({ x: 2, y: 0, z: 0 });
  for (const kind of ["stairs", "lift", "ramp", "escalator", "walk"] as const) {
    assert.equal(rec.tagLast(kind), true);
    assert.equal(rec.toMap().edges[0].kind, kind);
  }
  rec.tagLast("lift");
  const lift = rec.toMap().edges[0];
  assert.ok(typeof lift.id === "string" && lift.id.length > 0);
  assert.equal(validateMap(rec.toMap()), null);
  rec.tagLast("stepFree");
  assert.equal(rec.toMap().edges[0].kind, "walk");
  assert.equal(rec.tagLast("teleport" as any), false);
  assert.equal(rec.toMap().edges[0].kind, "walk");
});

test("M3 Step-Free routing avoids a stairs-tagged stretch (takes the ramp, or asks staff)", () => {
  const rec = twoFloors();
  let map = parsed(rec);
  const room = map.nodes.find((n) => n.label === "Room")!.id;
  assert.equal(findRoute(map, "sign", room, "stepFree").status, "askStaff");
  assert.equal(findRoute(map, "sign", room, "walk").status, "route");
  // Map a ramp too: back from the room down to the sign, via a longer step-free way.
  const roomAt = findNode(map, room)!;
  const rec2 = MapRecorder.fromJson(rec.toJson())!;
  walkTo(rec2, roomAt, { x: 0, y: 0, z: 5 });
  rec2.pointHere({ x: 0, y: 0, z: 5 });
  rec2.tagLast("ramp");
  // Back at the sign: a point within 0.5 m of an existing point joins it (closes the loop).
  walkTo(rec2, { x: 0, y: 0, z: 5 }, { x: 0, y: 0, z: 0.3 });
  assert.equal(rec2.pointHere({ x: 0, y: 0, z: 0.3 }), "sign");
  map = parsed(rec2);
  assert.equal(map.nodes.length, 5);
  assert.equal(map.edges.at(-1)!.to, "sign");
  const sf = findRoute(map, "sign", room, "stepFree");
  assert.equal(sf.status, "route");
  assert.ok(sf.status === "route" && sf.edges.every((e) => e.kind !== "stairs"));
  // To the top of the stairs Walk climbs them (shorter); Step-Free goes round by the ramp.
  const top = map.edges.find((e) => e.kind === "stairs")!.to;
  const w = findRoute(map, "sign", top, "walk");
  assert.ok(w.status === "route" && w.edges.some((e) => e.kind === "stairs"));
  const sfTop = findRoute(map, "sign", top, "stepFree");
  assert.ok(sfTop.status === "route" && sfTop.edges.some((e) => e.kind === "ramp") && sfTop.edges.every((e) => e.kind !== "stairs"));
});

test("M3 nextFloor records levels by height, named Floor 0, Floor 1 …", () => {
  const rec = twoFloors();
  const levels = rec.toMap().place!.levels!;
  assert.deepEqual(levels, [
    { y: 0, name: "Floor 0" },
    { y: 4, name: "Floor 1" },
  ]);
  // A basement mapped later still sorts by height.
  rec.nextFloor();
  rec.pointHere({ x: 8, y: -3, z: 5 });
  assert.deepEqual(rec.toMap().place!.levels!.map((l) => l.name + "@" + l.y), ["Floor 0@-3", "Floor 1@0", "Floor 2@4"]);
  assert.ok(parseMap(rec.toJson()).ok);
});

test("M4 names come from the short list; named points become destinations; duplicates are numbered", () => {
  assert.deepEqual(MAPPING_NAMES, ["Entrance sign", "Gate", "Room", "Toilet", "Lift", "Stairs", "Exit", "Café", "Shop"]);
  const rec = new MapRecorder();
  rec.start({ x: 0, y: 0, z: 0 });
  const labels: string[] = [];
  for (let i = 1; i <= 4; i++) {
    rec.pointHere({ x: i * 2, y: 0, z: 0 });
    labels.push(rec.name(i === 4 ? "Toilet" : "Room")!);
  }
  assert.deepEqual(labels, ["Room", "Room 2", "Room 3", "Toilet"]);
  const map = rec.toMap();
  const named = map.nodes.filter((n) => n.label && n.id !== "sign");
  assert.equal(named.length, 4);
  for (const n of named) assert.equal(n.kind, "destination");
  assert.equal(new Set(map.nodes.map((n) => n.label).filter(Boolean)).size, map.nodes.filter((n) => n.label).length);
  // Not on the list: refused, the point keeps its name.
  assert.equal(rec.name("Secret lab"), null);
  assert.equal(rec.toMap().nodes.at(-1)!.label, "Toilet");
  // Renaming the same point keeps names unique without counting itself.
  assert.equal(rec.name("Room"), "Room 4");
  assert.equal(rec.name("Room"), "Room 4");
});

test("M4 naming before start does nothing; the sign keeps its kind", () => {
  const rec = new MapRecorder();
  assert.equal(rec.name("Room"), null);
  rec.start({ x: 0, y: 0, z: 0 });
  rec.name("Entrance sign");
  assert.equal(rec.toMap().nodes[0].kind, "sign");
});

test("M5 toJson is a map parseMap accepts, and findRoute from the sign to a named point works at once", () => {
  const rec = twoFloors();
  const map = parsed(rec);
  assert.equal(map.version, 1);
  assert.equal(map.place!.title, "Test hall");
  assert.equal(map.place!.start, "sign");
  const room = map.nodes.find((n) => n.label === "Room")!;
  const r = findRoute(map, "sign", room.id, "walk");
  assert.equal(r.status, "route");
  assert.ok(r.status === "route" && r.nodes[0] === "sign" && r.nodes.at(-1) === room.id);
  assert.ok(r.status === "route" && Math.abs(r.length - (4 + Math.hypot(4, 4) + 5)) < 0.1, String(r.status === "route" && r.length));
});

test("M5 saved at the last named point: the trip starts there and leads back to the sign", () => {
  const rec = twoFloors();
  const map = parsed(rec);
  const trip = tripAfterSaving(rec.toMap(), { x: 8, y: 4, z: 5 });
  assert.equal(trip.destination, "sign");
  assert.equal(findNode(map, trip.start)?.label, "Room");
  assert.equal(findRoute(map, trip.start, trip.destination, "walk").status, "route");
});

test("M5 saved away from a named point: the trip starts at the nearest point and goes to it", () => {
  const rec = twoFloors();
  const map = parsed(rec);
  const trip = tripAfterSaving(rec.toMap(), { x: 0.4, y: 0, z: 0 });
  assert.equal(trip.start, "sign");
  assert.equal(findNode(map, trip.destination)?.label, "Room");
  assert.equal(findRoute(map, trip.start, trip.destination, "walk").status, "route");
});

test("M5 a named point straight above you is away: another floor is a trip", () => {
  const rec = twoFloors();
  const trip = tripAfterSaving(rec.toMap(), { x: 8, y: 0, z: 5 });
  assert.notEqual(trip.destination, "sign");
});

test("M5 fromJson resumes after a reload: same map, and mapping carries on", () => {
  const rec = twoFloors();
  const text = rec.toJson();
  const back = MapRecorder.fromJson(text)!;
  assert.ok(back);
  assert.deepEqual(back.toMap(), rec.toMap());
  assert.equal(back.toJson(), text);
  back.pointHere({ x: 12, y: 4, z: 5 });
  back.name("Room");
  const map = parsed(back);
  assert.equal(map.nodes.length, rec.toMap().nodes.length + 1);
  assert.equal(map.nodes.at(-1)!.label, "Room 2");
  assert.equal(map.edges.at(-1)!.from, rec.toMap().nodes.at(-1)!.id);
  assert.equal(findRoute(map, "sign", map.nodes.at(-1)!.id, "walk").status, "route");
  // Ids stay unique after a resume.
  assert.equal(new Set(map.nodes.map((n) => n.id)).size, map.nodes.length);
  assert.equal(new Set(map.edges.map((e) => e.id)).size, map.edges.length);
});

test("M5 fromJson refuses broken text", () => {
  assert.equal(MapRecorder.fromJson("not json"), null);
  assert.equal(MapRecorder.fromJson("{}"), null);
  assert.equal(MapRecorder.fromJson('{"version":1,"nodes":[{"id":"x"}],"edges":[]}'), null);
});

test("M5 undo removes the last point and its edge; undo back to nothing", () => {
  const rec = new MapRecorder();
  rec.start({ x: 0, y: 0, z: 0 });
  rec.pointHere({ x: 2, y: 0, z: 0 });
  rec.nextFloor();
  rec.pointHere({ x: 2, y: 4, z: 0 });
  assert.equal(rec.toMap().place!.levels!.length, 2);
  assert.equal(rec.undo(), true);
  let map = rec.toMap();
  assert.equal(map.nodes.length, 2);
  assert.equal(map.edges.length, 1);
  assert.equal(map.place!.levels!.length, 1);
  assert.ok(parseMap(rec.toJson()).ok);
  // The next point joins the new last point.
  const id = rec.pointHere({ x: 2, y: 0, z: 3 });
  map = rec.toMap();
  assert.equal(map.edges.at(-1)!.to, id);
  assert.equal(map.edges.at(-1)!.from, map.nodes[1].id);
  rec.undo();
  rec.undo();
  assert.equal(rec.toMap().nodes.length, 1);
  rec.undo();
  assert.equal(rec.toMap().nodes.length, 0);
  assert.equal(rec.undo(), false);
});
