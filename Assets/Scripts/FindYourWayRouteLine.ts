// FindYourWayRouteLine — draws the floor line: a MeshBuilder ribbon 1 cm above the floor,
// semi-transparent Google-Maps blue with a soft glow, rounded at corners, fading out at the
// far end of the look-ahead window. On a re-route the old line fades out while the new one
// grows outward from the user (the "swing"). Inputs: an Unlit material to clone.
// Must not: compute routes (Main passes building-local points in cm).

@component
export class FindYourWayRouteLine extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Route line – floor ribbon with glow and fade</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Unlit material to clone for the line (blend/depth are set in code)")
  material: Material
  @ui.group_end
  @ui.separator
  @ui.group_start("Settings")
  @input("vec4", "{0.259,0.522,0.957,0.5}")
  @hint("Line colour and opacity (Google Maps blue #4285F4 at 50%)")
  @widget(new ColorWidget())
  lineColor: vec4 = new vec4(0.259, 0.522, 0.957, 0.5)

  @input
  @hint("Line width on the floor, cm")
  @widget(new SliderWidget(10, 80, 1))
  widthCm: number = 30

  @input
  @hint("Soft glow added on each side of the line, cm")
  @widget(new SliderWidget(0, 40, 1))
  glowCm: number = 12

  @input
  @hint("Length over which the line fades out at its far end, as a share of the look-ahead")
  @widget(new SliderWidget(0.05, 0.6, 0.05))
  fadeShare: number = 0.3

  @input
  @hint("Seconds for the re-route swing (old line fades, new line grows)")
  @widget(new SliderWidget(0.2, 2, 0.1))
  swingSeconds: number = 0.9
  @ui.group_end

  private rmv: RenderMeshVisual
  private oldRmv: RenderMeshVisual
  private mat: Material
  private oldMat: Material
  private points: vec3[] = []
  private aheadCm = 1000
  private swingT = -1
  private visible = false

  onAwake() {
    const tex = this.makeGlowTexture()
    this.mat = this.material.clone()
    this.setupMat(this.mat, tex)
    this.oldMat = this.material.clone()
    this.setupMat(this.oldMat, tex)

    const lineSo = global.scene.createSceneObject("RouteLineMesh")
    lineSo.setParent(this.sceneObject)
    this.rmv = lineSo.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    this.rmv.mainMaterial = this.mat
    this.rmv.setRenderOrder(20)

    const oldSo = global.scene.createSceneObject("RouteLineOldMesh")
    oldSo.setParent(this.sceneObject)
    this.oldRmv = oldSo.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    this.oldRmv.mainMaterial = this.oldMat
    this.oldRmv.setRenderOrder(19)
    oldSo.enabled = false
    lineSo.enabled = false

    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  private setupMat(m: Material, tex: Texture): void {
    m.mainPass.baseTex = tex
    m.mainPass.baseColor = this.lineColor
    m.mainPass.blendMode = BlendMode.Normal
    m.mainPass.depthWrite = false
    m.mainPass.depthTest = true
    m.mainPass.twoSided = true
  }

  // 64 x 16 texture: u along the line (fade at the far end), v across (core + soft glow).
  private makeGlowTexture(): Texture {
    const W = 64, H = 16
    const tex = ProceduralTextureProvider.createWithFormat(W, H, TextureFormat.RGBA8Unorm)
    const half = this.widthCm / 2 + this.glowCm
    const core = half > 0 ? (this.widthCm / 2) / half : 1
    const data = new Uint8Array(W * H * 4)
    for (let j = 0; j < H; j++) {
      const v = (j + 0.5) / H
      const d = Math.abs(v - 0.5) * 2
      let a = 1
      if (d > core) {
        const g = (d - core) / Math.max(1e-3, 1 - core)
        a = 0.45 * Math.pow(1 - Math.min(1, g), 2)
      } else if (d > core - 0.08) {
        a = 0.75 + 0.25 * (core - d) / 0.08 // slightly soft edge on the core
      }
      for (let i = 0; i < W; i++) {
        const u = i / (W - 1)
        const fadeStart = 1 - this.fadeShare
        const f = u <= fadeStart ? 1 : Math.max(0, 1 - (u - fadeStart) / this.fadeShare)
        const k = (j * W + i) * 4
        data[k] = 255
        data[k + 1] = 255
        data[k + 2] = 255
        data[k + 3] = Math.round(255 * a * f)
      }
    }
    ;(tex.control as ProceduralTextureProvider).setPixels(0, 0, W, H, data)
    return tex
  }

  // points: building-local cm, already lifted 1 cm above the floor. aheadCm = look-ahead.
  // reroute = true plays the swing (old line fades out, new line grows from the user).
  setPath(points: vec3[], aheadCm: number, reroute: boolean): void {
    if (reroute && this.visible && this.points.length > 1) {
      this.oldRmv.mesh = this.rmv.mesh
      this.oldRmv.getSceneObject().enabled = true
      this.swingT = 0
    } else if (reroute && !this.visible) {
      this.swingT = 0
    }
    this.points = points
    this.aheadCm = aheadCm
    this.visible = points.length > 1
    this.rmv.getSceneObject().enabled = this.visible
    if (this.visible) this.rebuild()
  }

  clear(): void {
    this.points = []
    this.visible = false
    this.swingT = -1
    this.rmv.getSceneObject().enabled = false
    this.oldRmv.getSceneObject().enabled = false
  }

  isShowing(): boolean { return this.visible }
  getPoints(): vec3[] { return this.points.slice() }
  isSwinging(): boolean { return this.swingT >= 0 }

  private tick(): void {
    if (this.swingT < 0) return
    this.swingT += getDeltaTime()
    const k = Math.min(1, this.swingT / this.swingSeconds)
    const c = this.lineColor
    this.oldMat.mainPass.baseColor = new vec4(c.x, c.y, c.z, c.w * (1 - k))
    if (this.visible) this.rebuild()
    if (k >= 1) {
      this.swingT = -1
      this.oldRmv.getSceneObject().enabled = false
      if (this.visible) this.rebuild()
    }
  }

  private rebuild(): void {
    let pts = this.points
    if (this.swingT >= 0) {
      const k = Math.min(1, this.swingT / this.swingSeconds)
      const e = 1 - Math.pow(1 - k, 3)
      pts = truncate(pts, Math.max(1, this.aheadCm * e))
    }
    pts = roundCorners(pts, 60)
    if (pts.length < 2) {
      this.rmv.getSceneObject().enabled = false
      return
    }
    this.rmv.getSceneObject().enabled = true
    this.rmv.mesh = ribbon(pts, this.widthCm / 2 + this.glowCm, this.aheadCm)
  }
}

function truncate(p: vec3[], maxLen: number): vec3[] {
  const out: vec3[] = [p[0]]
  let left = maxLen
  for (let i = 1; i < p.length && left > 0; i++) {
    const d = p[i].distance(p[i - 1])
    if (d <= left) {
      out.push(p[i])
      left -= d
    } else {
      out.push(vec3.lerp(p[i - 1], p[i], left / d))
      left = 0
    }
  }
  return out
}

// Replaces sharp corners with short quadratic arcs so the line "goes round" corners.
function roundCorners(p: vec3[], radius: number): vec3[] {
  if (p.length < 3) return p
  const out: vec3[] = [p[0]]
  for (let i = 1; i < p.length - 1; i++) {
    const a = p[i - 1], b = p[i], c = p[i + 1]
    const d1 = b.sub(a), d2 = c.sub(b)
    const l1 = d1.length, l2 = d2.length
    if (l1 < 1 || l2 < 1) { out.push(b); continue }
    const n1 = d1.uniformScale(1 / l1), n2 = d2.uniformScale(1 / l2)
    if (n1.dot(n2) > 0.985) { out.push(b); continue }
    const r = Math.min(radius, l1 * 0.45, l2 * 0.45)
    const s = b.sub(n1.uniformScale(r)), e = b.add(n2.uniformScale(r))
    for (let k = 0; k <= 6; k++) {
      const t = k / 6
      const q = s.uniformScale((1 - t) * (1 - t)).add(b.uniformScale(2 * t * (1 - t))).add(e.uniformScale(t * t))
      out.push(q)
    }
  }
  out.push(p[p.length - 1])
  return out
}

function flatDir(a: vec3, b: vec3): vec3 {
  const d = new vec3(b.x - a.x, 0, b.z - a.z)
  const l = d.length
  return l > 1e-4 ? d.uniformScale(1 / l) : new vec3(0, 0, -1)
}

function ribbon(p: vec3[], half: number, aheadCm: number): RenderMesh {
  const mb = new MeshBuilder([
    {name: "position", components: 3},
    {name: "normal", components: 3},
    {name: "texture0", components: 2},
  ])
  mb.topology = MeshTopology.Triangles
  mb.indexType = MeshIndexType.UInt16
  const verts: number[] = []
  const idx: number[] = []
  let s = 0
  for (let i = 0; i < p.length; i++) {
    if (i > 0) s += p[i].distance(p[i - 1])
    const dPrev = i > 0 ? flatDir(p[i - 1], p[i]) : flatDir(p[0], p[1])
    const dNext = i < p.length - 1 ? flatDir(p[i], p[i + 1]) : dPrev
    let t = dPrev.add(dNext)
    t = t.length > 1e-4 ? t.normalize() : dPrev
    const side = new vec3(t.z, 0, -t.x)
    const sidePrev = new vec3(dPrev.z, 0, -dPrev.x)
    const miter = Math.min(2, 1 / Math.max(0.5, side.dot(sidePrev)))
    const off = side.uniformScale(half * miter)
    const l = p[i].add(off), r = p[i].sub(off)
    const u = s / aheadCm
    verts.push(l.x, l.y, l.z, 0, 1, 0, u, 0)
    verts.push(r.x, r.y, r.z, 0, 1, 0, u, 1)
    if (i < p.length - 1) {
      const a = 2 * i
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  mb.appendVerticesInterleaved(verts)
  mb.appendIndices(idx)
  mb.updateMesh()
  return mb.getMesh()
}
