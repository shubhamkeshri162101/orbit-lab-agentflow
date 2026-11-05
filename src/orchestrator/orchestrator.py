"""Deterministic dispatch over a linear chain of steps, sharing state across them.

A step is either an agent (LLM call) or a tool (user-supplied Python/Java/C++
function) — both expose the same requires/writes contract via run_agent /
run_tool, so the loop below doesn't need to care which one it's holding beyond
a `_kind` marker the caller attaches. Linear today by design (per scope
decision); each step is isolated enough that branching/parallel dispatch can
be added later without changing that contract.
"""
from __future__ import annotations

from typing import Any

from src.agents.model_client import ModelClient
from src.agents.run_agent import run_agent
from src.tools.run_tool import run_tool


def run_workflow(
    steps_in_order: list[dict[str, Any]],
    initial_input: dict[str, Any],
    model_client: ModelClient,
) -> dict[str, Any]:
    shared_state: dict[str, Any] = dict(initial_input)
    trace: list[dict[str, Any]] = []

    for step in steps_in_order:
        if step.get("_kind") == "tool":
            result = run_tool(step, shared_state)
            step_label = f"tool:{step['language']}" if step.get("source") != "mcp" else "tool:mcp"
        else:
            result = run_agent(step, shared_state, model_client)
            step_label = step["model"]
        shared_state.update(result["output"])
        trace.append(
            {
                "agent": step["name"],
                "model": step_label,
                "inputs": result["inputs"],
                "output": result["output"],
            }
        )

    return {"output": shared_state, "trace": trace}
