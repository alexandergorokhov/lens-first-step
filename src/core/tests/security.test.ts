// Security review findings, written as tests first: a downloaded map is untrusted (honest
// sponsored tags, typed and bounded strings, no shortcuts, no reserved ids, size cap), the
// rejection reason is kept, duplicated constants agree, and the demo-video server only serves
// its own files.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { request } from "node:http";
import { fileURLToPath } from "node:url";
import { FLOOR_CUE_DISTANCE, MAX_MAP_BYTES, chooseMap, loadMapWithTimeout, parseMap, findRoute, routePoints } from "../router.ts";
import { FLOOR_CUE_M } from "../place.ts";
import { POINT_SECONDS as PET_POINT_SECONDS } from "../pet.ts";
import { POINT_SECONDS, PointingCoach, placeTag, placesOf } from "../places.ts";

const DATA = new URL("../data/", import.meta.url);
const text = (f: string) => readFileSync(new URL(f, DATA), "utf8");
function mutate(f: string, fn: (m: any) => void): string {
  const m = JSON.parse(text(f));
  fn(m);
  return JSON.stringify(m);
}
const rejected = (t: string, re?: RegExp) => {
  const r = parseMap(t);
  assert.equal(r.ok, false, "accepted");
  if (!r.ok && re) assert.match(r.error, re);
};

// ---- #1 sponsored places are always labelled -------------------------------------------------------

test("R1 A map can add to the 'Sponsored' tag but never replace or hide it", () => {
  const r = parseMap(mutate("map.json", (m) => (m.nodes.find((n: any) => n.sponsored).sponsorTag = "Staff pick")));
  assert.ok(r.ok);
  if (!r.ok) return;
  const p = placesOf(r.map).find((x) => x.sponsored)!;
  assert.match(placeTag(p), /Sponsored/);
  assert.match(placeTag(p), /Staff pick/);
  // The demo map's own suffix still reads "Sponsored · demo".
  const demo = parseMap(text("map.json"));
  assert.ok(demo.ok && placeTag(placesOf(demo.map).find((x) => x.sponsored)!) === "Juice bar · Sponsored · demo");
});

test("R1 Place fields are type-checked: sponsored is true/false, sponsorTag and category are text", () => {
  rejected(mutate("map.json", (m) => (m.nodes.find((n: any) => n.sponsored).sponsorTag = { x: 1 })), /sponsorTag/);
  rejected(mutate("map.json", (m) => (m.nodes.find((n: any) => n.sponsored).sponsored = "yes")), /sponsored/);
  rejected(mutate("map.json", (m) => (m.nodes.find((n: any) => n.kind === "place").category = 5)), /category/);
  rejected(mutate("map.json", (m) => (m.nodes.find((n: any) => n.kind === "place").label = 7)), /label/);
});

// ---- #2 an untrusted map is bounded ------------------------------------------------------------------

test("R2 A map file over the size cap is rejected before parsing", () => {
  assert.ok(MAX_MAP_BYTES >= 64 * 1024);
  const big = mutate("room.json", (m) => (m.padding = "x".repeat(MAX_MAP_BYTES)));
  rejected(big, /too big/);
});

test("R2 Every string the Lens shows is text and bounded: title, level names, sign texts, event cards and buttons", () => {
  const long = "A".repeat(200);
  rejected(mutate("map.json", (m) => (m.place.title = long)), /title/);
  rejected(mutate("map.json", (m) => (m.place.levels[0].name = 42)), /level/);
  rejected(mutate("map.json", (m) => (m.place.levels[0].name = long)), /level/);
  rejected(mutate("map.json", (m) => (m.place.scanSign = { button: long })), /scanSign/);
  rejected(mutate("map.json", (m) => (m.place.events[0].card = long)), /card/);
  rejected(mutate("map.json", (m) => (m.place.events[0].button = { a: 1 })), /button/);
  assert.ok(parseMap(text("map.json")).ok);
});

test("R2 An edge shorter than the straight line between its nodes is rejected (no shortcuts)", () => {
  rejected(mutate("map.json", (m) => (m.edges.find((e: any) => e.kind === "stairs").length = 0.1)), /shorter/);
  // Every bundled map passes.
  for (const f of ["map.json", "hospital.json", "campus.json", "room.json"]) assert.ok(parseMap(text(f)).ok, f);
});

test("R2 Reserved ids (__proto__, constructor, prototype) are rejected for nodes and edges", () => {
  for (const bad of ["__proto__", "constructor", "prototype"]) {
    rejected(mutate("room.json", (m) => {
      const old = m.nodes[1].id;
      m.nodes[1].id = bad;
      for (const e of m.edges) {
        if (e.from === old) e.from = bad;
        if (e.to === old) e.to = bad;
      }
    }), /reserved/);
    rejected(mutate("map.json", (m) => {
      const lift = m.edges.find((e: any) => e.id === "lift1");
      lift.id = bad;
      for (const ev of m.place.events) if (ev.edge === "lift1") ev.edge = bad;
    }), /reserved/);
  }
});

// ---- #5 ids that are Object.prototype names still work ----------------------------------------------

test("R5 A place whose id is 'toString' is pointed at like any other", () => {
  const r = parseMap(mutate("map.json", (m) => {
    const p = m.nodes.find((n: any) => n.sponsored);
    const old = p.id;
    p.id = "toString";
    for (const e of m.edges) {
      if (e.from === old) e.from = "toString";
      if (e.to === old) e.to = "toString";
    }
  }));
  assert.ok(r.ok);
  if (!r.ok) return;
  const route = routePoints(r.map, findRoute(r.map, "sign", "gateB12", "walk"));
  const coach = new PointingCoach(r.map);
  let pointed: string | null = null;
  let now = 0;
  for (let z = 2; z <= 18 && !pointed; z += 0.1) {
    now += 0.1;
    const p = coach.check(route, { x: 30, y: 0, z }, now, z, false);
    if (p) pointed = p.id;
  }
  assert.equal(pointed, "toString");
});

// ---- #7 duplicated constants agree --------------------------------------------------------------------

test("R7 Constants copied between core files (they cannot import each other) agree", () => {
  assert.equal(FLOOR_CUE_M, FLOOR_CUE_DISTANCE);
  assert.equal(PET_POINT_SECONDS, POINT_SECONDS);
});

// ---- #9 the reason a download was rejected is kept ------------------------------------------------------

test("R9 A rejected download keeps its reason (for the log), still falling back offline", async () => {
  const built = text("room.json");
  const c = chooseMap('{"nodes": []}', built);
  assert.equal(c.source, "offline");
  assert.match(c.error!, /no nodes/);
  assert.equal(chooseMap(built, built).error, null);
  const l = await loadMapWithTimeout(async () => "not json", "u", built, 1000);
  assert.match(l.error!, /not valid JSON/);
});

// ---- #3 the demo-video server -------------------------------------------------------------------------

test("R3 The demo-video server serves only its own files: no traversal, no crash on bad escapes, local Host only", async () => {
  const { createDemoServer } = await import("../../../tools/demo-video/server.mjs");
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const server = await createDemoServer(root, '{"frames":[]}');
  const port = (server.address() as { port: number }).port;
  const get = (path: string, host = "127.0.0.1:" + port) =>
    new Promise<number>((resolve, reject) => {
      const req = request({ host: "127.0.0.1", port, path, headers: { host } }, (res) => {
        res.resume();
        resolve(res.statusCode!);
      });
      req.on("error", reject);
      req.end();
    });
  try {
    assert.equal(await get("/"), 200);
    assert.equal(await get("/timeline.json"), 200);
    assert.equal(await get("/pet.js"), 200);
    assert.equal(await get("/node_modules/three/build/three.module.js"), 200);
    assert.equal(await get("/..%2F..%2Fspk_debug_key.pem"), 404);
    assert.equal(await get("/../../package.json"), 404);
    assert.equal(await get("/record.mjs"), 404);
    assert.equal(await get("/node_modules/three/package.json"), 404);
    assert.equal(await get("/%E0%A4%A"), 400);
    assert.equal(await get("/", "evil.example:80"), 403);
    assert.equal(await get("/"), 200, "still serving after a bad request");
  } finally {
    server.close();
  }
});
