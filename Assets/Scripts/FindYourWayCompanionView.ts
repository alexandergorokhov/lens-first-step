// FindYourWayCompanionView — draws the companion feature inside the building (building-local cm):
// the companion model (the animated Quaternius dog and robot, CC0, when their prefabs are given;
// otherwise the jointed light primitives), a soft shadow under it, its collectibles, the floor-change post where the line leaves the
// floor, the Hop lane with its obstacles, and the thrown treat for catch.
// Created at runtime by FindYourWayMain (child of the building) and set up with the stand-in's
// Unlit material. Must not: decide where the companion goes (FindYourWayPet / FindYourWayPlay do).

import {Boxes, shadeTexture, whiteTexture} from "./FindYourWayStandIn"
import {RigMood, clipFor, poseFor, rigOf, COMPANION_ALPHA} from "./FindYourWayAnim"
import {LiveRig} from "./FindYourWayRigMesh"
import {ARROW_OPACITY} from "./FindYourWayView"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractableManipulation} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"

// A Hop obstacle: d metres ahead of the companion, h metres high.
const GRAB_TARGET_CM = 16 // bigger than the treat, so it is easy to pinch
const TELEPORT_MS = 8 // moved faster than this: a ride or a jump to a new place, not walking
const SPEED_SMOOTHING = 8

export interface HopObstacleLike {
  d: number
  h: number
}

// One coloured part of a model: boxes as [centre x, y, z, size x, y, z] in cm, facing -Z.
interface Part {
  color: vec4
  boxes: number[][]
}

const CYAN = new vec4(0.4, 1, 1, 0.95)

// What each companion collects / plays with: a small floating shape and its colour.
const COLLECTIBLE_COLOR: {[id: string]: vec4} = {
  dog: new vec4(1, 0.75, 0.45, 0.95),
  robot: new vec4(0.75, 0.85, 1, 0.95),
}

// The animated models: how tall they stand (cm), and the imported prefab's own height (cm at scale 1).
const MODEL_HEIGHT_CM: {[id: string]: number} = {dog: 50, robot: 58}
const MODEL_RAW_CM: {[id: string]: number} = {dog: 310, robot: 463}
// Bright colours for the additive display (no near-black part), by the model's material name.
const MODEL_COLORS: {[id: string]: {[material: string]: vec4}} = {
  robot: {Main: new vec4(0.2, 0.86, 0.86, 1), Grey: new vec4(0.93, 0.95, 0.98, 1), Black: new vec4(0.42, 0.47, 0.56, 1)},
  dog: {Main: new vec4(1, 0.6, 0.27, 1), Main_Light: new vec4(1, 0.96, 0.9, 1), Black: new vec4(0.45, 0.42, 0.42, 1),
    Eyes_White: new vec4(1, 1, 1, 1), Eyes_Pupil: new vec4(0.28, 0.22, 0.18, 1), Eyes_Black: new vec4(0.3, 0.26, 0.24, 1)},
}
// A little glow of their own colour, so they read on the see-through display.
const MODEL_GLOW = 0.18
const CLIP_FADE_S = 0.2
const SHADOW_CM = 60

const COLLECTIBLE_CM = 12
const COLLECTIBLE_HEIGHT_CM = 45
const POST_HEIGHT_CM = 160
const LANE_WIDTH_CM = 60
const OBSTACLE_DEPTH_CM = 30
const SHAKE_CM = 4
// While it points: a thin bar from its chest, forward.
const POINTER_HEIGHT_CM = 55
const POINTER_LENGTH_CM = 110
// The floor arrow near your feet toward the companion when it is out of view.
const FLOOR_ARROW_CM = 34
const FLOOR_ARROW_COLOR = new vec4(0.4, 0.85, 1, ARROW_OPACITY)

@component
export class FindYourWayCompanionView extends BaseScriptComponent {
  private material: Material | null = null
  private rig: LiveRig | null = null
  private mood: RigMood = "lead"
  private runningMs = 0
  private lastPos: vec3 | null = null
  private speedMs = 0
  private travelledM = 0
  private modelId = ""
  private model: SceneObject | null = null
  private collectibles: SceneObject[] = []
  private collectibleMesh: RenderMesh | null = null
  private post: SceneObject | null = null
  private pins: SceneObject[] = []
  private lane: SceneObject | null = null
  private obstacles: SceneObject[] = []
  private treat: SceneObject | null = null
  private grab: SceneObject | null = null
  private grabHandling: InteractableManipulation | null = null
  private pointer: SceneObject | null = null
  private floorArrow: SceneObject | null = null
  private spin = 0
  private shown = false
  // The animated models (null: the jointed primitives), and the one playing now.
  private prefabs: {[id: string]: ObjectPrefab | null} = {}
  private player: AnimationPlayer | null = null
  private clipNames: {[clip: string]: string} = {}
  private clip = ""
  private fadeIn = 1
  private lastClip = ""
  private shadowMesh: RenderMesh | null = null
  private shadowMat: Material | null = null

  // The imported Quaternius prefabs (Assets/Models); call before the first setModel to use them.
  setPrefabs(prefabs: {[id: string]: ObjectPrefab | null}): void {
    this.prefabs = prefabs
    const id = this.modelId
    this.modelId = ""
    if (id) this.setModel(id)
  }

  getClip(): string { return this.clip }
  isAnimatedModel(): boolean { return this.player !== null }

  // Call once after createComponent: the Unlit material to clone for every part.
  setup(material: Material): void {
    this.material = material
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
    this.floorArrow = global.scene.createSceneObject("FloorArrow")
    this.floorArrow.setParent(this.sceneObject)
    const arrowVisual = this.floorArrow.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    arrowVisual.mesh = this.flatChevron(FLOOR_ARROW_CM)
    arrowVisual.mainMaterial = this.makeMaterial(FLOOR_ARROW_COLOR)
    this.floorArrow.enabled = false
    this.setModel("dog")
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  // Swap the model (same logic, only the look changes). Unknown ids get the dog.
  setModel(id: string): void {
    const key = COLLECTIBLE_COLOR[id] ? id : "dog"
    if (key === this.modelId) return
    this.modelId = key
    if (this.model) this.model.destroy()
    this.model = global.scene.createSceneObject("Companion_" + key)
    this.model.setParent(this.sceneObject)
    this.player = null
    this.clip = ""
    this.lastClip = ""
    this.fadeIn = 1
    this.rig = null
    const prefab = this.prefabs[key]
    if (prefab) {
      try {
        this.buildAnimated(prefab, key)
      } catch (e) {
        print("[FYW] companion model " + key + " failed, using the primitives: " + e)
        this.player = null
      }
    }
    if (!this.player) this.rig = new LiveRig(this.model, rigOf(key), (c) => this.rigMaterial(c))
    this.addShadow(this.model)
    this.lastPos = null
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

  // What the companion is doing. runningMs: legs at this speed even if it isn't moving (Hop).
  setMood(mood: RigMood, runningMs: number = 0): void {
    this.mood = mood
    this.runningMs = runningMs
  }

  // Feet and wheels keep time with the distance really moved.
  private animate(pos: vec3): void {
    if (!this.rig && !this.player) return
    const dt = Math.max(getDeltaTime(), 1e-3)
    const step = this.lastPos ? pos.sub(this.lastPos).length / 100 : 0
    this.lastPos = pos
    const speed = this.runningMs > 0 ? this.runningMs : step / dt
    if (speed < TELEPORT_MS) {
      this.travelledM += this.runningMs > 0 ? this.runningMs * dt : step
      this.speedMs += (speed - this.speedMs) * Math.min(1, dt * SPEED_SMOOTHING)
    }
    if (this.player) {
      try {
        this.playMood(dt)
      } catch (e) {
        // A clip that isn't there must never stop the companion from walking.
        print("[FYW] companion clip: " + e)
        this.lastClip = ""
        this.clip = ""
      }
      return
    }
    if (this.rig) this.rig.apply(poseFor(this.modelId, {mood: this.mood, speedMs: this.speedMs, travelledM: this.travelledM, t: getTime()}))
  }

  // The animated model: the clip for the mood, cross-faded, the walk in time with the ground.
  private playMood(dt: number): void {
    const p = this.player as AnimationPlayer
    const want = clipFor(this.modelId, this.mood, this.speedMs)
    const name = this.clipNames[want.clip]
    if (!name) return
    if (want.clip !== this.clip) {
      if (this.clip && this.clipNames[this.clip]) this.lastClip = this.clipNames[this.clip]
      this.clip = want.clip
      this.fadeIn = 0
      p.setClipEnabled(name, true)
      p.playClip(name)
    }
    this.fadeIn = Math.min(1, this.fadeIn + dt / CLIP_FADE_S)
    const c = p.getClip(name)
    if (c) {
      c.playbackSpeed = want.rate
      c.weight = this.fadeIn
    }
    if (this.lastClip && this.lastClip !== name) {
      const old = p.getClip(this.lastClip)
      if (this.fadeIn >= 1 || !old) {
        p.stopClip(this.lastClip)
        p.setClipEnabled(this.lastClip, false)
        this.lastClip = ""
      } else old.weight = 1 - this.fadeIn
    }
  }

  private buildAnimated(prefab: ObjectPrefab, key: string): void {
    const inst = prefab.instantiate(this.model as SceneObject)
    const s = MODEL_HEIGHT_CM[key] / MODEL_RAW_CM[key]
    const t = inst.getTransform()
    t.setLocalScale(t.getLocalScale().uniformScale(s))
    // The imported models face +Z; ours face -Z.
    t.setLocalRotation(quat.angleAxis(Math.PI, vec3.up()))
    const players: AnimationPlayer[] = []
    const visit = (so: SceneObject) => {
      const ap = so.getComponent("Component.AnimationPlayer") as AnimationPlayer
      if (ap) players.push(ap)
      const visuals = so.getComponents("Component.RenderMeshVisual") as RenderMeshVisual[]
      for (const v of visuals) this.brighten(v, key)
      for (let i = 0; i < so.getChildrenCount(); i++) visit(so.getChild(i))
    }
    visit(inst)
    if (players.length === 0) throw new Error("no AnimationPlayer")
    const p = players[0]
    this.clipNames = {}
    const wanted = ["Walking", "Running", "Idle", "Wave", "ThumbsUp", "Yes", "Walk", "Gallop", "Idle_2", "Idle_2_HeadLow"]
    for (const c of p.clips) {
      c.playbackMode = PlaybackMode.Loop
      for (const w of wanted) {
        const n = c.name
        const hit = n === w || n.endsWith("|" + w) || n.endsWith("_" + w) && !n.endsWith("_2_" + w)
        // Prefer the plain name (the dog has each clip twice).
        if (hit && (!this.clipNames[w] || n === w)) this.clipNames[w] = n
      }
    }
    p.stopAll()
    for (const c of p.clips) p.setClipEnabled(c.name, false)
    this.player = p
    print("[FYW] companion " + key + ": animated model, clips " + Object.keys(this.clipNames).join(","))
  }

  // Lit, bright and a little glowing: the imported colours are too dark for an additive display.
  private brighten(v: RenderMeshVisual, key: string): void {
    const colors = MODEL_COLORS[key] || {}
    const n = v.getMaterialsCount()
    const mats: Material[] = []
    for (let i = 0; i < n; i++) {
      const src = v.getMaterial(i)
      const m = src.clone()
      const base = src.name.split("/").pop() as string
      const c = colors[base] || colors[base.replace(/[0-9.]+$/, "")]
      if (!c) print("[FYW] model material without a colour: " + src.name)
      const pass = m.mainPass as any
      if (c) {
        try {
          pass.baseColorFactor = c
          pass.emissiveFactor = new vec3(c.x * MODEL_GLOW, c.y * MODEL_GLOW, c.z * MODEL_GLOW)
          pass.metallicFactor = 0.05
          pass.roughnessFactor = 0.55
        } catch (e) {
          print("[FYW] model material " + m.name + ": " + e)
        }
      }
      mats.push(m)
    }
    v.materials = mats
  }

  // A soft round shadow on the floor under the companion (it grounds the model in the preview).
  private addShadow(parent: SceneObject): void {
    if (!this.shadowMesh) {
      const mb = new MeshBuilder([
        {name: "position", components: 3},
        {name: "normal", components: 3},
        {name: "texture0", components: 2},
      ])
      mb.topology = MeshTopology.Triangles
      mb.indexType = MeshIndexType.UInt16
      const h = SHADOW_CM / 2
      mb.appendVerticesInterleaved([-h, 0, -h, 0, 1, 0, 0, 0, h, 0, -h, 0, 1, 0, 1, 0, h, 0, h, 0, 1, 0, 1, 1, -h, 0, h, 0, 1, 0, 0, 1])
      mb.appendIndices([0, 2, 1, 0, 3, 2])
      mb.updateMesh()
      this.shadowMesh = mb.getMesh()
      const size = 64
      const tex = ProceduralTextureProvider.createWithFormat(size, size, TextureFormat.RGBA8Unorm)
      const d = new Uint8Array(size * size * 4)
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const r = Math.sqrt(((x + 0.5) / size - 0.5) ** 2 + ((y + 0.5) / size - 0.5) ** 2) * 2
          const a = Math.max(0, 1 - r)
          d.set([255, 255, 255, Math.round(a * a * 255)], (y * size + x) * 4)
        }
      }
      ;(tex.control as ProceduralTextureProvider).setPixels(0, 0, size, size, d)
      const m = (this.material as Material).clone()
      m.mainPass.baseTex = tex
      m.mainPass.baseColor = new vec4(0.06, 0.08, 0.12, 0.5)
      m.mainPass.blendMode = BlendMode.Normal
      m.mainPass.depthWrite = false
      m.mainPass.twoSided = true
      this.shadowMat = m
    }
    const so = global.scene.createSceneObject("Shadow")
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, 0.6, 0))
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = this.shadowMesh
    rmv.mainMaterial = this.shadowMat as Material
  }

  // pos: building-local cm on the floor; headingDeg: clockwise from map north;
  // liftCm: jump height; shake: 0..1 sideways wobble.
  setPose(pos: vec3, headingDeg: number, liftCm: number = 0, shake: number = 0): void {
    if (!this.model) return
    const t = this.model.getTransform()
    const rot = quat.angleAxis((-headingDeg * Math.PI) / 180, vec3.up())
    const side = rot.multiplyVec3(new vec3(1, 0, 0)).uniformScale(Math.sin(getTime() * 40) * SHAKE_CM * shake)
    t.setLocalPosition(pos.add(new vec3(0, liftCm, 0)).add(side))
    t.setLocalRotation(rot)
    this.animate(pos)
    if (this.pointer && this.pointer.enabled) {
      this.pointer.getTransform().setLocalPosition(pos)
      this.pointer.getTransform().setLocalRotation(rot)
    }
  }

  // Map builder: a pin standing on each marked shop, so the map grows in front of you.
  setPins(spots: vec3[]): void {
    while (this.pins.length < spots.length) {
      this.pins.push(this.makeObject("MapPin" + this.pins.length, [{color: new vec4(0.4, 1, 1, 0.55), boxes: [[0, 60, 0, 2.5, 120, 2.5], [0, 128, 0, 16, 16, 16]]}]))
    }
    this.pins.forEach((p, i) => {
      p.enabled = i < spots.length
      if (i < spots.length) p.getTransform().setLocalPosition(spots[i])
    })
  }

  getPinCount(): number { return this.pins.filter((p) => p.enabled).length }

  getPose(): vec3 | null { return this.model ? this.model.getTransform().getLocalPosition() : null }

  // Collectibles at building-local cm floor spots; got[i] hides spot i.
  // The clean screen: no floating collectibles on the floor.
  hideCollectibles = false

  setCollectibles(spots: vec3[], got: boolean[]): void {
    if (this.hideCollectibles) spots = []
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

  // The small floor arrow (building-local cm on the floor) pointing along headingDeg (clockwise
  // from map north, as setPose); null hides it.
  setFloorArrow(pos: vec3 | null, headingDeg: number = 0): void {
    if (!this.floorArrow) return
    this.floorArrow.enabled = pos !== null
    if (!pos) return
    const t = this.floorArrow.getTransform()
    t.setLocalPosition(pos.add(new vec3(0, 1, 0)))
    t.setLocalRotation(quat.angleAxis((-headingDeg * Math.PI) / 180, vec3.up()))
  }

  isFloorArrowShown(): boolean { return !!this.floorArrow && this.floorArrow.enabled }

  // A flat chevron on the floor (XZ plane) pointing toward -Z, the way the models face.
  private flatChevron(s: number): RenderMesh {
    const mb = new MeshBuilder([
      {name: "position", components: 3},
      {name: "normal", components: 3},
      {name: "texture0", components: 2},
    ])
    mb.topology = MeshTopology.Triangles
    mb.indexType = MeshIndexType.UInt16
    const h = s / 2, t = s * 0.28
    const pts = [[0, h], [h, 0], [h - t, 0], [0, h - t * 1.2], [-(h - t), 0], [-h, 0]]
    const v: number[] = []
    for (const p of pts) v.push(p[0], 0, -(p[1] - h / 3), 0, 1, 0, 0, 0)
    mb.appendVerticesInterleaved(v)
    mb.appendIndices([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5])
    mb.updateMesh()
    return mb.getMesh()
  }

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

  // The rig's light is baked in the vertices: the ramp texture turns it into shade.
  private rigMaterial(color: vec4): Material {
    const m = (this.material as Material).clone()
    m.mainPass.baseTex = shadeTexture()
    m.mainPass.baseColor = new vec4(color.x, color.y, color.z, COMPANION_ALPHA)
    m.mainPass.blendMode = BlendMode.Normal
    m.mainPass.depthWrite = true
    m.mainPass.twoSided = false // both faces would stack up and hide what is behind it
    return m
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
