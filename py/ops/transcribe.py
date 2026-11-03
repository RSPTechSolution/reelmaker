"""faster-whisper word timestamps on vo.wav, aligned to the script, plus loudness."""

import json
import os

import numpy as np
import soundfile as sf

from ops.align import align
from ops.loudness import loudness

_model = None


def get_model():
    """WhisperModel small on CPU (int8), created once per worker."""
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        _model = WhisperModel("small", device="cpu", compute_type="int8")
    return _model


WHISPER_SR = 16000


def load_16k(wav: str) -> np.ndarray:
    """Mono float32 at 16 kHz for Whisper.

    Read with soundfile and resampled here (band-limited FFT resample) instead of letting
    faster-whisper decode through PyAV: faster-whisper 1.2.1 calls av.open(metadata_errors=...),
    which PyAV 19 removed.
    """
    audio, sr = sf.read(wav, dtype="float32", always_2d=True)
    audio = audio.mean(axis=1)
    if sr != WHISPER_SR and len(audio):
        n_out = round(len(audio) * WHISPER_SR / sr)
        spectrum = np.fft.rfft(audio)[: n_out // 2 + 1]
        audio = np.fft.irfft(spectrum, n_out) * (n_out / len(audio))
    return audio.astype(np.float32)


def transcribe_words(wav: str, prompt: str, progress=None) -> tuple[list[dict], float]:
    segments, info = get_model().transcribe(
        load_16k(wav),
        language="hi",
        word_timestamps=True,
        initial_prompt=prompt or None,
        vad_filter=False,
    )
    words = []
    for seg in segments:  # generator: transcription happens while iterating
        for w in seg.words or []:
            words.append({"word": w.word, "start": float(w.start), "end": float(w.end)})
        if progress and info.duration:
            progress(min(0.9, 0.9 * seg.end / info.duration), "transcribing")
    return words, float(info.duration)


def timing(args: dict, progress=None) -> dict:
    dir_ = args["dir"]
    vo = os.path.join(dir_, "vo.wav")
    if not os.path.exists(vo):
        raise RuntimeError("vo.wav not found — run the Voice step first")
    if progress:
        progress(0.0, "loading whisper")
    whisper_words, audio_end = transcribe_words(vo, args.get("prompt", ""), progress)

    windows = args.get("windows")
    report = align(args["words"], whisper_words, [tuple(w) for w in windows] if windows else None, audio_end)
    with open(os.path.join(dir_, "words.json"), "w", encoding="utf-8") as f:
        json.dump(report["words"], f, ensure_ascii=False)

    if progress:
        progress(0.95, "loudness")
    loudness({"wav": vo, "out": os.path.join(dir_, "loudness.json"), "fps": 30})
    if progress:
        progress(1.0, "captions ready")
    return {k: v for k, v in report.items() if k != "words"}
