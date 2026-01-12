// Canvases barrel export

// Business
export { Kanban } from './kanban';
export { Pipeline } from './pipeline';
export { Dashboard } from './dashboard';
export { InvoiceCanvas } from './invoice';
export { GanttCanvas } from './gantt';
export { OrgChartCanvas } from './org-chart';

// Travel
export { HotelCanvas } from './hotel';
export { ItineraryCanvas } from './itinerary';

// Personal
export { BudgetCanvas } from './budget';
export { SmartHomeCanvas } from './smart-home';
export { WorkoutCanvas } from './workout';

// Creative
export { PlaylistCanvas } from './playlist';

// Development
export { GitDiffCanvas } from './git-diff';

// AI
export { AgentDashboard } from './agent-dashboard';

// Registry
export { canvasRegistry, getCanvas, getAllCanvases, getCanvasesByCategory, searchCanvases } from './registry';
export type { CanvasDefinition } from './registry';
