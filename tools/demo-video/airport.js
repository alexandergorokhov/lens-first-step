// Builds a walkable stand-in airport around the airport map (src/core/data/map.json) for the
// demo video: terminal hall, departures mezzanine, escalator, stairs, glass lifts, check-in,
// shops, gates, signs and people. Positions come from the map's nodes, so the router's route
// runs exactly through it. Map metres: x east, y up, z north -> three.js (x, y, -z).
import * as THREE from "three";
import { FURNITURE, LIFTS, LIFT_HALF, SHOPS, doorFace as faceOf } from "./layout.mjs";

export const V = (x, y, z) => new THREE.Vector3(x, y, -z);
const DEG = Math.PI / 180;

// ── textures ────────────────────────────────────────────────────────────────
export function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function tileTex(base, grout, speck, tile = 1.2) {
  const t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = speck;
      g.globalAlpha = 0.15 + rnd() * 0.25;
      g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5);
    }
    g.globalAlpha = 1;
    g.strokeStyle = grout;
    g.lineWidth = 3;
    g.strokeRect(0, 0, w, h);
  });
  t.repeat.set(1 / tile, 1 / tile);
  return t;
}

export function signTex(lines, { w = 1024, h = 256, bg = "#1b2330", fg = "#ffd23f", size = 110, align = "center" } = {}) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.textBaseline = "middle";
    g.textAlign = align;
    const n = lines.length;
    lines.forEach((l, i) => {
      g.font = `600 ${i === 0 ? size : size * 0.62}px "Segoe UI", Arial, sans-serif`;
      g.fillText(l, align === "center" ? w / 2 : 40, (h * (i + 0.5)) / n + (n > 1 && i === 0 ? 6 : 0));
    });
  }, false);
}

function fidsTex() {
  const rows = [
    ["08:40", "Lisbon", "B12", "Boarding"],
    ["08:55", "Madrid", "C3", "Gate open"],
    ["09:10", "Paris", "B15", "On time"],
    ["09:25", "London", "C6", "On time"],
    ["09:40", "Rome", "B18", "Delayed"],
    ["09:55", "Berlin", "C1", "On time"],
  ];
  return canvasTex(1024, 640, (g, w, h) => {
    g.fillStyle = "#0b1730";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#ffd23f";
    g.font = '600 64px "Segoe UI", Arial';
    g.fillText("Departures", 40, 80);
    g.font = '500 48px "Segoe UI", Arial';
    rows.forEach((r, i) => {
      const y = 170 + i * 76;
      g.fillStyle = i % 2 ? "#13234a" : "#0f1d3d";
      g.fillRect(20, y - 50, w - 40, 72);
      g.fillStyle = "#ffffff";
      g.fillText(r[0], 40, y);
      g.fillText(r[1], 220, y);
      g.fillStyle = "#ffd23f";
      g.fillText(r[2], 560, y);
      g.fillStyle = r[3] === "Delayed" ? "#ff7b7b" : "#7dffa8";
      g.fillText(r[3], 720, y);
    });
  }, false);
}

// ── geometry helpers ───────────────────────────────────────────────────────
const mats = {};
export function lambert(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  return (mats[key] ??= new THREE.MeshLambertMaterial({ color, ...extra }));
}

export function box(parent, x0, x1, y0, y1, z0, z1, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)), mat);
  m.position.copy(V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
  parent.add(m);
  return m;
}

// A box from a to b (map coords, centre line) with width and height, oriented along a->b.
export function beam(parent, a, b, width, height, mat) {
  const A = V(a.x, a.y, a.z), B = V(b.x, b.y, b.z);
  const len = A.distanceTo(B);
  const m = new THREE.Mesh(new THREE.BoxGeometry(width, height, len), mat);
  m.position.copy(A.clone().add(B).multiplyScalar(0.5));
  m.lookAt(B);
  parent.add(m);
  return m;
}

// Floor slab from a polygon of map (x, z) points: tiled top at y, underside white.
export function slab(parent, pts, y, topMat, thick = 0.45, holes = []) {
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, z))));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  // Shape x,y -> map x,z; extrude along +shape z -> make it go down from y.
  geo.rotateX(-Math.PI / 2); // shape (x, z_map) -> three (x, -z_map); extrusion goes up
  const m = new THREE.Mesh(geo, [topMat, lambert(0xf3f3f1)]);
  m.position.y = y - thick;
  parent.add(m);
  return m;
}

function plane(parent, w, h, mat, pos, headingDeg) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.copy(pos);
  // Plane faces +z (three) by default = map south. Rotate to face the given heading.
  m.rotation.y = Math.PI - headingDeg * DEG;
  parent.add(m);
  return m;
}

// Hanging or standing sign board facing `heading` (direction the readable face points to).
export function signBoard(parent, x, y, z, heading, w, h, tex, hang = true) {
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  face.position.z = 0.06;
  const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.1), lambert(0x2a2f38));
  g.add(back, face);
  if (hang) {
    for (const sx of [-w / 3, w / 3]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 3, 6), lambert(0x666666));
      rod.position.set(sx, h / 2 + 1.5, 0);
      g.add(rod);
    }
  }
  g.position.copy(V(x, y, z));
  g.rotation.y = Math.PI - heading * DEG;
  parent.add(g);
  return g;
}

// ── people ──────────────────────────────────────────────────────────────────
const SHIRTS = [0x3b5b92, 0xb5523b, 0x2f7a5b, 0x7b4fa0, 0xd19a2a, 0x444b55, 0xc0c5cc, 0x8a2f3f, 0x1f6f8b];
const SKIN = [0xf1c7a5, 0xd9a07a, 0xa86b45, 0x7a4a2c, 0xe8b894];
export function person(seed, { suitcase = false, seated = false } = {}) {
  const g = new THREE.Group();
  const shirt = lambert(SHIRTS[seed % SHIRTS.length]);
  const legsM = lambert([0x22262e, 0x3a3f4a, 0x4b5a75, 0x5a4636][seed % 4]);
  const skin = lambert(SKIN[(seed * 3) % SKIN.length]);
  const hip = seated ? 0.48 : 0.9;
  const legs = [];
  for (const sx of [-0.1, 0.1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, hip, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, hip, 0.17), legsM);
    leg.position.y = -hip / 2;
    if (seated) {
      leg.geometry = new THREE.BoxGeometry(0.15, 0.17, 0.45);
      leg.position.set(0, 0, 0.22);
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.15), legsM);
      shin.position.set(0, -0.24, 0.44);
      pivot.add(shin);
    }
    pivot.add(leg);
    g.add(pivot);
    legs.push(pivot);
  }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 4, 10), shirt);
  torso.position.y = hip + 0.36;
  torso.scale.z = 0.7;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), skin);
  head.position.y = hip + 0.8;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), lambert([0x2b1d14, 0x5a3b22, 0x111111, 0x9a7a4a][seed % 4]));
  hair.position.y = hip + 0.82;
  g.add(torso, head, hair);
  if (suitcase) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.55, 0.22), lambert([0x1f3b73, 0x9b2d2d, 0x2d2d2d, 0x6b7f3a][seed % 4]));
    s.position.set(0.4, 0.33, -0.25);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.45), lambert(0x222222));
    handle.position.set(0.4, 0.8, -0.25);
    g.add(s, handle);
  }
  g.userData.legs = legs;
  return g;
}

function chairRow(parent, x0, x1, y, z, faceSouth = true) {
  const seat = lambert(0x2f5fa8), frame = lambert(0x8a9099);
  for (let x = x0; x <= x1 + 1e-6; x += 0.6) {
    box(parent, x - 0.26, x + 0.26, y + 0.42, y + 0.48, z - 0.24, z + 0.24, seat);
    const bz = faceSouth ? z + 0.24 : z - 0.24;
    box(parent, x - 0.26, x + 0.26, y + 0.48, y + 0.9, bz - 0.03, bz + 0.03, seat);
  }
  box(parent, x0 - 0.3, x1 + 0.3, y + 0.05, y + 0.42, z - 0.05, z + 0.05, frame);
}

function plane3d() {
  const g = new THREE.Group();
  const white = lambert(0xf4f6f8), blue = lambert(0x1d4f91), grey = lambert(0x9aa3ad);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 32, 20), white);
  body.rotation.z = Math.PI / 2;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), white);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 16;
  nose.scale.y = 1.6;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(2, 7, 20), white);
  tail.rotation.z = Math.PI / 2;
  tail.position.x = -19.5;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 34), white);
  wing.position.set(0, -0.8, 0);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(5, 7, 0.4), blue);
  fin.position.set(-19, 4, 0);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 11), white);
  stab.position.set(-20, 1, 0);
  g.add(body, nose, tail, wing, fin, stab);
  for (const z of [-7, 7]) {
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 3.5, 14), grey);
    eng.rotation.z = Math.PI / 2;
    eng.position.set(1.5, -2, z);
    g.add(eng);
  }
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(2.02, 2.02, 30, 20, 1, true, Math.PI * 0.42, Math.PI * 0.16), blue);
  stripe.rotation.z = Math.PI / 2;
  g.add(stripe);
  return g;
}

// ── the building ─────────────────────────────────────────────────────────────
export function buildAirport(scene, map) {
  const node = (id) => map.nodes.find((n) => n.id === id);
  const root = new THREE.Group();
  scene.add(root);

  scene.background = new THREE.Color(0xb9d3ee);
  scene.fog = new THREE.Fog(0xd5dde6, 45, 160);
  scene.add(new THREE.HemisphereLight(0xeef4ff, 0x8d8273, 1.9));
  const sun = new THREE.DirectionalLight(0xfff3e0, 1.3);
  sun.position.set(30, 60, 20);
  scene.add(sun);

  const terrazzo = new THREE.MeshLambertMaterial({ map: tileTex("#d9d6cf", "#b9b4aa", "#8f8a80") });
  const upperFloor = new THREE.MeshLambertMaterial({ map: tileTex("#c9ccd2", "#a9adb5", "#7d828c", 1.0) });
  const pierFloor = new THREE.MeshLambertMaterial({ map: tileTex("#c7cbbf", "#a4a99b", "#7b8072", 1.0) });
  const glass = new THREE.MeshLambertMaterial({ color: 0xa9cbe6, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const frame = lambert(0x4a5260);
  const wallM = lambert(0xece8e0);
  const steel = lambert(0xb8c0c9);

  // Outside: apron and parked planes.
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), lambert(0x7b8086));
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.05;
  root.add(apron);
  for (let x = -60; x <= 120; x += 12) box(root, x, x + 6, -0.04, -0.03, 51, 51.3, lambert(0xf2d34f));
  const p1 = plane3d();
  p1.position.copy(V(18, 3.2, 66));
  p1.rotation.y = 15 * DEG;
  const p2 = plane3d();
  p2.position.copy(V(56, 3.2, 70));
  p2.rotation.y = -100 * DEG;
  root.add(p1, p2);

  // Ground floor.
  slab(root, [[0, 0], [96, 0], [96, 40], [0, 40]], 0, terrazzo, 0.3);

  // Departures (y 6) with the atrium edge, escalator and stairs openings, the lift 1 bridge
  // and a notch where the C pier stairs go down.
  const dep = [[4, 18], [12, 18], [12, 22], [26.4, 22], [26.4, 28.6], [31.5, 28.6], [31.5, 22], [32.8, 22], [32.8, 24],
    [35.2, 24], [35.2, 22], [44, 22], [44, 8], [52, 8], [52, 22], [96, 22], [96, 40], [13, 40], [13, 33.6], [15.1, 33.2],
    [15.1, 31.2], [13, 31.4], [13, 30.5], [4, 30.5]];
  const shaftHole = (id) => {
    const n = node(id);
    return [[n.x - 1.3, n.z - 1.3], [n.x + 1.3, n.z - 1.3], [n.x + 1.3, n.z + 1.3], [n.x - 1.3, n.z + 1.3]];
  };
  // The east stairs come up through the B pier floor (opening from z 22 to their top at z 26).
  const eastHole = [[62.9, 22.01], [65.1, 22.01], [65.1, 26], [62.9, 26]];
  slab(root, dep, 6, upperFloor, 0.45, [shaftHole("lift1U"), shaftHole("lift2U"), eastHole]);
  // Sky Lounge mezzanine (y 9) over the B pier, with the lounge stairs and lift openings.
  const loungeM = new THREE.MeshLambertMaterial({ map: tileTex("#b9a58a", "#9a8669", "#6f5f48", 0.9) });
  slab(root, [[69, 20], [84, 20], [84, 31.5], [69, 31.5]], 9, loungeM, 0.35,
    [[[70.9, 25], [73.1, 25], [73.1, 30.2], [70.9, 30.2]], shaftHole("loungeLiftU")]);
  // C pier (y 5).
  slab(root, [[0, 30.5], [13, 30.5], [13, 40], [0, 40]], 5, pierFloor);
  box(root, 0, 4, 5.55, 6, 18, 30.5, wallM); // closes the gap west of the lift 2 landing

  // Glass balustrades along the mezzanine edges.
  const rail = (ax, az, bx, bz, y) => {
    const a = { x: ax, y: y + 0.55, z: az }, b = { x: bx, y: y + 0.55, z: bz };
    beam(root, a, b, 0.03, 1.1, glass);
    beam(root, { ...a, y: y + 1.12 }, { ...b, y: y + 1.12 }, 0.07, 0.06, frame);
  };
  for (const [ax, az, bx, bz] of [[4, 18, 12, 18], [12, 18, 12, 22], [12, 22, 26.4, 22], [26.4, 22, 26.4, 28.6], [31.5, 28.6, 31.5, 22],
    [31.5, 22, 32.8, 22], [32.8, 22, 32.8, 24], [35.2, 24, 35.2, 22], [35.2, 22, 44, 22], [44, 22, 44, 8], [52, 8, 52, 22],
    [52, 22, 62.9, 22], [65.1, 22, 96, 22], [62.9, 22, 62.9, 25.2], [65.1, 22, 65.1, 25.2],
    [13, 40, 13, 33.6], [13, 31.4, 13, 30.5]]) rail(ax, az, bx, bz, 6);
  // Sky Lounge edges and its stair opening (open on the side you step off, south).
  for (const [ax, az, bx, bz] of [[69, 31.5, 80.7, 31.5], [83.3, 31.5, 84, 31.5], [69, 20, 69, 31.5], [84, 20, 84, 31.5],
    [70.9, 30.2, 73.1, 30.2], [70.9, 25.8, 70.9, 30.2], [73.1, 25.8, 73.1, 30.2]]) rail(ax, az, bx, bz, 9);
  box(root, 69, 84, 9, 12, 19.6, 20, lambert(0xd9cbb6)); // lounge back wall, up to the roof (12 m)
  rail(4, 30.5, 4, 40, 5); // C pier west edge has the wall; this is the pier's inner rail line

  // Outer walls: glass on the airside (north, east), entrance glass (south), solid west.
  const H = 12;
  box(root, -0.2, 0, 0, H, 0, 40, wallM);
  for (const [x0, z0, x1, z1] of [[0, 0, 96, 0], [96, 0, 96, 40], [96, 40, 0, 40]]) {
    beam(root, { x: x0, y: H / 2, z: z0 }, { x: x1, y: H / 2, z: z1 }, 0.05, H, glass);
    const len = Math.hypot(x1 - x0, z1 - z0);
    for (let s = 0; s <= len + 0.01; s += 3) {
      const t = s / len, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      box(root, x - 0.07, x + 0.07, 0, H, z - 0.07, z + 0.07, frame);
    }
    for (const y of [3, 6.4, 9.2, H]) beam(root, { x: x0, y, z: z0 }, { x: x1, y, z: z1 }, 0.12, 0.12, frame);
  }
  // Roof with rows of lights.
  box(root, 0, 96, H, H + 0.3, 0, 40, lambert(0xf6f6f4));
  const lightM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let z = 2; z < 40; z += 4) box(root, 2, 94, H - 0.03, H - 0.01, z, z + 0.35, lightM);
  // Light strips under the mezzanine.
  for (let z = 24; z < 40; z += 3) box(root, 13, 95, 5.52, 5.54, z, z + 0.25, lightM);
  for (let x = 46; x < 52; x += 3) box(root, x, x + 0.25, 5.52, 5.54, 9, 21, lightM);

  // Columns: a grid, kept clear of the walking routes.
  const segs = map.edges.map((e) => [node(e.from), node(e.to)]);
  const clear = (x, z, r) => segs.every(([a, b]) => {
    const dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L));
    return Math.hypot(x - a.x - dx * t, z - a.z - dz * t) > r;
  });
  const inBox = (x, z, list) => list.some(([x0, x1, z0, z1]) => x > x0 - 1 && x < x1 + 1 && z > z0 - 1 && z < z1 + 1);
  for (const x of [6, 18, 24, 36, 42, 54, 60, 70, 80, 90]) for (const z of [6, 14, 26, 34]) {
    if (!clear(x, z, 2.2) || inBox(x, z, SHOPS) || inBox(x, z, FURNITURE)) continue;
    if (x > 26 && x < 38 && z > 15 && z < 30) continue;
    if (x > 60 && x < 68 && z > 14 && z < 28) continue; // east stairs
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, H, 16), lambert(0xf1f1ef));
    c.position.copy(V(x, H / 2, z));
    root.add(c);
  }

  // Escalators: up (escFoot -> escTop) and, beside it, down (escDownTop -> escDownFoot).
  const escTread = new THREE.MeshLambertMaterial({
    map: (() => {
      const t = canvasTex(64, 64, (g, w, h) => {
        g.fillStyle = "#3b3f46";
        g.fillRect(0, 0, w, h);
        g.fillStyle = "#9aa1aa";
        for (let x = 0; x < w; x += 6) g.fillRect(x, 0, 2, h);
        g.fillStyle = "#e3c341";
        g.fillRect(0, 0, w, 5);
      });
      t.repeat.set(1, 30);
      return t;
    })(),
  });
  const escalator = (ef, et) => {
    beam(root, { x: ef.x, y: ef.y - 0.1, z: ef.z }, { x: et.x, y: et.y - 0.1, z: et.z }, 1.15, 0.2, escTread);
    for (const sx of [-0.68, 0.68]) {
      beam(root, { x: ef.x + sx, y: ef.y + 0.5, z: ef.z }, { x: et.x + sx, y: et.y + 0.5, z: et.z }, 0.04, 1.0, glass);
      beam(root, { x: ef.x + sx, y: ef.y + 1.02, z: ef.z }, { x: et.x + sx, y: et.y + 1.02, z: et.z }, 0.1, 0.06, lambert(0x111111));
      beam(root, { x: ef.x + sx, y: ef.y - 0.6, z: ef.z }, { x: et.x + sx, y: et.y - 0.6, z: et.z }, 0.12, 1.0, steel);
    }
    box(root, ef.x - 0.75, ef.x + 0.75, 0, 0.03, ef.z - 1.6, ef.z, steel);
    box(root, et.x - 0.75, et.x + 0.75, 6, 6.03, et.z, et.z + 1.4, steel);
  };
  escalator(node("escFoot"), node("escTop"));
  if (map.nodes.some((n) => n.id === "escDownTop")) escalator(node("escDownFoot"), node("escDownTop"));

  // Stairs (ground -> departures) and the C pier stairs (departures -> pier).
  const stairs = (a, b, width, stone) => {
    const rise = b.y - a.y, n = Math.max(4, Math.round(Math.abs(rise) / 0.17));
    const dx = (b.x - a.x) / n, dz = (b.z - a.z) / n, dy = rise / n;
    const g = new THREE.Group();
    const L = Math.hypot(dx, dz);
    const ang = Math.atan2(b.x - a.x, b.z - a.z);
    for (let i = 0; i < n; i++) {
      const topY = a.y + dy * (i + (rise > 0 ? 1 : 0));
      const bottom = Math.min(a.y, b.y) - 0.3;
      const step = new THREE.Mesh(new THREE.BoxGeometry(width, topY - bottom, L + 0.02), stone);
      const cx = a.x + dx * (i + 0.5), cz = a.z + dz * (i + 0.5);
      step.position.copy(V(cx, (topY + bottom) / 2, cz));
      step.rotation.y = Math.PI - ang;
      g.add(step);
      const nose = new THREE.Mesh(new THREE.BoxGeometry(width, 0.02, 0.06), lambert(0xd8b13a));
      nose.position.copy(V(cx + (dx / L) * (rise > 0 ? -L / 2 : L / 2) * (rise > 0 ? 1 : 1), topY + 0.005, cz + (dz / L) * (rise > 0 ? -L / 2 : L / 2)));
      nose.rotation.y = Math.PI - ang;
      g.add(nose);
    }
    root.add(g);
    const px = Math.cos(ang) * (width / 2 + 0.05), pz = -Math.sin(ang) * (width / 2 + 0.05);
    for (const s of [-1, 1]) {
      beam(root, { x: a.x + px * s, y: a.y + 0.55, z: a.z + pz * s }, { x: b.x + px * s, y: b.y + 0.55, z: b.z + pz * s }, 0.03, 1.1, glass);
      beam(root, { x: a.x + px * s, y: a.y + 1.1, z: a.z + pz * s }, { x: b.x + px * s, y: b.y + 1.1, z: b.z + pz * s }, 0.06, 0.05, frame);
    }
  };
  const stone = lambert(0xcfcac0);
  stairs(node("stairsFoot"), node("stairsTop"), 1.8, stone);
  stairs(node("cTop"), node("cJunction"), 1.8, stone);

  // Glass lifts: shaft over all floors, steel landing doors facing where you come from.
  const lifts = {};
  const doorFace = (liftNode, otherId) => faceOf(liftNode, node(otherId));
  for (const [id, gId, uId, gFrom, uTo] of LIFTS) {
    const g = node(gId), u = node(uId);
    const half = LIFT_HALF;
    const grp = new THREE.Group();
    root.add(grp);
    // corner posts + glass walls
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(grp, g.x + sx * half - 0.06, g.x + sx * half + 0.06, g.y, H, g.z + sz * half - 0.06, g.z + sz * half + 0.06, frame);
    // Glass on every side, with a door-high opening where a landing door is (you go through it).
    const doorAt = { N: [], S: [], E: [], W: [] };
    doorAt[doorFace(g, gFrom)].push(g.y);
    doorAt[doorFace(u, uTo)].push(u.y);
    for (const f of ["N", "S", "E", "W"]) {
      const horiz = f === "N" || f === "S";
      const c = { x: g.x + (f === "E" ? half : f === "W" ? -half : 0), z: g.z + (f === "N" ? half : f === "S" ? -half : 0) };
      const a = horiz ? { x: c.x - half, z: c.z } : { x: c.x, z: c.z - half };
      const b = horiz ? { x: c.x + half, z: c.z } : { x: c.x, z: c.z + half };
      let from = g.y; // the shaft starts at its lowest landing
      for (const lvl of doorAt[f].sort((p, q) => p - q)) {
        if (lvl > from) beam(grp, { ...a, y: (from + lvl) / 2 }, { ...b, y: (from + lvl) / 2 }, 0.03, lvl - from, glass);
        from = lvl + 2.5;
      }
      if (H > from) beam(grp, { ...a, y: (from + H) / 2 }, { ...b, y: (from + H) / 2 }, 0.03, H - from, glass);
    }
    // landing doors (two leaves per landing)
    const doors = [];
    for (const [lvl, face] of [[g.y, doorFace(g, gFrom)], [u.y, doorFace(u, uTo)]]) {
      const horiz = face === "N" || face === "S";
      const out = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] }[face];
      const cx = g.x + out[0] * (half + 0.05), cz = g.z + out[1] * (half + 0.05);
      const leaves = [];
      for (const s of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 0.56 : 0.05, 2.2, horiz ? 0.05 : 0.56), steel);
        m.userData.base = V(cx + (horiz ? s * 0.28 : 0), lvl + 1.1, cz + (horiz ? 0 : s * 0.28));
        m.userData.dir = horiz ? new THREE.Vector3(s, 0, 0) : new THREE.Vector3(0, 0, -s);
        m.position.copy(m.userData.base);
        grp.add(m);
        leaves.push(m);
      }
      const lintel = box(grp, cx - (horiz ? 1.25 : 0.08), cx + (horiz ? 1.25 : 0.08), lvl + 2.2, lvl + 2.5, cz - (horiz ? 0.08 : 1.25), cz + (horiz ? 0.08 : 1.25), frame);
      lintel.userData = {};
      doors.push(leaves);
    }
    // cab: floor + ceiling light that ride with it
    const cab = new THREE.Group();
    const cabFloor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 2.4), lambert(0x3d434c));
    cabFloor.position.y = -0.08;
    const cabTop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 2.4), lambert(0xd5d9de));
    cabTop.position.y = 2.6;
    const cabLight = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    cabLight.rotation.x = Math.PI / 2;
    cabLight.position.y = 2.54;
    const handrail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 2.2), steel);
    handrail.position.set(-1.1, 0.95, 0);
    cab.add(cabFloor, cabTop, cabLight, handrail);
    cab.position.copy(V(g.x, 0, g.z));
    grp.add(cab);
    lifts[id] = { doors, cab, ground: g };
  }

  // Lift 1 out-of-service sign (an AR panel; it turns solid red when pinched).
  const l1 = node("lift1G");
  const oosCanvas = document.createElement("canvas");
  oosCanvas.width = 768;
  oosCanvas.height = 256;
  const oosTex = new THREE.CanvasTexture(oosCanvas);
  oosTex.colorSpace = THREE.SRGBColorSpace;
  const drawOos = (solid) => {
    const g = oosCanvas.getContext("2d");
    g.clearRect(0, 0, 768, 256);
    g.fillStyle = solid ? "rgba(225,40,40,1)" : "rgba(225,40,40,0.55)";
    g.beginPath();
    g.roundRect(8, 8, 752, 240, 48);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.lineWidth = 6;
    g.stroke();
    g.fillStyle = "#fff";
    g.font = '700 64px "Segoe UI", Arial';
    g.textAlign = "center";
    g.fillText("Lift 1 out of service", 384, 112);
    g.font = '500 40px "Segoe UI", Arial';
    g.fillText(solid ? "Reported. Re-routing." : "Pinch to confirm", 384, 186);
    oosTex.needsUpdate = true;
  };
  drawOos(false);
  const oos = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), new THREE.MeshBasicMaterial({ map: oosTex, transparent: true, depthWrite: false }));
  oos.position.copy(V(l1.x - 1.45, 1.75, l1.z));
  oos.rotation.y = -Math.PI / 2;
  oos.renderOrder = 5;
  root.add(oos);

  // Check-in desks with queues.
  for (let x = 38; x <= 54; x += 4) {
    box(root, x, x + 2.6, 0, 1.05, 2.4, 3.3, lambert(0x6d7480));
    box(root, x - 0.1, x + 2.7, 1.05, 1.12, 2.3, 3.4, lambert(0xe9e6df));
    box(root, x + 0.3, x + 0.9, 1.12, 1.5, 2.9, 2.95, lambert(0x222222));
  }
  box(root, 37, 57, 0, 3.2, 0.6, 0.9, lambert(0x24476b));
  signBoard(root, 47, 3.8, 0.95, 180, 8, 1.2, signTex(["Check-in  ·  Bag drop"], { w: 1536, h: 230, bg: "#24476b", fg: "#ffffff", size: 120 }), false);
  for (let x = 39; x <= 53; x += 4) for (const z of [5.2, 6.4]) box(root, x - 0.03, x + 0.03, 0, 1, z - 0.03, z + 0.03, lambert(0x777777));

  // Shops along the west wall (ground) and the north side of departures.
  const shop = (x0, x1, z0, z1, y, name, color, faceHeading) => {
    box(root, x0, x1, y, y + 3.2, z0, z1, lambert(0xf8f5ef));
    const fx = faceHeading === 90 ? x1 + 0.02 : (x0 + x1) / 2;
    const fz = faceHeading === 180 ? z0 - 0.02 : faceHeading === 0 ? z1 + 0.02 : (z0 + z1) / 2;
    const w = faceHeading === 90 ? z1 - z0 : x1 - x0;
    signBoard(root, fx, y + 3.6, fz, faceHeading, w * 0.9, 0.7, signTex([name], { w: 1024, h: 200, bg: color, fg: "#ffffff", size: 120 }), false);
    const glassFront = faceHeading === 90 ? beam(root, { x: x1 + 0.05, y: y + 1.4, z: z0 + 0.3 }, { x: x1 + 0.05, y: y + 1.4, z: z1 - 0.3 }, 0.04, 2.6, glass)
      : faceHeading === 0 ? beam(root, { x: x0 + 0.3, y: y + 1.4, z: z1 + 0.05 }, { x: x1 - 0.3, y: y + 1.4, z: z1 + 0.05 }, 0.04, 2.6, glass)
      : beam(root, { x: x0 + 0.3, y: y + 1.4, z: z0 - 0.05 }, { x: x1 - 0.3, y: y + 1.4, z: z0 - 0.05 }, 0.04, 2.6, glass);
    return glassFront;
  };
  for (const s of SHOPS) shop(...s);
  for (const [x0, x1, z0, z1, y, h, color] of FURNITURE) box(root, x0, x1, y, y + h, z0, z1, lambert(color));
  // B pier gates: seating and gate boards (B12's are below).
  for (const [id, code, dest] of [["gateB14", "B14", "Oslo 09:30"], ["gateB16", "B16", "Vienna 09:45"], ["gateB18", "B18", "Dublin 09:20"]]) {
    const g = node(id);
    chairRow(root, g.x - 3, g.x + 1, 6, 39.2, false);
    signBoard(root, g.x, 9.0, 39.6, 180, 2.4, 1.2, signTex([code, dest], { w: 512, h: 256, size: 120 }), false);
  }
  const b20 = node("gateB20");
  chairRow(root, 94.6, 95.4, 6, 30.5, true);
  signBoard(root, 95.8, 8.8, b20.z, 270, 2.4, 1.2, signTex(["B20", "Prague 10:05"], { w: 512, h: 256, size: 120 }), false);
  signBoard(root, 58, 9.0, 32, 90, 4.4, 0.75, signTex(["Gates B14 – B20  →"], { w: 1536, h: 260, size: 110 }));
  signBoard(root, 72, 8.6, 31.2, 180, 3.2, 0.7, signTex(["↑  Sky Lounge"], { w: 1280, h: 240, bg: "#4a3a26", fg: "#ffe2a8" }), false);
  signBoard(root, 76.5, 11.0, 20.1, 180, 4.0, 0.8, signTex(["Sky Lounge"], { w: 1280, h: 256, bg: "#4a3a26", fg: "#ffe2a8", size: 140 }), false);
  signBoard(root, 64, 3.2, 15, 180, 3.2, 0.7, signTex(["↑  Gates B14 – B20"], { w: 1280, h: 240 }));

  // Gates: desks, seating, gate boards.
  const b12 = node("gateB12"), c3 = node("gateC3");
  box(root, b12.x + 1.5, b12.x + 3.8, 6, 7.05, b12.z + 1.2, b12.z + 2, lambert(0x2f3a4a));
  chairRow(root, 46.5, 51.5, 6, 39.2, false);
  chairRow(root, 46.5, 51.5, 6, 38.0, true);
  chairRow(root, 56.2, 59.2, 6, 30.6, true);
  signBoard(root, b12.x, 9.0, 39.6, 180, 2.4, 1.2, signTex(["B12", "Lisbon 08:40"], { w: 512, h: 256, size: 120 }), false);
  box(root, c3.x + 1.2, c3.x + 3.2, 5, 6.05, c3.z + 0.6, c3.z + 1.3, lambert(0x2f3a4a));
  chairRow(root, 0.8, 3.2, 5, 34.0, true);
  chairRow(root, 0.8, 3.2, 5, 35.2, false);
  signBoard(root, c3.x, 7.8, 39.6, 180, 2.4, 1.2, signTex(["C3", "Madrid 08:55"], { w: 512, h: 256, size: 120 }), false);

  // Wayfinding signs.
  signBoard(root, 30, 3.4, 12.5, 180, 4.4, 0.75, signTex(["↑  Departures  ·  Gates B  C"], { w: 1536, h: 260, size: 110 }));
  signBoard(root, 39, 3.4, 9.2, 270, 3.0, 0.7, signTex(["↑  Lift 1"], { w: 1024, h: 240 }));
  signBoard(root, 20, 3.4, 13.4, 90, 3.0, 0.7, signTex(["↑  Lift 2  ·  Gates C"], { w: 1280, h: 240 }));
  signBoard(root, 30, 9.0, 30.6, 180, 5.0, 0.75, signTex(["←  Gates C            Gates B  →"], { w: 1792, h: 260, size: 110 }));
  signBoard(root, 37.5, 9.0, 32, 270, 3.4, 0.7, signTex(["↑  Gates B10 – B20"], { w: 1280, h: 240 }));
  signBoard(root, 22.5, 9.0, 32, 90, 3.4, 0.7, signTex(["↑  Gates C1 – C8"], { w: 1280, h: 240 }));
  // "You are here" sign at the entrance.
  const sign = node("sign");
  const totem = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.1, 0.12), lambert(0x24476b));
  post.position.y = 1.05;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), new THREE.MeshBasicMaterial({
    map: canvasTex(256, 384, (g, w, h) => {
      g.fillStyle = "#f4f6f9";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#24476b";
      g.fillRect(0, 0, w, 70);
      g.fillStyle = "#fff";
      g.font = '700 34px "Segoe UI", Arial';
      g.textAlign = "center";
      g.fillText("You are here", w / 2, 47);
      g.strokeStyle = "#9aa6b5";
      g.lineWidth = 6;
      g.strokeRect(30, 110, 196, 220);
      g.fillStyle = "#1c7ed6";
      g.fillRect(118, 170, 20, 140);
      g.fillStyle = "#e8590c";
      g.beginPath();
      g.arc(128, 310, 16, 0, Math.PI * 2);
      g.fill();
    }, false),
  }));
  face.position.set(0, 1.35, 0.07);
  totem.add(post, face);
  totem.position.copy(V(sign.x + 2.3, 0, sign.z + 3.2));
  totem.rotation.y = -12 * DEG;
  root.add(totem);
  // Flight information screens.
  for (const [x, y, z, h] of [[24, 8.6, 37.4, 180], [44, 2.4, 12.6, 180]]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshBasicMaterial({ map: fidsTex() }));
    s.position.copy(V(x, y, z));
    s.rotation.y = Math.PI - h * DEG;
    root.add(s);
    box(root, x - 1.25, x + 1.25, y - 0.8, y + 0.8, z + 0.02, z + 0.1, lambert(0x111111));
  }

  // People: standing, queueing, seated, and some walking (kept off the route).
  const people = [];
  const add = (seed, x, y, z, heading, opts = {}, walk = null) => {
    const p = person(seed, opts);
    p.position.copy(V(x, y, z));
    p.rotation.y = Math.PI - heading * DEG;
    root.add(p);
    people.push({ p, walk, y, seed });
  };
  [[40, 5.0], [40.3, 6.0], [44, 5.4], [44.2, 6.6], [48, 5.1], [52, 5.6], [52.2, 6.7], [56, 5.2]].forEach(([x, z], i) => add(i + 1, x, 0, z, 180, { suitcase: i % 2 === 0 }));
  add(11, 4.2, 0, 6.5, 270);
  add(12, 4.6, 0, 12.5, 250, { suitcase: true });
  add(13, 18, 0, 3.5, 90, { suitcase: true }, { a: [10, 3.5], b: [26, 3.0], T: 14 });
  add(14, 55, 0, 16, 0, {}, { a: [56, 14], b: [56, 30], T: 16 });
  add(15, 14, 0, 30, 0, { suitcase: true }, { a: [16, 36], b: [24, 24], T: 13 });
  add(16, 47, 6, 39.2, 180, { seated: true });
  add(17, 49.4, 6, 39.2, 180, { seated: true });
  add(18, 48.2, 6, 38.0, 0, { seated: true });
  add(19, 57.4, 6, 30.6, 0, { seated: true });
  add(20, 1.4, 5, 34.0, 0, { seated: true });
  add(21, 2.6, 5, 35.2, 180, { seated: true });
  add(22, 22, 6, 36.4, 180);
  add(23, 36, 6, 36.6, 160, { suitcase: true });
  add(24, 40, 6, 26, 0, { suitcase: true }, { a: [40, 25], b: [57, 27], T: 15 });
  add(25, 26, 6, 38.2, 0, {}, { a: [20, 36.5], b: [42, 36.8], T: 22 });
  add(26, 58, 6, 34, 270);
  add(27, 8, 0, 36, 90, { suitcase: true }, { a: [3, 36], b: [22, 34], T: 17 });

  // Per-frame updates: walkers, lift cabs and doors, the out-of-service sign.
  let lastSolid = false;
  return {
    root,
    update(t, frame) {
      for (const { p, walk, y } of people) {
        if (!walk) continue;
        const u = (t / walk.T) % 2, f = u < 1 ? u : 2 - u;
        const s = f * f * (3 - 2 * f);
        const x = walk.a[0] + (walk.b[0] - walk.a[0]) * s, z = walk.a[1] + (walk.b[1] - walk.a[1]) * s;
        p.position.copy(V(x, y, z));
        const dir = u < 1 ? 1 : -1;
        p.rotation.y = Math.PI - Math.atan2((walk.b[0] - walk.a[0]) * dir, (walk.b[1] - walk.a[1]) * dir);
        const swing = Math.sin(t * 7 + p.id) * 0.45 * Math.min(1, 4 * f * (1 - f) + 0.2);
        p.userData.legs[0].rotation.x = swing;
        p.userData.legs[1].rotation.x = -swing;
      }
      for (const [id, L] of Object.entries(lifts)) {
        const st = frame.lifts[id];
        L.cab.position.y = st.cab;
        L.doors.forEach((leaves, k) => leaves.forEach((m) => m.position.copy(m.userData.base.clone().add(m.userData.dir.clone().multiplyScalar(0.55 * st.door[k])))));
      }
      const show = frame.mode === "Step-Free";
      oos.visible = show;
      const solid = !!frame.closed.lift1;
      if (solid !== lastSolid) {
        drawOos(solid);
        lastSolid = solid;
      }
    },
    oosPosition: oos.position,
    oosAt: () => oos.position,
  };
}
