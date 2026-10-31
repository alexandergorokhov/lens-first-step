// FindYourWayRigMesh — turns a companion rig from FindYourWayAnim into scene objects: one object per
// joint, its rounded parts merged by colour with the light baked into each vertex (Unlit, no scene
// lights on Specs). Applies a pose each frame. Must not: decide the pose; that's FindYourWayAnim.

import {Rig, RigPose} from "./FindYourWayAnim"

const FLOATS_PER_VERTEX = 8
const STACKS = 8
const SLICES = 14
const WHEEL_SIDES = 18
const DEG = Math.PI / 180
const LIGHT = new vec3(0.3, 0.85, -0.42).normalize()

function bakedShade(n: vec3): number {
  return 0.58 + 0.42 * (0.5 + 0.5 * n.dot(LIGHT))
}

class Blobs {
  private v: number[] = []
  private i: number[] = []

  private vertex(p: vec3, n: vec3): void {
    this.v.push(p.x, p.y, p.z, n.x, n.y, n.z, bakedShade(n), 0.5)
  }

  ball(at: number[], size: number[]): void {
    const base = this.v.length / FLOATS_PER_VERTEX
    for (let s = 0; s <= STACKS; s++) {
      const lat = (s / STACKS) * Math.PI
      for (let k = 0; k <= SLICES; k++) {
        const lon = (k / SLICES) * 2 * Math.PI
        const dir = new vec3(Math.sin(lat) * Math.cos(lon), Math.cos(lat), Math.sin(lat) * Math.sin(lon))
        const p = new vec3(at[0] + dir.x * size[0], at[1] + dir.y * size[1], at[2] + dir.z * size[2])
        this.vertex(p, new vec3(dir.x / size[0], dir.y / size[1], dir.z / size[2]).normalize())
      }
    }
    const row = SLICES + 1
    for (let s = 0; s < STACKS; s++) {
      for (let k = 0; k < SLICES; k++) {
        const a = base + s * row + k, b = a + row
        this.i.push(a, a + 1, b, b, a + 1, b + 1)
      }
    }
  }

  // A disc turning about x: size is half the width, then the radius twice.
  wheel(at: number[], size: number[]): void {
    for (const side of [-1, 1]) {
      const centre = this.v.length / FLOATS_PER_VERTEX
      const face = new vec3(side, 0, 0)
      this.vertex(new vec3(at[0] + side * size[0], at[1], at[2]), face)
      for (let k = 0; k <= WHEEL_SIDES; k++) {
        const a = (k / WHEEL_SIDES) * 2 * Math.PI
        this.vertex(new vec3(at[0] + side * size[0], at[1] + Math.cos(a) * size[1], at[2] + Math.sin(a) * size[2]), face)
        if (k < WHEEL_SIDES) this.i.push(centre, centre + k + 1, centre + k + 2)
      }
    }
    const base = this.v.length / FLOATS_PER_VERTEX
    for (let k = 0; k <= WHEEL_SIDES; k++) {
      const a = (k / WHEEL_SIDES) * 2 * Math.PI
      const n = new vec3(0, Math.cos(a), Math.sin(a))
      for (const side of [-1, 1]) {
        this.vertex(new vec3(at[0] + side * size[0], at[1] + n.y * size[1], at[2] + n.z * size[2]), n)
      }
      if (k < WHEEL_SIDES) {
        const q = base + k * 2
        this.i.push(q, q + 1, q + 2, q + 2, q + 1, q + 3)
      }
    }
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

export class LiveRig {
  private objects: {[joint: string]: SceneObject} = {}
  private rest: {[joint: string]: vec3} = {}
  private rootName = ""

  constructor(parent: SceneObject, rig: Rig, materialFor: (color: vec4) => Material) {
    for (const j of rig.joints) {
      const so = global.scene.createSceneObject("Joint_" + j.name)
      so.setParent(j.parent ? this.objects[j.parent] : parent)
      const pivot = new vec3(j.pivot[0], j.pivot[1], j.pivot[2])
      so.getTransform().setLocalPosition(pivot)
      this.objects[j.name] = so
      this.rest[j.name] = pivot
      if (!j.parent) this.rootName = j.name
    }
    const groups: {[key: string]: {joint: string; color: number[]; mesh: Blobs}} = {}
    for (const p of rig.parts) {
      const key = p.joint + "/" + p.color.join(",")
      if (!groups[key]) groups[key] = {joint: p.joint, color: p.color, mesh: new Blobs()}
      if (p.shape === "wheel") groups[key].mesh.wheel(p.at, p.size)
      else groups[key].mesh.ball(p.at, p.size)
    }
    for (const key of Object.keys(groups)) {
      const g = groups[key]
      const so = global.scene.createSceneObject("Part_" + g.joint)
      so.setParent(this.objects[g.joint])
      const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      rmv.mesh = g.mesh.mesh()
      rmv.mainMaterial = materialFor(new vec4(g.color[0], g.color[1], g.color[2], 1))
    }
  }

  apply(pose: RigPose): void {
    for (const name of Object.keys(pose.joints)) {
      const so = this.objects[name]
      if (!so) continue
      const a = pose.joints[name]
      so.getTransform().setLocalRotation(quat.fromEulerAngles(a[0] * DEG, a[1] * DEG, a[2] * DEG))
    }
    const root = this.objects[this.rootName].getTransform()
    root.setLocalPosition(this.rest[this.rootName].add(new vec3(0, pose.liftCm, 0)))
    root.setLocalRotation(quat.fromEulerAngles(pose.pitchDeg * DEG, 0, 0))
  }
}
