import { Button, Surface, Typography } from "@oaknorthbank/components";
import { useState } from "react";
import { HStack, VStack } from "../components/Stacks";
import { api } from "../api";
import { AgentFormFields } from "./agentFormWidgets";
import { useAgentForm } from "./useAgentForm";

export function AgentEditorView({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const form = useAgentForm();
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    try {
      await api.createAgent(form.buildPayload());
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
            <Typography.Heading level={3}>Create agent</Typography.Heading>
            <Button.Flat label="Back" onPress={onCancel} />
          </HStack>

          <AgentFormFields form={form} />

          <HStack justifyContent="flex-end" gap="0.5rem">
            <Button.Secondary label="Cancel" onPress={onCancel} disabled={saving} />
            <Button.Primary
              label={saving ? "Saving…" : "Create agent"}
              onPress={handleSubmit}
              disabled={!form.name || !form.prompt || !form.model || !!form.outputSchemaError || saving}
            />
          </HStack>
        </VStack>
      </Surface>
    </VStack>
  );
}
