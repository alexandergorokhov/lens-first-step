// Runs the registered LEAF scenarios inside the Lens (no editor plugin needed) and prints one
// "[FYW-LEAF] RESULT <id> PASSED|FAILED <reason>" line per scenario plus a summary.
// Leave autoRun off for demos; turn it on (Inspector) to run the suite on preview reset.

import {DefaultScenarioManager} from "Leaf.lspkg/Scenarios/scenario/manager/DefaultLeafScenarioManager"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"

@component
export class FindYourWayLeafRunner extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">LEAF runner – runs the Find Your Way scenarios on start</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Run all registered scenarios when the Lens starts")
  autoRun: boolean = false

  @input
  @hint("Comma-separated scenario ids to run (empty = all)")
  only: string = ""
  @ui.group_end

  onAwake() {
    if (!this.autoRun) return
    this.createEvent("OnStartEvent").bind(() => {
      this.runAll().catch((e) => print("[FYW-LEAF] RUNNER ERROR " + e))
    })
  }

  private async runAll(): Promise<void> {
    await sleep(2500)
    const manager = DefaultScenarioManager.getInstance()
    const wanted = this.only.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
    const ids = manager.listScenarioIds().filter((id) => wanted.length === 0 ? id.indexOf("visual-") !== 0 : wanted.indexOf(id) >= 0)
    print("[FYW-LEAF] START " + ids.length + " scenarios: " + ids.join(", "))
    let passed = 0
    for (const id of ids) {
      const t0 = getTime()
      try {
        await manager.startScenario(id)
        passed++
        print("[FYW-LEAF] RESULT " + id + " PASSED (" + (getTime() - t0).toFixed(1) + " s)")
      } catch (e) {
        print("[FYW-LEAF] RESULT " + id + " FAILED " + e)
      }
      await sleep(1000)
    }
    print("[FYW-LEAF] SUMMARY " + passed + "/" + ids.length + " passed")
  }
}
