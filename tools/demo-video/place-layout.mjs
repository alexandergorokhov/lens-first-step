// The stand-in building for any map, as plain data (map metres): floor slabs with openings for
// lifts, stairs and ramps; outer walls with doorways wherever a route crosses them; a room behind
// every destination, a desk at every assistance point, glass lift shafts with their doors facing
// the corridor; and the solid boxes the traveller must never pass through (for the tests).
// Built in Node by timeline.mjs and drawn by building.js, so the same data is tested and drawn.
import { approachDir } from "../../src/core/place.ts";

const SAME = 0.5;
const LIFT_HALF = 1.25;
const DOORWAY = 2.6;

const rect = (x0, x1, z0, z1) => ({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
const clip = (h, r) => rect(Math.max(h.x0, r.x0), Math.min(h.x1, r.x1), Math.max(h.z0, r.z0), Math.min(h.z1, r.z1));

function faceToward(dir) {
  return Math.abs(dir.x) > Math.abs(dir.z) ? (dir.x > 0 ? "E" : "W") : dir.z > 0 ? "N" : "S";
}

// Where segment p->q crosses the axis-aligned line (vertical: x = c for z in [a,b]).
function crossing(p, q, vertical, c, a, b) {
  const pa = vertical ? p.x : p.z, qa = vertical ? q.x : q.z;
  if ((pa - c) * (qa - c) > 0 || pa === qa) return null;
  const t = (c - pa) / (qa - pa);
  const along = vertical ? p.z + (q.z - p.z) * t : p.x + (q.x - p.x) * t;
  return along >= a - 1e-6 && along <= b + 1e-6 ? along : null;
}

export function placeLayout(map) {
  const P = map.place || {};
  const node = (id) => map.nodes.find((n) => n.id === id);
  const levels = (P.levels && P.levels.length ? P.levels.map((l) => l.y) : [...new Set(map.nodes.map((n) => n.y))]).sort((a, b) => a - b);
  const lowest = levels[0];
  const top = levels[levels.length - 1];
  const fp = P.footprint;
  const buildings = Array.isArray(P.buildings) && P.buildings.length
    ? P.buildings.map((b) => ({ name: b.name, r: rect(b.minX, b.maxX, b.minZ, b.maxZ), levels: b.levels }))
    : [{ name: P.title || "", r: fp ? rect(fp.minX, fp.maxX, fp.minZ, fp.maxZ) : null, levels }];
  const outdoor = Array.isArray(P.buildings) && P.buildings.length > 0;

  // Openings: lift shafts, and the run of every stairs/ramp/escalator (plus a little).
  const holes = [];
  for (const e of map.edges) {
    if (e.kind === "walk") continue;
    const a = node(e.from), b = node(e.to);
    if (Math.abs(a.y - b.y) < SAME) continue;
    const yTop = Math.max(a.y, b.y);
    // Lift shafts have their own glass; stair/ramp openings get a railing on every side except
    // the one you step off at the top (open), and end exactly at the top step.
    if (e.kind === "lift") holes.push({ y: yTop, r: rect(a.x - LIFT_HALF, a.x + LIFT_HALF, a.z - LIFT_HALF, a.z + LIFT_HALF), open: "all" });
    else {
      const w = e.kind === "ramp" ? 1.0 : 1.1;
      const hi = a.y > b.y ? a : b, lo = a.y > b.y ? b : a;
      const alongX = Math.abs(hi.x - lo.x) > Math.abs(hi.z - lo.z);
      const r = alongX
        ? rect(hi.x, lo.x + Math.sign(lo.x - hi.x) * 0.2, Math.min(a.z, b.z) - w, Math.max(a.z, b.z) + w)
        : rect(Math.min(a.x, b.x) - w, Math.max(a.x, b.x) + w, hi.z, lo.z + Math.sign(lo.z - hi.z) * 0.2);
      const open = alongX ? (hi.x > lo.x ? "E" : "W") : hi.z > lo.z ? "N" : "S";
      holes.push({ y: yTop, r, open });
    }
  }

  // Floors: per building and level (the lowest level outdoors is the open ground).
  const floors = [];
  for (const b of buildings) {
    for (const y of b.levels || levels) {
      if (outdoor && y === lowest) { floors.push({ y, r: b.r, holes: [], indoor: true }); continue; }
      let r = b.r;
      if (!outdoor && y !== lowest) {
        const ns = map.nodes.filter((n) => Math.abs(n.y - y) < SAME);
        if (!ns.length) continue;
        r = rect(Math.min(...ns.map((n) => n.x)) - 3, Math.max(...ns.map((n) => n.x)) + 3, Math.min(...ns.map((n) => n.z)) - 3, Math.max(...ns.map((n) => n.z)) + 3);
        if (b.r) r = clip(r, b.r);
      }
      if (!r) continue;
      const hs = holes.filter((h) => Math.abs(h.y - y) < SAME && overlap(h.r, r)).map((h) => ({ ...clip(h.r, r), open: h.open }));
      floors.push({ y, r, holes: hs, indoor: true });
    }
  }

  // Outer walls with doorways where a ground-level route crosses them.
  const walls = [];
  const height = top - lowest + 3.6;
  for (const b of buildings) {
    if (!b.r) continue;
    const { x0, x1, z0, z1 } = b.r;
    const sides = [[true, x0, z0, z1], [true, x1, z0, z1], [false, z0, x0, x1], [false, z1, x0, x1]];
    for (const [vertical, c, a, bb] of sides) {
      const gaps = [];
      // The entrance: a doorway in front of the start sign when it stands by this wall.
      const sign = node(P.start || "sign");
      if (sign && Math.abs(sign.y - lowest) < SAME) {
        const off = vertical ? Math.abs(sign.x - c) : Math.abs(sign.z - c);
        const along = vertical ? sign.z : sign.x;
        if (off < 2.5 && along > a && along < bb) gaps.push({ at: along, half: DOORWAY / 2 });
      }
      for (const e of map.edges) {
        const p = node(e.from), q = node(e.to);
        if (Math.abs(p.y - lowest) > SAME || Math.abs(q.y - lowest) > SAME) continue;
        const at = crossing(p, q, vertical, c, a, bb);
        if (at === null) continue;
        // A route crossing at a slant needs a wider doorway to pass through it cleanly.
        const len = Math.hypot(q.x - p.x, q.z - p.z) || 1;
        const sin = Math.abs(vertical ? q.x - p.x : q.z - p.z) / len;
        gaps.push({ at, half: Math.min(4, DOORWAY / 2 / Math.max(sin, 0.2) + 0.3) });
      }
      gaps.sort((m, n) => m.at - n.at);
      let from = a;
      for (const g of gaps) {
        if (g.at - g.half > from) walls.push({ vertical, c, a: from, b: g.at - g.half, y0: lowest, y1: lowest + height, door: false });
        walls.push({ vertical, c, a: Math.max(from, g.at - g.half), b: g.at + g.half, y0: lowest + 2.6, y1: lowest + height, door: true });
        from = g.at + g.half;
      }
      if (bb > from) walls.push({ vertical, c, a: from, b: bb, y0: lowest, y1: lowest + height, door: false });
    }
  }

  // Rooms behind destinations, desks at assistance points.
  const rooms = [];
  const desks = [];
  for (const n of map.nodes) {
    if (n.kind !== "destination" && n.kind !== "assistance") continue;
    const d = approachDir(map, n.id); // toward where you come from
    // Square to the nearest wall direction, so rooms and desks line up with the building.
    const f = faceToward(d);
    const back = { E: { x: -1, z: 0 }, W: { x: 1, z: 0 }, N: { x: 0, z: -1 }, S: { x: 0, z: 1 } }[f];
    const side = { x: -back.z, z: back.x };
    const at = (fw, s) => ({ x: n.x + back.x * fw + side.x * s, z: n.z + back.z * fw + side.z * s });
    if (n.kind === "destination") {
      const c1 = at(1.0, -2.6), c2 = at(5.0, 2.6);
      rooms.push({ id: n.id, label: n.label || n.id, y: n.y, r: rect(c1.x, c2.x, c1.z, c2.z), face: faceToward(d), front: at(1.0, 0) });
    } else {
      const c1 = at(1.0, -1.2), c2 = at(1.8, 1.2);
      desks.push({ id: n.id, label: n.label || n.id, y: n.y, r: rect(c1.x, c2.x, c1.z, c2.z), face: faceToward(d) });
    }
  }

  // Lifts: one shaft per lift edge; each landing's door faces its corridor.
  const lifts = [];
  for (const e of map.edges) {
    if (e.kind !== "lift") continue;
    const a = node(e.from), b = node(e.to);
    const lo = a.y <= b.y ? a : b, hi = a.y <= b.y ? b : a;
    lifts.push({ id: e.id, x: lo.x, z: lo.z, lo: lo.y, hi: hi.y, doors: [faceToward(approachDir(map, lo.id)), faceToward(approachDir(map, hi.id))], loId: lo.id, hiId: hi.id });
  }

  // Stairs / ramps / escalators to draw.
  const connectors = map.edges.filter((e) => e.kind !== "walk" && e.kind !== "lift").map((e) => ({ kind: e.kind, a: node(e.from), b: node(e.to) }))
    .filter((c) => Math.abs(c.a.y - c.b.y) >= SAME);

  // Outdoor paths (campus): pavement along outdoor edges.
  const paths = map.edges.filter((e) => e.outdoor).map((e) => ({ a: node(e.from), b: node(e.to) }));

  // Railings round openings on upper floors (1.1 m glass): never walked through either.
  const rails = [];
  for (const f of floors) {
    if (f.y === lowest) continue;
    for (const h of f.holes) {
      if (h.open === "all") continue;
      // Side railings stop 0.8 m short of the top step, so turning off the stairs is clear.
      const t = 0.8;
      const z0 = h.open === "S" ? h.z0 + t : h.z0, z1 = h.open === "N" ? h.z1 - t : h.z1;
      const x0 = h.open === "W" ? h.x0 + t : h.x0, x1 = h.open === "E" ? h.x1 - t : h.x1;
      const sides = { S: [x0, h.z0, x1, h.z0], E: [h.x1, z0, h.x1, z1], N: [x0, h.z1, x1, h.z1], W: [h.x0, z0, h.x0, z1] };
      for (const k of Object.keys(sides)) if (k !== h.open) rails.push({ y: f.y, side: k, seg: sides[k] });
    }
  }

  const solids = [
    ...rails.map((r) => ({ label: "railing", y: r.y, ...rect(r.seg[0] - 0.05, r.seg[2] + 0.05, r.seg[1] - 0.05, r.seg[3] + 0.05) })),
    ...rooms.map((r) => ({ label: r.label, y: r.y, ...r.r })),
    ...desks.map((d) => ({ label: d.label, y: d.y, ...d.r })),
    ...walls.filter((w) => !w.door).map((w) => ({ label: "wall", y: w.y0, ...(w.vertical ? rect(w.c - 0.15, w.c + 0.15, w.a, w.b) : rect(w.a, w.b, w.c - 0.15, w.c + 0.15)) })),
  ];
  return { title: P.title || "", outdoor, levels, lowest, top, height, floors, walls, rooms, desks, lifts, connectors, paths, solids, rails, buildings: buildings.filter((b) => b.r).map((b) => ({ name: b.name, ...b.r })) };
}
