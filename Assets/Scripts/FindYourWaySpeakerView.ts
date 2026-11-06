// FindYourWaySpeakerView — the person who talks to you when live captions show what they say: a gate
// agent at the airport, a shop assistant in the mall (CC0 animated people in Assets/Models/People). It
// stands where Main says (building-local cm), faces you, plays a talking clip while speaking and an idle
// one otherwise, with a soft pulse by its head so you see who is speaking. Must not: decide when.

import {Boxes, whiteTexture} from "./FindYourWayStandIn"

const HEIGHT_CM = 172
const RAW_CM = 185
const PULSE_COLOR = new vec4(0.4, 0.95, 0.9, 0.55)

@component
export class FindYourWaySpeakerView extends BaseScriptComponent {
  private prefabs: {[kind: string]: ObjectPrefab | null} = {}
  private material: Material | null = null
  private person: SceneObject | null = null
  private player: AnimationPlayer | null = null
  private talkClip = ""
  private idleClip = ""
  private playing = ""
  private pulse: SceneObject | null = null
  private speaking = false
  private t = 0

  setup(prefabs: {[kind: string]: ObjectPrefab | null}, material: Material): void {
    this.prefabs = prefabs
    this.material = material
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  hasModel(kind: string): boolean { return !!this.prefabs[kind] }
  isShown(): boolean { return !!this.person }
  isSpeaking(): boolean { return this.speaking }

  // kind: "agent" or "assistant"; pos: building-local cm on the floor; headingDeg: the way it faces
  // (clockwise from map north, as the companion).
  show(kind: string, pos: vec3, headingDeg: number): void {
    this.hide()
    const prefab = this.prefabs[kind] || this.prefabs.agent || this.prefabs.assistant
    if (!prefab) return
    const root = global.scene.createSceneObject("Speaker_" + kind)
    root.setParent(this.sceneObject)
    root.getTransform().setLocalPosition(pos)
    root.getTransform().setLocalRotation(quat.angleAxis((-headingDeg * Math.PI) / 180, vec3.up()))
    const inst = prefab.instantiate(root)
    const t = inst.getTransform()
    // Imported models face +Z and come in their own units: face -Z, and stand HEIGHT_CM tall.
    t.setLocalRotation(quat.angleAxis(Math.PI, vec3.up()))
    // The Quaternius people are 1.85 m tall as imported (185 cm at the prefab's own scale).
    t.setLocalScale(t.getLocalScale().uniformScale(HEIGHT_CM / RAW_CM))
    this.person = root
    this.player = this.findPlayer(inst)
    this.talkClip = this.clip(["Talk", "Talking", "Interact", "Wave", "Yes", "Gesture"])
    this.idleClip = this.clip(["Idle", "Idle_Neutral", "Standing"])
    this.playing = ""
    this.pulse = this.makePulse(root)
    this.setSpeaking(false)
  }

  hide(): void {
    if (this.person) this.person.destroy()
    this.person = null
    this.player = null
    this.pulse = null
    this.speaking = false
  }

  setSpeaking(on: boolean): void {
    this.speaking = on
    if (this.pulse) this.pulse.enabled = on
    this.play(on && this.talkClip ? this.talkClip : this.idleClip)
  }

  private play(name: string): void {
    if (!this.player || !name || name === this.playing) return
    try {
      if (this.playing) {
        this.player.stopClip(this.playing)
        this.player.setClipEnabled(this.playing, false)
      }
      this.player.setClipEnabled(name, true)
      this.player.playClip(name)
      this.playing = name
    } catch (e) {
      print("[FYW] speaker clip: " + e)
      this.playing = ""
    }
  }

  private tick(): void {
    if (!this.pulse || !this.pulse.enabled) return
    this.t += getDeltaTime()
    const s = 1 + 0.35 * (0.5 + 0.5 * Math.sin(this.t * 7))
    this.pulse.getTransform().setLocalScale(new vec3(s, s, s))
  }

  private findPlayer(so: SceneObject): AnimationPlayer | null {
    const ap = so.getComponent("Component.AnimationPlayer") as AnimationPlayer
    if (ap) {
      for (const c of ap.clips) c.playbackMode = PlaybackMode.Loop
      ap.stopAll()
      for (const c of ap.clips) ap.setClipEnabled(c.name, false)
      return ap
    }
    for (let i = 0; i < so.getChildrenCount(); i++) {
      const p = this.findPlayer(so.getChild(i))
      if (p) return p
    }
    return null
  }

  // The first clip whose name ends with one of these (the imported names carry a prefix).
  private clip(wanted: string[]): string {
    if (!this.player) return ""
    for (const w of wanted) {
      for (const c of this.player.clips) {
        const n = c.name
        if (n === w || n.endsWith("|" + w) || n.endsWith("_" + w)) return n
      }
    }
    return ""
  }

  // The model's height in cm as imported (from its meshes' local bounds and the scale above them).
  private measure(root: SceneObject): number {
    let top = -Infinity, bottom = Infinity
    const visit = (so: SceneObject) => {
      for (const v of so.getComponents("Component.RenderMeshVisual") as RenderMeshVisual[]) {
        try {
          const lo = v.worldAabbMin(), hi = v.worldAabbMax()
          top = Math.max(top, hi.y)
          bottom = Math.min(bottom, lo.y)
        } catch (e) { /* skinned: no bounds yet */ }
      }
      for (let i = 0; i < so.getChildrenCount(); i++) visit(so.getChild(i))
    }
    visit(root)
    const h = top - bottom
    return isFinite(h) && h > 1 ? h : 0
  }

  // Two small glowing rings by the head that breathe while it speaks.
  private makePulse(parent: SceneObject): SceneObject {
    const so = global.scene.createSceneObject("SpeakingPulse")
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(26, HEIGHT_CM - 6, 0))
    const b = new Boxes()
    for (const r of [7, 12]) {
      for (let k = -2; k <= 2; k++) {
        const a = (k * Math.PI) / 10
        b.box(new vec3(Math.cos(a) * r, Math.sin(a) * r, 0), new vec3(1.6, 3.2, 1.6))
      }
    }
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = b.mesh()
    if (this.material) {
      const m = this.material.clone()
      m.mainPass.baseTex = whiteTexture()
      m.mainPass.baseColor = PULSE_COLOR
      m.mainPass.blendMode = BlendMode.Normal
      m.mainPass.depthWrite = false
      rmv.mainMaterial = m
    }
    so.enabled = false
    return so
  }
}
