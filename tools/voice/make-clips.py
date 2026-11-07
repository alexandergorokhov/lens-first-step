# Makes the companion's voice clips (add-on A) from the lines in src/core/speech.ts with Kokoro
# (open TTS, voice af_heart, the same as the narration), into Assets/Voice/<key>.wav.
#   pip install kokoro-onnx soundfile   (Python 3.10+)
#   download kokoro-v1.0.onnx and voices-v1.0.bin from
#   https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
#   python tools/voice/make-clips.py <folder with the two model files>
import os
import re
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
SRC = os.path.join(ROOT, "src", "core", "speech.ts")
OUT = os.path.join(ROOT, "Assets", "Voice")


def lines():
    text = open(SRC, encoding="utf-8").read()
    block = text.split("export const SPEECH_LINES", 1)[1].split("};", 1)[0]
    return re.findall(r'^\s*(\w+): "([^"]+)",', block, re.M)


def main():
    models = sys.argv[1] if len(sys.argv) > 1 else "."
    kokoro = Kokoro(os.path.join(models, "kokoro-v1.0.onnx"), os.path.join(models, "voices-v1.0.bin"))
    os.makedirs(OUT, exist_ok=True)
    for key, line in lines():
        samples, rate = kokoro.create(line, voice="af_heart", speed=1.0, lang="en-us")
        # Trim the silence at both ends, then a short fade so clips never click.
        loud = np.where(np.abs(samples) > 0.01)[0]
        if len(loud):
            samples = samples[max(0, loud[0] - int(0.03 * rate)): loud[-1] + int(0.08 * rate)]
        fade = int(0.01 * rate)
        samples[:fade] *= np.linspace(0, 1, fade)
        samples[-fade:] *= np.linspace(1, 0, fade)
        sf.write(os.path.join(OUT, key + ".wav"), samples, rate, subtype="PCM_16")
        print(key, "%.2f s" % (len(samples) / rate), line)


if __name__ == "__main__":
    main()
