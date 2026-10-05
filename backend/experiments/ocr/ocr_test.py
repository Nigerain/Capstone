import os
import re
import csv
import cv2
import io
import pytesseract
import numpy as np
import pillow_heif
from PIL import Image
from google.cloud import vision

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault(
    "GOOGLE_APPLICATION_CREDENTIALS",
    os.path.join(SCRIPT_DIR, "ocr-decision-508919-8afd78832863.json"),
)

pillow_heif.register_heif_opener()

# A price like 4.19 or $4.19. Skips SKU-style codes ("3-4-5.099") and numbers
# followed by a unit ("3.78 L", "18.200Z", "4.53 LB"), which are sizes/weights.
# The decimal point is sometimes misread as a comma ("$1,33") — accepted here
# and normalized back to a period wherever this pattern is used.
PRICE_PATTERN = re.compile(
    r'(?<!-)\$?\d{1,3}[.,]\d{2}(?!\d*\s*(?:[o0]z|lbs?|l|ml|g|kg)\b)',
    re.IGNORECASE,
)
# Big-print sign prices often drop the decimal point: "$179" means $1.79.
DOLLAR_NO_DECIMAL_PATTERN = re.compile(r'\$(\d{1,2})(\d{2})\b')
# Bakery/produce tags often print cents-only prices: "69¢", "68¢".
CENTS_PATTERN = re.compile(r'(\d{1,3})\s*¢')
# A "sell by"/"best by" date like 09.22.26 or 09.22 uses the same dot-decimal
# shape as a price. Real prices never have a second dot, so this is safe to
# strip before price extraction runs.
DATE_PATTERN = re.compile(r'\b\d{1,2}\.\d{1,2}\.\d{2,4}\b')
# Labels that sit next to the price the shopper actually pays. The "RE.{0,3}L"
# tolerates OCR misreads of RETAIL such as "REAL PRICE". TOTAL and PRICE
# sometimes land on separate lines with a stray "$" between them
# ("TOTAL $ | PRICE | 15.81"), so this is matched against a multi-line window,
# not a single line — see extract_final_price.
FINAL_PRICE_LABELS = re.compile(
    r'YOU PAY|SALE PRICE|RE\w{0,3}L PRICE|TOTAL\s*\$?\s*PRICE', re.IGNORECASE
)
# A promo markdown amount ("SAVE $1.94", "SAVE | 40¢") is not a price.
SAVE_LABEL = re.compile(r'\bSAVE\b', re.IGNORECASE)
# A per-unit label that sits alone on its own line, with the value on the
# next line ("UNIT PRICE" / "4.55" / "PER LB").
STANDALONE_UNIT_LABEL = re.compile(r'^\s*(?:UNIT PRICE|PRICE\s*/\s*LB)\s*$', re.IGNORECASE)
# A per-unit suffix printed on the same line as its price ("$3.50 per lb",
# "$2.99 per 12 count", or "$1.98-per-qt." — OCR sometimes renders the space
# as a hyphen). Excluded only when it shares the price's own line — an
# unrelated "per lb" one line away should not disqualify a real price.
UNIT_PRICE_LABEL = re.compile(
    r'UNIT PRICE|PRICE\s*/\s*LB|\bPER[\s-]+(?:LB|OZ|QT|DOZEN|EA|\d+\s*COUNT)\b', re.IGNORECASE
)
# [ \t]* instead of \s* so a price on one line and a letter on the next
# ("4.49\nG") is not read as a weight.
WEIGHT_PATTERN = re.compile(r'\d+(?:\.\d+)?[ \t]*(?:oz|lbs?|g|kg|ml|l|gal|ct|dz|pk)\b', re.IGNORECASE)
NUTRITION_WORDS = re.compile(
    r'fat|protein|sugar|carb|fiber|sodium|cholest|serving|calories|potas|iron',
    re.IGNORECASE,
)
# A container-size line ("(1/2 GAL) 1.89", "96 FL OZ (2.8L)") — the volume
# number sometimes lands on its own line without the unit attached.
CONTAINER_SIZE_LINE = re.compile(r'\bGAL\b|\bFL\s*OZ\b', re.IGNORECASE)
NAME_LINE_PATTERN = re.compile(r"^[A-Z][A-Z\s'\-]{4,}$")


def preprocess_for_tesseract(image_path):
    # Grayscale only, no thresholding — see ocr_grid_search.py. Swept 7
    # preprocessing methods x 5 psm modes against 28 ground-truthed images;
    # this plain grayscale step beat every thresholding variant, including
    # the adaptive-threshold version this function used before (14/28 vs
    # 7/28 at psm 11, and it's what psm 12's 15/28 best result runs on).
    img = Image.open(image_path).convert("RGB")
    img_np = np.array(img)
    img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    return gray


def run_tesseract(image_path):
    processed = preprocess_for_tesseract(image_path)
    config = "--psm 12"  # winner of the grid search, see preprocess_for_tesseract
    return pytesseract.image_to_string(processed, config=config)

def load_image_as_jpeg_bytes(image_path):
    img = Image.open(image_path).convert("RGB")
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG")
    return buffer.getvalue()


def run_vision(client, image_path):
    content = load_image_as_jpeg_bytes(image_path)
    image = vision.Image(content=content)
    response = client.text_detection(image=image)
    if response.error.message:
        raise Exception(response.error.message)
    return response.full_text_annotation.text

def extract_prices(text):
    text = DATE_PATTERN.sub(" ", text)
    found = [(m.start(), m.group().replace(",", ".")) for m in PRICE_PATTERN.finditer(text)]
    found += [(m.start(), f"${m.group(1)}.{m.group(2)}") for m in DOLLAR_NO_DECIMAL_PATTERN.finditer(text)]
    found += [(m.start(), f"${int(m.group(1)) // 100}.{int(m.group(1)) % 100:02d}") for m in CENTS_PATTERN.finditer(text)]
    return [price for _, price in sorted(found)]


def extract_final_price(text):
    """Returns (price, how_it_was_chosen) so each guess can be checked by hand."""
    text = DATE_PATTERN.sub(" ", text)
    lines = text.split("\n")

    # 1. A price next to a "you pay" style label. The label itself may be
    #    split across a line break ("TOTAL $" / "PRICE"), so it's searched for
    #    in a 3-line window, not one line at a time. Once found, look right
    #    after the label, then the next 2 lines, then the line above (meat
    #    labels print the total above "TOTAL PRICE"). When a line has several
    #    prices, take the last one: shelf tags print UNIT PRICE and RETAIL
    #    PRICE side by side.
    for i in range(len(lines)):
        window = " ".join(lines[i:i + 3])
        label = FINAL_PRICE_LABELS.search(window)
        # Require the label to actually start on line i, not one the window
        # only pulled in to look ahead — otherwise a label 2 lines below i
        # is found first, and the "line above the label" lookback below ends
        # up one line above i instead of one line above the real label.
        if not label or label.start() > len(lines[i]):
            continue
        nearby = [window[label.end():]] + lines[i + 3:i + 5] + lines[max(i - 1, 0):i]
        for candidate in nearby:
            prices = extract_prices(candidate)
            if prices:
                return prices[-1].lstrip("$"), f"label: {label.group().upper()}"

    # 2. No label found. Exclude two kinds of non-final numbers:
    #    - a per-unit price: either sharing its own line with a suffix like
    #      "per lb" / "per 12 count", or sitting alone on the line right
    #      after a standalone "UNIT PRICE" label (cheese tags print
    #      "UNIT PRICE" / "4.55" / "PER LB" as three separate lines).
    #    - a markdown amount next to "SAVE" ("SAVE $1.94", "SAVE" / "40¢").
    #    - a Nutrition Facts value ("Total Fat 2.50") or a container-size
    #      line ("(1/2 GAL) 1.89") — both use the same decimal shape.
    #    Excluding by line, not by a window of nearby lines, matters: a
    #    "per qt" reference price one line above the real price must not
    #    disqualify that real price too.
    excluded = set()
    for i, line in enumerate(lines):
        if (STANDALONE_UNIT_LABEL.match(line) or (SAVE_LABEL.search(line) and not extract_prices(line))):
            excluded.add(i + 1)
    candidates = []
    for i, line in enumerate(lines):
        if (i in excluded or UNIT_PRICE_LABEL.search(line) or SAVE_LABEL.search(line)
                or NUTRITION_WORDS.search(line) or CONTAINER_SIZE_LINE.search(line)):
            continue
        candidates += extract_prices(line)
    if not candidates:
        return None, "none found"
    with_dollar = [p for p in candidates if p.startswith("$")]
    if with_dollar:
        return with_dollar[0].lstrip("$"), "fallback: first $ price"
    return candidates[0], "fallback: first price"


def extract_weight(text):
    lines = text.split("\n")
    weights = []
    for i, line in enumerate(lines):
        # Skip Nutrition Facts values like "Total Fat 8g" or "25g | PROTEIN".
        if NUTRITION_WORDS.search(" ".join(lines[i:i + 2])):
            continue
        weights += WEIGHT_PATTERN.findall(line)
    return weights


def extract_name_candidates(text):
    lines = text.split("\n")
    return [l.strip() for l in lines if NAME_LINE_PATTERN.match(l.strip())]


def build_row(filename, engine, text):
    final_price, price_source = extract_final_price(text)
    return {
        "image": filename,
        "engine": engine,
        "final_price_guess": final_price,
        "price_source": price_source,
        "all_prices": ", ".join(extract_prices(text)),
        "weight_unit_guess": ", ".join(extract_weight(text)),
        "name_candidates": " | ".join(extract_name_candidates(text)),
        "raw_text": text.replace("\n", " | "),
        "correct": "",
        "notes": ""
    }


def load_existing_ground_truth(path):
    """Keyed by image filename so a re-run doesn't erase hand-verified
    correct/notes values — engine-specific OCR output gets regenerated,
    but the ground truth you checked against the photos shouldn't have to be
    retyped every time the script runs."""
    ground_truth = {}
    if os.path.exists(path):
        with open(path, newline="") as f:
            for row in csv.DictReader(f):
                if row.get("correct") or row.get("notes"):
                    ground_truth[row["image"]] = (row["correct"], row["notes"])
    return ground_truth


def main():
    folder = os.path.join(SCRIPT_DIR, "test_images")
    results_path = os.path.join(SCRIPT_DIR, "ocr_results.csv")
    ground_truth = load_existing_ground_truth(results_path)
    client = vision.ImageAnnotatorClient()
    rows = []

    for filename in sorted(os.listdir(folder)):
        if not filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".heic")):
            continue
        path = os.path.join(folder, filename)

        tess_text = run_tesseract(path)
        vision_text = run_vision(client, path)

        tess_row = build_row(filename, "tesseract", tess_text)
        vision_row = build_row(filename, "vision", vision_text)
        correct, notes = ground_truth.get(filename, ("", ""))
        for row in (tess_row, vision_row):
            row["correct"] = correct
            row["notes"] = notes
            # "" when there's no ground truth yet (not graded), not a miss.
            row["match"] = "" if not correct else ("Y" if row["final_price_guess"] == correct else "N")
        rows += [tess_row, vision_row]

        print(f"{filename} — tesseract: {tess_row['final_price_guess'] or 'nothing'} | "
              f"vision: {vision_row['final_price_guess'] or 'nothing'} ({vision_row['price_source']})")

    # correct/match/notes come right after the guess so a reader sees "was it
    # right" before anything else; raw_text (the long, sometimes-garbled OCR
    # dump used to debug why) is last so it doesn't have to be scrolled past.
    fieldnames = ["image", "engine", "final_price_guess", "correct", "match", "price_source", "all_prices", "weight_unit_guess", "name_candidates", "notes", "raw_text"]
    with open(results_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    main()