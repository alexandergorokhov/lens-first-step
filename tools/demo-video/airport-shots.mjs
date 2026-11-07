// Stills of the airport model (the same build as the Lens's airport.glb) from given eye poses, to check
// what the demo's camera sees: node tools/demo-video/airport-shots.mjs <out dir> <poses.json>
// poses.json: [{ name, x, y (floor), z, toX, toZ, eye? (default 1.2, seated) }]
// --glb renders Assets/Models/Airport/airport.glb (what the Lens loads) instead of building airport.js.
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL("./", import.meta.url));
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const GLB = process.argv.includes("--glb");
const [outDir, posesFile] = process.argv.slice(2).filter((a) => a !== "--glb");
const poses = JSON.parse(readFileSync(posesFile, "utf8"));

const PAGE = `<!doctype html><html><body style="margin:0">
<script type="importmap">{ "imports": { "three": "/node_modules/three/build/three.module.js" } }</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "/node_modules/three/examples/jsm/loaders/GLTFLoader.js";
globalThis.AIRPORT_EXPORT = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe8eef4);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 2.2));
if (location.search.includes("glb")) {
  const g = await new GLTFLoader().loadAsync("/airport.glb");
  scene.add(g.scene);
} else {
  const { buildAirport } = await import("/airport.js");
  buildAirport(scene, await (await fetch("/map.json")).json());
}
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
r.setSize(960, 720);
document.body.appendChild(r.domElement);
const cam = new THREE.PerspectiveCamera(60, 960 / 720, 0.05, 400);
cam.rotation.order = "YXZ";
window.shot = (p) => {
  const yaw = Math.atan2(p.toX - p.x, p.toZ - p.z);
  cam.position.set(p.x, p.y + (p.eye ?? 1.2), -p.z);
  cam.rotation.set(-0.05, -yaw, 0);
  r.render(scene, cam);
};
window.done = true;
</script></body></html>`;

const FILES = {
  "/airport.js": path.join(HERE, "airport.js"),
  "/layout.mjs": path.join(HERE, "layout.mjs"),
  "/node_modules/three/build/three.module.js": path.join(ROOT, "node_modules/three/build/three.module.js"),
  "/node_modules/three/build/three.core.js": path.join(ROOT, "node_modules/three/build/three.core.js"),
  "/node_modules/three/examples/jsm/loaders/GLTFLoader.js": path.join(ROOT, "node_modules/three/examples/jsm/loaders/GLTFLoader.js"),
  "/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js": path.join(ROOT, "node_modules/three/examples/jsm/utils/BufferGeometryUtils.js"),
};
const server = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    const url = String(req.url).split("?")[0];
    if (url === "/") return res.writeHead(200, { "content-type": "text/html" }).end(PAGE);
    if (url === "/airport.glb") return res.writeHead(200, { "content-type": "model/gltf-binary" }).end(readFileSync(path.join(ROOT, "Assets/Models/Airport/airport.glb")));
    if (url === "/map.json") return res.writeHead(200, { "content-type": "application/json" }).end(readFileSync(path.join(ROOT, "src/core/data/map.json")));
    const f = FILES[url];
    if (!f || !existsSync(f)) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": "text/javascript" }).end(readFileSync(f));
  });
  s.listen(0, "127.0.0.1", () => resolve(s));
});
const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
const { default: puppeteer } = await import("puppeteer-core");
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || chrome, headless: true, args: ["--use-angle=d3d11", "--enable-unsafe-swiftshader"], defaultViewport: { width: 960, height: 720 } });
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/${GLB ? "?glb" : ""}`, { waitUntil: "load" });
  await page.waitForFunction("window.done === true", { timeout: 120000 });
  mkdirSync(outDir, { recursive: true });
  for (const p of poses) {
    await page.evaluate((q) => window.shot(q), p);
    await page.screenshot({ path: path.join(outDir, p.name + ".png") });
  }
} finally {
  await browser.close();
  server.close();
}
