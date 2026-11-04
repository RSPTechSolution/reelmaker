import hashlib
import os

import numpy as np
import soundfile as sf

from ops.assets import ASSETS_VERSION, MUSIC, SFX, assets

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
    for rel in ["sfx/swipe.wav", "sfx/ding.wav", "music/builtin-lofi.wav"]:
        h = [hashlib.sha1((d / rel).read_bytes()).hexdigest() for d in (a, b)]
        assert h[0] == h[1], rel


def test_assets_keeps_existing_files(tmp_path):
    assets({"dir": str(tmp_path)})
    f = tmp_path / "sfx" / "tick.wav"
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


def test_upgrades_old_sound_sets(tmp_path):
    """A folder made by an older version (no version file, old whoosh/pop) is regenerated."""
    (tmp_path / "sfx").mkdir()
    (tmp_path / "music").mkdir()
    for old in ["whoosh", "pop"]:
        sf.write(str(tmp_path / "sfx" / f"{old}.wav"), np.zeros(100, dtype=np.float32), SR)
    sf.write(str(tmp_path / "sfx" / "ding.wav"), np.zeros(100, dtype=np.float32), SR)  # stale content
    assets({"dir": str(tmp_path)})
    assert not (tmp_path / "sfx" / "whoosh.wav").exists()
    assert not (tmp_path / "sfx" / "pop.wav").exists()
    ding, _ = _info(tmp_path / "sfx" / "ding.wav")
    assert len(ding) > 1000  # rewritten, not the stale 100-sample file
    assert (tmp_path / "version.txt").read_text().strip() == str(ASSETS_VERSION)


def test_scene_change_sound_is_soft(tmp_path):
    """The swipe plays on every scene change, so it must not be hissy (the old whoosh was 75% treble)."""
    assets({"dir": str(tmp_path)})
    x, sr = _info(tmp_path / "sfx" / "swipe.wav")
    X = np.abs(np.fft.rfft(x))
    f = np.fft.rfftfreq(len(x), 1 / sr)
    assert X[f > 3000].sum() / X.sum() < 0.3
