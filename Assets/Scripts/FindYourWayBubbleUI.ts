// FindYourWayBubbleUI — the small bubble above the companion's head while it waits at a floor
// change: "3 picks upstairs". World space, in the building, always facing you. Needs no pinch.
// Created at runtime by FindYourWayMain. Must not: decide when it shows (FindYourWayFreeWalk does).

import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import {addText, makePanel} from "./FindYourWayWidgetsUI"

const WIDTH = 20
const SCALE = 1.4
const TEXT = new vec4(1, 1, 1, 1)

@component
export class FindYourWayBubbleUI extends BaseScriptComponent {
  private label: Text

  setup(): void {
    const p = makePanel(this.sceneObject, WIDTH + 2, 0.8, 0)
    this.label = addText(p.content, "BubbleText", "3 picks upstairs", "Headline1", WIDTH, 3, TEXT, 200)
    this.sceneObject.getTransform().setLocalScale(new vec3(SCALE, SCALE, SCALE))
    this.sceneObject.createComponent(Billboard.getTypeName())
    this.sceneObject.enabled = false
  }

  // localPos: building-local cm; null hides it.
  show(text: string | null, localPos: vec3 | null): void {
    this.sceneObject.enabled = text !== null
    if (text === null) return
    this.label.text = text
    if (localPos) this.sceneObject.getTransform().setLocalPosition(localPos)
  }

  getText(): string | null { return this.sceneObject.enabled ? this.label.text : null }
}
