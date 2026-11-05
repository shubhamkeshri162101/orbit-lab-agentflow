"""Pluggable model-call seam. Swap MockModelClient for a real provider once API keys land."""
from __future__ import annotations

import os
from abc import ABC, abstractmethod

# Each provider's key lives in its own environment variable — never in the
# TinyDB-backed `models` table, and never sent to the browser. A model's
# `provider` field (set in the Models tab) picks which of these a call uses,
# so Claude, GPT and Gemini models can each use their own key without collision.
PROVIDER_ENV_VARS = {
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "google": "GOOGLE_API_KEY",
}

# Seeded into the `models` table on first run only — after that, the table in
# data/db.json is the source of truth and is managed via the Models tab.
DEFAULT_MODEL_CATALOG = [
    {
        "name": "claude-sonnet-5-5",
        "provider": "anthropic",
        "pricing": "$3 / $15 per MTok (input/output) — illustrative, edit to match your rates",
        "use_case": "Best default for most agents: strong reasoning with balanced cost and latency.",
    },
    {
        "name": "claude-opus-5-5",
        "provider": "anthropic",
        "pricing": "$15 / $75 per MTok (input/output) — illustrative, edit to match your rates",
        "use_case": "Highest-capability tasks: complex multi-step reasoning or high-stakes judgment calls.",
    },
    {
        "name": "claude-haiku-5-5",
        "provider": "anthropic",
        "pricing": "$0.80 / $4 per MTok (input/output) — illustrative, edit to match your rates",
        "use_case": "High-volume, latency-sensitive steps like classification or short summarization.",
    },
    {
        "name": "gpt-5",
        "provider": "openai",
        "pricing": "Varies by provider plan — illustrative, edit to match your rates",
        "use_case": "Cross-provider comparison or fallback option.",
    },
]


class ModelClient(ABC):
    @abstractmethod
    def complete(
        self,
        model: str,
        system_prompt: str,
        variables: dict[str, str],
        temperature: float = 0.7,
        timeout_seconds: int = 30,
    ) -> str:
        ...


class MockModelClient(ModelClient):
    """Deterministic stand-in so the orchestration/chaining logic is demoable without live keys."""

    def complete(
        self,
        model: str,
        system_prompt: str,
        variables: dict[str, str],
        temperature: float = 0.7,
        timeout_seconds: int = 30,
    ) -> str:
        rendered = system_prompt
        for key, value in variables.items():
            rendered = rendered.replace(f"{{{key}}}", str(value))
        return f"[mock:{model} temp={temperature} timeout={timeout_seconds}s] {rendered}"


def get_model_client(model_catalog: list[dict] | None = None) -> ModelClient:
    """Scans the configured models' providers and, if a matching key is set for
    any of them, fails loudly naming exactly which provider/env var is ready —
    rather than a global check that can't tell Claude's key from GPT's.
    """
    for entry in model_catalog or []:
        env_var = PROVIDER_ENV_VARS.get(entry.get("provider", ""))
        if env_var and os.environ.get(env_var):
            raise NotImplementedError(
                f"{env_var} is set (provider '{entry['provider']}', model '{entry['name']}') "
                "but no live client is wired up yet — add the provider call here and switch this factory over."
            )
    return MockModelClient()
