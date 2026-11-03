"""Stand-in for py/worker.py in tests: same JSON-lines protocol, no models."""
import json
import os
import sys
import time

sys.stdout.reconfigure(encoding="utf-8")
sys.stdin.reconfigure(encoding="utf-8")


def send(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


# Marker file lets a test count how many times the worker process started.
marker = os.environ.get("FAKE_WORKER_STARTS")
if marker:
    with open(marker, "a", encoding="utf-8") as f:
        f.write("start\n")

send({"ready": True})
for line in sys.stdin:
    req = json.loads(line)
    rid, op, args = req["id"], req["op"], req.get("args", {})
    if op == "echo":
        send({"id": rid, "progress": 0.5, "message": "half way"})
        send({"id": rid, "ok": True, "result": {"echo": args}})
    elif op == "slow":
        time.sleep(float(args.get("seconds", 0.3)))
        send({"id": rid, "ok": True, "result": {"slept": True}})
    elif op == "fail":
        send({"id": rid, "ok": False, "error": "fake failure"})
    elif op == "crash":
        for k in range(30):
            sys.stderr.write(f"stderr line {k}\n")
        sys.stderr.flush()
        sys.exit(3)
    else:
        send({"id": rid, "ok": False, "error": f"unknown op {op}"})
