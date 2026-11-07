// FindYourWayCompanionSays — the companion speaks (add-on A): plays one pre-made clip at a time through
// one AudioComponent and shows the same words as a small caption at the companion.
// Created at runtime by FindYourWayMain, which says when (speechFor) and where the companion is.
// The clips are Assets/Voice/<key>.wav (tools/voice/make-clips.py), given to Main as `voiceClips`.
// Must not: decide what to say or when (FindYourWaySpeech.ts: speechFor and SpeechGate).

import {SPEECH_LINES, SpeechGate} from "./FindYourWaySpeech"
import {addText, obj} from "./FindYourWayWidgetsUI"
import {TRANSCRIPT} from "./FindYourWayCaptions"

// The caption stays this long after the clip ends (s); its size, and its height over the companion's feet (cm):
// just over a dog or robot, below eye level.
const CAPTION_AFTER_S = 0.8
// About 2x the v2 size (TRANSCRIPT.companion, R2-6).
const CAPTION_W = TRANSCRIPT.companion.widthCm
const CAPTION_H = TRANSCRIPT.companion.heightCm
const CAPTION_ABOVE_CM = 55
// Read at about this distance (cm): the companion walks a metre or two ahead.
const CAPTION_DISTANCE_CM = 200
const MIN_CLIP_S = 0.8

@component
export class FindYourWayCompanionSays extends BaseScriptComponent {
  readonly gate = new SpeechGate()
  private audio: AudioComponent
  private clips: {[key: string]: AudioTrackAsset} = {}
  private caption: Text
  private captionRoot: SceneObject
  private captionUntil = 0
  private said: string[] = []

  setup(clips: AudioTrackAsset[]): void {
    for (const c of clips || []) if (c) this.clips[c.name.replace(/\.(wav|mp3)$/i, "")] = c
    this.audio = this.sceneObject.createComponent("Component.AudioComponent") as AudioComponent
    try { this.audio.playbackMode = Audio.PlaybackMode.LowLatency } catch (e) { /* editor */ }
    this.captionRoot = obj(this.sceneObject, "CompanionSaysCaption")
    this.caption = addText(this.captionRoot, "CompanionSaysText", "", "Caption", CAPTION_W, CAPTION_H, new vec4(1, 1, 1, 1), CAPTION_DISTANCE_CM * TRANSCRIPT.companion.scale)
    this.caption.text = ""
    this.captionRoot.enabled = false
    this.createEvent("UpdateEvent").bind(() => {
      if (this.captionRoot.enabled && getTime() > this.captionUntil) this.captionRoot.enabled = false
    })
  }

  // Says the line when the gate lets it (not muted, not speaking, not said in the last 8 s). at is the
  // companion's place in this object's parent space (cm), faceTo the user's; null keeps the last place.
  say(key: string | null, at: vec3 | null, faceTo: vec3 | null): boolean {
    const clip = key ? this.clips[key] : null
    // The clips run about 0.06 s a character (tools/voice/make-clips.py prints each length).
    const seconds = key && SPEECH_LINES[key] ? Math.max(MIN_CLIP_S, SPEECH_LINES[key].length * 0.06) : MIN_CLIP_S
    if (!this.gate.say(key, getTime(), seconds)) return false
    const k = key as string
    this.said.push(k)
    print("[FYW] companion says: " + k)
    if (clip) {
      this.audio.audioTrack = clip
      this.audio.play(1)
    }
    this.caption.text = SPEECH_LINES[k]
    this.captionUntil = getTime() + seconds + CAPTION_AFTER_S
    if (at) {
      const t = this.captionRoot.getTransform()
      t.setLocalPosition(at.add(new vec3(0, CAPTION_ABOVE_CM, 0)))
      if (faceTo) {
        const d = faceTo.sub(at)
        const flat = new vec3(d.x, 0, d.z)
        if (flat.length > 0.01) t.setLocalRotation(quat.lookAt(flat.normalize(), vec3.up()))
      }
    }
    this.captionRoot.enabled = true
    return true
  }

  setMuted(muted: boolean): void {
    this.gate.muted = muted
    if (muted) {
      if (this.audio && this.audio.isPlaying()) this.audio.stop(false)
      if (this.captionRoot) this.captionRoot.enabled = false
    }
  }

  isMuted(): boolean { return this.gate.muted }

  reset(): void {
    this.gate.reset()
    this.said = []
    if (this.audio && this.audio.isPlaying()) this.audio.stop(false)
    if (this.captionRoot) this.captionRoot.enabled = false
  }

  // Tests: what was said since the last reset, the caption shown, and whether a clip is loaded.
  getSaid(): string[] { return this.said.slice() }
  getCaption(): string | null { return this.captionRoot && this.captionRoot.enabled ? this.caption.text : null }
  hasClip(key: string): boolean { return !!this.clips[key] }
  clipCount(): number { return Object.keys(this.clips).length }
}
