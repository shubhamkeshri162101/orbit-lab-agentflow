import { Alert, Button, IconButton, InputGroup, Select, Surface, Typography } from "@oaknorthbank/components";
import IconPencil from "@oaknorthbank/graphics/icons/IconPencil";
import IconTrash from "@oaknorthbank/graphics/icons/IconTrash";
import { useEffect, useState } from "react";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { HStack, VStack } from "../components/Stacks";
import { VisibilityBadge, VisibilityToggleButton } from "../components/VisibilityControl";
import { api, PROVIDER_ENV_VARS, type ModelInfo, type Provider } from "../api";

const PROVIDER_OPTIONS: { value: Provider; label: string }[] = [
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI (GPT)" },
  { value: "google", label: "Google (Gemini)" },
];

function EditModelForm({
  model,
  onSaved,
  onCancel,
}: {
  model: ModelInfo;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(model.name);
  const [provider, setProvider] = useState<Provider>(model.provider);
  const [pricing, setPricing] = useState(model.pricing);
  const [useCase, setUseCase] = useState(model.use_case);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      await api.updateModel(model.id, { name, provider, pricing, use_case: useCase, visibility: model.visibility });
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <VStack gap="0.75rem">
      <InputGroup
        type="Text"
        label="Model name"
        inputProps={{ value: name, onChange: setName, accessibilityLabel: "Model name" }}
      />
      <Select
        label="Provider"
        options={PROVIDER_OPTIONS}
        value={provider}
        onChange={(option) => setProvider(option.value)}
      />
      <InputGroup
        type="Text"
        label="Pricing"
        inputProps={{ value: pricing, onChange: setPricing, accessibilityLabel: "Model pricing" }}
      />
      <InputGroup
        type="Text"
        label="Use case"
        inputProps={{ value: useCase, onChange: setUseCase, accessibilityLabel: "Model use case" }}
      />
      {error && <Alert level="error" title={error} />}
      <HStack justifyContent="flex-end" gap="0.5rem">
        <Button.Secondary label="Cancel" onPress={onCancel} disabled={saving} />
        <Button.Primary label={saving ? "Saving…" : "Save"} onPress={handleSave} disabled={!name || saving} />
      </HStack>
    </VStack>
  );
}

function ModelCard({ model, onChanged }: { model: ModelInfo; onChanged: () => void }) {
  async function handleToggleVisibility(next: "personal" | "public") {
    if (next === "personal") {
      // Never edit the public model in place -- fork a personal draft the
      // user can safely edit (via "Edit model" below), then publish it back.
      await api.forkModel(model.id);
      onChanged();
      return;
    }
    if (model.forked_from) {
      await api.publishModel(model.id);
    } else {
      await api.setModelVisibility(model.id, next);
    }
    onChanged();
  }

  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleDelete() {
    setDeleteError("");
    setDeleting(true);
    try {
      await api.deleteModel(model.id);
      setConfirming(false);
      onChanged();
    } catch (e) {
      setDeleteError(String(e));
    } finally {
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <Surface rounded elevated flex padding={16}>
        <EditModelForm
          model={model}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
          onCancel={() => setEditing(false)}
        />
      </Surface>
    );
  }

  return (
    <Surface rounded elevated flex padding={16}>
      <VStack gap="0.75rem" style={{ height: "100%" }}>
        <HStack justifyContent="space-between" alignItems="flex-start">
          <HStack gap="0.5rem" alignItems="center" style={{ flexWrap: "wrap" }}>
            <Typography.Body fontWeight="semibold">{model.name}</Typography.Body>
            <div style={{ flexShrink: 0 }}>
              <VisibilityBadge visibility={model.visibility} />
            </div>
          </HStack>
          <HStack gap="0.4rem">
            <IconButton.Outlined icon={IconPencil} label="Edit model" onPress={() => setEditing(true)} />
            <IconButton.Outlined
              icon={IconTrash}
              label={model.visibility === "public" ? "Make personal to delete" : "Delete model"}
              destructive
              disabled={model.visibility === "public"}
              onPress={() => {
                setDeleteError("");
                setConfirming(true);
              }}
            />
          </HStack>
        </HStack>

        <DeleteConfirmModal
          isOpen={confirming}
          onClose={() => setConfirming(false)}
          onConfirm={handleDelete}
          kind="model"
          name={model.name}
          deleting={deleting}
          error={deleteError}
        />

        <div>
          <VisibilityToggleButton visibility={model.visibility} onToggle={handleToggleVisibility} />
        </div>

        {model.forked_from && (
          <Typography.Caption>Personal draft — independent of the public model until published.</Typography.Caption>
        )}

        <VStack gap="0.4rem">
          <VStack gap="0.1rem">
            <Typography.Caption>Provider</Typography.Caption>
            <Typography.Body small>
              {PROVIDER_OPTIONS.find((p) => p.value === model.provider)?.label ?? model.provider} — reads{" "}
              {PROVIDER_ENV_VARS[model.provider]} from the server environment
            </Typography.Body>
          </VStack>
          <VStack gap="0.1rem">
            <Typography.Caption>Pricing</Typography.Caption>
            <Typography.Body small>{model.pricing || "—"}</Typography.Body>
          </VStack>
          <VStack gap="0.1rem">
            <Typography.Caption>Use case</Typography.Caption>
            <Typography.Body small>{model.use_case || "—"}</Typography.Body>
          </VStack>
        </VStack>
      </VStack>
    </Surface>
  );
}

function AddModelForm({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [pricing, setPricing] = useState("");
  const [useCase, setUseCase] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Timber's TextInput only reads its initial value at mount, so clearing
  // these via state alone leaves stale text on screen — force a remount.
  const [formKey, setFormKey] = useState(0);

  async function handleAdd() {
    setError("");
    setSaving(true);
    try {
      await api.createModel({ name, provider, pricing, use_case: useCase, visibility: "personal" });
      setName("");
      setProvider("anthropic");
      setPricing("");
      setUseCase("");
      setFormKey((k) => k + 1);
      onAdded();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Surface rounded elevated padding={24}>
      <VStack gap="1rem">
        <Typography.Heading level={4}>Add a model</Typography.Heading>
        <Typography.Caption>
          Pick which provider's API key this model uses. The key itself is never entered here — set{" "}
          {PROVIDER_ENV_VARS[provider]} as an environment variable on the server before starting it, and this
          model will pick it up automatically when invoked.
        </Typography.Caption>
        <HStack key={formKey} gap="1rem" style={{ flexWrap: "wrap" }} alignItems="flex-end">
          <div style={{ width: 240 }}>
            <InputGroup
              type="Text"
              label="Model name"
              inputProps={{ value: name, onChange: setName, accessibilityLabel: "Model name" }}
            />
          </div>
          <div style={{ width: 220 }}>
            <Select
              label="Provider"
              options={PROVIDER_OPTIONS}
              value={provider}
              onChange={(option) => setProvider(option.value)}
            />
          </div>
          <div style={{ width: 260 }}>
            <InputGroup
              type="Text"
              label="Pricing"
              inputProps={{ value: pricing, onChange: setPricing, accessibilityLabel: "Model pricing" }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <InputGroup
              type="Text"
              label="Use case"
              inputProps={{ value: useCase, onChange: setUseCase, accessibilityLabel: "Model use case" }}
            />
          </div>
          <Button.Primary label={saving ? "Adding…" : "+ Add model"} onPress={handleAdd} disabled={!name || saving} />
        </HStack>
        {error && <Alert level="error" title={error} />}
      </VStack>
    </Surface>
  );
}

export function ModelsView() {
  const [models, setModels] = useState<ModelInfo[]>([]);

  async function refresh() {
    setModels(await api.listModels());
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <VStack gap="1.5rem">
      <Typography.Heading level={3}>Models ({models.length})</Typography.Heading>

      <AddModelForm onAdded={refresh} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "1rem",
          alignItems: "stretch",
        }}
      >
        {models.map((m) => (
          <ModelCard key={m.id} model={m} onChanged={refresh} />
        ))}
      </div>
    </VStack>
  );
}
