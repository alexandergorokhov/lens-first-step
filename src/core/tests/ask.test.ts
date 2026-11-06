// "Ask in your own words": a sentence becomes stops in order. The words pick the places (plain code
// here, an LLM on Specs); the router orders and routes them, so Step-Free and the rest still hold.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Navigator, parseMap } from "../router.ts";
import type { MapData, Profile } from "../router.ts";
import { askNeeds, planAsk, askPrompt, parseAskReply, sayItPhrase } from "../freewalk.ts";

function load(file: string): MapData {
  const r = parseMap(readFileSync(new URL("../data/" + file, import.meta.url), "utf8"));
  if (!r.ok) throw new Error(file);
  return r.map;
}
const dist = (m: MapData, profile: Profile) => (a: string, b: string) => {
  const r = new Navigator(m, a, b, profile).route;
  return r.status === "route" ? r.length : r.status === "arrived" ? 0 : Infinity;
};
const label = (m: MapData, id: string) => (m.nodes.filter((n) => n.id === id)[0] as any).label;

test("AK1 the needs in a sentence: coffee, a bathroom, and the flight last", () => {
  assert.deepEqual(askNeeds("I need coffee and a bathroom before my flight"), { needs: ["coffee", "toilet"], flight: true });
  assert.deepEqual(askNeeds("somewhere to eat, then the pharmacy"), { needs: ["food", "pharmacy"], flight: false });
  assert.deepEqual(askNeeds("Take me to gate 12C"), { needs: [], flight: true });
});

test("AK2 airport, wheelchair: coffee, the accessible toilet, then Gate C12, in the order of the shortest step-free trip", () => {
  const m = load("map.json");
  const p = planAsk(m, "I need coffee and a bathroom before my flight at gate 12C", "sign", true, dist(m, "stepFree"));
  assert.equal(p.length, 3, JSON.stringify(p));
  assert.equal(p[2], "gateC12", "the flight is last");
  const cats = p.slice(0, 2).map((id) => (m.nodes.filter((n) => n.id === id)[0] as any).category).sort();
  assert.deepEqual(cats, ["accessibleToilet", "coffee"]);
  // Every leg is step-free.
  let at = "sign";
  for (const id of p) {
    const r = new Navigator(m, at, id, "stepFree").route;
    assert.equal(r.status, "route", at + " -> " + id);
    if (r.status === "route") assert.ok(r.edges.every((e) => e.kind !== "stairs" && e.kind !== "escalator"));
    at = id;
  }
});

test("AK3 airport, walking: the plain toilets; 'my flight' with no gate said goes to the trip's own gate", () => {
  const m = load("map.json");
  const p = planAsk(m, "coffee and a toilet before my flight", "sign", false, dist(m, "walk"));
  assert.equal(p[p.length - 1], "gateB12");
  assert.ok(p.indexOf("toiletsD") >= 0, p.join(","));
});

test("AK4 the cheapest of each kind on the way wins: the chosen café makes the shortest whole trip", () => {
  const m = load("map.json");
  const d = dist(m, "walk");
  const p = planAsk(m, "a coffee before my flight at gate B12", "sign", false, d);
  const total = (ids: string[]) => { let s = 0, at = "sign"; for (const id of ids) { s += d(at, id); at = id; } return s; };
  for (const c of ["cafeG", "cafeD", "cafeB"]) assert.ok(total(p) <= total([c, "gateB12"]) + 1e-6, c);
});

test("AK5 the mall: a coffee then clothes, both on the ground floor first; one plain name still works", () => {
  const m = load("mall.json");
  const p = planAsk(m, "I'd like a coffee and then some new clothes", "sign", false, dist(m, "walk"));
  assert.equal(p.length, 2, p.join(","));
  assert.deepEqual(p.map((id) => (m.nodes.filter((n) => n.id === id)[0] as any).category).sort(), ["clothes", "coffee"]);
  assert.deepEqual(planAsk(m, "take me to the food court", "sign", false, dist(m, "walk")), ["foodCourt"]);
  assert.deepEqual(planAsk(m, "flibbertigibbet", "sign", false, dist(m, "walk")), []);
});

test("AK6 the airport demo phrase is the whole sentence, and it plans", () => {
  const m = load("map.json");
  assert.equal(sayItPhrase(m), "I need coffee and a bathroom before my flight at gate 12C");
  assert.equal(planAsk(m, sayItPhrase(m), "sign", true, dist(m, "stepFree")).length, 3);
});

test("AK7 the LLM only picks places: its prompt lists the map's places; its reply must name real ids, else nothing", () => {
  const m = load("map.json");
  const prompt = askPrompt(m, "coffee and a loo before my flight");
  assert.ok(prompt.indexOf("cafeD") >= 0 && prompt.indexOf("gateC12") >= 0 && prompt.indexOf("coffee and a loo") >= 0);
  assert.ok(prompt.indexOf('"stops"') >= 0, "asks for JSON");
  assert.deepEqual(parseAskReply(m, '{"stops": ["cafeD", "toiletsD", "gateB12"]}'), ["cafeD", "toiletsD", "gateB12"]);
  assert.deepEqual(parseAskReply(m, 'Sure! {"stops": ["cafeD"]}'), ["cafeD"], "JSON inside prose");
  assert.equal(parseAskReply(m, '{"stops": ["cafeD", "moonBase"]}'), null, "an unknown id: nothing");
  assert.equal(parseAskReply(m, "not json"), null);
  assert.equal(parseAskReply(m, '{"stops": []}'), null);
  assert.equal(parseAskReply(m, '{"stops": "cafeD"}'), null);
});
