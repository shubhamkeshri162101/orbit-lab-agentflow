import { useMemo, useState } from "react";
import type { AgentVariable } from "../api";

export function extractVariableNames(template: string): string[] {
  const names = Array.from(template.matchAll(/\{(\w+)\}/g), (m) => m[1]);
  return Array.from(new Set(names));
}

export type VariableConfig = Record<string, { required: boolean; default: string }>;

export function useVariableConfig(prompt: string, initialVariables: AgentVariable[] = []) {
  const detected = useMemo(() => extractVariableNames(prompt), [prompt]);
  const [config, setConfig] = useState<VariableConfig>(() =>
    Object.fromEntries(
      initialVariables.map((v) => [v.name, { required: v.required, default: v.default ?? "" }])
    )
  );

  function update(name: string, patch: Partial<{ required: boolean; default: string }>) {
    setConfig((prev) => {
      const current = prev[name] ?? { required: true, default: "" };
      return { ...prev, [name]: { ...current, ...patch } };
    });
  }

  function reset() {
    setConfig({});
  }

  const variables: AgentVariable[] = detected.map((name) => {
    const entry = config[name] ?? { required: true, default: "" };
    return { name, required: entry.required, default: entry.default || null };
  });

  return { detected, config, update, reset, variables };
}
