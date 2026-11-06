// FindYourWayWidgetsUI — shared UIKit building blocks for the Find Your Way UI modules.
// Owns: BackPlate panel skeleton, raw Text rows placed by FlexLayout, UIKit Buttons with an
// icon + label row, the type scale. Must not: hold app state or make navigation decisions.
// Every helper composes UIKit primitives (BackPlate, FlexLayout, FlexItem, Button).

import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {
  FlexAlign,
  FlexAlignSelf,
  FlexDirection,
  FlexJustify,
} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"

import {glass, THEME} from "./FindYourWayTheme"

const imageMaterial = requireAsset("../Materials/ImageMaterial.mat") as Material

// ── Type scale (canonical: specs-build-ui patterns.md → Typography)
const FONT_SIZE_SCALE = 1.0
export type TextRole =
  | "Title1" | "Title2" | "HeadlineXL" | "Headline1" | "Headline2"
  | "Subheadline" | "Button" | "Callout" | "Body" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title1: {size: 105, weight: 700}, Title2: {size: 93, weight: 700},
  HeadlineXL: {size: 62, weight: 700}, Headline1: {size: 54, weight: 700},
  Headline2: {size: 48, weight: 700}, Subheadline: {size: 41, weight: 700},
  Button: {size: 39, weight: 500}, Callout: {size: 39, weight: 700},
  Body: {size: 39, weight: 500}, Caption: {size: 38, weight: 500},
}
export function roleSize(role: TextRole, distanceCm: number = 110): number {
  return TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
}
export function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = roleSize(role, distanceCm)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

const BUTTON_LABEL_Z = 0.08
const LAYOUT_Z = 0.02

export function obj(parent: SceneObject, name: string, position?: vec3): SceneObject {
  const so = global.scene.createSceneObject(name)
  so.setParent(parent)
  if (position) so.getTransform().setLocalPosition(position)
  return so
}

export interface Panel {
  root: SceneObject
  content: SceneObject
  flex: FlexLayout
  plate: BackPlate
}

// Airport-signage panel colour: a bright-enough navy so it reads on an additive display
// (very dark plates render as see-through), with white text on top.
// Calm, see-through panels and warm text: easy on the eyes, and the place stays visible behind them.
// One look (FindYourWayTheme): frosted glass light enough for the additive display; amber for alerts.
const vec = (c: number[]): vec4 => new vec4(c[0], c[1], c[2], c[3])
export const PANEL_TINT = vec(glass("panel"))
export const CARD_TINT = vec(glass("card"))
export const TAB_TINT = vec(glass("tab"))
export const ALERT_TINT = new vec4(THEME.changed[0] * 0.85, THEME.changed[1] * 0.75, THEME.changed[2] * 0.6, 0.78)
const PANEL_SCALE = 0.82 // every panel, so none blocks the narrow view
const TEXT_WARMTH = vec(THEME.text)

function warm(c: vec4): vec4 {
  // Never fainter than the theme allows (0.9): text that fades into the place can't be read.
  return new vec4(c.x * TEXT_WARMTH.x, c.y * TEXT_WARMTH.y, c.z * TEXT_WARMTH.z, Math.max(THEME.textSoft[3], c.w))
}

// Canvas + BackPlate on `root`, a Content child (+0.6 cm Z) holding a column FlexLayout.
// The plate hugs the laid-out content and is tinted once it has initialised.
export function makePanel(root: SceneObject, widthCm: number, pad: number, gap: number,
    align: FlexAlign = FlexAlign.Center, tint: vec4 = PANEL_TINT): Panel {
  root.createComponent("Component.Canvas")
  const t = root.getTransform()
  t.setLocalScale(t.getLocalScale().uniformScale(PANEL_SCALE))
  const plate = root.createComponent(BackPlate.getTypeName()) as BackPlate
  plate.onInitialized.add(() => {
    const rr = root.getComponent(RoundedRectangle.getTypeName()) as RoundedRectangle | null
    if (rr) {
      rr.gradient = false
      rr.backgroundColor = tint
    }
  })
  const content = obj(root, "Content", new vec3(0, 0, 0.6))
  const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
  flex.autoDiscoverItemsOnStart = false
  flex.width = widthCm
  flex.height = -1
  flex.direction = FlexDirection.Column
  flex.justifyContent = FlexJustify.Start
  flex.alignItems = align
  flex.rowGap = gap
  flex.paddingTop = pad
  flex.paddingBottom = pad
  flex.paddingLeft = pad
  flex.paddingRight = pad
  flex.onLayoutComplete.add((r) => {
    plate.size = new vec2(r.containerWidth, r.containerHeight)
  })
  return {root, content, flex, plate}
}

function registerItem(parent: SceneObject, item: FlexItem): void {
  const layout = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
  if (layout) layout.addItems([item])
}

// One text row inside a column FlexLayout. widthCm sizes the cell for the longest expected string.
export function addText(parent: SceneObject, name: string, value: string, role: TextRole,
    widthCm: number, heightCm: number, color: vec4, distanceCm: number = 110,
    align: HorizontalAlignment = HorizontalAlignment.Center): Text {
  const so = obj(parent, name)
  so.getTransform().setLocalPosition(new vec3(0, 0, LAYOUT_Z))
  const t = so.createComponent("Component.Text") as Text
  t.text = value
  t.depthTest = true
  applyTextRole(t, role, distanceCm)
  t.textFill.color = warm(color)
  t.horizontalAlignment = align
  t.verticalAlignment = VerticalAlignment.Center
  t.horizontalOverflow = HorizontalOverflow.Wrap
  t.verticalOverflow = VerticalOverflow.Overflow
  t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -heightCm / 2, heightCm / 2)
  const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
  item.alignSelf = FlexAlignSelf.Center
  registerItem(parent, item)
  return t
}

export function addIcon(parent: SceneObject, name: string, icon: Texture, sizeCm: number,
    tint: vec4): Image {
  const so = obj(parent, name)
  so.getTransform().setLocalPosition(new vec3(0, 0, LAYOUT_Z))
  const img = so.createComponent("Component.Image") as Image
  const mat = imageMaterial.clone()
  mat.mainPass.baseTex = icon
  mat.mainPass.baseColor = tint
  mat.mainPass.depthTest = true
  mat.mainPass.depthWrite = false
  img.clearMaterials()
  img.addMaterial(mat)
  so.getTransform().setLocalScale(new vec3(sizeCm, sizeCm, 1))
  const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
  registerItem(parent, item)
  return img
}

export interface LabeledButton {
  so: SceneObject
  button: Button
  label: Text
  icon: Image | null
}

// UIKit Button (size set before init) with an optional icon + label row on its face.
// The SceneObject carries `name`, so LEAF finds its Interactable with findInteractableByName(name).
// Every button by SceneObject name -> the same click handler its pinch runs. The autoplay demo
// "presses" buttons through this, so it follows exactly the code path of a real pinch.
const PRESSABLE: {[name: string]: {so: SceneObject; onClick: () => void}} = {}

// Runs a button's click handler as a pinch would. Returns false when the button doesn't exist
// or isn't visible (enabled in the hierarchy), just as a hidden button can't be pinched.
export function pressButton(name: string): boolean {
  const b = PRESSABLE[name]
  if (!b || isNull(b.so) || !b.so.isEnabledInHierarchy) return false
  b.onClick()
  return true
}

export function addButton(parent: SceneObject, name: string, label: string, widthCm: number,
    heightCm: number, icon: Texture | null, onClick: () => void, labelColor: vec4,
    distanceCm: number = 110, role: TextRole = "Button", style: string = "PrimaryNeutral"): LabeledButton {
  const so = obj(parent, name)
  so.getTransform().setLocalPosition(new vec3(0, 0, LAYOUT_Z))
  const button = so.createComponent(Button.getTypeName()) as Button
  button.setTheme("SnapOS2", style === "Gold" ? "Primary" : style === "Primary" ? "PrimaryNeutral" : style) // the theme's Primary is a loud gold
  button.size = new vec3(widthCm, heightCm, 1)

  const face = obj(so, "Face", new vec3(0, 0, BUTTON_LABEL_Z))
  const row = face.createComponent(FlexLayout.getTypeName()) as FlexLayout
  row.autoDiscoverItemsOnStart = false
  row.direction = FlexDirection.Row
  row.alignItems = FlexAlign.Center
  row.justifyContent = FlexJustify.Center
  row.columnGap = heightCm * 0.18
  row.width = widthCm - 0.5
  row.height = heightCm

  const iconSize = Math.min(heightCm * 0.55, 4.5)
  const iconImg = icon ? addIcon(face, "Icon", icon, iconSize, labelColor) : null
  const textWidth = widthCm - 0.5 - (icon ? iconSize + heightCm * 0.18 : 0) - 0.6
  const lso = obj(face, "Label")
  const t = lso.createComponent("Component.Text") as Text
  t.text = label
  t.depthTest = true
  applyTextRole(t, role, distanceCm)
  t.textFill.color = warm(labelColor)
  t.horizontalAlignment = icon ? HorizontalAlignment.Left : HorizontalAlignment.Center
  t.verticalAlignment = VerticalAlignment.Center
  t.horizontalOverflow = HorizontalOverflow.Wrap
  t.verticalOverflow = VerticalOverflow.Overflow
  t.layoutRect = Rect.create(-textWidth / 2, textWidth / 2, -heightCm / 2 + 0.3, heightCm / 2 - 0.3)
  const litem = lso.createComponent(FlexItem.getTypeName()) as FlexItem
  row.addItems([litem])

  const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
  registerItem(parent, item)
  button.onTriggerUp.add(() => onClick())
  PRESSABLE[name] = {so, onClick}
  return {so, button, label: t, icon: iconImg}
}

// A horizontal row container (FlexLayout row) placed inside a column.
export function addRow(parent: SceneObject, name: string, widthCm: number, heightCm: number,
    gap: number): SceneObject {
  const so = obj(parent, name)
  so.getTransform().setLocalPosition(new vec3(0, 0, LAYOUT_Z))
  const row = so.createComponent(FlexLayout.getTypeName()) as FlexLayout
  row.autoDiscoverItemsOnStart = false
  row.direction = FlexDirection.Row
  row.alignItems = FlexAlign.Center
  row.justifyContent = FlexJustify.Center
  row.columnGap = gap
  row.width = widthCm
  row.height = heightCm
  const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
  item.overrideWidth = widthCm
  item.overrideHeight = heightCm
  registerItem(parent, item)
  return so
}

// Smooth ease used for pop-in / fade animations.
export function easeOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return 1 - Math.pow(1 - c, 3)
}
