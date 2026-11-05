"""Pluggable model-call seam. Swap MockModelClient for a real provider once API keys land."""
from __future__ import annotations

import os
from abc import ABC, abstractmethod

import anthropic

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


class MultiProviderModelClient(ModelClient):
    """Dispatches each call by the model's own provider, since a single workflow
    run can mix models from different providers. Only Anthropic has a live
    client wired up today; any other provider falls back to the mock so a
    mixed workflow can still demo end-to-end rather than hard-failing on the
    one step nobody's wired up yet.
    """

    def __init__(self, model_catalog: list[dict]):
        self._provider_by_model = {m["name"]: m.get("provider") for m in model_catalog}
        self._anthropic_client: anthropic.Anthropic | None = None
        self._mock = MockModelClient()

    def _anthropic(self) -> anthropic.Anthropic:
        if self._anthropic_client is None:
            self._anthropic_client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY itself
        return self._anthropic_client

    def complete(
        self,
        model: str,
        system_prompt: str,
        variables: dict[str, str],
        temperature: float = 0.7,
        timeout_seconds: int = 30,
    ) -> str:
        provider = self._provider_by_model.get(model)
        has_key = provider and os.environ.get(PROVIDER_ENV_VARS.get(provider, ""))

        if provider == "anthropic" and has_key:
            rendered = system_prompt
            for key, value in variables.items():
                rendered = rendered.replace(f"{{{key}}}", str(value))
            try:
                # The installed anthropic SDK (2.5.0) doesn't expose `temperature`
                # as a direct messages.create() parameter — the agent's
                # temperature setting has no effect on real calls for now.
                response = self._anthropic().messages.create(
                    model=model,
                    max_tokens=1024,
                    timeout=timeout_seconds,
                    messages=[{"role": "user", "content": rendered}],
                )
            except anthropic.APIError as e:
                raise RuntimeError(f"Anthropic API call failed for model '{model}': {e}") from e
            return "".join(block.text for block in response.content if block.type == "text")

        return self._mock.complete(model, system_prompt, variables, temperature, timeout_seconds)


def get_model_client(model_catalog: list[dict] | None = None) -> ModelClient:
    return MultiProviderModelClient(model_catalog or [])
