// The showing preset (REVIEW-FIXES.md section 0): one switch puts the Lens in the state Alex shows
// the judges, and Restart showing gets back to it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SHOWING, showingSettings, type StartSettings } from "../demo.ts";

const authored: StartSettings = {
  mapKey: "hospital",
  startAtSign: false,
  showDemoControls: true,
  companionModel: "robot",
  companionOnAtStart: false,
  preselect: null,
};

test("SH1 the preset: the shopping mall, start at the sign, demo controls hidden, the dog on, Walk preselected", () => {
  assert.deepEqual(SHOWING, {
    mapKey: "mall",
    startAtSign: true,
    showDemoControls: false,
    companionModel: "dog",
    companionOnAtStart: true,
    preselect: "walk",
  });
  assert.deepEqual(showingSettings(authored, true), SHOWING);
});

test("SH2 with the preset off the Inspector's own settings are kept", () => {
  assert.deepEqual(showingSettings(authored, false), authored);
  assert.notEqual(showingSettings(authored, false), authored, "a copy, not the same object");
});

test("SH3 the preset is a copy: changing what it returns never changes SHOWING", () => {
  const s = showingSettings(authored, true);
  s.companionModel = "rover";
  assert.equal(SHOWING.companionModel, "dog");
});
