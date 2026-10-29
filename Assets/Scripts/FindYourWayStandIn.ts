// FindYourWayStandIn — builds the stand-in building from the map at load: light translucent
// floor slabs per level, low perimeter walls, inclined escalator / stairs / ramp slabs, lift
// shafts with doors, and a red plate where a "connection closed" sign hangs. A new map gives
// a new building with no code change. Must not: route or draw the line.
// Positions arrive as building-local cm through the `toLocal` callback.

import {MapData, MapNode, findNode} from "./FindYourWayRouter"
import {approachDir, PlaceInfo} from "./FindYourWayMapLibrary"

type ToLocal = (x: number, y: number, z: number) => vec3

@component
export class FindYourWayStandIn extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Stand-in building – box model generated from the map</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Unlit material to clone for every part (blend/depth set in code)")
  material: Material
  @ui.group_end
  @ui.separator
  @ui.group_start("Settings")
  @input("vec4", "{0.92,0.95,1,0.10}")
  @hint("Floor slab colour (light, translucent so the blue line stands out)")
  @widget(new ColorWidget())
  floorColor: vec4 = new vec4(0.92, 0.95, 1, 0.1)

  @input("vec4", "{0.85,0.9,1,0.07}")
  @hint("Wall colour")
  @widget(new ColorWidget())
  wallColor: vec4 = new vec4(0.85, 0.9, 1, 0.07)

  @input("vec4", "{0.8,0.88,1,0.32}")
  @hint("Escalator / stairs / ramp colour")
  @widget(new ColorWidget())
  connectorColor: vec4 = new vec4(0.8, 0.88, 1, 0.32)

  @input("vec4", "{0.9,0.94,1,0.22}")
  @hint("Lift shaft colour")
  @widget(new ColorWidget())
  liftColor: vec4 = new vec4(0.9, 0.94, 1, 0.22)

  @input("vec4", "{0.75,1,0.82,0.08}")
  @hint("Outdoor ground colour (maps with buildings, e.g. a campus)")
  @widget(new ColorWidget())
  groundColor: vec4 = new vec4(0.75, 1, 0.82, 0.08)

  @input("vec4", "{1,0.95,0.85,0.22}")
  @hint("Outdoor path colour")
  @widget(new ColorWidget())
  pathColor: vec4 = new vec4(1, 0.95, 0.85, 0.22)

  @input
  @hint("Wall height, m")
  @widget(new SliderWidget(1, 6, 0.5))
  wallHeightM: number = 3
  @ui.group_end

  private model: SceneObject | null = null
  private closedPlates: {[edgeId: string]: RenderMeshVisual} = {}

  clear(): void {
    if (this.model) this.model.destroy()
    this.model = null
    this.closedPlates = {}
  }

  build(map: MapData, place: PlaceInfo, toLocal: ToLocal): void {
    this.clear()
    this.model = global.scene.createSceneObject("Model")
    this.model.setParent(this.sceneObject)
    if (!place.standInModel) return

    const floors = new Boxes()
    const walls = new Boxes()
    const connectors = new Boxes()
    const lifts = new Boxes()

    const ground = new Boxes()
    const paths = new Boxes()
    const lowest = Math.min.apply(null, place.levels.map((l) => l.y))
    const h = this.wallHeightM * 100
    const addWalls = (a: vec3, b: vec3): void => {
      const c = a.add(b).uniformScale(0.5)
      const w = Math.abs(b.x - a.x), d = Math.abs(b.z - a.z)
      walls.box(new vec3(c.x, a.y + h / 2, a.z), new vec3(w, h, 8))
      walls.box(new vec3(c.x, a.y + h / 2, b.z), new vec3(w, h, 8))
      walls.box(new vec3(a.x, a.y + h / 2, c.z), new vec3(8, h, d))
      walls.box(new vec3(b.x, a.y + h / 2, c.z), new vec3(8, h, d))
    }
    if (place.buildings.length > 0) {
      // Campus-style: outdoor ground over the whole footprint, then each building's floors + walls.
      if (place.footprint) {
        const a = toLocal(place.footprint.minX, lowest, place.footprint.minZ)
        const b = toLocal(place.footprint.maxX, lowest, place.footprint.maxZ)
        const c = a.add(b).uniformScale(0.5)
        ground.box(new vec3(c.x, c.y - 8, c.z), new vec3(Math.abs(b.x - a.x), 10, Math.abs(b.z - a.z)))
      }
      for (const bd of place.buildings) {
        const base = Math.min.apply(null, bd.levels)
        for (const y of bd.levels) {
          const a = toLocal(bd.minX, y, bd.minZ), b = toLocal(bd.maxX, y, bd.maxZ)
          const c = a.add(b).uniformScale(0.5)
          floors.box(new vec3(c.x, c.y - 5, c.z), new vec3(Math.abs(b.x - a.x), 10, Math.abs(b.z - a.z)))
          if (y === base) addWalls(a, b)
        }
      }
    }
    // Outdoor paths (edges marked "outdoor": true) as paving strips.
    for (const e of map.edges) {
      if (!(e as any).outdoor) continue
      const f = findNode(map, e.from), t = findNode(map, e.to)
      if (!f || !t) continue
      paths.slab(toLocal(f.x, f.y, f.z).add(new vec3(0, -3, 0)), toLocal(t.x, t.y, t.z).add(new vec3(0, -3, 0)), 250, 2)
    }

    // Floor slab per level: footprint for the lowest level, node bounds (+3 m) for the others.
    for (const level of (place.buildings.length > 0 ? [] : place.levels)) {
      const ns = map.nodes.filter((n) => Math.abs(n.y - level.y) < 0.01)
      if (ns.length === 0) continue
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
      for (const n of ns) {
        minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x)
        minZ = Math.min(minZ, n.z); maxZ = Math.max(maxZ, n.z)
      }
      if (level.y === lowest && place.footprint) {
        minX = place.footprint.minX; maxX = place.footprint.maxX
        minZ = place.footprint.minZ; maxZ = place.footprint.maxZ
      } else {
        minX -= 3; maxX += 3; minZ -= 3; maxZ += 3
      }
      const a = toLocal(minX, level.y, minZ), b = toLocal(maxX, level.y, maxZ)
      const c = a.add(b).uniformScale(0.5)
      floors.box(new vec3(c.x, c.y - 6, c.z), new vec3(Math.abs(b.x - a.x), 10, Math.abs(b.z - a.z)))
      if (level.y === lowest && place.footprint) addWalls(a, b)
    }

    for (const e of map.edges) {
      const f = findNode(map, e.from) as MapNode
      const t = findNode(map, e.to) as MapNode
      const pf = toLocal(f.x, f.y, f.z), pt = toLocal(t.x, t.y, t.z)
      if (e.kind === "escalator" || e.kind === "stairs" || e.kind === "ramp") {
        const width = e.kind === "escalator" ? 120 : e.kind === "stairs" ? 180 : 160
        connectors.slab(pf.add(new vec3(0, -4, 0)), pt.add(new vec3(0, -4, 0)), width, 8)
        if (e.kind === "stairs") {
          // a few step edges so stairs read as stairs
          const steps = 8
          for (let k = 1; k < steps; k++) {
            const q = vec3.lerp(pf, pt, k / steps)
            connectors.slab(q.add(new vec3(0, 0, 0)), vec3.lerp(pf, pt, (k + 0.15) / steps), width, 3)
          }
        }
      } else if (e.kind === "lift") {
        const loNode = f.y < t.y ? f : t
        const lo = f.y < t.y ? pf : pt, hi = f.y < t.y ? pt : pf
        const h = hi.y - lo.y + 300
        // Open the shaft toward the corridor it is entered from (local x, -z of the map dir).
        const ad = approachDir(map, loNode.id)
        const fwd = new vec3(ad.x, 0, -ad.z)
        const side = new vec3(-fwd.z, 0, fwd.x)
        const up = new vec3(0, h / 2, 0)
        const base = new vec3(lo.x, lo.y + h / 2, lo.z)
        lifts.boxAxes(base.sub(fwd.uniformScale(140)), side.uniformScale(110), up, fwd.uniformScale(10)) // back wall
        lifts.boxAxes(base.add(side.uniformScale(110)).sub(fwd.uniformScale(40)), side.uniformScale(10), up, fwd.uniformScale(100))
        lifts.boxAxes(base.sub(side.uniformScale(110)).sub(fwd.uniformScale(40)), side.uniformScale(10), up, fwd.uniformScale(100))
      }
    }

    this.addMesh("Ground", ground, this.groundColor)
    this.addMesh("Paths", paths, this.pathColor)
    this.addMesh("Floors", floors, this.floorColor)
    this.addMesh("Walls", walls, this.wallColor)
    this.addMesh("Connectors", connectors, this.connectorColor)
    this.addMesh("Lifts", lifts, this.liftColor)

    // Red plate behind each "connection closed" sign (the sign itself is a UIKit button).
    for (const ev of place.events) {
      if (ev.type !== "connectionClosed" || !ev.at || !ev.edge) continue
      const n = findNode(map, ev.at)
      if (!n) continue
      const p = toLocal(n.x, n.y, n.z)
      const ad = approachDir(map, ev.at)
      const fwd = new vec3(ad.x, 0, -ad.z)
      const side = new vec3(-fwd.z, 0, fwd.x)
      const plate = new Boxes()
      // on one side wall of the shaft, by the opening
      plate.boxAxes(p.sub(side.uniformScale(98)).add(fwd.uniformScale(20)).add(new vec3(0, 120, 0)),
        fwd.uniformScale(40), new vec3(0, 30, 0), side.uniformScale(2))
      this.closedPlates[ev.edge] = this.addMesh("ClosurePlate_" + ev.edge, plate, new vec4(0.95, 0.25, 0.25, 0.85))
    }
  }

  // Dims the red plate to show the connection is now closed.
  setConnectionClosed(edgeId: string): void {
    const r = this.closedPlates[edgeId]
    if (r) r.mainMaterial.mainPass.baseColor = new vec4(1, 0.15, 0.15, 1)
  }

  private addMesh(name: string, boxes: Boxes, color: vec4): RenderMeshVisual {
    const so = global.scene.createSceneObject(name)
    so.setParent(this.model)
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    const m = this.material.clone()
    m.mainPass.baseTex = whiteTexture()
    m.mainPass.baseColor = color
    m.mainPass.blendMode = BlendMode.Normal
    m.mainPass.depthWrite = false
    m.mainPass.twoSided = true
    rmv.mainMaterial = m
    if (boxes.count() > 0) rmv.mesh = boxes.mesh()
    return rmv
  }
}

let WHITE: Texture | null = null
// The Unlit material samples baseTex; give it plain white so baseColor alone sets the colour.
export function whiteTexture(): Texture {
  if (WHITE) return WHITE
  const tex = ProceduralTextureProvider.createWithFormat(2, 2, TextureFormat.RGBA8Unorm)
  const d = new Uint8Array(16)
  for (let i = 0; i < 16; i++) d[i] = 255
  ;(tex.control as ProceduralTextureProvider).setPixels(0, 0, 2, 2, d)
  WHITE = tex
  return tex
}

// Accumulates oriented boxes into one mesh.
class Boxes {
  private v: number[] = []
  private i: number[] = []
  private n = 0

  count(): number { return this.n }

  box(center: vec3, size: vec3): void {
    this.oriented(center, new vec3(size.x / 2, 0, 0), new vec3(0, size.y / 2, 0), new vec3(0, 0, size.z / 2))
  }

  // Inclined slab from a to b (centre line), `width` across, `thick` thick.
  slab(a: vec3, b: vec3, width: number, thick: number): void {
    const d = b.sub(a)
    const len = d.length
    if (len < 1) return
    const fwd = d.uniformScale(1 / len)
    let side = new vec3(fwd.z, 0, -fwd.x)
    side = side.length > 1e-4 ? side.normalize() : new vec3(1, 0, 0)
    const up = side.cross(fwd).normalize()
    this.oriented(a.add(b).uniformScale(0.5), fwd.uniformScale(len / 2), up.uniformScale(thick / 2),
      side.uniformScale(width / 2))
  }

  // Box from a centre and three half-extent axis vectors.
  boxAxes(c: vec3, ax: vec3, ay: vec3, az: vec3): void {
    this.oriented(c, ax, ay, az)
  }

  private oriented(c: vec3, ax: vec3, ay: vec3, az: vec3): void {
    const corners: vec3[] = []
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      corners.push(c.add(ax.uniformScale(sx)).add(ay.uniformScale(sy)).add(az.uniformScale(sz)))
    }
    // corner index = (sx>0)*4 + (sy>0)*2 + (sz>0)
    const faces = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]
    for (const f of faces) {
      const base = this.n * 0 + this.v.length / 8
      for (const k of f) {
        const p = corners[k]
        this.v.push(p.x, p.y, p.z, 0, 1, 0, 0, 0)
      }
      this.i.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
    this.n++
  }

  mesh(): RenderMesh {
    const mb = new MeshBuilder([
      {name: "position", components: 3},
      {name: "normal", components: 3},
      {name: "texture0", components: 2},
    ])
    mb.topology = MeshTopology.Triangles
    mb.indexType = MeshIndexType.UInt16
    mb.appendVerticesInterleaved(this.v)
    mb.appendIndices(this.i)
    mb.updateMesh()
    return mb.getMesh()
  }
}
