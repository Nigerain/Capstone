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
    _name_candidate_line,
    _normalized_size_match,
    _strip_trailing_codes,
    extract_brand,
    extract_final_price,
    extract_item_name,
    extract_unit_size,
    extract_weight,
    load_image_as_jpeg_bytes,
    price_confidence,
    split_unit_size,
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

    def test_shelf_tag_abbreviation_resolves_to_the_full_brand(self):
        # b.HEIC: a Target shelf label prints "GG MILK", not the brand in full
        self.assertEqual(extract_brand("RETAIL PRICE\n4.29\nGG MILK"), "Good & Gather")

    def test_another_product_in_frame_does_not_win(self):
        # e.HEIC: the scanned item repeats its brand on package and tag, the one
        # further down the shelf appears once
        text = "CARANDO\nITALIAN STYLE MEATBALLS\nRETAIL PRICE\n5.49\nCARANDO\nGood & Gather"
        self.assertEqual(extract_brand(text), "Carando")


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

    def test_price_per_pound_is_not_the_weight(self):
        # f.HEIC: "$2.29 LB 5.29 LB" is the price per pound then the net weight
        self.assertEqual(extract_unit_size("$2.29 LB 5.29 LB\nPRICE/LB NET WT LBS"), "5.29 LB")


class NutritionFilterTests(unittest.TestCase):
    def test_nutrition_values_are_not_sizes(self):
        self.assertEqual(extract_weight("Total Fat 8g"), [])
        self.assertEqual(extract_weight("25g\nPROTEIN"), [])

    def test_serving_size_is_not_the_pack_size(self):
        self.assertEqual(extract_weight("Serving size 8 fl oz"), [])

    def test_nutrient_word_in_the_product_name_keeps_the_size(self):
        # b.HEIC: the only size on the tag shares a line with "REDUCED FAT"
        self.assertEqual(extract_weight("2% REDUCED FAT 1GAL"), ["1GAL"])

    def test_serving_in_millilitres_loses_to_the_container_size(self):
        # milk.HEIC prints "1 cup (240mL)" beside a nutrient, and the real size further down
        text = "1 cup (240mL) Cholest\nSodium\nGALLON (3.78 L)\nKOSHER"
        self.assertEqual(extract_unit_size(text), "3.78 L")


class NameExclusionTests(unittest.TestCase):
    def test_name_keeps_its_words_when_the_size_is_on_the_same_line(self):
        # the Amazon Fresh tag prints name and size together; a digit fails the name shape
        self.assertEqual(
            extract_item_name("AMAZON FRESH SWEET ONIONS 2LB\nREG\nWITH\nPRIME"),
            "AMAZON FRESH SWEET ONIONS",
        )

    def test_price_tier_words_are_not_a_name(self):
        for line in ("REG", "WITH", "PRIME", "MEMBER", "EACH"):
            self.assertIsNone(_name_candidate_line(line), line)

    def test_a_real_name_may_contain_a_tier_word(self):
        self.assertEqual(_name_candidate_line("Prime Rib Roast"), "Prime Rib Roast")

    def test_freshness_disclaimer_is_not_a_name(self):
        # d.HEIC: printed on most meat packaging, and shaped like a name
        self.assertIsNone(_name_candidate_line("COLOR IS NOT"))
        self.assertIsNone(_name_candidate_line("AN ACCURATE"))


class PerPoundTotalTests(unittest.TestCase):
    # c.HEIC: the shelf label repeats the per-pound rate, so the rate reads as the price
    RATE_TAG = "NET WT. 1.35lb PRICE\n14.99/Lb.\n$20.24\nRETAIL PRICE\n14.99"

    def test_rate_times_weight_recovers_the_printed_total(self):
        self.assertEqual(extract_final_price(self.RATE_TAG)[0], "20.24")

    def test_the_correction_says_where_the_price_came_from(self):
        self.assertIn("14.99/lb", extract_final_price(self.RATE_TAG)[1])

    def test_a_recovered_total_is_not_scaled_down(self):
        price, source = extract_final_price(self.RATE_TAG)
        self.assertEqual(price_confidence(price, source, [("$20.24", 0.95)]), 0.95)

    def test_a_total_not_printed_on_the_tag_is_never_invented(self):
        text = "NET WT. 1.35lb\nPRICE/LB\nRETAIL PRICE\n14.99"
        self.assertEqual(extract_final_price(text)[0], "14.99")

    def test_a_labelled_total_is_left_alone(self):
        # f.HEIC: already correct, and 12.11 x 5.29 lb matches nothing printed
        text = "$2.29 LB 5.29 LB\nPRICE/LB NET WT LBS\nTOTAL PRICE\n$12.11"
        self.assertEqual(extract_final_price(text)[0], "12.11")

    def test_no_per_unit_wording_means_no_correction(self):
        text = "NET WT 1.35lb\n$20.24\nRETAIL PRICE\n14.99"
        self.assertEqual(extract_final_price(text)[0], "14.99")


class NameSelectionTests(unittest.TestCase):
    def test_a_candidate_naming_a_food_beats_a_longer_one(self):
        # 1.JPG: the abbreviated name joins the inspection stamp into a longer run
        text = "INSP\nTED\nBNLS SKLS\n935\nCHICKEN BREAST"
        self.assertEqual(extract_item_name(text), "CHICKEN BREAST")

    def test_the_fullest_form_of_the_name_still_wins(self):
        # 16.JPG: several candidates name the cheese, the longest is the whole name
        text = "Brie\n8 OZ\nDouble Creme Brie Soft Ripened Cheese\n4.99"
        self.assertEqual(extract_item_name(text), "Double Creme Brie Soft Ripened Cheese")

    def test_longest_run_still_decides_when_no_candidate_names_a_food(self):
        text = "Relleno-Style\n12 OZ\nBreaded Chile Relleno-Style"
        self.assertEqual(extract_item_name(text), "Breaded Chile Relleno-Style")

    def test_clearer_read_settles_a_tie_between_equal_length_names(self):
        text = "Ground Bccf\n5.99\nGround Beef"
        words = [("Ground", 0.98), ("Bccf", 0.41), ("Beef", 0.97)]
        self.assertEqual(extract_item_name(text, words), "Ground Beef")

    def test_no_confidences_passed_keeps_the_earlier_candidate(self):
        text = "Ground Bccf\n5.99\nGround Beef"
        self.assertEqual(extract_item_name(text), "Ground Bccf")


class UnitSizeSplitTests(unittest.TestCase):
    def test_sizes_from_the_test_photos_map_to_the_enum(self):
        cases = {
            "1GAL": (1.0, "GAL"),      # b.HEIC
            "1.35lb": (1.35, "LB"),    # c.HEIC
            "32 OZ": (32.0, "OZ"),     # d.HEIC
            "5.29 LB": (5.29, "LB"),   # f.HEIC
            "3.78 L": (3.78, "L"),     # milk.HEIC
            "64 FL OZ": (64.0, "FL_OZ"),
            "1 dozen": (1.0, "DOZEN"),
        }
        for text, expected in cases.items():
            self.assertEqual(split_unit_size(text), expected, text)

    def test_a_fraction_becomes_a_decimal_amount(self):
        self.assertEqual(split_unit_size("1/2 GAL"), (0.5, "GAL"))

    def test_a_count_size_reports_no_unit_because_the_enum_has_none(self):
        # a.HEIC returns "100 CT"; GroceryUnit has no CT, and a guessed unit is worse
        self.assertEqual(split_unit_size("100 CT"), (None, None))

    def test_unparseable_sizes_are_blank_not_guessed(self):
        for text in ("6/13.2 OZ", "1/0 GAL", "", None, "large"):
            self.assertEqual(split_unit_size(text), (None, None), text)


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
