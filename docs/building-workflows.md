# Building a workflow graph

A quick, example-driven reference for creating agents, tools, and
workflows directly against the API — useful whether you're scripting
this repo or just want the data model clear before touching the UI
code. All examples assume the backend is running on `http://localhost:8008`
(see the root `README.md` for setup).

## The mental model

A **workflow** is an ordered list of step ids (`agent_ids` — the field
name is historical; it can mix agent ids and tool ids freely) executed
left to right, Start → step 1 → step 2 → ... → End. There's no
branching at execution time today, just a single chain.

State flows between steps through one shared dict, seeded by the run's
`input` and the workflow's declared `start_inputs`:

- Each step declares `variables: [{name, required, default}]` — the
  keys it reads out of the shared state.
- Each step writes its result back under `writes` (or its own `name` if
  `writes` is unset).
- A later step's variable name must match an earlier step's `writes`
  key (or a start input) exactly, or the run fails fast with a
  `MissingRequiredStateError` before anything executes needlessly.

The UI's "missing required input" warnings on the canvas are exactly
this check, run against the graph before you hit Run.

## 1. Create an agent

```bash
curl -s -X POST http://localhost:8008/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "summarizer",
    "system_prompt_template": "Summarize this in one sentence: {topic}",
    "model": "claude-sonnet-5-5",
    "variables": [{"name": "topic", "required": true}],
    "writes": "summary"
  }'
```

`model` must be a name already in the Models catalog (`GET /models` —
seeded with a few Anthropic models and `gpt-5` by default). Omitted
fields fall back to sane defaults: `temperature` 0.7, `timeout_seconds`
30, `max_output_tokens` 1024, `visibility` `"personal"`.

Chain a second agent that reads the first one's output:

```bash
curl -s -X POST http://localhost:8008/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "reviewer",
    "system_prompt_template": "Review this summary for accuracy: {summary}",
    "model": "claude-sonnet-5-5",
    "variables": [{"name": "summary", "required": true}],
    "writes": "review"
  }'
```

### Optional: constrain the output to JSON

Set `output_schema` to a JSON Schema object to force a real call to
return matching JSON instead of free text:

```json
{
  "output_schema": {
    "type": "object",
    "properties": { "verdict": { "type": "string" } },
    "required": ["verdict"]
  }
}
```

(`additionalProperties: false` is filled in automatically on object
nodes — Anthropic's structured-outputs API requires it explicitly, so
you don't have to remember to add it.)

## 2. Create a tool (optional)

Code tools need a `run(inputs)` function/method — the harness handles
stdin/stdout, so no JSON library is needed in any of the three
languages:

```bash
curl -s -X POST http://localhost:8008/tools \
  -H "Content-Type: application/json" \
  -d '{
    "name": "adder",
    "source": "code",
    "language": "python",
    "code": "def run(inputs):\n    return int(inputs[\"a\"]) + int(inputs[\"b\"])\n",
    "variables": [{"name": "a", "required": true}, {"name": "b", "required": true}],
    "writes": "sum"
  }'
```

An MCP-backed tool is created differently — connect a server first
(`POST /mcp-servers`), discover what it exposes
(`GET /mcp-servers/{id}/tools`), then import one of the discovered
tools (`POST /mcp-servers/{id}/import`) to get a regular `Tool` record
with `source: "mcp"`.

## 3. Chain them into a workflow

```bash
curl -s -X POST http://localhost:8008/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "summarize-and-review",
    "agent_ids": ["<summarizer-id>", "<reviewer-id>"],
    "start_inputs": [{"name": "topic", "value": "fraud detection"}]
  }'
```

`start_inputs` is informational-plus-default: it shows on the Start
node in the UI and seeds the "Run this workflow" form, but the actual
values a run uses come from the run request's own `input`.

## 4. Run it

```bash
curl -s -X POST http://localhost:8008/workflows/<workflow-id>/run \
  -H "Content-Type: application/json" \
  -d '{"input": {"topic": "fraud detection"}}'
```

Response shape:

```json
{
  "output": { "topic": "fraud detection", "summary": "...", "review": "..." },
  "trace": [
    { "agent": "summarizer", "model": "claude-sonnet-5-5", "inputs": {...}, "output": {"summary": "..."} },
    { "agent": "reviewer", "model": "claude-sonnet-5-5", "inputs": {...}, "output": {"review": "..."} }
  ]
}
```

`output` is the full shared state at the end of the run (everything
ever written, plus the original input). If the workflow declared an
`output_schema`, the response also carries `output_schema_errors` — an
empty list means the end node's output validated clean.

## Things that will reject your request

- **Unknown model** on an agent: 400, `model must be one of [...]`.
- **Duplicate name** within a resource type: 409 (names must be unique
  per agent/workflow/tool).
- **Unknown agent/tool id** in `agent_ids`: 400 at workflow create/run
  time.
- **Required variable missing from shared state** at run time: 400,
  naming the step and the missing key(s).
- **Deleting something referenced elsewhere** (an agent used by a
  workflow, a model used by an agent, a tool used by a workflow): 409.
- **Deleting (or publishing) a public MCP server config, or making one
  public**: MCP servers are personal-only, permanently — see the root
  `README.md`.

## Versioning and visibility, if you're scripting around them

- Agents and workflows are versioned (`1.0.0`-style); `PUT /{id}`
  bumps the patch digit and snapshots history, `PUT /{id}/overwrite`
  edits in place with no bump.
- Every create call always comes back `visibility: "personal"`
  regardless of what you send — publish explicitly via
  `PATCH /{id}/visibility` (not available for MCP servers) or the
  fork → edit → `POST /{id}/publish` flow for agents/workflows/tools/
  models. See the root `README.md`'s "Personal / Public visibility"
  section for the full fork/publish/clone version-bumping rules.
