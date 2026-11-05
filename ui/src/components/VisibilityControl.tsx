import { Button, Label } from "@oaknorthbank/components";
import { useState } from "react";
import { HStack } from "./Stacks";
import type { Visibility } from "../api";

// No real per-user permission check — anyone can flip personal <-> public at
// any time, matching the rest of this prototype's honesty-over-security stance.

export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  return (
    <Label.Status
      label={visibility === "personal" ? "Personal" : "Public"}
      type={visibility === "personal" ? "draft" : "success"}
    />
  );
}

export function VisibilityToggleButton({
  visibility,
  onToggle,
}: {
  visibility: Visibility;
  onToggle: (next: Visibility) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const next: Visibility = visibility === "personal" ? "public" : "personal";

  async function handleClick() {
    setBusy(true);
    try {
      await onToggle(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button.Flat
      label={busy ? "…" : next === "public" ? "Publish" : "Make personal"}
      onPress={handleClick}
      disabled={busy}
    />
  );
}

// Badge + toggle together, for places (like detail-page headers) where
// showing both inline next to each other already reads fine.
export function VisibilityControl({
  visibility,
  onToggle,
}: {
  visibility: Visibility;
  onToggle: (next: Visibility) => Promise<void>;
}) {
  return (
    <HStack gap="0.5rem" alignItems="center">
      <VisibilityBadge visibility={visibility} />
      <VisibilityToggleButton visibility={visibility} onToggle={onToggle} />
    </HStack>
  );
}
