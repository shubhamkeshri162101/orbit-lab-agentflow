import { Alert, Button, InputGroup, Select, Surface, Typography } from "@oaknorthbank/components";
import { useEffect, useState } from "react";
import { HStack, VStack } from "../components/Stacks";
import { OutputFields } from "../components/MarkdownOutput";
import { api, type RunResult, type Workflow, type WorkflowExecution, type WorkflowVersion } from "../api";

function compareVersionsDesc(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pb[i] - pa[i];
  }
  return 0;
}

export function WorkflowVersionSelector({ workflow, onRestored }: { workflow: Workflow; onRestored: () => void }) {
  const [versions, setVersions] = useState<WorkflowVersion[] | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    api.listWorkflowVersions(workflow.id).then(setVersions);
  }, [workflow.id, workflow.version]);

  if (versions === null) return <Typography.Caption>Loading versions…</Typography.Caption>;

  const options = [
    { value: "current", label: `v${workflow.version} (current)` },
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
      await api.restoreWorkflowVersion(workflow.id, option.value);
      onRestored();
    } finally {
      setRestoring(false);
    }
  }

  return (
    <HStack gap="1rem" alignItems="center">
      <div style={{ minWidth: 280 }}>
        {/* Keyed on version so the trigger label refreshes after a restore changes "current". */}
        <Select
          key={workflow.version}
          label="Version"
          options={options}
          value="current"
          onChange={handleChange}
          disabled={restoring}
        />
      </div>
      {restoring && <Typography.Caption>Restoring…</Typography.Caption>}
    </HStack>
  );
}

function defaultRunInput(workflow: Workflow): string {
  if (workflow.start_inputs?.length) {
    const seed = Object.fromEntries(workflow.start_inputs.map((si) => [si.name, si.value]));
    return JSON.stringify(seed, null, 2);
  }
  return '{\n  "topic": "fraud detection"\n}';
}

export function RunWorkflowPanel({ workflow, onRan }: { workflow: Workflow; onRan: () => void }) {
  const [inputJson, setInputJson] = useState(() => defaultRunInput(workflow));
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  async function handleRun() {
    setError("");
    setResult(null);
    setRunning(true);
    try {
      const input = JSON.parse(inputJson);
      setResult(await api.runWorkflow(workflow.id, input));
      onRan();
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <VStack gap="0.75rem">
      <InputGroup
        type="TextArea"
        label="Input (JSON)"
        inputProps={{
          value: inputJson,
          rows: 4,
          onChange: setInputJson,
          accessibilityLabel: "Run input JSON",
        }}
      />
      <HStack justifyContent="flex-end">
        <Button.Primary label={running ? "Running…" : "Run workflow"} onPress={handleRun} disabled={running} />
      </HStack>
      {error && <Alert level="error" title={error} />}
      {result && (
        <VStack gap="0.5rem">
          <Typography.Caption>Output</Typography.Caption>
          <Surface rounded outlined padding={12}>
            <OutputFields output={result.output} />
          </Surface>
          <Typography.Caption>Trace</Typography.Caption>
          {result.trace.map((step, i) => (
            <Surface key={i} rounded outlined padding={12}>
              <VStack gap="0.5rem">
                <Typography.Body fontWeight="semibold" small>
                  {i + 1}. {step.agent} ({step.model})
                </Typography.Body>
                <Typography.Caption>inputs: {JSON.stringify(step.inputs)}</Typography.Caption>
                <OutputFields output={step.output} />
              </VStack>
            </Surface>
          ))}
        </VStack>
      )}
    </VStack>
  );
}

export function WorkflowExecutionHistoryPanel({
  workflowId,
  refreshToken,
}: {
  workflowId: string;
  refreshToken?: number;
}) {
  const [executions, setExecutions] = useState<WorkflowExecution[] | null>(null);

  useEffect(() => {
    api.listWorkflowExecutions(workflowId).then(setExecutions);
  }, [workflowId, refreshToken]);

  if (executions === null) return <Typography.Caption>Loading execution history…</Typography.Caption>;
  if (executions.length === 0) {
    return <Typography.Caption>No runs yet — use "Run workflow" above to run it.</Typography.Caption>;
  }

  const sorted = [...executions].sort((a, b) => b.executed_at.localeCompare(a.executed_at));

  return (
    <VStack gap="0.75rem">
      {sorted.map((e) => (
        <Surface key={e.id} rounded outlined padding={16}>
          <VStack gap="0.5rem">
            <Typography.Caption>
              {new Date(e.executed_at).toLocaleString()}
              {e.workflow_version ? ` — ran v${e.workflow_version}` : ""}
            </Typography.Caption>

            <Typography.Caption>Input</Typography.Caption>
            <Surface rounded outlined padding={12}>
              <Typography.Body small>{JSON.stringify(e.input, null, 2)}</Typography.Body>
            </Surface>

            <Typography.Caption>Output</Typography.Caption>
            <Surface rounded outlined padding={12}>
              <OutputFields output={e.result.output} />
            </Surface>

            <Typography.Caption>Trace</Typography.Caption>
            {e.result.trace.map((step, i) => (
              <Surface key={i} rounded outlined padding={12}>
                <VStack gap="0.5rem">
                  <Typography.Body fontWeight="semibold" small>
                    {i + 1}. {step.agent} ({step.model})
                  </Typography.Body>
                  <Typography.Caption>inputs: {JSON.stringify(step.inputs)}</Typography.Caption>
                  <OutputFields output={step.output} />
                </VStack>
              </Surface>
            ))}
          </VStack>
        </Surface>
      ))}
    </VStack>
  );
}
