"""API-level tests against a throwaway DB file, isolated from data/db.json."""
import os

import pytest

os.environ["DB_PATH"] = "/tmp/orbit-lab-agentflow-test-db.json"

from fastapi.testclient import TestClient  # noqa: E402

from src.agents.model_client import DEFAULT_MODEL_CATALOG  # noqa: E402
from src.api import main as api_main  # noqa: E402

app = api_main.app

_ALL_REPOS = [
    api_main.agents_repo,
    api_main.agent_versions_repo,
    api_main.agent_executions_repo,
    api_main.workflows_repo,
    api_main.workflow_versions_repo,
    api_main.workflow_executions_repo,
    api_main.models_repo,
    api_main.tools_repo,
    api_main.tool_executions_repo,
    api_main.mcp_servers_repo,
]


@pytest.fixture(autouse=True)
def fresh_db():
    # Truncate through the already-open repo instances rather than deleting
    # the file on disk — TinyDB holds its file handle open for the process
    # lifetime, so os.remove() on the path doesn't actually reset its state.
    for repo in _ALL_REPOS:
        repo.clear()
    for seed in DEFAULT_MODEL_CATALOG:
        api_main.models_repo.put({**seed, "owner": "system", "visibility": "public"})
    yield
    for repo in _ALL_REPOS:
        repo.clear()


@pytest.fixture
def client():
    return TestClient(app)


def as_user(client: TestClient, name: str) -> TestClient:
    client.headers.update({"X-User": name})
    return client


def test_models_are_seeded_on_first_access(client):
    response = client.get("/models")
    assert response.status_code == 200
    names = {m["name"] for m in response.json()}
    assert "claude-sonnet-5-5" in names


def test_create_and_get_agent(client):
    as_user(client, "alice")
    created = client.post(
        "/agents",
        json={
            "name": "greeter",
            "system_prompt_template": "Say hi to {name}",
            "model": "claude-sonnet-5-5",
            "variables": [{"name": "name", "required": True}],
            "visibility": "public",
        },
    ).json()

    fetched = client.get(f"/agents/{created['id']}").json()
    assert fetched["name"] == "greeter"
    assert fetched["version"] == "1.0.0"
    assert fetched["owner"] == "alice"


def test_create_agent_rejects_unknown_model(client):
    response = client.post(
        "/agents",
        json={"name": "bad", "system_prompt_template": "x", "model": "not-a-real-model"},
    )
    assert response.status_code == 400


def test_create_agent_rejects_duplicate_name(client):
    payload = {"name": "dup", "system_prompt_template": "x", "model": "claude-sonnet-5-5"}
    assert client.post("/agents", json=payload).status_code == 200
    assert client.post("/agents", json=payload).status_code == 409


def test_personal_agent_hidden_from_other_users(client):
    as_user(client, "alice")
    client.post(
        "/agents",
        json={
            "name": "alices-secret",
            "system_prompt_template": "x",
            "model": "claude-sonnet-5-5",
            "visibility": "personal",
        },
    )

    as_user(client, "bob")
    names = {a["name"] for a in client.get("/agents").json()}
    assert "alices-secret" not in names

    as_user(client, "alice")
    names = {a["name"] for a in client.get("/agents").json()}
    assert "alices-secret" in names


def test_toggling_visibility_makes_it_visible_to_others(client):
    as_user(client, "alice")
    agent = client.post(
        "/agents",
        json={
            "name": "to-publish",
            "system_prompt_template": "x",
            "model": "claude-sonnet-5-5",
            "visibility": "personal",
        },
    ).json()

    client.patch(f"/agents/{agent['id']}/visibility", json={"visibility": "public"})

    as_user(client, "bob")
    names = {a["name"] for a in client.get("/agents").json()}
    assert "to-publish" in names


def test_update_agent_bumps_patch_version_and_snapshots_history(client):
    agent = client.post(
        "/agents",
        json={"name": "versioned", "system_prompt_template": "v1", "model": "claude-sonnet-5-5"},
    ).json()

    updated = client.put(
        f"/agents/{agent['id']}",
        json={"name": "versioned", "system_prompt_template": "v2", "model": "claude-sonnet-5-5"},
    ).json()
    assert updated["version"] == "1.0.1"

    history = client.get(f"/agents/{agent['id']}/versions").json()
    assert len(history) == 1
    assert history[0]["system_prompt_template"] == "v1"


def test_overwrite_agent_does_not_bump_version_or_snapshot(client):
    agent = client.post(
        "/agents",
        json={"name": "overwritten", "system_prompt_template": "v1", "model": "claude-sonnet-5-5"},
    ).json()

    updated = client.put(
        f"/agents/{agent['id']}/overwrite",
        json={"name": "overwritten", "system_prompt_template": "v2", "model": "claude-sonnet-5-5"},
    ).json()
    assert updated["version"] == "1.0.0"
    assert client.get(f"/agents/{agent['id']}/versions").json() == []


def test_clone_agent_gets_unique_name_and_personal_visibility(client):
    agent = client.post(
        "/agents",
        json={
            "name": "original",
            "system_prompt_template": "x",
            "model": "claude-sonnet-5-5",
            "visibility": "public",
        },
    ).json()

    clone = client.post(f"/agents/{agent['id']}/clone").json()
    assert clone["name"] == "original (clone)"
    assert clone["visibility"] == "personal"
    assert clone["version"] == "2.0.0"

    clone2 = client.post(f"/agents/{agent['id']}/clone").json()
    assert clone2["name"] == "original (clone 2)"


def test_delete_agent_blocked_when_referenced_by_workflow(client):
    agent = client.post(
        "/agents",
        json={"name": "in-use", "system_prompt_template": "x", "model": "claude-sonnet-5-5"},
    ).json()
    client.post("/workflows", json={"name": "wf", "agent_ids": [agent["id"]]})

    response = client.delete(f"/agents/{agent['id']}")
    assert response.status_code == 409


def test_delete_model_blocked_when_referenced_by_agent(client):
    client.post(
        "/agents",
        json={"name": "uses-model", "system_prompt_template": "x", "model": "claude-sonnet-5-5"},
    )
    models = client.get("/models").json()
    sonnet = next(m for m in models if m["name"] == "claude-sonnet-5-5")

    response = client.delete(f"/models/{sonnet['id']}")
    assert response.status_code == 409


def test_create_tool_and_run_it(client):
    tool = client.post(
        "/tools",
        json={
            "name": "adder",
            "source": "code",
            "language": "python",
            "code": 'def run(inputs):\n    return int(inputs["a"]) + int(inputs["b"])\n',
            "variables": [{"name": "a", "required": True}, {"name": "b", "required": True}],
            "writes": "sum",
        },
    ).json()

    result = client.post(f"/tools/{tool['id']}/run", json={"input": {"a": "2", "b": "3"}}).json()
    assert result["output"] == {"sum": "5"}

    history = client.get(f"/tools/{tool['id']}/executions").json()
    assert len(history) == 1


def test_create_tool_requires_code_for_code_source(client):
    response = client.post("/tools", json={"name": "bad-tool", "source": "code"})
    assert response.status_code == 400


def test_workflow_run_records_its_version_in_history(client):
    tool = client.post(
        "/tools",
        json={
            "name": "doubler",
            "source": "code",
            "language": "python",
            "code": 'def run(inputs):\n    return int(inputs["n"]) * 2\n',
            "variables": [{"name": "n", "required": True}],
            "writes": "doubled",
        },
    ).json()
    workflow = client.post("/workflows", json={"name": "wf", "agent_ids": [tool["id"]]}).json()

    client.post(f"/workflows/{workflow['id']}/run", json={"input": {"n": "5"}})

    history = client.get(f"/workflows/{workflow['id']}/executions").json()
    assert history[0]["workflow_version"] == "1.0.0"
    assert history[0]["result"]["output"]["doubled"] == "10"
