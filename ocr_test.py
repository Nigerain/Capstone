import argparse
import csv
import io
import logging
import os
import re
import time
import unicodedata
from collections import Counter
from functools import lru_cache

import cv2
import pytesseract
import numpy as np
import pillow_heif
from PIL import Image, ImageOps
from google.api_core.exceptions import GoogleAPIError, ServiceUnavailable
from google.cloud import vision

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

logger = logging.getLogger(__name__)

pillow_heif.register_heif_opener()

# A small upload can decompress to gigabytes of pixels, so oversized images are rejected.
MAX_IMAGE_PIXELS = 64_000_000
VISION_TIMEOUT_SECONDS = 30
VISION_RETRY_DELAY_SECONDS = 1


class ScanError(Exception):
    """The photo could not be read: an unusable image or a failed OCR request."""


@lru_cache(maxsize=1)
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
# a rate written on the price itself ("14.99/Lb."), which UNIT_PRICE_LABEL misses
PER_POUND_RATE = re.compile(r'\d{1,3}[.,]\d{2}\s*/\s*lbs?\b', re.IGNORECASE)
# a net weight in pounds; the $ in the lookbehind keeps the rate in "$2.29 LB" out
POUND_WEIGHT = re.compile(r'(?<![\d.$])(\d+(?:\.\d+)?)[ \t]*lbs?\b', re.IGNORECASE)
# rate x weight is rounded to the cent before printing, so allow a cent of drift
PRICE_TOTAL_TOLERANCE = 0.01
# [ \t]* not \s*, so "4.49\nG" isn't read as a weight
# "fl" catches "64 fl oz"; "count" is spelled out on digital shelf tags, not just "ct"
# single-digit fraction keeps "(1/2 GAL)" from being read as "2 GAL"; "6/13.2 OZ" (a 6 pack) is not one
# the lookbehind rejects a price per unit, which is shaped like a weight ("$2.29 LB" next to "5.29 LB"),
# and stops the tail of a rejected number matching on its own ("$2.29" -> "29 LB")
WEIGHT_PATTERN = re.compile(r'(?<![\d.$])(?:\d/\d|\d+(?:\.\d+)?)[ \t]*(?:fl[ \t.]*)?(?:oz|lbs?|g|kg|ml|l|gal|ct|count|dz|pk)\b', re.IGNORECASE)
TRAILING_SIZE_PATTERN = re.compile(WEIGHT_PATTERN.pattern + r'\s*$', re.IGNORECASE)
_NUTRIENT_WORDS = r'fat|protein|sugar|carb|fiber|sodium|cholest|calories|potas|iron|calcium|vitamin'
# "serving size 1 cup (240ml)" states a size of its own, so that line is never the pack size
_SERVING_WORDS = r'serving'
NUTRITION_WORDS = re.compile(rf'{_NUTRIENT_WORDS}|{_SERVING_WORDS}', re.IGNORECASE)
NUTRIENT_PATTERN = re.compile(_NUTRIENT_WORDS, re.IGNORECASE)
SERVING_PATTERN = re.compile(_SERVING_WORDS, re.IGNORECASE)
# Beside a nutrient word, a measurement is the pack size only when its unit is one a
# Nutrition Facts panel never uses: "2% REDUCED FAT 1GAL" is a size, while "Total Fat 8g"
# and the "1 cup (240mL)" serving beside "Cholest" are not.
PACK_ONLY_UNIT = re.compile(r'(?:oz|lbs?|gal|ct|count|dz|pk)\s*$', re.IGNORECASE)
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
    r'DISTRIBUTED BY|MEAT DEPT|INSPECTED|AND PASSED BY|USDA|NEEDS TO BE|COOK TO|'
    r'THERMOMETER|HORMONES|STEROIDS|ANTIBIOTICS|HATCHED|HARVESTED|'
    r'VERIFIED|PROCESSED|MINIMALLY|INGREDIENTS|LEARN MORE|SHAKE WELL|GLUTEN FREE|'
    r'NEW LOW PRICE|REGULAR PRICE|WITH LIDL PLUS|BUY MORE|SAVE MORE|'
    r'EXCLUSIVE DEAL|COLOR IS NOT|ACCURATE|INDICATOR|FREEZE BY|'
    r'PER UNIT|PER QT|^LIMIT \d+$',
    re.IGNORECASE,
)
# a bare word alone on a line: a modifier with no noun ("Organic"), or shelf-tag
# chrome naming a price tier ("REG", "WITH" / "PRIME" on an Amazon Fresh tag).
# Only whole-line matches, so a real name keeps these words ("Prime Rib").
GENERIC_MODIFIER_ONLY = re.compile(
    r"^(?:ORGANIC|CERTIFIED|HUMANE|KOSHER|NATURAL|FRESH|PASTURE RAISED|"
    r"CAGE FREE|GRADE [A-Z]|NON[\s-]?GMO|"
    r"REG|PRIME|WITH|WITH PRIME|MEMBER|CLUB|EACH)$",
    re.IGNORECASE,
)
# lookup, not a positional rule; brand position varies by tag. Add new ones as seen.
KNOWN_BRANDS = [
    "lidl preferred selection", "preferred selection", "lidl", "milbona",
    "good & gather", "dave's killer bread", "wonder bread", "wonder",
    "alouette", "eggland's best", "lactaid", "perdue", "tyson",
    "hy-vee", "target", "butcher's specialty", "allen harim",
    "kirkland signature", "member's mark", "market pantry", "trader joe's",
    "carando",
]
# shelf tags abbreviate the brand they stock ("GG MILK" on a Target tag)
BRAND_ALIASES = {"gg": "good & gather"}
# a retailer, not who makes the product; a product brand wins when both appear
STORE_BRANDS = {"lidl", "hy-vee", "target"}


def _brand_alternation(brands):
    # longest first, so "lidl preferred selection" beats its prefix "lidl" whatever the list order
    return "|".join(re.escape(b) for b in sorted(brands, key=len, reverse=True))


BRAND_PATTERN = re.compile(rf"\b({_brand_alternation(KNOWN_BRANDS)})\b", re.IGNORECASE)
# caps the longest-run heuristic so garbled OCR doesn't join into a fake name
# egg/poultry names run to 7 words ("Free Range Large Brown Grade A Eggs")
MAX_PLAUSIBLE_NAME_WORDS = 7
# Common grocery nouns. A product name nearly always contains one and misread
# packaging text nearly never does, so this separates "CHICKEN BREAST" from
# "BNLS SKLS" where length alone cannot. Add nouns as new categories are tested.
FOOD_WORDS = """
apple apples banana bananas orange oranges lemon lemons lime limes grape grapes
berry berries strawberry strawberries blueberry blueberries raspberry blackberry
melon watermelon cantaloupe pineapple mango peach peaches pear pears plum cherry cherries
avocado tomato tomatoes potato potatoes onion onions garlic carrot carrots celery
lettuce spinach kale cabbage broccoli cauliflower pepper peppers cucumber zucchini
squash pumpkin mushroom mushrooms corn peas beans asparagus radish beet ginger herbs
basil cilantro parsley salad greens sprouts

milk cream creamer butter margarine cheese cheddar mozzarella parmesan swiss provolone
gouda brie feta ricotta yogurt yoghurt eggs egg buttermilk

beef steak sirloin ribeye brisket chuck ground patties burger chicken breast breasts
thigh thighs wings drumstick turkey pork bacon ham sausage sausages salami pepperoni
meatball meatballs ribs roast lamb veal fish salmon tuna tilapia cod shrimp crab
lobster scallops seafood hotdog franks deli

bread loaf bun buns roll rolls bagel bagels muffin muffins tortilla tortillas pita
croissant biscuit biscuits cake cookies cookie brownie pie donut doughnut pastry
baguette sourdough wheat rye white

rice pasta spaghetti penne macaroni noodles noodle cereal oats oatmeal granola flour
sugar salt pepper spice sauce ketchup mustard mayo mayonnaise dressing vinegar oil
olive soup broth stock lentils chickpeas peanut almond cashew walnut pecan nuts
honey syrup jam jelly chips crackers pretzels popcorn candy chocolate

water juice soda cola coffee tea lemonade seltzer sparkling beer wine cider kombucha
smoothie

pizza fries nuggets waffles pancakes sorbet
""".split()
FOOD_PATTERN = re.compile(
    r"\b(" + "|".join(sorted(set(FOOD_WORDS), key=len, reverse=True)) + r")\b", re.IGNORECASE
)


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

def load_image_as_jpeg_bytes(source):
    """Takes a path or a file object. Raises ScanError if it isn't a usable image."""
    try:
        with Image.open(source) as image:
            if image.width * image.height > MAX_IMAGE_PIXELS:
                raise ScanError("image has too many pixels")
            # phones store "which way is up" in EXIF and the re-save below drops it, so apply
            # it first or a portrait photo reaches Vision sideways
            rgb = ImageOps.exif_transpose(image).convert("RGB")
    except (OSError, ValueError, SyntaxError, Image.DecompressionBombError) as error:
        # Pillow raises a mix of these for corrupt and non-image files
        raise ScanError("unreadable image") from error
    buffer = io.BytesIO()
    rgb.save(buffer, format="JPEG")
    return buffer.getvalue()


def _detect_once_more_if_unavailable(detect, image):
    # Vision returns 503 during brief outages; retrying makes a failed scan a slow one
    try:
        return detect(image=image, timeout=VISION_TIMEOUT_SECONDS)
    except ServiceUnavailable:
        time.sleep(VISION_RETRY_DELAY_SECONDS)
        return detect(image=image, timeout=VISION_TIMEOUT_SECONDS)


def _annotate(detect, jpeg_bytes):
    try:
        response = _detect_once_more_if_unavailable(detect, vision.Image(content=jpeg_bytes))
    except GoogleAPIError as error:
        raise ScanError("Vision request failed") from error
    # the API reports some failures inside the response, not as an exception
    if response.error.message:
        raise ScanError(response.error.message)
    return response.full_text_annotation


def run_vision(client, image_path):
    return _annotate(client.text_detection, load_image_as_jpeg_bytes(image_path)).text


def run_vision_words(client, jpeg_bytes):
    """Like run_vision, but takes JPEG bytes and also returns (word, confidence)
    pairs. Uses document_text_detection because text_detection leaves every
    word's confidence at 0.0."""
    annotation = _annotate(client.document_text_detection, jpeg_bytes)
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
# Those 45 tested blur, so the score only had to measure legibility. A crisp photo
# of a markdown tag defeats that: the SAVE badge reads as sharply as the retail
# price, and on test_images_batch2 four wrong prices scored 0.80-0.84 against a
# correct range of 0.81-0.84. No threshold separates those, which is what
# _selection_confidence is for.
MIN_PRICE_CONFIDENCE = 0.8
LABELLED_PRICE_FACTOR = 1.0
FALLBACK_PRICE_FACTOR = 0.85
# extract_final_price tags a price found next to a "you pay"-style label with this
LABELLED_SOURCE_PREFIX = "label:"
# ... and a price recovered from a per-pound rate times the net weight with this
TOTAL_SOURCE_PREFIX = "total:"
# Both say the tag stated what the number was, so neither is scaled down. A rate
# times weight landing on another printed price is two readings agreeing, which is
# at least as strong as a label.
FULL_CONFIDENCE_SOURCES = (LABELLED_SOURCE_PREFIX, TOTAL_SOURCE_PREFIX)
# A markdown tag prints was, save and now, and the three agree: was - save = now.
# Landing on the "now" of that sum is two readings agreeing, so it scores like a
# label; landing on the "was" or the "save" means the wrong number was picked.
SAVE_MISPICK_FACTOR = 0.0
PRICE_MATCH_TOLERANCE = 0.005
# A loyalty tag also prints a saving, but its higher price is the shelf price, not a
# struck-out one, so neither number is a misread and the markdown test doesn't apply.
LOYALTY_PRICE_LABEL = re.compile(r'REGULAR PRICE|WITH LIDL PLUS|MEMBER PRICE', re.IGNORECASE)


def _tag_prices(text):
    """Prices the shopper could mistake for the retail price: per-unit rates excluded."""
    values = []
    for line in text.split("\n"):
        if UNIT_PRICE_LABEL.search(line) or PER_POUND_RATE.search(line):
            continue
        values += [float(p.lstrip("$")) for p in extract_prices(line)]
    return values


def _save_triple(text):
    """(was, now, save) for a markdown tag, or None if the tag prints no such sum.

    Sorted, the price paid is the middle of the three: the struck-out "was" is larger
    and the markdown smaller. That ordering is what tells the price from the discount,
    since the subtraction alone reads both ways (5.39 - 1.10 = 4.29 and 5.39 - 4.29 =
    1.10 describe the same three numbers). A cut of more than half would put the
    markdown above the price and break the assumption, which no tag seen so far does.
    """
    if not SAVE_LABEL.search(text) or LOYALTY_PRICE_LABEL.search(text):
        return None
    values = sorted(set(_tag_prices(text)), reverse=True)
    for i, was in enumerate(values):
        for now in values[i + 1:]:
            save = round(was - now, 2)
            if save < now and any(abs(save - v) <= PRICE_MATCH_TOLERANCE for v in values):
                return was, now, save
    return None


def _selection_confidence(price, price_source, text):
    """How much the tag's own layout backs the number that was picked, 0-1.

    Separate from how clearly the digits read: on a printed tag a SAVE badge is as
    sharp as the retail price, so legibility alone cannot tell a good pick from a bad
    one. Only this term moves when the wrong number is chosen.
    """
    if price_source.startswith(FULL_CONFIDENCE_SOURCES):
        return LABELLED_PRICE_FACTOR
    triple = _save_triple(text)
    if triple is not None:
        was, now, save = triple
        if abs(float(price) - now) <= PRICE_MATCH_TOLERANCE:
            return LABELLED_PRICE_FACTOR
        if min(abs(float(price) - was), abs(float(price) - save)) <= PRICE_MATCH_TOLERANCE:
            return SAVE_MISPICK_FACTOR
    return FALLBACK_PRICE_FACTOR


def price_confidence(price, price_source, words, text=""):
    """0-1 score combining two separate questions, since either alone passes a bad read.

    How clearly the digits read: Vision's best confidence on the words that are the
    price (the same price is often printed twice, so the clearest read counts). A word
    counts only if it is the whole price ("$1.79", "179", "1,79", or "69" for a 69 cent
    price), so digits inside other numbers don't.

    How well the tag backs that number: _selection_confidence. Pass `text` to get it;
    without the tag text a pick can only be scored on legibility, which on a printed
    tag is as high for a SAVE badge as for the retail price.
    """
    if price is None:
        return 0.0
    forms = {price, price.replace(".", "")}
    if price.startswith("0."):
        cents = price[2:]
        forms |= {cents, cents.lstrip("0")}
    matches = [conf for word_text, conf in words
               if re.sub(r"^\D+|\D+$", "", word_text).replace(",", ".") in forms]
    if not matches:
        return 0.0
    return round(max(matches) * _selection_confidence(price, price_source, text), 3)


def extract_prices(text):
    text = DATE_PATTERN.sub(" ", text)
    found = [(m.start(), m.group().replace(",", ".")) for m in PRICE_PATTERN.finditer(text)]
    found += [(m.start(), f"${m.group(1)}.{m.group(2)}") for m in DOLLAR_NO_DECIMAL_PATTERN.finditer(text)]
    found += [(m.start(), f"${int(m.group(1)) // 100}.{int(m.group(1)) % 100:02d}") for m in CENTS_PATTERN.finditer(text)]
    return [price for _, price in sorted(found)]


def _printed_total_for_rate(rate, text):
    """The printed total when `rate` turns out to be a per-pound price, else None.

    A scale label prints the rate, the net weight and the total, and the rate carries
    the same "PRICE" wording, so it gets picked instead (c.HEIC: 14.99/lb on a 1.35 lb
    steak costing 20.24). The product is only trusted when the tag prints it too, so
    this corrects a misread and never invents a price the shopper cannot see.
    """
    if rate is None or not (UNIT_PRICE_LABEL.search(text) or PER_POUND_RATE.search(text)):
        return None
    cleaned = DATE_PATTERN.sub(" ", text)
    printed = {p.lstrip("$") for p in extract_prices(cleaned)} - {rate}
    for weight in POUND_WEIGHT.findall(cleaned):
        total = float(rate) * float(weight)
        for candidate in printed:
            if abs(float(candidate) - total) <= PRICE_TOTAL_TOLERANCE:
                return candidate
    return None


def extract_final_price(text):
    """Returns (price, how_it_was_chosen) so each guess can be checked by hand."""
    price, source = _price_as_printed(text)
    total = _printed_total_for_rate(price, text)
    if total is not None:
        return total, f"{TOTAL_SOURCE_PREFIX} {price}/lb x net weight"
    return price, source


def _price_as_printed(text):
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
        # a value can sit a line apart from its label ("25g" above "PROTEIN")
        window = " ".join(lines[i:i + 2])
        if SERVING_PATTERN.search(window):
            continue
        beside_nutrient = NUTRIENT_PATTERN.search(window)
        weights += [
            weight for weight in WEIGHT_PATTERN.findall(line)
            if not beside_nutrient or PACK_ONLY_UNIT.search(weight)
        ]
    return weights


def _strip_trailing_codes(line):
    # strips trailing SKU/PLU codes ("CHICKEN BREAST P 935 L6" -> "CHICKEN BREAST")
    tokens = line.split()
    while tokens and (re.match(r'^[A-Z]?\d+[A-Z]?\d*$', tokens[-1]) or re.match(r'^[A-Z]$', tokens[-1])):
        tokens.pop()
    return " ".join(tokens)


def _strip_trailing_size(line):
    # the size has its own field, and leaving it attached costs the whole line:
    # a digit anywhere fails NAME_LINE_PATTERN ("AMAZON FRESH SWEET ONIONS 2LB")
    return TRAILING_SIZE_PATTERN.sub("", line).rstrip()


def _name_candidate_line(line):
    # cleaned line if name-shaped, else None; shared so both callers below agree
    stripped = _strip_trailing_size(_strip_trailing_codes(line.strip()))
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


def _clearest_read(candidate, confidence_by_word):
    # mean Vision confidence over the words it read; 0.0 when no confidences were passed,
    # which makes this a no-op tiebreak rather than a different ranking
    scores = [confidence_by_word[w.lower()] for w in candidate.split() if w.lower() in confidence_by_word]
    return sum(scores) / len(scores) if scores else 0.0


def _best_name_group(text, words=None):
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
    confidence_by_word = {}
    for word, confidence in words or []:
        key = word.lower()
        confidence_by_word[key] = max(confidence_by_word.get(key, 0.0), confidence)
    # a candidate naming a food beats one that doesn't, however long the other is;
    # among those that do, the longest is the fullest form of the name, and a clearer
    # read settles a tie between two of equal length
    named_food = [group for group in groups if FOOD_PATTERN.search(group)]
    return max(
        named_food or groups,
        key=lambda g: (len(g.split()), _clearest_read(g, confidence_by_word)),
    )


def extract_item_name(text, words=None):
    # None means low confidence, not "retry"; caller should ask the user to type it in
    best = _best_name_group(text, words)
    if best is None or len(best.split()) > MAX_PLAUSIBLE_NAME_WORDS:
        return None
    return best


def _brand_key(s):
    # OCR splits "Good&Gather" over two lines and varies the apostrophe, so brands are
    # compared with whitespace collapsed and no spaces around "&"
    s = re.sub(r"\s+", " ", s.replace("’", "'").lower())
    return re.sub(r"\s*&\s*", "&", s)


_BRANDS_BY_KEY = {_brand_key(b): b for b in KNOWN_BRANDS}
# an alias resolves to the full brand, so "GG MILK" reports Good & Gather, not "Gg".
# Kept out of BRAND_PATTERN so an abbreviation doesn't disqualify the line as a name.
_BRANDS_BY_KEY.update(
    {_brand_key(alias): _BRANDS_BY_KEY[_brand_key(brand)] for alias, brand in BRAND_ALIASES.items()}
)
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


STATUS_OK = "ok"
STATUS_LOW_CONFIDENCE = "low_confidence"
REASON_LOW_SCORE = "low_score"
REASON_NO_PRICE = "no_price"
REASON_READ_FAILED = "read_failed"


def _failed_scan():
    return {
        "status": STATUS_LOW_CONFIDENCE,
        "reason": REASON_READ_FAILED,
        "itemName": None,
        "brand": None,
        "unitSize": None,
        "unitAmount": None,
        "unit": None,
        "price": None,
        "priceConfidence": 0.0,
    }


def scan_price_bytes(image_bytes, client=None):
    """Entry point for one photo, called by the backend with the uploaded bytes.

    status "ok": the price is clear, so the app pre-fills the fields for the user to
    confirm. status "low_confidence": the app asks for a retake or a typed price, and
    reason says why. The price is withheld then, so an unreliable one can't be
    pre-filled; the other fields are kept. A photo that can't be read comes back
    with every field empty.
    """
    if client is None:
        client = get_vision_client()
    try:
        jpeg_bytes = load_image_as_jpeg_bytes(io.BytesIO(image_bytes))
        text, words = run_vision_words(client, jpeg_bytes)
    except ScanError as error:
        logger.warning("Price tag scan failed: %s", error)
        return _failed_scan()

    price, price_source = extract_final_price(text)
    confidence = price_confidence(price, price_source, words, text)
    if price is None:
        status, reason = STATUS_LOW_CONFIDENCE, REASON_NO_PRICE
    elif confidence < MIN_PRICE_CONFIDENCE:
        status, reason = STATUS_LOW_CONFIDENCE, REASON_LOW_SCORE
    else:
        status, reason = STATUS_OK, None
    unit_size = extract_unit_size(text)
    # unitSize is the text as printed, for the app; the pair is what the database stores
    unit_amount, grocery_unit = split_unit_size(unit_size)
    return {
        "status": status,
        "reason": reason,
        "itemName": extract_item_name(text, words),
        "brand": extract_brand(text),
        "unitSize": unit_size,
        "unitAmount": unit_amount,
        "unit": grocery_unit,
        "price": price if status == STATUS_OK else None,
        "priceConfidence": confidence,
    }


def scan_price_tag(image_path, client=None):
    """File-path version of scan_price_bytes, for testing against saved photos."""
    with open(image_path, "rb") as image_file:
        return scan_price_bytes(image_file.read(), client)


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


# canonical unit -> the GroceryUnit value the database stores. "ct"/"count" has no
# value in that enum, so a count size reports no unit instead of a guessed one.
GROCERY_UNITS = {
    "oz": "OZ", "lb": "LB", "g": "G", "kg": "KG",
    "floz": "FL_OZ", "gal": "GAL", "ml": "ML", "l": "L",
    "pt": "PT", "qt": "QT", "dz": "DOZEN", "pk": "PACK",
}


def split_unit_size(unit_size):
    """(amount, GroceryUnit) for the two size columns, or (None, None).

    A tag prints the size as one string ("1GAL", "5.29 LB"), which is what the scan
    reports, while the database keeps a number and an enum. Converting here keeps the
    enum mapping next to the code that produced the string. Returns nothing at all
    rather than half an answer, so a size that doesn't map stays readable in unitSize.
    """
    match = _SIZE_PATTERN.match(re.sub(r"\s+", "", unit_size or "").lower())
    if not match:
        return None, None
    numerator, denominator, amount, unit = match.groups()
    if denominator == "0":
        return None, None
    unit = unit.replace(".", "")
    grocery_unit = GROCERY_UNITS.get(_SIZE_UNIT_NAMES.get(unit, unit))
    if grocery_unit is None:
        return None, None
    value = float(numerator) / float(denominator) if numerator else float(amount)
    return round(value, 3), grocery_unit


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


DEFAULT_FOLDER = "test_images"


def results_filename(folder_name):
    # each folder scores into its own CSV, so one batch never overwrites another's ground truth
    if folder_name == DEFAULT_FOLDER:
        return "ocr_results.csv"
    return f"ocr_results_{folder_name.removeprefix(DEFAULT_FOLDER + '_')}.csv"


def main():
    parser = argparse.ArgumentParser(description="Scan price-tag photos and grade the guesses.")
    parser.add_argument("folder", nargs="?", default=DEFAULT_FOLDER,
                        help=f"folder of photos beside this script (default: {DEFAULT_FOLDER})")
    folder_name = parser.parse_args().folder.rstrip("/")

    folder = os.path.join(SCRIPT_DIR, folder_name)
    results_path = os.path.join(SCRIPT_DIR, results_filename(folder_name))
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