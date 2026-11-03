import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

WORKER = Path(__file__).resolve().parents[1] / "worker.py"


class Worker:
    def __init__(self):
        self.p = subprocess.Popen(
            [sys.executable, "-u", str(WORKER)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env={**__import__("os").environ, "PYTHONIOENCODING": "utf-8"},
        )

    def read(self):
        line = self.p.stdout.readline()
        assert line, "worker closed stdout; stderr: " + self.p.stderr.read().decode("utf-8", "replace")
        return json.loads(line.decode("utf-8"))

    def send(self, obj):
        self.p.stdin.write((json.dumps(obj, ensure_ascii=False) + "\n").encode("utf-8"))
        self.p.stdin.flush()

    def result(self, req_id):
        # skip progress messages until the result for req_id arrives
        while True:
            msg = self.read()
            if msg.get("id") == req_id and "ok" in msg:
                return msg

    def close(self):
        self.p.stdin.close()
        self.p.wait(timeout=10)


def test_worker_unknown_op(tmp_path):
    w = Worker()
    try:
        assert w.read() == {"ready": True}

        w.send({"id": "a1", "op": "fly", "args": {}})
        res = w.result("a1")
        assert res == {"id": "a1", "ok": False, "error": "unknown op fly"}
        assert w.p.poll() is None, "worker died after unknown op"

        wav, out = tmp_path / "x.wav", tmp_path / "x.json"
        sf.write(str(wav), np.zeros(24000, dtype=np.float32), 24000)
        w.send({"id": "a2", "op": "loudness", "args": {"wav": str(wav), "out": str(out), "fps": 30}})
        res = w.result("a2")
        assert res == {"id": "a2", "ok": True, "result": {"frames": 30}}
    finally:
        w.close()


def test_worker_survives_exception_and_bad_json(tmp_path):
    w = Worker()
    try:
        assert w.read() == {"ready": True}

        w.send({"id": "b1", "op": "loudness", "args": {"wav": str(tmp_path / "missing.wav"), "out": "x", "fps": 30}})
        res = w.result("b1")
        assert res["ok"] is False and res["error"]

        w.p.stdin.write("not json\n".encode("utf-8"))
        w.p.stdin.flush()
        res = w.read()
        assert res["ok"] is False and res["id"] is None

        w.send({"id": "b2", "op": "fly", "args": {}})
        assert w.result("b2")["error"] == "unknown op fly"
    finally:
        w.close()


def test_worker_utf8_roundtrip():
    w = Worker()
    try:
        w.read()
        w.send({"id": "नमस्ते", "op": "fly", "args": {}})
        assert w.result("नमस्ते")["ok"] is False
    finally:
        w.close()
