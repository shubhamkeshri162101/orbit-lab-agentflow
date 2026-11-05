import { Button, Surface, Typography } from "@oaknorthbank/components";
import { useEffect, useState } from "react";
import { HStack, VStack } from "../components/Stacks";
import { VisibilityControl } from "../components/VisibilityControl";
import { api, type Agent } from "../api";
import { AgentExecutionHistoryPanel, AgentVersionSelector, TestAgentPanel } from "./agentPanels";
import { AgentFormFields } from "./agentFormWidgets";
import { useAgentForm } from "./useAgentForm";

const SIDE_PANEL_WIDTH = 380;

function AgentEditSection({ agent, onSaved }: { agent: Agent; onSaved: () => void }) {
  const form = useAgentForm(agent);
  const [saving, setSaving] = useState<"update" | "new-version" | null>(null);
  const invalid = !form.name || !form.prompt || !form.model || !!form.outputSchemaError;

  async function handleUpdate() {
    setSaving("update");
    try {
      await api.overwriteAgent(agent.id, form.buildPayload());
      onSaved();
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveNewVersion() {
    setSaving("new-version");
    try {
      await api.updateAgent(agent.id, form.buildPayload());
      onSaved();
    } finally {
      setSaving(null);
    }
  }

  return (
    <VStack gap="1rem">
      <AgentFormFields form={form} />
      {form.dirty && (
        <HStack justifyContent="flex-end" gap="0.5rem">
          <Button.Secondary
            label={saving === "update" ? "Updating…" : `Update v${agent.version}`}
            onPress={handleUpdate}
            disabled={saving !== null || invalid}
          />
          <Button.Primary
            label={saving === "new-version" ? "Saving…" : "Save (new version)"}
            onPress={handleSaveNewVersion}
            disabled={saving !== null || invalid}
          />
        </HStack>
      )}
    </VStack>
  );
}

export function AgentDetailView({
  agentId,
  onBack,
  onCloned,
}: {
  agentId: string;
  onBack: () => void;
  onCloned: (agent: Agent) => void;
}) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [cloning, setCloning] = useState(false);
  const [executionRefreshToken, setExecutionRefreshToken] = useState(0);

  function refresh() {
    api.getAgent(agentId).then(setAgent);
  }

  useEffect(refresh, [agentId]);

  async function handleClone() {
    setCloning(true);
    try {
      onCloned(await api.cloneAgent(agentId));
    } finally {
      setCloning(false);
    }
  }

  if (agent === null) {
    return <Typography.Caption>Loading agent…</Typography.Caption>;
  }

  return (
    <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Surface rounded elevated padding={24}>
          <VStack gap="1rem">
            <HStack justifyContent="space-between" alignItems="center">
              <HStack gap="0.75rem" alignItems="center">
                <Typography.Heading level={3}>{agent.name}</Typography.Heading>
                <VisibilityControl
                  visibility={agent.visibility}
                  onToggle={async (next) => {
                    if (next === "personal") {
                      // Never edit the public agent in place -- fork a
                      // personal draft and jump to editing that instead.
                      onCloned(await api.forkAgent(agent.id));
                      return;
                    }
                    if (agent.forked_from) {
                      // Publishing deletes this draft and updates the
                      // original by id, so follow navigation there.
                      onCloned(await api.publishAgent(agent.id));
                      return;
                    }
                    await api.setAgentVisibility(agent.id, next);
                    refresh();
                  }}
                />
              </HStack>
              <HStack gap="0.5rem" alignItems="center">
                <AgentVersionSelector agent={agent} onRestored={refresh} />
                <Button.Secondary label={cloning ? "Cloning…" : "Clone"} onPress={handleClone} disabled={cloning} />
                <Button.Flat label="Back" onPress={onBack} />
              </HStack>
            </HStack>

            {agent.forked_from && (
              <Typography.Caption>
                Personal draft — your changes here are independent of the public agent until you hit "Publish".
              </Typography.Caption>
            )}

            <AgentEditSection key={`${agent.id}-${agent.version}`} agent={agent} onSaved={refresh} />
          </VStack>
        </Surface>
      </div>

      <div style={{ width: SIDE_PANEL_WIDTH, flexShrink: 0, position: "sticky", top: 0 }}>
        <VStack gap="1.5rem">
          <Surface rounded elevated padding={24}>
            <VStack gap="1rem">
              <Typography.Heading level={4}>Test this agent</Typography.Heading>
              <TestAgentPanel
                agent={agent}
                onRan={() => {
                  refresh();
                  setExecutionRefreshToken((t) => t + 1);
                }}
              />
            </VStack>
          </Surface>

          <Surface rounded elevated padding={24}>
            <VStack gap="1rem">
              <Typography.Heading level={4}>Execution history</Typography.Heading>
              <div style={{ maxHeight: 520, overflowY: "auto" }}>
                <AgentExecutionHistoryPanel agentId={agent.id} refreshToken={executionRefreshToken} />
              </div>
            </VStack>
          </Surface>
        </VStack>
      </div>
    </div>
  );
}
