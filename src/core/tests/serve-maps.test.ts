// Tests for tools/serve-maps.mjs: the zero-dependency local map server (`npm run maps`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { startMapServer } from "../../../tools/serve-maps.mjs";

test("map server: serves src/core/data/map.json as JSON with CORS, 404 for anything else", async () => {
  const server = await startMapServer({ port: 0 }); // 0 = any free port
  try {
    const base = `http://127.0.0.1:${server.port}/`;
    const ok = await fetch(base + "map.json");
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get("content-type") || "", /application\/json/);
    assert.equal(ok.headers.get("access-control-allow-origin"), "*");
    const body = await ok.text();
    assert.equal(body, readFileSync(new URL("../data/map.json", import.meta.url), "utf8"));
    assert.ok(JSON.parse(body).nodes.length > 0);

    for (const name of ["hospital.json", "campus.json", "room.json"]) {
      assert.equal((await fetch(base + name)).status, 200, name);
    }
    const missing = await fetch(base + "nope.json");
    assert.equal(missing.status, 404);
    await missing.text();
    const sneaky = await fetch(base + "..%2F..%2Fpackage.json");
    assert.equal(sneaky.status, 404, "no path traversal outside src/core/data");
    await sneaky.text();
    const opts = await fetch(base + "map.json", { method: "OPTIONS" });
    assert.equal(opts.status, 204);
    assert.equal(opts.headers.get("access-control-allow-origin"), "*");
  } finally {
    await server.close();
  }
});
