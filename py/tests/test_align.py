import random

from ops.align import align


def script(*lines: str) -> list[dict]:
    """Script words from spoken lines (caption = spoken here; only spoken is matched)."""
    out = []
    for li, text in enumerate(lines):
        for w in text.split():
            out.append({"i": len(out), "caption": w, "spoken": w, "line": li})
    return out


def ww(word: str, start: float, end: float) -> dict:
    return {"word": word, "start": start, "end": end}


def assert_monotonic(words):
    for k, w in enumerate(words):
        assert w["start"] <= w["end"], (k, w)
        if k + 1 < len(words):
            assert w["end"] <= words[k + 1]["start"], (k, w, words[k + 1])


def test_exact_match():
    s = script("एआई से वीडियो")
    whisper = [ww(" एआई", 0.1, 0.4), ww(" से", 0.4, 0.6), ww(" वीडियो", 0.6, 1.1)]
    r = align(s, whisper, None, 1.5)
    assert r["matched"] == 3 and r["filled"] == 0 and r["filledRanges"] == []
    assert [(w["start"], w["end"]) for w in r["words"]] == [(0.1, 0.4), (0.4, 0.6), (0.6, 1.1)]
    assert [w["i"] for w in r["words"]] == [0, 1, 2]
    assert all(w["filled"] is False for w in r["words"])
    assert r["words"][0]["caption"] == "एआई" and r["words"][0]["spoken"] == "एआई"


def test_fills_skipped_words():
    s = script("एआई से वीडियो")
    whisper = [ww("एआई", 0.1, 0.4), ww("वीडियो", 0.7, 1.1)]
    r = align(s, whisper, None, 1.5)
    assert r["matched"] == 2 and r["filled"] == 1
    mid = r["words"][1]
    assert mid["filled"] is True
    assert mid["start"] == 0.4 and mid["end"] == 0.7
    assert r["filledRanges"] == [[1, 1, 0.4, 0.7]]


def test_fill_splits_gap_by_spoken_length():
    s = script("शुरू क खखखख अंत")  # Whisper misses the middle two
    whisper = [ww("शुरू", 0.0, 0.5), ww("अंत", 1.5, 2.0)]
    r = align(s, whisper, None, 2.0)
    a, b = r["words"][1], r["words"][2]
    assert a["start"] == 0.5 and b["end"] == 1.5
    assert a["end"] == b["start"]
    assert (b["end"] - b["start"]) > 3 * (a["end"] - a["start"])  # 4 chars vs 1 char


def test_normalises_punctuation_and_danda():
    s = script("Step वन: एआई।")
    whisper = [ww(" step", 0.0, 0.3), ww(" वन", 0.3, 0.6), ww(" एआई", 0.6, 1.0)]
    r = align(s, whisper, None, 1.2)
    assert r["matched"] == 3
    assert r["words"][2]["caption"] == "एआई।"  # script spelling is kept


def test_times_are_monotonic():
    tokens = "एक दो तीन चार पांच छह सात आठ नौ दस ग्यारह बारह".split()
    for seed in range(25):
        rnd = random.Random(seed)
        s = script(" ".join(tokens))
        whisper = []
        for k, t in enumerate(tokens):
            if rnd.random() < 0.2:
                continue  # whisper skipped it
            start = max(0.0, k * 0.3 + rnd.uniform(-0.25, 0.25))
            whisper.append(ww(t, start, start + rnd.uniform(0.0, 0.7)))
        whisper.sort(key=lambda w: w["start"])
        r = align(s, whisper, None, 4.0)
        assert len(r["words"]) == len(tokens)
        assert_monotonic(r["words"])
        assert r["matched"] + r["filled"] == len(tokens)


def test_windows_restrict_matching():
    # Whisper missed line 0 entirely; its only "नमस्ते" is in line 1's window.
    s = script("नमस्ते दोस्तों", "नमस्ते")
    whisper = [ww("नमस्ते", 1.2, 1.6)]
    r = align(s, whisper, [(0.0, 1.0), (1.15, 1.8)], 1.8)
    w = r["words"]
    assert w[2]["filled"] is False and w[2]["start"] == 1.2
    assert w[0]["filled"] is True and w[1]["filled"] is True
    assert w[0]["start"] == 0.0 and w[1]["end"] == 1.0
    assert r["filledRanges"] == [[0, 1, 0.0, 1.0]]
    assert_monotonic(w)


def test_no_whisper_words():
    s = script("कक खख", "गग घघ ङङ")
    r = align(s, [], [(0.0, 1.0), (1.15, 2.65)], 2.65)
    w = r["words"]
    assert r["matched"] == 0 and r["filled"] == 5
    assert [(x["start"], x["end"]) for x in w[:2]] == [(0.0, 0.5), (0.5, 1.0)]
    assert [(x["start"], x["end"]) for x in w[2:]] == [(1.15, 1.65), (1.65, 2.15), (2.15, 2.65)]
    assert r["filledRanges"] == [[0, 4, 0.0, 2.65]]


def test_no_whisper_words_without_windows():
    s = script("कक खख गग घघ")
    r = align(s, [], None, 2.0)
    assert [(x["start"], x["end"]) for x in r["words"]] == [(0.0, 0.5), (0.5, 1.0), (1.0, 1.5), (1.5, 2.0)]


def test_empty_script():
    r = align([], [ww("x", 0, 1)], None, 1.0)
    assert r == {"words": [], "matched": 0, "filled": 0, "filledRanges": []}
