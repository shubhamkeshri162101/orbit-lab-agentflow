"""Deterministic dispatch over a linear chain of steps, sharing state across them.

A step is either an agent (LLM call) or a tool (user-supplied Python/Java/C++
function) — both expose the same requires/writes contract via run_agent /
run_tool, so the loop below doesn't need to care which one it's holding beyond
a `_kind` marker the caller attaches. Linear today by design (per scope
decision); each step is isolated enough that branching/parallel dispatch can
be added later without changing that contract.
"""
from __future__ import annotations

import json
from typing import Any

from src.agents.model_client import ModelClient
from src.agents.run_agent import run_agent
from src.tools.run_tool import run_tool


def _schema_errors(value: Any, schema: dict[str, Any], path: str = "value") -> list[str]:
    """A lightweight structural check (type/required/properties/items) — not
    full JSON Schema, but enough to flag a workflow end node drifting from
    its declared output_schema."""
    json_type = schema.get("type")
    type_map: dict[str, Any] = {
        "object": dict,
        "array": list,
        "string": str,
        "integer": int,
        "boolean": bool,
        "number": (int, float),
    }
    if json_type in type_map:
        if json_type == "integer" and isinstance(value, bool):
            return [f"{path}: expected integer, got boolean"]
        if not isinstance(value, type_map[json_type]):
            return [f"{path}: expected {json_type}, got {type(value).__name__}"]

    errors: list[str] = []
    if json_type == "object" and isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                errors.append(f"{path}.{key}: missing required field")
        for key, sub_schema in schema.get("properties", {}).items():
            if key in value:
                errors.extend(_schema_errors(value[key], sub_schema, f"{path}.{key}"))
    elif json_type == "array" and isinstance(value, list):
        item_schema = schema.get("items")
        if item_schema:
            for i, item in enumerate(value):
                errors.extend(_schema_errors(item, item_schema, f"{path}[{i}]"))
    return errors


def validate_end_node_output(end_output: dict[str, str], schema: dict[str, Any]) -> list[str]:
    if not end_output:
        return ["end node produced no output"]
    text = next(iter(end_output.values()))
    try:
        parsed = json.loads(text)
    except (ValueError, TypeError):
        return ["end node output is not valid JSON"]
    return _schema_errors(parsed, schema)


def run_workflow(
    steps_in_order: list[dict[str, Any]],
    initial_input: dict[str, Any],
    model_client: ModelClient,
    output_schema: dict[str, Any] | None = None,
) -> dict[str, Any]:
    shared_state: dict[str, Any] = dict(initial_input)
    trace: list[dict[str, Any]] = []

    for i, step in enumerate(steps_in_order):
        is_end_node = i == len(steps_in_order) - 1
        if step.get("_kind") == "tool":
            result = run_tool(step, shared_state)
            step_label = f"tool:{step['language']}" if step.get("source") != "mcp" else "tool:mcp"
        else:
            # The workflow's own output_schema constrains the end node's real
            # model call only when that step doesn't already declare its own.
            effective_step = step
            if is_end_node and output_schema and not step.get("output_schema"):
                effective_step = {**step, "output_schema": output_schema}
            result = run_agent(effective_step, shared_state, model_client)
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

    run_result: dict[str, Any] = {"output": shared_state, "trace": trace}
    if output_schema:
        end_output = trace[-1]["output"] if trace else {}
        run_result["output_schema_errors"] = validate_end_node_output(end_output, output_schema)
    return run_result
