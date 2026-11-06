// One look: no dark panel (black is see-through on Specs), text at 0.9 opacity or more, one job per
// colour, three glass opacities, and a 200 ms pop-in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { THEME, glass, luminance, popInScale } from "../theme.ts";

test("TH1 no panel is darker than 0.5 luminance, at any of its three opacities", () => {
  for (const k of ["card", "panel", "tab"] as const) assert.ok(luminance(glass(k)) >= 0.5, k + " " + luminance(glass(k)));
  assert.equal(Object.keys(THEME.glassAlpha).length, 3);
});

test("TH2 every text colour is at least 0.9 opaque and bright", () => {
  for (const c of [THEME.text, THEME.textSoft]) {
    assert.ok(c[3] >= 0.9);
    assert.ok(luminance(c) >= 0.9);
  }
});

test("TH3 one colour per job: route, step-free, changed, arrived and sponsored all differ and are bright", () => {
  const cs = [THEME.route, THEME.stepFree, THEME.changed, THEME.arrived, THEME.sponsored];
  for (let i = 0; i < cs.length; i++) {
    assert.ok(luminance(cs[i]) >= 0.5, "bright " + i);
    for (let j = i + 1; j < cs.length; j++) assert.notDeepEqual(cs[i], cs[j]);
  }
});

test("TH4 panels pop in over 200 ms: from 0.92 to full size, eased, never past it", () => {
  assert.equal(THEME.popInS, 0.2);
  assert.equal(popInScale(0), 0.92);
  assert.ok(popInScale(0.1) > 0.96 && popInScale(0.1) < 1);
  assert.equal(popInScale(0.2), 1);
  assert.equal(popInScale(5), 1);
});
