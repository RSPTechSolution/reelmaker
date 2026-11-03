"""Per-frame loudness (0-1) used to open the mascot's mouth."""

import json
import math

import numpy as np
import soundfile as sf


def frame_loudness(samples: np.ndarray, sr: int, fps: int) -> list[float]:
    if samples.ndim > 1:
        samples = samples.mean(axis=1)
    hop = sr / fps
    frames = math.ceil(len(samples) / hop)
    rms = np.zeros(frames, dtype=np.float64)
    for k in range(frames):
        chunk = samples[round(k * hop) : round((k + 1) * hop)]
        if len(chunk):
            rms[k] = math.sqrt(float(np.mean(np.square(chunk, dtype=np.float64))))

    ref = float(np.percentile(rms, 95)) if frames else 0.0
    if ref <= 1e-9:
        return [0.0] * frames
    norm = np.clip(rms / ref, 0.0, 1.0)
    # 2-frame moving average smooths mouth flicker
    smooth = (norm + np.concatenate(([norm[0]], norm[:-1]))) / 2
    return [round(float(v), 4) for v in smooth]


def loudness(args: dict, progress=None) -> dict:
    fps = int(args.get("fps", 30))
    samples, sr = sf.read(args["wav"], dtype="float32", always_2d=False)
    values = frame_loudness(samples, sr, fps)
    with open(args["out"], "w", encoding="utf-8") as f:
        json.dump(values, f)
    return {"frames": len(values)}
