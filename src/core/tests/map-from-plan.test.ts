// Tests for tools/map-from-plan.mjs: a draft (what an agent writes after reading floor-plan photos)
// becomes a map the Lens accepts, or a clear error instead of a broken file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findRoute, parseMap } from "../router.ts";
// @ts-ignore: plain .mjs tool
import { buildMap } from "../../../tools/map-from-plan.mjs";

const SAMPLE = fileURLToPath(new URL("../../../tools/examples/plan-draft.sample.json", import.meta.url));
const TOOL = fileURLToPath(new URL("../../../tools/map-from-plan.mjs", import.meta.url));

function draft(): any {
  return JSON.parse(readFileSync(SAMPLE, "utf8"));
}

function build(d: any, opts: any = {}): any {
  return buildMap(d, opts);
}

function failure(d: any, opts: any = {}): string {
  const r = build(d, opts);
  assert.equal(r.ok, false, "expected the draft to be rejected");
  return r.errors.join("\n");
}

test("the sample clinic draft makes a map parseMap accepts", () => {
  const r = build(draft());
  assert.equal(r.ok, true, r.errors && r.errors.join("\n"));
  const again = parseMap(r.text);
  assert.equal(again.ok, true);
  assert.equal(r.map.place.levels.length, 2);
  assert.equal(r.map.place.start, "door");
  assert.equal(r.map.nodes.find((n: any) => n.id === "door").kind, "sign");
  assert.equal(r.map.nodes.find((n: any) => n.id === "room201").y, 4);
  assert.equal(r.map.edges.find((e: any) => e.kind === "lift").id, "clinicLift");
});

test("the scale turns plan units into metres", () => {
  const a = build(draft(), { scale: 0.05 });
  const b = build(draft(), { scale: 0.1 });
  const len = (r: any) => r.map.edges.find((e: any) => e.from === "door" && e.to === "lobby").length;
  assert.ok(Math.abs(len(a) - 4) < 0.2, "80 units at 0.05 m is 4 m, got " + len(a));
  assert.ok(Math.abs(len(b) - 8) < 0.2);
});

test("Step-Free crosses floors only through a lift or ramp", () => {
  const withLift = build(draft()).map;
  const r = findRoute(withLift, "door", "room201", "stepFree");
  assert.equal(r.status, "route");
  assert.ok(r.status === "route" && r.edges.some((e: any) => e.kind === "lift"));

  const noLift = draft();
  noLift.links = noLift.links.filter((l: any) => l.kind !== "lift");
  const built = build(noLift);
  assert.equal(built.ok, true);
  assert.equal(findRoute(built.map, "door", "room201", "walk").status, "route");
  assert.equal(findRoute(built.map, "door", "room201", "stepFree").status, "askStaff");
  assert.ok(built.warnings.some((w: string) => /room201/.test(w) && /Step-Free/.test(w)), "warns that room201 has no step-free route");

  const ramp = draft();
  ramp.links = [{ kind: "ramp", from: "stairsG", to: "stairsU" }];
  const rampMap = build(ramp);
  assert.equal(rampMap.ok, true);
  assert.equal(findRoute(rampMap.map, "door", "room201", "stepFree").status, "route");
  const rampEdge = rampMap.map.edges.find((e: any) => e.kind === "ramp");
  assert.ok(rampEdge.length >= 4 * 12, "a ramp rising 4 m is long (about 1:12)");
});

test("a room nobody can walk to is named, with what to fix", () => {
  const d = draft();
  d.corridors = d.corridors.filter((c: any) => c.to !== "room101");
  const msg = failure(d);
  assert.match(msg, /room101/);
  assert.match(msg, /cannot be reached/);
  assert.match(msg, /Fix:/);
});

test("a missing entrance, scale, floor or bad corridor each give a clear error", () => {
  const noEntrance = draft();
  delete noEntrance.entrance;
  assert.match(failure(noEntrance), /No entrance/);

  const noScale = draft();
  delete noScale.scale;
  assert.match(failure(noScale), /No scale/);
  assert.equal(build(noScale, { scale: 0.05 }).ok, true, "--scale supplies it");

  const badFloor = draft();
  badFloor.points[1].floor = "7";
  assert.match(failure(badFloor), /"lobby".*floor "7".*not in "floors"/);

  const noFloor = draft();
  delete noFloor.points[1].floor;
  assert.match(failure(noFloor), /"lobby"/);

  const unknown = draft();
  unknown.corridors.push({ from: "lobby", to: "ghost" });
  assert.match(failure(unknown), /"ghost".*not a point/);

  const cross = draft();
  cross.corridors.push({ from: "hallG", to: "hallU" });
  assert.match(failure(cross), /use "links"/);

  const sameFloorLink = draft();
  sameFloorLink.links.push({ kind: "lift", from: "lobby", to: "hallG" });
  assert.match(failure(sameFloorLink), /different floors/);

  const dupe = draft();
  dupe.points.push({ ...dupe.points[0] });
  assert.match(failure(dupe), /used twice/);

  const badKind = draft();
  badKind.links[1].kind = "teleporter";
  assert.match(failure(badKind), /one of lift, stairs, escalator, ramp/);

  assert.match(failure("nonsense"), /JSON object/);
});

test("the command writes the map and the SVG, and writes nothing for a broken draft", () => {
  const out = mkdtempSync(path.join(tmpdir(), "plan-"));
  const ok = spawnSync(process.execPath, [TOOL, SAMPLE, "--out", out], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr);
  const files = readdirSync(out).sort();
  assert.deepEqual(files, ["sample-clinic.map.json", "sample-clinic.svg"]);
  assert.equal(parseMap(readFileSync(path.join(out, "sample-clinic.map.json"), "utf8")).ok, true);
  assert.match(readFileSync(path.join(out, "sample-clinic.svg"), "utf8"), /^<svg/);

  const bad = draft();
  delete bad.entrance;
  const badFile = path.join(out, "bad.json");
  writeFileSync(badFile, JSON.stringify(bad));
  const out2 = path.join(out, "second");
  const fail = spawnSync(process.execPath, [TOOL, badFile, "--out", out2], { encoding: "utf8" });
  assert.equal(fail.status, 1);
  assert.match(fail.stderr, /No entrance/);
  assert.equal(existsSync(out2), false, "no output folder for a rejected draft");
});

