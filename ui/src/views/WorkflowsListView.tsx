import { Alert, Button, IconButton, Surface, Typography } from "@oaknorthbank/components";
import IconTrash from "@oaknorthbank/graphics/icons/IconTrash";
import { useEffect, useState } from "react";
import { HStack, VStack } from "../components/Stacks";
import { VisibilityBadge, VisibilityToggleButton } from "../components/VisibilityControl";
import { api, type Agent, type Tool, type Workflow } from "../api";

function WorkflowCard({
  workflow,
  agents,
  tools,
  onOpen,
  onDeleted,
  onChanged,
}: {
  workflow: Workflow;
  agents: Agent[];
  tools: Tool[];
  onOpen: (workflow: Workflow) => void;
  onDeleted: () => void;
  onChanged: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const nameOf = (id: string) => agents.find((a) => a.id === id)?.name ?? tools.find((t) => t.id === id)?.name ?? id;

  async function handleDelete() {
    setDeleteError("");
    try {
      await api.deleteWorkflow(workflow.id);
      onDeleted();
    } catch (e) {
      setDeleteError(String(e));
    }
  }

  return (
    <Surface rounded elevated flex padding={16}>
      <VStack gap="0.75rem" style={{ height: "100%" }}>
        <HStack justifyContent="space-between" alignItems="flex-start">
          <HStack gap="0.5rem" alignItems="center">
            <Typography.Body fontWeight="semibold">{workflow.name}</Typography.Body>
            <VisibilityBadge visibility={workflow.visibility} />
          </HStack>
          {deleting ? (
            <Button.Primary label="Confirm delete" destructive onPress={handleDelete} />
          ) : (
            <IconButton.Outlined
              icon={IconTrash}
              label="Delete workflow"
              destructive
              onPress={() => setDeleting(true)}
            />
          )}
        </HStack>

        <VStack gap="0.15rem">
          <Typography.Caption>Version: {workflow.version}</Typography.Caption>
          <Typography.Caption>
            {workflow.agent_ids.length ? workflow.agent_ids.map(nameOf).join(" → ") : "no agents"}
          </Typography.Caption>
        </VStack>

        {deleteError && <Alert level="error" title={deleteError} />}

        <HStack gap="0.5rem" alignItems="center" style={{ marginTop: "auto" }}>
          <Button.Secondary label="Open" onPress={() => onOpen(workflow)} />
          <VisibilityToggleButton
            visibility={workflow.visibility}
            onToggle={async (next) => {
              await api.setWorkflowVisibility(workflow.id, next);
              onChanged();
            }}
          />
        </HStack>
      </VStack>
    </Surface>
  );
}

export function WorkflowsListView({
  onCreate,
  onOpen,
}: {
  onCreate: () => void;
  onOpen: (workflow: Workflow) => void;
}) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);

  async function refresh() {
    setWorkflows(await api.listWorkflows());
  }

  useEffect(() => {
    refresh();
    api.listAgents().then(setAgents);
    api.listTools().then(setTools);
  }, []);

  return (
    <VStack gap="1.5rem">
      <HStack justifyContent="space-between" alignItems="center">
        <Typography.Heading level={3}>Workflows ({workflows.length})</Typography.Heading>
        <Button.Primary label="+ New workflow" onPress={onCreate} />
      </HStack>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "1rem",
          alignItems: "stretch",
        }}
      >
        {workflows.map((w) => (
          <WorkflowCard
            key={w.id}
            workflow={w}
            agents={agents}
            tools={tools}
            onOpen={onOpen}
            onDeleted={refresh}
            onChanged={refresh}
          />
        ))}
      </div>
    </VStack>
  );
}
