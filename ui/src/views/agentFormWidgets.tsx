import { Check, InputGroup, Select, Slider, Surface, Typography } from "@oaknorthbank/components";
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
  return (
    <VStack gap="1rem">
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
            <Typography.Body fontWeight="semibold">Model</Typography.Body>
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
        <Typography.Body fontWeight="semibold">Variables (detected from prompt)</Typography.Body>
        <VariableRows detected={form.detected} config={form.config} onUpdate={form.update} />
      </VStack>

      <InputGroup
        type="Text"
        label="Writes to (shared state key)"
        description="The key this agent's output is saved under for later agents in a workflow. Defaults to the agent's name."
        inputProps={{ value: form.writes, onChange: form.setWrites, accessibilityLabel: "Writes" }}
      />
    </VStack>
  );
}
