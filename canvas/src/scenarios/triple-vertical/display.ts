// Triple Vertical Display Scenario - Three-section vertical layout

import type { ScenarioDefinition } from "../types";
import type { TripleVerticalConfig } from "../../canvases/triple-vertical";

export const tripleVerticalDisplayScenario: ScenarioDefinition<TripleVerticalConfig, void> = {
  name: "display",
  description: "Three-section vertical layout with terminal, Claude Code, and output panels",
  canvasKind: "triple-vertical",
  interactionMode: "view-only",
  closeOn: "escape",
  defaultConfig: {
    title: "Claude Code Workspace",
    topPanelTitle: "Terminal",
    middlePanelTitle: "Claude Code",
    bottomPanelTitle: "Output",
    sectionRatio: [1, 2, 1],
  },
};
