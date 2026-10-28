"""Regression tests for brand, size and name extraction. Each case comes from a
real misread in test_images/. Run offline (no API calls): python -m unittest test_extraction"""
import io
import os
import tempfile
import unittest

from PIL import Image

from ocr_test import (
    FALLBACK_PRICE_FACTOR,
    MIN_PRICE_CONFIDENCE,
    _normalized_size_match,
    _strip_trailing_codes,
    extract_brand,
    extract_final_price,
    extract_unit_size,
    extract_weight,
    load_image_as_jpeg_bytes,
    price_confidence,
)


class BrandTests(unittest.TestCase):
    def test_brand_split_across_lines(self):
        self.assertEqual(extract_brand("Good&\nGather™\nBoneless"), "Good & Gather")

    def test_brand_with_normal_spacing(self):
        self.assertEqual(extract_brand("Good & Gather Cheddar"), "Good & Gather")

    def test_product_brand_beats_store_name(self):
        text = "DISTRIBUTED BY TARGET CORPORATION\nGood&Gather"
        self.assertEqual(extract_brand(text), "Good & Gather")

    def test_store_name_used_when_nothing_else_matches(self):
        self.assertEqual(extract_brand("Shop Target.com"), "Target")

    def test_unseen_brand_is_blank_not_guessed(self):
        self.assertIsNone(extract_brand("Some Unknown Brand 12 OZ"))

    def test_curly_apostrophe(self):
        self.assertEqual(extract_brand("Trader Joe’s Organic").lower(), "trader joe's")

    def test_longer_brand_wins_over_its_prefix(self):
        self.assertEqual(extract_brand("Lidl Preferred Selection").lower(), "lidl preferred selection")

    def test_full_brand_beats_split_fragment_earlier_in_text(self):
        # 21.JPG: "PREFERRED / SELECTION" is split at the top, the full name is printed twice later
        text = ("PREFERRED\nSELECTION\nPECORINO\nLIDL PREFERRED SELECTION\n8 OZ\n"
                "LIDL PREFERRED SELECTION")
        self.assertEqual(extract_brand(text).lower(), "lidl preferred selection")

    def test_most_repeated_brand_wins_over_longer_one(self):
        # bread.HEIC: "WONDER" is printed twice, "WONDER BREAD" once
        self.assertEqual(extract_brand("WONDER\nWONDER BREAD\nWONDER"), "Wonder")

    def test_tie_keeps_earliest_brand(self):
        self.assertEqual(extract_brand("Milbona\nLactaid"), "Milbona")

    def test_milbona(self):
        self.assertEqual(extract_brand("LACTOSE FREE\nMilbona"), "Milbona")


class SizeExtractionTests(unittest.TestCase):
    def test_fraction_is_not_split(self):
        self.assertEqual(extract_weight("64 FL OZ (1/2 GAL)"), ["64 FL OZ", "1/2 GAL"])

    def test_first_size_keeps_the_fraction(self):
        self.assertEqual(extract_unit_size("L 02 (1/2 GAL) 1.89L"), "1/2 GAL")

    def test_plain_sizes_unchanged(self):
        self.assertEqual(extract_unit_size("Dinner Roll 2.5 lb"), "2.5 lb")

    def test_multipack_is_not_a_fraction(self):
        # 16.JPG: "6/13.2 OZ" is six 13.2 oz cans
        self.assertEqual(extract_unit_size("6/13.2 OZ"), "13.2 OZ")


class SizeMatchTests(unittest.TestCase):
    def match(self, guess, correct):
        return _normalized_size_match(guess, correct)

    def test_same_amount_in_other_units_matches(self):
        self.assertEqual(self.match("1.25 LB", "20 oz"), "Y")
        self.assertEqual(self.match("3.78 L", "1 gallon"), "Y")
        self.assertEqual(self.match("1/2 GAL", "64 fl oz"), "Y")
        self.assertEqual(self.match("1.9L", "64 fl oz"), "Y")
        self.assertEqual(self.match("16 oz", "1 lb"), "Y")

    def test_different_amounts_do_not_match(self):
        self.assertEqual(self.match("2 GAL", "64 fl oz"), "N")
        self.assertEqual(self.match("2 L", "64 fl oz"), "N")
        self.assertEqual(self.match("516g", "4.53 lb"), "N")

    def test_weight_and_volume_are_not_interchangeable(self):
        self.assertEqual(self.match("64 fl oz", "64 oz"), "N")

    def test_count_aliases(self):
        self.assertEqual(self.match("12 CT", "12 count"), "Y")
        self.assertEqual(self.match("1 dozen", "12 ct"), "Y")

    def test_empty_guess_is_a_miss(self):
        self.assertEqual(self.match("", "12 count"), "N")

    def test_ungraded_row_stays_blank(self):
        self.assertEqual(self.match("12 CT", ""), "")

    def test_zero_denominator_does_not_crash(self):
        self.assertEqual(self.match("1/0 GAL", "1 gal"), "N")

    def test_multipack_text_is_not_parsed_as_a_fraction(self):
        self.assertEqual(self.match("6/13.2 OZ", "13.2 oz"), "N")


class TrailingCodeTests(unittest.TestCase):
    def test_sku_codes_still_stripped(self):
        self.assertEqual(_strip_trailing_codes("CHICKEN BREAST P 935 L6"), "CHICKEN BREAST")


class ImageOrientationTests(unittest.TestCase):
    EXIF_ORIENTATION = 0x0112

    def sent_size(self, orientation):
        # a 40x20 landscape file, optionally tagged as needing a 90 degree turn (6 = rotate clockwise)
        exif = Image.Exif()
        if orientation:
            exif[self.EXIF_ORIENTATION] = orientation
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = os.path.join(tmp_dir, "tag.jpg")
            Image.new("RGB", (40, 20), "white").save(path, "JPEG", exif=exif)
            return Image.open(io.BytesIO(load_image_as_jpeg_bytes(path))).size

    def test_photo_tagged_as_rotated_is_turned_upright(self):
        self.assertEqual(self.sent_size(orientation=6), (20, 40))

    def test_untagged_photo_is_left_alone(self):
        self.assertEqual(self.sent_size(orientation=None), (40, 20))

    def test_photo_tagged_as_upright_is_left_alone(self):
        self.assertEqual(self.sent_size(orientation=1), (40, 20))


class PriceConfidenceTests(unittest.TestCase):
    LABELLED = "label: YOU PAY"
    FALLBACK = "fallback: first $ price"

    def test_no_price_scores_zero(self):
        self.assertEqual(price_confidence(None, "none found", [("1.79", 0.99)]), 0.0)

    def test_price_missing_from_words_scores_zero(self):
        self.assertEqual(price_confidence("1.79", self.LABELLED, [("2.49", 0.99)]), 0.0)

    def test_clearest_read_of_a_repeated_price_counts(self):
        words = [("$1.79", 0.40), ("1.79", 0.95)]
        self.assertEqual(price_confidence("1.79", self.LABELLED, words), 0.95)

    def test_fallback_guess_is_scaled_down(self):
        score = price_confidence("1.79", self.FALLBACK, [("1.79", 0.96)])
        self.assertAlmostEqual(score, 0.96 * FALLBACK_PRICE_FACTOR, places=3)

    def test_price_printed_without_decimal_point_or_with_comma(self):
        self.assertEqual(price_confidence("1.79", self.LABELLED, [("$179", 0.9)]), 0.9)
        self.assertEqual(price_confidence("1.79", self.LABELLED, [("1,79", 0.9)]), 0.9)

    def test_cents_price(self):
        self.assertEqual(price_confidence("0.69", self.LABELLED, [("69¢", 0.9)]), 0.9)
        self.assertEqual(price_confidence("0.05", self.LABELLED, [("5¢", 0.9)]), 0.9)

    def test_digits_inside_a_longer_number_do_not_count(self):
        self.assertEqual(price_confidence("1.99", self.LABELLED, [("2.791.990", 0.99)]), 0.0)

    def test_label_found_by_extract_final_price_is_treated_as_labelled(self):
        price, source = extract_final_price("YOU PAY\n1.79")
        self.assertEqual(price_confidence(price, source, [("1.79", 0.96)]), 0.96)

    def test_cutoff_separates_clear_and_unclear_reads(self):
        clear = price_confidence("1.79", self.LABELLED, [("1.79", 0.95)])
        unclear = price_confidence("1.79", self.LABELLED, [("1.79", 0.55)])
        self.assertGreaterEqual(clear, MIN_PRICE_CONFIDENCE)
        self.assertLess(unclear, MIN_PRICE_CONFIDENCE)


if __name__ == "__main__":
    unittest.main()
