// FindYourWayHomePanelUI — the panel after the sign scan: Free walk, Tour, Go to a place or Map builder.
// Created at runtime by FindYourWayMain, which places it. Emits through the callbacks given to
// setup(). Must not: start anything itself (Main owns the phases).

import {addButton, addText, makePanel} from "./FindYourWayWidgetsUI"
import {icon} from "./FindYourWayIconsUI"

export interface HomeHandlers {
  onFreeWalk: () => void
  onTour: () => void
  onGoTo: () => void
  onBuilder: () => void
}

const WIDTH = 30
const BUTTON_H = 7
const TEXT = new vec4(1, 1, 1, 1)

@component
export class FindYourWayHomePanelUI extends BaseScriptComponent {
  setup(h: HomeHandlers): void {
    const panel = makePanel(this.sceneObject, WIDTH + 4, 2, 1.2)
    addText(panel.content, "HomeTitle", "What would you like to do?", "Headline1", WIDTH, 3.6, TEXT, 100)
    addButton(panel.content, "FreeWalkButton", "Free walk", WIDTH, BUTTON_H, icon("directions_walk"), h.onFreeWalk, TEXT, 100, "HeadlineXL", "Primary")
    addButton(panel.content, "TourButton", "Tour", WIDTH, BUTTON_H, icon("map"), h.onTour, TEXT, 100, "Headline1", "Primary")
    addButton(panel.content, "GoToPlaceButton", "Go to a place", WIDTH, BUTTON_H, icon("location_on"), h.onGoTo, TEXT, 100, "HeadlineXL", "Primary")
    addButton(panel.content, "MapBuilderButton", "Map builder", WIDTH, BUTTON_H, icon("map"), h.onBuilder, TEXT, 100, "HeadlineXL")
    this.sceneObject.enabled = false
  }

  show(on: boolean): void { this.sceneObject.enabled = on }
  isShown(): boolean { return this.sceneObject.enabled }
}
