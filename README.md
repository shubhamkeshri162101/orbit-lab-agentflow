# orbit-lab-agentflow

A small prototype of a no-code agent/workflow orchestration builder:
chain LLM agents and custom tools (Python/Java/C++ code, or MCP servers)
into linear workflows, with shared state flowing between steps.

Built as a hackathon exploration — reuses the vocabulary of OakNorth
Platform's own planned "Agentic Workflow Builder" design doc (Thread,
Orchestrator, Agent, Contract) on purpose, so it reads as input to that
work rather than a parallel reinvention.

## What's here

- **Agents** — reusable LLM step definitions: model, prompt template,
  temperature/timeout, declared input variables, semantic versioning
  (`1.0.0` → `1.0.1` → ... with capped rollover), clone, execution history.
- **Workflows** — a visual graph (React Flow) chaining agents and tools
  Start → ... → End, with a declared Start-input schema, live
  "missing required input" detection across the chain, and a run panel
  with full step-by-step trace.
- **Tools** — two kinds, both usable as workflow steps:
  - **Code**: Python, Java, or C++ functions, executed as real OS
    subprocesses with a simple `name<TAB>value` stdin/stdout protocol.
  - **MCP**: connect a local (stdio) MCP server, discover its tools live,
    and import any of them to run as a workflow step.
- **Models** — a catalog of available LLM models (name, provider,
  pricing, use case), each tagged with which provider's API key it
  needs. Keys themselves are never stored here (see below).
- **Personal / Public visibility** — every resource can be toggled
  between personal (visible only to its creator) and public (visible to
  anyone using the app) with one click.

## Running it

Backend (FastAPI + TinyDB):

```bash
cd orbit-lab-agentflow
python3 -m venv .venv && source .venv/bin/activate
pip install fastapi uvicorn tinydb mcp
uvicorn src.api.main:app --reload --port 8008
```

Frontend (React + Vite, using the real `@oaknorthbank/components` Timber
Design System — requires access to OakNorth's npm registry):

```bash
cd ui
npm install
npm run dev
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
- **Provider API keys live in environment variables only** (e.g.
  `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`), set on the machine running the
  backend — never typed into the UI or stored in the TinyDB-backed
  `data/db.json`.
- **Real model calls aren't wired up yet.** `MockModelClient` stands in
  for actual provider calls so the orchestration/chaining logic is
  demoable without live keys; swapping in a real client is the next
  step once this is validated.
- **Linear chains only.** The workflow graph data model allows for
  branching later, but execution today only supports a single
  Start → ... → End path.

## Deployment path (not built here)

The target architecture this prototype points toward: one Lambda per
agent, ECS for the orchestrating API, DynamoDB for persistence (the
`Repository` class already has a narrow `get`/`list`/`put`/`delete`
interface so swapping TinyDB for DynamoDB is a single-file change), and
real Timber components in production (this UI already uses the real
`@oaknorthbank/components` package, not a mock).
