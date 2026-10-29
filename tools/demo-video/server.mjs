// Local server for the demo-video page: serves only the page's own files, the timeline and
// three.js's build, on 127.0.0.1 and only to a local Host (no DNS rebinding). Bad escapes get a
// 400 instead of crashing it.
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL("./", import.meta.url));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json" };
const PAGE_FILES = new Set(["index.html", "airport.js", "pet.js", "layout.mjs", "building.js"]);
const THREE_BUILD = /^\/node_modules\/three\/build\/[a-z0-9.]+\.js$/;

export function createDemoServer(root, timelineJson) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const port = server.address().port;
      const host = String(req.headers.host || "");
      if (host !== "127.0.0.1:" + port && host !== "localhost:" + port) return res.writeHead(403).end();
      let url;
      try {
        url = decodeURIComponent(String(req.url).split("?")[0]);
      } catch {
        return res.writeHead(400).end();
      }
      if (url === "/timeline.json") return res.writeHead(200, { "content-type": TYPES[".json"] }).end(timelineJson);
      let file = null;
      if (url === "/") file = path.join(HERE, "index.html");
      else if (PAGE_FILES.has(url.slice(1))) file = path.join(HERE, url.slice(1));
      else if (THREE_BUILD.test(url)) file = path.join(root, url);
      if (!file || !existsSync(file)) return res.writeHead(404).end();
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(readFileSync(file));
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}
