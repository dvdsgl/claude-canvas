// Logs Canvas - Claude Code Usage Visualization

import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import { useIPC } from "./calendar/hooks/use-ipc";
import {
  type LogsConfig,
  type LogsResult,
  type LogsViewMode,
  type TimePeriod,
  type UsageStats,
  type HeatMapCell,
  LOGS_COLORS,
} from "./logs/types";
import { loadUsageStats, getAllTimestamps, buildHeatMap } from "./logs/parser";
import { StatsCard, BarChart, HeatMap } from "./logs/components";

interface Props {
  id: string;
  config?: LogsConfig;
  socketPath?: string;
  scenario?: string;
}

export function LogsCanvas({
  id,
  config: initialConfig,
  socketPath,
  scenario = "dashboard",
}: Props) {
  const { exit } = useApp();
  const { stdout } = useStdout();

  // Terminal dimensions
  const [dimensions, setDimensions] = useState({
    width: stdout?.columns || 120,
    height: stdout?.rows || 40,
  });

  // Config state
  const [config, setConfig] = useState<LogsConfig | undefined>(initialConfig);

  // View state
  const [viewMode, setViewMode] = useState<LogsViewMode>(
    initialConfig?.view || "dashboard"
  );
  const [period, setPeriod] = useState<TimePeriod>(
    initialConfig?.period || "7d"
  );

  // Data state
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [heatMapData, setHeatMapData] = useState<HeatMapCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected item for detail view
  const [selectedIndex, setSelectedIndex] = useState(0);

  // IPC connection
  const ipc = useIPC({
    socketPath,
    scenario,
    onClose: () => exit(),
    onUpdate: (newConfig) => {
      setConfig(newConfig as LogsConfig);
      if ((newConfig as LogsConfig).period) {
        setPeriod((newConfig as LogsConfig).period!);
      }
      if ((newConfig as LogsConfig).view) {
        setViewMode((newConfig as LogsConfig).view!);
      }
    },
  });

  // Listen for terminal resize
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: stdout?.columns || 120,
        height: stdout?.rows || 40,
      });
    };
    stdout?.on("resize", updateDimensions);
    updateDimensions();
    return () => {
      stdout?.off("resize", updateDimensions);
    };
  }, [stdout]);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, timestamps] = await Promise.all([
        loadUsageStats(period, config?.project),
        getAllTimestamps(period),
      ]);
      setStats(statsData);
      setHeatMapData(buildHeatMap(timestamps));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [period, config?.project]);

  // Initial load and refresh
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, config?.refreshInterval || 10000);
    return () => clearInterval(interval);
  }, [loadData, config?.refreshInterval]);

  // Keyboard navigation
  useInput((input, key) => {
    // Quit
    if (input === "q" || key.escape) {
      exit();
      return;
    }

    // Period switching (1-4)
    if (input === "1") setPeriod("24h");
    if (input === "2") setPeriod("7d");
    if (input === "3") setPeriod("30d");
    if (input === "4") setPeriod("all");

    // View switching (Tab or v)
    if (key.tab || input === "v") {
      const views: LogsViewMode[] = ["dashboard", "tools", "commands", "heatmap"];
      const currentIndex = views.indexOf(viewMode);
      const nextView = views[(currentIndex + 1) % views.length];
      if (nextView) {
        setViewMode(nextView);
        setSelectedIndex(0);
      }
    }

    // Navigation within lists
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
    }
    if (key.downArrow) {
      const maxIndex = viewMode === "tools"
        ? (stats?.topTools.length || 1) - 1
        : viewMode === "commands"
        ? (stats?.topCommands.length || 1) - 1
        : 0;
      setSelectedIndex((i) => Math.min(maxIndex, i + 1));
    }

    // Refresh
    if (input === "r") {
      loadData();
    }
  });

  // Layout calculations
  const termWidth = dimensions.width;
  const termHeight = dimensions.height;
  const headerHeight = 3;
  const statusBarHeight = 2;
  const contentHeight = termHeight - headerHeight - statusBarHeight;

  // Render loading state
  if (loading && !stats) {
    return (
      <Box flexDirection="column" width={termWidth} height={termHeight}>
        <Box justifyContent="center" alignItems="center" height={termHeight}>
          <Text color={LOGS_COLORS.primary}>Loading Claude logs...</Text>
        </Box>
      </Box>
    );
  }

  // Render error state
  if (error) {
    return (
      <Box flexDirection="column" width={termWidth} height={termHeight}>
        <Box justifyContent="center" alignItems="center" height={termHeight}>
          <Text color={LOGS_COLORS.error}>Error: {error}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight}>
      {/* Header */}
      <Box
        borderStyle="double"
        borderColor={LOGS_COLORS.secondary}
        paddingX={1}
        justifyContent="space-between"
      >
        <Text color={LOGS_COLORS.secondary} bold>
          {config?.title || "// CLAUDE_LOGS_DASHBOARD //"}
        </Text>
        <Box>
          <Text color={LOGS_COLORS.muted}>Period: </Text>
          <Text color={LOGS_COLORS.primary} bold>
            {period}
          </Text>
          <Text color={LOGS_COLORS.muted}> | View: </Text>
          <Text color={LOGS_COLORS.primary} bold>
            {viewMode}
          </Text>
          {loading && <Text color={LOGS_COLORS.warning}> (refreshing...)</Text>}
        </Box>
      </Box>

      {/* Main content */}
      <Box flexDirection="column" height={contentHeight} paddingX={1}>
        {viewMode === "dashboard" && stats && (
          <DashboardView stats={stats} width={termWidth - 4} height={contentHeight - 2} />
        )}
        {viewMode === "tools" && stats && (
          <BarChart
            items={stats.topTools}
            maxWidth={termWidth - 4}
            title="Top Tools"
          />
        )}
        {viewMode === "commands" && stats && (
          <BarChart
            items={stats.topCommands}
            maxWidth={termWidth - 4}
            title="Top Commands"
          />
        )}
        {viewMode === "heatmap" && (
          <HeatMap cells={heatMapData} width={termWidth - 4} />
        )}
      </Box>

      {/* Status bar */}
      <Box
        borderStyle="single"
        borderColor={LOGS_COLORS.muted}
        paddingX={1}
        justifyContent="space-between"
      >
        <Text color={LOGS_COLORS.muted}>
          1-4: period | Tab/v: view | r: refresh | q: quit
        </Text>
        <Text color={LOGS_COLORS.muted}>
          {stats
            ? `${stats.totalTools} tools | ${stats.totalCommands} cmds | ${stats.totalSessions} sessions`
            : ""}
        </Text>
      </Box>
    </Box>
  );
}

// Dashboard view component
function DashboardView({
  stats,
  width,
  height,
}: {
  stats: UsageStats;
  width: number;
  height: number;
}) {
  return (
    <Box flexDirection="column">
      {/* Stats row */}
      <Box marginBottom={1}>
        <StatsCard label="Total Tools" value={stats.totalTools} color={LOGS_COLORS.primary} />
        <StatsCard label="Commands" value={stats.totalCommands} color={LOGS_COLORS.success} />
        <StatsCard label="Sessions" value={stats.totalSessions} color={LOGS_COLORS.warning} />
      </Box>

      {/* Charts row */}
      <Box>
        <Box flexDirection="column" width={Math.floor(width / 2)} marginRight={2}>
          <BarChart items={stats.topTools} maxWidth={Math.floor(width / 2) - 2} title="Top Tools" maxItems={5} />
        </Box>
        <Box flexDirection="column" width={Math.floor(width / 2)}>
          <BarChart items={stats.topCommands} maxWidth={Math.floor(width / 2) - 2} title="Top Commands" maxItems={5} />
        </Box>
      </Box>

      {/* Projects */}
      <Box marginTop={1}>
        <BarChart items={stats.topProjects} maxWidth={width} title="Top Projects" maxItems={5} />
      </Box>
    </Box>
  );
}
