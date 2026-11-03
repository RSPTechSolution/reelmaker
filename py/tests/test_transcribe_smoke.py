import json

import pytest

from ops.transcribe import timing
from ops.tts import tts

LINES = [{"id": "l1", "spoken": "नमस्ते दोस्तों"}, {"id": "l2", "spoken": "आज हम सीखेंगे"}]


def _words():
    out = []
    for li, line in enumerate(LINES):
        for w in line["spoken"].split():
            out.append({"i": len(out), "caption": w, "spoken": w, "line": li})
    return out


@pytest.mark.slow
def test_timing_end_to_end(tmp_path):
    voiced = tts({"lines": LINES, "voice": "hf_alpha", "speed": 1.0, "dir": str(tmp_path)})
    steps = []
    report = timing(
        {
            "dir": str(tmp_path),
            "words": _words(),
            "windows": voiced["windows"],
            "prompt": " ".join(l["spoken"] for l in LINES),
        },
        lambda p, m="": steps.append(p),
    )
    words = json.loads((tmp_path / "words.json").read_text(encoding="utf-8"))
    assert len(words) == 5
    assert report["matched"] >= 3, report
    assert "words" not in report
    assert report["matched"] + report["filled"] == 5
    for a, b in zip(words, words[1:]):
        assert a["start"] <= a["end"] <= b["start"]
    loud = json.loads((tmp_path / "loudness.json").read_text(encoding="utf-8"))
    assert len(loud) > 0 and max(loud) > 0.5
    assert steps and steps[-1] == 1.0
