// Renders the demo video: a first-person walk (then a wheelchair roll) through a stand-in
// airport, driven frame by frame by the real route engine (timeline.mjs).
//   npm run demo:video                -> devpost/video/find-your-way-demo.mp4
//   npm run demo:video -- --stills 10,50,110   -> devpost/video/still-<s>.png only
//   npm run demo:watch                -> plays it live in your browser (no recording)
// Needs Google Chrome (or set CHROME=path) and the dev dependencies (npm install).
import { mkdirSync, existsSync } from "node:fs";
import { createDemoServer } from "./server.mjs";
import { spawn, exec } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPetTimeline, buildTimeline } from "./timeline.mjs";
import { buildCampusTimeline, buildHospitalTimeline } from "./scenarios.mjs";

const args = process.argv.slice(2);
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const OUT = path.join(ROOT, "devpost/video");

const serve = (timelineJson) => createDemoServer(ROOT, timelineJson);

function chromePath() {
  if (process.env.CHROME) return process.env.CHROME;
  for (const p of ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome"]) {
    if (existsSync(p)) return p;
  }
  throw new Error("Chrome not found; set CHROME to its path");
}

const t0 = Date.now();
// --pet renders the pet clip (find-your-way-pet.mp4) instead of the main demo.
// --companion robot|rover renders the same clip with another model (implies --pet).
const ci = args.indexOf("--companion");
const COMPANION = ci >= 0 ? args[ci + 1] : "dog";
const PET = args.includes("--pet") || ci >= 0;
// --map hospital|campus renders that place's scenarios (find-your-way-hospital.mp4, ...).
const mi = args.indexOf("--map");
const MAP = mi >= 0 ? args[mi + 1] : null;
const SCENES = { hospital: buildHospitalTimeline, campus: buildCampusTimeline };
if (MAP && !SCENES[MAP]) throw new Error("--map must be one of " + Object.keys(SCENES).join(", "));
const NAME = MAP || (PET ? (COMPANION === "dog" ? "pet" : COMPANION) : "demo");
const timeline = MAP ? SCENES[MAP]() : PET ? buildPetTimeline(undefined, COMPANION) : buildTimeline();
const server = await serve(JSON.stringify(timeline));
const base = `http://127.0.0.1:${server.address().port}/`;
console.log(`timeline: ${timeline.frames.length} frames (${(timeline.frames.length / timeline.fps).toFixed(1)} s)`);

if (args.includes("--watch")) {
  console.log(`Playing at ${base}?play  (Ctrl+C to stop)`);
  const open = process.platform === "win32" ? `start "" "${base}?play"` : process.platform === "darwin" ? `open "${base}?play"` : `xdg-open "${base}?play"`;
  exec(open);
} else {
  const { default: puppeteer } = await import("puppeteer-core");
  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: true,
    args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader", "--hide-scrollbars"],
    defaultViewport: { width: 1280, height: 720 },
  });
  const page = await browser.newPage();
  page.on("console", (m) => m.type() === "error" && console.error("page:", m.text()));
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(base, { waitUntil: "load" });
  await page.waitForFunction("window.ready === true", { timeout: 60000 });
  const stage = await page.$("#stage");
  mkdirSync(OUT, { recursive: true });

  const si = args.indexOf("--stills");
  if (si >= 0) {
    for (const s of args[si + 1].split(",").map(Number)) {
      await page.evaluate((i) => window.renderFrame(i), Math.round(s * timeline.fps));
      const file = path.join(OUT, `${NAME !== "demo" ? NAME + "-" : ""}still-${String(s).padStart(5, "0")}.png`);
      await stage.screenshot({ path: file });
      console.log("wrote", path.relative(ROOT, file));
    }
  } else {
    const { default: ffmpeg } = await import("ffmpeg-static");
    const file = path.join(OUT, "find-your-way-" + NAME + ".mp4");
    const ff = spawn(ffmpeg, ["-y", "-f", "image2pipe", "-framerate", String(timeline.fps), "-c:v", "mjpeg", "-i", "-",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium", "-movflags", "+faststart", file], { stdio: ["pipe", "ignore", "inherit"] });
    const n = timeline.frames.length;
    for (let i = 0; i < n; i++) {
      await page.evaluate((k) => window.renderFrame(k), i);
      const jpg = await stage.screenshot({ type: "jpeg", quality: 92 });
      if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once("drain", r));
      if (i % 150 === 0) console.log(`frame ${i}/${n}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
    ff.stdin.end();
    await new Promise((r) => ff.on("close", r));
    console.log("wrote", path.relative(ROOT, file));
  }
  await browser.close();
  server.close();
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
