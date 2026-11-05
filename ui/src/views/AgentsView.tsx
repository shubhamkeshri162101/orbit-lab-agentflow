import { useState } from "react";
import type { Agent } from "../api";
import { AgentDetailView } from "./AgentDetailView";
import { AgentEditorView } from "./AgentEditorView";
import { AgentsListView } from "./AgentsListView";

type Screen = { type: "list" } | { type: "create" } | { type: "detail"; agentId: string };

export function AgentsView() {
  const [screen, setScreen] = useState<Screen>({ type: "list" });

  if (screen.type === "list") {
    return (
      <AgentsListView
        onCreate={() => setScreen({ type: "create" })}
        onOpen={(agent) => setScreen({ type: "detail", agentId: agent.id })}
      />
    );
  }

  if (screen.type === "detail") {
    return (
      <AgentDetailView
        agentId={screen.agentId}
        onBack={() => setScreen({ type: "list" })}
        onCloned={(clone) => setScreen({ type: "detail", agentId: clone.id })}
      />
    );
  }

  return <AgentEditorView onDone={() => setScreen({ type: "list" })} onCancel={() => setScreen({ type: "list" })} />;
}
