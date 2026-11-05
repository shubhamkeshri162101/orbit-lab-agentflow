"""Each agent is a pure function: shared state in, declared output out.

Structured so this becomes an individually-invokable Lambda later without
changing the signature — today it runs in-process.
"""
from __future__ import annotations

from typing import Any

from src.agents.model_client import ModelClient


class MissingRequiredStateError(Exception):
    """Raised by both run_agent and run_tool — a workflow step can be either."""

    def __init__(self, step_name: str, missing_keys: list[str]):
        self.agent_name = step_name
        self.missing_keys = missing_keys
        super().__init__(
            f"'{step_name}' requires {missing_keys}, but they are not yet in shared state"
        )


def run_agent(agent: dict[str, Any], shared_state: dict[str, Any], model_client: ModelClient) -> dict[str, Any]:
    variables = agent.get("variables", [])
    missing_keys = [
        v["name"] for v in variables if v["name"] not in shared_state and v.get("required", True)
    ]
    if missing_keys:
        raise MissingRequiredStateError(agent["name"], missing_keys)

    inputs = {
        v["name"]: shared_state.get(v["name"], v.get("default") or "") for v in variables
    }

    output_text = model_client.complete(
        model=agent["model"],
        system_prompt=agent["system_prompt_template"],
        variables=inputs,
        temperature=agent.get("temperature", 0.7),
        timeout_seconds=agent.get("timeout_seconds", 30),
        output_schema=agent.get("output_schema"),
    )

    writes_key = agent.get("writes") or agent["name"]
    return {"inputs": inputs, "output": {writes_key: output_text}}
