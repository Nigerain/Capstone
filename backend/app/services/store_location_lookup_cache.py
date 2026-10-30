# cache store address lookups and share the request limit on one backend host.

import json
import sqlite3
import time
from contextlib import closing
from pathlib import Path
from typing import Callable


class StoreLocationLookupCooldown(Exception):
    def __init__(self, retry_after: float):
        super().__init__("Store address lookup is cooling down.")
        self.retry_after = retry_after


class StoreLocationLookupCache:
    def __init__(self, path: str):
        if not path or not Path(path).is_absolute():
            raise ValueError("Use an absolute path for the shared store location lookup cache.")
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        with closing(sqlite3.connect(path)) as connection, connection:
            connection.execute(
                "CREATE TABLE IF NOT EXISTS store_location_lookup_cache "
                "(key TEXT PRIMARY KEY, result TEXT NOT NULL, expires_at REAL NOT NULL)"
            )
            connection.execute(
                "CREATE TABLE IF NOT EXISTS store_location_lookup_limit "
                "(id INTEGER PRIMARY KEY, next_request_at REAL NOT NULL)"
            )
            connection.execute(
                "INSERT OR IGNORE INTO store_location_lookup_limit VALUES (1, 0)"
            )

    def lookup(self, key: str, fetch: Callable[[], list[dict]]) -> list[dict]:
        # hold the lock through the request so other workers cannot send at once.
        with closing(sqlite3.connect(self.path, timeout=30)) as connection, connection:
            connection.execute("BEGIN IMMEDIATE")
            cached = connection.execute(
                "SELECT result, expires_at FROM store_location_lookup_cache WHERE key = ?",
                (key,),
            ).fetchone()
            if cached and cached[1] > time.time():
                return json.loads(cached[0])

            next_request_at = connection.execute(
                "SELECT next_request_at FROM store_location_lookup_limit WHERE id = 1"
            ).fetchone()[0]
            wait = next_request_at - time.time()
            if wait > 1.0:
                raise StoreLocationLookupCooldown(wait)
            if wait > 0:
                time.sleep(wait)

            try:
                result = fetch()
            except Exception as error:
                # keep the cooldown even when the HTTP request failed.
                cooldown = max(1.0, getattr(error, "retry_after", 1.0))
                connection.execute(
                    "UPDATE store_location_lookup_limit SET next_request_at = ? WHERE id = 1",
                    (time.time() + cooldown,),
                )
                connection.commit()
                raise

            connection.execute(
                "UPDATE store_location_lookup_limit SET next_request_at = ? WHERE id = 1",
                (time.time() + 1.0,),
            )
            # keep matches for 30 days and empty searches for one hour.
            ttl = 30 * 86400 if result else 3600
            connection.execute(
                "INSERT OR REPLACE INTO store_location_lookup_cache VALUES (?, ?, ?)",
                (key, json.dumps(result), time.time() + ttl),
            )
            return result
