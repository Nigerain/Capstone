"""Look up new store addresses after an explicit user action, never autocomplete.

Use find_store_locations to reuse saved coordinates or return address candidates.
The Store creation flow must confirm a candidate and check for duplicates before
calling CreateStore. This module does not read or write PostgreSQL records.

Display the returned OpenStreetMap attribution and link alongside lookup results.
Public API policy: https://operations.osmfoundation.org/policies/nominatim/
All workers must share one persistent cache file on one host. Multiple hosts
require a central store location lookup service or a different provider. Call this
synchronous utility from a synchronous route or a worker thread, not an async loop.
Only public Store addresses belong here; never pass user GPS or private addresses.
"""

import json
import math
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Protocol

import httpx

from .store_location_lookup_cache import StoreLocationLookupCache, StoreLocationLookupCooldown

ATTRIBUTION = "© OpenStreetMap contributors"
ATTRIBUTION_URL = "https://www.openstreetmap.org/copyright"


class StoreLocationLookupError(Exception):
    def __init__(self, message: str, *, retry_after: float = 1.0):
        super().__init__(message)
        self.retry_after = retry_after


@dataclass(frozen=True)
class StoreLocation:
    display_address: str
    latitude: float
    longitude: float
    source: str
    attribution: str = ""
    attribution_url: str = ""


class StoreLocationLookupProvider(Protocol):
    def search(self, address: str) -> list[StoreLocation]: ...


def validate_coordinates(latitude: float, longitude: float) -> None:
    for name, value, maximum in (
        ("latitude", latitude, 90), ("longitude", longitude, 180),
    ):
        if (isinstance(value, bool) or not isinstance(value, (int, float))
                or not -maximum <= value <= maximum or not math.isfinite(value)):
            raise ValueError(f"Invalid {name}.")


def find_store_locations(
    address: str | None, *, provider: StoreLocationLookupProvider,
    latitude: float | None = None, longitude: float | None = None,
) -> list[StoreLocation]:
    # existing stores with both coordinates never need another lookup.
    if latitude is not None and longitude is not None:
        validate_coordinates(latitude, longitude)
        return [StoreLocation(address or "", latitude, longitude, "saved")]
    if latitude is not None or longitude is not None:
        raise ValueError("Store coordinates must include latitude and longitude.")
    if not isinstance(address, str) or not address.strip():
        raise ValueError("A store address is required.")
    return provider.search(address)


def _retry_after(value: str | None) -> float:
    try:
        seconds = float(value)
        return max(60.0, seconds) if math.isfinite(seconds) else 60.0
    except (TypeError, ValueError):
        try:
            retry_time = parsedate_to_datetime(value)
            return max(60.0, (retry_time - datetime.now(timezone.utc)).total_seconds())
        except (TypeError, ValueError, OverflowError):
            return 60.0


class NominatimProvider:
    def __init__(
        self, *, user_agent: str, cache: StoreLocationLookupCache,
        base_url: str = "https://nominatim.openstreetmap.org",
        timeout: float = 10.0, client: httpx.Client | None = None,
    ):
        if not user_agent.strip() or not ("@" in user_agent or "https://" in user_agent):
            raise ValueError("Identify the application and a real contact in the User-Agent.")
        if not math.isfinite(timeout) or timeout <= 0:
            raise ValueError("Store location lookup timeout must be positive.")
        self.user_agent = user_agent
        self.cache = cache
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.client = client

    def search(self, address: str) -> list[StoreLocation]:
        if not isinstance(address, str) or not address.strip():
            raise ValueError("A store address is required.")
        address = " ".join(address.split())
        key = json.dumps([self.base_url, "en", address.casefold()])
        try:
            results = self.cache.lookup(key, lambda: self._fetch(address))
        except StoreLocationLookupCooldown as error:
            raise StoreLocationLookupError(
                "Store address lookup is busy. Try again later.",
                retry_after=error.retry_after,
            ) from None
        return [StoreLocation(**result) for result in results]

    def _fetch(self, address: str) -> list[dict]:
        params = {"q": address, "format": "jsonv2", "addressdetails": 1,
                  "limit": 5, "accept-language": "en"}
        try:
            if self.client is None:
                with httpx.Client() as client:
                    response = self._request(client, params)
            else:
                response = self._request(self.client, params)
        except httpx.RequestError:
            raise StoreLocationLookupError("Store address lookup is unavailable.") from None

        if response.status_code in (429, 503):
            raise StoreLocationLookupError(
                "Store address lookup is busy. Try again later.",
                retry_after=_retry_after(response.headers.get("Retry-After")),
            )
        if response.status_code != 200:
            raise StoreLocationLookupError("Store address lookup failed.")
        try:
            data = response.json()
            if not isinstance(data, list):
                raise ValueError("Expected address candidates.")
            candidates = []
            for item in data:
                if isinstance(item["lat"], bool) or isinstance(item["lon"], bool):
                    raise ValueError("Invalid coordinates.")
                latitude, longitude = float(item["lat"]), float(item["lon"])
                validate_coordinates(latitude, longitude)
                display_address = item["display_name"]
                if not isinstance(display_address, str) or not display_address.strip():
                    raise ValueError("Missing display address.")
                candidates.append(asdict(StoreLocation(
                    display_address, latitude, longitude, "nominatim",
                    ATTRIBUTION, ATTRIBUTION_URL,
                )))
            return candidates
        except (ValueError, TypeError, KeyError, OverflowError):
            raise StoreLocationLookupError("Store address lookup returned invalid data.") from None

    def _request(self, client: httpx.Client, params: dict) -> httpx.Response:
        return client.get(
            f"{self.base_url}/search", params=params,
            headers={"User-Agent": self.user_agent}, timeout=self.timeout,
        )


def create_store_location_lookup_provider() -> StoreLocationLookupProvider:
    # use one shared cache file for every worker on the same host.
    provider = os.environ.get("STORE_LOCATION_LOOKUP_PROVIDER", "nominatim")
    if provider != "nominatim":
        raise ValueError("Unsupported store location lookup provider.")
    return NominatimProvider(
        user_agent=os.environ["STORE_LOCATION_LOOKUP_USER_AGENT"],
        cache=StoreLocationLookupCache(os.environ["STORE_LOCATION_LOOKUP_CACHE_PATH"]),
        base_url=os.environ.get("STORE_LOCATION_LOOKUP_BASE_URL", "https://nominatim.openstreetmap.org"),
        timeout=float(os.environ.get("STORE_LOCATION_LOOKUP_TIMEOUT", "10")),
    )
