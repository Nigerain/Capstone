import csv
import io
import os
import re
import unicodedata
from collections import Counter

import cv2
import pytesseract
import numpy as np
import pillow_heif
from PIL import Image, ImageOps
from google.cloud import vision

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

pillow_heif.register_heif_opener()


def get_vision_client():
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not cred_path or not os.path.isfile(cred_path):
        raise RuntimeError(
            "GOOGLE_APPLICATION_CREDENTIALS is not set to an existing file. "
            "Set it to the path of your Google Cloud Vision service account "
            "key, e.g.:\n"
            "  export GOOGLE_APPLICATION_CREDENTIALS=/path/to/your-key.json\n"
            "See .env.example for the expected format. Ask a teammate for "
            "the key file if you don't have one. It is not stored in the repo."
        )
    return vision.ImageAnnotatorClient()


# price like 4.19 or $4.19; skips SKU codes and size/weight numbers (3.78 L, 4.53 LB)
# comma allowed as decimal (OCR misread), normalized to period elsewhere
PRICE_PATTERN = re.compile(
    r'(?<!-)\$?\d{1,3}[.,]\d{2}(?!\d*\s*(?:[o0]z|lbs?|l|ml|g|kg)\b)',
    re.IGNORECASE,
)
# Big-print sign prices often drop the decimal point: "$179" means $1.79.
DOLLAR_NO_DECIMAL_PATTERN = re.compile(r'\$(\d{1,2})(\d{2})\b')
# Bakery/produce tags often print cents-only prices: "69¢", "68¢".
CENTS_PATTERN = re.compile(r'(\d{1,3})\s*¢')
# dates (09.22.26) look like prices; stripped before price extraction runs
DATE_PATTERN = re.compile(r'\b\d{1,2}\.\d{1,2}\.\d{2,4}\b')
# labels next to the price the shopper pays, e.g. "REAL PRICE" (an OCR misread of RETAIL)
FINAL_PRICE_LABELS = re.compile(
    r'YOU PAY|SALE PRICE|RE\w{0,3}L PRICE|TOTAL\s*\$?\s*PRICE', re.IGNORECASE
)
# A promo markdown amount ("SAVE $1.94", "SAVE | 40¢") is not a price.
SAVE_LABEL = re.compile(r'\bSAVE\b', re.IGNORECASE)
# A per-unit label that sits alone on its own line, with the value on the
# next line ("UNIT PRICE" / "4.55" / "PER LB").
STANDALONE_UNIT_LABEL = re.compile(r'^\s*(?:UNIT PRICE|PRICE\s*/\s*LB)\s*$', re.IGNORECASE)
# per-unit suffix on the price's own line only ("$3.50 per lb");
# a "per lb" elsewhere shouldn't disqualify a real price
UNIT_PRICE_LABEL = re.compile(
    r'UNIT PRICE|PRICE\s*/\s*LB|\bPER[\s-]+(?:LB|OZ|QT|DOZEN|EA|\d+\s*COUNT)\b', re.IGNORECASE
)
# [ \t]* not \s*, so "4.49\nG" isn't read as a weight
# "fl" catches "64 fl oz"; "count" is spelled out on digital shelf tags, not just "ct"
# single-digit fraction keeps "(1/2 GAL)" from being read as "2 GAL"; "6/13.2 OZ" (a 6 pack) is not one
WEIGHT_PATTERN = re.compile(r'(?:\d/\d|\d+(?:\.\d+)?)[ \t]*(?:fl[ \t.]*)?(?:oz|lbs?|g|kg|ml|l|gal|ct|count|dz|pk)\b', re.IGNORECASE)
NUTRITION_WORDS = re.compile(
    r'fat|protein|sugar|carb|fiber|sodium|cholest|serving|calories|potas|iron|calcium|vitamin',
    re.IGNORECASE,
)
# A container-size line ("(1/2 GAL) 1.89", "96 FL OZ (2.8L)") , the volume
# number sometimes lands on its own line without the unit attached.
CONTAINER_SIZE_LINE = re.compile(r'\bGAL\b|\bFL\s*OZ\b', re.IGNORECASE)
# matches ALL-CAPS and Title Case name-shaped lines, including accents ("Crème")
# possessive quantifiers (*+) prevent ReDoS, don't remove them
NAME_LINE_PATTERN = re.compile(r"^(?=.{3,}$)(?:\d+%\s++)?(?:[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'\-]*+\s*+)+$")
# regulatory text and shelf-tag promo text (e.g. "New Low Price"), excluded since both are name-shaped too
NOISE_LINE_PATTERN = re.compile(
    r'DEPARTMENT OF|AGRICULTURE|FEDERAL REGULATIONS|SERVING SUGGESTION|'
    r'KEEP REFRIGERAT|SELL BY|BEST BY|BEST IF USED|USE WITHIN|PRODUCT OF|'
    r'DISTRIBUTED BY|MEAT DEPT|INSPECTED|USDA|NEEDS TO BE|COOK TO|'
    r'THERMOMETER|HORMONES|STEROIDS|ANTIBIOTICS|HATCHED|HARVESTED|'
    r'VERIFIED|PROCESSED|INGREDIENTS|LEARN MORE|SHAKE WELL|GLUTEN FREE|'
    r'NEW LOW PRICE|REGULAR PRICE|WITH LIDL PLUS|BUY MORE|SAVE MORE|'
    r'PER UNIT|PER QT|^LIMIT \d+$',
    re.IGNORECASE,
)
# bare modifier word alone on a line ("Organic"), not useful without a noun
GENERIC_MODIFIER_ONLY = re.compile(
    r"^(?:ORGANIC|CERTIFIED|HUMANE|KOSHER|NATURAL|FRESH|PASTURE RAISED|"
    r"CAGE FREE|GRADE [A-Z]|NON[\s-]?GMO)$",
    re.IGNORECASE,
)
# lookup, not a positional rule; brand position varies by tag. Add new ones as seen.
KNOWN_BRANDS = [
    "lidl preferred selection", "preferred selection", "lidl", "milbona",
    "good & gather", "dave's killer bread", "wonder bread", "wonder",
    "alouette", "eggland's best", "lactaid", "perdue", "tyson",
    "hy-vee", "target", "butcher's specialty", "allen harim",
    "kirkland signature", "member's mark", "market pantry", "trader joe's",
]
# a retailer, not who makes the product; a product brand wins when both appear
STORE_BRANDS = {"lidl", "hy-vee", "target"}


def _brand_alternation(brands):
    # longest first, so "lidl preferred selection" beats its prefix "lidl" whatever the list order
    return "|".join(re.escape(b) for b in sorted(brands, key=len, reverse=True))


BRAND_PATTERN = re.compile(rf"\b({_brand_alternation(KNOWN_BRANDS)})\b", re.IGNORECASE)
# caps the longest-run heuristic so garbled OCR doesn't join into a fake name
# egg/poultry names run to 7 words ("Free Range Large Brown Grade A Eggs")
MAX_PLAUSIBLE_NAME_WORDS = 7


def preprocess_for_tesseract(image_path):
    # grayscale only; beat all thresholding variants in a 7x5 grid search (see ocr_grid_search.py)
    img = Image.open(image_path).convert("RGB")
    img_np = np.array(img)
    img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    return gray


def run_tesseract(image_path):
    processed = preprocess_for_tesseract(image_path)
    config = "--psm 12"
    return pytesseract.image_to_string(processed, config=config)

def load_image_as_jpeg_bytes(image_path):
    # phones store "which way is up" in EXIF and the re-save below drops it, so apply it first
    # or a portrait photo reaches Vision sideways
    with Image.open(image_path) as source:
        img = ImageOps.exif_transpose(source).convert("RGB")
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG")
    return buffer.getvalue()


def _annotate(detect, image_path):
    # the API reports failures inside the response, not as an exception
    response = detect(image=vision.Image(content=load_image_as_jpeg_bytes(image_path)))
    if response.error.message:
        raise RuntimeError(response.error.message)
    return response.full_text_annotation


def run_vision(client, image_path):
    return _annotate(client.text_detection, image_path).text


def run_vision_words(client, image_path):
    """Like run_vision, but also returns (word, confidence) pairs. Uses
    document_text_detection because text_detection leaves every word's
    confidence at 0.0."""
    annotation = _annotate(client.document_text_detection, image_path)
    words = [
        ("".join(symbol.text for symbol in word.symbols), word.confidence)
        for page in annotation.pages
        for block in page.blocks
        for paragraph in block.paragraphs
        for word in paragraph.words
    ]
    return annotation.text, words


# Below this the app asks the user to type the price instead of trusting OCR.
# Provisional: on 45 labelled photos (18 degraded on purpose) every bad read
# scored under 0.8 and 1 of 40 correct prices did too. Re-check against real
# scan logs before relying on it.
MIN_PRICE_CONFIDENCE = 0.8
LABELLED_PRICE_FACTOR = 1.0
FALLBACK_PRICE_FACTOR = 0.85
# extract_final_price tags a price found next to a "you pay"-style label with this
LABELLED_SOURCE_PREFIX = "label:"


def price_confidence(price, price_source, words):
    """0-1 score: Vision's best confidence on the words that are the price
    (the same price is often printed twice, so the clearest read counts),
    scaled down when the price was a fallback guess, not a labelled one.
    A word counts only if it is the whole price ("$1.79", "179", "1,79", or
    "69" for a 69 cent price), so digits inside other numbers don't."""
    if price is None:
        return 0.0
    forms = {price, price.replace(".", "")}
    if price.startswith("0."):
        cents = price[2:]
        forms |= {cents, cents.lstrip("0")}
    matches = [conf for text, conf in words
               if re.sub(r"^\D+|\D+$", "", text).replace(",", ".") in forms]
    if not matches:
        return 0.0
    labelled = price_source.startswith(LABELLED_SOURCE_PREFIX)
    factor = LABELLED_PRICE_FACTOR if labelled else FALLBACK_PRICE_FACTOR
    return round(max(matches) * factor, 3)


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

    # 1. price next to a "you pay" label. Label may split across lines, so
    #    search a 3-line window, then check after label, next 2 lines, then
    #    line above. Take the last price if several (unit + retail side by side).
    for i in range(len(lines)):
        window = " ".join(lines[i:i + 3])
        label = FINAL_PRICE_LABELS.search(window)
        # label must start on line i, not just appear in the lookahead window
        if not label or label.start() > len(lines[i]):
            continue
        nearby = [window[label.end():]] + lines[i + 3:i + 5] + lines[max(i - 1, 0):i]
        for candidate in nearby:
            prices = extract_prices(candidate)
            if prices:
                return prices[-1].lstrip("$"), f"{LABELLED_SOURCE_PREFIX} {label.group().upper()}"

    # 2. no label: exclude per-unit prices, SAVE markdowns, and nutrition/
    #    container-size numbers. Excluded by line, not nearby lines, so one
    #    bad line doesn't disqualify a real price next to it.
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


def _strip_trailing_codes(line):
    # strips trailing SKU/PLU codes ("CHICKEN BREAST P 935 L6" -> "CHICKEN BREAST")
    tokens = line.split()
    while tokens and (re.match(r'^[A-Z]?\d+[A-Z]?\d*$', tokens[-1]) or re.match(r'^[A-Z]$', tokens[-1])):
        tokens.pop()
    return " ".join(tokens)


def _name_candidate_line(line):
    # cleaned line if name-shaped, else None; shared so both callers below agree
    stripped = _strip_trailing_codes(line.strip())
    if not NAME_LINE_PATTERN.match(stripped):
        return None
    if (NOISE_LINE_PATTERN.search(stripped) or GENERIC_MODIFIER_ONLY.match(stripped)
            or FINAL_PRICE_LABELS.search(stripped) or UNIT_PRICE_LABEL.search(stripped)
            or SAVE_LABEL.search(stripped) or NUTRITION_WORDS.search(stripped)
            or CONTAINER_SIZE_LINE.search(stripped) or BRAND_PATTERN.search(stripped)):
        return None
    return stripped


def extract_name_candidates(text):
    # full list of name-shaped lines, kept for debugging in the CSV (extract_item_name picks the real guess)
    return [c for c in (_name_candidate_line(line) for line in text.split("\n")) if c]


def _best_name_group(text):
    # joins consecutive name-shaped lines into one candidate; tags often
    # split the name across lines ("CAGE FREE" / "LARGE BROWN" / "EGGS")
    lines = text.split("\n")
    groups, current = [], []
    for line in lines:
        cleaned = _name_candidate_line(line)
        if cleaned:
            current.append(cleaned)
        elif current:
            groups.append(" ".join(current))
            current = []
    if current:
        groups.append(" ".join(current))
    if not groups:
        return None
    return max(groups, key=lambda g: len(g.split()))


def extract_item_name(text):
    # None means low confidence, not "retry"; caller should ask the user to type it in
    best = _best_name_group(text)
    if best is None or len(best.split()) > MAX_PLAUSIBLE_NAME_WORDS:
        return None
    return best


def _brand_key(s):
    # OCR splits "Good&Gather" over two lines and varies the apostrophe, so brands are
    # compared with whitespace collapsed and no spaces around "&"
    s = re.sub(r"\s+", " ", s.replace("’", "'").lower())
    return re.sub(r"\s*&\s*", "&", s)


_BRANDS_BY_KEY = {_brand_key(b): b for b in KNOWN_BRANDS}
_STORE_BRAND_KEYS = {_brand_key(b) for b in STORE_BRANDS}
_BRAND_SEARCH = re.compile(rf"\b({_brand_alternation(_BRANDS_BY_KEY)})\b")


def extract_brand(text):
    # None (not a guess) when no known brand matches; wrong is worse than blank
    found = [m.group(1) for m in _BRAND_SEARCH.finditer(_brand_key(text))]
    if not found:
        return None
    product_brands = [key for key in found if key not in _STORE_BRAND_KEYS]
    # most often printed wins: a tag repeats its brand, while a split fragment
    # ("PREFERRED / SELECTION") or a distributor line shows up once; ties keep the earliest
    counts = Counter(product_brands or found)
    return _BRANDS_BY_KEY[max(counts, key=counts.get)].title()


def extract_unit_size(text):
    # first match from extract_weight(); tags often print the size twice, later ones are just duplicates
    weights = extract_weight(text)
    return weights[0] if weights else None


def build_row(filename, engine, text):
    final_price, price_source = extract_final_price(text)
    raw_name = _best_name_group(text)
    item_name = extract_item_name(text)
    return {
        "image": filename,
        "engine": engine,
        "final_price_guess": final_price,
        "price_source": price_source,
        "all_prices": ", ".join(extract_prices(text)),
        "item_name_guess": item_name or "",
        "item_name_suppressed": raw_name if (raw_name and not item_name) else "",
        "brand_guess": extract_brand(text) or "",
        "unit_size_guess": extract_unit_size(text) or "",
        "weight_unit_guess": ", ".join(extract_weight(text)),
        "name_candidates": " | ".join(extract_name_candidates(text)),
        "raw_text": text.replace("\n", " | "),
        "correct": "",
        "notes": "",
        "name_correct": "",
        "name_match": "",
        "brand_correct": "",
        "brand_match": "",
        "size_correct": "",
        "size_match": "",
    }


def scan_price_tag(image_path, client=None):
    """Entry point for one photo - what a backend endpoint calls. main()
    below only batch-tests the extractors against test_images/."""
    if client is None:
        client = get_vision_client()
    text, words = run_vision_words(client, image_path)
    price, price_source = extract_final_price(text)
    confidence = price_confidence(price, price_source, words)
    return {
        "itemName": extract_item_name(text),
        "brand": extract_brand(text),
        "unitSize": extract_unit_size(text),
        "price": price,
        "priceConfidence": confidence,
        "needsManualPrice": confidence < MIN_PRICE_CONFIDENCE,
    }


GROUND_TRUTH_FIELDS = ["correct", "notes", "name_correct", "brand_correct", "size_correct"]


def load_existing_ground_truth(path):
    # keyed by filename so a rerun doesn't erase verified ground truth
    ground_truth = {}
    if os.path.exists(path):
        with open(path, newline="") as f:
            for row in csv.DictReader(f):
                values = {field: row.get(field, "") for field in GROUND_TRUTH_FIELDS}
                if any(values.values()):
                    ground_truth[row["image"]] = values
    return ground_truth


def _strip_accents(s):
    # "Crème" -> "Creme", for comparison only, not the extractor's output
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def _normalized_match(guess, correct):
    # case/whitespace/accent-insensitive compare
    if not correct:
        return ""
    normalize = lambda s: re.sub(r"\s+", "", _strip_accents(s or "")).upper()
    return "Y" if normalize(guess) == normalize(correct) else "N"


# unit -> (kind, size in ounces / fluid ounces / each), so "1.25 lb" can equal "20 oz".
# plain "oz" is weight; fluid ounces need "fl".
_SIZE_UNITS = {
    "oz": ("weight", 1.0), "lb": ("weight", 16.0), "g": ("weight", 0.035274), "kg": ("weight", 35.274),
    "floz": ("volume", 1.0), "gal": ("volume", 128.0), "ml": ("volume", 0.033814), "l": ("volume", 33.814),
    "ct": ("count", 1.0), "dz": ("count", 12.0),
}
_SIZE_UNIT_NAMES = {
    "ounce": "oz", "ounces": "oz", "lbs": "lb", "pound": "lb", "pounds": "lb",
    "gallon": "gal", "gallons": "gal", "liter": "l", "liters": "l", "litre": "l", "litres": "l",
    "count": "ct", "dozen": "dz",
}
_SIZE_PATTERN = re.compile(r"^(?:(\d)/(\d)|(\d+(?:\.\d+)?))([a-z.]+)$")
# metric labels are rounded ("3.78 L" on a 1 gallon jug)
SIZE_TOLERANCE = 0.01


def _parse_size(s):
    # (kind, amount in base units), or None if it isn't a plain "<number> <unit>"
    match = _SIZE_PATTERN.match(re.sub(r"\s+", "", s or "").lower())
    if not match:
        return None
    numerator, denominator, amount, unit = match.groups()
    unit = unit.replace(".", "")
    unit = _SIZE_UNIT_NAMES.get(unit, unit)
    if unit not in _SIZE_UNITS or denominator == "0":
        return None
    value = float(numerator) / float(denominator) if numerator else float(amount)
    kind, factor = _SIZE_UNITS[unit]
    return kind, value * factor


def _normalized_size_match(guess, correct):
    if not correct:
        return ""
    parsed_guess, parsed_correct = _parse_size(guess), _parse_size(correct)
    if parsed_guess and parsed_correct:
        (guess_kind, guess_amount), (correct_kind, correct_amount) = parsed_guess, parsed_correct
        close = abs(guess_amount - correct_amount) <= SIZE_TOLERANCE * max(guess_amount, correct_amount)
        return "Y" if guess_kind == correct_kind and close else "N"
    # not a plain "<number> <unit>" (e.g. "6/13.2 OZ"): fall back to exact text
    compact = lambda s: re.sub(r"\s+", "", s or "").upper()
    return "Y" if compact(guess) == compact(correct) else "N"


def main():
    folder = os.path.join(SCRIPT_DIR, "test_images")
    results_path = os.path.join(SCRIPT_DIR, "ocr_results.csv")
    ground_truth = load_existing_ground_truth(results_path)
    client = get_vision_client()
    rows = []

    for filename in sorted(os.listdir(folder)):
        if not filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".heic")):
            continue
        path = os.path.join(folder, filename)

        tess_text = run_tesseract(path)
        vision_text = run_vision(client, path)

        tess_row = build_row(filename, "tesseract", tess_text)
        vision_row = build_row(filename, "vision", vision_text)
        truth = ground_truth.get(filename, {field: "" for field in GROUND_TRUTH_FIELDS})
        for row in (tess_row, vision_row):
            row["correct"] = truth["correct"]
            row["notes"] = truth["notes"]
            row["name_correct"] = truth["name_correct"]
            row["brand_correct"] = truth["brand_correct"]
            row["size_correct"] = truth["size_correct"]
            row["match"] = "" if not truth["correct"] else ("Y" if row["final_price_guess"] == truth["correct"] else "N")
            row["name_match"] = _normalized_match(row["item_name_guess"], truth["name_correct"])
            row["brand_match"] = _normalized_match(row["brand_guess"], truth["brand_correct"])
            row["size_match"] = _normalized_size_match(row["unit_size_guess"], truth["size_correct"])
        rows += [tess_row, vision_row]

        print(f"{filename} — tesseract: {tess_row['final_price_guess'] or 'nothing'} | "
              f"vision: {vision_row['final_price_guess'] or 'nothing'} ({vision_row['price_source']})")

    fieldnames = ["image", "engine", "final_price_guess", "correct", "match", "price_source", "all_prices", "item_name_guess", "name_correct", "name_match", "item_name_suppressed", "brand_guess", "brand_correct", "brand_match", "unit_size_guess", "size_correct", "size_match", "weight_unit_guess", "name_candidates", "notes", "raw_text"]
    with open(results_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    main()