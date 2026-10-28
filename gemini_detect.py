"""Experiment, not part of the app: ask Gemini for the bounding box of every price
tag in a photo. Dropped because it adds a paid call per photo (see multi_tag_scan.py)."""
import base64
import json
import os
import sys

import requests

from ocr_test import load_image_as_jpeg_bytes

MODEL = "gemini-2.5-flash"
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"

PROMPT = """Detect every individual price tag or shelf label in this image.
A price tag is a small rectangular label showing a product's name and price,
either a printed paper tag or a digital e-ink display, mounted on a shelf.
Do not count the product packaging itself, only the price tag/label.

Return a JSON array, one object per price tag found:
[{"box_2d": [ymin, xmin, ymax, xmax], "label": "short description"}]

Coordinates are normalized to a 0-1000 scale, in [ymin, xmin, ymax, xmax] order."""


def detect_tags(image_path):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set. See .env.example.")

    image_b64 = base64.b64encode(load_image_as_jpeg_bytes(image_path)).decode()
    body = {
        "contents": [{
            "parts": [
                {"text": PROMPT},
                {"inline_data": {"mime_type": "image/jpeg", "data": image_b64}},
            ]
        }],
        "generationConfig": {"response_mime_type": "application/json"},
    }

    # key goes in a header, not the query string, so it never lands in logs or error messages
    response = requests.post(URL, headers={"x-goog-api-key": api_key}, json=body, timeout=30)
    response.raise_for_status()
    text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(text)


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "test_images/3.JPG"
    print(json.dumps(detect_tags(path), indent=2))
