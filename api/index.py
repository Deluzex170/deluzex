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

# Import the FastAPI application (supports IDE static analyzer and runtime)
try:
    from main import app  # type: ignore[import-not-found] # noqa: E402
except Exception as e1:
    try:
        from backend.main import app  # type: ignore[import-not-found] # noqa: E402
    except Exception as e2:
        from fastapi import FastAPI
        app = FastAPI(title="deluzex-fallback")
        @app.get("/api/v1/health-check")
        @app.get("/health-check")
        def debug_err():
            return {
                "status": "error",
                "e1": str(e1),
                "e2": str(e2),
                "sys_path": sys.path,
                "current_dir": _current_dir,
                "dir_contents": os.listdir(_root_dir) if os.path.exists(_root_dir) else []
            }

@app.get("/api/v1/health-check")
@app.get("/health-check")
def vercel_health():
    return {"status": "ok", "runtime": "vercel-python", "framework": "fastapi"}

