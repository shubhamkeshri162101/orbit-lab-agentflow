import { Button, Surface, Typography } from "@oaknorthbank/components";
import { useEffect, useState } from "react";
import { HStack, VStack } from "../components/Stacks";
import { VisibilityControl } from "../components/VisibilityControl";
import { api, type Workflow } from "../api";
import { RunWorkflowPanel, WorkflowExecutionHistoryPanel, WorkflowVersionSelector } from "./workflowPanels";
import { WorkflowBuilderFields } from "./workflowFormWidgets";
import { useWorkflowBuilder } from "./useWorkflowBuilder";

const SIDE_PANEL_WIDTH = 380;

function WorkflowEditSection({ workflow, onSaved }: { workflow: Workflow; onSaved: () => void }) {
  const builder = useWorkflowBuilder(workflow);
  const [saving, setSaving] = useState<"update" | "new-version" | null>(null);
  const [message, setMessage] = useState("");

  async function handleUpdate() {
    const result = builder.buildOrder();
    if ("error" in result) {
      setMessage(result.error);
      return;
    }
    setMessage("");
    setSaving("update");
    try {
      await api.overwriteWorkflow(workflow.id, {
        name: builder.name,
        agent_ids: result,
        start_inputs: builder.startInputs.filter((si) => si.name.trim()),
        visibility: workflow.visibility,
      });
      onSaved();
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveNewVersion() {
    const result = builder.buildOrder();
    if ("error" in result) {
      setMessage(result.error);
      return;
    }
    setMessage("");
    setSaving("new-version");
    try {
      await api.updateWorkflow(workflow.id, {
        name: builder.name,
        agent_ids: result,
        start_inputs: builder.startInputs.filter((si) => si.name.trim()),
        visibility: workflow.visibility,
      });
      onSaved();
    } finally {
      setSaving(null);
    }
  }

  return (
    <VStack gap="1rem">
      <WorkflowBuilderFields builder={builder} />
      {message && <Typography.Caption>{message}</Typography.Caption>}
      {builder.dirty && (
        <HStack justifyContent="flex-end" gap="0.5rem">
          <Button.Secondary
            label={saving === "update" ? "Updating…" : `Update v${workflow.version}`}
            onPress={handleUpdate}
            disabled={saving !== null || !builder.name}
          />
          <Button.Primary
            label={saving === "new-version" ? "Saving…" : "Save (new version)"}
            onPress={handleSaveNewVersion}
            disabled={saving !== null || !builder.name}
          />
        </HStack>
      )}
    </VStack>
  );
}

export function WorkflowDetailView({
  workflowId,
  onBack,
  onCloned,
}: {
  workflowId: string;
  onBack: () => void;
  onCloned: (workflow: Workflow) => void;
}) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [cloning, setCloning] = useState(false);
  const [executionRefreshToken, setExecutionRefreshToken] = useState(0);

  function refresh() {
    api.getWorkflow(workflowId).then(setWorkflow);
  }

  useEffect(refresh, [workflowId]);

  async function handleClone() {
    setCloning(true);
    try {
      onCloned(await api.cloneWorkflow(workflowId));
    } finally {
      setCloning(false);
    }
  }

  if (workflow === null) {
    return <Typography.Caption>Loading workflow…</Typography.Caption>;
  }

  return (
    <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Surface rounded elevated padding={24}>
          <VStack gap="1rem">
            <HStack justifyContent="space-between" alignItems="center">
              <HStack gap="0.75rem" alignItems="center">
                <Typography.Heading level={3}>{workflow.name}</Typography.Heading>
                <VisibilityControl
                  visibility={workflow.visibility}
                  onToggle={async (next) => {
                    if (next === "personal") {
                      // Never edit the public workflow in place -- fork a
                      // personal draft and jump to editing that instead.
                      onCloned(await api.forkWorkflow(workflow.id));
                      return;
                    }
                    if (workflow.forked_from) {
                      // Publishing deletes this draft and updates the
                      // original by id, so follow navigation there.
                      onCloned(await api.publishWorkflow(workflow.id));
                      return;
                    }
                    await api.setWorkflowVisibility(workflow.id, next);
                    refresh();
                  }}
                />
              </HStack>
              <HStack gap="0.5rem" alignItems="center">
                <WorkflowVersionSelector workflow={workflow} onRestored={refresh} />
                <Button.Secondary label={cloning ? "Cloning…" : "Clone"} onPress={handleClone} disabled={cloning} />
                <Button.Flat label="Back" onPress={onBack} />
              </HStack>
            </HStack>

            {workflow.forked_from && (
              <Typography.Caption>
                Personal draft — your changes here are independent of the public workflow until you hit
                "Publish".
              </Typography.Caption>
            )}

            <WorkflowEditSection key={`${workflow.id}-${workflow.version}`} workflow={workflow} onSaved={refresh} />
          </VStack>
        </Surface>
      </div>

      <div style={{ width: SIDE_PANEL_WIDTH, flexShrink: 0, position: "sticky", top: 0 }}>
        <VStack gap="1.5rem">
          <Surface rounded elevated padding={24}>
            <VStack gap="1rem">
              <Typography.Heading level={4}>Run this workflow</Typography.Heading>
              <RunWorkflowPanel workflow={workflow} onRan={() => setExecutionRefreshToken((t) => t + 1)} />
            </VStack>
          </Surface>

          <Surface rounded elevated padding={24}>
            <VStack gap="1rem">
              <Typography.Heading level={4}>Execution history</Typography.Heading>
              <div style={{ maxHeight: 520, overflowY: "auto" }}>
                <WorkflowExecutionHistoryPanel workflowId={workflow.id} refreshToken={executionRefreshToken} />
              </div>
            </VStack>
          </Surface>
        </VStack>
      </div>
    </div>
  );
}
