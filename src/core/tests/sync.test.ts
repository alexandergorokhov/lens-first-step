// Tooling and hygiene from the review (A1, A4, C13 map picker): the sync tool keeps the Lens
// copies identical, the maps index is the one list of bundled maps, the pre-commit hook runs
// the tests, and dead / airport-specific code is gone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

async function tool(): Promise<any> {
  return await import(new URL("../../../tools/sync-core.mjs", import.meta.url).href);
}

test("A1 sync:check passes on the repo, reports a drifted copy, and sync fixes it", async () => {
  const { checkSync, sync, syncPairs } = await tool();
  assert.deepEqual(checkSync(), [], "repo copies are in sync");
  const dir = mkdtempSync(path.join(tmpdir(), "fyw-sync-"));
  try {
    for (const p of syncPairs()) {
      cpSync(path.join(ROOT, p.src), path.join(dir, p.src));
      cpSync(path.join(ROOT, p.lens), path.join(dir, p.lens));
    }
    cpSync(path.join(ROOT, "src/core/data/index.json"), path.join(dir, "src/core/data/index.json"));
    writeFileSync(path.join(dir, "Assets/Scripts/FindYourWayRouter.ts"), "// drifted\n");
    assert.deepEqual(checkSync(dir).map((p: any) => p.lens), ["Assets/Scripts/FindYourWayRouter.ts"]);
    sync(dir);
    assert.deepEqual(checkSync(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("A1 npm test runs sync:check first; npm run hooks enables a pre-commit hook that runs npm test", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts.sync, /sync-core\.mjs$/);
  assert.match(pkg.scripts["sync:check"], /sync-core\.mjs --check/);
  assert.match(pkg.scripts.test, /^npm run sync:check && /);
  assert.match(pkg.scripts.hooks, /git config core\.hooksPath \.githooks/);
  assert.ok(existsSync(path.join(ROOT, ".githooks/pre-commit")), ".githooks/pre-commit exists");
  assert.match(read(".githooks/pre-commit"), /npm test/);
});

test("A1/C13 the maps index is the one list: Assets/Maps, MAP_SOURCES and the mapKey picker all match it", async () => {
  const { mapIndex } = await tool();
  const keys = mapIndex().map((m: any) => m.key);
  assert.deepEqual(keys, ["airport", "hospital", "campus", "room"]);
  const lib = read("Assets/Scripts/FindYourWayMapLibrary.ts");
  for (const m of mapIndex()) {
    assert.ok(existsSync(path.join(ROOT, "Assets/Maps", m.lens)), m.lens);
    assert.ok(lib.includes(`{key: "${m.key}", asset: requireAsset("../Maps/${m.lens}") as JsonAsset, file: "${m.file}"}`), "MAP_SOURCES has " + m.key);
  }
  const main = read("Assets/Scripts/FindYourWayMain.ts");
  const combo = main.match(/mapKey[\s\S]{0,400}?ComboBoxWidget\(\[([^\]]*)\]/) || main.match(/ComboBoxWidget\(\[([^\]]*)\]\)\)\s*\n\s*mapKey/);
  assert.ok(combo, "mapKey has a ComboBox");
  for (const k of keys) assert.ok(combo![1].includes(`"${k}"`), "mapKey picker offers " + k);
});

test("A4 no dead helpers, no airport-only router API, no setGate, no `* 0 +` trick", () => {
  const lib = read("Assets/Scripts/FindYourWayMapLibrary.ts");
  assert.doesNotMatch(lib, /function edgeById|function liftEdgesAt/);
  const router = read("src/core/router.ts");
  assert.doesNotMatch(router, /gateChangeMessage|arrivalMessage|setGate/);
  for (const f of ["Assets/Scripts/FindYourWayMain.ts", "src/core/tests/maps.test.ts", "src/core/tests/router.test.ts"]) {
    assert.doesNotMatch(read(f), /setGate\(/, f);
  }
  assert.doesNotMatch(read("Assets/Scripts/FindYourWayStandIn.ts"), /\* 0 \+/);
  assert.match(lib, /from "\.\/FindYourWayPlace"/, "MapLibrary uses the shared place module");
});
