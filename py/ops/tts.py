"""Kokoro TTS: one WAV per script line, joined into vo.wav with a short gap."""

import os
import re

import numpy as np
import soundfile as sf

SR = 24000
GAP_SEC = 0.15
REPO_ID = "hexgrad/Kokoro-82M"

# Same rule as SafeId in packages/shared: ids become file names.
_SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_RESERVED = re.compile(r"^(con|prn|aux|nul|com[0-9]|lpt[0-9])$", re.IGNORECASE)

_pipeline = None


def check_line_id(line_id) -> str:
    if not isinstance(line_id, str) or not _SAFE_ID.match(line_id) or _RESERVED.match(line_id):
        raise ValueError(f"invalid line id {line_id!r}")
    return line_id


def get_pipeline():
    """KPipeline(lang_code='h'), created once per worker."""
    global _pipeline
    if _pipeline is None:
        try:
            from kokoro import KPipeline

            _pipeline = KPipeline(lang_code="h", repo_id=REPO_ID)
        except Exception as e:
            if "espeak" in str(e).lower():
                raise RuntimeError("espeak-ng not found — install it (see README)") from e
            raise
    return _pipeline


def synthesize(text: str, voice: str, speed: float) -> np.ndarray:
    """All audio chunks the generator yields for one line, joined."""
    chunks = []
    try:
        for result in get_pipeline()(text, voice=voice, speed=speed):
            if result.audio is not None:
                chunks.append(result.audio.detach().cpu().numpy().astype(np.float32))
    except RuntimeError:
        raise
    except Exception as e:
        if "espeak" in str(e).lower():
            raise RuntimeError("espeak-ng not found — install it (see README)") from e
        raise
    return np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.float32)


def _write_wav(path: str, audio: np.ndarray) -> None:
    tmp = path + ".tmp.wav"
    sf.write(tmp, audio, SR, subtype="PCM_16")
    os.replace(tmp, path)


def concat_lines(dir_: str, ids: list[str]) -> dict:
    """Join lines/<id>.wav in order with GAP_SEC silence into vo.wav; return line windows."""
    gap = np.zeros(int(SR * GAP_SEC), dtype=np.float32)
    parts, windows = [], []
    t = 0
    for k, line_id in enumerate(ids):
        path = os.path.join(dir_, "lines", f"{line_id}.wav")
        if not os.path.exists(path):
            raise RuntimeError(f"line {line_id} has no audio yet — generate all lines")
        audio, sr = sf.read(path, dtype="float32", always_2d=False)
        if sr != SR:
            raise RuntimeError(f"line {line_id} has sample rate {sr}, expected {SR}")
        if k > 0:
            parts.append(gap)
            t += len(gap)
        windows.append([round(t / SR, 3), round((t + len(audio)) / SR, 3)])
        parts.append(audio)
        t += len(audio)
    _write_wav(os.path.join(dir_, "vo.wav"), np.concatenate(parts) if parts else np.zeros(0, np.float32))
    return {"windows": windows, "duration": round(t / SR, 3)}


def tts(args: dict, progress=None) -> dict:
    lines = args["lines"]
    ids = [check_line_id(l["id"]) for l in lines]
    if len(set(ids)) != len(ids):
        raise ValueError("duplicate line ids")
    only = args.get("only")
    if only is not None:
        for line_id in only:
            if line_id not in ids:
                raise ValueError(f"unknown line id {line_id}")
    todo = [l for l in lines if only is None or l["id"] in only]

    dir_ = args["dir"]
    os.makedirs(os.path.join(dir_, "lines"), exist_ok=True)
    voice, speed = args["voice"], float(args["speed"])
    for k, line in enumerate(todo):
        if progress:
            progress(k / (len(todo) + 1), f"voice line {k + 1}/{len(todo)}")
        audio = synthesize(line["spoken"], voice, speed)
        _write_wav(os.path.join(dir_, "lines", f"{line['id']}.wav"), audio)

    result = concat_lines(dir_, ids)
    if progress:
        progress(1.0, "voice ready")
    return result
