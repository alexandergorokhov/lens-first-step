// The all-features concept clip, on the mall: a three-stop trip with the companion, Hop and catch
// while you wait, a model swap, peek ahead, then Learn this place. Everything that happens comes
// from src/core (stop order, routes, HopGame, CatchGame, peekModel, MapRecorder, tripAfterSaving).
import { Navigator, findNode, parseMap, routePoints } from "../../src/core/router.ts";
import { arrivalText, nodeLabel, placeOf } from "../../src/core/place.ts";
import { PetGuide, companionOf, treatsResult } from "../../src/core/pet.ts";
import { PointingCoach } from "../../src/core/places.ts";
import { CatchGame, HopGame, PlayGate, STILL_SECONDS, hopText, landingSpot, seededRandom } from "../../src/core/play.ts";
import { MultiStopTrip, orderStops } from "../../src/core/trip.ts";
import { peekModel } from "../../src/core/peek.ts";
import { MapRecorder, tripAfterSaving } from "../../src/core/mapping.ts";
import { Builder, DT, FPS, ease, hdist, headingOf } from "./timeline.mjs";
import { placeLayout } from "./place-layout.mjs";
import { arrive, finish, loadMap, start } from "./scenarios.mjs";

// The Lens's numbers (FindYourWayMain.ts).
const HOP_AHEAD_M = 1.3;
const THROW_FROM_M = 1.2;
const THROW_SPEED = 6;
const STOPS = ["pharmacy", "iceCream", "sushi"];

const press = (b, label, sec = 0.5) => {
  const S = b.state;
  S.app = { ...S.app, buttons: (S.app.buttons || []).map((x) => ({ ...x, on: x.label === label })) };
  b.hold(sec);
  S.app = { ...S.app, buttons: S.app.buttons.map((x) => ({ ...x, on: false })) };
};
const buttons = (...labels) => labels.map((label) => ({ label, on: false }));

// A stop's arrival: the card, then Next stop leads on.
function nextStop(b, stops, name) {
  const S = b.state;
  S.app = { ...S.app, buttons: buttons("Next stop") };
  b.hold(0.5);
  press(b, "Next stop");
  S.app = { ...S.app, buttons: [] };
  stops.next();
  S.arrival = null;
  S.stopLabel = stops.label(name);
  b.nav.setDestination(stops.current());
  b.noteDestination(3.5);
  b.showLine = true;
  b.hold(1.0);
}

// Hop: the real game, with a scripted player: four jumps, one miss (bump), a raised hand, two more.
function playHop(b, c) {
  const S = b.state;
  const g = b.guide;
  const hop = new HopGame(seededRandom(7));
  const r = (b.yaw * Math.PI) / 180;
  const origin = { x: b.feet.x + Math.sin(r) * HOP_AHEAD_M, y: b.feet.y, z: b.feet.z + Math.cos(r) * HOP_AHEAD_M };
  const heading = b.yaw;
  const frame = (hand) => {
    S.hand = hand;
    const shake = hop.shaking ? Math.sin(b.frames.length * 1.7) * 0.05 : 0;
    const side = { x: Math.cos(r) * shake, z: -Math.sin(r) * shake };
    b.petOverride = { pos: { x: origin.x + side.x, y: origin.y + hop.petY, z: origin.z + side.z }, heading, mood: "lead" };
    S.hop = { origin: [origin.x, origin.y, origin.z], heading, y: +hop.petY.toFixed(3), text: hopText(hop, c),
      obstacles: hop.obstacles.map((o) => [+o.d.toFixed(3), o.h, o.w]) };
    b.emit();
  };
  const playUntil = (score, jumping) => {
    for (let guard = 0; guard < 40 * FPS; guard++) {
      if (hop.score >= score || hop.phase === "crashed") return;
      const near = hop.obstacles.find((o) => !o.passed && o.d > 0);
      const jumpNow = jumping && near && near.d < hop.speed * 0.3 && hop.jump();
      hop.update(DT);
      frame(!!jumpNow || (S.hand && hop.petY > 0.2));
    }
    throw new Error("hop: no progress");
  };
  S.app = { ...S.app, buttons: buttons("Stop playing", "Jump (or raise a hand)") };
  hop.start();
  S.caption = "Raise a hand and it jumps";
  playUntil(4, true);
  S.caption = "Miss one and it bumps";
  playUntil(99, false);
  for (let k = 0; k < 1.5 * FPS; k++) { hop.update(DT); frame(false); }
  S.caption = "Raise a hand to play again";
  hop.jump();
  frame(true);
  playUntil(2, true);
  press(b, "Stop playing", 0.4);
  S.hop = null;
  S.hand = false;
  b.petOverride = null;
  g.pet = { pos: { ...origin }, heading, mood: "lead" };
}

// Catch: the button throw from the Lens (straight ahead); the companion fetches and comes back.
function playCatch(b) {
  const S = b.state;
  const g = b.guide;
  const r = (b.yaw * Math.PI) / 180;
  const v = { x: Math.sin(r) * THROW_SPEED * 0.7, y: THROW_SPEED * 0.7, z: Math.cos(r) * THROW_SPEED * 0.7 };
  const hand = { x: b.feet.x, y: b.feet.y + THROW_FROM_M, z: b.feet.z };
  const spot = landingSpot(hand, v, b.feet.y);
  const game = new CatchGame();
  const air = 0.9;
  press(b, "Throw a treat", 0.4);
  game.throwTo(spot, g.pet.pos);
  let t = 0;
  let heading = b.yaw;
  while (game.phase !== "idle") {
    const before = { ...game.pos };
    const u = game.update(DT, b.feet);
    t += DT;
    const dx = u.pos.x - before.x, dz = u.pos.z - before.z;
    if (dx * dx + dz * dz > 1e-8) heading = (Math.atan2(dx, dz) * 180) / Math.PI;
    b.petOverride = { pos: u.pos, heading, mood: u.caught ? "point" : "lead" };
    const k = Math.min(1, t / air);
    S.thrown = u.phase === "fetch" ? [hand.x + (spot.x - hand.x) * k, hand.y + (spot.y - hand.y) * k + Math.sin(k * Math.PI) * 1.1, hand.z + (spot.z - hand.z) * k] : null;
    if (u.caught) S.caption = "Caught! It brings it back";
    b.emit();
  }
  S.thrown = null;
  g.pet = { pos: b.petOverride.pos, heading, mood: "lead" };
  b.petOverride = null;
  b.hold(0.8);
}

// Peek ahead: pinch and pull shows a small model of the route with a dot for you; letting go hides it.
function peek(b) {
  const S = b.state;
  const route = routePoints(b.nav.map, b.nav.route);
  const m = peekModel(route, b.feet);
  const model = { route: m.route.map((p) => [p.x, p.y, p.z]), you: [m.you.x, m.you.y, m.you.z], done: m.done };
  b.hold(0.5, (k, n) => (S.peek = { ...model, k: ease((k + 1) / n) }));
  b.hold(3.2);
  b.hold(0.4, (k, n) => (S.peek = { ...model, k: 1 - ease((k + 1) / n) }));
  S.peek = null;
}

// Learn this place: walk the way to the Bakery, pinching Point here at each corner; the walk IS
// the map, and Save and route guides you back to the sign on it.
function learnThisPlace(b, map) {
  const S = b.state;
  const sign = findNode(map, "sign");
  const route = new Navigator(map, "sign", "bakery", "walk").route;
  const pts = routePoints(map, route);
  const r0 = pts.slice(1);
  S.caption = "Who makes the map? You do: Learn this place";
  b.feet = { x: sign.x, y: sign.y, z: sign.z };
  b.yaw = headingOf(pts[0], pts[1]);
  b.pitch = -8;
  b.showLine = false;
  b.nav = null;
  S.badge = null;
  S.stopLabel = null;
  S.mode = "Walk";
  S.fade = 1;
  b.hold(0.9, (k, n) => (S.fade = 1 - ease((k + 1) / n)));
  const rec = new MapRecorder("My place");
  rec.start(b.feet);
  const mapping = (status, pressed = null) => {
    const m = rec.toMap();
    S.mapping = { status, pressed, points: m.nodes.map((n) => [n.x, n.y, n.z, n.label || ""]), edges: m.edges.map((e) => {
      const a = m.nodes.find((n) => n.id === e.from), c = m.nodes.find((n) => n.id === e.to);
      return [a.x, a.y, a.z, c.x, c.y, c.z];
    }) };
  };
  mapping("You are at the entrance sign");
  b.hold(1.0);
  const walk = (to) => {
    const from = { ...b.feet };
    b.turnTo(headingOf(from, to), 0.5);
    const len = hdist(from, to);
    const speed = 3.2;
    for (let along = 0; along < len; ) {
      along = Math.min(len, along + speed * DT);
      const t = along / len;
      b.feet = { x: from.x + (to.x - from.x) * t, y: from.y, z: from.z + (to.z - from.z) * t };
      b.stride += (speed * DT) / 0.75;
      rec.walked(b.feet);
      b.emit();
    }
  };
  S.caption = "Walk, and pinch Point here at each corner";
  for (const p of r0) {
    walk(p);
    rec.pointHere(b.feet);
    mapping("Point " + (rec.toMap().nodes.length - 1) + " added", "Point here");
    b.hold(0.5);
    mapping("Walk to the next corner");
  }
  mapping("Tag the last stretch", "Step-free");
  rec.tagLast("stepFree");
  S.caption = "One pinch tags a stretch: step-free";
  b.hold(1.0);
  const name = rec.name("Shop");
  mapping("Named: " + name, "Name it");
  S.caption = "Another names the place";
  b.hold(1.1);
  mapping("Saved on the device", "Save and route");
  S.caption = "Save: the walk is now a map";
  b.hold(1.0);
  mapping("Saved on the device");
  const parsed = parseMap(rec.toJson());
  if (!parsed.ok) throw new Error(parsed.error);
  const trip = tripAfterSaving(rec.toMap(), b.feet);
  b.map = parsed.map;
  b.place = placeOf(parsed.map);
  b.nav = new Navigator(parsed.map, trip.start, trip.destination, "walk");
  b.nav.updatePosition(b.feet);
  b.showLine = true;
  S.caption = "And it routes on it at once, back to the sign";
  b.turnTo(headingOf(b.feet, findNode(parsed.map, b.nav.route.nodes[1])), 0.9);
  const length = b.nav.route.length;
  const from = { ...b.feet };
  b.follow({ stop: () => hdist(b.feet, from) > 10 });
  return { destination: trip.destination, length };
}

export function buildAllFeaturesTimeline(map = loadMap("mall.json")) {
  const b = new Builder(map);
  const S = b.state;
  b.pace = 1.6; // the walking is a time-lapse: the clip must stay under 3 minutes
  const name = (id) => nodeLabel(map, id);
  const dist = (x, y) => {
    const r = new Navigator(map, x, y, "walk").route;
    return r.status === "route" ? r.length : Infinity;
  };
  const stops = new MultiStopTrip(orderStops("sign", STOPS, dist));
  const dog = companionOf("dog");
  const rover = companionOf("robot");

  start(b, { title: "Everything together: a trip to the mall", mode: "Walk", seated: false, to: stops.current(), interests: ["coffee"] });
  S.stopLabel = stops.label(name);
  b.travelled = 0;
  b.guide = new PetGuide();
  b.guide.companion = dog;
  b.coach = new PointingCoach(map);
  b.coach.interests = ["coffee"];
  b.onPoint = (p) => (S.caption = p.sponsored ? "Sponsored places are always tagged. The route never changes" : p.label + ": you picked coffee");
  S.app = { pet: false, pressing: false, buttons: [] };
  S.caption = "Three shops, ordered for the shortest walk";
  b.hold(1.6);
  b.togglePet(true);

  S.caption = "The dog leads, the line stays";
  b.follow();
  S.caption = "First stop";
  S.arrival = stops.label(name);
  b.showLine = false;
  b.hold(1.8);
  nextStop(b, stops, name);

  // Captions from the route itself: Walk takes whichever way up is shortest.
  const up = b.nav.route.edges.find((e) => e.kind === "lift" || e.kind === "escalator" || e.kind === "stairs");
  S.caption = "Next, upstairs: the dog waits for you at the " + up.kind;
  b.follow({ captions: { [up.to]: "First floor: the badge changes, on to the ice cream" } });
  S.caption = "Second stop";
  S.arrival = stops.label(name);
  b.showLine = false;
  b.hold(1.8);
  nextStop(b, stops, name);

  // Waiting for the ice cream: stand still and play.
  const heading = headingOf(b.feet, findNode(map, b.nav.route.nodes[1]));
  b.turnTo(heading, 0.7);
  const before = b.nav.route.nodes.join(">");
  S.caption = "Waiting for your ice cream? Stand still and play";
  b.hold(0.7, (k, n) => (b.pitch = -14 - 12 * ease((k + 1) / n)));
  b.showLine = false; // the games have the floor; the line comes back after
  const gate = new PlayGate();
  b.hold(STILL_SECONDS + 0.3, () => gate.update(b.feet, DT, { companionOn: b.guide.on, cardShowing: false }));
  if (!gate.canPlay) throw new Error("play not offered");
  S.app = { ...S.app, buttons: buttons("Play while you wait", "Throw a treat") };
  b.hold(0.5);
  press(b, "Play while you wait");
  playHop(b, dog);

  S.caption = "Any model, the same game: dog to robot";
  S.app = { ...S.app, buttons: buttons("Swap model", "Throw a treat") };
  b.hold(0.4);
  press(b, "Swap model");
  b.guide.companion = rover;
  b.hold(0.6);
  S.caption = "Throw a star: it fetches and brings it back";
  playCatch(b);
  const routeDuringPlay = { before, after: b.nav.route.nodes.join(">") };
  S.app = { ...S.app, buttons: [] };
  b.showLine = true;

  S.caption = "Pinch and pull: peek at the way ahead";
  peek(b);
  S.caption = "On to the last stop";
  b.follow();
  S.caption = treatsResult(b.guide.found, b.guide.total, rover);
  arrive(b, stops.label(name) + ". " + arrivalText(map, stops.current()));
  b.guide = null;
  b.coach = null;
  S.app = null;

  const mappedTrip = learnThisPlace(b, map);
  S.mapping = null;
  b.hold(0.9, (k, n) => (S.fade = ease((k + 1) / n)));
  finish(b, "Find Your Way Inside", ["Multi-stop trips, a companion, games while you wait.", "Peek at the way ahead. Map a place by walking it.", "Concept render: all of this is built in the Lens and passes its tests."]);
  return { fps: FPS, frames: b.frames, map, scene: "place", layout: placeLayout(map), shopSigns: true, routeDuringPlay, mappedTrip };
}
