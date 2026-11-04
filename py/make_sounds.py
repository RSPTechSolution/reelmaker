"""Create the built-in sound effects and beats in <data>/audio (run by `npm run setup`)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ops.assets import assets  # noqa: E402

if __name__ == "__main__":
    out = assets({"dir": os.path.join(sys.argv[1], "audio")})
    print(f"sounds ready: {', '.join(out['sfx'])}; beats: {', '.join(out['music'])}")
