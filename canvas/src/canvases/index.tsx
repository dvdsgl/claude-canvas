import React from "react";
import { render } from "ink";

// Original canvases
import { Calendar, type CalendarConfig } from "./calendar";
import { Document } from "./document";
import type { DocumentConfig } from "./document/types";
import { FlightCanvas } from "./flight";
import type { FlightConfig } from "./flight/types";

// New canvases
import { Kanban, type KanbanConfig } from "./kanban";
import { Pipeline, type PipelineConfig } from "./pipeline";
import { Dashboard, type DashboardConfig } from "./dashboard";
import { InvoiceCanvas, type InvoiceConfig } from "./invoice";
import { BudgetCanvas, type BudgetConfig } from "./budget";
import { HotelCanvas, type HotelConfig } from "./hotel";
import { ItineraryCanvas, type ItineraryConfig } from "./itinerary";
import { SmartHomeCanvas, type SmartHomeConfig } from "./smart-home";
import { AgentDashboard, type AgentDashboardConfig } from "./agent-dashboard";
import { WorkoutCanvas, type WorkoutConfig } from "./workout";
import { PlaylistCanvas, type PlaylistConfig } from "./playlist";
import { GanttCanvas, type GanttConfig } from "./gantt";
import { GitDiffCanvas, type GitDiffConfig } from "./git-diff";
import { OrgChartCanvas, type OrgChartConfig } from "./org-chart";

// Clear screen and hide cursor
function clearScreen() {
  process.stdout.write("\x1b[2J\x1b[H\x1b[?25l");
}

// Show cursor on exit
function showCursor() {
  process.stdout.write("\x1b[?25h");
}

export interface RenderOptions {
  socketPath?: string;
  scenario?: string;
}

export async function renderCanvas(
  kind: string,
  id: string,
  config?: unknown,
  options?: RenderOptions
): Promise<void> {
  // Clear screen before rendering
  clearScreen();

  // Ensure cursor is shown on exit
  process.on("exit", showCursor);
  process.on("SIGINT", () => {
    showCursor();
    process.exit();
  });

  switch (kind) {
    // Original canvases
    case "calendar":
      return renderCalendar(id, config as CalendarConfig | undefined, options);
    case "document":
      return renderDocument(id, config as DocumentConfig | undefined, options);
    case "flight":
      return renderFlight(id, config as FlightConfig | undefined, options);

    // Business canvases
    case "kanban":
      return renderKanban(id, config as KanbanConfig | undefined, options);
    case "pipeline":
      return renderPipeline(id, config as PipelineConfig | undefined, options);
    case "dashboard":
      return renderDashboard(id, config as DashboardConfig | undefined, options);
    case "invoice":
      return renderInvoice(id, config as InvoiceConfig | undefined, options);
    case "gantt":
      return renderGantt(id, config as GanttConfig | undefined, options);
    case "org-chart":
      return renderOrgChart(id, config as OrgChartConfig | undefined, options);

    // Travel canvases
    case "hotel":
      return renderHotel(id, config as HotelConfig | undefined, options);
    case "itinerary":
      return renderItinerary(id, config as ItineraryConfig | undefined, options);

    // Personal canvases
    case "budget":
      return renderBudget(id, config as BudgetConfig | undefined, options);
    case "smart-home":
      return renderSmartHome(id, config as SmartHomeConfig | undefined, options);
    case "workout":
      return renderWorkout(id, config as WorkoutConfig | undefined, options);

    // Creative canvases
    case "playlist":
      return renderPlaylist(id, config as PlaylistConfig | undefined, options);

    // Development canvases
    case "git-diff":
      return renderGitDiff(id, config as GitDiffConfig | undefined, options);

    // AI canvases
    case "agent-dashboard":
      return renderAgentDashboard(id, config as AgentDashboardConfig | undefined, options);

    default:
      console.error(`Unknown canvas kind: ${kind}`);
      console.log("\nAvailable canvases:");
      console.log("  - calendar, document, flight (original)");
      console.log("  - kanban, pipeline, dashboard, invoice, gantt, org-chart (business)");
      console.log("  - hotel, itinerary (travel)");
      console.log("  - budget, smart-home, workout (personal)");
      console.log("  - playlist (creative)");
      console.log("  - git-diff (development)");
      console.log("  - agent-dashboard (AI)");
      process.exit(1);
  }
}

// Original canvas renderers
async function renderCalendar(
  id: string,
  config?: CalendarConfig,
  options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <Calendar
      id={id}
      config={config}
      socketPath={options?.socketPath}
      scenario={options?.scenario || "display"}
    />,
    { exitOnCtrlC: true }
  );
  await waitUntilExit();
}

async function renderDocument(
  id: string,
  config?: DocumentConfig,
  options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <Document
      id={id}
      config={config}
      socketPath={options?.socketPath}
      scenario={options?.scenario || "display"}
    />,
    { exitOnCtrlC: true }
  );
  await waitUntilExit();
}

async function renderFlight(
  id: string,
  config?: FlightConfig,
  options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <FlightCanvas
      id={id}
      config={config}
      socketPath={options?.socketPath}
      scenario={options?.scenario || "booking"}
    />,
    { exitOnCtrlC: true }
  );
  await waitUntilExit();
}

// New canvas renderers with simpler pattern (no IPC for now)
async function renderKanban(
  id: string,
  config?: KanbanConfig,
  _options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <Kanban config={config || { columns: [] }} />,
    { exitOnCtrlC: true }
  );
  await waitUntilExit();
}

async function renderPipeline(
  id: string,
  config?: PipelineConfig,
  _options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <Pipeline config={config || { stages: [] }} />,
    { exitOnCtrlC: true }
  );
  await waitUntilExit();
}

async function renderDashboard(
  id: string,
  config?: DashboardConfig,
  _options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <Dashboard config={config || { widgets: [] }} />,
    { exitOnCtrlC: true }
  );
  await waitUntilExit();
}

async function renderInvoice(
  id: string,
  config?: InvoiceConfig,
  _options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <InvoiceCanvas config={config || {}} />,
    { exitOnCtrlC: true }
  );
  await waitUntilExit();
}

async function renderGantt(
  id: string,
  config?: GanttConfig,
  _options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <GanttCanvas config={config || { project: { id: '', name: 'Project', startDate: new Date().toISOString(), status: 'active', owner: { id: '', name: '' }, team: [], tasks: [], milestones: [] } }} />,
    { exitOnCtrlC: true }
  );
  await waitUntilExit();
}

async function renderOrgChart(
  id: string,
  config?: OrgChartConfig,
  _options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <OrgChartCanvas config={config || { root: { id: 'root', person: { id: '', name: 'CEO' }, title: 'Chief Executive Officer', children: [] } }} />,
    { exitOnCtrlC: true }
  );
  await waitUntilExit();
}

async function renderHotel(
  id: string,
  config?: HotelConfig,
  _options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <HotelCanvas config={config || { hotels: [], checkIn: new Date().toISOString(), checkOut: new Date().toISOString(), guests: 1, rooms: 1 }} />,
    { exitOnCtrlC: true }
  );
  await waitUntilExit();
}

async function renderItinerary(
  id: string,
  config?: ItineraryConfig,
  _options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <ItineraryCanvas config={config || { itinerary: { id: '', name: 'Trip', destination: '', startDate: new Date().toISOString(), endDate: new Date().toISOString(), travelers: [], days: [] } }} />,
    { exitOnCtrlC: true }
  );
  await waitUntilExit();
}

async function renderBudget(
  id: string,
  config?: BudgetConfig,
  _options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <BudgetCanvas config={config || { budget: { id: '', name: 'Budget', period: 'monthly', categories: [], startDate: new Date().toISOString(), endDate: new Date().toISOString() } }} />,
    { exitOnCtrlC: true }
  );
  await waitUntilExit();
}

async function renderSmartHome(
  id: string,
  config?: SmartHomeConfig,
  _options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <SmartHomeCanvas config={config || { devices: [], rooms: [] }} />,
    { exitOnCtrlC: true }
  );
  await waitUntilExit();
}

async function renderWorkout(
  id: string,
  config?: WorkoutConfig,
  _options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <WorkoutCanvas config={config || {}} />,
    { exitOnCtrlC: true }
  );
  await waitUntilExit();
}

async function renderPlaylist(
  id: string,
  config?: PlaylistConfig,
  _options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <PlaylistCanvas config={config || { playlist: { id: '', name: 'Playlist', items: [], duration: 0, createdBy: { id: '', name: '' }, isPublic: false } }} />,
    { exitOnCtrlC: true }
  );
  await waitUntilExit();
}

async function renderGitDiff(
  id: string,
  config?: GitDiffConfig,
  _options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <GitDiffCanvas config={config || { files: [] }} />,
    { exitOnCtrlC: true }
  );
  await waitUntilExit();
}

async function renderAgentDashboard(
  id: string,
  config?: AgentDashboardConfig,
  _options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <AgentDashboard config={config || { agents: [] }} />,
    { exitOnCtrlC: true }
  );
  await waitUntilExit();
}

// Re-export for direct imports
export { Calendar } from "./calendar";
export { Document } from "./document";
export { FlightCanvas } from "./flight";
export { Kanban } from "./kanban";
export { Pipeline } from "./pipeline";
export { Dashboard } from "./dashboard";
export { InvoiceCanvas } from "./invoice";
export { BudgetCanvas } from "./budget";
export { HotelCanvas } from "./hotel";
export { ItineraryCanvas } from "./itinerary";
export { SmartHomeCanvas } from "./smart-home";
export { AgentDashboard } from "./agent-dashboard";
export { WorkoutCanvas } from "./workout";
export { PlaylistCanvas } from "./playlist";
export { GanttCanvas } from "./gantt";
export { GitDiffCanvas } from "./git-diff";
export { OrgChartCanvas } from "./org-chart";
