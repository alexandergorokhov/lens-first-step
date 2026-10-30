// Demo-video scenarios for the hospital and the campus: the same route engine and Builder as the
// airport video, a stand-in building made from each map (place-layout.mjs), and situations the
// airport video doesn't show: going back down the stairs after a room change, two lifts out
// (no step-free route: the line leads to the assistance desk), wandering off the line and being
// re-routed, a ramp instead of a lift, and the rover companion outdoors.
import { readFileSync } from "node:fs";
import { Navigator, findNode, noticeFor, parseMap } from "../../src/core/router.ts";
import { arrivalText, nodeLabel } from "../../src/core/place.ts";
import { PetGuide, companionOf, treatsResult } from "../../src/core/pet.ts";
import { PointingCoach } from "../../src/core/places.ts";
import { Builder, FPS, ease, hdist, headingOf, loadAirport } from "./timeline.mjs";
import { placeLayout } from "./place-layout.mjs";

export function loadMap(file) {
  const r = parseMap(readFileSync(new URL("../../src/core/data/" + file, import.meta.url), "utf8"));
  if (!r.ok) throw new Error(file + ": " + r.error);
  return r.map;
}

const near = (b, id, m) => () => {
  const n = findNode(b.nav.map, id);
  return hdist(b.feet, n) <= m && Math.abs(b.feet.y - n.y) < 1;
};

// Fade in at the start sign, pick the mode (and interests), scan the sign, start the route.
function start(b, { title, mode, seated, to, interests = null }) {
  const S = b.state;
  const sign = findNode(b.map, (b.map.place && b.map.place.start) || "sign");
  const next = b.map.edges.find((e) => e.from === sign.id || e.to === sign.id);
  const nb = findNode(b.map, next.from === sign.id ? next.to : next.from);
  const h = headingOf(sign, nb);
  b.feet = { x: sign.x - Math.sin((h * Math.PI) / 180) * 1.2, y: sign.y, z: sign.z - Math.cos((h * Math.PI) / 180) * 1.2 };
  b.yaw = h;
  b.pitch = -6;
  b.seated = seated;
  b.showLine = false;
  b.nav = null;
  S.arrival = null;
  S.badge = null;
  S.mode = null;
  S.caption = title;
  S.fade = 1;
  b.hold(1.0, (k, n) => (S.fade = 1 - ease((k + 1) / n)));
  b.hold(1.2);
  S.panel = { type: "mode", pressed: null };
  b.hold(1.1);
  S.panel = { type: "mode", pressed: mode === "Walk" ? "walk" : "stepFree" };
  b.hold(0.7);
  S.mode = mode;
  if (interests) {
    S.panel = { type: "interests", picked: [] };
    b.hold(0.9);
    S.panel = { type: "interests", picked: interests };
    b.hold(0.8);
  }
  S.panel = { type: "scan", pressed: false };
  b.hold(1.1);
  S.panel = { type: "scan", pressed: true };
  b.hold(0.5);
  S.panel = null;
  b.nav = new Navigator(b.map, sign.id, to, mode === "Walk" ? "walk" : "stepFree");
  b.nav.updatePosition(b.feet);
  b.noteDestination();
  S.badge = "online map";
  b.showLine = true;
  b.hold(0.6, (k, n) => (b.pitch = -6 - (seated ? 4 : 8) * ease((k + 1) / n)));
}

// Look at the red sign of an out-of-service event, pinch it, close the connection.
function pinchOut(b, eventId) {
  const S = b.state;
  const ev = b.map.place.events.find((e) => e.id === eventId);
  b.turnTo(headingOf(b.feet, findNode(b.map, ev.at)), 0.8);
  b.hold(0.3);
  S.pinch = { event: ev.id, phase: 0 };
  b.hold(1.0, (k, n) => (S.pinch.phase = (k + 1) / n));
  S.pinch = null;
  b.closed[ev.edge] = true;
  b.card(ev.card, "block", 3.5);
  b.nav.setEdgeOpen(ev.edge, false);
  b.hold(1.4);
}

function arrive(b, text, sec = 3.4) {
  const S = b.state;
  S.arrival = text;
  b.showLine = false;
  b.hold(sec);
  b.hold(0.9, (k, n) => (S.fade = ease((k + 1) / n)));
  S.arrival = null;
}

function finish(b, title, lines) {
  const S = b.state;
  S.caption = "";
  S.badge = null;
  S.mode = null;
  S.app = null;
  b.guide = null;
  b.nav = null;
  S.end = { title, lines };
  b.hold(4.0);
}

export function buildHospitalTimeline(map = loadMap("hospital.json")) {
  const b = new Builder(map);
  const S = b.state;
  // Run 1: walking to Ward 4 up the stairs; a room change sends you back down to X-ray.
  start(b, { title: "Hospital: a visitor walks to Ward 4", mode: "Walk", seated: false, to: "ward4" });
  S.caption = "The line goes to the stairs: quicker than the lift on foot";
  b.follow({ stop: near(b, "corridor1", 3) });
  const ev = map.place.events.find((e) => e.type === "destinationChanged");
  S.caption = "Room change on the way: X-ray is on the ground floor";
  b.card(ev.card, "flight", 3.5);
  b.nav.setDestination(ev.to);
  b.noteDestination(3.5);
  b.hold(1.6);
  S.caption = "The line turns round and takes the stairs back down";
  b.follow();
  S.caption = "Arrived";
  arrive(b, arrivalText(map, ev.to));

  // Run 2: in a wheelchair: Lift A out, re-routed to Lift B; Lift B out too: ask staff.
  start(b, { title: "Same hospital, in a wheelchair: Ward 4", mode: "Step-Free", seated: true, to: "ward4" });
  S.caption = "Step-Free: the line goes to Lift A, never the stairs";
  b.follow({ stop: near(b, "liftAG", 4.2) });
  S.caption = "Lift A is out: pinch the red sign";
  pinchOut(b, "liftAOut");
  S.caption = "Re-routed to Lift B";
  b.follow({ stop: near(b, "liftBG", 4.2) });
  S.caption = "Lift B is out too";
  pinchOut(b, "liftBOut");
  const notice = noticeFor(b.nav.route);
  b.card(notice, "block", 4.5);
  S.caption = "No step-free way up: the line leads to Reception";
  b.hold(1.6);
  b.follow();
  const help = b.nav.route.nodes[0];
  S.caption = "Staff take it from here";
  arrive(b, nodeLabel(map, help) + ": staff will help you up");
  finish(b, "Find Your Way Inside: Hospital", ["Same Lens, the hospital's own map.", "Room changes re-route you, down the stairs too.", "No step-free way? It takes you to someone who can help."]);
  return { fps: FPS, frames: b.frames, map, scene: "place", layout: placeLayout(map) };
}

export function buildCampusTimeline(map = loadMap("campus.json")) {
  const b = new Builder(map);
  const S = b.state;
  const c = companionOf("rover");
  // Run 1: walking across the quad with the rover; wander off and get re-routed; room change.
  start(b, { title: "Campus: a student walks to Lecture Hall 1", mode: "Walk", seated: false, to: "lectureHall1", interests: ["coffee"] });
  b.travelled = 0;
  b.guide = new PetGuide();
  b.guide.companion = c;
  b.coach = new PointingCoach(map);
  b.coach.interests = ["coffee"];
  b.onPoint = (p) => (S.caption = p.label + ": you picked coffee");
  S.app = { pet: false, pressing: false };
  S.caption = "Turn on the rover";
  b.hold(0.4);
  b.togglePet(true);
  S.caption = "Outdoors across the quad, the rover leads";
  b.follow({ stop: near(b, "quad", 0.6) });
  S.caption = "Off to the info desk? You leave the line...";
  const desk = findNode(map, "infoDesk");
  b.rerouted = b.walkTo({ x: desk.x - 1, y: 0, z: desk.z + 3.5 }) === "rerouted";
  S.caption = "...and the line re-routes from where you are";
  b.hold(1.4);
  b.follow({ stop: near(b, "sciFirst", 2.5) });
  const ev = map.place.events.find((e) => e.type === "destinationChanged");
  S.caption = "Room change: Lab 2 is downstairs";
  b.card(ev.card, "flight", 3.5);
  b.nav.setDestination(ev.to);
  b.noteDestination(3.5);
  b.hold(1.6);
  S.caption = "Back down the stairs, the rover rides ahead";
  b.follow();
  S.caption = treatsResult(b.guide.found, b.guide.total, c);
  arrive(b, arrivalText(map, ev.to));
  b.guide = null;
  b.coach = null;
  S.app = null;

  // Run 2: in a wheelchair: the science lift is out, so the ramp.
  start(b, { title: "Same campus, in a wheelchair: Lecture Hall 1", mode: "Step-Free", seated: true, to: "lectureHall1" });
  S.caption = "Step-Free: the science building's lift";
  b.follow({ stop: near(b, "sciLiftG", 4.2) });
  S.caption = "The lift is out: pinch the red sign";
  pinchOut(b, "sciLiftOut");
  S.caption = "Re-routed up the ramp";
  b.follow();
  S.caption = "Arrived";
  arrive(b, arrivalText(map, "lectureHall1"));
  finish(b, "Find Your Way Inside: Campus", ["Indoors and outdoors, between buildings.", "Wander off and the line re-routes from where you are.", "A lift out? The ramp, never the stairs."]);
  return { fps: FPS, frames: b.frames, map, scene: "place", layout: placeLayout(map), offRouteRerouted: b.rerouted };
}

// The bigger airport, no gate change: walking to the Sky Lounge (the east stairs, the B pier with
// its shops, the lounge stairs), then on to Gate B18; in a wheelchair the same by lifts, then B20.
export function buildAirportTripTimeline(map = loadAirport()) {
  const b = new Builder(map);
  const S = b.state;
  b.showPlaces = true;
  start(b, { title: "Airport, a longer trip: the Sky Lounge first", mode: "Walk", seated: false, to: "skyLounge" });
  S.caption = "Far gates: the line takes the east stairs";
  b.follow({ captions: { eastStairsTop: "The B pier: shops and gates on both sides", loungeStairsFoot: "Up the lounge stairs to the Sky Lounge" } });
  S.caption = "Arrived";
  S.arrival = arrivalText(map, "skyLounge");
  b.showLine = false;
  b.hold(3.0);
  S.arrival = null;
  b.card("Boarding soon: Gate B18", "flight", 3.5);
  b.nav.setDestination("gateB18");
  b.noteDestination(3.5);
  b.showLine = true;
  S.caption = "Time to board: down the lounge stairs, on to Gate B18";
  b.hold(1.4);
  b.follow();
  S.caption = "Arrived";
  arrive(b, arrivalText(map, "gateB18"));

  start(b, { title: "Same trip in a wheelchair", mode: "Step-Free", seated: true, to: "skyLounge" });
  S.caption = "Step-Free: Lift 1 up, then along the B pier";
  b.follow({ captions: { bPier1: "Shops and lounges along the pier", loungeLiftG: "The lounge lift: never the stairs" } });
  S.caption = "Arrived";
  S.arrival = arrivalText(map, "skyLounge");
  b.showLine = false;
  b.hold(2.6);
  S.arrival = null;
  b.card("Boarding soon: Gate B20", "flight", 3.5);
  b.nav.setDestination("gateB20");
  b.noteDestination(3.5);
  b.showLine = true;
  S.caption = "Down by lift and on to Gate B20, at the far end";
  b.hold(1.2);
  b.follow();
  S.caption = "Arrived";
  arrive(b, arrivalText(map, "gateB20"));
  finish(b, "Find Your Way Inside: a longer airport trip", ["Three ways up: escalator, two staircases; lifts for Step-Free.", "Shops, cafés and lounges along the B pier.", "Plain Dijkstra over the map graph; Step-Free removes stairs and escalators."]);
  return { fps: FPS, frames: b.frames, map, scene: "airport" };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  for (const t of [buildHospitalTimeline(), buildCampusTimeline()]) console.log(t.map.place.title, (t.frames.length / FPS).toFixed(1) + " s");
}
