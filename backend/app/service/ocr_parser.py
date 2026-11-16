import re
from typing import Optional

PRICE_PATTERN = re.compile(
    r"(?<!-)\$?\d{1,3}[.,]\d{2}(?!\d*\s*(?:[o0]z|lbs?|l|ml|g|kg)\b)",
    re.IGNORECASE,
)

DOLLAR_NO_DECIMAL_PATTERN = re.compile(r"\$(\d{1,2})(\d{2})\b")
CENTS_PATTERN = re.compile(r"(d{1,3})\s*¢")
DATE_PATTERN = re.compile(r"\bd{1,2}\.\d{1,2}\.\d{2,4}\b")

FINAL_PRICE_LABELS = re.compile(
    r"YOU PAY|SALE PRICE|RE\W{0,3}L PRICE|TOTAL\s*\$?\s*PRICE",
    re.IGNORECASE,
)

SAVE_LABEL = re.compile(r"\bSAVE\b", re.IGNORECASE)
STANDALONE_UNIT_LABEL = re.compile(
    r"UNIT PRICE|PRICE\s*/\s*LB|\bPER[/s-]+(?:LB|OZ|QT|DOZEN|EA|\d+\s*COUNT)\b",
    re.IGNORECASE,
)
UNIT_PRICE_LABEL = re.compile(
    r"UNIT PRICE|PRICE\s*/\s*LB|\bPER[\s-]+(?:LB|OZ|QT|DOZEN|EA)\b",
    re.IGNORECASE,
)

# Package size patterns
WEIGHT_PATTERN = re.compile(
    r"\d+(?:\.\d+)?[ \t]*(?:fl[ \t.]*)?(?:oz|lbs?|g|kg|ml|l|gal|ct|count|dz|pk)\b",
    re.IGNORECASE,
)

NUTRITION_WORDS = re.compile(
    # r"^(?=.{3,}$)(?:\d+%\s+)?(?:[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'\-]*\s*)+$"
    r"\b(?:fat|protein|sugar|carb|fiber|sodium|cholest|serving|calories|potas|iron|calcium|vitamin)\b",
    re.IGNORECASE,
)
CONTAINER_SIZE_LINE = re.compile(
    r"\bGAL\b|\bFL\s*OZ\b",
    re.IGNORECASE,
)

NOISE_LINE_PATTERN = re.compile(
    r"DEPARTMENT OF|AGRICULTURE|FEDERAL REGULATIONS|SERVING SUGGESTION|"
    r"KEEP REFRIGERAT|SELL BY|BEST BY|BEST IF USED|USE WITHIN|PRODUCT OF|"
    r"DISTRIBUTED BY|MEAT DEPT|INSPECTED|USDA|NEEDS TO BE|COOK TO|"
    r"THERMOMETER|HORMONES|STEROIDS|ANTIBIOTICS|HATCHED|HARVESTED|"
    r"VERIFIED|PROCESSED|INGREDIENTS|LEARN MORE|SHAKE WELL|GLUTEN FREE|"
    r"NEW LOW PRICE|REGULAR PRICE|WITH LIDL PLUS|BUY MORE|SAVE MORE|"
    r"PER UNIT|PER QT|^LIMIT \d+$",
    re.IGNORECASE,
)

NAME_LINE_PATTERN = re.compile(
    r"[A-Za-zÀ-ÖØ-öø-ÿ' -]{3,}$"
    # r"^(?=.{3,}$)(?:\d+%\s+)?(?:[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'\-]*\s*)+$"
)

GENERIC_MODIFIER_ONLY = re.compile(
    r"^(?:ORGANIC|CERTIFIED|HUMANE|KOSHER|NATURAL|FRESH|PASTURE RAISED|"
    r"CAGE FREE|GRADE [A-Z]|NON[\s-]?GMO)$",
    re.IGNORECASE,
)

KNOWN_BRANDS = [
    "lidl preferred selection",
    "preferred selection",
    "lidl",
    "good & gather",
    "dave's killer bread",
    "wonder bread",
    "wonder",
    "alouette",
    "eggland's best",
    "lactaid",
    "perdue",
    "tyson",
    "hy-vee",
    "target",
    "butcher's specialty",
    "allen harim",
]

BRAND_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(b) for b in KNOWN_BRANDS) + r")\b",
    re.IGNORECASE,
)

MAX_PLAUSIBLE_NAME_WORDS = 7


def extract_prices(text: str):
    text = DATE_PATTERN.sub(" ", text)
    found = [
        (m.start(), m.group().replace(",", ",")) for m in PRICE_PATTERN.finditer(text)
    ]
    found += [
        (m.start(), f"${m.group(1)}.{m.group(2)}")
        for m in DOLLAR_NO_DECIMAL_PATTERN.finditer(text)
    ]
    found += [
        (m.start(), f"${int(m.group(1)) // 100}.{int(m.group(1)) % 100:02d}")
        for m in CENTS_PATTERN.finditer(text)
    ]
    return [price for _, price in sorted(found)]


def extract_final_price(text: str):
    text = DATE_PATTERN.sub(" ", text)
    lines = text.split("\n")

    for i in range(len(lines)):
        window = " ".join(lines[i : i + 3])
        label = FINAL_PRICE_LABELS.search(window)

        if not label or label.start() > len(lines[i]):
            continue

        nearby = (
            [window[label.end() :]] + lines[i + 3 : i + 5] + lines[max(i - 1, 0) : i]
        )

        for candidate in nearby:
            prices = extract_prices(candidate)
            if prices:
                return prices[-1].lstrip("$"), f"label: {label.group().upper()}"

    excluded = set()

    for i, line in enumerate(lines):
        if STANDALONE_UNIT_LABEL.match(line) or (
            SAVE_LABEL.search(line) and not extract_prices(line)
        ):
            excluded.add(i + 1)

    candidates = []

    for i, line in enumerate(lines):
        if (
            i in excluded
            or UNIT_PRICE_LABEL.search(line)
            or SAVE_LABEL.search(line)
            or NUTRITION_WORDS.search(line)
            or CONTAINER_SIZE_LINE.search(line)
        ):
            continue

        candidates += extract_prices(line)

    if not candidates:
        return None, "none found"

    with_dollar = [p for p in candidates if p.startswith("$")]

    if with_dollar:
        return with_dollar[0].lstrip("$"), "fallback: first $ price"

    return candidates[0], "fallback: first price"


def extract_weight(text: str):
    lines = text.split("\n")
    weights = []

    for i, line in enumerate(lines):
        if NUTRITION_WORDS.search(" ".join(lines[i : i + 2])):
            continue
        weights += WEIGHT_PATTERN.findall(line)

    return weights


def _strip_trailing_codes(line: str):
    tokens = line.split()

    while tokens and (
        re.match(r"^[A-Z]?\d+[A-Z]?\d*$", tokens[-1])
        or re.match(r"^[A-Z]$", tokens[-1])
    ):
        tokens.pop()

    return " ".join(tokens)


def _name_candidate_line(line: str):
    stripped = _strip_trailing_codes(line.strip())

    if not NAME_LINE_PATTERN.match(stripped):
        return None

    if (
        NOISE_LINE_PATTERN.search(stripped)
        or GENERIC_MODIFIER_ONLY.match(stripped)
        or FINAL_PRICE_LABELS.search(stripped)
        or UNIT_PRICE_LABEL.search(stripped)
        or SAVE_LABEL.search(stripped)
        or NUTRITION_WORDS.search(stripped)
        or CONTAINER_SIZE_LINE.search(stripped)
        or BRAND_PATTERN.search(stripped)
    ):
        return None
    return stripped


def _best_name_group(text: str):
    lines = text.split("\n")
    groups = []
    current = []

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


def extract_item_name(text: str):
    best = _best_name_group(text)

    if best is None or len(best.split()) > MAX_PLAUSIBLE_NAME_WORDS:
        return None

    return best


def extract_brand(text: str):
    match = BRAND_PATTERN.search(text)
    return match.group(1).title() if match else None


def extract_unit_size(text: str):
    weights = extract_weight(text)
    return weights[0] if weights else None


def parse_unit_size(size: Optional[str]):
    if not size:
        return None, None

    match = re.match(
        r"(\d+(?:\.\d+)?)\s*(fl\s*oz|oz|lbs?|kg|g|ml|l|gal|ct|count|dz|pk)",
        size,
        re.IGNORECASE,
    )

    if not match:
        return None, None

    amount = float(match.group(1))
    raw_unit = re.sub(r"\s+", "", match.group(2).lower())

    unit_map = {
        "lb": "LB",
        "lbs": "LB",
        "oz": "OZ",
        "floz": "FL_OZ",
        "kg": "KG",
        "g": "G",
        "ml": "ML",
        "l": "L",
        "gal": "GAL",
        "ct": "EACH",
        "dz": "DOZEN",
        "pk": "PACK",
    }
    return amount, unit_map.get(raw_unit)


def parse_ocr_text(text: str):
    price, price_source = extract_final_price(text)
    unit_amount, unit = parse_unit_size(extract_unit_size(text))

    return {
        "itemName": extract_item_name(text),
        "brand": extract_brand(text),
        "price": float(price) if price is not None else None,
        "unitAmount": unit_amount,
        "unit": unit,
        "priceSource": price_source,
    }
