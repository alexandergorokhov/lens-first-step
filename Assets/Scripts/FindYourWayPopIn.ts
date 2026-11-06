// FindYourWayPopIn — a panel that comes in instead of popping in: each time its SceneObject is
// enabled it scales up from THEME.popInFrom to its own size over THEME.popInS (200 ms).
// Add it with addPopIn(root) after the panel is built. Must not: decide when the panel shows.

import {popInScale, THEME} from "./FindYourWayTheme"

@component
export class FindYourWayPopIn extends BaseScriptComponent {
  private base: vec3 | null = null
  private t = -1

  onAwake() {
    this.createEvent("OnEnableEvent").bind(() => this.begin())
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  private begin(): void {
    // Its own size: what it was set to while hidden (not a size caught mid-animation).
    if (this.t < 0 || !this.base) this.base = this.getTransform().getLocalScale()
    this.t = 0
    this.apply()
  }

  private tick(): void {
    if (this.t < 0 || !this.base) return
    this.t += getDeltaTime()
    this.apply()
    if (this.t >= THEME.popInS) this.t = -1
  }

  private apply(): void {
    if (this.base) this.getTransform().setLocalScale(this.base.uniformScale(popInScale(Math.max(0, this.t))))
  }
}

export function addPopIn(so: SceneObject): void {
  so.createComponent(FindYourWayPopIn.getTypeName())
}
