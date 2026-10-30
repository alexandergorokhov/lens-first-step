// FindYourWayStandIn — builds the stand-in building from the map at load: light translucent
// floor slabs per level, low perimeter walls, inclined escalator / stairs / ramp slabs, lift
// shafts with doors, and a red plate where a "connection closed" sign hangs. A new map gives
// a new building with no code change. In Lens Studio only, the same parts turn solid and a backdrop
// (shell, tiles, lights, shop fronts) hides the preview room, so the place can be walked through;
// on Specs the display only adds light, so it stays see-through. Must not: route or draw the line.
// Positions arrive as building-local cm through the `toLocal` callback.

import {MapData, MapNode, findNode} from "./FindYourWayRouter"
import {approachDir, PlaceInfo} from "./FindYourWayMapLibrary"

type ToLocal = (x: number, y: number, z: number) => vec3

const BACKDROP_MARGIN_M = 4
const TILE_M = 2
const LIGHT_GAP_M = 8
const TILE_LIFT = new vec3(0, -0.8, 0) // just under the line, on the floor slab
const SHOP_COLORS = [new vec4(0.2, 0.42, 0.62, 1), new vec4(0.72, 0.42, 0.22, 1), new vec4(0.24, 0.52, 0.42, 1),
  new vec4(0.56, 0.3, 0.46, 1), new vec4(0.76, 0.62, 0.28, 1)]

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

  @input
  @hint("In Lens Studio only: solid building you can walk through, hiding the preview room. Never on Specs.")
  previewBackdrop: boolean = true
  @ui.group_end

  private model: SceneObject | null = null
  private solid = false
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
    this.solid = false
    if (!place.standInModel) return
    this.solid = this.previewBackdrop && global.deviceInfoSystem.isEditor()

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
      if (!e.outdoor) continue
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

    this.addMesh("Ground", ground, this.groundColor, new vec4(0.55, 0.68, 0.5, 1))
    this.addMesh("Paths", paths, this.pathColor, new vec4(0.8, 0.77, 0.7, 1))
    this.addMesh("Floors", floors, this.floorColor, new vec4(0.5, 0.53, 0.56, 1))
    this.addMesh("Walls", walls, this.wallColor, new vec4(0.44, 0.47, 0.5, 1))
    this.addMesh("Connectors", connectors, this.connectorColor, new vec4(0.5, 0.55, 0.62, 1))
    this.addMesh("Lifts", lifts, this.liftColor, new vec4(0.58, 0.68, 0.76, 1))
    if (this.solid) this.addBackdrop(map, place, toLocal, lowest)

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

  // Turns the red plate fully opaque, bright red to show the connection is now closed.
  setConnectionClosed(edgeId: string): void {
    const r = this.closedPlates[edgeId]
    if (r) r.mainMaterial.mainPass.baseColor = new vec4(1, 0.15, 0.15, 1)
  }

  // Read-only state for the LEAF scenarios: is this connection's plate showing "closed"?
  isConnectionShownClosed(edgeId: string): boolean {
    const r = this.closedPlates[edgeId]
    return !!r && r.mainMaterial.mainPass.baseColor.w > 0.99
  }

  isSolid(): boolean { return this.solid }

  // Lens Studio only: a shell around the whole map (hides the preview room), floor tiles and wall
  // bands (they make walking visible on unlit surfaces), ceiling lights, and a shop front behind
  // every named place.
  private addBackdrop(map: MapData, place: PlaceInfo, toLocal: ToLocal, lowest: number): void {
    const outdoor = place.buildings.length > 0
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const n of map.nodes) {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x)
      minZ = Math.min(minZ, n.z); maxZ = Math.max(maxZ, n.z)
    }
    if (place.footprint) {
      minX = Math.min(minX, place.footprint.minX); maxX = Math.max(maxX, place.footprint.maxX)
      minZ = Math.min(minZ, place.footprint.minZ); maxZ = Math.max(maxZ, place.footprint.maxZ)
    }
    minX -= BACKDROP_MARGIN_M; maxX += BACKDROP_MARGIN_M; minZ -= BACKDROP_MARGIN_M; maxZ += BACKDROP_MARGIN_M
    const highest = Math.max.apply(null, place.levels.map((l) => l.y))
    const top = highest + this.wallHeightM + 1.5
    const a = toLocal(minX, lowest, minZ), b = toLocal(maxX, top, maxZ)
    const c = a.add(b).uniformScale(0.5)
    const w = Math.abs(b.x - a.x), d = Math.abs(b.z - a.z), h = b.y - a.y

    const shell = new Boxes()
    shell.box(new vec3(c.x, c.y, a.z), new vec3(w, h, 20))
    shell.box(new vec3(c.x, c.y, b.z), new vec3(w, h, 20))
    shell.box(new vec3(a.x, c.y, c.z), new vec3(20, h, d))
    shell.box(new vec3(b.x, c.y, c.z), new vec3(20, h, d))
    shell.box(new vec3(c.x, b.y + 10, c.z), new vec3(w, 20, d))
    this.addMesh("Shell", shell, this.wallColor, outdoor ? new vec4(0.62, 0.78, 0.93, 1) : new vec4(0.38, 0.4, 0.43, 1))
    const under = new Boxes()
    under.box(new vec3(c.x, a.y - 30, c.z), new vec3(w, 20, d))
    this.addMesh("Under", under, this.floorColor, outdoor ? new vec4(0.35, 0.48, 0.32, 1) : new vec4(0.5, 0.53, 0.56, 1))

    const tiles = new Boxes(), bands = new Boxes(), lights = new Boxes()
    if (!outdoor) {
      for (const level of place.levels) {
        const ns = map.nodes.filter((n) => Math.abs(n.y - level.y) < 0.01)
        if (ns.length === 0) continue
        const onFoot = level.y === lowest
        const x0 = onFoot ? minX : Math.min.apply(null, ns.map((n) => n.x)) - 3
        const x1 = onFoot ? maxX : Math.max.apply(null, ns.map((n) => n.x)) + 3
        const z0 = onFoot ? minZ : Math.min.apply(null, ns.map((n) => n.z)) - 3
        const z1 = onFoot ? maxZ : Math.max.apply(null, ns.map((n) => n.z)) + 3
        for (let x = x0; x <= x1; x += TILE_M) {
          tiles.slab(toLocal(x, level.y, z0).add(TILE_LIFT), toLocal(x, level.y, z1).add(TILE_LIFT), 3, 0.4)
        }
        for (let z = z0; z <= z1; z += TILE_M) {
          tiles.slab(toLocal(x0, level.y, z).add(TILE_LIFT), toLocal(x1, level.y, z).add(TILE_LIFT), 3, 0.4)
        }
        // Lights: on the top ceiling, and under each upper floor for the level below.
        const lightY = level.y === lowest ? top : level.y
        for (let x = x0 + LIGHT_GAP_M / 2; x < x1; x += LIGHT_GAP_M) {
          const q = toLocal(x, lightY, (z0 + z1) / 2)
          lights.box(new vec3(q.x, q.y - 16, q.z), new vec3(45, 4, (z1 - z0) * 80))
        }
      }
      for (const level of place.levels) {
        const y = toLocal(minX, level.y, minZ).y + 120
        bands.box(new vec3(c.x, y, a.z + (b.z > a.z ? 14 : -14)), new vec3(w - 30, 70, 4))
        bands.box(new vec3(c.x, y, b.z + (b.z > a.z ? -14 : 14)), new vec3(w - 30, 70, 4))
        bands.box(new vec3(a.x + (b.x > a.x ? 14 : -14), y, c.z), new vec3(4, 70, d - 30))
        bands.box(new vec3(b.x + (b.x > a.x ? -14 : 14), y, c.z), new vec3(4, 70, d - 30))
      }
    }
    this.addMesh("Tiles", tiles, this.floorColor, new vec4(0.36, 0.39, 0.42, 1))
    this.addMesh("Bands", bands, this.wallColor, new vec4(0.47, 0.58, 0.68, 1))
    this.addMesh("Lights", lights, this.floorColor, new vec4(0.85, 0.85, 0.8, 1))

    // A shop front behind each named place, seen as you arrive; the sign is the place's own.
    const fronts = SHOP_COLORS.map(() => new Boxes())
    const awnings = new Boxes()
    map.nodes.forEach((n, i) => {
      if (n.kind !== "place" && n.kind !== "destination") return
      const ad = approachDir(map, n.id)
      const fwd = new vec3(ad.x, 0, -ad.z)
      const side = new vec3(-fwd.z, 0, fwd.x)
      const back = toLocal(n.x, n.y, n.z).sub(fwd.uniformScale(170))
      fronts[i % fronts.length].boxAxes(back.add(new vec3(0, 140, 0)), side.uniformScale(170), new vec3(0, 140, 0), fwd.uniformScale(10))
      awnings.boxAxes(back.add(fwd.uniformScale(30)).add(new vec3(0, 285, 0)), side.uniformScale(180), new vec3(0, 12, 0), fwd.uniformScale(40))
    })
    fronts.forEach((f, i) => this.addMesh("Shops" + i, f, this.wallColor, SHOP_COLORS[i]))
    this.addMesh("Awnings", awnings, this.wallColor, new vec4(0.2, 0.28, 0.38, 1))
  }

  private addMesh(name: string, boxes: Boxes, color: vec4, solidColor?: vec4): RenderMeshVisual {
    const so = global.scene.createSceneObject(name)
    so.setParent(this.model)
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    const m = this.material.clone()
    m.mainPass.baseTex = whiteTexture()
    const solid = this.solid && !!solidColor
    m.mainPass.baseColor = solid ? solidColor : color
    m.mainPass.blendMode = solid ? BlendMode.Disabled : BlendMode.Normal
    m.mainPass.depthWrite = solid
    m.mainPass.twoSided = true
    rmv.mainMaterial = m
    // Solid parts draw first, so the line and the signs always land on top of them.
    if (solid) rmv.setRenderOrder(-20)
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

const FLOATS_PER_VERTEX = 8

// Accumulates oriented boxes into one mesh.
export class Boxes {
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
      // index of this face's first vertex (8 floats per vertex: position, normal, uv)
      const base = this.v.length / FLOATS_PER_VERTEX
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
