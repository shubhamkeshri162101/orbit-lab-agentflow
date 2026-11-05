from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class AgentVariable(BaseModel):
    name: str
    required: bool = True
    default: str | None = None


Visibility = Literal["personal", "public"]


class VisibilityUpdate(BaseModel):
    visibility: Visibility


class AgentCreate(BaseModel):
    name: str
    system_prompt_template: str
    model: str
    temperature: float = Field(default=0.7, ge=0.0, le=1.0)
    timeout_seconds: int = Field(default=30, ge=1, le=300)
    # Caps real model calls' max_tokens -- keeps an unexpectedly verbose
    # response (and its cost) bounded instead of open-ended.
    max_output_tokens: int = Field(default=1024, ge=1, le=10000)
    variables: list[AgentVariable] = Field(default_factory=list)
    writes: str | None = None
    # Optional JSON Schema the model's output must conform to. When set, real
    # calls are constrained via output_config.format so the response is always
    # valid JSON matching this shape; when unset, output is free-form text.
    output_schema: dict[str, Any] | None = None
    visibility: Visibility = "personal"


class StartInput(BaseModel):
    name: str
    value: str = ""


class WorkflowCreate(BaseModel):
    name: str
    agent_ids: list[str]
    start_inputs: list[StartInput] = Field(default_factory=list)
    # Optional JSON Schema the workflow's end node (its last step) must
    # conform to. When the end node is an agent with no output_schema of its
    # own, this constrains its real model calls the same way an agent-level
    # output_schema does; it's always checked against the end node's actual
    # output afterwards, so a tool end node or a mismatch still surfaces as
    # output_schema_errors on the run result instead of failing silently.
    output_schema: dict[str, Any] | None = None
    visibility: Visibility = "personal"


class RunRequest(BaseModel):
    input: dict[str, str] = Field(default_factory=dict)


class ModelCreate(BaseModel):
    name: str
    provider: str
    pricing: str = ""
    use_case: str = ""
    visibility: Visibility = "personal"


class ToolCreate(BaseModel):
    name: str
    source: Literal["code", "mcp"] = "code"
    language: Literal["python", "java", "cpp"] | None = None
    code: str | None = None
    mcp_server_id: str | None = None
    mcp_tool_name: str | None = None
    description: str = ""
    variables: list[AgentVariable] = Field(default_factory=list)
    writes: str | None = None
    timeout_seconds: int = Field(default=10, ge=1, le=60)
    visibility: Visibility = "personal"


class McpServerCreate(BaseModel):
    name: str
    command: str
    args: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)
    # Names of environment variables to forward from this backend process's
    # own environment into the MCP server's — e.g. SLACK_BOT_TOKEN. The value
    # itself is never sent here or stored; only the variable name is.
    env_passthrough: list[str] = Field(default_factory=list)
    visibility: Visibility = "personal"


class McpToolImport(BaseModel):
    name: str
    description: str = ""
    input_schema: dict = Field(default_factory=dict)
