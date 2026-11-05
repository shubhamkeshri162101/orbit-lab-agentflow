import { Button, IconButton, InputGroup, Label, Surface, Typography } from "@oaknorthbank/components";
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
  const { label, variables = [], writes, missing = [], kind, language } = data as AgentNodeData;

  return (
    <div style={{ minWidth: 220 }}>
      <Surface rounded outlined elevated padding={12}>
        <Handle type="target" position={Position.Left} />
        <VStack gap="0.25rem">
          <Typography.Body fontWeight="semibold">{label}</Typography.Body>
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
  return (
    <VStack gap="1rem">
      <InputGroup
        type="Text"
        label="Name"
        inputProps={{ value: builder.name, onChange: builder.setName, accessibilityLabel: "Workflow name" }}
      />

      <VStack gap="0.5rem">
        <Typography.Body fontWeight="semibold">Start inputs</Typography.Body>
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

      <VStack gap="0.5rem">
        <Typography.Body fontWeight="semibold">Add agent to canvas</Typography.Body>
        <HStack gap="0.5rem" style={{ flexWrap: "wrap" }}>
          {builder.agents.map((a) => (
            <Button.Secondary key={a.id} label={`+ ${a.name}`} onPress={() => builder.addAgentNode(a)} />
          ))}
        </HStack>
      </VStack>

      <VStack gap="0.5rem">
        <Typography.Body fontWeight="semibold">Add tool to canvas</Typography.Body>
        <HStack gap="0.5rem" style={{ flexWrap: "wrap" }}>
          {builder.tools.length === 0 && <Typography.Caption>No tools yet — create one in the Tools tab.</Typography.Caption>}
          {builder.tools.map((t) => (
            <Button.Secondary key={t.id} label={`+ ${t.name}`} onPress={() => builder.addToolNode(t)} />
          ))}
        </HStack>
      </VStack>

      <Surface rounded outlined clipped>
        <div style={{ height: 400 }}>
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
  );
}
