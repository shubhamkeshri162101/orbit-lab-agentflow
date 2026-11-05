import { getCurrentUser } from "./currentUser";

// Override via a .env file (VITE_API_BASE_URL=https://...) for anything
// other than the local dev backend.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8008";

export type Visibility = "personal" | "public";

export type AgentVariable = {
  name: string;
  required: boolean;
  default?: string | null;
};

export type Agent = {
  id: string;
  version: string;
  name: string;
  system_prompt_template: string;
  model: string;
  temperature: number;
  timeout_seconds: number;
  // Caps a real call's max_tokens so an unexpectedly verbose response (and
  // its cost) stays bounded.
  max_output_tokens: number;
  variables: AgentVariable[];
  writes?: string | null;
  // Optional JSON Schema the model's output must conform to. When set, real
  // calls are constrained to return valid JSON matching this shape instead of
  // free-form text.
  output_schema?: Record<string, unknown> | null;
  owner: string;
  visibility: Visibility;
  // Set when this is a personal draft created by "Make personal" on a public
  // agent — the id of the public agent it can be published back onto.
  forked_from?: string | null;
};

export type AgentInput = Omit<Agent, "id" | "version" | "owner">;

export type AgentVersion = Agent & { versioned_at: string };

export type AgentExecution = {
  id: string;
  agent_id: string;
  input: Record<string, string>;
  result: AgentRunResult;
  executed_at: string;
  system_prompt_template: string;
  model: string;
  temperature: number;
  timeout_seconds: number;
  max_output_tokens?: number;
};

export type StartInput = {
  name: string;
  value: string;
};

export type Workflow = {
  id: string;
  version: string;
  name: string;
  agent_ids: string[];
  start_inputs: StartInput[];
  owner: string;
  visibility: Visibility;
  // Set when this is a personal draft created by "Make personal" on a public
  // workflow — the id of the public workflow it can be published back onto.
  forked_from?: string | null;
  // Optional JSON Schema the end node (last step) must conform to.
  output_schema?: Record<string, unknown> | null;
};

export type WorkflowInput = Omit<Workflow, "id" | "version" | "owner">;

export type WorkflowVersion = Workflow & { versioned_at: string };

export type RunResult = {
  output: Record<string, string>;
  trace: Array<{
    agent: string;
    model: string;
    inputs: Record<string, string>;
    output: Record<string, string>;
  }>;
  // Present only when the workflow declares an output_schema — empty when
  // the end node's output matched it.
  output_schema_errors?: string[];
};

export type WorkflowExecution = {
  id: string;
  workflow_id: string;
  input: Record<string, string>;
  result: RunResult;
  executed_at: string;
  workflow_version?: string;
};

export type AgentRunResult = {
  inputs: Record<string, string>;
  output: Record<string, string>;
};

export type ToolLanguage = "python" | "java" | "cpp";
export type ToolSource = "code" | "mcp";

export type Tool = {
  id: string;
  name: string;
  source: ToolSource;
  language?: ToolLanguage | null;
  code?: string | null;
  mcp_server_id?: string | null;
  mcp_tool_name?: string | null;
  description: string;
  variables: AgentVariable[];
  writes?: string | null;
  timeout_seconds: number;
  owner: string;
  visibility: Visibility;
  // Set when this is a personal draft created by "Make personal" on a public
  // tool — the id of the public tool it can be published back onto.
  forked_from?: string | null;
};

export type ToolInput = Omit<Tool, "id" | "owner">;

export type ToolExecution = {
  id: string;
  tool_id: string;
  input: Record<string, string>;
  result: AgentRunResult;
  executed_at: string;
  language: string;
};

export type McpServer = {
  id: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  env_passthrough: string[];
  owner: string;
  visibility: Visibility;
};

export type McpServerInput = Omit<McpServer, "id" | "owner">;

export type DiscoveredMcpTool = {
  name: string;
  description: string;
  input_schema: {
    properties?: Record<string, unknown>;
    required?: string[];
  };
};

export type Provider = "anthropic" | "openai" | "google";

export type ModelInfo = {
  id: string;
  name: string;
  provider: Provider;
  pricing: string;
  use_case: string;
  owner: string;
  visibility: Visibility;
  // Set when this is a personal draft created by "Make personal" on a public
  // model — the id of the public model it can be published back onto.
  forked_from?: string | null;
};

export type ModelInput = Omit<ModelInfo, "id" | "owner">;

// Mirrors PROVIDER_ENV_VARS in src/agents/model_client.py — display-only, so
// keys never pass through the browser or this app's own storage.
export const PROVIDER_ENV_VARS: Record<Provider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_API_KEY",
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", "X-User": getCurrentUser() },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function setVisibility(path: string, visibility: Visibility) {
  return request(path, { method: "PATCH", body: JSON.stringify({ visibility }) });
}

export const api = {
  listModels: () => request<ModelInfo[]>("/models"),
  createModel: (model: ModelInput) => request<ModelInfo>("/models", { method: "POST", body: JSON.stringify(model) }),
  updateModel: (modelId: string, model: ModelInput) =>
    request<ModelInfo>(`/models/${modelId}`, { method: "PUT", body: JSON.stringify(model) }),
  deleteModel: (modelId: string) => request<{ deleted: string }>(`/models/${modelId}`, { method: "DELETE" }),
  setModelVisibility: (modelId: string, visibility: Visibility) =>
    setVisibility(`/models/${modelId}/visibility`, visibility),
  forkModel: (modelId: string) => request<ModelInfo>(`/models/${modelId}/fork`, { method: "POST" }),
  publishModel: (modelId: string) => request<ModelInfo>(`/models/${modelId}/publish`, { method: "POST" }),
  listTools: () => request<Tool[]>("/tools"),
  getTool: (toolId: string) => request<Tool>(`/tools/${toolId}`),
  createTool: (tool: ToolInput) => request<Tool>("/tools", { method: "POST", body: JSON.stringify(tool) }),
  updateTool: (toolId: string, tool: ToolInput) =>
    request<Tool>(`/tools/${toolId}`, { method: "PUT", body: JSON.stringify(tool) }),
  deleteTool: (toolId: string) => request<{ deleted: string }>(`/tools/${toolId}`, { method: "DELETE" }),
  setToolVisibility: (toolId: string, visibility: Visibility) =>
    setVisibility(`/tools/${toolId}/visibility`, visibility),
  forkTool: (toolId: string) => request<Tool>(`/tools/${toolId}/fork`, { method: "POST" }),
  publishTool: (toolId: string) => request<Tool>(`/tools/${toolId}/publish`, { method: "POST" }),
  listToolExecutions: (toolId: string) => request<ToolExecution[]>(`/tools/${toolId}/executions`),
  runTool: (toolId: string, input: Record<string, string>) =>
    request<AgentRunResult>(`/tools/${toolId}/run`, { method: "POST", body: JSON.stringify({ input }) }),
  listMcpServers: () => request<McpServer[]>("/mcp-servers"),
  createMcpServer: (server: McpServerInput) =>
    request<McpServer>("/mcp-servers", { method: "POST", body: JSON.stringify(server) }),
  deleteMcpServer: (serverId: string) => request<{ deleted: string }>(`/mcp-servers/${serverId}`, { method: "DELETE" }),
  setMcpServerVisibility: (serverId: string, visibility: Visibility) =>
    setVisibility(`/mcp-servers/${serverId}/visibility`, visibility),
  discoverMcpTools: (serverId: string) => request<DiscoveredMcpTool[]>(`/mcp-servers/${serverId}/tools`),
  importMcpTool: (serverId: string, tool: DiscoveredMcpTool) =>
    request<Tool>(`/mcp-servers/${serverId}/import`, { method: "POST", body: JSON.stringify(tool) }),
  listAgents: () => request<Agent[]>("/agents"),
  getAgent: (agentId: string) => request<Agent>(`/agents/${agentId}`),
  createAgent: (agent: AgentInput) =>
    request<Agent>("/agents", { method: "POST", body: JSON.stringify(agent) }),
  updateAgent: (agentId: string, agent: AgentInput) =>
    request<Agent>(`/agents/${agentId}`, { method: "PUT", body: JSON.stringify(agent) }),
  overwriteAgent: (agentId: string, agent: AgentInput) =>
    request<Agent>(`/agents/${agentId}/overwrite`, { method: "PUT", body: JSON.stringify(agent) }),
  deleteAgent: (agentId: string) => request<{ deleted: string }>(`/agents/${agentId}`, { method: "DELETE" }),
  setAgentVisibility: (agentId: string, visibility: Visibility) =>
    setVisibility(`/agents/${agentId}/visibility`, visibility),
  forkAgent: (agentId: string) => request<Agent>(`/agents/${agentId}/fork`, { method: "POST" }),
  publishAgent: (agentId: string, versionId?: string) =>
    request<Agent>(`/agents/${agentId}/publish${versionId ? `?version_id=${versionId}` : ""}`, { method: "POST" }),
  cloneAgent: (agentId: string, versionId?: string) =>
    request<Agent>(`/agents/${agentId}/clone${versionId ? `?version_id=${versionId}` : ""}`, { method: "POST" }),
  listAgentVersions: (agentId: string) => request<AgentVersion[]>(`/agents/${agentId}/versions`),
  restoreAgentVersion: (agentId: string, versionId: string) =>
    request<Agent>(`/agents/${agentId}/versions/${versionId}/restore`, { method: "POST" }),
  listAgentExecutions: (agentId: string) => request<AgentExecution[]>(`/agents/${agentId}/executions`),
  listWorkflows: () => request<Workflow[]>("/workflows"),
  getWorkflow: (workflowId: string) => request<Workflow>(`/workflows/${workflowId}`),
  createWorkflow: (workflow: WorkflowInput) =>
    request<Workflow>("/workflows", { method: "POST", body: JSON.stringify(workflow) }),
  updateWorkflow: (workflowId: string, workflow: WorkflowInput) =>
    request<Workflow>(`/workflows/${workflowId}`, { method: "PUT", body: JSON.stringify(workflow) }),
  overwriteWorkflow: (workflowId: string, workflow: WorkflowInput) =>
    request<Workflow>(`/workflows/${workflowId}/overwrite`, { method: "PUT", body: JSON.stringify(workflow) }),
  deleteWorkflow: (workflowId: string) =>
    request<{ deleted: string }>(`/workflows/${workflowId}`, { method: "DELETE" }),
  setWorkflowVisibility: (workflowId: string, visibility: Visibility) =>
    setVisibility(`/workflows/${workflowId}/visibility`, visibility),
  cloneWorkflow: (workflowId: string, versionId?: string) =>
    request<Workflow>(`/workflows/${workflowId}/clone${versionId ? `?version_id=${versionId}` : ""}`, {
      method: "POST",
    }),
  forkWorkflow: (workflowId: string) => request<Workflow>(`/workflows/${workflowId}/fork`, { method: "POST" }),
  publishWorkflow: (workflowId: string, versionId?: string) =>
    request<Workflow>(`/workflows/${workflowId}/publish${versionId ? `?version_id=${versionId}` : ""}`, {
      method: "POST",
    }),
  listWorkflowVersions: (workflowId: string) =>
    request<WorkflowVersion[]>(`/workflows/${workflowId}/versions`),
  restoreWorkflowVersion: (workflowId: string, versionId: string) =>
    request<Workflow>(`/workflows/${workflowId}/versions/${versionId}/restore`, { method: "POST" }),
  listWorkflowExecutions: (workflowId: string) =>
    request<WorkflowExecution[]>(`/workflows/${workflowId}/executions`),
  runWorkflow: (workflowId: string, input: Record<string, string>) =>
    request<RunResult>(`/workflows/${workflowId}/run`, {
      method: "POST",
      body: JSON.stringify({ input }),
    }),
  runAgent: (agentId: string, input: Record<string, string>) =>
    request<AgentRunResult>(`/agents/${agentId}/run`, {
      method: "POST",
      body: JSON.stringify({ input }),
    }),
};
