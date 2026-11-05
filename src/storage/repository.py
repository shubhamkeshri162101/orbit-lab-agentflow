"""Thin NoSQL-style repository, swappable for DynamoDB later without touching callers."""
from __future__ import annotations

import uuid
from typing import Any

from tinydb import Query, TinyDB


class Repository:
    def __init__(self, db_path: str, table_name: str):
        self._table = TinyDB(db_path).table(table_name)

    def put(self, item: dict[str, Any]) -> dict[str, Any]:
        item = dict(item)
        item.setdefault("id", str(uuid.uuid4()))
        self._table.upsert(item, Query().id == item["id"])
        return item

    def get(self, item_id: str) -> dict[str, Any] | None:
        return self._table.get(Query().id == item_id)

    def list(self) -> list[dict[str, Any]]:
        return self._table.all()

    def delete(self, item_id: str) -> None:
        self._table.remove(Query().id == item_id)
