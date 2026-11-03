"""Long-running audio worker. JSON lines over stdin/stdout.

request  {"id": str, "op": str, "args": {...}}
progress {"id": str, "progress": float 0-1, "message": str}
result   {"id": str, "ok": true, "result": {...}} | {"id": str, "ok": false, "error": str}
On start prints {"ready": true}. Exceptions never kill the loop.
"""

import json
import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Keep a private UTF-8 handle on the real stdout for protocol messages, then point fd 1 at
# stderr so library prints (progress bars, logs) can never corrupt the JSON stream.
# The Windows console default encoding is not UTF-8, hence the explicit encoding.
_proto = os.fdopen(os.dup(sys.stdout.fileno()), "w", encoding="utf-8", newline="\n", buffering=1)
os.dup2(sys.stderr.fileno(), sys.stdout.fileno())
sys.stdout = sys.stderr
sys.stdin.reconfigure(encoding="utf-8")

from ops.loudness import loudness  # noqa: E402
from ops.transcribe import timing  # noqa: E402
from ops.tts import tts  # noqa: E402

# Heavy models (Kokoro, Whisper) load lazily on the first tts/timing call.
OPS = {
    "loudness": loudness,
    "tts": tts,
    "timing": timing,
}


def send(obj: dict) -> None:
    _proto.write(json.dumps(obj, ensure_ascii=False) + "\n")
    _proto.flush()


def handle(line: str) -> None:
    try:
        req = json.loads(line)
        req_id, op, args = req["id"], req["op"], req.get("args", {})
    except Exception as e:  # malformed request: answer with id null, keep going
        send({"id": None, "ok": False, "error": f"bad request: {e}"})
        return

    fn = OPS.get(op)
    if fn is None:
        send({"id": req_id, "ok": False, "error": f"unknown op {op}"})
        return

    def progress(p: float, message: str = "") -> None:
        send({"id": req_id, "progress": max(0.0, min(1.0, float(p))), "message": message})

    try:
        send({"id": req_id, "ok": True, "result": fn(args, progress)})
    except Exception as e:
        traceback.print_exc(file=sys.stderr)
        send({"id": req_id, "ok": False, "error": str(e) or type(e).__name__})


def main() -> None:
    send({"ready": True})
    for line in sys.stdin:
        if line.strip():
            handle(line)


if __name__ == "__main__":
    main()
