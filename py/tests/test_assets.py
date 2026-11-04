import hashlib
import os

import numpy as np
import soundfile as sf

from ops.assets import MUSIC, SFX, assets

SR = 44100


def _info(path):
    data, sr = sf.read(str(path), always_2d=False)
    return data, sr


def test_assets_writes_every_effect_and_beat(tmp_path):
    res = assets({"dir": str(tmp_path)})
    assert sorted(res["sfx"]) == sorted(SFX)
    assert sorted(res["music"]) == sorted(f"builtin-{m}.wav" for m in MUSIC)
    for name in SFX:
        data, sr = _info(tmp_path / "sfx" / f"{name}.wav")
        assert sr == SR
        assert 0.08 < len(data) / sr < 2.0, name
        assert np.max(np.abs(data)) <= 1.0
        assert np.sqrt(np.mean(data**2)) > 0.01, f"{name} is silent"
    for m in MUSIC:
        data, sr = _info(tmp_path / "music" / f"builtin-{m}.wav")
        assert sr == SR
        assert len(data) / sr >= 20, m  # long enough to loop under a reel
        assert np.max(np.abs(data)) <= 1.0
        assert np.sqrt(np.mean(data**2)) > 0.02, f"{m} is silent"


def test_assets_are_deterministic(tmp_path):
    a, b = tmp_path / "a", tmp_path / "b"
    assets({"dir": str(a)})
    assets({"dir": str(b)})
    for rel in ["sfx/whoosh.wav", "sfx/ding.wav", "music/builtin-lofi.wav"]:
        h = [hashlib.sha1((d / rel).read_bytes()).hexdigest() for d in (a, b)]
        assert h[0] == h[1], rel


def test_assets_keeps_existing_files(tmp_path):
    assets({"dir": str(tmp_path)})
    f = tmp_path / "sfx" / "pop.wav"
    before = os.stat(f).st_mtime_ns
    assets({"dir": str(tmp_path)})
    assert os.stat(f).st_mtime_ns == before


def test_beats_differ_from_each_other(tmp_path):
    assets({"dir": str(tmp_path)})
    tracks = [_info(tmp_path / "music" / f"builtin-{m}.wav")[0][: SR * 8] for m in MUSIC]
    for i in range(len(tracks)):
        for j in range(i + 1, len(tracks)):
            n = min(len(tracks[i]), len(tracks[j]))
            assert not np.allclose(tracks[i][:n], tracks[j][:n])
