import {
  Button,
  IconButton,
  InputGroup,
  List,
  Logo,
  Surface,
  TimberProvider,
  Typography,
} from "@oaknorthbank/components";
import { colours } from "@oaknorthbank/components/theme";
import "@oaknorthbank/components/styles.css";
import IconPencil from "@oaknorthbank/graphics/icons/IconPencil";
import { useState } from "react";
import { HStack, VStack } from "./components/Stacks";
import { getCurrentUser, setCurrentUser } from "./currentUser";
import { AgentsView } from "./views/AgentsView";
import { ModelsView } from "./views/ModelsView";
import { ToolsView } from "./views/ToolsView";
import { WorkflowGraphView } from "./views/WorkflowGraphView";

function IdentityControl() {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(getCurrentUser());

  function handleSave() {
    setCurrentUser(name);
    // Every list is scoped by the X-User header sent on each request, so the
    // simplest correct refresh after switching identity is a full reload.
    window.location.reload();
  }

  if (!editing) {
    return (
      <HStack gap="0.4rem" alignItems="center">
        <VStack gap="0">
          <Typography.Caption>Signed in as</Typography.Caption>
          <Typography.Body small fontWeight="semibold">
            {getCurrentUser()}
          </Typography.Body>
        </VStack>
        <IconButton.Outlined icon={IconPencil} label="Change name" onPress={() => setEditing(true)} />
      </HStack>
    );
  }

  return (
    <VStack gap="0.5rem">
      <InputGroup
        type="Text"
        label="Your name"
        inputProps={{ value: name, onChange: setName, accessibilityLabel: "Your name" }}
      />
      <HStack gap="0.5rem">
        <Button.Primary label="Save" onPress={handleSave} disabled={!name.trim()} />
        <Button.Flat label="Cancel" onPress={() => setEditing(false)} />
      </HStack>
    </VStack>
  );
}

type Tab = "agents" | "workflows" | "tools" | "models";

const TABS: { key: Tab; label: string }[] = [
  { key: "agents", label: "Agents" },
  { key: "workflows", label: "Workflows" },
  { key: "tools", label: "Tools" },
  { key: "models", label: "Models" },
];

const SIDEBAR_WIDTH = 240;

export function App() {
  const [tab, setTab] = useState<Tab>("agents");

  return (
    <Surface theme="light" transparent>
      <TimberProvider>
        <div style={{ display: "flex", height: "100vh" }}>
          <div
            style={{
              width: SIDEBAR_WIDTH,
              flexShrink: 0,
              height: "100vh",
              position: "sticky",
              top: 0,
              overflowY: "auto",
              borderRight: `1px solid ${colours.neutral["200"]}`,
              backgroundColor: colours.neutral.white,
              padding: "24px 16px",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <VStack gap="1.5rem" style={{ flex: 1 }}>
              <VStack gap="0.25rem">
                <HStack gap="0.5rem" alignItems="center">
                  <Logo.OakNorth size={24} />
                  <Typography.Heading level={4}>LABS</Typography.Heading>
                </HStack>
                <Typography.Caption>Linear agent chaining with shared state.</Typography.Caption>
              </VStack>

              <List
                accessibilityLabel="Main navigation"
                type="bleed"
                items={TABS.map((t) => ({
                  type: "Link" as const,
                  props: {
                    label: t.label,
                    linkTo: "#",
                    filled: tab === t.key,
                    onPress: () => setTab(t.key),
                  },
                }))}
              />
            </VStack>

            <IdentityControl />
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "40px",
              backgroundColor: colours.neutral["100"],
            }}
          >
            {tab === "agents" && <AgentsView />}
            {tab === "workflows" && <WorkflowGraphView />}
            {tab === "tools" && <ToolsView />}
            {tab === "models" && <ModelsView />}
          </div>
        </div>
      </TimberProvider>
    </Surface>
  );
}
