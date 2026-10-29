// The companion and its collectibles for the demo video. The companion is any model: a dog, a
// robot or a rover (frame.companion, from src/core/pet.ts's COMPANIONS), all driven by the same
// frame data: it trots, sits at floor changes, looks back, points at places and hops on
// arrival. Light and slightly see-through, since the display only adds light. Collectibles
// (bones, bolts, stars) float and pop when collected.
import * as THREE from "three";
import { V } from "./airport.js";

const DEG = Math.PI / 180;
const mesh = (geo, mat, x, y, z) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
};
const glow = (color, emissive, k = 0.35, opacity = 0.94) =>
  new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: k, roughness: 0.5, transparent: opacity < 1, opacity });

// Each model faces +Z in its own frame and returns animate(pose) with
// pose = { mood, trot, phase, t, point } (point: yaw to the place, radians, or null).
function dog() {
  const skin = glow(0xf3f7ff, 0x6aa8ff);
  const dark = glow(0x2b3a55, 0x1a2a44, 0.3, 1);
  const ear = glow(0xffc94d, 0xffb020, 0.35, 1);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const torso = mesh(new THREE.SphereGeometry(0.17, 24, 16), skin, 0, 0.36, 0);
  torso.scale.set(1, 0.9, 1.65);
  body.add(torso);
  const head = new THREE.Group();
  head.position.set(0, 0.55, 0.27);
  head.add(mesh(new THREE.SphereGeometry(0.12, 24, 16), skin, 0, 0, 0));
  const snout = mesh(new THREE.SphereGeometry(0.065, 16, 12), skin, 0, -0.03, 0.11);
  snout.scale.set(1, 0.8, 1.2);
  head.add(snout, mesh(new THREE.SphereGeometry(0.022, 10, 8), dark, 0, -0.01, 0.185));
  for (const s of [-1, 1]) {
    head.add(mesh(new THREE.SphereGeometry(0.02, 10, 8), dark, 0.05 * s, 0.035, 0.095));
    const e = mesh(new THREE.ConeGeometry(0.045, 0.11, 12), ear, 0.075 * s, 0.11, -0.01);
    e.rotation.z = -0.35 * s;
    head.add(e);
  }
  body.add(head);
  const tail = new THREE.Group();
  tail.position.set(0, 0.42, -0.26);
  tail.add(mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.2, 8), ear, 0, 0.09, 0));
  tail.rotation.x = -0.7;
  body.add(tail);
  const legs = [];
  for (const [x, z] of [[-0.08, 0.15], [0.08, 0.15], [-0.08, -0.15], [0.08, -0.15]]) {
    const leg = new THREE.Group();
    leg.position.set(x, 0.3, z);
    leg.add(mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.28, 8), skin, 0, -0.14, 0));
    leg.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), skin, 0, -0.28, 0.01));
    body.add(leg);
    legs.push(leg);
  }
  function animate({ mood, trot, phase, t }) {
    legs.forEach((leg, i) => (leg.rotation.x = trot ? Math.sin(phase * Math.PI + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.6 : 0));
    const sit = mood === "sit" || mood === "wait";
    body.rotation.x = sit ? -0.45 : 0;
    body.position.y = sit ? -0.08 : mood === "arrived" ? Math.abs(Math.sin(t * 6)) * 0.18 : trot ? Math.abs(Math.sin(phase * Math.PI)) * 0.03 : 0;
    if (sit) legs[2].rotation.x = legs[3].rotation.x = 1.1;
    // Pointing: a raised front paw, nose up, a small hop.
    if (mood === "point") {
      legs[1].rotation.x = -1.2;
      head.rotation.x = -0.25;
      body.position.y = Math.max(0, Math.sin(t * 5)) * 0.06;
    } else head.rotation.x = 0;
    tail.rotation.z = Math.sin(t * (mood === "arrived" || mood === "sit" || mood === "point" ? 18 : 9)) * 0.6;
    head.rotation.y = mood === "wait" ? Math.sin(t * 2) * 0.25 : 0;
  }
  return { root, animate };
}

function robot() {
  const shell = glow(0xf4f7fb, 0x7fb3ff, 0.3);
  const visor = glow(0x13233d, 0x0b1a33, 0.2, 1);
  const eye = new THREE.MeshBasicMaterial({ color: 0x7fe3ff });
  const accent = glow(0xffc94d, 0xffb020, 0.45, 1);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  // Hover base, torso, head with a visor and two eyes, antenna, two arms.
  const base = mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 24), shell, 0, 0.12, 0);
  const torso = mesh(new THREE.BoxGeometry(0.3, 0.3, 0.22), shell, 0, 0.34, 0);
  torso.geometry.translate(0, 0, 0);
  const head = new THREE.Group();
  head.position.set(0, 0.6, 0);
  head.add(mesh(new THREE.BoxGeometry(0.26, 0.18, 0.2), shell, 0, 0, 0));
  head.add(mesh(new THREE.BoxGeometry(0.22, 0.09, 0.02), visor, 0, 0, 0.105));
  const eyes = [mesh(new THREE.SphereGeometry(0.022, 10, 8), eye, -0.05, 0, 0.118), mesh(new THREE.SphereGeometry(0.022, 10, 8), eye, 0.05, 0, 0.118)];
  head.add(...eyes);
  const antenna = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), shell, 0, 0.15, 0);
  const tip = mesh(new THREE.SphereGeometry(0.028, 10, 8), accent, 0, 0.22, 0);
  head.add(antenna, tip);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(0.19 * s, 0.44, 0);
    arm.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8), shell, 0, -0.11, 0));
    arm.add(mesh(new THREE.SphereGeometry(0.038, 10, 8), accent, 0, -0.23, 0));
    body.add(arm);
    arms.push(arm);
  }
  const thruster = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.5, depthWrite: false }));
  thruster.rotation.x = -Math.PI / 2;
  thruster.position.y = 0.07;
  body.add(base, torso, head, thruster);
  function animate({ mood, trot, phase, t }) {
    body.position.y = 0.04 + Math.sin(t * 3) * 0.02 + (mood === "arrived" ? Math.abs(Math.sin(t * 6)) * 0.15 : 0) - (mood === "sit" || mood === "wait" ? 0.04 : 0);
    body.rotation.x = trot ? 0.12 : 0;
    arms[0].rotation.x = arms[1].rotation.x = trot ? Math.sin(phase * Math.PI) * 0.4 : 0;
    arms[1].rotation.x = trot ? -arms[0].rotation.x : arms[1].rotation.x;
    // Pointing: right arm straight out toward the place, eyes bright.
    if (mood === "point") {
      arms[1].rotation.x = -1.5;
      arms[0].rotation.x = 0;
    }
    if (mood === "arrived") arms[0].rotation.z = arms[1].rotation.z = 0;
    head.rotation.y = mood === "wait" ? Math.sin(t * 2) * 0.35 : 0;
    tip.material.emissiveIntensity = 0.4 + 0.4 * Math.max(0, Math.sin(t * 6));
    eyes.forEach((e) => e.scale.setScalar(mood === "point" ? 1.4 : 1));
  }
  return { root, animate };
}

function rover() {
  const shell = glow(0xf4f7fb, 0x7fb3ff, 0.3);
  const tyre = glow(0x2b3a55, 0x1a2a44, 0.25, 1);
  const accent = glow(0xffc94d, 0xffb020, 0.45, 1);
  const lens = new THREE.MeshBasicMaterial({ color: 0x7fe3ff });
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  // Six wheels, a chassis, a solar deck and a mast with a camera head.
  body.add(mesh(new THREE.BoxGeometry(0.34, 0.1, 0.5), shell, 0, 0.2, 0));
  body.add(mesh(new THREE.BoxGeometry(0.4, 0.02, 0.44), accent, 0, 0.26, -0.02));
  const wheels = [];
  for (const s of [-1, 1]) for (const z of [-0.2, 0, 0.2]) {
    const w = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16), tyre, 0.21 * s, 0.08, z);
    w.rotation.z = Math.PI / 2;
    body.add(w);
    wheels.push(w);
  }
  const mast = new THREE.Group();
  mast.position.set(0, 0.26, 0.16);
  mast.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 8), shell, 0, 0.15, 0));
  const cam = new THREE.Group();
  cam.position.set(0, 0.32, 0);
  cam.add(mesh(new THREE.BoxGeometry(0.16, 0.08, 0.08), shell, 0, 0, 0));
  for (const s of [-1, 1]) cam.add(mesh(new THREE.CircleGeometry(0.022, 14), lens, 0.04 * s, 0, 0.041));
  mast.add(cam);
  body.add(mast);
  let roll = 0;
  function animate({ mood, trot, phase, t }) {
    roll = phase * Math.PI * 0.9;
    wheels.forEach((w) => (w.rotation.x = roll));
    body.position.y = mood === "arrived" ? Math.abs(Math.sin(t * 5)) * 0.08 : trot ? Math.sin(phase * 7) * 0.006 : 0;
    // Pointing: the camera head tilts toward the place and nods.
    cam.rotation.x = mood === "point" ? -0.25 + Math.sin(t * 6) * 0.1 : 0;
    cam.rotation.y = mood === "wait" ? Math.sin(t * 2) * 0.5 : 0;
    mast.scale.y = mood === "sit" ? 0.8 : 1;
  }
  return { root, animate };
}

const MODELS = { dog, robot, rover };

// Collectibles: a bone for the dog, a bolt (hex nut) for the robot, a star for the rover.
function collectible(model, mat) {
  const g = new THREE.Group();
  if (model === "robot") {
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 6), mat);
    nut.rotation.x = Math.PI / 2;
    g.add(nut);
  } else if (model === "rover") {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.05 : 0.12, a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false }), mat));
  } else {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 10), mat);
    shaft.rotation.z = Math.PI / 2;
    g.add(shaft);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.045, 12, 10), mat, 0.11 * sx, 0.03 * sy, 0));
  }
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.24, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }));
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = -0.55;
  g.add(halo);
  g.userData.halo = halo;
  return g;
}

export function buildPet(scene) {
  const root = new THREE.Group();
  const models = {};
  for (const id of Object.keys(MODELS)) {
    models[id] = MODELS[id]();
    root.add(models[id].root);
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.36, 40),
    new THREE.MeshBasicMaterial({ color: 0x6aa8ff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  root.add(ring);
  scene.add(root);

  const goldM = new THREE.MeshStandardMaterial({ color: 0xffd34d, emissive: 0xffa800, emissiveIntensity: 0.7 });
  const popCache = new Map();
  const popM = (a) => {
    const k = Math.round(a * 10);
    if (!popCache.has(k)) popCache.set(k, new THREE.MeshStandardMaterial({ color: 0xffd34d, emissive: 0xffa800, emissiveIntensity: 0.9, transparent: true, opacity: k / 10 }));
    return popCache.get(k);
  };
  let treats = [];
  let treatModel = null;

  let last = null;
  let phase = 0;
  function update(f, t) {
    const model = f.companion || "dog";
    root.visible = !!f.pet;
    for (const id of Object.keys(models)) models[id].root.visible = id === model;
    if (f.pet) {
      const [x, y, z] = f.pet.pos;
      const p = V(x, y, z);
      const speed = last ? p.distanceTo(last) * 30 : 0;
      last = p.clone();
      phase += Math.min(speed, 3) / 30 / 0.22;
      root.position.copy(p);
      // Heading is clockwise from north; V maps north to -Z, and the models face +Z.
      root.rotation.y = Math.PI - f.pet.heading * DEG;
      models[model].animate({ mood: f.pet.mood, trot: f.pet.mood === "lead" && speed > 0.2, phase, t });
    } else last = null;

    const list = f.treats || [];
    if (treatModel !== model) {
      for (const b of treats) scene.remove(b);
      treats = [];
      treatModel = model;
    }
    while (treats.length < list.length) {
      const b = collectible(model, goldM);
      scene.add(b);
      treats.push(b);
    }
    treats.forEach((b, i) => {
      const tr = list[i];
      b.visible = !!tr && (!tr.got || (tr.age != null && tr.age < 0.6));
      if (!b.visible) return;
      const [x, y, z] = tr.at;
      const pop = tr.got ? tr.age / 0.6 : 0;
      b.position.copy(V(x, y + 0.6 + Math.sin(t * 2.2 + i) * 0.05 + pop * 0.6, z));
      b.rotation.y = t * 1.8 + i;
      b.scale.setScalar(1 + pop * 0.8);
      b.traverse((o) => { if (o.isMesh && o !== b.userData.halo) o.material = tr.got ? popM(1 - pop) : goldM; });
      b.userData.halo.visible = !tr.got;
    });
  }
  return { root, update };
}
