"""Experiment, not part of the app: find each tag with Gemini, then read each crop with
Vision. Dropped because it costs one Gemini call plus one Vision call per tag."""
import json
import os
import sys
import tempfile

from PIL import Image

from gemini_detect import detect_tags
from ocr_test import (
    extract_brand,
    extract_final_price,
    extract_item_name,
    extract_unit_size,
    get_vision_client,
    run_vision,
)


def crop_box(image, box_2d, padding=0.01):
    # pad outward a bit, Gemini's boxes can clip text right at the edge
    w, h = image.size
    ymin, xmin, ymax, xmax = box_2d
    x0 = max(0, xmin / 1000 - padding) * w
    y0 = max(0, ymin / 1000 - padding) * h
    x1 = min(1, xmax / 1000 + padding) * w
    y1 = min(1, ymax / 1000 + padding) * h
    return image.crop((x0, y0, x1, y1))


def scan_multi_tag_photo(path, vision_client):
    boxes = detect_tags(path)
    image = Image.open(path).convert("RGB")
    results = []

    # run_vision takes a file path, so each crop is written to a temp dir that is always cleaned up
    with tempfile.TemporaryDirectory() as tmp_dir:
        for i, box in enumerate(boxes):
            crop_path = os.path.join(tmp_dir, f"tag_{i}.jpg")
            crop_box(image, box["box_2d"]).save(crop_path, "JPEG")
            text = run_vision(vision_client, crop_path)

            price, _ = extract_final_price(text)
            results.append({
                "itemName": extract_item_name(text),
                "brand": extract_brand(text),
                "unitSize": extract_unit_size(text),
                "price": price,
                "gemini_label": box["label"],
            })

    return results


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "test_images/33.JPG"
    print(json.dumps(scan_multi_tag_photo(path, get_vision_client()), indent=2))
