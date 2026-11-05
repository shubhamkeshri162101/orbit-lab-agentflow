from src.storage.repository import Repository


def test_put_generates_id_when_missing(tmp_path):
    repo = Repository(str(tmp_path / "db.json"), "things")
    saved = repo.put({"name": "a"})
    assert saved["id"]
    assert saved["name"] == "a"


def test_put_preserves_given_id(tmp_path):
    repo = Repository(str(tmp_path / "db.json"), "things")
    saved = repo.put({"id": "fixed-id", "name": "a"})
    assert saved["id"] == "fixed-id"


def test_put_upserts_on_existing_id(tmp_path):
    repo = Repository(str(tmp_path / "db.json"), "things")
    first = repo.put({"name": "a"})
    repo.put({"id": first["id"], "name": "b"})

    assert repo.get(first["id"])["name"] == "b"
    assert len(repo.list()) == 1


def test_get_returns_none_for_missing_id(tmp_path):
    repo = Repository(str(tmp_path / "db.json"), "things")
    assert repo.get("nonexistent") is None


def test_delete_removes_item(tmp_path):
    repo = Repository(str(tmp_path / "db.json"), "things")
    saved = repo.put({"name": "a"})
    repo.delete(saved["id"])
    assert repo.get(saved["id"]) is None
    assert repo.list() == []


def test_separate_tables_in_same_file_dont_collide(tmp_path):
    db_path = str(tmp_path / "db.json")
    agents = Repository(db_path, "agents")
    tools = Repository(db_path, "tools")

    agents.put({"id": "same-id", "name": "agent-a"})
    tools.put({"id": "same-id", "name": "tool-a"})

    assert agents.get("same-id")["name"] == "agent-a"
    assert tools.get("same-id")["name"] == "tool-a"
