import os
import uuid
import re
import time
import hashlib
from typing import Optional, Union
from pathlib import Path
from dotenv import load_dotenv
from imagekitio import ImageKit
from fastapi import UploadFile, HTTPException
import httpx

# Ensure environment variables are loaded from root or backend .env files
_curr = Path(__file__).resolve()
for _candidate in [
    _curr.parents[3] / ".env.local",
    _curr.parents[3] / ".env",
    _curr.parents[2] / ".env.local",
    _curr.parents[2] / ".env",
    Path(".env.local"),
    Path(".env"),
]:
    if _candidate.exists():
        load_dotenv(_candidate)

# Initialize ImageKit with credentials from environment variables
imagekit_private_key = os.getenv('IMAGEKIT_PRIVATE_KEY', 'your_private_key')
url_endpoint = os.getenv('IMAGEKIT_URL_ENDPOINT', 'https://ik.imagekit.io/2s78gfu2x')

imagekit = None
if imagekit_private_key and imagekit_private_key != 'your_private_key':
    try:
        imagekit = ImageKit(private_key=imagekit_private_key)
    except Exception as e:
        print(f"ImageKit initialization notice: {e}")

async def _upload_to_cloudinary(file_bytes: bytes, filename: str, folder: str) -> Optional[str]:
    """
    Upload file bytes to Cloudinary using standard signed REST API.
    """
    cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME', 'xyl1w0pz')
    api_key = os.getenv('CLOUDINARY_API_KEY')
    api_secret = os.getenv('CLOUDINARY_API_SECRET')

    if not api_key or not api_secret or 'your_' in str(api_key):
        return None

    try:
        clean_folder = folder.strip("/\\")
        cloudinary_folder = f"deluzex/{clean_folder}" if not clean_folder.startswith("deluzex") else clean_folder
        timestamp = int(time.time())

        to_sign = f"folder={cloudinary_folder}&timestamp={timestamp}{api_secret}"
        signature = hashlib.sha1(to_sign.encode("utf-8")).hexdigest()

        files = {"file": (filename, file_bytes)}
        data = {
            "api_key": api_key,
            "timestamp": str(timestamp),
            "folder": cloudinary_folder,
            "signature": signature
        }

        upload_url = f"https://api.cloudinary.com/v1_1/{cloud_name}/auto/upload"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(upload_url, data=data, files=files)
            if resp.status_code == 200:
                payload = resp.json()
                secure_url = payload.get("secure_url")
                if secure_url:
                    return secure_url
            else:
                print(f"Cloudinary upload HTTP {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"Cloudinary upload exception: {e}")

    return None

async def upload_image_to_imagekit(file: Union[UploadFile, str], folder: str = "/products") -> str:
    """
    Uploads a file to Cloudinary / ImageKit and returns the public CDN URL.
    - If `file` is already a valid URL string, returns it immediately.
    - Attempts Cloudinary first (the primary CDN configured with verified credentials).
    - Attempts ImageKit if configured.
    - Gracefully saves to local static uploads in non-serverless development.
    - Protects serverless read-only filesystems from Errno 30 crashes.
    """
    # 1. If already a URL string or data URI, return directly
    if isinstance(file, str):
        trimmed = file.strip()
        if trimmed.startswith("http://") or trimmed.startswith("https://") or trimmed.startswith("/") or trimmed.startswith("data:"):
            return trimmed
        raise HTTPException(status_code=400, detail="Invalid image input: expected a file upload or valid URL")

    # Read binary bytes
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes)")

    filename = file.filename or f"upload_{uuid.uuid4().hex[:8]}"

    # 2. Attempt Cloudinary upload
    cloudinary_url = await _upload_to_cloudinary(file_bytes, filename, folder)
    if cloudinary_url:
        return cloudinary_url

    # 3. Attempt ImageKit upload
    if imagekit is not None:
        try:
            upload = imagekit.files.upload(
                file=file_bytes,
                file_name=filename,
                folder=folder
            )
            if hasattr(upload, "url") and upload.url:
                return upload.url
        except Exception as e:
            print(f"ImageKit upload failed: {e}")

    # 4. Check if we are running in a serverless environment (e.g. Vercel, AWS Lambda)
    is_serverless = bool(
        os.getenv("VERCEL")
        or os.getenv("AWS_LAMBDA_FUNCTION_NAME")
        or os.getenv("K_SERVICE")
        or os.path.exists("/var/task")
    )

    if is_serverless:
        raise HTTPException(
            status_code=400,
            detail=(
                "Cloud storage upload failed and local disk is read-only in this serverless environment. "
                "Please ensure CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are configured in your Vercel project environment variables."
            )
        )

    # 5. Local development fallback: Save file to local uploads directory
    try:
        clean_folder = folder.strip("/\\")
        backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        target_dir = os.path.join(backend_root, "uploads", clean_folder)
        os.makedirs(target_dir, exist_ok=True)

        safe_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', filename)
        unique_name = f"{uuid.uuid4().hex[:8]}_{safe_name}"
        file_path = os.path.join(target_dir, unique_name)

        with open(file_path, "wb") as f:
            f.write(file_bytes)

        base_url = os.getenv("BACKEND_PUBLIC_URL", "http://localhost:8000").rstrip("/")
        return f"{base_url}/uploads/{clean_folder}/{unique_name}"
    except OSError as err:
        raise HTTPException(
            status_code=500,
            detail=f"Local storage fallback failed: {err}"
        )
