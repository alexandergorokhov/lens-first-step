// Live captions (add-on C in POLISH-PLAN.md): speech around the wearer, at most two rows at the bottom of
// the view, newest words kept, translated into the wearer's language by an LLM when it is another one.
// Pure logic shared by the Lens and the Node tests: no imports and no Lens globals; the Lens keeps a
// byte-identical copy at Assets/Scripts/FindYourWayCaptions.ts.

// The final words stay this long (s), then the captions clear.
export const CAPTION_HOLD_S = 4;
// Characters in a row (the bottom band is about this wide at its text size).
export const CAPTION_ROW_CHARS = 33;
// Width of one character (cm) per unit of Text size: the v2 band fit 44 characters on 26 cm at Body
// (39) seen at 70 cm, size 39 * 70 / 110.
export const CHAR_CM_PER_SIZE = 26 / 44 / (39 * 70 / 110);
// Height of one line (cm) per unit of Text size: a v2 caption row took 1.7 cm.
export const LINE_CM_PER_SIZE = 1.7 / (39 * 70 / 110);

// How many lines the text wraps to in widthCm at Text size `size` (word wrap; a new line starts a line).
export function textLines(text: string, widthCm: number, size: number): number {
  const chars = Math.max(1, Math.floor(widthCm / (CHAR_CM_PER_SIZE * size)));
  let n = 0;
  for (const para of text.split("\n")) n += Math.max(1, wrapCount(para, chars));
  return n;
}
function wrapCount(text: string, width: number): number {
  let n = 0;
  let row = 0;
  for (const w of text.split(/\s+/).filter((x) => x !== "")) {
    if (row === 0) { row = w.length; n++; }
    else if (row + 1 + w.length <= width) row += 1 + w.length;
    else { row = w.length; n++; }
  }
  return n;
}

// The transcript (ROUND2.md R2-6): text about twice the v2 size. scale multiplies the text role's size
// (live captions: Body at 70 cm; Heard: Headline2 at 100 cm; companion: Caption at 200 cm).
export const TRANSCRIPT = {
  captions: { scale: 2, rowWidthCm: 40, rowHeightCm: 3.4 },
  heard: { scale: 1.5, lines: 3, heightCm: 13.5 },
  companion: { scale: 2, widthCm: 100, heightCm: 16, rowChars: 30 },
};

// The words as rows of at most `width` characters; only the last two rows (the newest words).
export function captionRows(text: string, width: number = CAPTION_ROW_CHARS): string[] {
  const words = text.split(/\s+/).filter((w) => w !== "");
  const rows: string[] = [];
  let row = "";
  for (const w of words) {
    if (row === "") row = w;
    else if (row.length + 1 + w.length <= width) row += " " + w;
    else {
      rows.push(row);
      row = w;
    }
  }
  if (row !== "") rows.push(row);
  return rows.slice(-2);
}

// What is being said now: live words replace each other; a finished phrase stays CAPTION_HOLD_S.
export class CaptionFeed {
  private text = "";
  private finalAt: number | null = null;
  private width: number;

  constructor(width: number = CAPTION_ROW_CHARS) {
    this.width = width;
  }

  push(text: string, final: boolean, now: number): void {
    this.text = text;
    this.finalAt = final ? now : null;
  }

  rows(now: number): string[] {
    if (this.finalAt !== null && now - this.finalAt > CAPTION_HOLD_S) return [];
    return captionRows(this.text, this.width);
  }
}

// For the LLM: translate one caption into the wearer's language, nothing else.
export function translatePrompt(text: string, target: string): string {
  return "Translate what was said into " + target + ". Reply with the translation only, no quotes, no notes. " +
    "If it is already in " + target + ", reply with it unchanged.\n\n" + text;
}

// The LLM's reply as a caption: trimmed, outer quotes and a "Translation:" label removed; null if empty.
export function parseTranslation(reply: string): string | null {
  let t = reply.trim().replace(/^translation\s*:\s*/i, "").trim();
  if (t.length >= 2 && (t[0] === '"' || t[0] === "“") && (t[t.length - 1] === '"' || t[t.length - 1] === "”")) t = t.slice(1, -1).trim();
  return t === "" ? null : t;
}

// The preview has no microphone: a scripted announcement shows how the captions look (labelled as such).
// Who says it (the person standing in front of you as the caption shows).
export const DEMO_SPEAKER: { [map: string]: string } = { airport: "Gate agent", mall: "Host" };

export const DEMO_SPEECH: { [map: string]: { heard: string; lang: string; english: string } } = {
  airport: {
    heard: "Atención por favor: el vuelo 212 a Madrid embarca ahora por la puerta C12.",
    lang: "es",
    english: "Attention please: flight 212 to Madrid is now boarding at gate C12.",
  },
  mall: {
    heard: "Bonjour ! Une table pour deux ? Il y a de la place près de la fenêtre.",
    lang: "fr",
    english: "Hello! A table for two? There's room by the window.",
  },
};

// The scripted line for this map, its gate made the one you arrived at (code "B14"; null keeps it): the
// gate agent you meet speaks of your own gate, so it never sounds like a gate change.
export function demoSpeechFor(mapKey: string, gateCode: string | null): { heard: string; lang: string; english: string } | null {
  const d = DEMO_SPEECH[mapKey];
  if (!d) return null;
  if (!gateCode || mapKey !== "airport") return { heard: d.heard, lang: d.lang, english: d.english };
  return { heard: d.heard.replace(/puerta C12/, "puerta " + gateCode), lang: d.lang, english: d.english.replace(/gate C12/, "gate " + gateCode) };
}

// Add-on D: the preview's sample gate announcement (Spanish, shown in English), played from the Control
// panel. Its gate (B14) is not the demo trip's (C12), so Pathpal offers to re-route.
export const GATE_CHANGE_SPEECH = {
  heard: "Atención: el vuelo 212 a Madrid embarca ahora por la puerta B14.",
  lang: "es",
  english: "Attention: flight 212 to Madrid now boards at gate B14.",
  who: "Announcement",
};
