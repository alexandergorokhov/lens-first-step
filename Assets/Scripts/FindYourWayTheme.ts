// One look for every panel, card and offer (POLISH-PLAN.md Task 2b). Pure data shared by the Lens and
// the Node tests: no imports and no Lens globals; the Lens keeps a byte-identical copy at
// Assets/Scripts/FindYourWayTheme.ts. Colours are [r, g, b, a] in 0..1.
// On Specs the display adds light: black is see-through, so no panel is dark. Each colour has one job.

export type RGBA = [number, number, number, number];

export const THEME = {
  // The route line and "you": teal.
  route: [0.3, 0.9, 0.85, 1] as RGBA,
  // Step-free: blue (always with the wheelchair icon).
  stepFree: [0.38, 0.62, 1, 1] as RGBA,
  // A plan that changed (gate moved, lift out): amber.
  changed: [1, 0.72, 0.28, 1] as RGBA,
  // Arrived: green.
  arrived: [0.42, 0.9, 0.55, 1] as RGBA,
  // Sponsored: gold, always with the word "Sponsored".
  sponsored: [1, 0.84, 0.35, 1] as RGBA,
  // Frosted glass panels at three opacities only: a card, a panel, a tab.
  glass: [0.36, 0.6, 0.68] as [number, number, number],
  glassAlpha: { card: 0.72, panel: 0.6, tab: 0.5 },
  // Text: warm white, never fainter than 0.9.
  text: [0.98, 0.96, 0.9, 1] as RGBA,
  textSoft: [0.98, 0.96, 0.9, 0.9] as RGBA,
  // Panels and boxes come in over this long (s), scaling up from this size.
  popInS: 0.2,
  popInFrom: 0.92,
};

export function luminance(c: number[]): number {
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function glass(kind: "card" | "panel" | "tab"): RGBA {
  return [THEME.glass[0], THEME.glass[1], THEME.glass[2], THEME.glassAlpha[kind]];
}

// The pop-in: the scale t seconds after a panel shows (eased, 1 when done).
export function popInScale(t: number): number {
  const f = Math.max(0, Math.min(1, t / THEME.popInS));
  const e = 1 - Math.pow(1 - f, 3);
  return THEME.popInFrom + (1 - THEME.popInFrom) * e;
}
