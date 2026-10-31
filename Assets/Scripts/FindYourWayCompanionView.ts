// FindYourWayCompanionView — draws the companion feature inside the building (building-local cm):
// the companion model (dog / robot / rover: simple light primitives, slightly see-through for
// the additive display), its collectibles, the floor-change post where the line leaves the
// floor, the Hop lane with its obstacles, and the thrown treat for catch.
// Created at runtime by FindYourWayMain (child of the building) and set up with the stand-in's
// Unlit material. Must not: decide where the companion goes (FindYourWayPet / FindYourWayPlay do).

import {Boxes, whiteTexture} from "./FindYourWayStandIn"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractableManipulation} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"

// A Hop obstacle: d metres ahead of the companion, h metres high.
const GRAB_TARGET_CM = 16 // bigger than the treat, so it is easy to pinch

export interface HopObstacleLike {
  d: number
  h: number
}

// One coloured part of a model: boxes as [centre x, y, z, size x, y, z] in cm, facing -Z.
interface Part {
  color: vec4
  boxes: number[][]
}

const WARM = new vec4(1, 0.82, 0.55, 0.85)
const DARK = new vec4(0.55, 0.45, 0.35, 0.85)
const STEEL = new vec4(0.82, 0.88, 1, 0.85)
const CYAN = new vec4(0.4, 1, 1, 0.95)
const SAND = new vec4(1, 0.9, 0.6, 0.85)
const TYRE = new vec4(0.5, 0.52, 0.6, 0.85)

const MODELS: {[id: string]: Part[]} = {
  dog: [
    {color: WARM, boxes: [
      [0, 25, 0, 18, 16, 40], [0, 40, -24, 16, 14, 16], [0, 36, -34, 8, 7, 8],
      [-6, 9, -14, 5, 18, 5], [6, 9, -14, 5, 18, 5], [-6, 9, 14, 5, 18, 5], [6, 9, 14, 5, 18, 5],
      [0, 34, 24, 4, 4, 12],
    ]},
    {color: DARK, boxes: [[-6, 49, -22, 4, 8, 4], [6, 49, -22, 4, 8, 4], [0, 37, -38.5, 3, 3, 1]]},
  ],
  robot: [
    {color: STEEL, boxes: [
      [0, 40, 0, 22, 26, 16], [0, 62, 0, 16, 14, 14], [-6, 14, 0, 6, 28, 8], [6, 14, 0, 6, 28, 8],
      [-14, 42, 0, 4, 20, 4], [14, 42, 0, 4, 20, 4],
    ]},
    {color: CYAN, boxes: [[-4, 63, -7.5, 3, 3, 1], [4, 63, -7.5, 3, 3, 1]]},
  ],
  rover: [
    {color: SAND, boxes: [[0, 14, 0, 26, 8, 36], [0, 30, -10, 3, 24, 3], [0, 44, -12, 10, 7, 7]]},
    {color: TYRE, boxes: [
      [-15, 8, -12, 5, 14, 14], [15, 8, -12, 5, 14, 14], [-15, 8, 0, 5, 14, 14], [15, 8, 0, 5, 14, 14],
      [-15, 8, 12, 5, 14, 14], [15, 8, 12, 5, 14, 14],
    ]},
    {color: CYAN, boxes: [[0, 44, -16, 5, 4, 1]]},
  ],
}

// What each companion collects / plays with: a small floating shape and its colour.
const COLLECTIBLE_COLOR: {[id: string]: vec4} = {
  dog: new vec4(1, 0.75, 0.45, 0.95),
  robot: new vec4(0.75, 0.85, 1, 0.95),
  rover: new vec4(1, 0.95, 0.4, 0.95),
}

const COLLECTIBLE_CM = 12
const COLLECTIBLE_HEIGHT_CM = 45
const POST_HEIGHT_CM = 160
const LANE_WIDTH_CM = 60
const OBSTACLE_DEPTH_CM = 30
const SHAKE_CM = 4
// While it points: a thin bar from its chest, forward.
const POINTER_HEIGHT_CM = 55
const POINTER_LENGTH_CM = 110

@component
export class FindYourWayCompanionView extends BaseScriptComponent {
  private material: Material | null = null
  private prefabs: {[id: string]: ObjectPrefab} = {}
  private modelId = ""
  private model: SceneObject | null = null
  private collectibles: SceneObject[] = []
  private collectibleMesh: RenderMesh | null = null
  private post: SceneObject | null = null
  private lane: SceneObject | null = null
  private obstacles: SceneObject[] = []
  private treat: SceneObject | null = null
  private grab: SceneObject | null = null
  private grabHandling: InteractableManipulation | null = null
  private pointer: SceneObject | null = null
  private spin = 0
  private shown = false

  // Call once after createComponent: the Unlit material to clone for every part, and the 3D models
  // by companion id. A companion with no model is built from boxes.
  setup(material: Material, prefabs: {[id: string]: ObjectPrefab} = {}): void {
    this.material = material
    this.prefabs = prefabs
    const one = new Boxes()
    one.box(new vec3(0, 0, 0), new vec3(COLLECTIBLE_CM, COLLECTIBLE_CM, COLLECTIBLE_CM))
    this.collectibleMesh = one.mesh()
    this.post = this.makeObject("FloorPost", [{color: new vec4(0.4, 0.75, 1, 0.6), boxes: [
      [0, POST_HEIGHT_CM / 2, 0, 6, POST_HEIGHT_CM, 6], [0, POST_HEIGHT_CM + 8, 0, 24, 6, 6],
    ]}])
    this.post.enabled = false
    this.lane = this.makeObject("HopLane", [{color: new vec4(0.6, 0.85, 1, 0.25), boxes: [
      [0, 0.5, -300, LANE_WIDTH_CM, 1, 600],
    ]}])
    this.lane.enabled = false
    this.treat = this.makeObject("Treat", [{color: COLLECTIBLE_COLOR.dog, boxes: [[0, 0, 0, 8, 8, 8]]}])
    this.treat.enabled = false
    this.grab = this.makeObject("GrabTreat", [{color: COLLECTIBLE_COLOR.dog, boxes: [[0, 0, 0, 7, 7, 7]]}])
    const collider = this.grab.createComponent("Physics.ColliderComponent") as ColliderComponent
    const box = Shape.createBoxShape()
    box.size = new vec3(GRAB_TARGET_CM, GRAB_TARGET_CM, GRAB_TARGET_CM)
    collider.shape = box
    collider.fitVisual = false
    this.grab.createComponent(Interactable.getTypeName())
    this.grabHandling = this.grab.createComponent(InteractableManipulation.getTypeName()) as InteractableManipulation
    this.grabHandling.setCanRotate(false)
    this.grabHandling.setCanScale(false)
    this.grab.enabled = false
    this.pointer = this.makeObject("Pointer", [{color: CYAN, boxes: [
      [0, POINTER_HEIGHT_CM, -POINTER_LENGTH_CM / 2, 3, 3, POINTER_LENGTH_CM],
      [0, POINTER_HEIGHT_CM, -POINTER_LENGTH_CM, 9, 9, 9],
    ]}])
    this.pointer.enabled = false
    this.setModel("dog")
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  // Swap the model (same logic, only the look changes). Unknown ids get the dog.
  setModel(id: string): void {
    const key = MODELS[id] ? id : "dog"
    if (key === this.modelId) return
    this.modelId = key
    if (this.model) this.model.destroy()
    this.model = this.prefabs[key] ? this.makeModel("Companion_" + key, this.prefabs[key]) : this.makeObject("Companion_" + key, MODELS[key])
    this.model.enabled = this.shown
    if (this.treat) this.recolor(this.treat, COLLECTIBLE_COLOR[key])
    for (const c of this.collectibles) this.recolor(c, COLLECTIBLE_COLOR[key])
  }

  getModel(): string { return this.modelId }

  setVisible(on: boolean): void {
    this.shown = on
    if (this.model) this.model.enabled = on
    if (!on) {
      for (const c of this.collectibles) c.enabled = false
      this.setPointing(false)
    }
  }

  // The pointer bar: it follows the model's pose while on.
  setPointing(on: boolean): void {
    if (this.pointer) this.pointer.enabled = on && this.shown
  }

  isPointing(): boolean { return !!this.pointer && this.pointer.enabled }

  isVisible(): boolean { return this.shown && !!this.model && this.model.enabled }

  // pos: building-local cm on the floor; headingDeg: clockwise from map north;
  // liftCm: jump height; shake: 0..1 sideways wobble; sit: lower and still.
  setPose(pos: vec3, headingDeg: number, liftCm: number = 0, shake: number = 0, sit: boolean = false): void {
    if (!this.model) return
    const t = this.model.getTransform()
    const rot = quat.angleAxis((-headingDeg * Math.PI) / 180, vec3.up())
    const side = rot.multiplyVec3(new vec3(1, 0, 0)).uniformScale(Math.sin(getTime() * 40) * SHAKE_CM * shake)
    t.setLocalPosition(pos.add(new vec3(0, liftCm, 0)).add(side))
    t.setLocalRotation(rot)
    t.setLocalScale(new vec3(1, sit ? 0.82 : 1, 1))
    if (this.pointer && this.pointer.enabled) {
      this.pointer.getTransform().setLocalPosition(pos)
      this.pointer.getTransform().setLocalRotation(rot)
    }
  }

  getPose(): vec3 | null { return this.model ? this.model.getTransform().getLocalPosition() : null }

  // Collectibles at building-local cm floor spots; got[i] hides spot i.
  setCollectibles(spots: vec3[], got: boolean[]): void {
    while (this.collectibles.length < spots.length) {
      const so = global.scene.createSceneObject("Collectible" + this.collectibles.length)
      so.setParent(this.sceneObject)
      const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      rmv.mesh = this.collectibleMesh
      rmv.mainMaterial = this.makeMaterial(COLLECTIBLE_COLOR[this.modelId] || COLLECTIBLE_COLOR.dog)
      this.collectibles.push(so)
    }
    for (let i = 0; i < this.collectibles.length; i++) {
      const so = this.collectibles[i]
      const on = this.shown && i < spots.length && !got[i]
      so.enabled = on
      if (on) so.getTransform().setLocalPosition(spots[i].add(new vec3(0, COLLECTIBLE_HEIGHT_CM, 0)))
    }
  }

  visibleCollectibles(): number {
    return this.collectibles.filter((c) => c.enabled).length
  }

  // The up/down post where the line leaves the floor; null hides it.
  setPost(pos: vec3 | null, up: boolean): void {
    if (!this.post) return
    this.post.enabled = pos !== null
    if (!pos) return
    this.post.getTransform().setLocalPosition(pos)
    // The bar on top tilts up or down the way the floor change goes.
    this.post.getTransform().setLocalRotation(quat.angleAxis(up ? 0 : Math.PI, vec3.forward()).multiply(quat.quatIdentity()))
    if (!up) this.post.getTransform().setLocalPosition(pos.add(new vec3(0, POST_HEIGHT_CM + 8, 0)))
  }

  isPostShown(): boolean { return !!this.post && this.post.enabled }

  // The Hop lane: from `origin` (the companion's spot) away from the user along headingDeg;
  // obstacles at d metres ahead with height h metres. null hides it.
  setLane(origin: vec3 | null, headingDeg: number, obstacles: HopObstacleLike[], laneM: number = 6): void {
    if (!this.lane) return
    this.lane.getTransform().setLocalScale(new vec3(1, 1, laneM / 6))
    this.lane.enabled = origin !== null
    if (!origin) {
      for (const o of this.obstacles) o.enabled = false
      return
    }
    const rot = quat.angleAxis((-headingDeg * Math.PI) / 180, vec3.up())
    this.lane.getTransform().setLocalPosition(origin)
    this.lane.getTransform().setLocalRotation(rot)
    while (this.obstacles.length < obstacles.length) {
      const o = this.makeObject("Obstacle" + this.obstacles.length, [{color: new vec4(1, 0.55, 0.45, 0.8),
        boxes: [[0, 50, 0, LANE_WIDTH_CM - 10, 100, OBSTACLE_DEPTH_CM]]}])
      this.obstacles.push(o)
    }
    const fwd = rot.multiplyVec3(new vec3(0, 0, -1))
    for (let i = 0; i < this.obstacles.length; i++) {
      const so = this.obstacles[i]
      so.enabled = i < obstacles.length
      if (!so.enabled) continue
      const ob = obstacles[i]
      so.getTransform().setLocalPosition(origin.add(fwd.uniformScale(ob.d * 100)))
      so.getTransform().setLocalRotation(rot)
      // The mesh is 100 cm tall: scale it to the obstacle's height.
      so.getTransform().setLocalScale(new vec3(1, Math.max(0.05, ob.h), 1))
    }
  }

  // The treat you grab and throw by hand (Specs: pinch it near your hand), or null to hide it.
  setGrab(worldPos: vec3 | null): void {
    if (!this.grab) return
    this.grab.enabled = worldPos !== null
    if (worldPos) this.grab.getTransform().setWorldPosition(worldPos)
  }

  onGrab(started: () => void, ended: () => void): void {
    if (!this.grabHandling) return
    this.grabHandling.onManipulationStart.add(started)
    this.grabHandling.onManipulationEnd.add(ended)
  }

  getGrabWorldPos(): vec3 | null { return this.grab ? this.grab.getTransform().getWorldPosition() : null }
  isGrabShown(): boolean { return !!this.grab && this.grab.enabled }

  isLaneShown(): boolean { return !!this.lane && this.lane.enabled }
  laneObstacleCount(): number { return this.obstacles.filter((o) => o.enabled).length }

  // The thrown treat (for catch), or null.
  setTreat(pos: vec3 | null): void {
    if (!this.treat) return
    this.treat.enabled = pos !== null
    if (pos) this.treat.getTransform().setLocalPosition(pos.add(new vec3(0, 8, 0)))
  }

  private tick(): void {
    this.spin += getDeltaTime() * 2
    const r = quat.angleAxis(this.spin, vec3.up()).multiply(quat.angleAxis(Math.PI / 4, new vec3(1, 0, 1).normalize()))
    for (const c of this.collectibles) if (c.enabled) c.getTransform().setLocalRotation(r)
    if (this.treat && this.treat.enabled) this.treat.getTransform().setLocalRotation(r)
  }

  // A wrapper keeps the model's own import scale away from the transforms set each frame.
  private makeModel(name: string, prefab: ObjectPrefab): SceneObject {
    const root = global.scene.createSceneObject(name)
    root.setParent(this.sceneObject)
    prefab.instantiate(root)
    return root
  }

  private makeObject(name: string, parts: Part[]): SceneObject {
    const root = global.scene.createSceneObject(name)
    root.setParent(this.sceneObject)
    for (let i = 0; i < parts.length; i++) {
      const b = new Boxes()
      for (const x of parts[i].boxes) b.box(new vec3(x[0], x[1], x[2]), new vec3(x[3], x[4], x[5]))
      const so = global.scene.createSceneObject(name + "_part" + i)
      so.setParent(root)
      const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      rmv.mesh = b.mesh()
      rmv.mainMaterial = this.makeMaterial(parts[i].color)
    }
    return root
  }

  private recolor(root: SceneObject, color: vec4): void {
    const all = [root]
    for (let i = 0; i < root.getChildrenCount(); i++) all.push(root.getChild(i))
    for (const so of all) {
      const rmv = so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
      if (rmv && rmv.mainMaterial) rmv.mainMaterial.mainPass.baseColor = color
    }
  }

  private makeMaterial(color: vec4): Material {
    const m = (this.material as Material).clone()
    m.mainPass.baseTex = whiteTexture()
    m.mainPass.baseColor = color
    m.mainPass.blendMode = BlendMode.Normal
    m.mainPass.depthWrite = false
    m.mainPass.twoSided = true
    return m
  }
}
