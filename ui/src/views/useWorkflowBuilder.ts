import {
  addEdge,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  Position,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type Agent, type StartInput, type Tool, type Workflow } from "../api";

export const START_ID = "__start__";
export const END_ID = "__end__";

// Nodes lay out left-to-right, so connect on the left/right sides rather
// than React Flow's default top/bottom handles.
const HORIZONTAL_HANDLES = { sourcePosition: Position.Right, targetPosition: Position.Left };

// A workflow step is either an agent (LLM call) or a tool (user code) — both
// share the same requires/writes shape, which is all the graph needs to know.
type Step = (Agent | Tool) & { kind: "agent" | "tool" };

// Matches run_agent.py / run_tool.py: a step writes its output under `writes`,
// or its own name if `writes` is unset — this is what downstream steps' variables match by name.
function writesKeyOf(step: { name: string; writes?: string | null }): string {
  return step.writes || step.name;
}

function findStep(id: string, agents: Agent[], tools: Tool[]): Step | undefined {
  const agent = agents.find((a) => a.id === id);
  if (agent) return { ...agent, kind: "agent" };
  const tool = tools.find((t) => t.id === id);
  if (tool) return { ...tool, kind: "tool" };
  return undefined;
}

function stepNodeData(step: Step) {
  const tool = step.kind === "tool" ? (step as Tool) : undefined;
  return {
    label: step.name,
    variables: step.variables,
    writes: writesKeyOf(step),
    kind: step.kind,
    language: tool ? (tool.source === "mcp" ? "mcp" : tool.language) : undefined,
  };
}

function startNode(startInputs: StartInput[]): Node {
  return {
    id: START_ID,
    position: { x: 0, y: 150 },
    data: { label: "Start", startInputs },
    type: "startNode",
    ...HORIZONTAL_HANDLES,
  };
}

const emptyNodes: Node[] = [
  startNode([]),
  { id: END_ID, position: { x: 600, y: 150 }, data: { label: "End" }, type: "output", ...HORIZONTAL_HANDLES },
];

/**
 * Derives the execution order by walking edges from Start to End.
 * Graph data model (nodes/edges) already supports branching for later —
 * today we validate it's a single path, since the backend only runs a
 * linear chain. This is the enforced scope boundary, not a data-model one.
 */
export function deriveLinearOrder(nodes: Node[], edges: Edge[]): string[] | { error: string } {
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  }

  const order: string[] = [];
  let current = START_ID;
  const visited = new Set<string>();

  while (current !== END_ID) {
    if (visited.has(current)) return { error: "Cycle detected in the graph." };
    visited.add(current);

    const next = outgoing.get(current) ?? [];
    if (next.length === 0) return { error: `"${nodeLabel(nodes, current)}" is not connected to End.` };
    if (next.length > 1) {
      return { error: "Branching isn't supported yet — each node can only connect to one next step." };
    }

    current = next[0];
    if (current !== END_ID) order.push(current);
  }

  if (order.length === 0) return { error: "Connect Start to at least one agent, then to End." };
  return order;
}

export function nodeLabel(nodes: Node[], id: string): string {
  return (nodes.find((n) => n.id === id)?.data.label as string) ?? id;
}

function buildGraphFromWorkflow(
  workflow: Workflow,
  agents: Agent[],
  tools: Tool[]
): { nodes: Node[]; edges: Edge[] } {
  const chain = workflow.agent_ids;

  const nodes: Node[] = [
    startNode(workflow.start_inputs ?? []),
    ...chain.map((id, i) => {
      const step = findStep(id, agents, tools);
      return {
        id,
        position: { x: 280 + i * 260, y: 150 },
        data: step ? stepNodeData(step) : { label: id },
        type: "agentNode" as const,
        ...HORIZONTAL_HANDLES,
      };
    }),
    {
      id: END_ID,
      position: { x: 280 + chain.length * 260, y: 150 },
      data: { label: "End" },
      type: "output",
      ...HORIZONTAL_HANDLES,
    },
  ];

  const edges: Edge[] = [];
  let prev = START_ID;
  for (const id of chain) {
    edges.push({ id: `${prev}-${id}`, source: prev, target: id });
    prev = id;
  }
  edges.push({ id: `${prev}-${END_ID}`, source: prev, target: END_ID });

  return { nodes, edges };
}

export function useWorkflowBuilder(workflow?: Workflow) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [agentsLoaded, setAgentsLoaded] = useState(false);
  const [toolsLoaded, setToolsLoaded] = useState(false);
  const [nodes, setNodes, onNodesChangeRaw] = useNodesState(emptyNodes);
  const [edges, setEdges, onEdgesChangeRaw] = useEdgesState<Edge>([]);
  const [name, setNameRaw] = useState(workflow?.name ?? "");
  const [startInputs, setStartInputsRaw] = useState<StartInput[]>(workflow?.start_inputs ?? []);
  const [dirty, setDirty] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    api.listAgents().then((a) => {
      setAgents(a);
      setAgentsLoaded(true);
    });
    api.listTools().then((t) => {
      setTools(t);
      setToolsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!workflow || !agentsLoaded || !toolsLoaded || initialized.current) return;
    initialized.current = true;
    const { nodes: builtNodes, edges: builtEdges } = buildGraphFromWorkflow(workflow, agents, tools);
    setNodes(builtNodes);
    setEdges(builtEdges);
  }, [workflow, agents, tools, agentsLoaded, toolsLoaded, setNodes, setEdges]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChangeRaw(changes);
      // React Flow fires "dimensions" changes automatically when nodes first
      // measure themselves on mount — that's not a user edit.
      if (changes.some((c) => c.type !== "dimensions")) setDirty(true);
    },
    [onNodesChangeRaw]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChangeRaw(changes);
      if (changes.some((c) => c.type !== "select")) setDirty(true);
    },
    [onEdgesChangeRaw]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
      setDirty(true);
    },
    [setEdges]
  );

  function setName(value: string) {
    setNameRaw(value);
    setDirty(true);
  }

  function setStartInputs(update: (current: StartInput[]) => StartInput[]) {
    setStartInputsRaw(update);
    setDirty(true);
  }

  function addStartInput() {
    setStartInputs((current) => [...current, { name: "", value: "" }]);
  }

  function updateStartInput(index: number, field: "name" | "value", value: string) {
    setStartInputs((current) => current.map((si, i) => (i === index ? { ...si, [field]: value } : si)));
  }

  function removeStartInput(index: number) {
    setStartInputs((current) => current.filter((_, i) => i !== index));
  }

  function addStepNode(step: Step) {
    if (nodes.some((n) => n.id === step.id)) return;
    setNodes((nds) => [
      ...nds,
      {
        id: step.id,
        position: { x: 280, y: 50 + nds.length * 110 },
        data: stepNodeData(step),
        type: "agentNode",
        ...HORIZONTAL_HANDLES,
      },
    ]);
    setDirty(true);
  }

  function addAgentNode(agent: Agent) {
    addStepNode({ ...agent, kind: "agent" });
  }

  function addToolNode(tool: Tool) {
    addStepNode({ ...tool, kind: "tool" });
  }

  function buildOrder(): string[] | { error: string } {
    return deriveLinearOrder(nodes, edges);
  }

  // Walks the chain (when it's a valid single path) and flags, per step node,
  // any required input name no earlier step's `writes` key (or Start's own
  // declared inputs) actually produces.
  const missingByNode = useMemo(() => {
    const order = deriveLinearOrder(nodes, edges);
    const missing: Record<string, string[]> = {};
    if ("error" in order) return missing;

    const producedSoFar = new Set(startInputs.map((si) => si.name));
    order.forEach((id) => {
      const step = findStep(id, agents, tools);
      if (!step) return;
      const need = (step.variables ?? [])
        .filter((v) => v.required && !producedSoFar.has(v.name))
        .map((v) => v.name);
      if (need.length > 0) missing[id] = need;
      producedSoFar.add(writesKeyOf(step));
    });
    return missing;
  }, [nodes, edges, agents, tools, startInputs]);

  const displayNodes = useMemo(
    () =>
      nodes.map((n) => {
        if (n.id === START_ID) return { ...n, data: { ...n.data, startInputs } };
        if (n.type === "agentNode" && missingByNode[n.id]) {
          return { ...n, data: { ...n.data, missing: missingByNode[n.id] } };
        }
        return n;
      }),
    [nodes, missingByNode, startInputs]
  );

  return {
    agents,
    tools,
    nodes: displayNodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addAgentNode,
    addToolNode,
    name,
    setName,
    startInputs,
    addStartInput,
    updateStartInput,
    removeStartInput,
    dirty,
    buildOrder,
  };
}
