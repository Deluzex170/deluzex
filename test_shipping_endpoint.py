import urllib.request
import urllib.error
import json

# Test without token first
for method, url in [
    ("GET", "http://127.0.0.1:8000/api/v1/shipping-settings/admin"),
    ("GET", "http://127.0.0.1:8000/api/v1/shipping-settings/public"),
    ("PUT", "http://127.0.0.1:8000/api/v1/shipping-settings/admin"),
]:
    req = urllib.request.Request(url, method=method)
    if method == "PUT":
        req.data = b"{}"
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"{method} {url}: {resp.status}")
    except urllib.error.HTTPError as e:
        print(f"{method} {url}: {e.code} - {e.read().decode('utf-8', errors='ignore')}")
    except Exception as e:
        print(f"{method} {url}: ERROR {e}")

