// Exports the concept video's airport (airport.js, the one in find-your-way-demo.mp4) as a GLB for the
// Lens Studio preview: Assets/Models/Airport/airport.glb. Built from src/core/data/map.json, so it
// matches the routes. The three.js scene is in map metres with z flipped (V = x, y, -z); the Lens
// stands it at the map's origin.
//   npm run airport:glb
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL("./", import.meta.url));
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const OUT = path.join(ROOT, "Assets/Models/Airport/airport.glb");

function chromePath() {
  if (process.env.CHROME) return process.env.CHROME;
  for (const p of ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome"]) {
    if (existsSync(p)) return p;
  }
  throw new Error("Chrome not found; set CHROME to its path");
}

const PAGE = `<!doctype html><html><body>
<script type="importmap">{ "imports": { "three": "/node_modules/three/build/three.module.js" } }</script>
<script type="module">
import * as THREE from "three";
import { GLTFExporter } from "/node_modules/three/examples/jsm/exporters/GLTFExporter.js";
import { mergeGeometries } from "/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js";
import { meshParts } from "/glb-parts.mjs";
globalThis.AIRPORT_EXPORT = true;
const { buildAirport } = await import("/airport.js");
const map = await (await fetch("/map.json")).json();
const scene = new THREE.Scene();
buildAirport(scene, map);
// Only the building (lights, fog and sky belong to the Lens), merged into one mesh per material so
// the Lens draws ~100 meshes instead of ~900.
scene.updateMatrixWorld(true);
const groups = new Map();
scene.traverse((o) => {
  if (!o.isMesh || !o.visible) return;
  // Every material of the mesh (a floor slab has two): see glb-parts.mjs.
  const add = (matrix) => {
    for (const { mat, geo } of meshParts(THREE, o, matrix)) {
      if (!groups.has(mat.uuid)) groups.set(mat.uuid, { mat, geos: [] });
      groups.get(mat.uuid).geos.push(geo);
    }
  };
  if (o.isInstancedMesh) {
    const m = new THREE.Matrix4();
    for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); add(new THREE.Matrix4().multiplyMatrices(o.matrixWorld, m)); }
  } else add(o.matrixWorld);
});
const root = new THREE.Group();
for (const { mat, geos } of groups.values()) {
  const merged = mergeGeometries(geos, false);
  if (merged) root.add(new THREE.Mesh(merged, mat));
}
root.updateMatrixWorld(true);
const glb = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true, maxTextureSize: 1024 });
const bytes = new Uint8Array(glb);
let s = "";
for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
window.glb = btoa(s);
window.done = true;
</script></body></html>`;

const FILES = {
  "/airport.js": path.join(HERE, "airport.js"),
  "/layout.mjs": path.join(HERE, "layout.mjs"),
  "/glb-parts.mjs": path.join(HERE, "glb-parts.mjs"),
  "/node_modules/three/build/three.module.js": path.join(ROOT, "node_modules/three/build/three.module.js"),
  "/node_modules/three/build/three.core.js": path.join(ROOT, "node_modules/three/build/three.core.js"),
  "/node_modules/three/examples/jsm/exporters/GLTFExporter.js": path.join(ROOT, "node_modules/three/examples/jsm/exporters/GLTFExporter.js"),
  "/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js": path.join(ROOT, "node_modules/three/examples/jsm/utils/BufferGeometryUtils.js"),
  "/node_modules/three/examples/jsm/utils/TextureUtils.js": path.join(ROOT, "node_modules/three/examples/jsm/utils/TextureUtils.js"),
};

const server = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    const url = String(req.url).split("?")[0];
    if (url === "/") return res.writeHead(200, { "content-type": "text/html" }).end(PAGE);
    if (url === "/map.json") return res.writeHead(200, { "content-type": "application/json" }).end(readFileSync(path.join(ROOT, "src/core/data/map.json")));
    const f = FILES[url];
    if (!f || !existsSync(f)) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": "text/javascript" }).end(readFileSync(f));
  });
  s.listen(0, "127.0.0.1", () => resolve(s));
});

const { default: puppeteer } = await import("puppeteer-core");
const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true, args: ["--use-angle=d3d11", "--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("page error:", e.message));
  page.on("console", (m) => m.type() === "error" && console.error("page:", m.text()));
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "load" });
  await page.waitForFunction("window.done === true", { timeout: 120000 });
  const b64 = await page.evaluate(() => window.glb);
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, Buffer.from(b64, "base64"));
  console.log("wrote " + path.relative(ROOT, OUT) + " (" + Math.round(Buffer.from(b64, "base64").length / 1024) + " KB)");
} finally {
  await browser.close();
  server.close();
}
