// Works out the props for the airport and the mall (src/core/props.ts) and writes them to
// src/core/data/props.json, so the Lens only stands them up (planning there took seconds per restart).
//   npm run props      -> rewrite src/core/data/props.json (then npm run sync copies it to Assets/Maps)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseMap } from "../src/core/router.ts";
import { isClear } from "../src/core/geometry.ts";
import { shopFrontPose } from "../src/core/freewalk.ts";
import { propPlan } from "../src/core/props.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
export const KITS = { airport: "map.json", mall: "mall.json" };

export function allPlans(root = ROOT) {
  const out = {};
  for (const [kit, file] of Object.entries(KITS)) {
    const r = parseMap(readFileSync(path.join(root, "src/core/data", file), "utf8"));
    if (!r.ok) throw new Error(file);
    const m = r.map;
    out[kit] = propPlan(m, kit, (p) => isClear(m, p), (id) => shopFrontPose(m, id))
      .map((p) => ({ ...p, x: +p.x.toFixed(3), z: +p.z.toFixed(3) }));
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const plans = allPlans();
  writeFileSync(path.join(ROOT, "src/core/data/props.json"), JSON.stringify(plans, null, 1) + "\n");
  console.log("props.json: " + Object.entries(plans).map(([k, v]) => k + " " + v.length).join(", "));
}
