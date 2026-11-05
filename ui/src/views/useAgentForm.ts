import { useEffect, useState } from "react";
import { api, type Agent, type AgentInput } from "../api";
import { useVariableConfig } from "./agentVariables";

export function useAgentForm(agent?: Agent) {
  const [models, setModels] = useState<string[]>([]);
  const [name, setName] = useState(agent?.name ?? "");
  const [prompt, setPrompt] = useState(agent?.system_prompt_template ?? "");
  const [model, setModel] = useState(agent?.model ?? "");
  const [writes, setWrites] = useState(agent?.writes ?? "");
  const [temperature, setTemperature] = useState(agent?.temperature ?? 0.7);
  const [timeoutSeconds, setTimeoutSeconds] = useState(agent?.timeout_seconds ?? 30);
  const { detected, config, update, variables } = useVariableConfig(prompt, agent?.variables ?? []);

  useEffect(() => {
    api.listModels().then((m) => {
      const names = m.map((model) => model.name);
      setModels(names);
      if (!agent) setModel(names[0] ?? "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = agent
    ? name !== agent.name ||
      prompt !== agent.system_prompt_template ||
      model !== agent.model ||
      (writes || null) !== (agent.writes ?? null) ||
      temperature !== agent.temperature ||
      Math.round(timeoutSeconds) !== agent.timeout_seconds ||
      JSON.stringify(variables) !== JSON.stringify(agent.variables)
    : true;

  function buildPayload(): AgentInput {
    return {
      name,
      system_prompt_template: prompt,
      model,
      temperature,
      timeout_seconds: Math.round(timeoutSeconds),
      variables,
      writes: writes || null,
      visibility: agent?.visibility ?? "personal",
    };
  }

  return {
    models,
    name,
    setName,
    prompt,
    setPrompt,
    model,
    setModel,
    writes,
    setWrites,
    temperature,
    setTemperature,
    timeoutSeconds,
    setTimeoutSeconds,
    detected,
    config,
    update,
    dirty,
    buildPayload,
  };
}
