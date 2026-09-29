#!/usr/bin/env python3
"""Download complete WAVE ART MALL online version from Vercel."""
import re
import urllib.request
import urllib.parse
import os
from pathlib import Path

BASE_URL = "https://wave-art-mall.vercel.app"
ROOT = Path("G:/草稿/待辦事項/APP_!/_online_source")

downloaded = set()

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}


def url_to_local(url_path):
    """Convert URL path to local file path."""
    url_path = urllib.parse.unquote(url_path)
    if url_path.startswith("/"):
        url_path = url_path[1:]
    if not url_path:
        url_path = "index.html"
    return ROOT / url_path


def local_exists(rel_path):
    return (ROOT / rel_path).exists()


def download(rel_path):
    """Download a relative path from base URL."""
    if rel_path in downloaded:
        return True
    downloaded.add(rel_path)

    local_path = url_to_local(rel_path)
    local_path.parent.mkdir(parents=True, exist_ok=True)

    url = BASE_URL + "/" + rel_path.replace("\\", "/")
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
            status = resp.status
        # Skip if 404 body
        if status == 404 or (status == 200 and len(data) < 200 and b"NOT_FOUND" in data):
            print(f"SKIP/404 {rel_path} ({len(data)}B)")
            return False
        local_path.write_bytes(data)
        print(f"OK {rel_path} -> {len(data)}B")
        return True
    except Exception as e:
        print(f"ERR {rel_path}: {e}")
        return False


def extract_refs(html_content, current_dir=""):
    """Extract relative references from HTML/JS/CSS content."""
    refs = set()
    text = html_content.decode("utf-8", errors="ignore")

    # href="..."
    for m in re.findall(r'href="([^"]+)"', text):
        if m.startswith("http") or m.startswith("#") or m.startswith("mailto:"):
            continue
        if m.startswith("/"):
            refs.add(m[1:])
        else:
            refs.add((Path(current_dir) / m).as_posix())

    # src="..."
    for m in re.findall(r'src="([^"]+)"', text):
        if m.startswith("http") or m.startswith("#"):
            continue
        if m.startswith("/"):
            refs.add(m[1:])
        else:
            refs.add((Path(current_dir) / m).as_posix())

    # url(...) in CSS
    for m in re.findall(r'url\([\'"]?([^\'")\s]+)[\'"]?\)', text):
        if m.startswith("http") or m.startswith("#"):
            continue
        if m.startswith("/"):
            refs.add(m[1:])
        else:
            refs.add((Path(current_dir) / m).as_posix())

    # import "..." in JS
    for m in re.findall(r'import\s+[^\'"]*[\'"]([^\'"]+)[\'"]', text):
        if m.startswith("http"):
            continue
        if m.startswith("/"):
            refs.add(m[1:])
        else:
            refs.add((Path(current_dir) / m).as_posix())

    return refs


def main():
    # Seed files
    queue = ["index.html", "manifest.json"]

    # Known pages from manifest
    manifest_path = ROOT / "manifest.json"
    if manifest_path.exists():
        import json
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            for entry in manifest.get("icons", []):
                if entry.get("src", "").startswith("/"):
                    queue.append(entry["src"][1:])
                elif entry.get("src"):
                    queue.append(entry["src"])
        except Exception as e:
            print("manifest parse err:", e)

    # Common pages to try
    common_pages = [
        "pages/auth.html",
        "pages/cart.html",
        "pages/checkout.html",
        "pages/order-history.html",
        "pages/order-detail.html",
        "pages/order-confirm.html",
        "pages/order-review.html",
        "pages/product.html",
        "pages/product-detail.html",
        "pages/profile.html",
        "pages/collection.html",
        "pages/terms.html",
        "pages/privacy.html",
    ]
    queue.extend(common_pages)

    # Common assets
    common_assets = [
        "js/supabaseClient.js",
        "js/nav.js",
        "js/app.js",
        "js/api.js",
        "js/config.js",
        "js/checkoutFlow.js",
        "js/tailwind-config.js",
        "js/cart.js",
        "js/auth.js",
        "js/product.js",
        "js/order.js",
        "js/profile.js",
        "js/utils.js",
        "css/style.css",
        "css/tailwind.css",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "favicon.ico",
    ]
    queue.extend(common_assets)

    while queue:
        rel = queue.pop(0)
        rel = rel.replace("\\", "/").lstrip("/")
        if not rel:
            continue
        if rel in downloaded:
            continue

        ok = download(rel)
        if not ok:
            continue

        local_path = url_to_local(rel)
        data = local_path.read_bytes()

        # Only parse text files
        if local_path.suffix.lower() in (".html", ".js", ".css", ".json"):
            current_dir = Path(rel).parent.as_posix() if "/" in rel else ""
            new_refs = extract_refs(data, current_dir)
            for r in new_refs:
                r = r.replace("\\", "/").lstrip("/")
                if r and r not in downloaded and r not in queue:
                    # Skip data URIs, anchors, external
                    if r.startswith("data:") or r.startswith("http"):
                        continue
                    queue.append(r)

    print(f"\nDone. Downloaded {len(downloaded)} files.")


if __name__ == "__main__":
    main()
