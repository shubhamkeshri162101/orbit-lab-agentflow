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
            "requires": ["topic"],
            "writes": "summary",
        },
        {
            "name": "reviewer",
            "system_prompt_template": "Review this summary: {summary}",
            "model": "claude-sonnet-5-5",
            "requires": ["summary"],
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
            "requires": ["summary"],
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
            "requires": ["nonexistent_key"],
            "writes": "orphan_out",
        }
    ]

    with pytest.raises(MissingRequiredStateError):
        run_workflow(agents, {}, MockModelClient())
