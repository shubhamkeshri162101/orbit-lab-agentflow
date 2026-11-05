# orbit-labs-agentflow

A small prototype of a no-code agent/workflow orchestration builder:
chain LLM agents and custom tools (Python/Java/C++ code, or MCP servers)
into linear workflows, with shared state flowing between steps. The UI
displays itself as **LABS**.

Built as a hackathon exploration — reuses the vocabulary of OakNorth
Platform's own planned "Agentic Workflow Builder" design doc (Thread,
Orchestrator, Agent, Contract) on purpose, so it reads as input to that
work rather than a parallel reinvention.

## What's here

### Agents

Reusable LLM step definitions:

- Model, prompt template (with `{variable}` placeholders auto-detected
  as declared input variables), temperature, timeout, and a **max
  output tokens** cap (1–10,000) so a verbose real response can't
  quietly run up cost.
- Optional **output format** (a JSON Schema): when set, real Anthropic
  calls are constrained via `output_config.format` to always return
  valid JSON matching it, instead of free-form text. The mock fallback
  (no key, or a provider with no live client) returns a schema-shaped
  stub so the contract still holds.
- Semantic versioning, with three distinct, deliberate bump rules:
  - **Save (new version)** bumps the patch digit (`1.0.1 → 1.0.2`).
  - **Clone** bumps the major digit (`1.0.1 → 2.0.0`).
  - **Make personal** (forking a public agent) bumps the minor digit
    only, leaving patch untouched (`1.0.1 → 1.1.1`).
  - Full version history per agent, with restore, and each digit
    capped at 99 with carry-over into the next.
- Clone and Publish both ask which version to act on — the current
  state, or any historical snapshot — before doing anything.
- Execution history, with the model's response rendered as parsed
  markdown (headings, bold, lists, inline code) instead of a raw
  JSON-escaped string.

### Workflows

- A visual graph (React Flow), Start → ... → End. Branching is modeled
  in the data but not executed yet — today's execution is a single
  linear chain.
- Searchable "+ Add agent" / "+ Add tool" dropdowns for the canvas:
  latest-created items first, filtered by name as you type, already-
  placed items excluded, and each agent option shows its version.
- A declared Start-input schema, with live "missing required input"
  detection drawn across the whole chain before you ever hit Run.
- An optional **output format** at the workflow level, applied to the
  end node (the step right before End): if that step is an agent with
  no schema of its own, the workflow's schema constrains its real call
  the same way an agent-level one does; either way the end node's
  actual output is validated afterwards and surfaced as
  `output_schema_errors` on the run result — this also catches a tool
  end node, which can't be constrained at generation time.
- Collapsible "Start inputs" / "Output format" sections (with a
  one-line summary when closed) so the canvas stays the visual focus.
- A run panel with full step-by-step trace, and execution history.

### Tools

Two kinds, both usable as workflow steps:

- **Code** — Python, Java, or C++ functions, executed as real OS
  subprocesses with a simple `name<TAB>value` stdin/stdout protocol
  (no JSON library needed in any of the three languages).
- **MCP** — connect a local (stdio) MCP server, discover its tools
  live, and import any of them to run as a workflow step. **MCP
  servers are personal-only and can never be made public** — they can
  run arbitrary local commands and carry credentials via
  `env_passthrough`, so publishing one isn't offered at all.

### Models

A catalog of available LLM models (name, provider, pricing, use case),
each tagged with which provider's API key it needs. Keys themselves
are never stored here (see below).

### Personal / Public visibility, and forking

- Every resource (agents, workflows, tools, models, MCP servers)
  **always starts personal on creation**, regardless of what's
  requested — publishing is always a separate, explicit step.
- For **agents and workflows**, "Make personal" on a public resource
  never edits the public one in place (that could pull it out from
  under someone else using it). It forks an independent personal draft
  instead, which can later be **published** back onto the original —
  merging the draft's changes, bumping and snapshotting the original's
  version. Models and tools get the same fork → edit → publish flow,
  just without the version-bump step (they aren't versioned).
- **MCP servers are the one exception**: personal-only, permanently —
  there's no publish path for them at all.
- Deleting a **public** resource is blocked outright (409) until it's
  made personal first. The UI disables the delete button on public
  items and raises a confirmation modal (showing the item's name and
  version) instead of a one-click "are you sure" expand.

## Running it

Backend (FastAPI + TinyDB):

```bash
cd orbit-labs-agentflow
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in whichever provider/MCP keys you have
uvicorn src.api.main:app --reload --port 8008
```

`.env` is loaded automatically on startup and is gitignored — real keys
never get committed. See `.env.example` for every variable this repo
currently knows about (model provider keys, and the Slack/Notion/Jira
MCP credential names).

Frontend (React + Vite, using the real `@oaknorthbank/components` Timber
Design System — requires access to OakNorth's npm registry):

```bash
cd ui
npm install
npm run dev
```

Tests:

```bash
pip install -r requirements-dev.txt
pytest
```

## Honest scope notes

This is a prototype, not a hardened product. A few things are
deliberately simplified rather than silently faked:

- **No real authentication.** "Personal/Public" visibility is a
  self-reported display name sent as an `X-User` header — it scopes
  what shows up in list views, but anyone can claim any name. Not
  access control.
- **No sandboxing for Tools.** Code tools run as plain OS subprocesses
  with the same privileges as the backend. Only run code you trust.
- **MCP support is stdio-only.** No HTTP/SSE transport, no OAuth — just
  a local command the backend can launch.
- **Model pricing is illustrative.** Seeded with placeholder numbers;
  edit them to match real provider rates.
- **Provider and MCP credentials live in environment variables only**
  (via `.env` or a real `export`), read on the machine running the
  backend — never typed into the UI or stored in the TinyDB-backed
  `data/db.json`.
- **Only Anthropic models make real calls today.** Agents using an
  `anthropic`-provider model call the live Messages API (including
  structured-output schemas and the max-output-tokens cap above); any
  other provider, or a missing key, falls back to a deterministic mock
  so a mixed workflow can still demo end-to-end.
- **An agent's temperature has no effect on real calls yet.** The
  installed `anthropic` SDK version doesn't expose it as a direct
  parameter on the real call; the slider still works, it just isn't
  wired through.
- **Linear chains only.** The workflow graph data model allows for
  branching later, but execution today only supports a single
  Start → ... → End path.

## More docs

- [`docs/building-workflows.md`](docs/building-workflows.md) — a
  curl-driven walkthrough of the agent/tool/workflow data model and API,
  for scripting against this repo directly instead of through the UI.

## Deployment path (not built here)

The target architecture this prototype points toward: one Lambda per
agent, ECS for the orchestrating API, DynamoDB for persistence (the
`Repository` class already has a narrow `get`/`list`/`put`/`delete`
interface so swapping TinyDB for DynamoDB is a single-file change), and
real Timber components in production (this UI already uses the real
`@oaknorthbank/components` package, not a mock).
