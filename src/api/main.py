from __future__ import annotations

import os
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from src.agents.model_client import DEFAULT_MODEL_CATALOG, PROVIDER_ENV_VARS, get_model_client
from src.agents.run_agent import MissingRequiredStateError, run_agent
from src.api.models import (
    AgentCreate,
    McpServerCreate,
    McpToolImport,
    ModelCreate,
    RunRequest,
    ToolCreate,
    VisibilityUpdate,
    WorkflowCreate,
)
from src.api.versioning import DEFAULT_VERSION, bump_major, bump_patch
from src.mcp_client.client import discover_tools as discover_mcp_tools
from src.orchestrator.orchestrator import run_workflow
from src.storage.repository import Repository
from src.tools.run_tool import run_tool

app = FastAPI(title="orbit-lab-agentflow")

# Dev defaults cover the Vite dev server; override with a comma-separated
# list (e.g. CORS_ORIGINS=https://my-app.example.com) for any other deployment.
_default_origins = "http://localhost:5173,http://127.0.0.1:5173"
_cors_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", _default_origins).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Overridable so tests (and any future deployment) don't have to share the
# developer's local data/db.json.
DB_PATH = os.environ.get("DB_PATH", "data/db.json")

agents_repo = Repository(DB_PATH, "agents")
agent_versions_repo = Repository(DB_PATH, "agent_versions")
agent_executions_repo = Repository(DB_PATH, "agent_executions")
workflows_repo = Repository(DB_PATH, "workflows")
workflow_versions_repo = Repository(DB_PATH, "workflow_versions")
workflow_executions_repo = Repository(DB_PATH, "workflow_executions")
models_repo = Repository(DB_PATH, "models")
tools_repo = Repository(DB_PATH, "tools")
tool_executions_repo = Repository(DB_PATH, "tool_executions")
mcp_servers_repo = Repository(DB_PATH, "mcp_servers")


def resolve_step(step: dict) -> dict:
    """Attaches a tool's MCP server config (if any) so run_tool doesn't need DB access."""
    if step.get("source") == "mcp":
        return {**step, "mcp_server": mcp_servers_repo.get(step.get("mcp_server_id", ""))}
    return step


def current_user(x_user: str = Header(default="anonymous")) -> str:
    """No real auth — this is a self-reported display name a browser sends on
    every request (see ui/src/api.ts), used only to scope which "personal"
    records show up in list views. Anyone who sends the same name sees the
    same personal items; this is a visibility label, not access control."""
    return x_user.strip() or "anonymous"


def visible_to(records: list[dict], user: str) -> list[dict]:
    return [r for r in records if r.get("visibility", "public") == "public" or r.get("owner") == user]


def name_conflict(repo: Repository, name: str, exclude_id: str | None = None) -> bool:
    """True if another record in this table already has this name."""
    return any(r["name"] == name and r["id"] != exclude_id for r in repo.list())


def unique_clone_name(repo: Repository, base_name: str) -> str:
    name = f"{base_name} (clone)"
    suffix = 2
    while name_conflict(repo, name):
        name = f"{base_name} (clone {suffix})"
        suffix += 1
    return name


if not models_repo.list():
    for seed in DEFAULT_MODEL_CATALOG:
        models_repo.put({**seed, "owner": "system", "visibility": "public"})


def allowed_model_names() -> list[str]:
    return [m["name"] for m in models_repo.list()]


def step_exists(step_id: str) -> bool:
    """A workflow step id may be either an agent or a tool."""
    return agents_repo.get(step_id) is not None or tools_repo.get(step_id) is not None


def catalog_for(model_names: set[str]) -> list[dict]:
    """Narrows the full models catalog to just the ones a run actually invokes,
    so an unrelated provider's key being set elsewhere can't block this run."""
    return [m for m in models_repo.list() if m["name"] in model_names]


def snapshot_version(versions_repo: Repository, parent_id_field: str, existing: dict) -> None:
    """Saves the pre-update state of a record so history can be browsed later."""
    snapshot = dict(existing)
    snapshot[parent_id_field] = existing["id"]
    snapshot.pop("id", None)
    snapshot["versioned_at"] = datetime.now(timezone.utc).isoformat()
    versions_repo.put(snapshot)


def record_execution(
    executions_repo: Repository,
    parent_id_field: str,
    parent_id: str,
    input_: dict,
    result: dict,
    extra: dict | None = None,
) -> None:
    executions_repo.put(
        {
            parent_id_field: parent_id,
            "input": input_,
            "result": result,
            "executed_at": datetime.now(timezone.utc).isoformat(),
            **(extra or {}),
        }
    )


@app.get("/models")
def list_models(user: str = Depends(current_user)) -> list[dict]:
    return visible_to(models_repo.list(), user)


@app.post("/models")
def create_model(model: ModelCreate, user: str = Depends(current_user)) -> dict:
    if model.name in allowed_model_names():
        raise HTTPException(409, f"model '{model.name}' already exists")
    if model.provider not in PROVIDER_ENV_VARS:
        raise HTTPException(400, f"provider must be one of {list(PROVIDER_ENV_VARS)}")
    data = model.model_dump()
    data["owner"] = user
    return models_repo.put(data)


@app.put("/models/{model_id}")
def update_model(model_id: str, model: ModelCreate) -> dict:
    existing = models_repo.get(model_id)
    if existing is None:
        raise HTTPException(404, "model not found")
    if model.provider not in PROVIDER_ENV_VARS:
        raise HTTPException(400, f"provider must be one of {list(PROVIDER_ENV_VARS)}")

    name_taken = any(m["id"] != model_id and m["name"] == model.name for m in models_repo.list())
    if name_taken:
        raise HTTPException(409, f"model '{model.name}' already exists")

    if model.name != existing["name"]:
        referencing = [a["name"] for a in agents_repo.list() if a.get("model") == existing["name"]]
        if referencing:
            raise HTTPException(
                409, f"can't rename — model is used by agent(s): {', '.join(referencing)}"
            )

    updated = model.model_dump()
    updated["id"] = model_id
    updated["owner"] = existing.get("owner", "anonymous")
    return models_repo.put(updated)


@app.patch("/models/{model_id}/visibility")
def set_model_visibility(model_id: str, body: VisibilityUpdate) -> dict:
    existing = models_repo.get(model_id)
    if existing is None:
        raise HTTPException(404, "model not found")
    return models_repo.put({**existing, "visibility": body.visibility})


@app.delete("/models/{model_id}")
def delete_model(model_id: str) -> dict:
    model = models_repo.get(model_id)
    if model is None:
        raise HTTPException(404, "model not found")

    referencing = [a["name"] for a in agents_repo.list() if a.get("model") == model["name"]]
    if referencing:
        raise HTTPException(409, f"model is used by agent(s): {', '.join(referencing)}")

    models_repo.delete(model_id)
    return {"deleted": model_id}


def validate_tool(tool: ToolCreate) -> None:
    if tool.source == "code" and not (tool.language and tool.code):
        raise HTTPException(400, "code tools require language and code")
    if tool.source == "mcp" and not (tool.mcp_server_id and tool.mcp_tool_name):
        raise HTTPException(400, "mcp tools require mcp_server_id and mcp_tool_name")


@app.post("/tools")
def create_tool(tool: ToolCreate, user: str = Depends(current_user)) -> dict:
    validate_tool(tool)
    if name_conflict(tools_repo, tool.name):
        raise HTTPException(409, f"tool '{tool.name}' already exists")
    data = tool.model_dump()
    data["owner"] = user
    return tools_repo.put(data)


@app.get("/tools")
def list_tools(user: str = Depends(current_user)) -> list[dict]:
    return visible_to(tools_repo.list(), user)


@app.get("/tools/{tool_id}")
def get_tool(tool_id: str) -> dict:
    tool = tools_repo.get(tool_id)
    if tool is None:
        raise HTTPException(404, "tool not found")
    return tool


@app.put("/tools/{tool_id}")
def update_tool(tool_id: str, tool: ToolCreate) -> dict:
    existing = tools_repo.get(tool_id)
    if existing is None:
        raise HTTPException(404, "tool not found")
    validate_tool(tool)
    if name_conflict(tools_repo, tool.name, exclude_id=tool_id):
        raise HTTPException(409, f"tool '{tool.name}' already exists")
    updated = tool.model_dump()
    updated["id"] = tool_id
    updated["owner"] = existing.get("owner", "anonymous")
    return tools_repo.put(updated)


@app.patch("/tools/{tool_id}/visibility")
def set_tool_visibility(tool_id: str, body: VisibilityUpdate) -> dict:
    existing = tools_repo.get(tool_id)
    if existing is None:
        raise HTTPException(404, "tool not found")
    return tools_repo.put({**existing, "visibility": body.visibility})


@app.delete("/tools/{tool_id}")
def delete_tool(tool_id: str) -> dict:
    if tools_repo.get(tool_id) is None:
        raise HTTPException(404, "tool not found")

    referencing = [w["name"] for w in workflows_repo.list() if tool_id in w["agent_ids"]]
    if referencing:
        raise HTTPException(409, f"tool is used by workflow(s): {', '.join(referencing)}")

    tools_repo.delete(tool_id)
    return {"deleted": tool_id}


@app.get("/tools/{tool_id}/executions")
def list_tool_executions(tool_id: str) -> list[dict]:
    return [e for e in tool_executions_repo.list() if e.get("tool_id") == tool_id]


@app.post("/tools/{tool_id}/run")
def run_single_tool(tool_id: str, request: RunRequest) -> dict:
    tool = tools_repo.get(tool_id)
    if tool is None:
        raise HTTPException(404, "tool not found")

    try:
        result = run_tool(resolve_step(tool), request.input)
    except MissingRequiredStateError as e:
        raise HTTPException(400, str(e)) from e
    except RuntimeError as e:
        raise HTTPException(400, str(e)) from e

    record_execution(
        tool_executions_repo,
        "tool_id",
        tool_id,
        request.input,
        result,
        extra={"language": tool.get("language") or tool.get("source", "code")},
    )
    return result


@app.post("/mcp-servers")
def create_mcp_server(server: McpServerCreate, user: str = Depends(current_user)) -> dict:
    data = server.model_dump()
    data["owner"] = user
    return mcp_servers_repo.put(data)


@app.get("/mcp-servers")
def list_mcp_servers(user: str = Depends(current_user)) -> list[dict]:
    return visible_to(mcp_servers_repo.list(), user)


@app.patch("/mcp-servers/{server_id}/visibility")
def set_mcp_server_visibility(server_id: str, body: VisibilityUpdate) -> dict:
    existing = mcp_servers_repo.get(server_id)
    if existing is None:
        raise HTTPException(404, "mcp server not found")
    return mcp_servers_repo.put({**existing, "visibility": body.visibility})


@app.delete("/mcp-servers/{server_id}")
def delete_mcp_server(server_id: str) -> dict:
    if mcp_servers_repo.get(server_id) is None:
        raise HTTPException(404, "mcp server not found")

    referencing = [t["name"] for t in tools_repo.list() if t.get("mcp_server_id") == server_id]
    if referencing:
        raise HTTPException(409, f"server has imported tool(s): {', '.join(referencing)}")

    mcp_servers_repo.delete(server_id)
    return {"deleted": server_id}


@app.get("/mcp-servers/{server_id}/tools")
def list_mcp_server_tools(server_id: str) -> list[dict]:
    """Connects to the server live and lists what it exposes right now."""
    server = mcp_servers_repo.get(server_id)
    if server is None:
        raise HTTPException(404, "mcp server not found")
    try:
        return discover_mcp_tools(server)
    except RuntimeError as e:
        raise HTTPException(400, str(e)) from e


@app.post("/mcp-servers/{server_id}/import")
def import_mcp_tool(server_id: str, tool: McpToolImport, user: str = Depends(current_user)) -> dict:
    """Persists a discovered MCP tool as a regular Tool record so it can be
    added to a workflow exactly like a code tool."""
    server = mcp_servers_repo.get(server_id)
    if server is None:
        raise HTTPException(404, "mcp server not found")

    required = set(tool.input_schema.get("required", []))
    properties = tool.input_schema.get("properties", {})
    variables = [{"name": p, "required": p in required, "default": None} for p in properties]

    record = {
        "name": tool.name,
        "source": "mcp",
        "language": None,
        "code": None,
        "mcp_server_id": server_id,
        "mcp_tool_name": tool.name,
        "description": tool.description,
        "variables": variables,
        "writes": None,
        "timeout_seconds": 20,
        "owner": user,
        "visibility": server.get("visibility", "personal"),
    }
    return tools_repo.put(record)


@app.post("/agents")
def create_agent(agent: AgentCreate, user: str = Depends(current_user)) -> dict:
    if agent.model not in allowed_model_names():
        raise HTTPException(400, f"model must be one of {allowed_model_names()}")
    if name_conflict(agents_repo, agent.name):
        raise HTTPException(409, f"agent '{agent.name}' already exists")
    data = agent.model_dump()
    data["version"] = DEFAULT_VERSION
    data["owner"] = user
    return agents_repo.put(data)


@app.get("/agents")
def list_agents(user: str = Depends(current_user)) -> list[dict]:
    return visible_to(agents_repo.list(), user)


@app.get("/agents/{agent_id}")
def get_agent(agent_id: str) -> dict:
    agent = agents_repo.get(agent_id)
    if agent is None:
        raise HTTPException(404, "agent not found")
    return agent


@app.put("/agents/{agent_id}")
def update_agent(agent_id: str, agent: AgentCreate) -> dict:
    existing = agents_repo.get(agent_id)
    if existing is None:
        raise HTTPException(404, "agent not found")
    if agent.model not in allowed_model_names():
        raise HTTPException(400, f"model must be one of {allowed_model_names()}")
    if name_conflict(agents_repo, agent.name, exclude_id=agent_id):
        raise HTTPException(409, f"agent '{agent.name}' already exists")

    snapshot_version(agent_versions_repo, "agent_id", existing)
    updated = agent.model_dump()
    updated["id"] = agent_id
    updated["version"] = bump_patch(existing.get("version", DEFAULT_VERSION))
    updated["owner"] = existing.get("owner", "anonymous")
    return agents_repo.put(updated)


@app.put("/agents/{agent_id}/overwrite")
def overwrite_agent(agent_id: str, agent: AgentCreate) -> dict:
    """Edits the current version in place: no history snapshot, version unchanged."""
    existing = agents_repo.get(agent_id)
    if existing is None:
        raise HTTPException(404, "agent not found")
    if agent.model not in allowed_model_names():
        raise HTTPException(400, f"model must be one of {allowed_model_names()}")
    if name_conflict(agents_repo, agent.name, exclude_id=agent_id):
        raise HTTPException(409, f"agent '{agent.name}' already exists")

    updated = agent.model_dump()
    updated["id"] = agent_id
    updated["version"] = existing.get("version", DEFAULT_VERSION)
    updated["owner"] = existing.get("owner", "anonymous")
    return agents_repo.put(updated)


@app.patch("/agents/{agent_id}/visibility")
def set_agent_visibility(agent_id: str, body: VisibilityUpdate) -> dict:
    existing = agents_repo.get(agent_id)
    if existing is None:
        raise HTTPException(404, "agent not found")
    return agents_repo.put({**existing, "visibility": body.visibility})


@app.post("/agents/{agent_id}/clone")
def clone_agent(agent_id: str, user: str = Depends(current_user)) -> dict:
    source = agents_repo.get(agent_id)
    if source is None:
        raise HTTPException(404, "agent not found")

    clone = {k: v for k, v in source.items() if k != "id"}
    clone["name"] = unique_clone_name(agents_repo, source["name"])
    clone["version"] = bump_major(source.get("version", DEFAULT_VERSION))
    clone["owner"] = user
    clone["visibility"] = "personal"
    return agents_repo.put(clone)


@app.delete("/agents/{agent_id}")
def delete_agent(agent_id: str) -> dict:
    if agents_repo.get(agent_id) is None:
        raise HTTPException(404, "agent not found")

    referencing = [w["name"] for w in workflows_repo.list() if agent_id in w["agent_ids"]]
    if referencing:
        raise HTTPException(409, f"agent is used by workflow(s): {', '.join(referencing)}")

    agents_repo.delete(agent_id)
    return {"deleted": agent_id}


@app.get("/agents/{agent_id}/versions")
def list_agent_versions(agent_id: str) -> list[dict]:
    return [v for v in agent_versions_repo.list() if v.get("agent_id") == agent_id]


@app.post("/agents/{agent_id}/versions/{version_id}/restore")
def restore_agent_version(agent_id: str, version_id: str) -> dict:
    version = agent_versions_repo.get(version_id)
    if version is None or version.get("agent_id") != agent_id:
        raise HTTPException(404, "version not found")
    current = agents_repo.get(agent_id)
    if current is None:
        raise HTTPException(404, "agent not found")

    snapshot_version(agent_versions_repo, "agent_id", current)

    restored = {k: v for k, v in version.items() if k not in ("id", "agent_id", "versioned_at")}
    restored["id"] = agent_id
    restored["owner"] = current.get("owner", "anonymous")
    restored["visibility"] = current.get("visibility", "personal")
    return agents_repo.put(restored)


@app.get("/agents/{agent_id}/executions")
def list_agent_executions(agent_id: str) -> list[dict]:
    return [e for e in agent_executions_repo.list() if e.get("agent_id") == agent_id]


@app.post("/agents/{agent_id}/run")
def run_single_agent(agent_id: str, request: RunRequest) -> dict:
    agent = agents_repo.get(agent_id)
    if agent is None:
        raise HTTPException(404, "agent not found")

    try:
        result = run_agent(agent, request.input, get_model_client(catalog_for({agent["model"]})))
    except MissingRequiredStateError as e:
        raise HTTPException(400, str(e)) from e

    record_execution(
        agent_executions_repo,
        "agent_id",
        agent_id,
        request.input,
        result,
        extra={
            "system_prompt_template": agent["system_prompt_template"],
            "model": agent["model"],
            "temperature": agent.get("temperature", 0.7),
            "timeout_seconds": agent.get("timeout_seconds", 30),
        },
    )
    return result


@app.post("/workflows")
def create_workflow(workflow: WorkflowCreate, user: str = Depends(current_user)) -> dict:
    missing = [aid for aid in workflow.agent_ids if not step_exists(aid)]
    if missing:
        raise HTTPException(400, f"unknown agent/tool ids: {missing}")
    if name_conflict(workflows_repo, workflow.name):
        raise HTTPException(409, f"workflow '{workflow.name}' already exists")
    data = workflow.model_dump()
    data["version"] = DEFAULT_VERSION
    data["owner"] = user
    return workflows_repo.put(data)


@app.get("/workflows")
def list_workflows(user: str = Depends(current_user)) -> list[dict]:
    return visible_to(workflows_repo.list(), user)


@app.get("/workflows/{workflow_id}")
def get_workflow(workflow_id: str) -> dict:
    workflow = workflows_repo.get(workflow_id)
    if workflow is None:
        raise HTTPException(404, "workflow not found")
    return workflow


@app.put("/workflows/{workflow_id}")
def update_workflow(workflow_id: str, workflow: WorkflowCreate) -> dict:
    existing = workflows_repo.get(workflow_id)
    if existing is None:
        raise HTTPException(404, "workflow not found")

    missing = [aid for aid in workflow.agent_ids if not step_exists(aid)]
    if missing:
        raise HTTPException(400, f"unknown agent/tool ids: {missing}")
    if name_conflict(workflows_repo, workflow.name, exclude_id=workflow_id):
        raise HTTPException(409, f"workflow '{workflow.name}' already exists")

    snapshot_version(workflow_versions_repo, "workflow_id", existing)
    updated = workflow.model_dump()
    updated["id"] = workflow_id
    updated["version"] = bump_patch(existing.get("version", DEFAULT_VERSION))
    updated["owner"] = existing.get("owner", "anonymous")
    return workflows_repo.put(updated)


@app.put("/workflows/{workflow_id}/overwrite")
def overwrite_workflow(workflow_id: str, workflow: WorkflowCreate) -> dict:
    """Edits the current version in place: no history snapshot, version unchanged."""
    existing = workflows_repo.get(workflow_id)
    if existing is None:
        raise HTTPException(404, "workflow not found")

    missing = [aid for aid in workflow.agent_ids if not step_exists(aid)]
    if missing:
        raise HTTPException(400, f"unknown agent/tool ids: {missing}")
    if name_conflict(workflows_repo, workflow.name, exclude_id=workflow_id):
        raise HTTPException(409, f"workflow '{workflow.name}' already exists")

    updated = workflow.model_dump()
    updated["id"] = workflow_id
    updated["version"] = existing.get("version", DEFAULT_VERSION)
    updated["owner"] = existing.get("owner", "anonymous")
    return workflows_repo.put(updated)


@app.patch("/workflows/{workflow_id}/visibility")
def set_workflow_visibility(workflow_id: str, body: VisibilityUpdate) -> dict:
    existing = workflows_repo.get(workflow_id)
    if existing is None:
        raise HTTPException(404, "workflow not found")
    return workflows_repo.put({**existing, "visibility": body.visibility})


@app.post("/workflows/{workflow_id}/clone")
def clone_workflow(workflow_id: str, user: str = Depends(current_user)) -> dict:
    source = workflows_repo.get(workflow_id)
    if source is None:
        raise HTTPException(404, "workflow not found")

    clone = {k: v for k, v in source.items() if k != "id"}
    clone["name"] = unique_clone_name(workflows_repo, source["name"])
    clone["version"] = bump_major(source.get("version", DEFAULT_VERSION))
    clone["owner"] = user
    clone["visibility"] = "personal"
    return workflows_repo.put(clone)


@app.delete("/workflows/{workflow_id}")
def delete_workflow(workflow_id: str) -> dict:
    if workflows_repo.get(workflow_id) is None:
        raise HTTPException(404, "workflow not found")
    workflows_repo.delete(workflow_id)
    return {"deleted": workflow_id}


@app.get("/workflows/{workflow_id}/versions")
def list_workflow_versions(workflow_id: str) -> list[dict]:
    return [v for v in workflow_versions_repo.list() if v.get("workflow_id") == workflow_id]


@app.post("/workflows/{workflow_id}/versions/{version_id}/restore")
def restore_workflow_version(workflow_id: str, version_id: str) -> dict:
    version = workflow_versions_repo.get(version_id)
    if version is None or version.get("workflow_id") != workflow_id:
        raise HTTPException(404, "version not found")
    current = workflows_repo.get(workflow_id)
    if current is None:
        raise HTTPException(404, "workflow not found")

    snapshot_version(workflow_versions_repo, "workflow_id", current)

    restored = {k: v for k, v in version.items() if k not in ("id", "workflow_id", "versioned_at")}
    restored["id"] = workflow_id
    restored["owner"] = current.get("owner", "anonymous")
    restored["visibility"] = current.get("visibility", "personal")
    return workflows_repo.put(restored)


@app.get("/workflows/{workflow_id}/executions")
def list_workflow_executions(workflow_id: str) -> list[dict]:
    return [e for e in workflow_executions_repo.list() if e.get("workflow_id") == workflow_id]


@app.post("/workflows/{workflow_id}/run")
def run(workflow_id: str, request: RunRequest) -> dict:
    workflow = workflows_repo.get(workflow_id)
    if workflow is None:
        raise HTTPException(404, "workflow not found")

    steps_in_order = []
    for step_id in workflow["agent_ids"]:
        agent = agents_repo.get(step_id)
        if agent is not None:
            steps_in_order.append({**agent, "_kind": "agent"})
            continue
        tool = tools_repo.get(step_id)
        if tool is not None:
            steps_in_order.append({**resolve_step(tool), "_kind": "tool"})
            continue
        raise HTTPException(409, f"workflow references missing agent/tool {step_id}")

    try:
        used_models = {s["model"] for s in steps_in_order if s.get("_kind") != "tool"}
        result = run_workflow(steps_in_order, request.input, get_model_client(catalog_for(used_models)))
    except MissingRequiredStateError as e:
        raise HTTPException(400, str(e)) from e
    except RuntimeError as e:
        raise HTTPException(400, str(e)) from e

    record_execution(
        workflow_executions_repo,
        "workflow_id",
        workflow_id,
        request.input,
        result,
        extra={"workflow_version": workflow.get("version", DEFAULT_VERSION)},
    )
    return result
