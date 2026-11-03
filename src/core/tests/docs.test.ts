// Keeps the docs and the test list honest: every test file runs under `npm test`, every scenario
// that names a Node test has one, the test counts quoted in the docs match the real run, and the
// three.js demo videos say they are concept renders.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const read = (p: string) => readFileSync(ROOT + p, "utf8");
const TEST_DIR = "src/core/tests/";
const testFiles = () => readdirSync(ROOT + TEST_DIR).filter((f) => f.endsWith(".test.ts")).sort();

test("docs: every test file in src/core/tests runs under npm test", () => {
  const script = JSON.parse(read("package.json")).scripts.test as string;
  for (const f of testFiles()) assert.ok(script.includes(TEST_DIR + f), f + " is not in the npm test script");
});

test("docs: every Node test SCENARIOS.md names exists (quoted names, else a test starting with the id)", () => {
  const names = testFiles().map((f) => read(TEST_DIR + f)).join("\n");
  const rows = read("devpost/SCENARIOS.md").split("\n").filter((l) => /^\| [A-Z]+\d+[a-z]? \|/.test(l));
  assert.ok(rows.length > 30);
  const missing: string[] = [];
  for (const row of rows) {
    const id = row.split("|")[1].trim();
    if (!/Node:/.test(row)) continue;
    // Quoted test names after "Node:" (up to "LEAF:") must each start a real test name.
    // Only the Tests column, without notes in parentheses (they quote card texts, not tests).
    const testsCol = row.split("|")[4] || "";
    const nodePart = testsCol.slice(testsCol.indexOf("Node:")).split("LEAF:")[0].replace(/\([^)]*\)/g, "");
    const quoted = [...nodePart.matchAll(/"([^"]+?)(?:…|\.\.\.)?"/g)].map((m) => m[1].replace(/…$/, "").trim()).filter((q) => q.length > 3);
    if (quoted.length) {
      for (const q of quoted) if (!names.includes(q)) missing.push(id + ': "' + q + '"');
      continue;
    }
    const base = id.replace(/[a-z]$/, "");
    // Test names start with the id, e.g. test("S15 ..."), test(`Q4 ...`) or "S9/E1 ...".
    const re = new RegExp("(test\\(|[\"'`])(" + base + "|[A-Z]+\\d+/" + base + ")[ /:]");
    if (!re.test(names)) missing.push(id + ": no test starts with " + base);
  }
  assert.deepEqual(missing, [], "SCENARIOS.md names Node tests that do not exist");
});

test("docs: the video tag says these are concept renders, not the Lens", () => {
  assert.match(read("tools/demo-video/index.html"), /Concept render \(three\.js\), not the Lens/);
  assert.match(read("devpost/PREVIEW-GUIDE.md"), /concept renders, not the Lens/);
});

// Runs the whole suite once more (offline, without this check) and compares the totals with what
// SCENARIOS.md, PREVIEW-GUIDE.md and openspec/specs/README.md say.
test("docs: the test counts quoted in the docs match a real run", { skip: !!process.env.DOCS_COUNT_RUN }, () => {
  const files = testFiles().map((f) => TEST_DIR + f);
  const run = spawnSync(process.execPath, ["--test", "--test-reporter=tap", ...files], {
    cwd: ROOT,
    // NODE_TEST_CONTEXT would make the child report into this run instead of printing a summary.
    env: { ...process.env, NODE_TEST_CONTEXT: undefined, OFFLINE: "1", DOCS_COUNT_RUN: "1" } as NodeJS.ProcessEnv,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const n = (k: string) => Number((run.stdout.match(new RegExp("^# " + k + " (\\d+)", "m")) || [])[1]);
  const total = n("tests");
  assert.ok(total > 100, "could not read the test count");
  assert.equal(n("fail"), 0);
  // The nested run skips the live download and this count check: count those back in.
  const expected = total;
  const scen = read("devpost/SCENARIOS.md").match(/Node (\d+) tests?/);
  assert.ok(scen, "SCENARIOS.md states the Node test count as 'Node <n> tests'");
  assert.equal(Number(scen[1]), expected, "SCENARIOS.md count");
  const guide = read("devpost/PREVIEW-GUIDE.md").match(/Expect `pass (\d+)`/);
  assert.ok(guide);
  assert.equal(Number(guide[1]), expected, "PREVIEW-GUIDE.md: pass (online, every test)");
  const spec = read("openspec/specs/README.md").match(/Node (\d+) tests/);
  assert.ok(spec);
  assert.equal(Number(spec[1]), expected, "openspec/specs/README.md count");
  const readme = read("README.md").match(/There are (\d+) tests/);
  assert.ok(readme, "README.md states the Node test count as 'There are <n> tests'");
  assert.equal(Number(readme[1]), expected, "README.md count");
});
