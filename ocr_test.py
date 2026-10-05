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
# The decimal point is sometimes misread as a comma ("$1,33") , accepted here
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
# "$2.99 per 12 count", or "$1.98-per-qt." OCR sometimes renders the space
# as a hyphen). Excluded only when it shares the price's own line,  an
# unrelated "per lb" one line away should not disqualify a real price.
UNIT_PRICE_LABEL = re.compile(
    r'UNIT PRICE|PRICE\s*/\s*LB|\bPER[\s-]+(?:LB|OZ|QT|DOZEN|EA|\d+\s*COUNT)\b', re.IGNORECASE
)
# [ \t]* instead of \s* so a price on one line and a letter on the next
# ("4.49\nG") is not read as a weight.
WEIGHT_PATTERN = re.compile(r'\d+(?:\.\d+)?[ \t]*(?:oz|lbs?|g|kg|ml|l|gal|ct|dz|pk)\b', re.IGNORECASE)
NUTRITION_WORDS = re.compile(
    r'fat|protein|sugar|carb|fiber|sodium|cholest|serving|calories|potas|iron|calcium|vitamin',
    re.IGNORECASE,
)
# A container-size line ("(1/2 GAL) 1.89", "96 FL OZ (2.8L)") , the volume
# number sometimes lands on its own line without the unit attached.
CONTAINER_SIZE_LINE = re.compile(r'\bGAL\b|\bFL\s*OZ\b', re.IGNORECASE)
NAME_LINE_PATTERN = re.compile(r"^[A-Z][A-Z\s'\-]{4,}$")
# Regulatory/instructional boilerplate printed in the same all-caps style
# as a product name, so NAME_LINE_PATTERN matches it too. Meat/poultry tags
# are full of this.
NOISE_LINE_PATTERN = re.compile(
    r'DEPARTMENT OF|AGRICULTURE|FEDERAL REGULATIONS|SERVING SUGGESTION|'
    r'KEEP REFRIGERAT|SELL BY|BEST BY|BEST IF USED|USE WITHIN|PRODUCT OF|'
    r'DISTRIBUTED BY|MEAT DEPT|INSPECTED|USDA|NEEDS TO BE|COOK TO|'
    r'THERMOMETER|HORMONES|STEROIDS|ANTIBIOTICS|HATCHED|HARVESTED|'
    r'VERIFIED|PROCESSED|INGREDIENTS|LEARN MORE|SHAKE WELL|GLUTEN FREE',
    re.IGNORECASE,
)
# A single quality/claim word with nothing else on the line. Real names pair
# these with a noun ("Organic Bananas"), but the OCR often prints the
# modifier on its own line — alone, it's not useful as a product name.
GENERIC_MODIFIER_ONLY = re.compile(
    r"^(?:ORGANIC|CERTIFIED|HUMANE|KOSHER|NATURAL|FRESH|PASTURE RAISED|"
    r"CAGE FREE|GRADE [A-Z]|NON[\s-]?GMO)$",
    re.IGNORECASE,
)
# Store/private-label brands seen on the test tags. A lookup instead of a
# structural rule, a brand name often gets printed 3-4 times in different
# fonts/sizes on one tag (see the ALOUETTE cheese tag), so there's no
# reliable "the brand is always line N" pattern to key off of the way there
# is for price labels. Add to this list as new brands show up in testing.
KNOWN_BRANDS = [
    "lidl preferred selection", "preferred selection", "lidl",
    "good & gather", "dave's killer bread", "wonder bread", "wonder",
    "alouette", "eggland's best", "lactaid", "perdue", "tyson",
    "hy-vee", "target", "butcher's specialty",
]
BRAND_PATTERN = re.compile(
    r'\b(' + '|'.join(re.escape(b) for b in KNOWN_BRANDS) + r')\b', re.IGNORECASE
)
# extract_item_name() picks the longest consecutive run of name-shaped
# lines, which is also exactly how unrelated OCR noise gets joined into one
# long fake name on garbled photos. Real product names rarely run past 5
# words ("Boneless Skinless Chicken Breasts"), so a longer run is more
# likely a noise join than a real one.
MAX_PLAUSIBLE_NAME_WORDS = 5


def preprocess_for_tesseract(image_path):
    # Grayscale only, no thresholding. Swept 7
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
        # only pulled in to look ahead, otherwise a label 2 lines below i
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


def _strip_trailing_codes(line):
    """SKU/PLU/grade codes ("CHICKEN BREAST P 935 L6") often share a line
    with the product name. Strip trailing short digit-containing or
    single-letter tokens before matching, so a code at the end of the line
    doesn't reject an otherwise valid name."""
    tokens = line.split()
    while tokens and (re.match(r'^[A-Z]?\d+[A-Z]?\d*$', tokens[-1]) or re.match(r'^[A-Z]$', tokens[-1])):
        tokens.pop()
    return " ".join(tokens)


def _name_candidate_line(line):
    """Cleaned version of a line if it's shaped like a product name, else
    None. Shared by extract_name_candidates() and extract_item_name() so
    they can never disagree on which lines qualify."""
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
    """Every line that's shaped like a product name, after excluding lines
    that are actually price labels, weights, dates, or regulatory noise
    printed in the same all-caps style. This is the full list, kept for
    debugging in the CSV; extract_item_name() below picks the actual guess."""
    return [c for c in (_name_candidate_line(line) for line in text.split("\n")) if c]


def _best_name_group(text):
    """Longest consecutive run of name-shaped lines, before
    extract_item_name() below decides whether it's trustworthy enough to
    return. Tags often split the name across 2-3 consecutive lines
    ("CAGE FREE" / "LARGE BROWN" / "EGGS"), so this joins consecutive
    name-shaped lines into one candidate instead of trusting any single
    line."""
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
    """Best-effort single product name, or None when nothing confident was
    found. A group longer than MAX_PLAUSIBLE_NAME_WORDS is suppressed
    rather than returned, since it's more likely an OCR noise join than a
    real name (see MAX_PLAUSIBLE_NAME_WORDS) — the caller should treat a
    None here the same as "ask the user to type it in", not retry."""
    best = _best_name_group(text)
    if best is None or len(best.split()) > MAX_PLAUSIBLE_NAME_WORDS:
        return None
    return best


def extract_brand(text):
    """None (not a guess) when no known brand is found — brand is optional
    in the schema, and guessing wrong here is worse than leaving it blank
    for the user to fill in."""
    match = BRAND_PATTERN.search(text)
    return match.group(1).title() if match else None


def extract_unit_size(text):
    """Single cleaned value for the schema's unitSize field, vs.
    extract_weight()'s full list — tags often print the same size twice
    (e.g. once near the name, once in the barcode block), so the first
    match is as good a guess as any later duplicate."""
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
        # non-empty only when extract_item_name() suppressed a guess for
        # being too long — lets you judge whether MAX_PLAUSIBLE_NAME_WORDS
        # is cutting off real names, not just noise.
        "item_name_suppressed": raw_name if (raw_name and not item_name) else "",
        "brand_guess": extract_brand(text) or "",
        "unit_size_guess": extract_unit_size(text) or "",
        "weight_unit_guess": ", ".join(extract_weight(text)),
        "name_candidates": " | ".join(extract_name_candidates(text)),
        "raw_text": text.replace("\n", " | "),
        "correct": "",
        "notes": ""
    }


def scan_price_tag(image_path, client=None):
    """Entry point for one photo — what a backend endpoint calls. main()
    below only batch-tests this against the 38 ground-truthed photos."""
    if client is None:
        client = vision.ImageAnnotatorClient()
    text = run_vision(client, image_path)
    price, _ = extract_final_price(text)
    return {
        "itemName": extract_item_name(text),
        "brand": extract_brand(text),
        "unitSize": extract_unit_size(text),
        "price": price,
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
    fieldnames = ["image", "engine", "final_price_guess", "correct", "match", "price_source", "all_prices", "item_name_guess", "item_name_suppressed", "brand_guess", "unit_size_guess", "weight_unit_guess", "name_candidates", "notes", "raw_text"]
    with open(results_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    main()