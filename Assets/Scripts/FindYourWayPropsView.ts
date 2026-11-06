// FindYourWayPropsView — stands the props in the building (building-local cm): CC0 models from
// Assets/Models/Props, found by their prefab's name, where Assets/Maps/props.json says (worked out in
// Node by src/core/props.ts: `npm run props`, then `npm run sync`). Created by FindYourWayMain as a
// child of the building and rebuilt with the place. Must not: choose where they go.

import {PROP_MODELS, Prop} from "./FindYourWayProps"
import {Vec3} from "./FindYourWayRouter"

const PLANS = requireAsset("../Maps/props.json") as JsonAsset

@component
export class FindYourWayPropsView extends BaseScriptComponent {
  private prefabs: {[name: string]: ObjectPrefab} = {}
  private plans: {[kit: string]: Prop[]} | null = null
  private root: SceneObject | null = null
  private count = 0

  setup(list: ObjectPrefab[]): void {
    for (const p of list || []) {
      if (!p) continue
      // Names may come as "Models/Props/plant_1.glb" or "plant_1".
      const n = (p.name.split("/").pop() as string).replace(/\.glb$/i, "")
      this.prefabs[n] = p
    }
    try {
      this.plans = JSON.parse(PLANS.getString())
    } catch (e) {
      print("[FYW] props.json unreadable: " + e)
    }
  }

  // kit: "airport" or "mall" (anything else: no props). local: map metres to building-local cm.
  build(kit: string, local: (p: Vec3, liftCm?: number) => vec3): number {
    if (this.root) this.root.destroy()
    this.root = null
    this.count = 0
    const plan: Prop[] = (this.plans && this.plans[kit]) || []
    if (plan.length === 0) return 0
    this.root = global.scene.createSceneObject("Props")
    this.root.setParent(this.sceneObject)
    for (const p of plan) {
      const prefab = this.prefabs[p.model]
      const m = PROP_MODELS[p.model]
      if (!prefab || !m) continue
      const inst = prefab.instantiate(this.root)
      const t = inst.getTransform()
      const s = p.heightM / m.rawM
      t.setLocalScale(t.getLocalScale().uniformScale(s))
      const liftCm = ((p.liftM || 0) * s + (p.mountM || 0)) * 100
      t.setLocalPosition(local({x: p.x, y: p.y, z: p.z}, liftCm))
      // The models face +Z; heading 0 (north) is -Z here.
      t.setLocalRotation(quat.angleAxis((-p.heading * Math.PI) / 180 + Math.PI, vec3.up()))
      this.count++
    }
    print("[FYW] props: " + this.count + " of " + plan.length + " (" + kit + ")")
    return this.count
  }

  getCount(): number { return this.count }
}
