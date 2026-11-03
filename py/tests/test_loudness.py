import json

import numpy as np
import soundfile as sf

from ops.loudness import loudness

SR = 24000


def _write(path, samples):
    sf.write(str(path), samples.astype(np.float32), SR)


def test_loudness_silence_is_zero(tmp_path):
    wav, out = tmp_path / "s.wav", tmp_path / "s.json"
    _write(wav, np.zeros(SR))
    res = loudness({"wav": str(wav), "out": str(out), "fps": 30})
    values = json.loads(out.read_text(encoding="utf-8"))
    assert res == {"frames": 30}
    assert len(values) == 30
    assert all(v == 0 for v in values)


def test_loudness_tone_is_high(tmp_path):
    wav, out = tmp_path / "t.wav", tmp_path / "t.json"
    t = np.arange(SR) / SR
    _write(wav, 0.5 * np.sin(2 * np.pi * 440 * t))
    loudness({"wav": str(wav), "out": str(out), "fps": 30})
    values = json.loads(out.read_text(encoding="utf-8"))
    assert len(values) == 30
    assert float(np.median(values)) > 0.8
    assert all(0 <= v <= 1 for v in values)


def test_loudness_follows_volume(tmp_path):
    # half a second quiet, half a second loud: later frames must be louder
    wav, out = tmp_path / "v.wav", tmp_path / "v.json"
    t = np.arange(SR) / SR
    env = np.where(t < 0.5, 0.05, 0.5)
    _write(wav, env * np.sin(2 * np.pi * 220 * t))
    loudness({"wav": str(wav), "out": str(out), "fps": 30})
    values = json.loads(out.read_text(encoding="utf-8"))
    assert np.mean(values[18:]) > 5 * np.mean(values[:12])
