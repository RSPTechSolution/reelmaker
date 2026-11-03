import os
import time

import numpy as np
import pytest
import soundfile as sf

from ops.tts import GAP_SEC, SR, concat_lines, tts

LINES = [{"id": "l1", "spoken": "नमस्ते दोस्तों"}, {"id": "l2", "spoken": "आज हम सीखेंगे"}]


# ---------- fast: no model needed ----------


def _wav(path, seconds):
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), np.full(int(SR * seconds), 0.1, dtype=np.float32), SR)


def test_concat_lines_windows_and_gap(tmp_path):
    _wav(tmp_path / "lines" / "a.wav", 1.0)
    _wav(tmp_path / "lines" / "b.wav", 0.5)
    res = concat_lines(str(tmp_path), ["a", "b"])
    assert res["windows"] == [[0.0, 1.0], [1.15, 1.65]]
    assert res["duration"] == pytest.approx(1.65)
    data, sr = sf.read(str(tmp_path / "vo.wav"))
    assert sr == SR and len(data) == int(SR * 1.0) + int(SR * GAP_SEC) + int(SR * 0.5)
    gap = data[int(SR * 1.0) : int(SR * 1.15)]
    assert np.all(gap == 0)


def test_concat_lines_reports_missing_line(tmp_path):
    _wav(tmp_path / "lines" / "a.wav", 0.2)
    with pytest.raises(RuntimeError, match="line b has no audio"):
        concat_lines(str(tmp_path), ["a", "b"])


@pytest.mark.parametrize("bad", ["../x", "a/b", "a\\b", "CON", "nul", "COM1", "", "x" * 65])
def test_tts_rejects_unsafe_line_id(tmp_path, bad):
    with pytest.raises(ValueError, match="invalid line id"):
        tts({"lines": [{"id": bad, "spoken": "नमस्ते"}], "voice": "hf_alpha", "speed": 1.0, "dir": str(tmp_path)})


def test_tts_rejects_unknown_only_id(tmp_path):
    with pytest.raises(ValueError, match="unknown line id zz"):
        tts({"lines": LINES, "voice": "hf_alpha", "speed": 1.0, "dir": str(tmp_path), "only": ["zz"]})


# ---------- slow: real Kokoro on CPU ----------


@pytest.fixture(scope="module")
def voiced(tmp_path_factory):
    d = tmp_path_factory.mktemp("reel")
    steps = []
    res = tts(
        {"lines": LINES, "voice": "hf_alpha", "speed": 1.0, "dir": str(d)},
        lambda p, m="": steps.append((p, m)),
    )
    return d, res, steps


@pytest.mark.slow
def test_tts_writes_vo(voiced):
    d, res, steps = voiced
    vo = d / "vo.wav"
    assert vo.exists()
    info = sf.info(str(vo))
    assert info.samplerate == 24000
    line_secs = [sf.info(str(d / "lines" / f"{l['id']}.wav")).duration for l in LINES]
    assert all(s > 0.3 for s in line_secs)
    assert info.duration == pytest.approx(sum(line_secs) + 0.15, abs=0.05)
    assert res["duration"] == pytest.approx(info.duration, abs=0.01)
    assert len(res["windows"]) == 2
    assert res["windows"][1][0] == pytest.approx(res["windows"][0][1] + 0.15, abs=0.01)
    assert len(steps) >= 2  # progress per line


@pytest.mark.slow
def test_tts_only_regenerates_listed_line(voiced):
    d, _, _ = voiced
    l1, l2 = d / "lines" / "l1.wav", d / "lines" / "l2.wav"
    m1, m2 = os.stat(l1).st_mtime_ns, os.stat(l2).st_mtime_ns
    time.sleep(0.05)
    res = tts({"lines": LINES, "voice": "hf_alpha", "speed": 1.0, "dir": str(d), "only": ["l2"]})
    assert os.stat(l1).st_mtime_ns == m1
    assert os.stat(l2).st_mtime_ns != m2
    assert len(res["windows"]) == 2
