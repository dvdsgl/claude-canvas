// Log Parser - Reads and aggregates Claude logs

import { homedir } from "os";
import { join } from "path";
import {
  type ToolLogEntry,
  type CommandLogEntry,
  type SessionLogEntry,
  type UsageStats,
  type HeatMapCell,
  type TimePeriod,
  getPeriodThreshold,
} from "./types";

const LOGS_DIR = join(homedir(), ".claude", "logs");

// Parse multi-line JSON entries from log file
async function parseLogFile<T>(filename: string): Promise<T[]> {
  const filepath = join(LOGS_DIR, filename);
  const file = Bun.file(filepath);

  if (!(await file.exists())) {
    return [];
  }

  const content = await file.text();
  const entries: T[] = [];

  // Split by closing brace + newline + opening brace pattern
  // Logs are pretty-printed JSON objects
  const jsonStrings = content.split(/\n}\n{/).map((chunk, index, arr) => {
    if (index === 0) return chunk + "\n}";
    if (index === arr.length - 1) return "{" + chunk;
    return "{" + chunk + "\n}";
  });

  for (const jsonStr of jsonStrings) {
    try {
      const trimmed = jsonStr.trim();
      if (trimmed) {
        entries.push(JSON.parse(trimmed));
      }
    } catch {
      // Skip malformed entries
    }
  }

  return entries;
}

// Filter entries by time period
function filterByPeriod<T extends { timestamp: string }>(
  entries: T[],
  period: TimePeriod
): T[] {
  const threshold = getPeriodThreshold(period);
  return entries.filter((e) => new Date(e.timestamp) >= threshold);
}

// Count occurrences and return top N
function countAndSort(
  items: string[],
  topN: number = 10
): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

// Calculate hourly activity (24 buckets)
function calculateHourlyActivity(timestamps: string[]): number[] {
  const hours = new Array(24).fill(0);
  for (const ts of timestamps) {
    const hour = new Date(ts).getHours();
    hours[hour]++;
  }
  return hours;
}

// Calculate daily activity (7 buckets, 0=Sunday)
function calculateDailyActivity(timestamps: string[]): number[] {
  const days = new Array(7).fill(0);
  for (const ts of timestamps) {
    const day = new Date(ts).getDay();
    days[day]++;
  }
  return days;
}

// Build heat map data (hour x day of week)
export function buildHeatMap(timestamps: string[]): HeatMapCell[] {
  const grid = new Map<string, number>();

  for (const ts of timestamps) {
    const date = new Date(ts);
    const hour = date.getHours();
    const day = date.getDay();
    const key = `${hour}-${day}`;
    grid.set(key, (grid.get(key) || 0) + 1);
  }

  const maxCount = Math.max(...grid.values(), 1);
  const cells: HeatMapCell[] = [];

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const key = `${hour}-${day}`;
      const count = grid.get(key) || 0;
      const intensity = Math.min(4, Math.floor((count / maxCount) * 5));
      cells.push({ hour, day, count, intensity });
    }
  }

  return cells;
}

// Main function to load and aggregate all logs
export async function loadUsageStats(
  period: TimePeriod = "7d",
  projectFilter?: string
): Promise<UsageStats> {
  // Load all log files in parallel
  const [toolEntries, commandEntries, sessionEntries] = await Promise.all([
    parseLogFile<ToolLogEntry>("usage-tools.jsonl"),
    parseLogFile<CommandLogEntry>("usage-commands.jsonl"),
    parseLogFile<SessionLogEntry>("usage-sessions.jsonl"),
  ]);

  // Filter by period
  let filteredTools = filterByPeriod(toolEntries, period);
  let filteredCommands = filterByPeriod(commandEntries, period);
  let filteredSessions = filterByPeriod(sessionEntries, period);

  // Filter by project if specified
  if (projectFilter) {
    filteredTools = filteredTools.filter((e) => e.project === projectFilter);
    filteredCommands = filteredCommands.filter((e) => e.project === projectFilter);
    filteredSessions = filteredSessions.filter((e) => e.project === projectFilter);
  }

  // Aggregate stats
  const toolNames = filteredTools.map((e) => e.tool_name).filter((n) => n !== "unknown");
  const commandNames = filteredCommands.map((e) => e.command_name);
  const projects = [
    ...filteredTools.map((e) => e.project),
    ...filteredCommands.map((e) => e.project),
    ...filteredSessions.map((e) => e.project),
  ];

  const allTimestamps = [
    ...filteredTools.map((e) => e.timestamp),
    ...filteredCommands.map((e) => e.timestamp),
    ...filteredSessions.map((e) => e.timestamp),
  ];

  return {
    totalTools: filteredTools.length,
    totalCommands: filteredCommands.length,
    totalSessions: filteredSessions.length,
    topTools: countAndSort(toolNames),
    topCommands: countAndSort(commandNames),
    topProjects: countAndSort(projects),
    hourlyActivity: calculateHourlyActivity(allTimestamps),
    dailyActivity: calculateDailyActivity(allTimestamps),
  };
}

// Get all timestamps for heat map
export async function getAllTimestamps(
  period: TimePeriod = "7d"
): Promise<string[]> {
  const [toolEntries, commandEntries, sessionEntries] = await Promise.all([
    parseLogFile<ToolLogEntry>("usage-tools.jsonl"),
    parseLogFile<CommandLogEntry>("usage-commands.jsonl"),
    parseLogFile<SessionLogEntry>("usage-sessions.jsonl"),
  ]);

  const allEntries = [...toolEntries, ...commandEntries, ...sessionEntries];
  const filtered = filterByPeriod(allEntries, period);

  return filtered.map((e) => e.timestamp);
}
