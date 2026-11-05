import { Button, Modal, Select, Surface, Typography } from "@oaknorthbank/components";
import { useEffect, useState } from "react";
import { HStack, VStack } from "./Stacks";

type VersionEntry = { id: string; version: string; versioned_at: string };

export function VersionPickerModal({
  isOpen,
  onClose,
  onConfirm,
  action,
  kind,
  name,
  currentVersion,
  loadVersions,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (versionId?: string) => void;
  action: "clone" | "publish";
  kind: string;
  name: string;
  currentVersion: string;
  loadVersions: () => Promise<VersionEntry[]>;
}) {
  const [versions, setVersions] = useState<VersionEntry[] | null>(null);
  const [selected, setSelected] = useState<string>("current");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelected("current");
    setVersions(null);
    loadVersions().then(setVersions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const options = [
    { value: "current", label: `Current (v${currentVersion})` },
    ...(versions ?? [])
      .slice()
      .sort((a, b) => b.versioned_at.localeCompare(a.versioned_at))
      .map((v) => ({
        value: v.id,
        label: `v${v.version} — ${new Date(v.versioned_at).toLocaleDateString()}`,
      })),
  ];

  async function handleConfirm() {
    setConfirming(true);
    try {
      onConfirm(selected === "current" ? undefined : selected);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Modal.FullScreen label={`Choose version to ${action}`} isOpen={isOpen} onClose={onClose}>
      <Surface rounded elevated padding={24}>
        <div style={{ width: 400, maxWidth: "90vw" }}>
          <VStack gap="1rem">
            <Typography.Heading level={4}>
              {action === "clone" ? "Clone which version?" : "Publish which version?"}
            </Typography.Heading>
            <Typography.Body small>
              Choose which version of <strong style={{ fontWeight: 600 }}>{name}</strong> this {kind} should use.
            </Typography.Body>
            {versions === null ? (
              <Typography.Caption>Loading versions…</Typography.Caption>
            ) : (
              <Select
                label="Version"
                options={options}
                value={selected}
                onChange={(option) => setSelected(option.value)}
              />
            )}
            <HStack justifyContent="flex-end" gap="0.5rem">
              <Button.Secondary label="Cancel" onPress={onClose} disabled={confirming} />
              <Button.Primary
                label={confirming ? "Working…" : action === "clone" ? "Clone" : "Publish"}
                onPress={handleConfirm}
                disabled={confirming || versions === null}
              />
            </HStack>
          </VStack>
        </div>
      </Surface>
    </Modal.FullScreen>
  );
}
