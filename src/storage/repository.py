"""Thin NoSQL-style repository, swappable for DynamoDB later without touching callers.

All tables in a TinyDB file share one JSON document — every write reads and
rewrites the *whole* file, not just one table. FastAPI runs sync endpoints
in a threadpool, so two requests (even against different tables) can race:
each reads the file, mutates its own table in memory, and the second write
back silently clobbers whatever the first one just wrote. A single
process-wide lock serializes every write across every Repository instance
to prevent that. It only helps within one process — this still isn't safe
for multiple backend processes sharing the same file.
"""
from __future__ import annotations

import threading
import uuid
from typing import Any

from tinydb import Query, TinyDB

_write_lock = threading.Lock()


class Repository:
    def __init__(self, db_path: str, table_name: str):
        self._table = TinyDB(db_path).table(table_name)

    def put(self, item: dict[str, Any]) -> dict[str, Any]:
        item = dict(item)
        item.setdefault("id", str(uuid.uuid4()))
        with _write_lock:
            self._table.upsert(item, Query().id == item["id"])
        return item

    def get(self, item_id: str) -> dict[str, Any] | None:
        return self._table.get(Query().id == item_id)

    def list(self) -> list[dict[str, Any]]:
        return self._table.all()

    def delete(self, item_id: str) -> None:
        with _write_lock:
            self._table.remove(Query().id == item_id)

    def clear(self) -> None:
        """Empties this table. Mainly for test isolation."""
        with _write_lock:
            self._table.truncate()
