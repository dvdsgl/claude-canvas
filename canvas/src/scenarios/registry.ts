// Scenario Registry - Central lookup for all scenarios

import type { ScenarioDefinition } from "./types";
import { displayScenario } from "./calendar/display";
import { meetingPickerScenario } from "./calendar/meeting-picker";
import { documentDisplayScenario } from "./document/display";
import { documentEditScenario } from "./document/edit";
import { emailPreviewScenario } from "./document/email-preview";
import { logsDashboardScenario, logsHeatmapScenario } from "./logs/dashboard";

// Registry of all scenarios keyed by "canvasKind:scenarioName"
const registry = new Map<string, ScenarioDefinition>();

// Register calendar scenarios
registry.set("calendar:display", displayScenario);
registry.set("calendar:meeting-picker", meetingPickerScenario);

// Register document scenarios
registry.set("document:display", documentDisplayScenario);
registry.set("document:edit", documentEditScenario);
registry.set("document:email-preview", emailPreviewScenario);

// Register logs scenarios
registry.set("logs:dashboard", logsDashboardScenario);
registry.set("logs:heatmap", logsHeatmapScenario);

export function getScenario(
  canvasKind: string,
  scenarioName: string
): ScenarioDefinition | undefined {
  return registry.get(`${canvasKind}:${scenarioName}`);
}

export function listScenarios(canvasKind?: string): ScenarioDefinition[] {
  const scenarios: ScenarioDefinition[] = [];
  for (const [key, scenario] of registry) {
    if (!canvasKind || key.startsWith(`${canvasKind}:`)) {
      scenarios.push(scenario);
    }
  }
  return scenarios;
}

export function registerScenario(scenario: ScenarioDefinition): void {
  registry.set(`${scenario.canvasKind}:${scenario.name}`, scenario);
}
