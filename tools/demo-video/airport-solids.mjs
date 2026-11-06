// The solid things in the airport model (export-airport.mjs) as boxes in map metres, so walking by hand
// in the Lens Studio preview stops at them: shops, desks, seats, check-in, columns and people standing.
//   npm run airport:solids  -> src/core/data/airport-solids.json (npm run sync copies it to Assets/Maps)
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FURNITURE, PEOPLE, SEATS, SHOPS } from "./layout.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

// [x0, x1, z0, z1, floor y] boxes.
export function airportSolids(map) {
  const out = [];
  const r2 = (v) => Math.round(v * 100) / 100;
  const add = (x0, x1, z0, z1, y) => out.push([r2(x0), r2(x1), r2(z0), r2(z1), y]);
  for (const s of SHOPS) add(s[0], s[1], s[2], s[3], s[4]);
  for (const f of FURNITURE) add(f[0], f[1], f[2], f[3], f[4]);
  for (const [x0, x1, y, z] of SEATS) add(x0 - 0.3, x1 + 0.3, z - 0.3, z + 0.3, y);
  for (const [, x, y, z, , , walk] of PEOPLE) if (!walk) add(x - 0.25, x + 0.25, z - 0.25, z + 0.25, y);
  for (let x = 38; x <= 54; x += 4) add(x, x + 2.6, 2.4, 3.3, 0); // check-in desks
  // Columns, placed as airport.js places them (clear of every walkway by 2.2 m).
  const node = (id) => map.nodes.find((n) => n.id === id);
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
    if (x > 60 && x < 68 && z > 14 && z < 28) continue;
    for (const y of [0, 6]) add(x - 0.4, x + 0.4, z - 0.4, z + 0.4, y);
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const map = JSON.parse(readFileSync(path.join(ROOT, "src/core/data/map.json"), "utf8"));
  const solids = airportSolids(map);
  writeFileSync(path.join(ROOT, "src/core/data/airport-solids.json"), JSON.stringify(solids) + "\n");
  console.log("airport-solids.json: " + solids.length + " boxes");
}
