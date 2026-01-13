// Logs Dashboard Scenario

import type { ScenarioDefinition } from "../types";
import type { LogsConfig } from "../../canvases/logs/types";

export const logsDashboardScenario: ScenarioDefinition<LogsConfig> = {
  name: "dashboard",
  description: "View Claude Code usage statistics and activity",
  canvasKind: "logs",
  interactionMode: "view-only",
  closeOn: "escape",
  defaultConfig: {
    period: "7d",
    view: "dashboard",
    refreshInterval: 10000,
  },
};

export const logsHeatmapScenario: ScenarioDefinition<LogsConfig> = {
  name: "heatmap",
  description: "View activity heat map by hour and day",
  canvasKind: "logs",
  interactionMode: "view-only",
  closeOn: "escape",
  defaultConfig: {
    period: "7d",
    view: "heatmap",
    refreshInterval: 10000,
  },
};
