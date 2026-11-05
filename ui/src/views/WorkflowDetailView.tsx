import { Button, Surface, Typography } from "@oaknorthbank/components";
import { useEffect, useState } from "react";
import { HStack, VStack } from "../components/Stacks";
import { VersionPickerModal } from "../components/VersionPickerModal";
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
        output_schema: builder.parsedOutputSchema,
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
        output_schema: builder.parsedOutputSchema,
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
            disabled={saving !== null || !builder.name || !!builder.outputSchemaError}
          />
          <Button.Primary
            label={saving === "new-version" ? "Saving…" : "Save (new version)"}
            onPress={handleSaveNewVersion}
            disabled={saving !== null || !builder.name || !!builder.outputSchemaError}
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
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [executionRefreshToken, setExecutionRefreshToken] = useState(0);

  function refresh() {
    api.getWorkflow(workflowId).then(setWorkflow);
  }

  useEffect(refresh, [workflowId]);

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
                      // original by id -- ask which version of the draft to
                      // publish before doing either.
                      setPublishModalOpen(true);
                      return;
                    }
                    await api.setWorkflowVisibility(workflow.id, next);
                    refresh();
                  }}
                />
              </HStack>
              <HStack gap="0.5rem" alignItems="center">
                <WorkflowVersionSelector workflow={workflow} onRestored={refresh} />
                <Button.Secondary label="Clone" onPress={() => setCloneModalOpen(true)} />
                <Button.Flat label="Back" onPress={onBack} />
              </HStack>
            </HStack>

            <VersionPickerModal
              isOpen={cloneModalOpen}
              onClose={() => setCloneModalOpen(false)}
              onConfirm={async (versionId) => {
                onCloned(await api.cloneWorkflow(workflow.id, versionId));
                setCloneModalOpen(false);
              }}
              action="clone"
              kind="workflow"
              name={workflow.name}
              currentVersion={workflow.version}
              loadVersions={() => api.listWorkflowVersions(workflow.id)}
            />

            <VersionPickerModal
              isOpen={publishModalOpen}
              onClose={() => setPublishModalOpen(false)}
              onConfirm={async (versionId) => {
                onCloned(await api.publishWorkflow(workflow.id, versionId));
                setPublishModalOpen(false);
              }}
              action="publish"
              kind="workflow"
              name={workflow.name}
              currentVersion={workflow.version}
              loadVersions={() => api.listWorkflowVersions(workflow.id)}
            />

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
