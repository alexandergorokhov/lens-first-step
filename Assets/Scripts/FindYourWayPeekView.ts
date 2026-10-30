// FindYourWayPeekView — peek ahead: a small model of the route (~40 cm) at waist height ~60 cm
// ahead: the walked part faint, the rest glowing, a dot for you, a faint floor plate. Built from
// FindYourWayPeek's peekModel (model metres). Created at runtime by FindYourWayMain, which places
// it in front of the head. Must not: change the route.

import {Boxes, whiteTexture} from "./FindYourWayStandIn"
import {PeekMapModel, PeekModel} from "./FindYourWayPeek"

const LINE_CM = 0.8
const DOT_CM = 2.2

@component
export class FindYourWayPeekView extends BaseScriptComponent {
  private material: Material | null = null
  private parts: SceneObject[] = []

  setup(material: Material): void {
    this.material = material
    this.sceneObject.enabled = false
  }

  // Shows the model (null hides it).
  show(model: PeekModel | null): void {
    for (const p of this.parts) p.destroy()
    this.parts = []
    this.sceneObject.enabled = model !== null
    if (!model) return
    // Model metres -> cm, north (map +z) away from you (-Z).
    const cm = (p: {x: number; y: number; z: number}) => new vec3(p.x * 100, p.y * 100, -p.z * 100)
    const done = new Boxes()
    const ahead = new Boxes()
    for (let i = 0; i < model.route.length - 1; i++) {
      const target = i + 1 <= model.done ? done : ahead
      target.slab(cm(model.route[i]), cm(model.route[i + 1]), LINE_CM, LINE_CM)
    }
    const you = new Boxes()
    you.box(cm(model.you), new vec3(DOT_CM, DOT_CM, DOT_CM))
    const plate = new Boxes()
    plate.box(new vec3(0, -21, 0), new vec3(44, 0.4, 44))
    this.add("PeekPlate", plate, new vec4(0.85, 0.9, 1, 0.12))
    this.add("PeekDone", done, new vec4(0.6, 0.75, 1, 0.3))
    this.add("PeekAhead", ahead, new vec4(0.3, 0.6, 1, 0.95))
    this.add("PeekYou", you, new vec4(1, 1, 1, 1))
  }

  // "See my map": the whole walked map, every stretch, a dot per shop and one for you (null hides).
  showMap(model: PeekMapModel | null): void {
    for (const p of this.parts) p.destroy()
    this.parts = []
    this.sceneObject.enabled = model !== null
    if (!model) return
    const cm = (p: {x: number; y: number; z: number}) => new vec3(p.x * 100, p.y * 100, -p.z * 100)
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
    this.parts.push(so)
  }
}
