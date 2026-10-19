import sys
import os

# Set up paths so that backend and its packages are properly discovered by Vercel's Python runtime
_current_dir = os.path.dirname(os.path.abspath(__file__))
_root_dir = os.path.dirname(_current_dir)
_backend_dir = os.path.join(_root_dir, "backend")

if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)
if _root_dir not in sys.path:
    sys.path.append(_root_dir)

# Compatibility entrypoint. Import failures must reach deployment logs instead
# of serving an empty application that turns every real API request into a 404.
from main import app  # type: ignore[import-not-found] # noqa: E402, F401

