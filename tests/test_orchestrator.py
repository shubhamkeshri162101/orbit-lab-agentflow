import pytest

from src.agents.model_client import MockModelClient
from src.agents.run_agent import MissingRequiredStateError
from src.orchestrator.orchestrator import run_workflow


def test_second_agent_sees_first_agents_output():
    agents = [
        {
            "name": "summarizer",
            "system_prompt_template": "Summarize: {topic}",
            "model": "claude-sonnet-5-5",
            "variables": [{"name": "topic", "required": True}],
            "writes": "summary",
        },
        {
            "name": "reviewer",
            "system_prompt_template": "Review this summary: {summary}",
            "model": "claude-sonnet-5-5",
            "variables": [{"name": "summary", "required": True}],
            "writes": "review",
        },
    ]

    result = run_workflow(agents, {"topic": "fraud detection"}, MockModelClient())

    assert "summary" in result["output"]
    assert "review" in result["output"]
    assert result["trace"][1]["inputs"]["summary"] == result["trace"][0]["output"]["summary"]


def test_writes_defaults_to_agent_name_when_omitted():
    agents = [
        {
            "name": "reviewer",
            "system_prompt_template": "Review this: {summary}",
            "model": "claude-sonnet-5-5",
            "variables": [{"name": "summary", "required": True}],
            "writes": None,
        }
    ]

    result = run_workflow(agents, {"summary": "a loan memo"}, MockModelClient())

    assert "reviewer" in result["output"]
    assert "None" not in result["output"]


def test_missing_required_state_raises_instead_of_silently_using_none():
    agents = [
        {
            "name": "orphan",
            "system_prompt_template": "Use: {nonexistent_key}",
            "model": "gpt-5",
            "variables": [{"name": "nonexistent_key", "required": True}],
            "writes": "orphan_out",
        }
    ]

    with pytest.raises(MissingRequiredStateError):
        run_workflow(agents, {}, MockModelClient())


def test_tool_step_runs_alongside_agent_step():
    """A workflow can mix a code tool and an agent — the tool's output feeds the agent."""
    steps = [
        {
            "_kind": "tool",
            "name": "adder",
            "source": "code",
            "language": "python",
            "code": 'def run(inputs):\n    return int(inputs["a"]) + int(inputs["b"])\n',
            "variables": [{"name": "a", "required": True}, {"name": "b", "required": True}],
            "writes": "sum",
            "timeout_seconds": 10,
        },
        {
            "_kind": "agent",
            "name": "summarizer",
            "system_prompt_template": "The sum is {sum}",
            "model": "claude-sonnet-5-5",
            "variables": [{"name": "sum", "required": True}],
            "writes": "summary",
        },
    ]

    result = run_workflow(steps, {"a": "2", "b": "3"}, MockModelClient())

    assert result["output"]["sum"] == "5"
    assert "summary" in result["output"]
    assert result["trace"][0]["model"] == "tool:python"


def test_output_schema_constrains_end_node_and_validates_clean():
    """The workflow's output_schema flows into the last step's agent call (since
    it has none of its own), and the mock's schema-shaped stub output passes
    validation against it."""
    agents = [
        {
            "name": "summarizer",
            "system_prompt_template": "Summarize: {topic}",
            "model": "claude-sonnet-5-5",
            "variables": [{"name": "topic", "required": True}],
            "writes": "summary",
        },
    ]
    schema = {
        "type": "object",
        "properties": {"summary": {"type": "string"}},
        "required": ["summary"],
    }

    result = run_workflow(agents, {"topic": "fraud detection"}, MockModelClient(), output_schema=schema)

    assert result["output_schema_errors"] == []


def test_output_schema_errors_surface_a_mismatch():
    """A tool end node's output isn't shaped by output_config.format at all
    (only agent steps can be constrained), so a workflow output_schema is a
    pure post-hoc check there -- a plain-text tool output fails it."""
    steps = [
        {
            "_kind": "tool",
            "name": "adder",
            "source": "code",
            "language": "python",
            "code": 'def run(inputs):\n    return int(inputs["a"]) + int(inputs["b"])\n',
            "variables": [{"name": "a", "required": True}, {"name": "b", "required": True}],
            "writes": "sum",
            "timeout_seconds": 10,
        },
    ]
    schema = {"type": "object", "properties": {"count": {"type": "integer"}}, "required": ["count"]}

    result = run_workflow(steps, {"a": "2", "b": "3"}, MockModelClient(), output_schema=schema)

    assert result["output_schema_errors"] != []


def test_step_level_output_schema_is_not_overridden_by_workflow_schema():
    agents = [
        {
            "name": "summarizer",
            "system_prompt_template": "Summarize: {topic}",
            "model": "claude-sonnet-5-5",
            "variables": [{"name": "topic", "required": True}],
            "writes": "summary",
            "output_schema": {"type": "object", "properties": {"summary": {"type": "string"}}, "required": ["summary"]},
        },
    ]
    workflow_schema = {"type": "object", "properties": {"count": {"type": "integer"}}, "required": ["count"]}

    result = run_workflow(agents, {"topic": "fraud detection"}, MockModelClient(), output_schema=workflow_schema)

    # The step's own schema produced the output, so it won't satisfy the
    # workflow's different schema -- proving the step-level one was used for
    # generation (not overridden), even though the workflow-level one still
    # runs its own validation pass afterwards.
    assert result["output_schema_errors"] != []
