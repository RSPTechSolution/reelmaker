"""Map Whisper word timestamps onto the script's words.

The script decides the words and their spelling; Whisper only supplies times. Script words
Whisper missed or misheard are "filled": the free gap around them is split in proportion
to their spoken length.
"""

import difflib
import unicodedata

ROUND = 3


def normalise(word: str) -> str:
    """NFC, lowercase, without punctuation/symbols (incl. the danda ।)."""
    text = unicodedata.normalize("NFC", word).lower()
    return "".join(ch for ch in text if not unicodedata.category(ch)[0] in "PSZ")


def _match_group(script_idx, script_words, whisper, times):
    """SequenceMatcher on normalised tokens; equal blocks copy Whisper times into `times`."""
    a = [normalise(script_words[k]["spoken"]) for k in script_idx]
    b = [normalise(w["word"]) for w in whisper]
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    for block in sm.get_matching_blocks():
        for off in range(block.size):
            if not a[block.a + off]:
                continue  # pure punctuation never counts as a match
            w = whisper[block.b + off]
            times[script_idx[block.a + off]] = (float(w["start"]), float(w["end"]))


def _fill_group(script_idx, script_words, times, filled, lo, hi):
    """Give every unmatched word in this group a time inside its gap."""
    k = 0
    n = len(script_idx)
    while k < n:
        if times[script_idx[k]] is not None:
            k += 1
            continue
        run_start = k
        while k < n and times[script_idx[k]] is None:
            k += 1
        run = script_idx[run_start:k]
        gap_start = times[script_idx[run_start - 1]][1] if run_start > 0 else lo
        gap_end = times[script_idx[k]][0] if k < n else hi
        gap_end = max(gap_end, gap_start)
        weights = [max(1, len(script_words[j]["spoken"])) for j in run]
        total = sum(weights)
        t = gap_start
        for j, wgt in zip(run, weights):
            end = t + (gap_end - gap_start) * wgt / total
            times[j] = (t, end)
            filled[j] = True
            t = end
        times[run[-1]] = (times[run[-1]][0], gap_end)  # absorb float drift


def _enforce_monotonic(times):
    """start <= end <= next.start, preferring to trim the earlier word on overlap."""
    out = [list(t) for t in times]
    for k, t in enumerate(out):
        t[0] = max(0.0, t[0])
        if k > 0:
            prev = out[k - 1]
            if t[0] < prev[1]:
                if t[0] >= prev[0]:
                    prev[1] = t[0]
                else:
                    t[0] = prev[1]
        t[1] = max(t[1], t[0])
    return out


def align(script_words, whisper_words, windows, audio_end):
    n = len(script_words)
    if n == 0:
        return {"words": [], "matched": 0, "filled": 0, "filledRanges": []}

    times = [None] * n
    filled = [False] * n

    if windows:
        groups = []
        for li, (ws, we) in enumerate(windows):
            idx = [k for k, w in enumerate(script_words) if w["line"] == li]
            inside = [w for w in whisper_words if ws <= (w["start"] + w["end"]) / 2 <= we]
            groups.append((idx, inside, float(ws), float(we)))
        # words whose line has no window (should not happen) fall back to the whole file
        orphans = [k for k, w in enumerate(script_words) if not 0 <= w["line"] < len(windows)]
        if orphans:
            groups.append((orphans, list(whisper_words), 0.0, float(audio_end)))
    else:
        groups = [(list(range(n)), list(whisper_words), 0.0, float(audio_end))]

    for idx, whisper, lo, hi in groups:
        if idx:
            _match_group(idx, script_words, whisper, times)
    matched = sum(t is not None for t in times)
    for idx, _, lo, hi in groups:
        if idx:
            _fill_group(idx, script_words, times, filled, lo, hi)

    final = _enforce_monotonic(times)
    words = []
    for k, sw in enumerate(script_words):
        words.append(
            {
                "i": sw["i"],
                "caption": sw["caption"],
                "spoken": sw["spoken"],
                "start": round(final[k][0], ROUND),
                "end": round(final[k][1], ROUND),
                "filled": filled[k],
            }
        )

    ranges = []
    for w in words:
        if not w["filled"]:
            continue
        if ranges and ranges[-1][1] == w["i"] - 1:
            ranges[-1][1] = w["i"]
            ranges[-1][3] = w["end"]
        else:
            ranges.append([w["i"], w["i"], w["start"], w["end"]])

    return {"words": words, "matched": matched, "filled": sum(filled), "filledRanges": ranges}
