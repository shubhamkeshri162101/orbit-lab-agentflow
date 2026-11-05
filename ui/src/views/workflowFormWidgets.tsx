import { Accordion, Button, Divider, IconButton, InputGroup, Label, Select, Surface, Typography } from "@oaknorthbank/components";
import IconTrash from "@oaknorthbank/graphics/icons/IconTrash";
import { Background, Controls, Handle, Position, ReactFlow, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { HStack, VStack } from "../components/Stacks";
import type { AgentVariable, StartInput } from "../api";
import type { useWorkflowBuilder } from "./useWorkflowBuilder";

type AgentNodeData = {
  label: string;
  variables?: AgentVariable[];
  writes?: string;
  missing?: string[];
  kind?: "agent" | "tool";
  language?: string;
  version?: string;
};

type StartNodeData = {
  label: string;
  startInputs?: StartInput[];
};

// Shows the inputs this workflow starts with directly on the canvas — the
// same values a run request should supply — so they're visible alongside
// what each downstream agent needs, not just in a form off to the side.
function StartNode({ data }: NodeProps) {
  const { label, startInputs = [] } = data as StartNodeData;

  return (
    <div style={{ minWidth: 190 }}>
      <Surface rounded outlined elevated padding={12}>
        <VStack gap="0.25rem">
          <Typography.Body fontWeight="semibold">{label}</Typography.Body>
          {startInputs.length > 0 ? (
            <Typography.Caption>
              provides: {startInputs.map((si) => (si.value ? `${si.name}=${si.value}` : si.name)).join(", ")}
            </Typography.Caption>
          ) : (
            <Typography.Caption>no inputs declared</Typography.Caption>
          )}
        </VStack>
        <Handle type="source" position={Position.Right} />
      </Surface>
    </div>
  );
}

// Shows each agent's required inputs and its writes-key directly on the
// canvas, so a mismatch (an input no earlier node actually produces) is
// visible before anyone runs the workflow, not just after a run fails.
function AgentNode({ data }: NodeProps) {
  const { label, variables = [], writes, missing = [], kind, language, version } = data as AgentNodeData;

  return (
    <div style={{ minWidth: 220 }}>
      <Surface rounded outlined elevated padding={12}>
        <Handle type="target" position={Position.Left} />
        <VStack gap="0.25rem">
          <HStack gap="0.4rem" alignItems="center">
            <Typography.Body fontWeight="semibold">{label}</Typography.Body>
            {version && <Typography.Caption>v{version}</Typography.Caption>}
          </HStack>
          {kind === "tool" && <Typography.Caption>{language} tool</Typography.Caption>}
          {variables.length > 0 && (
            <Typography.Caption>
              needs: {variables.map((v) => (v.required ? `${v.name}*` : v.name)).join(", ")}
            </Typography.Caption>
          )}
          {writes && <Typography.Caption>writes → {writes}</Typography.Caption>}
          {missing.length > 0 && <Label.Status label={`missing: ${missing.join(", ")}`} type="error" />}
        </VStack>
        <Handle type="source" position={Position.Right} />
      </Surface>
    </div>
  );
}

const nodeTypes = { agentNode: AgentNode, startNode: StartNode };

export function WorkflowBuilderFields({ builder }: { builder: ReturnType<typeof useWorkflowBuilder> }) {
  const onCanvas = new Set(builder.nodes.map((n) => n.id));
  // Newest first — listAgents()/listTools() return insertion order, so
  // reversing surfaces the latest ones at the top of the dropdown before
  // anyone starts typing a search.
  const addableAgents = [...builder.agents].reverse().filter((a) => !onCanvas.has(a.id));
  const addableTools = [...builder.tools].reverse().filter((t) => !onCanvas.has(t.id));

  const startInputsSummary =
    builder.startInputs.length === 0
      ? "None set"
      : builder.startInputs.map((si) => si.name).filter(Boolean).join(", ") || "None set";

  const outputSchemaSummary = builder.outputSchemaError
    ? "Invalid JSON"
    : builder.outputSchemaText.trim()
      ? "JSON Schema defined"
      : "Free-form (not set)";

  return (
    <VStack gap="1.5rem">
      <InputGroup
        type="Text"
        label="Name"
        inputProps={{ value: builder.name, onChange: builder.setName, accessibilityLabel: "Workflow name" }}
      />

      <VStack gap="0.5rem">
        <Accordion.Single title="Start inputs" subtitle={startInputsSummary} initiallyExpanded={builder.startInputs.length > 0}>
          <VStack gap="0.75rem">
            <Typography.Caption>
              Embed the input keys (and optional sample values) this workflow starts with — they show on the Start
              node and prefill "Run this workflow".
            </Typography.Caption>
            {builder.startInputs.map((si, i) => (
              <HStack key={i} gap="0.5rem" alignItems="center">
                <div style={{ width: 240 }}>
                  <InputGroup
                    type="Text"
                    label="Key"
                    inputProps={{
                      value: si.name,
                      onChange: (v) => builder.updateStartInput(i, "name", v),
                      accessibilityLabel: "Start input key",
                    }}
                  />
                </div>
                <div style={{ width: 240 }}>
                  <InputGroup
                    type="Text"
                    label="Value (optional)"
                    inputProps={{
                      value: si.value,
                      onChange: (v) => builder.updateStartInput(i, "value", v),
                      accessibilityLabel: "Start input value",
                    }}
                  />
                </div>
                <IconButton.Outlined
                  icon={IconTrash}
                  label="Remove start input"
                  destructive
                  onPress={() => builder.removeStartInput(i)}
                />
              </HStack>
            ))}
            <div>
              <Button.Secondary label="+ Add start input" onPress={builder.addStartInput} />
            </div>
          </VStack>
        </Accordion.Single>

        <Accordion.Single
          title="Output format"
          subtitle={outputSchemaSummary}
          initiallyExpanded={builder.outputSchemaText.trim().length > 0}
        >
          <VStack gap="0.5rem">
            <InputGroup
              type="TextArea"
              label="Output format (JSON Schema, optional)"
              description={
                'Leave blank for free-form output. When set, the end node (the last step before End) is constrained ' +
                'to return JSON matching this schema if it doesn\'t already declare its own — e.g. ' +
                '{"type":"object","properties":{"summary":{"type":"string"}},"required":["summary"]}'
              }
              inputProps={{
                value: builder.outputSchemaText,
                placeholder: '{"type":"object","properties":{...},"required":[...]}',
                rows: 4,
                onChange: builder.setOutputSchemaText,
                accessibilityLabel: "Workflow output format JSON schema",
              }}
            />
            {builder.outputSchemaError && (
              <Typography.Caption colour="errorText">{builder.outputSchemaError}</Typography.Caption>
            )}
          </VStack>
        </Accordion.Single>
      </VStack>

      <Divider space={0} />

      <VStack gap="0.75rem">
        <Typography.Body fontWeight="semibold">Canvas</Typography.Body>
        <HStack gap="1rem" style={{ flexWrap: "wrap" }}>
          <div style={{ width: 280 }}>
            <Select
              label="Add agent to canvas"
              labelHardOverride="+ Add agent"
              searchable
              dropdownWidth={320}
              disabled={addableAgents.length === 0}
              options={addableAgents.map((a) => ({ value: a.id, label: a.name, helper: `v${a.version}` }))}
              onChange={(option) => {
                const agent = builder.agents.find((a) => a.id === option.value);
                if (agent) builder.addAgentNode(agent);
              }}
            />
            {addableAgents.length === 0 && (
              <Typography.Caption>
                {builder.agents.length === 0 ? "No agents yet — create one in the Agents tab." : "All agents are on the canvas."}
              </Typography.Caption>
            )}
          </div>

          <div style={{ width: 280 }}>
            <Select
              label="Add tool to canvas"
              labelHardOverride="+ Add tool"
              searchable
              dropdownWidth={320}
              disabled={addableTools.length === 0}
              options={addableTools.map((t) => ({ value: t.id, label: t.name }))}
              onChange={(option) => {
                const tool = builder.tools.find((t) => t.id === option.value);
                if (tool) builder.addToolNode(tool);
              }}
            />
            {addableTools.length === 0 && (
              <Typography.Caption>
                {builder.tools.length === 0 ? "No tools yet — create one in the Tools tab." : "All tools are on the canvas."}
              </Typography.Caption>
            )}
          </div>
        </HStack>

        <Surface rounded outlined clipped>
          <div style={{ height: 440 }}>
            <ReactFlow
              nodes={builder.nodes}
              edges={builder.edges}
              onNodesChange={builder.onNodesChange}
              onEdgesChange={builder.onEdgesChange}
              onConnect={builder.onConnect}
              nodeTypes={nodeTypes}
              fitView
            >
              <Background />
              <Controls />
            </ReactFlow>
          </div>
        </Surface>
      </VStack>
    </VStack>
  );
}
