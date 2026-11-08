# Makes the demo video's voice-over clips (ROUND2.md R2-7) from the NARRATION lines in
# src/core/narration.ts with Kokoro (voice af_heart, as the companion), into
# devpost/video/narration/NN.wav, and writes lengths.json (seconds, by NARRATION index) for the mix.
#   pip install kokoro-onnx soundfile   (Python 3.10+; model files as in make-clips.py)
#   python tools/voice/make-narration.py <folder with kokoro-v1.0.onnx and voices-v1.0.bin>
import json
import os
import re
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
SRC = os.path.join(ROOT, "src", "core", "narration.ts")
OUT = os.path.join(ROOT, "devpost", "video", "narration")


def lines():
    text = open(SRC, encoding="utf-8").read()
    block = text.split("export const NARRATION", 1)[1].split("];", 1)[0]
    return re.findall(r'\{ beat: "([^"]+)", line: "([^"]+)" \}', block)


def main():
    models = sys.argv[1] if len(sys.argv) > 1 else "."
    kokoro = Kokoro(os.path.join(models, "kokoro-v1.0.onnx"), os.path.join(models, "voices-v1.0.bin"))
    os.makedirs(OUT, exist_ok=True)
    lengths = []
    for i, (beat, line) in enumerate(lines()):
        samples, rate = kokoro.create(line, voice="af_heart", speed=1.0, lang="en-us")
        loud = np.where(np.abs(samples) > 0.01)[0]
        if len(loud):
            samples = samples[max(0, loud[0] - int(0.03 * rate)): loud[-1] + int(0.08 * rate)]
        fade = int(0.01 * rate)
        samples[:fade] *= np.linspace(0, 1, fade)
        samples[-fade:] *= np.linspace(1, 0, fade)
        sf.write(os.path.join(OUT, "%02d.wav" % i), samples, rate, subtype="PCM_16")
        lengths.append(round(len(samples) / rate, 3))
        print("%02d %-34s %.2f s  %s" % (i, beat, lengths[-1], line))
    json.dump(lengths, open(os.path.join(OUT, "lengths.json"), "w"))


if __name__ == "__main__":
    main()
