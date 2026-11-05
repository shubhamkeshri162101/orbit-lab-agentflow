import { useState } from "react";
import type { Workflow } from "../api";
import { WorkflowBuilderView } from "./WorkflowBuilderView";
import { WorkflowDetailView } from "./WorkflowDetailView";
import { WorkflowsListView } from "./WorkflowsListView";

type Screen = { type: "list" } | { type: "create" } | { type: "detail"; workflowId: string };

export function WorkflowGraphView() {
  const [screen, setScreen] = useState<Screen>({ type: "list" });

  if (screen.type === "list") {
    return (
      <WorkflowsListView
        onCreate={() => setScreen({ type: "create" })}
        onOpen={(workflow) => setScreen({ type: "detail", workflowId: workflow.id })}
      />
    );
  }

  if (screen.type === "detail") {
    return (
      <WorkflowDetailView
        workflowId={screen.workflowId}
        onBack={() => setScreen({ type: "list" })}
        onCloned={(clone) => setScreen({ type: "detail", workflowId: clone.id })}
      />
    );
  }

  return (
    <WorkflowBuilderView onDone={() => setScreen({ type: "list" })} onCancel={() => setScreen({ type: "list" })} />
  );
}
