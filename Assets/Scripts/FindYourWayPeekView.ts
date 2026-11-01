// FindYourWayPeekView — the mini mall (~40 cm) at waist height ~60 cm ahead: every floor stacked,
// its corridors and shops, the walked part of the route faint, the rest glowing, a dot for you.
// Built from FindYourWayPeek's peekPlace (model metres). Created at runtime by FindYourWayMain,
// which places it in front of the head. Must not: change the route.

import {Boxes, whiteTexture} from "./FindYourWayStandIn"
import {PeekMapModel, PeekPlaceModel, PlaceGroup} from "./FindYourWayPeek"

const LINE_CM = 0.8
const DOT_CM = 2.2
const CORRIDOR_CM = 0.35
const SHOP_CM = 1.1
const PLATE_MARGIN_CM = 2.5
const PLATE_CM = 0.3
const HERE_ALPHA = 0.26
const OTHER_ALPHA = 0.09
const GROUP_COLORS: {[group in PlaceGroup]: vec4} = {
  food: new vec4(0.95, 0.68, 0.42, 0.95),
  fun: new vec4(0.62, 0.8, 0.5, 0.95),
  service: new vec4(0.6, 0.78, 0.92, 0.95),
  shop: new vec4(0.86, 0.8, 0.66, 0.95),
}
const FULL_SCALE = 0.007 // model metres per map metre at which the markers are full size
const OPEN_LINK = new vec4(0.75, 0.82, 0.88, 0.5)
const CLOSED_LINK = new vec4(0.86, 0.3, 0.26, 0.8)
const cmOf = (p: {x: number; y: number; z: number}) => new vec3(p.x * 100, p.y * 100, -p.z * 100)

@component
export class FindYourWayPeekView extends BaseScriptComponent {
  private material: Material | null = null
  private parts: SceneObject[] = []
  // The floors stay while only the route and your dot move.
  private floors: SceneObject[] = []
  private floorsKey = ""

  setup(material: Material): void {
    this.material = material
    this.sceneObject.enabled = false
  }

  private clear(): void {
    for (const p of this.parts) p.destroy()
    this.parts = []
  }

  private clearFloors(): void {
    for (const p of this.floors) p.destroy()
    this.floors = []
    this.floorsKey = ""
  }

  // Shows the place with your route on it (null hides it).
  showPlace(model: PeekPlaceModel | null): void {
    this.clear()
    this.sceneObject.enabled = model !== null
    if (!model) return
    const key = model.key + "|" + model.current
    if (key !== this.floorsKey) {
      this.clearFloors()
      this.floorsKey = key
      this.buildFloors(model)
    }
    // Model metres -> cm, north (map +z) away from you (-Z).
    const cm = cmOf
    const done = new Boxes()
    const ahead = new Boxes()
    for (let i = 0; i < model.route.length - 1; i++) {
      const target = i + 1 <= model.done ? done : ahead
      target.slab(cm(model.route[i]), cm(model.route[i + 1]), LINE_CM, LINE_CM)
    }
    const dot = DOT_CM * Math.min(1, model.scale / FULL_SCALE)
    const you = new Boxes()
    you.box(cm(model.you), new vec3(dot, dot, dot))
    this.add("PeekDone", done, new vec4(0.6, 0.75, 1, 0.3))
    this.add("PeekAhead", ahead, new vec4(0.3, 0.75, 0.95, 0.95))
    this.add("PeekYou", you, new vec4(1, 1, 1, 1))
    if (model.target) {
      const target = new Boxes()
      target.box(cm(model.target).add(new vec3(0, dot, 0)), new vec3(dot, dot * 2, dot))
      this.add("PeekTarget", target, new vec4(0.95, 0.42, 0.34, 1))
    }
  }

  private buildFloors(model: PeekPlaceModel): void {
    model.floors.forEach((f, i) => {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
      const seen = (p: vec3) => {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z)
      }
      const halls = new Boxes()
      for (const s of f.segments) {
        const a = cmOf(s.a), b = cmOf(s.b)
        seen(a); seen(b)
        halls.slab(a, b, CORRIDOR_CM, CORRIDOR_CM)
      }
      const groups: {[group in PlaceGroup]: Boxes} = {food: new Boxes(), fun: new Boxes(), service: new Boxes(), shop: new Boxes()}
      for (const p of f.places) {
        const at = cmOf(p.at)
        seen(at)
        groups[p.group].box(at.add(new vec3(0, SHOP_CM / 2, 0)), new vec3(SHOP_CM, SHOP_CM, SHOP_CM))
      }
      const here = i === model.current
      if (maxX >= minX) {
        const plate = new Boxes()
        plate.box(new vec3((minX + maxX) / 2, f.y * 100 - 0.5, (minZ + maxZ) / 2),
          new vec3(maxX - minX + PLATE_MARGIN_CM * 2, PLATE_CM, maxZ - minZ + PLATE_MARGIN_CM * 2))
        this.addTo(this.floors, "PeekPlate", plate, new vec4(0.82, 0.88, 0.92, here ? HERE_ALPHA : OTHER_ALPHA))
      }
      this.addTo(this.floors, "PeekHalls", halls, new vec4(0.82, 0.88, 0.92, here ? 0.6 : 0.28))
      for (const g of ["food", "fun", "service", "shop"] as PlaceGroup[]) this.addTo(this.floors, "PeekShops", groups[g], GROUP_COLORS[g])
    })
    const open = new Boxes(), shut = new Boxes()
    for (const l of model.links) (l.open ? open : shut).slab(cmOf(l.a), cmOf(l.b), CORRIDOR_CM, CORRIDOR_CM)
    this.addTo(this.floors, "PeekLinks", open, OPEN_LINK)
    this.addTo(this.floors, "PeekClosed", shut, CLOSED_LINK)
  }

  // "See my map": the whole walked map, every stretch, a dot per shop and one for you (null hides).
  showMap(model: PeekMapModel | null): void {
    this.clear()
    this.clearFloors()
    this.sceneObject.enabled = model !== null
    if (!model) return
    const cm = cmOf
    const paths = new Boxes()
    for (const s of model.segments) paths.slab(cm(s.a), cm(s.b), LINE_CM, LINE_CM)
    const shops = new Boxes()
    for (const s of model.shops) shops.box(cm(s), new vec3(DOT_CM, DOT_CM, DOT_CM))
    const you = new Boxes()
    you.box(cm(model.you), new vec3(DOT_CM, DOT_CM, DOT_CM))
    const plate = new Boxes()
    plate.box(new vec3(0, -21, 0), new vec3(44, 0.4, 44))
    this.add("PeekPlate", plate, new vec4(0.85, 0.9, 1, 0.12))
    this.add("PeekPaths", paths, new vec4(0.3, 0.6, 1, 0.95))
    this.add("PeekShops", shops, new vec4(1, 0.8, 0.4, 1))
    this.add("PeekYou", you, new vec4(1, 1, 1, 1))
  }

  isShown(): boolean { return this.sceneObject.enabled }

  private add(name: string, boxes: Boxes, color: vec4): void {
    this.addTo(this.parts, name, boxes, color)
  }

  private addTo(parts: SceneObject[], name: string, boxes: Boxes, color: vec4): void {
    if (boxes.count() === 0) return
    const so = global.scene.createSceneObject(name)
    so.setParent(this.sceneObject)
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = boxes.mesh()
    const m = (this.material as Material).clone()
    m.mainPass.baseTex = whiteTexture()
    m.mainPass.baseColor = color
    m.mainPass.blendMode = BlendMode.Normal
    m.mainPass.depthWrite = false
    m.mainPass.twoSided = true
    rmv.mainMaterial = m
    parts.push(so)
  }
}
