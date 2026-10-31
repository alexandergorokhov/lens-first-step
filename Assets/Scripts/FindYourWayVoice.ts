// FindYourWayVoice — "Take me to…": speech to text through Snap's ASR module (needs internet).
// Owns: the listening session. Must not: match names or route (Main does, with the text it gets).

const SILENCE_MS = 1200

export class FindYourWayVoice {
  listening = false
  private asr: AsrModule | null = null

  // onText gets the live text (final = false) and the finished phrase (final = true).
  start(onText: (text: string, final: boolean) => void, onError: (why: string) => void): void {
    if (this.listening) return
    try {
      if (!this.asr) this.asr = require("LensStudio:AsrModule") as AsrModule
      const options = AsrModule.AsrTranscriptionOptions.create()
      options.silenceUntilTerminationMs = SILENCE_MS
      options.mode = AsrModule.AsrMode.HighAccuracy
      options.onTranscriptionUpdateEvent.add((e: AsrModule.TranscriptionUpdateEvent) => {
        if (this.listening) onText(e.text, e.isFinal)
      })
      options.onTranscriptionErrorEvent.add((code: AsrModule.AsrStatusCode) => {
        if (!this.listening) return
        this.stop()
        onError("ASR error " + code)
      })
      this.listening = true
      this.asr.startTranscribing(options)
    } catch (e) {
      this.listening = false
      onError("" + e)
    }
  }

  stop(): void {
    if (!this.listening) return
    this.listening = false
    if (!this.asr) return
    try {
      this.asr.stopTranscribing().catch((e) => print("[FYW] voice stop: " + e))
    } catch (e) {
      print("[FYW] voice stop: " + e)
    }
  }
}
