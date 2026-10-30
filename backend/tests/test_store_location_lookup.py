import sqlite3
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path
from unittest.mock import Mock, patch

import httpx

from app.services.store_location_lookup import (
    StoreLocationLookupError, NominatimProvider, find_store_locations, validate_coordinates,
)
from app.services.store_location_lookup_cache import StoreLocationLookupCache


class StoreLocationLookupTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = str(Path(self.directory.name) / "store_location_lookup.sqlite3")
        self.cache = StoreLocationLookupCache(self.path)
        self.requests = []
        self.response = [{"lat": "40.7", "lon": "-74.0", "display_name": "Store, New York"}]
        self.status = 200
        self.headers = {}
        self.client = httpx.Client(transport=httpx.MockTransport(self.handle_request))
        self.addCleanup(self.client.close)
        self.provider = NominatimProvider(
            user_agent="GroceryPricePal/0.1 (https://example.com/contact)",
            cache=self.cache, client=self.client,
        )

    def handle_request(self, request):
        self.requests.append(request)
        return httpx.Response(self.status, json=self.response, headers=self.headers)

    def test_saved_coordinates_skip_store_location_lookup(self):
        provider = Mock()
        result = find_store_locations(None, provider=provider, latitude=0, longitude=0)
        self.assertEqual(result[0].source, "saved")
        provider.search.assert_not_called()

    def test_missing_address_and_partial_coordinates(self):
        for values in ({}, {"latitude": 40.7}, {"longitude": -74.0}):
            with self.subTest(values=values), self.assertRaises(ValueError):
                find_store_locations(None, provider=self.provider, **values)
        self.assertEqual(self.requests, [])

    def test_coordinate_validation(self):
        validate_coordinates(-90, -180)
        validate_coordinates(90, 180)
        for latitude, longitude in ((91, 0), (0, -181), (float("nan"), 0),
                                    (0, float("inf")), (True, 0), ("40", 0),
                                    (10 ** 1000, 0)):
            with self.subTest(latitude=latitude, longitude=longitude), self.assertRaises(ValueError):
                validate_coordinates(latitude, longitude)

    def test_candidates_and_persistent_cache(self):
        self.response.append({"lat": "41", "lon": "-73", "display_name": "Other branch"})
        result = self.provider.search("  123 Main   St ")
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0].latitude, 40.7)
        self.assertTrue(result[0].attribution)
        self.provider.cache = StoreLocationLookupCache(self.path)
        self.assertEqual(self.provider.search("123 MAIN ST"), result)
        self.assertEqual(len(self.requests), 1)
        self.assertIn("GroceryPricePal", self.requests[0].headers["User-Agent"])
        self.assertEqual(self.requests[0].url.params["q"], "123 Main St")
        self.assertEqual(self.requests[0].url.params["limit"], "5")

    def test_no_matches_are_cached(self):
        self.response = []
        self.assertEqual(self.provider.search("Missing store"), [])
        self.assertEqual(self.provider.search("Missing store"), [])
        self.assertEqual(len(self.requests), 1)

    def test_invalid_responses_are_not_cached(self):
        for response in ({}, [{"lat": "91", "lon": "0", "display_name": "Invalid"}],
                         [{"lat": "0", "lon": "0"}], [None]):
            with self.subTest(response=response):
                self.response = response
                with patch("app.services.store_location_lookup_cache.time.sleep"), self.assertRaises(StoreLocationLookupError):
                    self.provider.search("Invalid result")
        self.assertEqual(len(self.requests), 4)

    def test_busy_response_persists_cooldown_without_retry(self):
        self.status = 429
        self.headers = {"Retry-After": "120"}
        with self.assertRaises(StoreLocationLookupError) as result:
            self.provider.search("Busy store")
        self.assertEqual(result.exception.retry_after, 120)
        with self.assertRaises(StoreLocationLookupError):
            self.provider.search("Another store")
        self.assertEqual(len(self.requests), 1)

    def test_request_spacing_is_shared_by_cache_instances(self):
        other_cache = StoreLocationLookupCache(self.path)
        with patch("app.services.store_location_lookup_cache.time.time", return_value=100), \
                patch("app.services.store_location_lookup_cache.time.sleep") as sleep:
            self.cache.lookup("one", lambda: [])
            other_cache.lookup("two", lambda: [])
            sleep.assert_called_once_with(1.0)

    def test_concurrent_lookups_share_one_cached_result(self):
        caches = [StoreLocationLookupCache(self.path) for _ in range(4)]
        fetch = Mock(return_value=[{"latitude": 40.7}])
        with ThreadPoolExecutor(max_workers=4) as executor:
            results = list(executor.map(lambda cache: cache.lookup("same", fetch), caches))
        fetch.assert_called_once()
        self.assertTrue(all(result == results[0] for result in results))

    def test_configuration_requires_contact_and_persistent_path(self):
        with self.assertRaises(ValueError):
            StoreLocationLookupCache(":memory:")
        with self.assertRaises(ValueError):
            NominatimProvider(user_agent="python-httpx", cache=self.cache)

    def test_expired_cache_is_refreshed(self):
        self.provider.search("Old store")
        with closing(sqlite3.connect(self.path)) as connection, connection:
            connection.execute("UPDATE store_location_lookup_cache SET expires_at = 0")
        with patch("app.services.store_location_lookup_cache.time.sleep"):
            self.provider.search("Old store")
        self.assertEqual(len(self.requests), 2)

    def test_timeout_is_reported_without_address(self):
        def timeout(request):
            raise httpx.ReadTimeout("private address", request=request)
        with httpx.Client(transport=httpx.MockTransport(timeout)) as client:
            self.provider.client = client
            with self.assertRaises(StoreLocationLookupError) as result:
                self.provider.search("123 Main St")
        self.assertNotIn("123 Main St", str(result.exception))

    def test_cache_connections_close_after_success_and_failure(self):
        connections = []

        class TrackedConnection(sqlite3.Connection):
            closed = False

            def close(self):
                self.closed = True
                super().close()

        connect = sqlite3.connect

        def tracked_connect(*args, **kwargs):
            connection = connect(*args, factory=TrackedConnection, **kwargs)
            connections.append(connection)
            return connection

        with patch("app.services.store_location_lookup_cache.sqlite3.connect", tracked_connect):
            cache = StoreLocationLookupCache(self.path)
            cache.lookup("success", lambda: [])
            cache.lookup("success", lambda: self.fail("Expected a cached result"))
            with patch("app.services.store_location_lookup_cache.time.sleep"):
                with self.assertRaises(StoreLocationLookupError):
                    cache.lookup("failure", Mock(side_effect=StoreLocationLookupError("Unavailable")))
        self.assertEqual(len(connections), 4)
        self.assertTrue(all(connection.closed for connection in connections))


if __name__ == "__main__":
    unittest.main()
