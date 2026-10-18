import sys
import os

# Set up paths so that backend and its packages are properly discovered by Vercel's Python runtime
_current_dir = os.path.dirname(os.path.abspath(__file__))
_root_dir = os.path.dirname(_current_dir)
_backend_dir = os.path.join(_root_dir, "backend")

if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

# Import the FastAPI application
from main import app  # noqa: E402
