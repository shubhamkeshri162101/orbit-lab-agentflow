import { Alert, Button, IconButton, Surface, Typography } from "@oaknorthbank/components";
import IconTrash from "@oaknorthbank/graphics/icons/IconTrash";
import { useEffect, useState } from "react";
import { HStack, VStack } from "../components/Stacks";
import { VisibilityBadge, VisibilityToggleButton } from "../components/VisibilityControl";
import { api, type Agent } from "../api";

function AgentCard({
  agent,
  onOpen,
  onDeleted,
  onChanged,
}: {
  agent: Agent;
  onOpen: (agent: Agent) => void;
  onDeleted: () => void;
  onChanged: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleDelete() {
    setDeleteError("");
    try {
      await api.deleteAgent(agent.id);
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
            <Typography.Body fontWeight="semibold">{agent.name}</Typography.Body>
            <VisibilityBadge visibility={agent.visibility} />
          </HStack>
          {deleting ? (
            <Button.Primary label="Confirm delete" destructive onPress={handleDelete} />
          ) : (
            <IconButton.Outlined
              icon={IconTrash}
              label="Delete agent"
              destructive
              onPress={() => setDeleting(true)}
            />
          )}
        </HStack>

        <VStack gap="0.15rem">
          <Typography.Caption>Version: {agent.version}</Typography.Caption>
          <Typography.Caption>Model: {agent.model}</Typography.Caption>
          <Typography.Caption>Temperature: {agent.temperature.toFixed(2)}</Typography.Caption>
          <Typography.Caption>Timeout: {agent.timeout_seconds}s</Typography.Caption>
        </VStack>

        {deleteError && <Alert level="error" title={deleteError} />}

        <HStack gap="0.5rem" alignItems="center" style={{ marginTop: "auto" }}>
          <Button.Secondary label="Open" onPress={() => onOpen(agent)} />
          <VisibilityToggleButton
            visibility={agent.visibility}
            onToggle={async (next) => {
              await api.setAgentVisibility(agent.id, next);
              onChanged();
            }}
          />
        </HStack>
      </VStack>
    </Surface>
  );
}

export function AgentsListView({
  onCreate,
  onOpen,
}: {
  onCreate: () => void;
  onOpen: (agent: Agent) => void;
}) {
  const [agents, setAgents] = useState<Agent[]>([]);

  async function refresh() {
    setAgents(await api.listAgents());
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <VStack gap="1.5rem">
      <HStack justifyContent="space-between" alignItems="center">
        <Typography.Heading level={3}>Agents ({agents.length})</Typography.Heading>
        <Button.Primary label="+ Create agent" onPress={onCreate} />
      </HStack>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "1rem",
          alignItems: "stretch",
        }}
      >
        {agents.map((a) => (
          <AgentCard key={a.id} agent={a} onOpen={onOpen} onDeleted={refresh} onChanged={refresh} />
        ))}
      </div>
    </VStack>
  );
}
