import { Alert, Button, Modal, Surface, Typography } from "@oaknorthbank/components";
import { HStack, VStack } from "./Stacks";

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  kind,
  name,
  version,
  deleting,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  kind: string;
  name: string;
  version?: string;
  deleting: boolean;
  error?: string;
}) {
  if (!isOpen) return null;

  return (
    <Modal.FullScreen label={`Delete ${kind}`} isOpen={isOpen} onClose={onClose}>
      <Surface rounded elevated padding={24}>
        <div style={{ width: 400, maxWidth: "90vw" }}>
          <VStack gap="1rem">
            <Typography.Heading level={4}>{`Delete this ${kind}?`}</Typography.Heading>
            <Typography.Body small>
              This will permanently delete <strong style={{ fontWeight: 600 }}>{name}</strong>
              {version ? ` (v${version})` : ""}. This can't be undone.
            </Typography.Body>
            {error && <Alert level="error" title={error} />}
            <HStack justifyContent="flex-end" gap="0.5rem">
              <Button.Secondary label="Cancel" onPress={onClose} disabled={deleting} />
              <Button.Primary
                label={deleting ? "Deleting…" : "Delete"}
                destructive
                onPress={onConfirm}
                disabled={deleting}
              />
            </HStack>
          </VStack>
        </div>
      </Surface>
    </Modal.FullScreen>
  );
}
