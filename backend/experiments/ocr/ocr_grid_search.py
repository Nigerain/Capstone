"""
Sweeps Tesseract preprocessing x page-segmentation-mode (PSM) combinations
across every image in test_images/, scoring each config's final price guess
against the ground truth in ocr_results.csv's `correct` column.

This answers "test image preprocessing and PSM settings to improve
Tesseract results" directly: instead of eyeballing raw text from one config,
every combination gets a hit rate across the same 28 ground-truthed images,
so the best config (or the conclusion that none of them catch up to Vision)
comes from a number, not a guess.

Usage: python3 ocr_grid_search.py
Output: ocr_grid_results.csv 
"""
import os
import csv
import cv2
import numpy as np
import pytesseract
import pillow_heif
from PIL import Image

import ocr_test as t

pillow_heif.register_heif_opener()

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def load_gray(image_path):
    img = Image.open(image_path).convert("RGB")
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2GRAY)


def pp_raw(gray):
    return gray


def pp_grayscale(gray):
    return gray  

def pp_otsu(gray):
    _, out = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return out


def pp_adaptive(gray):
    return cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 11
    )


def pp_upscale2x_otsu(gray):
    up = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    _, out = cv2.threshold(up, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return out


def pp_upscale3x_adaptive(gray):
    up = cv2.resize(gray, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
    return cv2.adaptiveThreshold(
        up, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 35, 11
    )


def pp_denoise_otsu(gray):
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    _, out = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return out


PREPROCESSORS = {
    "raw": pp_raw,
    "grayscale": pp_grayscale,
    "otsu": pp_otsu,
    "adaptive": pp_adaptive,         
    "upscale2x_otsu": pp_upscale2x_otsu,
    "upscale3x_adaptive": pp_upscale3x_adaptive,
    "denoise_otsu": pp_denoise_otsu,
}

PSM_MODES = [3, 4, 6, 11, 12]


def load_ground_truth():
    truth = {}
    for row in csv.DictReader(open(os.path.join(SCRIPT_DIR, "ocr_results.csv"))):
        if row["correct"]:
            truth[row["image"]] = row["correct"]
    return truth


def main():
    folder = os.path.join(SCRIPT_DIR, "test_images")
    images = sorted(
        f for f in os.listdir(folder)
        if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".heic"))
    )
    truth = load_ground_truth()
    scoreable = [f for f in images if f in truth]
    print(f"{len(images)} images total, {len(scoreable)} have ground truth to score against\n")

    gray_cache = {f: load_gray(os.path.join(folder, f)) for f in images}

    results = []
    for pp_name, pp_fn in PREPROCESSORS.items():
        processed_cache = {f: pp_fn(gray_cache[f]) for f in images}
        for psm in PSM_MODES:
            config = f"--psm {psm}"
            hits = 0
            per_image = {}
            for f in scoreable:
                text = pytesseract.image_to_string(processed_cache[f], config=config)
                price, source = t.extract_final_price(text)
                ok = price == truth[f]
                hits += ok
                per_image[f] = (price, ok)
            accuracy = hits / len(scoreable)
            results.append({
                "preprocessing": pp_name,
                "psm": psm,
                "correct": hits,
                "total": len(scoreable),
                "accuracy": round(accuracy, 3),
            })
            print(f"{pp_name:20} psm {psm:>2}  ->  {hits}/{len(scoreable)}  ({accuracy:.0%})")

    results.sort(key=lambda r: -r["accuracy"])
    with open(os.path.join(SCRIPT_DIR, "ocr_grid_results.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["preprocessing", "psm", "correct", "total", "accuracy"])
        w.writeheader()
        w.writerows(results)

    print("\nBest config:", results[0])
    print("Vision (for comparison): 28/28 (100%) on the same 28 images")
    print("Wrote ocr_grid_results.csv")


if __name__ == "__main__":
    main()
