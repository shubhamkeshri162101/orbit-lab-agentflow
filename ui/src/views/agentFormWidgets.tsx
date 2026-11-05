import { Accordion, Check, InputGroup, Select, Slider, Surface, Typography } from "@oaknorthbank/components";
import { useState } from "react";
import { HStack, VStack } from "../components/Stacks";
import type { useAgentForm } from "./useAgentForm";
import type { VariableConfig } from "./agentVariables";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function NumericSliderControl({
  label,
  exactLabel,
  min,
  max,
  step,
  value,
  onChange,
  decimals = 0,
}: {
  label: string;
  exactLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  decimals?: number;
}) {
  const [text, setText] = useState(value.toFixed(decimals));
  const [remountKey, setRemountKey] = useState(0);

  function commitText(next: string) {
    setText(next);
    const parsed = parseFloat(next);
    if (!Number.isNaN(parsed)) onChange(clamp(parsed, min, max));
  }

  // TextInput only reads its initial `value` at mount and never re-syncs from
  // the prop afterwards, so a slider-driven change needs a fresh mount to show.
  function handleSliderChange(next: number) {
    onChange(next);
    setText(next.toFixed(decimals));
    setRemountKey((k) => k + 1);
  }

  return (
    <VStack gap="0.5rem">
      <Typography.Body fontWeight="semibold">{label}</Typography.Body>
      <HStack gap="1rem" alignItems="flex-end">
        <div style={{ flex: 1 }}>
          <Slider min={min} max={max} step={step} value={value} onChange={handleSliderChange} accessibilityLabel={label} />
        </div>
        <div style={{ width: 240 }}>
          <InputGroup
            key={remountKey}
            type="Text"
            label={exactLabel}
            inputProps={{ value: text, onChange: commitText, accessibilityLabel: `${label} exact value` }}
          />
        </div>
      </HStack>
    </VStack>
  );
}

export function VariableRows({
  detected,
  config,
  onUpdate,
}: {
  detected: string[];
  config: VariableConfig;
  onUpdate: (name: string, patch: Partial<{ required: boolean; default: string }>) => void;
}) {
  if (detected.length === 0) {
    return <Typography.Caption>No {"{variables}"} found in the prompt yet.</Typography.Caption>;
  }

  return (
    <VStack gap="0.5rem">
      {detected.map((name) => {
        const entry = config[name] ?? { required: true, default: "" };
        return (
          <Surface key={name} rounded outlined padding={12}>
            <HStack gap="1rem" alignItems="center">
              <div style={{ minWidth: 120 }}>
                <Typography.Body fontWeight="semibold">{`{${name}}`}</Typography.Body>
              </div>
              <Check.Labeled
                label="Required"
                checked={entry.required}
                onChange={(checked) => onUpdate(name, { required: checked })}
              />
              <div style={{ flex: 1 }}>
                <InputGroup
                  type="Text"
                  label="Default value"
                  inputProps={{
                    value: entry.default,
                    onChange: (value) => onUpdate(name, { default: value }),
                    disabled: entry.required,
                    placeholder: entry.required ? "n/a — required" : "",
                    accessibilityLabel: `Default value for ${name}`,
                  }}
                />
              </div>
            </HStack>
          </Surface>
        );
      })}
    </VStack>
  );
}

export function AgentFormFields({ form }: { form: ReturnType<typeof useAgentForm> }) {
  const agentSettingsSummary = `temp ${form.temperature.toFixed(2)} · timeout ${Math.round(form.timeoutSeconds)}s · max ${Math.round(form.maxOutputTokens)} tok`;

  const variablesSummary =
    form.detected.length === 0
      ? "None detected"
      : form.detected.map((name) => (form.config[name]?.required ?? true ? `${name}*` : name)).join(", ");

  const outputSettingsSummary = `writes → ${form.writes || "(agent name)"} · ${
    form.outputSchemaError ? "Invalid JSON" : form.outputSchemaText.trim() ? "JSON Schema defined" : "Free-form"
  }`;

  return (
    <VStack gap="1.5rem">
      <HStack gap="1rem">
        <div style={{ flex: 1 }}>
          <InputGroup
            type="Text"
            label="Name"
            inputProps={{ value: form.name, onChange: form.setName, accessibilityLabel: "Agent name" }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <VStack gap="0.5rem">
            {/* Matches InputGroup's own label exactly (Typography.Body small, no
                bold) so this row lines up with the Name field beside it. */}
            <Typography.Body small>Model</Typography.Body>
            {form.models.length > 0 && (
              <Select
                label="Model"
                options={form.models.map((m) => ({ value: m, label: m }))}
                value={form.model}
                onChange={(option) => form.setModel(option.value)}
              />
            )}
          </VStack>
        </div>
      </HStack>

      <InputGroup
        type="TextArea"
        label="Prompt"
        inputProps={{
          value: form.prompt,
          placeholder: "Summarize: {topic}",
          rows: 3,
          onChange: form.setPrompt,
          accessibilityLabel: "Prompt",
        }}
      />

      <VStack gap="0.5rem">
        <Accordion.Single title="Agent settings" subtitle={agentSettingsSummary}>
          <VStack gap="1rem">
            <NumericSliderControl
              label="Temperature (randomness)"
              exactLabel="Exact value (0–1)"
              min={0}
              max={1}
              step={0.01}
              decimals={2}
              value={form.temperature}
              onChange={form.setTemperature}
            />

            <NumericSliderControl
              label="Timeout (seconds)"
              exactLabel="Exact seconds"
              min={1}
              max={300}
              step={1}
              value={form.timeoutSeconds}
              onChange={form.setTimeoutSeconds}
            />

            <VStack gap="0.25rem">
              <NumericSliderControl
                label="Max output tokens"
                exactLabel="Exact tokens"
                min={1}
                max={10000}
                step={1}
                value={form.maxOutputTokens}
                onChange={form.setMaxOutputTokens}
              />
              <Typography.Caption>
                Caps how long a real model response can be, so an unexpectedly verbose answer doesn't quietly burn
                through tokens.
              </Typography.Caption>
            </VStack>
          </VStack>
        </Accordion.Single>

        <Accordion.Single title="Variables" subtitle={variablesSummary} initiallyExpanded={form.detected.length > 0}>
          <Typography.Caption>Detected from {"{variable}"} placeholders in the prompt above.</Typography.Caption>
          <div style={{ marginTop: 8 }}>
            <VariableRows detected={form.detected} config={form.config} onUpdate={form.update} />
          </div>
        </Accordion.Single>

        <Accordion.Single title="Output settings" subtitle={outputSettingsSummary}>
          <VStack gap="1rem">
            <InputGroup
              type="Text"
              label="Writes to (shared state key)"
              description="The key this agent's output is saved under for later agents in a workflow. Defaults to the agent's name."
              inputProps={{ value: form.writes, onChange: form.setWrites, accessibilityLabel: "Writes" }}
            />

            <VStack gap="0.5rem">
              <InputGroup
                type="TextArea"
                label="Output format (JSON Schema, optional)"
                description='Leave blank for free-form text output. When set, every real model call is constrained to return valid JSON matching this schema — e.g. {"type":"object","properties":{"summary":{"type":"string"}},"required":["summary"]}'
                inputProps={{
                  value: form.outputSchemaText,
                  placeholder: '{"type":"object","properties":{...},"required":[...]}',
                  rows: 4,
                  onChange: form.setOutputSchemaText,
                  accessibilityLabel: "Output format JSON schema",
                }}
              />
              {form.outputSchemaError && (
                <Typography.Caption colour="errorText">{form.outputSchemaError}</Typography.Caption>
              )}
            </VStack>
          </VStack>
        </Accordion.Single>
      </VStack>
    </VStack>
  );
}
