// Downloads every map from the Lens's online source (the public gist) and draws it.
//   npm run maps:draw          -> devpost/maps/<key>.svg + devpost/maps/index.html
//                                 (downloaded files saved to devpost/maps/downloaded/)
//   npm run maps:draw -- --local   draw src/core/data without downloading
// Each level is drawn top-down (x east, z north). Blue = Walk route, green = Step-Free route,
// from the map's start sign to its destination, computed by the same router the Lens uses.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseMap, findRoute } from "../src/core/router.ts";
import { mapIndex } from "./sync-core.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
export const ONLINE_BASE = "https://gist.githubusercontent.com/alexandergorokhov/ac59c2c8d02687651f256b320fff27b8/raw/";
const OUT = path.join(ROOT, "devpost/maps");

const KIND_COLOR = { sign: "#d9480f", destination: "#c2255c", lift: "#5f3dc4", assistance: "#e67700", junction: "#868e96" };
const EDGE_DASH = { walk: "", ramp: "6 3", stairs: "2 3", escalator: "8 3 2 3", lift: "1 4" };
const WALK = "#1c7ed6";
const STEP_FREE = "#2f9e44";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function levelOf(levels, y) {
  let best = 0;
  for (let i = 1; i < levels.length; i++) if (Math.abs(levels[i].y - y) < Math.abs(levels[best].y - y)) best = i;
  return best;
}

export function drawMap(map) {
  const place = map.place;
  const levels = place.levels;
  const nodes = new Map(map.nodes.map((n) => [n.id, { ...n, level: levelOf(levels, n.y) }]));
  const fp = place.footprint;
  const span = Math.max(fp.maxX - fp.minX, fp.maxZ - fp.minZ);
  const scale = 560 / span;
  const pad = 40;
  const panelW = (fp.maxX - fp.minX) * scale + pad * 2;
  const panelH = (fp.maxZ - fp.minZ) * scale + pad * 2 + 30;
  const routes = [
    { name: "Walk", color: WALK, r: findRoute(map, place.start, place.destination, "walk"), off: -2.5 },
    { name: "Step-Free", color: STEP_FREE, r: findRoute(map, place.start, place.destination, "stepFree"), off: 2.5 },
  ];
  const W = panelW * levels.length;
  const H = panelH + 70;
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Segoe UI, Arial, sans-serif">`);
  out.push(`<rect width="${W}" height="${H}" fill="#fff"/>`);
  levels.forEach((lv, li) => {
    const ox = li * panelW;
    const P = (n) => [ox + pad + (n.x - fp.minX) * scale, 30 + pad + (fp.maxZ - n.z) * scale];
    out.push(`<rect x="${ox + 8}" y="8" width="${panelW - 16}" height="${panelH - 8}" rx="10" fill="#f8f9fa" stroke="#dee2e6"/>`);
    out.push(`<text x="${ox + 22}" y="32" font-size="16" font-weight="600">${esc(lv.name)} (y ${lv.y} m)</text>`);
    for (const e of map.edges) {
      const a = nodes.get(e.from), b = nodes.get(e.to);
      if (a.level === li && b.level === li) {
        const [x1, y1] = P(a), [x2, y2] = P(b);
        out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${e.open === false ? "#fa5252" : "#adb5bd"}" stroke-width="3" stroke-dasharray="${EDGE_DASH[e.kind] ?? ""}"/>`);
      }
    }
    for (const { color, r, off } of routes) {
      if (r.status !== "route") continue;
      for (let i = 1; i < r.nodes.length; i++) {
        const a = nodes.get(r.nodes[i - 1]), b = nodes.get(r.nodes[i]);
        if (a.level !== li || b.level !== li) continue;
        const [x1, y1] = P(a), [x2, y2] = P(b);
        out.push(`<line x1="${x1 + off}" y1="${y1 + off}" x2="${x2 + off}" y2="${y2 + off}" stroke="${color}" stroke-width="4" stroke-linecap="round" opacity="0.85"/>`);
      }
    }
    for (const n of nodes.values()) {
      if (n.level !== li) continue;
      const [x, y] = P(n);
      const changes = map.edges
        .filter((e) => (e.from === n.id || e.to === n.id) && nodes.get(e.from).level !== nodes.get(e.to).level)
        .map((e) => e.kind);
      out.push(`<circle cx="${x}" cy="${y}" r="${n.kind === "junction" ? 4 : 7}" fill="${KIND_COLOR[n.kind] ?? "#495057"}"/>`);
      const label = (n.code || n.label || n.id) + (changes.length ? ` ↕ ${[...new Set(changes)].join("/")}` : "");
      if (n.kind !== "junction" || changes.length) out.push(`<text x="${x + 9}" y="${y - 8}" font-size="12" fill="#212529">${esc(label)}</text>`);
    }
  });
  let ly = panelH + 22;
  const legend = routes.map(({ name, color, r }) =>
    r.status === "route"
      ? `<tspan fill="${color}" font-weight="600">${name}</tspan>: ${r.nodes.map((id) => esc(nodes.get(id).code || nodes.get(id).label || id)).join(" → ")} (${Math.round(r.length)} m)`
      : `<tspan fill="${color}" font-weight="600">${name}</tspan>: no route`);
  for (const l of legend) { out.push(`<text x="20" y="${ly}" font-size="13">${l}</text>`); ly += 20; }
  out.push(`<text x="20" y="${ly}" font-size="11" fill="#868e96">Edges: solid walk · dashed ramp · dotted stairs · dash-dot escalator · fine dots lift · red = closed. ↕ = connects to another level.</text>`);
  out.push(`</svg>`);
  return out.join("\n");
}

async function main() {
  const local = process.argv.includes("--local");
  mkdirSync(path.join(OUT, "downloaded"), { recursive: true });
  const cards = [];
  for (const m of mapIndex()) {
    const builtIn = readFileSync(path.join(ROOT, "src/core/data", m.file), "utf8");
    let text = builtIn, source = "src/core/data (local)";
    if (!local) {
      const res = await fetch(ONLINE_BASE + m.file);
      if (!res.ok) throw new Error(ONLINE_BASE + m.file + " -> " + res.status);
      text = await res.text();
      writeFileSync(path.join(OUT, "downloaded", m.file), text);
      source = `downloaded from gist (${text === builtIn ? "identical to" : "DIFFERS from"} src/core/data)`;
    }
    const parsed = parseMap(text);
    if (!parsed.ok) throw new Error(m.file + ": " + parsed.error);
    writeFileSync(path.join(OUT, m.key + ".svg"), drawMap(parsed.map));
    console.log(`${m.key.padEnd(9)} ${m.file.padEnd(14)} ${source} -> devpost/maps/${m.key}.svg`);
    cards.push(`<section><h2>${esc(parsed.map.name)} <small>${esc(m.file)} · ${esc(source)}</small></h2><img src="${m.key}.svg" alt="${esc(parsed.map.name)}"></section>`);
  }
  writeFileSync(path.join(OUT, "index.html"), `<!doctype html><meta charset="utf-8"><title>Find Your Way maps</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;margin:24px;background:#f1f3f5}section{background:#fff;padding:16px;margin-bottom:24px;border-radius:10px}img{max-width:100%}small{color:#868e96;font-weight:400;font-size:13px}</style>
<h1>Find Your Way maps</h1><p>Blue = Walk route, green = Step-Free route, from the start sign to the destination.</p>
${cards.join("\n")}`);
  console.log("Open devpost/maps/index.html to see all maps.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
