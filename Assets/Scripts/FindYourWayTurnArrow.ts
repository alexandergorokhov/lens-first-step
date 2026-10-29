import {whiteTexture} from "./FindYourWayStandIn"

// FindYourWayTurnArrow — a small chevron at the lower edge of the view (child of the camera)
// that points toward the next turn when that turn is out of view. Main decides visibility and
// passes the signed yaw (degrees, + = turn is to the right). Must not: compute routes.

@component
export class FindYourWayTurnArrow extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Turn arrow – lower edge of view, toward the next turn</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Unlit material to clone for the arrow")
  material: Material
  @ui.group_end
  @ui.separator
  @ui.group_start("Settings")
  @input("vec4", "{0.259,0.522,0.957,0.9}")
  @hint("Arrow colour")
  @widget(new ColorWidget())
  color: vec4 = new vec4(0.259, 0.522, 0.957, 0.9)

  @input
  @hint("Distance in front of the eyes, cm")
  @widget(new SliderWidget(40, 120, 1))
  depthCm: number = 60

  @input
  @hint("How far below the centre of view, cm (at depthCm)")
  @widget(new SliderWidget(0, 20, 0.5))
  dropCm: number = 10

  @input
  @hint("Max sideways shift toward the turn, cm")
  @widget(new SliderWidget(0, 15, 0.5))
  sideCm: number = 4

  @input
  @hint("Arrow size, cm")
  @widget(new SliderWidget(1, 8, 0.25))
  sizeCm: number = 4.5
  @ui.group_end

  private arrow: SceneObject
  private shown = false

  onAwake() {
    this.arrow = global.scene.createSceneObject("Chevron")
    this.arrow.setParent(this.sceneObject)
    const rmv = this.arrow.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    const m = this.material.clone()
    m.mainPass.baseTex = whiteTexture()
    m.mainPass.baseColor = this.color
    m.mainPass.blendMode = BlendMode.Normal
    m.mainPass.depthTest = false
    m.mainPass.depthWrite = false
    m.mainPass.twoSided = true
    rmv.mainMaterial = m
    rmv.setRenderOrder(100)
    rmv.mesh = this.chevron(this.sizeCm)
    this.arrow.enabled = false
  }

  // yawDeg: signed angle from the view direction to the next turn (+ right, - left).
  show(yawDeg: number): void {
    const k = Math.max(-1, Math.min(1, yawDeg / 90))
    this.arrow.getTransform().setLocalPosition(new vec3(k * this.sideCm, -this.dropCm, -this.depthCm))
    const clamped = Math.max(-150, Math.min(150, yawDeg))
    this.arrow.getTransform().setLocalRotation(quat.angleAxis(-clamped * MathUtils.DegToRad, vec3.forward()))
    this.arrow.enabled = true
    this.shown = true
  }

  hide(): void {
    this.arrow.enabled = false
    this.shown = false
  }

  isShown(): boolean { return this.shown }

  // Chevron pointing up (+Y) in the XY plane.
  private chevron(s: number): RenderMesh {
    const mb = new MeshBuilder([
      {name: "position", components: 3},
      {name: "normal", components: 3},
      {name: "texture0", components: 2},
    ])
    mb.topology = MeshTopology.Triangles
    mb.indexType = MeshIndexType.UInt16
    const h = s / 2, t = s * 0.28
    const pts = [
      [0, h], [h, 0], [h - t, 0], [0, h - t * 1.2], [-(h - t), 0], [-h, 0],
    ]
    const v: number[] = []
    for (const p of pts) v.push(p[0], p[1] - h / 3, 0, 0, 0, 1, 0, 0)
    mb.appendVerticesInterleaved(v)
    mb.appendIndices([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5])
    mb.updateMesh()
    return mb.getMesh()
  }
}
