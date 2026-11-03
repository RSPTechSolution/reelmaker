"""Download and load the models once so the first real job is not slow (run by `npm run setup`)."""

import time


def main() -> None:
    t = time.time()
    print("Loading Kokoro (Hindi)...", flush=True)
    from kokoro import KPipeline

    KPipeline(lang_code="h", repo_id="hexgrad/Kokoro-82M")
    print(f"  ok ({time.time() - t:.0f}s)", flush=True)

    t = time.time()
    print("Loading faster-whisper small (CPU, int8)...", flush=True)
    from faster_whisper import WhisperModel

    WhisperModel("small", device="cpu", compute_type="int8")
    print(f"  ok ({time.time() - t:.0f}s)", flush=True)


if __name__ == "__main__":
    main()
