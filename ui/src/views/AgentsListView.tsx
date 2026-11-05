import { Button, IconButton, Surface, Typography } from "@oaknorthbank/components";
import IconTrash from "@oaknorthbank/graphics/icons/IconTrash";
import { useEffect, useState } from "react";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { HStack, VStack } from "../components/Stacks";
import { VersionPickerModal } from "../components/VersionPickerModal";
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
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  async function handleDelete() {
    setDeleteError("");
    setDeleting(true);
    try {
      await api.deleteAgent(agent.id);
      setConfirming(false);
      onDeleted();
    } catch (e) {
      setDeleteError(String(e));
    } finally {
      setDeleting(false);
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
          <IconButton.Outlined
            icon={IconTrash}
            label={agent.visibility === "public" ? "Make personal to delete" : "Delete agent"}
            destructive
            disabled={agent.visibility === "public"}
            onPress={() => {
              setDeleteError("");
              setConfirming(true);
            }}
          />
        </HStack>

        <VStack gap="0.15rem">
          <Typography.Caption>Version: {agent.version}</Typography.Caption>
          <Typography.Caption>Model: {agent.model}</Typography.Caption>
          <Typography.Caption>Temperature: {agent.temperature.toFixed(2)}</Typography.Caption>
          <Typography.Caption>Timeout: {agent.timeout_seconds}s</Typography.Caption>
        </VStack>

        <DeleteConfirmModal
          isOpen={confirming}
          onClose={() => setConfirming(false)}
          onConfirm={handleDelete}
          kind="agent"
          name={agent.name}
          version={agent.version}
          deleting={deleting}
          error={deleteError}
        />

        <HStack gap="0.5rem" alignItems="center" style={{ marginTop: "auto" }}>
          <Button.Secondary label="Open" onPress={() => onOpen(agent)} />
          <VisibilityToggleButton
            visibility={agent.visibility}
            onToggle={async (next) => {
              if (next === "personal") {
                // Never edit the public agent in place -- fork a personal
                // draft the user can safely change, then jump straight to it.
                onOpen(await api.forkAgent(agent.id));
                return;
              }
              if (agent.forked_from) {
                // Ask which version of the draft to publish before merging it.
                setPublishModalOpen(true);
                return;
              }
              await api.setAgentVisibility(agent.id, next);
              onChanged();
            }}
          />
        </HStack>

        <VersionPickerModal
          isOpen={publishModalOpen}
          onClose={() => setPublishModalOpen(false)}
          onConfirm={async (versionId) => {
            await api.publishAgent(agent.id, versionId);
            setPublishModalOpen(false);
            onChanged();
          }}
          action="publish"
          kind="agent"
          name={agent.name}
          currentVersion={agent.version}
          loadVersions={() => api.listAgentVersions(agent.id)}
        />
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
