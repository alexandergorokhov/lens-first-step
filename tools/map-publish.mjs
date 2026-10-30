// npm run map:publish -- --log <lens studio log> [--name mine] [--dry-run]
// Reads the map the Lens's Map builder wrote to the log (between [FYW-MAP] markers), validates it
// with parseMap and shows what will be published. Without --dry-run it writes src/core/data/<name>.json
// and adds that file to the gist mapBaseUrl points at, with your own `gh` login (a public change).
// A Lens must not hold a git token: this tool is the only way a walked map leaves the laptop.
// The Lens downloads <name>.json for its saved map; "mine" is the name it asks for.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseMap } from "../src/core/router.ts";
import { parseMapLog } from "../src/core/mapping.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const GIST_ID = "ac59c2c8d02687651f256b320fff27b8";

function arg(name, fallback) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function die(message) {
  console.error(message);
  process.exit(1);
}

const logPath = arg("log", process.env.LENS_LOG);
if (!logPath) die("Say which log: --log <path>, or set LENS_LOG.");
const dryRun = process.argv.includes("--dry-run");
let block;
try {
  block = parseMapLog(readFileSync(logPath, "utf8"));
} catch (e) {
  die(String(e.message || e));
}
if (!block) die("No [FYW-MAP] block in " + logPath + ": pinch Upload in the Map builder first.");
const name = arg("name", block.name);
if (!/^[a-zA-Z0-9_-]+$/.test(name)) die("Bad map name: " + name);
const parsed = parseMap(block.text);
if (!parsed.ok) die("The map doesn't pass parseMap: " + parsed.error);
const map = parsed.map;
const labels = map.nodes.filter((n) => n.kind === "place").map((n) => n.label || n.id);
const floors = ((map.place && map.place.levels) || []).length;
console.log("Map '" + name + "': " + map.nodes.length + " nodes, " + map.edges.length + " stretches, " + floors + " floors");
console.log("Shops: " + (labels.join(", ") || "(none)"));
if (dryRun) {
  console.log("Dry run: nothing written. Without --dry-run this writes src/core/data/" + name + ".json and updates gist " + GIST_ID + ".");
  process.exit(0);
}
const file = path.join(ROOT, "src/core/data", name + ".json");
writeFileSync(file, JSON.stringify(map, null, 2) + "\n");
console.log("Wrote " + file);
execFileSync("gh", ["gist", "edit", GIST_ID, "--add", file], { stdio: "inherit" });
console.log("Gist updated: the Lens downloads " + name + ".json from mapBaseUrl.");
