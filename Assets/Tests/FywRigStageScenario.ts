import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {RigMood, poseFor, rigOf} from "../Scripts/FindYourWayAnim"
import {LiveRig} from "../Scripts/FindYourWayRigMesh"
import {shadeTexture} from "../Scripts/FindYourWayStandIn"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {log, startTrip} from "./FindYourWayLeafSupport"

const STAGE_CM = new vec3(-5, -75, -260)
const SPACING_CM = 48
const TURN_DEG = 125
const MOOD_SECONDS = 9

// visual-rigs — all three companions in a row in front of the camera, close enough to judge how they
// move, through every mood. Not a test: "visual-" keeps it out of "all".
@component
export class FywRigStageScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1000)
    const main = await startTrip(new DefaultLeafInteractor(), "walk", 0, undefined, ["nav"], "mall")
    main.debugShowDemoControls(false)
    await sleep(500)
    const cam = main.getCameraWorldPos()
    const material = main.standIn.material
    const stage = global.scene.createSceneObject("RigStage")
    const materialFor = (c: vec4): Material => {
      const m = material.clone()
      m.mainPass.baseTex = shadeTexture()
      m.mainPass.baseColor = c
      m.mainPass.blendMode = BlendMode.Disabled
      m.mainPass.depthWrite = true
      m.mainPass.twoSided = true
      return m
    }
    const rigs = ["dog", "robot", "rover"].map((id, i) => {
      const so = global.scene.createSceneObject("Stage_" + id)
      so.setParent(stage)
      const t = so.getTransform()
      t.setWorldPosition(new vec3(cam.x + STAGE_CM.x + (i - 1) * SPACING_CM, cam.y + STAGE_CM.y, cam.z + STAGE_CM.z))
      t.setLocalRotation(quat.angleAxis((TURN_DEG * Math.PI) / 180, vec3.up()))
      return {id, rig: new LiveRig(so, rigOf(id), materialFor)}
    })
    const beats: [RigMood, number][] = [["lead", 1.4], ["run", 2.4], ["point", 0], ["sit", 0], ["wait", 0], ["arrived", 0]]
    let travelled = 0
    for (const [mood, speedMs] of beats) {
      log("RIG " + mood)
      const t0 = getTime()
      while (getTime() - t0 < MOOD_SECONDS) {
        travelled += speedMs * getDeltaTime()
        for (const r of rigs) r.rig.apply(poseFor(r.id, {mood, speedMs, travelledM: travelled, t: getTime()}))
        await sleep(1)
      }
    }
    stage.destroy()
    log("rigs done")
  }
}
