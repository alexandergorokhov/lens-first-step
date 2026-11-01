// Zero-dependency local map server for Find Your Way Inside.
//   npm run maps            -> http://localhost:8787/<name>.json  (e.g. map.json, campus.json)
//   PORT=9000 npm run maps  -> another port
//   npm run maps -- --lan   -> also reachable from other devices on this network
// Serves only the *.json files in src/core/data, with CORS headers so a Lens (or a browser)
// can download them. Set the Lens's `mapBaseUrl` to http://localhost:8787/ to use it.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DEFAULT_DIR = fileURLToPath(new URL("../src/core/data/", import.meta.url));

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export async function startMapServer({ port = 8787, host = "127.0.0.1", dir = DEFAULT_DIR, log = false } = {}) {
  const server = createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS);
      res.end();
      return;
    }
    let name = "";
    try {
      name = decodeURIComponent(new URL(req.url || "/", "http://x").pathname).replace(/^\/+/, "");
    } catch {
      name = "";
    }
    // Only plain "<name>.json" files directly inside the data folder.
    if (!/^[A-Za-z0-9_-]+\.json$/.test(name)) return notFound(res, req, log);
    try {
      const body = await readFile(path.join(dir, name), "utf8");
      res.writeHead(200, { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(req.method === "HEAD" ? undefined : body);
      if (log) console.log(`200 ${req.method} /${name}`);
    } catch {
      notFound(res, req, log);
    }
  });
  await new Promise((resolve) => server.listen(port, host, resolve));
  const actual = server.address().port;
  return {
    port: actual,
    host,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

function notFound(res, req, log) {
  res.writeHead(404, { ...CORS, "Content-Type": "text/plain" });
  res.end("not found");
  if (log) console.log(`404 ${req.method} ${req.url}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8787);
  const { port: p } = await startMapServer({ port, log: true, host: process.argv.includes("--lan") ? "0.0.0.0" : "127.0.0.1" });
  // The bundled maps, from the one maps index (src/core/data/index.json).
  const { maps } = JSON.parse(await readFile(path.join(DEFAULT_DIR, "index.json"), "utf8"));
  console.log(`Find Your Way map server: http://localhost:${p}/`);
  for (const m of maps) console.log(`  ${m.key.padEnd(9)} http://localhost:${p}/${m.file}`);
  console.log("Set mapBaseUrl on the FindYourWay object to http://localhost:" + p + "/  (Ctrl+C to stop)");
}
