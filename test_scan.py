"""Tests for scan_price_bytes using a fake Vision client, so no API calls are made.
Run: python3 -m unittest test_scan"""
import io
import os
import tempfile
import unittest
from types import SimpleNamespace
from unittest import mock

from google.api_core.exceptions import ServiceUnavailable
from PIL import Image

import ocr_test
from ocr_test import scan_price_bytes, scan_price_tag


def make_jpeg():
    buffer = io.BytesIO()
    Image.new("RGB", (40, 20), "white").save(buffer, "JPEG")
    return buffer.getvalue()


def vision_response(text, words, error=""):
    word_objects = [
        SimpleNamespace(symbols=[SimpleNamespace(text=c) for c in word], confidence=confidence)
        for word, confidence in words
    ]
    page = SimpleNamespace(
        blocks=[SimpleNamespace(paragraphs=[SimpleNamespace(words=word_objects)])]
    )
    return SimpleNamespace(
        error=SimpleNamespace(message=error),
        full_text_annotation=SimpleNamespace(text=text, pages=[page]),
    )


class FakeClient:
    def __init__(self, response=None, raises=None):
        self.response = response
        self.raises = raises
        self.calls = 0

    def document_text_detection(self, image, timeout=None):
        self.calls += 1
        if self.raises:
            raise self.raises
        return self.response


def labelled_client(confidence):
    return FakeClient(vision_response("YOU PAY\n1.79", [("1.79", confidence)]))


class StatusTests(unittest.TestCase):
    def test_clear_price_is_ok(self):
        result = scan_price_bytes(make_jpeg(), labelled_client(0.97))
        self.assertEqual(result["status"], "ok")
        self.assertIsNone(result["reason"])
        self.assertEqual(result["price"], "1.79")
        self.assertEqual(result["priceConfidence"], 0.97)

    def test_score_at_the_cutoff_is_ok(self):
        result = scan_price_bytes(make_jpeg(), labelled_client(ocr_test.MIN_PRICE_CONFIDENCE))
        self.assertEqual(result["status"], "ok")

    def test_score_below_the_cutoff_is_low_confidence(self):
        result = scan_price_bytes(make_jpeg(), labelled_client(0.79))
        self.assertEqual(result["status"], "low_confidence")
        self.assertEqual(result["reason"], "low_score")
        self.assertIsNone(result["price"])
        self.assertEqual(result["priceConfidence"], 0.79)

    def test_low_confidence_keeps_the_other_fields(self):
        text = "Good & Gather\nWHOLE MILK\n1 GAL\nYOU PAY\n4.19"
        words = [("Good", 0.9), ("WHOLE", 0.9), ("MILK", 0.9), ("4.19", 0.5)]
        result = scan_price_bytes(make_jpeg(), FakeClient(vision_response(text, words)))
        self.assertEqual(result["status"], "low_confidence")
        self.assertIsNone(result["price"])
        self.assertEqual(result["brand"], "Good & Gather")
        self.assertEqual(result["unitSize"], "1 GAL")
        self.assertEqual(result["itemName"], "WHOLE MILK")

    def test_no_price_is_low_confidence(self):
        client = FakeClient(vision_response("WHOLE MILK", [("WHOLE", 0.99), ("MILK", 0.99)]))
        result = scan_price_bytes(make_jpeg(), client)
        self.assertEqual(result["status"], "low_confidence")
        self.assertEqual(result["reason"], "no_price")
        self.assertIsNone(result["price"])


class FailureTests(unittest.TestCase):
    def assert_read_failed(self, result):
        self.assertEqual(result["status"], "low_confidence")
        self.assertEqual(result["reason"], "read_failed")
        self.assertEqual(result["priceConfidence"], 0.0)
        for field in ("itemName", "brand", "unitSize", "price"):
            self.assertIsNone(result[field])

    def test_error_inside_the_vision_response(self):
        client = FakeClient(vision_response("", [], error="Bad image data"))
        with self.assertLogs("ocr_test", level="WARNING"):
            result = scan_price_bytes(make_jpeg(), client)
        self.assert_read_failed(result)

    def test_vision_api_exception(self):
        client = FakeClient(raises=ServiceUnavailable("down"))
        with self.assertLogs("ocr_test", level="WARNING"):
            result = scan_price_bytes(make_jpeg(), client)
        self.assert_read_failed(result)

    def test_non_image_upload_never_reaches_vision(self):
        client = labelled_client(0.97)
        with self.assertLogs("ocr_test", level="WARNING"):
            result = scan_price_bytes(b"not an image", client)
        self.assert_read_failed(result)
        self.assertEqual(client.calls, 0)

    def test_empty_upload(self):
        with self.assertLogs("ocr_test", level="WARNING"):
            result = scan_price_bytes(b"", labelled_client(0.97))
        self.assert_read_failed(result)

    def test_truncated_image(self):
        with self.assertLogs("ocr_test", level="WARNING"):
            result = scan_price_bytes(make_jpeg()[:60], labelled_client(0.97))
        self.assert_read_failed(result)

    def test_oversized_image_is_rejected(self):
        client = labelled_client(0.97)
        with mock.patch.object(ocr_test, "MAX_IMAGE_PIXELS", 100):
            with self.assertLogs("ocr_test", level="WARNING"):
                result = scan_price_bytes(make_jpeg(), client)
        self.assert_read_failed(result)
        self.assertEqual(client.calls, 0)

    def test_unexpected_errors_are_not_swallowed(self):
        client = FakeClient(raises=KeyError("bug"))
        with self.assertRaises(KeyError):
            scan_price_bytes(make_jpeg(), client)


class EntryPointTests(unittest.TestCase):
    def test_path_and_bytes_versions_agree(self):
        image_bytes = make_jpeg()
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = os.path.join(tmp_dir, "tag.jpg")
            with open(path, "wb") as image_file:
                image_file.write(image_bytes)
            from_path = scan_price_tag(path, labelled_client(0.97))
        self.assertEqual(from_path, scan_price_bytes(image_bytes, labelled_client(0.97)))

    def test_missing_file_is_not_reported_as_unreadable(self):
        with self.assertRaises(FileNotFoundError):
            scan_price_tag("no_such_photo.jpg", labelled_client(0.97))


if __name__ == "__main__":
    unittest.main()
