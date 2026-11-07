// FindYourWayLiveCaptions — live captions for people who are deaf or hard of hearing: speech around
// the wearer as at most two rows at the bottom of the view (FindYourWayHudUI), translated into the
// wearer's language by an LLM when one is set (`translator`, on Specs through Snap's Remote Service
// Gateway). Speech comes from Snap's ASR (Specs only). The preview has no microphone: playDemo() shows a
// scripted announcement, labelled as such. Must not: route or decide anything; it only shows words.

import {CaptionFeed, DEMO_SPEAKER, demoSpeechFor, parseTranslation, translatePrompt} from "./FindYourWayCaptions"
import {FindYourWayHudUI} from "./FindYourWayHudUI"

export type Translator = (prompt: string) => Promise<string>

const LANGS: {[code: string]: string} = {es: "Spanish", fr: "French", de: "German", it: "Italian", pt: "Portuguese", en: "English"}
// The demo announcement types in over this long (s), then shows its translation.
const DEMO_TYPE_S = 3.2
const DEMO_HOLD_S = 0.8

export class FindYourWayLiveCaptions {
  // On Specs: set to an LLM call to translate; null shows what was heard as it was.
  translator: Translator | null = null
  // Every final line shown, in the wearer's language (Main checks it for a gate change; add-on D).
  onFinal: ((text: string) => void) | null = null
  private feed = new CaptionFeed()
  private lang = ""
  private on = false
  private asr: AsrModule | null = null
  private listening = false
  private demo: {heard: string; english: string; lang: string; t0: number; translated: boolean; who: string} | null = null
  private demoEndsAt = 0

  constructor(private hud: FindYourWayHudUI, private target: string = "English") {}

  // Listen while on (Specs only: the preview has no ASR).
  setOn(on: boolean): void {
    if (on === this.on) return
    this.on = on
    if (!on) {
      this.stopAsr()
      this.feed.push("", true, -100)
      this.hud.setCaptions([], "")
      return
    }
    if (!global.deviceInfoSystem.isEditor()) this.startAsr()
  }

  isOn(): boolean { return this.on }

  // A restart: nothing playing, nothing shown (the next trip starts with no leftover lines).
  reset(): void {
    this.demo = null
    this.demoEndsAt = 0
    this.feed.push("", true, -100)
    this.hud.setCaptions([], "")
  }

  // The preview's scripted announcement for this map (airport: Spanish; mall: French).
  playDemo(mapKey: string, gateCode: string | null = null): void {
    const d = demoSpeechFor(mapKey, gateCode)
    if (d) this.playScript({heard: d.heard, english: d.english, lang: d.lang, who: DEMO_SPEAKER[mapKey] || ""})
  }

  // Any scripted line (the preview's sample gate announcement too): typed in, then its translation.
  playScript(d: {heard: string; english: string; lang: string; who: string}): void {
    if (!this.on) return
    this.demo = {heard: d.heard, english: d.english, lang: d.lang, t0: getTime(), translated: false, who: d.who}
    this.demoEndsAt = getTime() + DEMO_TYPE_S + DEMO_HOLD_S
  }

  // The scripted speaker is talking (its words still coming in).
  isDemoSpeaking(): boolean { return getTime() < this.demoEndsAt }

  tick(): void {
    if (!this.on) return
    const now = getTime()
    if (this.demo) {
      const t = now - this.demo.t0
      const words = this.demo.heard.split(" ")
      const name = LANGS[this.demo.lang] || this.demo.lang
      if (t < DEMO_TYPE_S) {
        const n = Math.max(1, Math.ceil((words.length * t) / DEMO_TYPE_S))
        this.feed.push(words.slice(0, n).join(" "), false, now)
        this.lang = (this.demo.who ? this.demo.who + "  ·  " : "") + name + "  ·  preview demo"
      } else if (t >= DEMO_TYPE_S + DEMO_HOLD_S && !this.demo.translated) {
        this.demo.translated = true
        this.feed.push(this.demo.english, true, now)
        if (this.onFinal) this.onFinal(this.demo.english)
        this.lang = (this.demo.who ? this.demo.who + "  ·  " : "") + name + " → " + this.target + "  ·  preview demo"
      } else if (t < DEMO_TYPE_S + DEMO_HOLD_S) {
        this.feed.push(this.demo.heard, false, now)
      }
      if (this.demo.translated) this.demo = null
    }
    this.hud.setCaptions(this.feed.rows(now), this.lang)
  }

  private startAsr(): void {
    if (this.listening) return
    try {
      if (!this.asr) this.asr = require("LensStudio:AsrModule") as AsrModule
      const o = AsrModule.AsrTranscriptionOptions.create()
      o.silenceUntilTerminationMs = 900
      o.mode = AsrModule.AsrMode.HighAccuracy
      o.onTranscriptionUpdateEvent.add((e: AsrModule.TranscriptionUpdateEvent) => this.heard(e.text, e.isFinal))
      o.onTranscriptionErrorEvent.add((code: AsrModule.AsrStatusCode) => print("[FYW] captions: ASR error " + code))
      this.asr.startTranscribing(o)
      this.listening = true
    } catch (e) {
      print("[FYW] captions: no ASR here (" + e + ")")
    }
  }

  private stopAsr(): void {
    if (!this.listening || !this.asr) return
    this.listening = false
    try { this.asr.stopTranscribing().catch(() => {}) } catch (e) { /* none */ }
  }

  private heard(text: string, final: boolean): void {
    if (!this.on) return
    this.feed.push(text, final && !this.translator, getTime())
    this.lang = ""
    if (final && !this.translator && this.onFinal) this.onFinal(text)
    if (!final || !this.translator) return
    this.translator(translatePrompt(text, this.target)).then((reply) => {
      const t = parseTranslation(reply)
      this.feed.push(t || text, true, getTime())
      this.lang = t && t !== text ? "→ " + this.target : ""
      if (this.onFinal) this.onFinal(t || text)
    }).catch(() => this.feed.push(text, true, getTime()))
  }
}
