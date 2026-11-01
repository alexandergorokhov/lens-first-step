// FindYourWayPanelFollow — how panels sit relative to your head: placed once, or eased along as you
// move. Created by FindYourWayMain. Must not: decide which panels show.

const FOLLOW_RATE = 4

export interface PanelFollowHost {
  camera: SceneObject
  modePanelOffset: vec3
  headYaw(): quat
}

export class FindYourWayPanelFollow {
  constructor(private host: PanelFollowHost) {}

  // A panel ~1 m ahead, a little below eye level, facing you.
  placeAhead(so: SceneObject): void {
    const t = this.host.camera.getTransform()
    const yaw = this.host.headYaw()
    so.getTransform().setWorldPosition(t.getWorldPosition().add(yaw.multiplyVec3(this.host.modePanelOffset)))
    so.getTransform().setWorldRotation(yaw)
  }

  // Eases so toward offset from the head, facing the eyes. placed = false puts it there at once.
  follow(so: SceneObject, offset: vec3, placed: boolean): void {
    const eyes = this.host.camera.getTransform().getWorldPosition()
    const target = eyes.add(this.host.headYaw().multiplyVec3(offset))
    const t = so.getTransform()
    t.setWorldPosition(vec3.lerp(t.getWorldPosition(), target, placed ? 1 - Math.exp(-getDeltaTime() * FOLLOW_RATE) : 1))
    t.setWorldRotation(quat.lookAt(eyes.sub(t.getWorldPosition()).normalize(), vec3.up()))
  }
}
