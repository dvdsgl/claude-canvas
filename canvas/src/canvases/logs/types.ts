// Logs Canvas - Type Definitions

// Log entry structure (from ~/.claude/logs/*.jsonl)
export interface ToolLogEntry {
  timestamp: string;
  session_id: string;
  event_type: string;
  tool_name: string;
  tool_type: string;
  machine_id: string;
  project: string;
  git_branch: string;
}

export interface CommandLogEntry {
  timestamp: string;
  session_id: string;
  event_type: string;
  command_name: string;
  command_args?: string;
  machine_id: string;
  project: string;
}

export interface SessionLogEntry {
  timestamp: string;
  session_id: string;
  event_type: string;
  machine_id: string;
  project: string;
  git_branch?: string;
}

// Aggregated data for display
export interface UsageStats {
  totalTools: number;
  totalCommands: number;
  totalSessions: number;
  topTools: Array<{ name: string; count: number }>;
  topCommands: Array<{ name: string; count: number }>;
  topProjects: Array<{ name: string; count: number }>;
  hourlyActivity: number[]; // 24 hours
  dailyActivity: number[]; // 7 days
}

// Heat map cell data
export interface HeatMapCell {
  hour: number;
  day: number;
  count: number;
  intensity: number; // 0-4 for color gradients
}

// View modes
export type LogsViewMode = "dashboard" | "tools" | "commands" | "sessions" | "heatmap";

// Time period filter
export type TimePeriod = "24h" | "7d" | "30d" | "all";

// Canvas configuration (from Claude)
export interface LogsConfig {
  title?: string;
  logsDir?: string; // Default: ~/.claude/logs
  period?: TimePeriod;
  view?: LogsViewMode;
  refreshInterval?: number; // ms, default 5000
  project?: string; // Filter by project
}

// Canvas result (sent back to Claude)
export interface LogsResult {
  selectedItem?: string;
  view: LogsViewMode;
  stats: UsageStats;
}

// Color palette for logs canvas
export const LOGS_COLORS = {
  primary: "cyan",
  secondary: "magenta",
  success: "green",
  warning: "yellow",
  error: "red",
  muted: "gray",
  background: "black",
  // Heat map intensity colors (low to high)
  heatmap: ["gray", "green", "yellow", "red", "magenta"] as const,
} as const;

// Focus areas for navigation
export type FocusArea = "sidebar" | "main" | "detail";

// Helper to format timestamp for display
export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Helper to format date
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Helper to calculate time period threshold
export function getPeriodThreshold(period: TimePeriod): Date {
  const now = new Date();
  switch (period) {
    case "24h":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "all":
      return new Date(0);
  }
}
