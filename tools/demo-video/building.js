// A stand-in 3D building for any map (hospital, campus, ...), drawn from the layout that
// place-layout.mjs builds in Node (timeline.json carries it): floor slabs with openings, outer
// walls with doorways, rooms behind destinations with their names, desks at assistance points,
// glass lifts with doors facing the corridor, stairs and ramps, outdoor paths and trees, people,
// and the red out-of-service AR signs. The airport keeps its own, hand-made model (airport.js).
import * as THREE from "three";
import { V, beam, box, canvasTex, lambert, person, signBoard, signTex, slab, tileTex } from "./airport.js";

const DEG = Math.PI / 180;
const HEAD = { N: 0, E: 90, S: 180, W: 270 };
const OUT = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] };

const THEMES = {
  Hospital: { sky: 0xd8e6f0, floor: ["#e9eef0", "#cfd8dc", "#9fb0b8"], upper: ["#e3eaec", "#c8d2d6", "#98a8b0"], wall: 0xf4f7f8, accent: "#0f7c8c", room: 0xdfeff0, ground: 0x9aa59a },
  Campus: { sky: 0xb7d4f0, floor: ["#d8cfc2", "#b9ad9c", "#8a7f70"], upper: ["#d2c8ba", "#b3a796", "#857a6b"], wall: 0xb5654a, accent: "#7a2e1c", room: 0xefe6d6, ground: 0x6f9a52 },
};

export function buildPlace(scene, map, L) {
  const theme = THEMES[L.title] || THEMES.Hospital;
  const node = (id) => map.nodes.find((n) => n.id === id);
  const root = new THREE.Group();
  scene.add(root);
  scene.background = new THREE.Color(theme.sky);
  scene.fog = new THREE.Fog(theme.sky, 50, 170);
  scene.add(new THREE.HemisphereLight(0xf2f6ff, 0x8a8170, 1.9));
  const sun = new THREE.DirectionalLight(0xfff3e0, 1.3);
  sun.position.set(30, 60, 20);
  scene.add(sun);

  const floorM = new THREE.MeshLambertMaterial({ map: tileTex(...theme.floor) });
  const upperM = new THREE.MeshLambertMaterial({ map: tileTex(...theme.upper, 1.0) });
  const glass = new THREE.MeshLambertMaterial({ color: 0xa9cbe6, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const frame = lambert(0x4a5260);
  const wallM = lambert(theme.wall);
  const steel = lambert(0xb8c0c9);

  // Ground: grass outdoors (campus) or pavement around a single building.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), lambert(L.outdoor ? theme.ground : 0x8d9196));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = L.lowest - 0.06;
  root.add(ground);
  const pave = new THREE.MeshLambertMaterial({ map: tileTex("#c9c3b8", "#aaa396", "#8a8478", 0.8) });
  for (const p of L.paths) {
    const a = { x: p.a.x, y: L.lowest - 0.02, z: p.a.z }, b = { x: p.b.x, y: L.lowest - 0.02, z: p.b.z };
    beam(root, a, b, 3.2, 0.04, pave);
  }

  // Floors (with openings), ceilings under upper floors are the slab undersides.
  for (const f of L.floors) {
    const { x0, x1, z0, z1 } = f.r;
    const holes = f.holes.map((h) => [[h.x0, h.z0], [h.x0, h.z1], [h.x1, h.z1], [h.x1, h.z0]]);
    slab(root, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], f.y, f.y === L.lowest ? floorM : upperM, f.y === L.lowest ? 0.25 : 0.4, holes);
  }
  // Glass railings round stair and ramp openings (not on the side you step off).
  for (const r of L.rails) {
    const [ax, az, bx, bz] = r.seg;
    beam(root, { x: ax, y: r.y + 0.55, z: az }, { x: bx, y: r.y + 0.55, z: bz }, 0.03, 1.1, glass);
    beam(root, { x: ax, y: r.y + 1.1, z: az }, { x: bx, y: r.y + 1.1, z: bz }, 0.06, 0.05, frame);
  }
  // Roofs.
  for (const b of L.buildings) box(root, b.x0, b.x1, L.lowest + L.height, L.lowest + L.height + 0.3, b.z0, b.z1, lambert(0xeeeeea));
  const lightM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const b of L.buildings) for (const y of L.levels) for (let z = b.z0 + 2; z < b.z1 - 1; z += 4) {
    const ceil = L.levels.find((l) => l > y + 0.5);
    box(root, b.x0 + 2, b.x1 - 2, (ceil !== undefined ? ceil - 0.42 : L.lowest + L.height - 0.02), (ceil !== undefined ? ceil - 0.40 : L.lowest + L.height), z, z + 0.3, lightM);
  }

  // Outer walls with doorways and a name over each door; low windows band.
  const winM = new THREE.MeshLambertMaterial({ color: 0x9fc3e0, transparent: true, opacity: 0.55 });
  for (const w of L.walls) {
    const a = w.vertical ? { x: w.c, z: w.a } : { x: w.a, z: w.c };
    const b = w.vertical ? { x: w.c, z: w.b } : { x: w.b, z: w.c };
    beam(root, { ...a, y: (w.y0 + w.y1) / 2 }, { ...b, y: (w.y0 + w.y1) / 2 }, 0.3, w.y1 - w.y0, wallM);
    if (!w.door) for (const y of L.levels) beam(root, { ...a, y: y + 1.9 }, { ...b, y: y + 1.9 }, 0.34, 1.4, winM);
  }
  for (const b of L.buildings) {
    const door = L.walls.find((w) => w.door && L.buildings.length > 1 && ((w.vertical && (w.c === b.x0 || w.c === b.x1)) || (!w.vertical && (w.c === b.z0 || w.c === b.z1))) && (w.vertical ? w.a >= b.z0 && w.b <= b.z1 : w.a >= b.x0 && w.b <= b.x1));
    const d = door || L.walls.find((w) => w.door);
    if (!d || !b.name) continue;
    const mid = (d.a + d.b) / 2;
    const facing = d.vertical ? (d.c === b.x0 ? 270 : 90) : d.c === b.z0 ? 180 : 0;
    const off = 0.2;
    const x = d.vertical ? d.c + (facing === 90 ? off : -off) : mid, z = d.vertical ? mid : d.c + (facing === 0 ? off : -off);
    signBoard(root, x, L.lowest + 3.3, z, facing, 4.4, 0.8, signTex([b.name], { w: 1536, h: 280, bg: theme.accent, fg: "#ffffff", size: 130 }), false);
  }

  // Rooms behind destinations: walls, a doorway on the front, the name above it.
  for (const r of L.rooms) {
    const { x0, x1, z0, z1 } = r.r;
    box(root, x0, x1, r.y, r.y + 3.0, z0, z1, lambert(theme.room));
    const [ox, oz] = OUT[r.face];
    const fx = r.face === "E" ? x1 : r.face === "W" ? x0 : (x0 + x1) / 2;
    const fz = r.face === "N" ? z1 : r.face === "S" ? z0 : (z0 + z1) / 2;
    const door = r.face === "E" || r.face === "W" ? [fx + ox * 0.03, fx + ox * 0.08, r.y, r.y + 2.2, fz - 0.6, fz + 0.6] : [fx - 0.6, fx + 0.6, r.y, r.y + 2.2, fz + oz * 0.03, fz + oz * 0.08];
    box(root, Math.min(door[0], door[1]), Math.max(door[0], door[1]), door[2], door[3], Math.min(door[4], door[5]), Math.max(door[4], door[5]), lambert(0x6b7a8a));
    signBoard(root, fx + ox * 0.1, r.y + 2.6, fz + oz * 0.1, HEAD[r.face], 2.6, 0.55, signTex([r.label], { w: 1024, h: 220, bg: theme.accent, fg: "#ffffff", size: 120 }), false);
  }
  // Desks at assistance points.
  for (const d of L.desks) {
    const { x0, x1, z0, z1 } = d.r;
    box(root, x0, x1, d.y, d.y + 1.05, z0, z1, lambert(0x5b6b7a));
    box(root, x0 - 0.05, x1 + 0.05, d.y + 1.05, d.y + 1.12, z0 - 0.05, z1 + 0.05, lambert(0xe9e6df));
    const [ox, oz] = OUT[d.face];
    signBoard(root, (x0 + x1) / 2 + ox * 0.2, d.y + 2.5, (z0 + z1) / 2 + oz * 0.2, HEAD[d.face], 2.2, 0.5, signTex([d.label], { w: 1024, h: 220, bg: "#2f6f3e", fg: "#ffffff", size: 110 }));
  }

  // Stairs and ramps.
  const stone = lambert(0xcfcac0);
  for (const c of L.connectors) {
    const { a, b } = c;
    if (c.kind === "ramp") {
      beam(root, { x: a.x, y: a.y - 0.08, z: a.z }, { x: b.x, y: b.y - 0.08, z: b.z }, 1.8, 0.16, lambert(0xb9b2a5));
    } else {
      const rise = b.y - a.y, n = Math.max(4, Math.round(Math.abs(rise) / 0.17));
      const dx = (b.x - a.x) / n, dz = (b.z - a.z) / n, dy = rise / n;
      const Ls = Math.hypot(dx, dz), ang = Math.atan2(b.x - a.x, b.z - a.z);
      for (let i = 0; i < n; i++) {
        const topY = a.y + dy * (i + (rise > 0 ? 1 : 0));
        const bottom = Math.min(a.y, b.y) - 0.3;
        const step = new THREE.Mesh(new THREE.BoxGeometry(1.8, topY - bottom, Ls + 0.02), stone);
        step.position.copy(V(a.x + dx * (i + 0.5), (topY + bottom) / 2, a.z + dz * (i + 0.5)));
        step.rotation.y = Math.PI - ang;
        root.add(step);
      }
    }
    // Handrails along the run, stopping short of both landings so turning there is clear.
    const ang = Math.atan2(b.x - a.x, b.z - a.z);
    const px = Math.cos(ang) * 1.0, pz = -Math.sin(ang) * 1.0;
    const run = Math.hypot(b.x - a.x, b.z - a.z) || 1, cut = Math.min(0.45, 1.2 / run);
    const a2 = { x: a.x + (b.x - a.x) * cut, y: a.y + (b.y - a.y) * cut, z: a.z + (b.z - a.z) * cut };
    const b2 = { x: b.x + (a.x - b.x) * cut, y: b.y + (a.y - b.y) * cut, z: b.z + (a.z - b.z) * cut };
    for (const s of [-1, 1]) {
      beam(root, { x: a2.x + px * s, y: a2.y + 0.55, z: a2.z + pz * s }, { x: b2.x + px * s, y: b2.y + 0.55, z: b2.z + pz * s }, 0.03, 1.1, glass);
      beam(root, { x: a2.x + px * s, y: a2.y + 1.1, z: a2.z + pz * s }, { x: b2.x + px * s, y: b2.y + 1.1, z: b2.z + pz * s }, 0.06, 0.05, frame);
    }
  }

  // Glass lifts: openings where the landing doors are; a cab that rides.
  const lifts = {};
  const half = 1.25;
  for (const l of L.lifts) {
    const H = l.hi - l.lo + 3.4;
    const grp = new THREE.Group();
    root.add(grp);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(grp, l.x + sx * half - 0.06, l.x + sx * half + 0.06, l.lo, l.lo + H, l.z + sz * half - 0.06, l.z + sz * half + 0.06, frame);
    const doorAt = { N: [], S: [], E: [], W: [] };
    doorAt[l.doors[0]].push(l.lo);
    doorAt[l.doors[1]].push(l.hi);
    for (const f of ["N", "S", "E", "W"]) {
      const horiz = f === "N" || f === "S";
      const c = { x: l.x + OUT[f][0] * half, z: l.z + OUT[f][1] * half };
      const a = horiz ? { x: c.x - half, z: c.z } : { x: c.x, z: c.z - half };
      const b = horiz ? { x: c.x + half, z: c.z } : { x: c.x, z: c.z + half };
      let from = l.lo;
      for (const lvl of doorAt[f].sort((p, q) => p - q)) {
        if (lvl > from) beam(grp, { ...a, y: (from + lvl) / 2 }, { ...b, y: (from + lvl) / 2 }, 0.03, lvl - from, glass);
        from = lvl + 2.5;
      }
      if (l.lo + H > from) beam(grp, { ...a, y: (from + l.lo + H) / 2 }, { ...b, y: (from + l.lo + H) / 2 }, 0.03, l.lo + H - from, glass);
    }
    const doors = [];
    for (const [lvl, face] of [[l.lo, l.doors[0]], [l.hi, l.doors[1]]]) {
      const horiz = face === "N" || face === "S";
      const [ox, oz] = OUT[face];
      const cx = l.x + ox * (half + 0.05), cz = l.z + oz * (half + 0.05);
      const leaves = [];
      for (const s of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 0.56 : 0.05, 2.2, horiz ? 0.05 : 0.56), steel);
        m.userData.base = V(cx + (horiz ? s * 0.28 : 0), lvl + 1.1, cz + (horiz ? 0 : s * 0.28));
        m.userData.dir = horiz ? new THREE.Vector3(s, 0, 0) : new THREE.Vector3(0, 0, -s);
        m.position.copy(m.userData.base);
        grp.add(m);
        leaves.push(m);
      }
      doors.push(leaves);
    }
    const cab = new THREE.Group();
    const cabFloor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 2.4), lambert(0x3d434c));
    cabFloor.position.y = -0.08;
    const cabTop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 2.4), lambert(0xd5d9de));
    cabTop.position.y = 2.6;
    cab.add(cabFloor, cabTop);
    cab.position.copy(V(l.x, l.lo, l.z));
    grp.add(cab);
    lifts[l.id] = { cab, doors };
  }

  // Red out-of-service AR signs in front of each closable lift's ground door.
  const oos = {};
  for (const ev of (map.place && map.place.events) || []) {
    if (ev.type !== "connectionClosed") continue;
    const l = L.lifts.find((x) => x.id === ev.edge);
    if (!l) continue;
    const c = document.createElement("canvas");
    c.width = 768;
    c.height = 256;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const draw = (solid) => {
      const g = c.getContext("2d");
      g.clearRect(0, 0, 768, 256);
      g.fillStyle = solid ? "rgba(225,40,40,1)" : "rgba(225,40,40,0.55)";
      g.beginPath();
      g.roundRect(8, 8, 752, 240, 48);
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.9)";
      g.lineWidth = 6;
      g.stroke();
      g.fillStyle = "#fff";
      g.textAlign = "center";
      g.font = '700 58px "Segoe UI", Arial';
      g.fillText(ev.sign || "Out of service", 384, 112);
      g.font = '500 40px "Segoe UI", Arial';
      g.fillText(solid ? "Reported. Re-routing." : "Pinch to confirm", 384, 186);
      tex.needsUpdate = true;
    };
    draw(false);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    const [ox, oz] = OUT[l.doors[0]];
    m.position.copy(V(l.x + ox * (half + 0.25), l.lo + 1.75, l.z + oz * (half + 0.25)));
    m.rotation.y = Math.PI - HEAD[l.doors[0]] * DEG;
    m.renderOrder = 5;
    root.add(m);
    oos[ev.id] = { mesh: m, draw, edge: ev.edge, solid: false };
  }

  // "You are here" totem beside the start sign.
  const start = node((map.place && map.place.start) || "sign");
  const totem = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.1, 0.12), lambert(0x24476b));
  post.position.y = 1.05;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), new THREE.MeshBasicMaterial({
    map: canvasTex(256, 384, (g, w) => {
      g.fillStyle = "#f4f6f9";
      g.fillRect(0, 0, w, 384);
      g.fillStyle = "#24476b";
      g.fillRect(0, 0, w, 70);
      g.fillStyle = "#fff";
      g.font = '700 34px "Segoe UI", Arial';
      g.textAlign = "center";
      g.fillText("You are here", w / 2, 47);
      g.strokeStyle = "#9aa6b5";
      g.lineWidth = 6;
      g.strokeRect(30, 110, 196, 220);
      g.fillStyle = "#e8590c";
      g.beginPath();
      g.arc(128, 300, 16, 0, Math.PI * 2);
      g.fill();
    }, false),
  }));
  face.position.set(0, 1.35, 0.07);
  totem.add(post, face);
  totem.position.copy(V(start.x + 2.0, L.lowest, start.z + 2.6));
  totem.rotation.y = -12 * DEG;
  root.add(totem);

  // Trees on the open ground (campus), clear of paths and buildings.
  if (L.outdoor) {
    const trunk = lambert(0x6b4a2f), crown = lambert(0x3f7a3a);
    const segs = map.edges.map((e) => [node(e.from), node(e.to)]);
    const clear = (x, z) => segs.every(([a, b]) => {
      const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
      return Math.hypot(x - a.x - dx * t, z - a.z - dz * t) > 4;
    }) && L.buildings.every((b) => x < b.x0 - 2 || x > b.x1 + 2 || z < b.z0 - 2 || z > b.z1 + 2);
    for (let x = -10; x <= 80; x += 7) for (let z = -8; z <= 55; z += 7) {
      const jx = x + ((x * 13 + z * 7) % 5) - 2, jz = z + ((x * 3 + z * 11) % 5) - 2;
      if (!clear(jx, jz)) continue;
      box(root, jx - 0.15, jx + 0.15, L.lowest, L.lowest + 2.2, jz - 0.15, jz + 0.15, trunk);
      const c = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 10), crown);
      c.position.copy(V(jx, L.lowest + 3.2, jz));
      root.add(c);
    }
  }

  // A few people, standing near walls and walking across open areas, kept off the route.
  const people = [];
  const segs = map.edges.map((e) => [node(e.from), node(e.to)]);
  const offRoute = (x, y, z) => segs.every(([a, b]) => {
    if (Math.abs(a.y - y) > 1 && Math.abs(b.y - y) > 1) return true;
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
    return Math.hypot(x - a.x - dx * t, z - a.z - dz * t) > 2.2;
  }) && L.solids.every((s) => Math.abs(s.y - y) > 1 || x < s.x0 - 0.5 || x > s.x1 + 0.5 || z < s.z0 - 0.5 || z > s.z1 + 0.5);
  let seed = 1;
  for (const f of L.floors) {
    const { x0, x1, z0, z1 } = f.r;
    for (let k = 0; k < 40 && people.filter((p) => p.y === f.y).length < (L.outdoor ? 2 : 4); k++) {
      const x = x0 + 1.5 + ((seed * 37) % 97) / 97 * (x1 - x0 - 3), z = z0 + 1.5 + ((seed * 59) % 89) / 89 * (z1 - z0 - 3);
      seed++;
      if (!offRoute(x, f.y, z)) continue;
      const p = person(seed, {});
      p.position.copy(V(x, f.y, z));
      p.rotation.y = (seed * 1.7) % (Math.PI * 2);
      root.add(p);
      people.push({ p, y: f.y });
    }
  }
  if (L.outdoor) for (let k = 0; k < 30 && people.length < 12; k++) {
    const x = 5 + ((seed * 41) % 61), z = 2 + ((seed * 23) % 17);
    seed++;
    if (!offRoute(x, L.lowest, z)) continue;
    const p = person(seed, { suitcase: false });
    p.position.copy(V(x, L.lowest, z));
    p.rotation.y = (seed * 2.3) % (Math.PI * 2);
    root.add(p);
    people.push({ p, y: L.lowest });
  }

  return {
    root,
    update(t, frame) {
      for (const [id, Lf] of Object.entries(lifts)) {
        const st = frame.lifts && frame.lifts[id];
        if (!st) continue;
        Lf.cab.position.y = st.cab;
        Lf.doors.forEach((leaves, k) => leaves.forEach((m) => m.position.copy(m.userData.base.clone().add(m.userData.dir.clone().multiplyScalar(0.55 * st.door[k])))));
      }
      for (const o of Object.values(oos)) {
        o.mesh.visible = frame.mode === "Step-Free";
        const solid = !!(frame.closed && frame.closed[o.edge]);
        if (solid !== o.solid) {
          o.draw(solid);
          o.solid = solid;
        }
      }
    },
    oosAt(eventId) {
      return oos[eventId] ? oos[eventId].mesh.position : null;
    },
  };
}
