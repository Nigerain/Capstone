# cache Store address results and space requests within one backend process.

import time
from copy import deepcopy
from threading import Lock
from typing import Callable


class StoreLocationLookupCooldown(Exception):
    def __init__(self, retry_after: float):
        super().__init__("Store address lookup is cooling down.")
        self.retry_after = retry_after


class StoreLocationLookupCache:
    def __init__(self):
        self.results = {}
        self.next_request_at = 0.0
        self.lock = Lock()

    def lookup(self, key: str, fetch: Callable[[], list[dict]]) -> list[dict]:
        with self.lock:
            now = time.monotonic()
            cached = self.results.get(key)
            if cached and cached[1] > now:
                return deepcopy(cached[0])

            wait = self.next_request_at - now
            if wait > 1.0:
                raise StoreLocationLookupCooldown(wait)
            if wait > 0:
                time.sleep(wait)

            try:
                result = fetch()
            except Exception as error:
                cooldown = max(1.0, getattr(error, "retry_after", 1.0))
                self.next_request_at = time.monotonic() + cooldown
                raise

            self.next_request_at = time.monotonic() + 1.0
            # Keep matches for 30 days and empty searches for one hour.
            ttl = 30 * 86400 if result else 3600
            self.results.pop(key, None)
            if len(self.results) >= 256:
                self.results.pop(next(iter(self.results)))
            self.results[key] = (deepcopy(result), time.monotonic() + ttl)
            return result
