// Builds the demo video's frame-by-frame timeline from the real route engine (src/core/router.ts):
// the traveller's path, every re-route (gate change, lift out) and the arrival come from the same
// Navigator the Lens runs. The browser page (index.html) only draws what each frame says.
// Map metres: x east, y up, z north. Headings: degrees clockwise from north.
import { readFileSync } from "node:fs";
import { Navigator, findNode, lineAhead, routePoints, parseMap, tripAhead } from "../../src/core/router.ts";
import { lineOnLevel } from "../../src/core/geometry.ts";
import { destinationFloorText, floorCueFor, levelName, nodeLabel, placeOf, tripPill } from "../../src/core/place.ts";
import { PetGuide, companionOf, guideVisuals, treatsResult, treatsText } from "../../src/core/pet.ts";
import { PointingCoach, placeTag, placesOf, visiblePlaces } from "../../src/core/places.ts";
import { DEMO_BEATS } from "../../src/core/demo.ts";

export const FPS = 30;
export const DT = 1 / FPS;
export const STAND_EYE = 1.65;
export const SEAT_EYE = STAND_EYE - 0.45; // the Lens's seated offset
const LINE_AHEAD = 12;

const caption = (id) => DEMO_BEATS.find((b) => b.id === id)?.caption ?? id;
export const hdist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const headingOf = (a, b) => (Math.atan2(b.x - a.x, b.z - a.z) * 180) / Math.PI;
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
export const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export function loadAirport() {
  const r = parseMap(readFileSync(new URL("../../src/core/data/map.json", import.meta.url), "utf8"));
  if (!r.ok) throw new Error(r.error);
  return r.map;
}

export class Builder {
  constructor(map) {
    this.map = map;
    this.place = placeOf(map);
    this.frames = [];
    this.feet = { x: 0, y: 0, z: 0 };
    this.yaw = 0;
    this.pitch = -14;
    this.seated = false;
    this.nav = null;
    this.state = { caption: "", badge: null, panel: null, card: null, arrival: null, fade: 0, mode: null, end: null, note: null };
    this.closed = {};
    // Every lift in the map: cab height and its two landing doors (0 shut .. 1 open).
    this.lifts = {};
    for (const e of map.edges) {
      if (e.kind !== "lift") continue;
      const lo = Math.min(findNode(map, e.from).y, findNode(map, e.to).y);
      this.lifts[e.id] = { cab: lo, door: [0, 0] };
    }
    this.wheel = 0;
    this.stride = 0;
    this.showLine = false;
    this.inLift = null;
    this.guide = null; // PetGuide when the pet feature is in use
    this.routeKey = "";
    this.treatAt = []; // time each treat was collected (pop animation)
  }

  eye() {
    if (this.inLift) return this.lifts[this.inLift].cab + (this.seated ? SEAT_EYE : STAND_EYE);
    return this.feet.y + (this.seated ? SEAT_EYE : STAND_EYE);
  }

  // What the traveller follows: the route, or with no way through ("ask staff") the line to the
  // assistance point. Null when there is nothing to follow.
  path() {
    const r = this.nav && this.nav.route;
    if (!r) return null;
    if (r.status === "route") return { nodes: r.nodes, edges: r.edges, pts: routePoints(this.nav.map, r) };
    if (r.status === "askStaff" && r.assistance) {
      const a = r.assistance;
      return { nodes: a.nodes, edges: a.edges, pts: a.nodes.map((id) => { const n = findNode(this.nav.map, id); return { x: n.x, y: n.y, z: n.z }; }) };
    }
    return null;
  }

  // The line on the traveller's floor (as the Lens draws it; at 50% with or without the
  // companion) and the up/down marker where it changes floor.
  line() {
    const path = this.path();
    if (!this.showLine || !path) return { line: null, marker: null };
    if (!guideVisuals(!!(this.guide && this.guide.on)).showLine) return { line: null, marker: null };
    const t = tripAhead(this.nav.map, this.nav.route, this.feet);
    const { line, marker } = lineOnLevel(lineAhead(path.pts, this.feet, LINE_AHEAD), t ? t.floorY : this.feet.y);
    return {
      line: line.length > 1 ? line.map((p) => [p.x, p.y, p.z]) : null,
      marker: marker ? { at: [marker.at.x, marker.at.y, marker.at.z], up: marker.up } : null,
    };
  }

  // Distance pill with the floor badge, and the cue before the next floor change (or a short
  // note on which floor the destination is, right after it is set). Rules from src/core.
  trip() {
    const r = this.nav && this.nav.route;
    const t = r ? tripAhead(this.nav.map, r, this.feet) : null;
    const text = tripPill(nodeLabel(this.map, this.nav ? this.nav.to : ""), t);
    if (!text) return { pill: null, cue: null };
    const pill = { floor: levelName(this.place, t.floorY), text };
    const now = this.frames.length * DT;
    const cue = this.state.note && now < this.state.note.until ? this.state.note.text : floorCueFor(this.place, this.map, t);
    return { pill, cue };
  }

  // Steps the companion (when on), collects treats and lets it point out places; returns what
  // the frame shows of it, of the place icons and of the app panel.
  petFrame() {
    const g = this.guide;
    const app = this.state.app ? { ...this.state.app } : null;
    if (!g || !this.nav) {
      // No companion: place icons can still show along the way (showPlaces).
      const r = this.nav && this.nav.route;
      const icons = this.showPlaces && r && r.status === "route"
        ? visiblePlaces(this.map, routePoints(this.nav.map, r), this.feet, { profile: r.profile, muted: false }) : [];
      return { pet: null, treats: null, score: null, app, places: icons.map((p) => ({ id: p.id, at: [p.x, p.y, p.z], category: p.category, label: placeTag(p), sponsored: p.sponsored, bright: false })) };
    }
    const now = this.frames.length * DT;
    const r = this.nav.route;
    const arrived = r.status === "arrived";
    const route = routePoints(this.nav.map, r);
    const feet = this.inLift ? { ...this.feet, y: this.lifts[this.inLift].cab } : this.feet;
    if (this.lastFeet) this.travelled += Math.hypot(feet.x - this.lastFeet.x, feet.y - this.lastFeet.y, feet.z - this.lastFeet.z);
    this.lastFeet = { ...feet };
    // Pointing: only with the companion on and a route to follow; it never touches the route.
    if (g.on && !arrived && this.coach) {
      const p = this.coach.check(route, feet, now, this.travelled, !!this.state.card);
      if (p) {
        g.point(p, now);
        this.pointed = { id: p.id, until: now + 3, caption: this.state.caption };
        if (this.onPoint) this.onPoint(p);
      }
    }
    // After the point, the caption goes back to what it was.
    if (this.pointed && this.pointed.caption !== undefined && now >= this.pointed.until + 1) {
      this.state.caption = this.pointed.caption;
      this.pointed.caption = undefined;
    }
    for (const i of g.update(route, feet, DT, r.nodes.join(">"), arrived, now)) this.treatAt[i] = now;
    if (this.treatAt.length !== g.spots.length) this.treatAt = g.spots.map((_, i) => this.treatAt[i] ?? null);
    const c = g.companion;
    const bright = this.pointed && now < this.pointed.until ? this.pointed.id : null;
    const icons = r.status === "route" ? visiblePlaces(this.map, route, feet, { profile: r.profile, muted: !!this.state.muted }) : [];
    if (bright && !icons.some((p) => p.id === bright)) {
      const p = placesOf(this.map).find((x) => x.id === bright);
      if (p) icons.push(p);
    }
    return {
      companion: c.model,
      pet: g.on && g.pet ? { pos: [g.pet.pos.x, g.pet.pos.y, g.pet.pos.z], heading: +g.pet.heading.toFixed(2), mood: g.pet.mood, point: bright ? (() => { const p = placesOf(this.map).find((x) => x.id === bright); return [p.x, p.y, p.z]; })() : null } : null,
      treats: g.on ? g.spots.map((p, i) => ({ at: [p.x, p.y, p.z], got: g.got[i], age: g.got[i] && this.treatAt[i] != null ? +(now - this.treatAt[i]).toFixed(3) : null })) : null,
      score: g.on || g.found > 0 ? { text: treatsText(g.found, g.total, c), pop: this.treatAt.some((t) => t != null && now - t < 0.6) } : null,
      app: app ? { ...app, label: c.name } : null,
      places: icons.map((p) => ({ id: p.id, at: [p.x, p.y, p.z], category: p.category, label: placeTag(p), sponsored: p.sponsored, bright: p.id === bright })),
    };
  }

  // Pinch the companion's toggle on the app panel: a short press, then it turns on or off.
  togglePet(on) {
    this.state.app = { ...this.state.app, pet: !on, pressing: true };
    this.hold(0.5);
    const r = routePoints(this.nav.map, this.nav.route);
    this.guide.setOn(on, r, this.feet, this.nav.route.nodes.join(">"));
    this.state.app = { ...this.state.app, pet: on, pressing: false };
    this.hold(0.6);
  }

  // "Gate C3 is on C pier, 1 floor down" for `sec` seconds, where the floor cue shows.
  noteDestination(sec = 3.5) {
    const t = tripAhead(this.nav.map, this.nav.route, this.feet);
    if (!t) return;
    const to = findNode(this.map, this.nav.to);
    this.state.note = { text: destinationFloorText(nodeLabel(this.map, this.nav.to), levelName(this.place, to.y), t.floors), until: this.frames.length * DT + sec };
  }

  emit() {
    const s = this.state;
    const bob = this.seated || this.inLift ? 0 : Math.sin(this.stride * Math.PI) * 0.025;
    const { line, marker } = this.line();
    const { pill, cue } = this.trip();
    const pet = this.petFrame();
    this.frames.push({
      cam: [this.feet.x, this.eye() + bob, this.feet.z, +this.yaw.toFixed(3), +this.pitch.toFixed(3)],
      feet: [this.feet.x, this.inLift ? this.lifts[this.inLift].cab : this.feet.y, this.feet.z],
      stride: +this.stride.toFixed(3),
      seated: this.seated,
      line,
      marker,
      ...pet,
      pill,
      cue,
      caption: s.caption,
      badge: s.badge,
      mode: s.mode,
      panel: s.panel ? { ...s.panel } : null,
      card: s.card ? { ...s.card, age: +(this.frames.length * DT - s.card.at).toFixed(3) } : null,
      arrival: s.arrival,
      fade: +s.fade.toFixed(3),
      end: s.end,
      closed: { ...this.closed },
      lifts: JSON.parse(JSON.stringify(this.lifts)),
      wheel: +this.wheel.toFixed(3),
      pinch: s.pinch ? { ...s.pinch } : null,
    });
    if (s.card && this.frames.length * DT - s.card.at > s.card.hold) s.card = null;
  }

  // Hold still for `sec`, calling `each(k, n)` per frame (for fades, presses, turning in place).
  hold(sec, each) {
    const n = Math.round(sec * FPS);
    for (let k = 0; k < n; k++) {
      if (each) each(k, n);
      this.emit();
    }
  }

  card(text, icon, hold = 4) {
    this.state.card = { text, icon, at: this.frames.length * DT, hold };
  }

  turnTo(heading, sec = 1) {
    const from = this.yaw;
    const diff = wrap(heading - from);
    this.hold(sec, (k, n) => (this.yaw = from + diff * ease((k + 1) / n)));
  }

  // Walks (or rolls) along the live route until `stop()` is true or the route ends. Lifts on the
  // way are ridden; escalators carry you; `captions` maps node ids to beat ids shown on reaching
  // them. Returns the Navigator's last progress.
  follow({ stop = () => false, captions = {}, onNode = {} } = {}) {
    let progress = "onRoute";
    for (let guard = 0; guard < 20000; guard++) {
      const r = this.path();
      if (!r) return progress;
      // Next node along the route ahead of us.
      const pts = r.pts;
      const ahead = lineAhead(pts, this.feet, 1e9);
      const target = ahead.find((p) => d3(p, this.feet) > 1e-3);
      if (!target) return progress;
      const idx = pts.findIndex((p) => d3(p, target) < 1e-6);
      const nodeId = idx >= 0 ? r.nodes[idx] : null;
      const edge = idx > 0 ? r.edges[idx - 1] : null;
      const kind = edge ? edge.kind : "walk";

      if (kind === "lift") {
        this.rideLift(edge, r.nodes[idx - 1], nodeId);
        progress = this.nav.updatePosition(this.feet);
        continue;
      }

      const segStart = { ...this.feet };
      const segLen = d3(segStart, target);
      let along = 0;
      while (along < segLen) {
        const base = kind === "escalator" ? 1.3 : kind === "stairs" ? 0.75 : kind === "ramp" ? 0.9 : this.seated ? 1.25 : 1.4;
        // Long straights speed up after the first few metres (the Lens demo does the same).
        const fast = kind === "walk" && segLen > 8 ? 1 + 2.0 * ease((along - 4) / 4) * ease((segLen - along - 3) / 3) : 1;
        along = Math.min(segLen, along + base * fast * DT);
        const t = along / segLen;
        this.feet = {
          x: segStart.x + (target.x - segStart.x) * t,
          y: segStart.y + (target.y - segStart.y) * t,
          z: segStart.z + (target.z - segStart.z) * t,
        };
        if (kind !== "escalator") this.stride += (base * fast * DT) / 0.75;
        this.wheel += base * fast * DT;
        this.steer();
        progress = this.nav.updatePosition(this.feet);
        this.emit();
        if (progress !== "onRoute" || stop()) break;
      }
      if (progress === "arrived" || stop()) return progress;
      if (progress === "rerouted") continue;
      if (nodeId && captions[nodeId]) this.state.caption = caption(captions[nodeId]);
      if (nodeId && onNode[nodeId]) onNode[nodeId]();
      if (nodeId === this.nav.to) return progress;
    }
    throw new Error("follow: no progress");
  }

  // Walks straight to a point off the line (the traveller wanders off), letting the Navigator
  // notice and re-route. Returns the last progress.
  walkTo(target, speed = 1.3) {
    const start = { ...this.feet };
    const len = hdist(start, target);
    let progress = "onRoute";
    for (let along = 0; along < len; ) {
      along = Math.min(len, along + speed * DT);
      const t = along / len;
      this.feet = { x: start.x + (target.x - start.x) * t, y: start.y, z: start.z + (target.z - start.z) * t };
      this.stride += (speed * DT) / 0.75;
      this.wheel += speed * DT;
      const diff = wrap(headingOf(this.feet, target) - this.yaw);
      this.yaw += Math.max(-75 * DT, Math.min(75 * DT, diff * 0.15));
      const p = this.nav.updatePosition(this.feet);
      if (p !== "onRoute") progress = p;
      this.emit();
    }
    return progress;
  }

  // Turn smoothly toward a point ~3 m ahead on the line, like a person looking where they go.
  steer() {
    const path = this.path();
    if (!path) return;
    const look = lineAhead(path.pts, this.feet, 3.2);
    const end = look[look.length - 1];
    if (!end || hdist(end, this.feet) < 0.4) return;
    let want = headingOf(this.feet, end);
    // While the companion points at a place, glance toward it (at most 50 degrees off the way).
    const now = this.frames.length * DT;
    if (this.pointed && now < this.pointed.until) {
      const p = findNode(this.map, this.pointed.id);
      want += Math.max(-50, Math.min(50, wrap(headingOf(this.feet, p) - want)));
    }
    const diff = wrap(want - this.yaw);
    const step = Math.max(-75 * DT, Math.min(75 * DT, diff * 0.12));
    this.yaw += step;
    // Look a little further down on slopes going down, up on the way up.
    const slope = Math.max(-0.6, Math.min(0.6, (end.y - this.feet.y) / Math.max(1.5, hdist(end, this.feet))));
    const wantPitch = (this.seated ? -10 : -14) + slope * 18;
    this.pitch += (wantPitch - this.pitch) * 0.08;
  }

  rideLift(edge, fromId, toId) {
    const id = edge.id;
    const from = findNode(this.map, fromId), to = findNode(this.map, toId);
    const lift = this.lifts[id];
    const up = to.y > from.y;
    const fromDoor = up ? 0 : 1, toDoor = up ? 1 : 0;
    if (id === "lift2") this.state.caption = caption("lift2-ride");
    this.showLine = false;
    this.hold(0.9, (k, n) => (lift.door[fromDoor] = ease((k + 1) / n)));
    // Move into the cab.
    const start = { ...this.feet };
    this.hold(1.4, (k, n) => {
      const t = ease((k + 1) / n);
      this.feet = { x: start.x + (from.x - start.x) * t, y: from.y, z: start.z + (from.z - start.z) * t };
      if (!this.seated) this.stride += 0.04;
      this.wheel += 0.03;
    });
    this.inLift = id;
    lift.cab = from.y;
    // Turn to face the door you will leave by.
    const out = this.exitHeading(toId);
    this.turnTo(out, 1.2);
    this.hold(0.8, (k, n) => (lift.door[fromDoor] = 1 - ease((k + 1) / n)));
    this.hold(3.2, (k, n) => (lift.cab = from.y + (to.y - from.y) * ease((k + 1) / n)));
    this.inLift = null;
    this.feet = { x: to.x, y: to.y, z: to.z };
    lift.cab = to.y;
    this.inLift = id;
    this.hold(0.9, (k, n) => (lift.door[toDoor] = ease((k + 1) / n)));
    this.inLift = null;
    this.showLine = true;
    if (id === "lift2") this.state.caption = caption("arrive-b12");
  }

  exitHeading(nodeId) {
    const r = this.nav.route;
    const i = r.nodes.indexOf(nodeId);
    const next = findNode(this.map, r.nodes[Math.min(i + 1, r.nodes.length - 1)]);
    const n = findNode(this.map, nodeId);
    return headingOf(n, next);
  }
}

export function buildTimeline(map = loadAirport()) {
  const b = new Builder(map);
  const S = b.state;
  const sign = findNode(map, "sign");
  const near = (id, m) => () => hdist(b.feet, findNode(b.nav.map, id)) <= m && Math.abs(b.feet.y - findNode(b.nav.map, id).y) < 1;

  // ── Run 1: Walk, with the gate change ────────────────────────────────────
  b.feet = { x: sign.x, y: 0, z: sign.z - 1.2 };
  b.yaw = 0;
  b.pitch = -6;
  S.fade = 1;
  S.caption = caption("intro");
  b.hold(1.2, (k, n) => (S.fade = 1 - ease((k + 1) / n)));
  b.hold(1.6);
  S.caption = caption("walk-choose");
  S.panel = { type: "mode", pressed: null };
  b.hold(1.4);
  S.panel = { type: "mode", pressed: "walk" };
  b.hold(0.9);
  S.mode = "Walk";
  S.panel = { type: "scan", pressed: false };
  S.caption = caption("walk-scan");
  b.hold(1.6);
  S.panel = { type: "scan", pressed: true };
  b.hold(0.6);
  S.panel = null;
  b.nav = new Navigator(map, "sign", "gateB12", "walk");
  b.nav.updatePosition(b.feet);
  b.noteDestination();
  S.badge = "online map";
  b.showLine = true;
  b.hold(0.6, (k, n) => (b.pitch = -6 - 10 * ease((k + 1) / n)));
  b.hold(1.0);
  S.caption = caption("walk-follow");
  b.follow({
    stop: near("bJunction", 9.5),
    captions: { escFoot: "walk-escalator", escTop: "walk-concourse" },
  });
  // Gate change B12 -> C3 while walking the concourse.
  const ev = map.place.events.find((e) => e.id === "gateChange");
  S.caption = caption("gate-change");
  b.hold(0.5);
  b.card(ev.card, "flight", 4.5);
  b.nav.setDestination(ev.to);
  b.noteDestination(4);
  b.hold(1.8);
  S.caption = caption("walk-to-pier");
  b.follow({ captions: { cTop: "stairs-down" } });
  S.caption = caption("arrive-c3");
  S.arrival = findNode(map, "gateC3").arrivalCard;
  b.showLine = false;
  b.hold(3.6);
  b.hold(1.0, (k, n) => (S.fade = ease((k + 1) / n)));

  // ── Run 2: Step-Free, seated (wheelchair), Lift 1 out ───────────────────
  S.arrival = null;
  S.badge = null;
  S.mode = null;
  b.showLine = false;
  b.nav = null;
  b.seated = true;
  b.feet = { x: sign.x, y: 0, z: sign.z - 1.2 };
  b.yaw = 0;
  b.pitch = -4;
  S.caption = caption("restart");
  b.hold(1.0);
  b.hold(1.2, (k, n) => (S.fade = 1 - ease((k + 1) / n)));
  S.caption = caption("stepfree-choose");
  S.panel = { type: "mode", pressed: null };
  b.hold(1.3);
  S.panel = { type: "mode", pressed: "stepFree" };
  b.hold(0.9);
  S.mode = "Step-Free";
  S.caption = caption("stepfree-scan");
  S.panel = { type: "scan", pressed: false };
  b.hold(1.4);
  S.panel = { type: "scan", pressed: true };
  b.hold(0.6);
  S.panel = null;
  b.nav = new Navigator(map, "sign", "gateB12", "stepFree");
  b.nav.updatePosition(b.feet);
  b.noteDestination();
  S.badge = "online map";
  b.showLine = true;
  b.hold(0.6, (k, n) => (b.pitch = -4 - 6 * ease((k + 1) / n)));
  b.hold(0.8);
  S.caption = caption("to-lift1");
  b.follow({ stop: near("lift1G", 4.2) });
  // Lift 1 is out: look at the red sign, pinch it, re-route.
  const out = map.place.events.find((e) => e.id === "lift1Out");
  const lift1 = findNode(map, "lift1G");
  S.caption = caption("lift1-out");
  b.turnTo(headingOf(b.feet, lift1), 0.8);
  b.hold(0.4);
  S.pinch = { event: out.id, phase: 0 };
  b.hold(1.0, (k, n) => (S.pinch.phase = (k + 1) / n));
  S.pinch = null;
  b.closed[out.edge] = true;
  b.card(out.card, "block", 4.5);
  b.nav.setEdgeOpen(out.edge, false);
  b.hold(1.6);
  S.caption = caption("to-lift2");
  b.follow();
  S.caption = caption("arrive-b12");
  S.arrival = findNode(map, "gateB12").arrivalCard;
  b.showLine = false;
  b.hold(3.8);
  S.arrival = null;
  b.hold(1.0, (k, n) => (S.fade = ease((k + 1) / n)));
  S.caption = "";
  S.badge = null;
  S.mode = null;
  S.end = { title: "Find Your Way Inside", lines: ["Walk or Step-Free, chosen once.", "Re-routes on the fly: gate changes, lifts out of service.", "Any building from one JSON map."] };
  b.hold(4.5);

  return { fps: FPS, frames: b.frames, map, scene: "airport" };
}

// The companion clip: Walk to B12 with the companion (a dog by default; --companion robot|rover
// just swaps the model and words) turned on from the app panel with the line staying at 50%;
// "coffee" picked as an interest; it points out a sponsored place and the café without ever
// changing the route; waits at the escalator; turned off and on (score kept); treats at the gate.
export function buildPetTimeline(map = loadAirport(), companionId = "dog") {
  const b = new Builder(map);
  const S = b.state;
  const c = companionOf(companionId);
  const it = c.name.toLowerCase();
  const sign = findNode(map, "sign");
  b.feet = { x: sign.x, y: 0, z: sign.z - 1.2 };
  b.yaw = 0;
  b.pitch = -6;
  b.travelled = 0;
  S.fade = 1;
  S.caption = "New feature: a companion that walks with you";
  b.hold(1.2, (k, n) => (S.fade = 1 - ease((k + 1) / n)));
  b.hold(0.8);
  // Interests on the mode panel: pick coffee.
  S.caption = "Pick what you care about";
  S.panel = { type: "interests", picked: [] };
  b.hold(1.3);
  S.panel = { type: "interests", picked: ["coffee"] };
  b.hold(1.0);
  S.panel = null;
  S.mode = "Walk";
  b.nav = new Navigator(map, "sign", "gateB12", "walk");
  b.nav.updatePosition(b.feet);
  b.guide = new PetGuide();
  b.guide.companion = c;
  b.coach = new PointingCoach(map);
  b.coach.interests = ["coffee"];
  b.onPoint = (p) => {
    S.caption = p.sponsored ? "Shops can pay to be pointed out. The route never changes" : p.label + ": you picked " + p.category;
  };
  S.badge = "online map";
  b.showLine = true;
  S.app = { pet: false, pressing: false };
  b.hold(0.6, (k, n) => (b.pitch = -6 - 10 * ease((k + 1) / n)));
  S.caption = "The usual blue line";
  b.hold(1.2);
  S.caption = "Pinch \"" + c.name + "\" on the app panel";
  b.hold(0.5);
  b.togglePet(true);
  S.caption = "The " + it + " leads; the line stays at 50%";
  b.hold(1.0);
  b.follow({ stop: () => hdist(b.feet, findNode(map, "escFoot")) < 2.3 });
  S.caption = "It waits at the escalator for you";
  b.hold(2.2, (k, n) => (b.pitch = -14 - 8 * Math.sin((Math.PI * (k + 1)) / n)));
  S.caption = "...then rides up just ahead";
  b.follow({ stop: () => b.feet.y >= 6 - 1e-6 && hdist(b.feet, findNode(map, "concourse")) < 2.5 });
  S.caption = c.name + " off: just the line. Your " + c.collectible.many + " stay";
  b.togglePet(false);
  b.hold(2.0);
  S.caption = c.name + " on again";
  b.togglePet(true);
  b.hold(0.6);
  S.caption = "Follow the " + it + " to Gate B12";
  b.follow();
  const g = b.guide;
  b.hold(0.2);
  S.caption = treatsResult(g.found, g.total, c);
  S.arrival = findNode(map, "gateB12").arrivalCard;
  b.hold(4.0);
  S.arrival = null;
  b.hold(1.0, (k, n) => (S.fade = ease((k + 1) / n)));
  S.caption = "";
  S.badge = null;
  S.mode = null;
  S.app = null;
  S.end = { title: "Walk with a " + it, lines: ["A feature you turn on or off at any time; the line stays at 50%.", "Points out what you care about. Sponsored places say so.", "It never changes your route."] };
  b.hold(3.5);
  return { fps: FPS, frames: b.frames, map, scene: "airport" };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const t = buildTimeline();
  console.log(`${t.frames.length} frames, ${(t.frames.length / FPS).toFixed(1)} s`);
}
