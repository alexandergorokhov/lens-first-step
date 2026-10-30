// Keeps the Lens copies of the shared core byte-identical to src/core.
//   npm run sync         -> copy src/core/{router,geometry,demo,place,pet,places,play,mapping,peek,trip,astar}.ts to Assets/Scripts/FindYourWay*.ts
//                           and every map in src/core/data/index.json to Assets/Maps/<lens>
//   npm run sync:check   -> exit 1 listing any copy that differs (run first by `npm test`
//                           and by the pre-commit hook; `npm run hooks` turns the hook on)
// src/core is the source of truth; edit there, then sync.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

export const CORE_MODULES = [
  { src: "src/core/router.ts", lens: "Assets/Scripts/FindYourWayRouter.ts" },
  { src: "src/core/geometry.ts", lens: "Assets/Scripts/FindYourWayGeometry.ts" },
  { src: "src/core/demo.ts", lens: "Assets/Scripts/FindYourWayDemo.ts" },
  { src: "src/core/place.ts", lens: "Assets/Scripts/FindYourWayPlace.ts" },
  { src: "src/core/pet.ts", lens: "Assets/Scripts/FindYourWayPet.ts" },
  { src: "src/core/places.ts", lens: "Assets/Scripts/FindYourWayPlaces.ts" },
  { src: "src/core/play.ts", lens: "Assets/Scripts/FindYourWayPlay.ts" },
  { src: "src/core/mapping.ts", lens: "Assets/Scripts/FindYourWayMapping.ts" },
  { src: "src/core/peek.ts", lens: "Assets/Scripts/FindYourWayPeek.ts" },
  { src: "src/core/trip.ts", lens: "Assets/Scripts/FindYourWayTrip.ts" },
  { src: "src/core/astar.ts", lens: "Assets/Scripts/FindYourWayAStar.ts" },
];

// The one list of bundled maps (key, file served/downloaded, Lens copy name).
export function mapIndex(root = ROOT) {
  return JSON.parse(readFileSync(path.join(root, "src/core/data/index.json"), "utf8")).maps;
}

export function syncPairs(root = ROOT) {
  const maps = mapIndex(root).map((m) => ({ src: "src/core/data/" + m.file, lens: "Assets/Maps/" + m.lens }));
  return CORE_MODULES.concat(maps);
}

// Copies that are missing or differ from their source.
export function checkSync(root = ROOT) {
  const out = [];
  for (const p of syncPairs(root)) {
    const a = readFileSync(path.join(root, p.src), "utf8");
    const lensPath = path.join(root, p.lens);
    if (!existsSync(lensPath) || readFileSync(lensPath, "utf8") !== a) out.push(p);
  }
  return out;
}

export function sync(root = ROOT) {
  const changed = checkSync(root);
  for (const p of changed) writeFileSync(path.join(root, p.lens), readFileSync(path.join(root, p.src), "utf8"));
  return changed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    const bad = checkSync();
    if (bad.length) {
      console.error("Lens copies out of date (run `npm run sync`):");
      for (const p of bad) console.error("  " + p.lens + "  !=  " + p.src);
      process.exit(1);
    }
    console.log("Lens copies are in sync (" + syncPairs().length + " files).");
  } else {
    const changed = sync();
    console.log(changed.length ? "Copied:\n" + changed.map((p) => "  " + p.src + " -> " + p.lens).join("\n") : "Already in sync.");
  }
}
