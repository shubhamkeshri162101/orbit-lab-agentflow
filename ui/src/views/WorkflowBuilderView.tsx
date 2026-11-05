import { Button, Surface, Typography } from "@oaknorthbank/components";
import { useState } from "react";
import { HStack, VStack } from "../components/Stacks";
import { api } from "../api";
import { WorkflowBuilderFields } from "./workflowFormWidgets";
import { useWorkflowBuilder } from "./useWorkflowBuilder";

export function WorkflowBuilderView({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const builder = useWorkflowBuilder();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave() {
    const result = builder.buildOrder();
    if ("error" in result) {
      setMessage(result.error);
      return;
    }
    setMessage("");
    setSaving(true);
    try {
      await api.createWorkflow({
        name: builder.name,
        agent_ids: result,
        start_inputs: builder.startInputs.filter((si) => si.name.trim()),
        visibility: "personal",
      });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <VStack gap="1.5rem">
      <Surface rounded elevated padding={24}>
        <VStack gap="1rem">
          <HStack justifyContent="space-between" alignItems="center">
            <Typography.Heading level={3}>Build a workflow</Typography.Heading>
            <Button.Flat label="Back" onPress={onCancel} />
          </HStack>

          <WorkflowBuilderFields builder={builder} />

          {message && <Typography.Caption>{message}</Typography.Caption>}

          <HStack justifyContent="flex-end" gap="0.5rem">
            <Button.Secondary label="Cancel" onPress={onCancel} disabled={saving} />
            <Button.Primary
              label={saving ? "Saving…" : "Save workflow"}
              onPress={handleSave}
              disabled={!builder.name || saving}
            />
          </HStack>
        </VStack>
      </Surface>
    </VStack>
  );
}
