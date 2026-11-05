import { Alert, Button, InputGroup, Select, Surface, Typography } from "@oaknorthbank/components";
import { useEffect, useState } from "react";
import { HStack, VStack } from "../components/Stacks";
import { OutputFields } from "../components/MarkdownOutput";
import { api, type Agent, type AgentExecution, type AgentRunResult, type AgentVersion } from "../api";

function compareVersionsDesc(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pb[i] - pa[i];
  }
  return 0;
}

export function TestAgentPanel({ agent, onRan }: { agent: Agent; onRan: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(agent.variables.map((v) => [v.name, v.default ?? ""]))
  );
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  async function handleTest() {
    setError("");
    setResult(null);
    setRunning(true);
    try {
      setResult(await api.runAgent(agent.id, values));
      onRan();
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <Surface rounded outlined padding={16}>
      <VStack gap="0.75rem">
        {agent.variables.length === 0 ? (
          <Typography.Caption>This agent takes no input variables.</Typography.Caption>
        ) : (
          agent.variables.map((v) => (
            <InputGroup
              key={v.name}
              type="Text"
              label={`${v.name}${v.required ? " (required)" : " (optional)"}`}
              inputProps={{
                value: values[v.name] ?? "",
                onChange: (value) => setValues((prev) => ({ ...prev, [v.name]: value })),
                placeholder: v.default ?? "",
                accessibilityLabel: `Test value for ${v.name}`,
              }}
            />
          ))
        )}
        <HStack justifyContent="flex-end">
          <Button.Primary label={running ? "Running…" : "Test agent"} onPress={handleTest} disabled={running} />
        </HStack>
        {error && <Alert level="error" title={error} />}
        {result && (
          <VStack gap="0.25rem">
            <Typography.Caption>Output</Typography.Caption>
            <Surface rounded outlined padding={12}>
              <OutputFields output={result.output} />
            </Surface>
          </VStack>
        )}
      </VStack>
    </Surface>
  );
}

export function AgentVersionSelector({ agent, onRestored }: { agent: Agent; onRestored: () => void }) {
  const [versions, setVersions] = useState<AgentVersion[] | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    api.listAgentVersions(agent.id).then(setVersions);
  }, [agent.id, agent.version]);

  if (versions === null) return <Typography.Caption>Loading versions…</Typography.Caption>;

  const options = [
    { value: "current", label: `v${agent.version} (current)` },
    ...[...versions]
      .sort((a, b) => compareVersionsDesc(a.version, b.version))
      .map((v) => ({
        value: v.id,
        label: `v${v.version} — ${new Date(v.versioned_at).toLocaleDateString()}`,
      })),
  ];

  async function handleChange(option: { value: string; label: string }) {
    if (option.value === "current") return;
    setRestoring(true);
    try {
      await api.restoreAgentVersion(agent.id, option.value);
      onRestored();
    } finally {
      setRestoring(false);
    }
  }

  return (
    <HStack gap="1rem" alignItems="center">
      <div style={{ minWidth: 280 }}>
        {/* Keyed on version so the trigger label refreshes after a restore changes "current". */}
        <Select key={agent.version} label="Version" options={options} value="current" onChange={handleChange} disabled={restoring} />
      </div>
      {restoring && <Typography.Caption>Restoring…</Typography.Caption>}
    </HStack>
  );
}

export function AgentExecutionHistoryPanel({
  agentId,
  refreshToken,
}: {
  agentId: string;
  refreshToken?: number;
}) {
  const [executions, setExecutions] = useState<AgentExecution[] | null>(null);

  useEffect(() => {
    api.listAgentExecutions(agentId).then(setExecutions);
  }, [agentId, refreshToken]);

  if (executions === null) return <Typography.Caption>Loading execution history…</Typography.Caption>;
  if (executions.length === 0) {
    return <Typography.Caption>No runs yet — use "Test" above to run this agent.</Typography.Caption>;
  }

  const sorted = [...executions].sort((a, b) => b.executed_at.localeCompare(a.executed_at));

  return (
    <VStack gap="0.75rem">
      {sorted.map((e) => (
        <Surface key={e.id} rounded outlined padding={16}>
          <VStack gap="0.5rem">
            <Typography.Caption>{new Date(e.executed_at).toLocaleString()}</Typography.Caption>
            <Typography.Body small secondary>
              {e.model} · temp {(e.temperature ?? 0.7).toFixed(2)} · timeout {e.timeout_seconds ?? 30}s · max{" "}
              {e.max_output_tokens ?? 1024} tok
            </Typography.Body>

            <Typography.Caption>Prompt used</Typography.Caption>
            <Surface rounded outlined padding={12}>
              <Typography.Body small>{e.system_prompt_template}</Typography.Body>
            </Surface>

            <Typography.Caption>Input</Typography.Caption>
            <Surface rounded outlined padding={12}>
              <Typography.Body small>{JSON.stringify(e.input, null, 2)}</Typography.Body>
            </Surface>

            <Typography.Caption>Output</Typography.Caption>
            <Surface rounded outlined padding={12}>
              <OutputFields output={e.result.output} />
            </Surface>
          </VStack>
        </Surface>
      ))}
    </VStack>
  );
}
