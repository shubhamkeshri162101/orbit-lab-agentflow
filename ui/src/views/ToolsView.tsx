import {
  Alert,
  Button,
  Check,
  IconButton,
  InputGroup,
  Label,
  Select,
  SegmentedControl,
  Surface,
  Typography,
} from "@oaknorthbank/components";
import IconTrash from "@oaknorthbank/graphics/icons/IconTrash";
import { useEffect, useState } from "react";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { HStack, VStack } from "../components/Stacks";
import { VisibilityBadge, VisibilityControl, VisibilityToggleButton } from "../components/VisibilityControl";
import {
  api,
  type AgentVariable,
  type DiscoveredMcpTool,
  type McpServer,
  type Tool,
  type ToolExecution,
  type ToolLanguage,
} from "../api";

const LANGUAGE_OPTIONS: { value: ToolLanguage; label: string }[] = [
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
];

function languageLabel(language?: ToolLanguage | null): string {
  return LANGUAGE_OPTIONS.find((l) => l.value === language)?.label ?? language ?? "?";
}

// A prominent, always-visible language badge — not buried in a caption line.
function LanguageBadge({ language }: { language?: ToolLanguage | null }) {
  return <Label.Category label={languageLabel(language)} type="filled" />;
}

const LANGUAGE_TEMPLATES: Record<ToolLanguage, string> = {
  python: 'def run(inputs):\n    return inputs.get("value", "")\n',
  java: '    static String run(Map<String,String> inputs) {\n        return inputs.getOrDefault("value", "");\n    }\n',
  cpp: 'string run(map<string,string> inputs) {\n    return inputs.count("value") ? inputs["value"] : "";\n}\n',
};

function VariableEditor({
  variables,
  onChange,
}: {
  variables: AgentVariable[];
  onChange: (next: AgentVariable[]) => void;
}) {
  function update(i: number, patch: Partial<AgentVariable>) {
    onChange(variables.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  function add() {
    onChange([...variables, { name: "", required: true, default: "" }]);
  }

  function remove(i: number) {
    onChange(variables.filter((_, idx) => idx !== i));
  }

  return (
    <VStack gap="0.75rem">
      <Typography.Body fontWeight="semibold">Inputs this tool reads from shared state</Typography.Body>
      {variables.map((v, i) => (
        <Surface key={i} rounded outlined padding={12}>
          <HStack gap="1.5rem" alignItems="flex-end" justifyContent="space-between">
            <HStack gap="1.5rem" alignItems="flex-end" style={{ flexWrap: "wrap" }}>
              <div style={{ width: 240 }}>
                <InputGroup
                  type="Text"
                  label="Name"
                  inputProps={{
                    value: v.name,
                    onChange: (val) => update(i, { name: val }),
                    accessibilityLabel: "Variable name",
                  }}
                />
              </div>
              <div style={{ paddingBottom: 8, minWidth: 110 }}>
                <Check.Labeled
                  label="Required"
                  checked={v.required}
                  onChange={(checked) => update(i, { required: checked })}
                />
              </div>
              <div style={{ width: 240 }}>
                <InputGroup
                  type="Text"
                  label="Default (optional)"
                  inputProps={{
                    value: v.default ?? "",
                    onChange: (val) => update(i, { default: val }),
                    disabled: v.required,
                    accessibilityLabel: "Variable default",
                  }}
                />
              </div>
            </HStack>
            <IconButton.Outlined icon={IconTrash} label="Remove variable" destructive onPress={() => remove(i)} />
          </HStack>
        </Surface>
      ))}
      <div>
        <Button.Secondary label="+ Add input" onPress={add} />
      </div>
    </VStack>
  );
}

function TestToolPanel({
  tool,
  alwaysOpen,
  onRan,
}: {
  tool: Tool;
  alwaysOpen?: boolean;
  onRan?: () => void;
}) {
  const [open, setOpen] = useState(!!alwaysOpen);
  const [values, setValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [output, setOutput] = useState<Record<string, string> | null>(null);

  async function handleRun() {
    setError("");
    setOutput(null);
    setRunning(true);
    try {
      const result = await api.runTool(tool.id, values);
      setOutput(result.output);
      onRan?.();
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  if (!open) {
    return <Button.Secondary label="Test tool" onPress={() => setOpen(true)} />;
  }

  return (
    <VStack gap="0.75rem">
      {tool.variables.map((v) => (
        <InputGroup
          key={v.name}
          type="Text"
          label={v.required ? `${v.name} (required)` : v.name}
          inputProps={{
            value: values[v.name] ?? "",
            onChange: (val) => setValues((cur) => ({ ...cur, [v.name]: val })),
            accessibilityLabel: `Test input ${v.name}`,
          }}
        />
      ))}
      <HStack gap="0.5rem">
        <Button.Primary label={running ? "Running…" : "Run"} onPress={handleRun} disabled={running} />
        {!alwaysOpen && <Button.Flat label="Close" onPress={() => setOpen(false)} />}
      </HStack>
      {error && <Alert level="error" title={error} />}
      {output && (
        <Surface rounded outlined padding={12}>
          <Typography.Body small>{JSON.stringify(output, null, 2)}</Typography.Body>
        </Surface>
      )}
    </VStack>
  );
}

function ExecutionHistoryList({ toolId, refreshToken }: { toolId: string; refreshToken?: number }) {
  const [executions, setExecutions] = useState<ToolExecution[] | null>(null);

  useEffect(() => {
    api.listToolExecutions(toolId).then(setExecutions);
  }, [toolId, refreshToken]);

  if (executions === null) return <Typography.Caption>Loading execution history…</Typography.Caption>;
  if (executions.length === 0) {
    return <Typography.Caption>No runs yet — use "Test this tool" above to run it.</Typography.Caption>;
  }

  return (
    <VStack gap="0.75rem">
      {[...executions]
        .sort((a, b) => b.executed_at.localeCompare(a.executed_at))
        .map((e) => (
          <Surface key={e.id} rounded outlined padding={12}>
            <VStack gap="0.3rem">
              <Typography.Caption>{new Date(e.executed_at).toLocaleString()}</Typography.Caption>
              <Typography.Caption>in: {JSON.stringify(e.input)}</Typography.Caption>
              <Typography.Caption>out: {JSON.stringify(e.result.output)}</Typography.Caption>
            </VStack>
          </Surface>
        ))}
    </VStack>
  );
}

function EditToolForm({ tool, onSaved }: { tool: Tool; onSaved: (name: string) => void }) {
  const [name, setName] = useState(tool.name);
  const [language, setLanguage] = useState<ToolLanguage>(tool.language ?? "python");
  const [description, setDescription] = useState(tool.description);
  const [code, setCode] = useState(tool.code ?? "");
  const [variables, setVariables] = useState<AgentVariable[]>(tool.variables);
  const [writes, setWrites] = useState(tool.writes ?? "");
  const [timeoutSeconds, setTimeoutSeconds] = useState(String(tool.timeout_seconds));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      await api.updateTool(tool.id, {
        name,
        source: "code",
        language,
        description,
        code,
        variables,
        writes: writes || null,
        timeout_seconds: Math.max(1, Math.min(60, Number(timeoutSeconds) || 10)),
        visibility: tool.visibility,
      });
      setSaved(true);
      onSaved(name);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <VStack gap="1rem">
      <HStack gap="1rem" style={{ flexWrap: "wrap" }} alignItems="flex-end">
        <div style={{ width: 240 }}>
          <InputGroup
            type="Text"
            label="Tool name"
            inputProps={{ value: name, onChange: setName, accessibilityLabel: "Tool name" }}
          />
        </div>
        <div style={{ width: 180 }}>
          <Select
            label="Language"
            options={LANGUAGE_OPTIONS}
            value={language}
            onChange={(option) => setLanguage(option.value)}
          />
        </div>
        <div style={{ width: 240 }}>
          <InputGroup
            type="Text"
            label="Timeout (s)"
            inputProps={{ value: timeoutSeconds, onChange: setTimeoutSeconds, accessibilityLabel: "Timeout seconds" }}
          />
        </div>
      </HStack>

      <InputGroup
        type="Text"
        label="Description"
        inputProps={{ value: description, onChange: setDescription, accessibilityLabel: "Tool description" }}
      />

      <VariableEditor variables={variables} onChange={setVariables} />

      <InputGroup
        type="TextArea"
        label="Code"
        description={`Define a function/method named "run" taking the inputs above and returning a single value. See the ${language} placeholder for the exact signature.`}
        inputProps={{ value: code, rows: 16, onChange: setCode, accessibilityLabel: "Tool code" }}
      />

      <InputGroup
        type="Text"
        label="Writes to (shared state key)"
        description="The key this tool's return value is saved under for later steps in a workflow. Defaults to the tool's name."
        inputProps={{ value: writes, onChange: setWrites, accessibilityLabel: "Writes" }}
      />

      {error && <Alert level="error" title={error} />}
      <HStack justifyContent="flex-end" alignItems="center" gap="0.75rem">
        {saved && !error && <Typography.Caption>Saved.</Typography.Caption>}
        <Button.Primary label={saving ? "Saving…" : "Save"} onPress={handleSave} disabled={!name || !code || saving} />
      </HStack>
    </VStack>
  );
}

function ToolCard({
  tool,
  onOpen,
  onChanged,
}: {
  tool: Tool;
  onOpen: (tool: Tool) => void;
  onChanged: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleDelete() {
    setDeleteError("");
    setDeleting(true);
    try {
      await api.deleteTool(tool.id);
      setConfirming(false);
      onChanged();
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
            <Typography.Body fontWeight="semibold">{tool.name}</Typography.Body>
            <LanguageBadge language={tool.language} />
            <VisibilityBadge visibility={tool.visibility} />
          </HStack>
          <IconButton.Outlined
            icon={IconTrash}
            label={tool.visibility === "public" ? "Make personal to delete" : "Delete tool"}
            destructive
            disabled={tool.visibility === "public"}
            onPress={() => {
              setDeleteError("");
              setConfirming(true);
            }}
          />
        </HStack>

        <DeleteConfirmModal
          isOpen={confirming}
          onClose={() => setConfirming(false)}
          onConfirm={handleDelete}
          kind="tool"
          name={tool.name}
          deleting={deleting}
          error={deleteError}
        />

        <VStack gap="0.4rem">
          {tool.description && (
            <VStack gap="0.1rem">
              <Typography.Caption>Description</Typography.Caption>
              <Typography.Body small>{tool.description}</Typography.Body>
            </VStack>
          )}
          <VStack gap="0.1rem">
            <Typography.Caption>Inputs</Typography.Caption>
            <Typography.Body small>
              {tool.variables.length
                ? tool.variables.map((v) => (v.required ? `${v.name}*` : v.name)).join(", ")
                : "none"}
            </Typography.Body>
          </VStack>
          <VStack gap="0.1rem">
            <Typography.Caption>Writes to</Typography.Caption>
            <Typography.Body small>{tool.writes || tool.name}</Typography.Body>
          </VStack>
        </VStack>

        <HStack gap="0.5rem" alignItems="center" style={{ marginTop: "auto" }}>
          <Button.Secondary label="Open" onPress={() => onOpen(tool)} />
          <VisibilityToggleButton
            visibility={tool.visibility}
            onToggle={async (next) => {
              if (next === "personal") {
                // Never edit the public tool in place -- fork a personal
                // draft the user can safely change, then jump straight to it.
                onOpen(await api.forkTool(tool.id));
                return;
              }
              if (tool.forked_from) {
                await api.publishTool(tool.id);
              } else {
                await api.setToolVisibility(tool.id, next);
              }
              onChanged();
            }}
          />
        </HStack>
      </VStack>
    </Surface>
  );
}

const SIDE_PANEL_WIDTH = 380;

function ToolDetailView({
  toolId,
  onBack,
  onNavigate,
}: {
  toolId: string;
  onBack: () => void;
  onNavigate: (toolId: string) => void;
}) {
  const [tool, setTool] = useState<Tool | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [executionRefreshToken, setExecutionRefreshToken] = useState(0);

  function refresh() {
    api.getTool(toolId).then((t) => {
      setTool(t);
      setDisplayName(t.name);
    });
  }

  useEffect(refresh, [toolId]);

  if (tool === null) {
    return <Typography.Caption>Loading tool…</Typography.Caption>;
  }

  return (
    <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Surface rounded elevated padding={24}>
          <VStack gap="1rem">
            <HStack justifyContent="space-between" alignItems="center">
              <HStack gap="0.75rem" alignItems="center">
                <Typography.Heading level={3}>{displayName}</Typography.Heading>
                <LanguageBadge language={tool.language} />
                <VisibilityControl
                  visibility={tool.visibility}
                  onToggle={async (next) => {
                    if (next === "personal") {
                      // Never edit the public tool in place -- fork a
                      // personal draft and jump to editing that instead.
                      onNavigate((await api.forkTool(tool.id)).id);
                      return;
                    }
                    if (tool.forked_from) {
                      // Publishing deletes this draft and updates the
                      // original by id, so follow navigation there.
                      onNavigate((await api.publishTool(tool.id)).id);
                      return;
                    }
                    await api.setToolVisibility(tool.id, next);
                    refresh();
                  }}
                />
              </HStack>
              <Button.Flat label="Back" onPress={onBack} />
            </HStack>

            {tool.forked_from && (
              <Typography.Caption>
                Personal draft — your changes here are independent of the public tool until you hit "Publish".
              </Typography.Caption>
            )}

            <EditToolForm
              key={tool.id}
              tool={tool}
              onSaved={(name) => {
                setDisplayName(name);
                setExecutionRefreshToken((t) => t + 1);
              }}
            />
          </VStack>
        </Surface>
      </div>

      <div style={{ width: SIDE_PANEL_WIDTH, flexShrink: 0, position: "sticky", top: 0 }}>
        <VStack gap="1.5rem">
          <Surface rounded elevated padding={24}>
            <VStack gap="1rem">
              <Typography.Heading level={4}>Test this tool</Typography.Heading>
              <TestToolPanel tool={tool} alwaysOpen onRan={() => setExecutionRefreshToken((t) => t + 1)} />
            </VStack>
          </Surface>

          <Surface rounded elevated padding={24}>
            <VStack gap="1rem">
              <Typography.Heading level={4}>Execution history</Typography.Heading>
              <div style={{ maxHeight: 520, overflowY: "auto" }}>
                <ExecutionHistoryList toolId={tool.id} refreshToken={executionRefreshToken} />
              </div>
            </VStack>
          </Surface>
        </VStack>
      </div>
    </div>
  );
}

function AddToolForm({ onCreated }: { onCreated: (tool: Tool) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<ToolLanguage>("python");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    setError("");
    setSaving(true);
    try {
      const tool = await api.createTool({
        name,
        source: "code",
        language,
        code: LANGUAGE_TEMPLATES[language],
        description: "",
        variables: [],
        writes: null,
        timeout_seconds: 10,
        visibility: "personal",
      });
      setName("");
      setLanguage("python");
      setAdding(false);
      onCreated(tool);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!adding) {
    return (
      <Surface rounded elevated padding={24}>
        <HStack justifyContent="space-between" alignItems="center">
          <Typography.Heading level={4}>Add a tool</Typography.Heading>
          <Button.Primary label="+ New tool" onPress={() => setAdding(true)} />
        </HStack>
      </Surface>
    );
  }

  return (
    <Surface rounded elevated padding={24}>
      <VStack gap="1rem">
        <Typography.Heading level={4}>Add a tool</Typography.Heading>
        <Typography.Caption>
          Pick a name and language to start — you'll write the actual code on the next screen. Tools run as
          plain OS processes with the same privileges as this server; only add code you trust.
        </Typography.Caption>
        <HStack gap="1rem" style={{ flexWrap: "wrap" }} alignItems="flex-end">
          <div style={{ width: 240 }}>
            <InputGroup
              type="Text"
              label="Tool name"
              inputProps={{ value: name, onChange: setName, accessibilityLabel: "Tool name" }}
            />
          </div>
          <div style={{ width: 180 }}>
            <Select
              label="Language"
              options={LANGUAGE_OPTIONS}
              value={language}
              onChange={(option) => setLanguage(option.value)}
            />
          </div>
          <Button.Primary label={saving ? "Creating…" : "Create"} onPress={handleCreate} disabled={!name || saving} />
          <Button.Secondary label="Cancel" onPress={() => setAdding(false)} disabled={saving} />
        </HStack>
        {error && <Alert level="error" title={error} />}
      </VStack>
    </Surface>
  );
}

type CodeToolsScreen = { type: "list" } | { type: "detail"; toolId: string };

function CodeToolsPanel() {
  const [screen, setScreen] = useState<CodeToolsScreen>({ type: "list" });
  const [tools, setTools] = useState<Tool[]>([]);

  async function refresh() {
    setTools((await api.listTools()).filter((t) => t.source === "code"));
  }

  useEffect(() => {
    refresh();
  }, []);

  if (screen.type === "detail") {
    return (
      <ToolDetailView
        toolId={screen.toolId}
        onBack={() => {
          setScreen({ type: "list" });
          refresh();
        }}
        onNavigate={(toolId) => setScreen({ type: "detail", toolId })}
      />
    );
  }

  return (
    <VStack gap="1.5rem">
      <AddToolForm onCreated={(tool) => setScreen({ type: "detail", toolId: tool.id })} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: "1rem",
          alignItems: "stretch",
        }}
      >
        {tools.map((t) => (
          <ToolCard
            key={t.id}
            tool={t}
            onOpen={(tool) => setScreen({ type: "detail", toolId: tool.id })}
            onChanged={refresh}
          />
        ))}
      </div>
    </VStack>
  );
}

function McpServerCard({
  server,
  onChanged,
}: {
  server: McpServer;
  onChanged: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [discovered, setDiscovered] = useState<DiscoveredMcpTool[] | null>(null);
  const [discoverError, setDiscoverError] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [importedNames, setImportedNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.listTools().then((tools) => {
      setImportedNames(
        new Set(tools.filter((t) => t.mcp_server_id === server.id).map((t) => t.mcp_tool_name ?? ""))
      );
    });
  }, [server.id]);

  async function handleDelete() {
    setDeleteError("");
    setDeleting(true);
    try {
      await api.deleteMcpServer(server.id);
      setConfirming(false);
      onChanged();
    } catch (e) {
      setDeleteError(String(e));
    } finally {
      setDeleting(false);
    }
  }

  async function handleDiscover() {
    setDiscoverError("");
    setDiscovering(true);
    try {
      setDiscovered(await api.discoverMcpTools(server.id));
    } catch (e) {
      setDiscoverError(String(e));
    } finally {
      setDiscovering(false);
    }
  }

  async function handleImport(tool: DiscoveredMcpTool) {
    setImporting(tool.name);
    try {
      await api.importMcpTool(server.id, tool);
      setImportedNames((cur) => new Set(cur).add(tool.name));
    } finally {
      setImporting(null);
    }
  }

  return (
    <Surface rounded elevated padding={16}>
      <VStack gap="0.75rem">
        <HStack justifyContent="space-between" alignItems="flex-start">
          <VStack gap="0.4rem">
            <HStack gap="0.5rem" alignItems="center">
              <Typography.Body fontWeight="semibold">{server.name}</Typography.Body>
              <VisibilityControl
                visibility={server.visibility}
                onToggle={async (next) => {
                  await api.setMcpServerVisibility(server.id, next);
                  onChanged();
                }}
              />
            </HStack>
            <Typography.Caption>
              {server.command} {server.args.join(" ")}
            </Typography.Caption>
            {server.env_passthrough.length > 0 && (
              <Typography.Caption>
                Forwards env: {server.env_passthrough.join(", ")}
              </Typography.Caption>
            )}
          </VStack>
          <IconButton.Outlined
            icon={IconTrash}
            label={server.visibility === "public" ? "Make personal to delete" : "Delete MCP server"}
            destructive
            disabled={server.visibility === "public"}
            onPress={() => {
              setDeleteError("");
              setConfirming(true);
            }}
          />
        </HStack>

        <DeleteConfirmModal
          isOpen={confirming}
          onClose={() => setConfirming(false)}
          onConfirm={handleDelete}
          kind="MCP server"
          name={server.name}
          deleting={deleting}
          error={deleteError}
        />

        <div>
          <Button.Secondary
            label={discovering ? "Connecting…" : "Discover tools"}
            onPress={handleDiscover}
            disabled={discovering}
          />
        </div>

        {discoverError && <Alert level="error" title={discoverError} />}

        {discovered && (
          <VStack gap="0.5rem">
            {discovered.length === 0 && <Typography.Caption>This server exposes no tools.</Typography.Caption>}
            {discovered.map((t) => (
              <Surface key={t.name} rounded outlined padding={12}>
                <HStack justifyContent="space-between" alignItems="center">
                  <VStack gap="0.1rem">
                    <Typography.Body fontWeight="semibold" small>
                      {t.name}
                    </Typography.Body>
                    {t.description && <Typography.Caption>{t.description}</Typography.Caption>}
                  </VStack>
                  {importedNames.has(t.name) ? (
                    <Typography.Caption>Imported ✓</Typography.Caption>
                  ) : (
                    <Button.Secondary
                      label={importing === t.name ? "Importing…" : "Import"}
                      onPress={() => handleImport(t)}
                      disabled={importing !== null}
                    />
                  )}
                </HStack>
              </Surface>
            ))}
          </VStack>
        )}
      </VStack>
    </Surface>
  );
}

function AddMcpServerForm({ onAdded }: { onAdded: () => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [envPassthrough, setEnvPassthrough] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    setError("");
    setSaving(true);
    try {
      await api.createMcpServer({
        name,
        command,
        args: args.trim() ? args.trim().split(/\s+/) : [],
        env: {},
        env_passthrough: envPassthrough.trim() ? envPassthrough.trim().split(/\s+/) : [],
        visibility: "personal",
      });
      setName("");
      setCommand("");
      setArgs("");
      setEnvPassthrough("");
      setAdding(false);
      onAdded();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!adding) {
    return (
      <Surface rounded elevated padding={24}>
        <HStack justifyContent="space-between" alignItems="center">
          <Typography.Heading level={4}>Connect an MCP server</Typography.Heading>
          <Button.Primary label="+ Connect new MCP" onPress={() => setAdding(true)} />
        </HStack>
      </Surface>
    );
  }

  return (
    <Surface rounded elevated padding={24}>
      <VStack gap="1rem">
        <Typography.Heading level={4}>Connect an MCP server</Typography.Heading>
        <Typography.Caption>
          Only local (stdio) MCP servers are supported — a command this machine can run, e.g. "npx" with args
          "-y @some/mcp-server", or "python3" with args "my_server.py". The server launches on this machine
          when you discover or run its tools.
        </Typography.Caption>
        <HStack gap="1rem" style={{ flexWrap: "wrap" }} alignItems="flex-end">
          <div style={{ width: 240 }}>
            <InputGroup
              type="Text"
              label="Name"
              inputProps={{ value: name, onChange: setName, accessibilityLabel: "MCP server name" }}
            />
          </div>
          <div style={{ width: 240 }}>
            <InputGroup
              type="Text"
              label="Command"
              inputProps={{ value: command, onChange: setCommand, accessibilityLabel: "MCP server command" }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <InputGroup
              type="Text"
              label="Args (space-separated)"
              inputProps={{ value: args, onChange: setArgs, accessibilityLabel: "MCP server args" }}
            />
          </div>
        </HStack>
        <div style={{ width: 400 }}>
          <InputGroup
            type="Text"
            label="Env vars to pass through (space-separated names)"
            description="Values are never typed here or stored by this app — export them in the shell that starts the backend, and only the name you list gets forwarded into this server's process."
            inputProps={{
              value: envPassthrough,
              onChange: setEnvPassthrough,
              accessibilityLabel: "MCP server env passthrough",
            }}
          />
        </div>
        <HStack gap="1rem" alignItems="center">
          <Button.Primary
            label={saving ? "Connecting…" : "Connect"}
            onPress={handleCreate}
            disabled={!name || !command || saving}
          />
          <Button.Secondary label="Cancel" onPress={() => setAdding(false)} disabled={saving} />
        </HStack>
        {error && <Alert level="error" title={error} />}
      </VStack>
    </Surface>
  );
}

function McpToolsPanel() {
  const [servers, setServers] = useState<McpServer[]>([]);

  async function refresh() {
    setServers(await api.listMcpServers());
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <VStack gap="1.5rem">
      <AddMcpServerForm onAdded={refresh} />
      <VStack gap="1rem">
        {servers.map((s) => (
          <McpServerCard key={s.id} server={s} onChanged={refresh} />
        ))}
      </VStack>
    </VStack>
  );
}

type ToolsTab = "code" | "mcp";

export function ToolsView() {
  const [tab, setTab] = useState<ToolsTab>("code");

  return (
    <VStack gap="1.5rem">
      <HStack justifyContent="space-between" alignItems="center">
        <Typography.Heading level={3}>Tools</Typography.Heading>
        <SegmentedControl<ToolsTab>
          options={[
            { label: "Code", value: "code" },
            { label: "MCP", value: "mcp" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </HStack>

      {tab === "code" ? <CodeToolsPanel /> : <McpToolsPanel />}
    </VStack>
  );
}
