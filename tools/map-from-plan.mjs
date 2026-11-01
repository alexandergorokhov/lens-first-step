// Turns a draft JSON (what an agent writes after reading floor-plan photos) into a map in the
// src/core/data format, validates it with parseMap, and writes <name>.map.json + <name>.svg.
//   npm run map:from-plan -- <draft.json> [--scale <metres per plan unit>] [--out <folder>] [--name <name>]
// Default output folder: devpost/maps/. Exit code 1 (and nothing written) if the draft is broken.
// Draft format: see agent/skills/map-from-photo/SKILL.md and tools/examples/plan-draft.sample.json.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseMap, findRoute } from "../src/core/router.ts";
import { drawMap } from "./draw-maps.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const LINK_KINDS = ["lift", "stairs", "escalator", "ramp"];
const POINT_KINDS = ["sign", "junction", "destination", "assistance", "lift", "place"];
const FLOOR_HEIGHT = 4; // metres per floor when a floor gives no height
const MIN_FLOOR_GAP = 0.5;
const PAD = 2;
const r1 = (n) => Math.round(n * 10) / 10;
const up1 = (n) => Math.ceil(n * 10 - 1e-9) / 10; // never shorter than the straight line
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// Returns { ok:true, map, text, warnings } or { ok:false, errors:[string] }; each error says what to fix.
export function buildMap(draft, opts = {}) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    return { ok: false, errors: ["The draft must be a JSON object. Fix: start from tools/examples/plan-draft.sample.json."] };
  }

  const scale = opts.scale ?? draft.scale;
  const scaleOk = isNum(scale) && scale > 0;
  if (!scaleOk) err("No scale. Fix: pass --scale <metres per plan unit> (for example --scale 0.05 if one pixel is 5 cm), or put \"scale\" in the draft. Ask the user for a known distance on the plan (a door is about 0.9 m wide).");

  // Floors
  const floors = new Map();
  if (!Array.isArray(draft.floors) || draft.floors.length === 0) {
    err("No floors. Fix: add \"floors\": [{ \"id\": \"G\", \"name\": \"Ground floor\", \"height\": 0 }, ...], one per plan photo.");
  } else {
    draft.floors.forEach((f, i) => {
      if (!f || typeof f.id !== "string" || f.id === "") return err(`Floor #${i + 1} has no id. Fix: give it a short id like "G" or "1".`);
      if (floors.has(f.id)) return err(`Floor id "${f.id}" is used twice. Fix: floor ids must be unique.`);
      if (f.height !== undefined && !isNum(f.height)) return err(`Floor "${f.id}" has a bad height. Fix: use a number of metres, or leave it out (floors default to ${FLOOR_HEIGHT} m apart).`);
      floors.set(f.id, { id: f.id, name: typeof f.name === "string" && f.name ? f.name : "Floor " + f.id, y: f.height ?? i * FLOOR_HEIGHT, index: i });
    });
    // Storeys count by height, whatever order the draft lists them.
    [...floors.values()].sort((a, b) => a.y - b.y).forEach((f, i, all) => {
      f.index = i;
      if (i > 0 && f.y - all[i - 1].y < MIN_FLOOR_GAP) err(`Floors "${all[i - 1].id}" and "${f.id}" are under ${MIN_FLOOR_GAP} m apart. Fix: floors that close count as one level; merge them or correct the heights.`);
    });
  }

  // Points
  const pts = new Map();
  if (!Array.isArray(draft.points) || draft.points.length === 0) {
    err("No points. Fix: add \"points\": rooms, junctions, lifts, the entrance sign. Every point needs id, floor, x, y.");
  } else {
    for (const p of draft.points) {
      if (!p || typeof p.id !== "string" || p.id === "") { err("A point has no id. Fix: give every point a unique id."); continue; }
      if (pts.has(p.id)) { err(`Point id "${p.id}" is used twice. Fix: rename one of them.`); continue; }
      if (typeof p.floor !== "string" || !floors.has(p.floor)) {
        err(`Point "${p.id}" has floor ${JSON.stringify(p.floor)}, which is not in "floors". Fix: every point carries one of: ${[...floors.keys()].join(", ") || "(no floors yet)"}.`);
        continue;
      }
      if (!isNum(p.x) || !isNum(p.y)) { err(`Point "${p.id}" needs numeric x and y (plan units). Fix: read them off the photo.`); continue; }
      const kind = p.kind ?? "junction";
      if (!POINT_KINDS.includes(kind)) { err(`Point "${p.id}" has unknown kind "${kind}". Fix: use one of ${POINT_KINDS.join(", ")}.`); continue; }
      pts.set(p.id, { ...p, kind });
    }
  }

  const edges = [];
  const seenPair = new Set();
  const need = (id, where) => {
    if (pts.has(id)) return true;
    err(`${where} mentions ${JSON.stringify(id)}, which is not a point. Fix: add that point or correct the id (points: ${[...pts.keys()].slice(0, 8).join(", ")}${pts.size > 8 ? ", ..." : ""}).`);
    return false;
  };
  const metres = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) * (scaleOk ? scale : 1);

  // Corridors (same floor)
  const pairs = [];
  if (!Array.isArray(draft.corridors)) {
    err("No corridors. Fix: add \"corridors\": [{ \"from\": \"a\", \"to\": \"b\" } or { \"path\": [\"a\",\"b\",\"c\"] }].");
  } else {
    draft.corridors.forEach((c, i) => {
      const where = `Corridor #${i + 1}`;
      if (c && Array.isArray(c.path)) {
        if (c.path.length < 2) err(`${where} has a path of fewer than 2 points.`);
        for (let k = 1; k < c.path.length; k++) pairs.push([c.path[k - 1], c.path[k], where]);
      } else if (c && typeof c.from === "string" && typeof c.to === "string") pairs.push([c.from, c.to, where]);
      else err(`${where} needs "from" and "to", or a "path" list.`);
    });
  }
  for (const [a, b, where] of pairs) {
    const okA = need(a, where);
    const okB = need(b, where);
    if (!okA || !okB) continue;
    const A = pts.get(a), B = pts.get(b);
    if (a === b) { err(`${where} joins "${a}" to itself.`); continue; }
    if (A.floor !== B.floor) {
      err(`${where} joins "${a}" (floor ${A.floor}) to "${b}" (floor ${B.floor}). Fix: corridors stay on one floor; use "links" (lift/stairs/escalator/ramp) between floors.`);
      continue;
    }
    const key = [a, b].sort().join("|");
    if (seenPair.has(key)) { warnings.push(`Corridor ${a} - ${b} is listed twice; kept once.`); continue; }
    seenPair.add(key);
    edges.push({ from: a, to: b, length: Math.max(0.1, up1(metres(A, B))), kind: "walk", open: true });
  }

  // Links between floors
  (Array.isArray(draft.links) ? draft.links : []).forEach((l, i) => {
    const where = `Link #${i + 1}`;
    if (!l || !LINK_KINDS.includes(l.kind)) return err(`${where} has kind ${JSON.stringify(l && l.kind)}. Fix: use one of ${LINK_KINDS.join(", ")}.`);
    const okA = need(l.from, where);
    const okB = need(l.to, where);
    if (!okA || !okB) return;
    const A = pts.get(l.from), B = pts.get(l.to);
    if (A.floor === B.floor) return err(`${where} (${l.kind}) joins "${l.from}" and "${l.to}", both on floor ${A.floor}. Fix: a ${l.kind} must join two different floors; if it is on one floor, use a corridor.`);
    const rise = Math.abs(floors.get(A.floor).y - floors.get(B.floor).y);
    const straight = Math.hypot(metres(A, B), rise);
    // Distance of the ride: a ramp is gentle (about 1:12); stairs and escalators run along a slope.
    const along = l.kind === "ramp" ? Math.max(straight, rise * 12) : l.kind === "lift" ? Math.max(straight, rise) : straight * 1.2;
    const length = isNum(l.length) && l.length > 0 ? Math.max(l.length, up1(straight)) : up1(along);
    const e = { from: l.from, to: l.to, length, kind: l.kind, open: true };
    if (l.kind === "lift") e.id = typeof l.id === "string" && l.id ? l.id : `lift-${l.from}-${l.to}`;
    else if (typeof l.id === "string" && l.id) e.id = l.id;
    edges.push(e);
  });

  // Entrance and destination
  if (draft.entrance === undefined || draft.entrance === null || draft.entrance === "") {
    err("No entrance. Fix: add \"entrance\": \"<point id>\", the point where the user scans the sign (ask the user where the entrance sign is).");
  } else if (typeof draft.entrance !== "string" || !pts.has(draft.entrance)) {
    err(`Entrance ${JSON.stringify(draft.entrance)} is not a point. Fix: add that point (with its floor and x, y) or correct the id.`);
  } else pts.get(draft.entrance).kind = "sign";
  let destId = draft.destination;
  if (destId !== undefined && !(typeof destId === "string" && pts.has(destId))) {
    err(`Destination ${JSON.stringify(destId)} is not a point. Fix: use the id of a room or place.`);
    destId = undefined;
  } else if (destId === undefined) {
    const d = [...pts.values()].find((p) => p.kind === "destination");
    if (d) destId = d.id;
    else err("No destination. Fix: add a point with \"kind\": \"destination\" (a room) or set \"destination\" to a point id.");
  }

  // Connectivity: every point reachable from the entrance; warn where Step-Free cannot reach a room.
  if (!errors.length) {
    const reach = (stepFree) => {
      const adj = new Map([...pts.keys()].map((k) => [k, []]));
      for (const e of edges) {
        if (stepFree && (e.kind === "stairs" || e.kind === "escalator")) continue;
        adj.get(e.from).push(e.to);
        if (e.kind !== "escalator") adj.get(e.to).push(e.from);
      }
      const seen = new Set([draft.entrance]);
      const stack = [draft.entrance];
      while (stack.length) for (const n of adj.get(stack.pop())) if (!seen.has(n)) { seen.add(n); stack.push(n); }
      return seen;
    };
    const all = reach(false);
    for (const p of pts.values()) {
      if (!all.has(p.id)) {
        err(`Point "${p.id}"${p.label ? ` (${p.label})` : ""} on floor ${p.floor} cannot be reached from the entrance "${draft.entrance}". Fix: add a corridor joining it to a nearby point${floors.size > 1 ? ", or a link (lift/stairs/ramp) if it is on another floor" : ""}.`);
      }
    }
    if (!errors.length) {
      const sf = reach(true);
      for (const p of pts.values()) {
        if (p.kind === "destination" && !sf.has(p.id)) {
          warnings.push(`"${p.id}"${p.label ? ` (${p.label})` : ""} has no Step-Free route from the entrance (only stairs or an escalator lead there). Add a lift or ramp link if the building has one; otherwise this is true to the plan.`);
        }
      }
    }
  }
  if (errors.length) return { ok: false, errors };

  // Plan units -> metres. x east, z north (plan y runs down unless yDown is false); shifted so the minimum is PAD.
  const yDown = draft.yDown !== false;
  const raw = [...pts.values()].map((p) => ({ p, x: p.x * scale, z: (yDown ? -p.y : p.y) * scale }));
  const minX = Math.min(...raw.map((r) => r.x)), minZ = Math.min(...raw.map((r) => r.z));
  const maxX = Math.max(...raw.map((r) => r.x)), maxZ = Math.max(...raw.map((r) => r.z));
  const nodes = raw.map(({ p, x, z }) => {
    const n = { id: p.id, x: r1(x - minX + PAD), y: floors.get(p.floor).y, z: r1(z - minZ + PAD), kind: p.kind };
    for (const k of ["label", "type", "code", "icon", "arrivalCard", "category", "sponsored", "sponsorTag"]) if (p[k] !== undefined) n[k] = p[k];
    if (p.kind === "destination" && n.type === undefined) n.type = "room";
    return n;
  });
  // Re-measure from the rounded coordinates so no edge is shorter than the straight line.
  const at = new Map(nodes.map((n) => [n.id, n]));
  for (const e of edges) {
    const a = at.get(e.from), b = at.get(e.to);
    const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    if (e.length < d) e.length = up1(d);
  }
  const name = opts.name ?? draft.name ?? "plan";
  const w = r1(maxX - minX + 2 * PAD), h = r1(maxZ - minZ + 2 * PAD);
  const map = {
    version: 1,
    revision: 1,
    name: draft.title ?? name,
    units: "m",
    axes: `x east, y up, z north; floor ${w} x ${h} m; drafted from floor plans (a guess until someone walks it)`,
    place: {
      title: draft.title ?? name,
      start: draft.entrance,
      destination: destId,
      levels: [...floors.values()].map((f) => ({ y: f.y, name: f.name, floor: f.index })),
      footprint: { minX: 0, maxX: w, minZ: 0, maxZ: h },
      scanSign: { title: "You are here", button: "Scan sign", hint: "on real Specs: look at the sign" },
    },
    nodes,
    edges,
  };
  const text = JSON.stringify(map, null, 2) + "\n";
  const parsed = parseMap(text);
  if (!parsed.ok) return { ok: false, errors: [`The validator rejected the generated map: ${parsed.error}. Fix the draft near that item.`] };
  const route = findRoute(parsed.map, draft.entrance, destId, "walk");
  if (route.status !== "route") return { ok: false, errors: [`No Walk route from the entrance to "${destId}". Fix: join them with corridors.`] };
  return { ok: true, map: parsed.map, text, warnings };
}

function parseArgs(argv) {
  const o = { file: null, out: path.join(ROOT, "devpost/maps") };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--scale") o.scale = Number(argv[++i]);
    else if (a === "--out") o.out = path.resolve(argv[++i] ?? "");
    else if (a === "--name") o.name = argv[++i];
    else if (!a.startsWith("--") && !o.file) o.file = a;
    else { console.error("Unknown argument " + a); process.exit(2); }
  }
  return o;
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  if (!o.file) { console.error("Usage: npm run map:from-plan -- <draft.json> [--scale <metres per unit>] [--out <folder>] [--name <name>]"); process.exit(2); }
  let draft;
  try { draft = JSON.parse(readFileSync(o.file, "utf8")); } catch (e) { console.error(`Cannot read ${o.file} as JSON: ${e.message}`); process.exit(1); }
  if (o.scale !== undefined && !(o.scale > 0)) { console.error("--scale must be a positive number of metres per plan unit."); process.exit(1); }
  const name = String(o.name ?? draft?.name ?? path.basename(o.file).replace(/\.[^.]*$/, "")).replace(/[^A-Za-z0-9._-]+/g, "-");
  const res = buildMap(draft, { scale: o.scale, name });
  if (!res.ok) {
    console.error(`Draft has ${res.errors.length} problem(s); nothing was written:`);
    res.errors.forEach((m, i) => console.error(`  ${i + 1}. ${m}`));
    process.exit(1);
  }
  mkdirSync(o.out, { recursive: true });
  const mapFile = path.join(o.out, name + ".map.json"), svgFile = path.join(o.out, name + ".svg");
  writeFileSync(mapFile, res.text);
  writeFileSync(svgFile, drawMap(res.map));
  res.warnings.forEach((w) => console.log("warning: " + w));
  console.log(`Valid map: ${res.map.nodes.length} points, ${res.map.edges.length} connections, ${res.map.place.levels.length} floors.`);
  console.log("wrote " + mapFile + "\nwrote " + svgFile);
  console.log("Reminder: names and positions are a guess from the plan until someone walks it.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
