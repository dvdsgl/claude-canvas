// Dashboard Canvas - Multi-widget dashboard display

import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { useTerminalSize, useInterval } from '../../shared/hooks';
import {
  BarChart, LineChart, PieChart, Gauge, Sparkline,
  ProgressBar, StatCard, MultiProgress
} from '../../shared/components/Chart';
import type { DataPoint, DataSeries, Money } from '../../shared/types';
import { formatMoney, formatNumber, formatPercent, truncate } from '../../shared/utils';

export type WidgetType =
  | 'stat'
  | 'chart-bar'
  | 'chart-line'
  | 'chart-pie'
  | 'gauge'
  | 'sparkline'
  | 'progress'
  | 'table'
  | 'list'
  | 'text';

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  data: unknown;
  width?: number; // 1-4 columns
  height?: number; // rows
  refreshInterval?: number; // ms
  color?: string;
}

export interface DashboardConfig {
  title?: string;
  subtitle?: string;
  widgets: Widget[];
  columns?: number;
  refreshInterval?: number;
  showTimestamp?: boolean;
}

export interface DashboardResult {
  action: 'select' | 'refresh' | 'drill-down';
  widgetId: string;
  data?: unknown;
}

export interface DashboardProps {
  config: DashboardConfig;
  onResult?: (result: DashboardResult) => void;
}

export function Dashboard({ config, onResult }: DashboardProps): React.ReactElement {
  const { width, height } = useTerminalSize();
  const { exit } = useApp();
  const {
    title,
    subtitle,
    widgets,
    columns = 3,
    refreshInterval,
    showTimestamp = true,
  } = config;

  const [selectedWidget, setSelectedWidget] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Auto-refresh
  useInterval(() => {
    setLastRefresh(new Date());
    onResult?.({ action: 'refresh', widgetId: 'all' });
  }, refreshInterval || null);

  const columnWidth = Math.floor((width - 4) / columns);

  useInput((input, key) => {
    if (key.escape) {
      exit();
      return;
    }

    // Navigation
    if (key.leftArrow) {
      setSelectedWidget(w => Math.max(0, w - 1));
    }
    if (key.rightArrow) {
      setSelectedWidget(w => Math.min(widgets.length - 1, w + 1));
    }
    if (key.upArrow) {
      setSelectedWidget(w => Math.max(0, w - columns));
    }
    if (key.downArrow) {
      setSelectedWidget(w => Math.min(widgets.length - 1, w + columns));
    }

    // Actions
    if (key.return) {
      const widget = widgets[selectedWidget];
      if (widget) {
        onResult?.({
          action: 'select',
          widgetId: widget.id,
          data: widget.data,
        });
      }
    }

    if (input === 'd') {
      const widget = widgets[selectedWidget];
      if (widget) {
        onResult?.({
          action: 'drill-down',
          widgetId: widget.id,
          data: widget.data,
        });
      }
    }

    if (input === 'r') {
      setLastRefresh(new Date());
      onResult?.({ action: 'refresh', widgetId: 'all' });
    }
  });

  // Render individual widget
  const renderWidget = (widget: Widget, index: number) => {
    const isSelected = index === selectedWidget;
    const widgetWidth = (widget.width || 1) * columnWidth - 2;
    const widgetHeight = widget.height || 6;

    const content = (() => {
      switch (widget.type) {
        case 'stat': {
          const data = widget.data as {
            value: string | number;
            subtitle?: string;
            trend?: { value: number; label?: string };
            sparkline?: number[];
          };
          return (
            <Box flexDirection="column">
              <Text bold color={widget.color as never || 'cyan'}>
                {typeof data.value === 'number' ? formatNumber(data.value, 0) : data.value}
              </Text>
              {data.subtitle && <Text dimColor>{data.subtitle}</Text>}
              {data.trend && (
                <Text color={data.trend.value >= 0 ? 'green' : 'red'}>
                  {data.trend.value >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(data.trend.value), 1)}
                  {data.trend.label && ` ${data.trend.label}`}
                </Text>
              )}
              {data.sparkline && data.sparkline.length > 0 && (
                <Sparkline values={data.sparkline} width={widgetWidth - 4} color={widget.color || 'cyan'} />
              )}
            </Box>
          );
        }

        case 'chart-bar': {
          const data = widget.data as DataPoint[];
          return <BarChart data={data} height={widgetHeight - 2} width={widgetWidth - 2} />;
        }

        case 'chart-line': {
          const data = widget.data as DataPoint[];
          return <LineChart data={data} height={widgetHeight - 2} width={widgetWidth - 4} color={widget.color} />;
        }

        case 'chart-pie': {
          const data = widget.data as DataPoint[];
          return <PieChart data={data} showLegend={widgetWidth > 30} />;
        }

        case 'gauge': {
          const data = widget.data as { value: number; max?: number; unit?: string };
          return <Gauge value={data.value} max={data.max} unit={data.unit} width={widgetWidth - 4} />;
        }

        case 'sparkline': {
          const data = widget.data as number[];
          return <Sparkline values={data} width={widgetWidth - 4} showMinMax color={widget.color} />;
        }

        case 'progress': {
          const data = widget.data as { label: string; value: number; max?: number; color?: string }[];
          return <MultiProgress items={data} width={widgetWidth - 10} />;
        }

        case 'table': {
          const data = widget.data as { columns: string[]; rows: string[][] };
          return (
            <Box flexDirection="column">
              <Box>
                {data.columns.map(col => (
                  <Text key={col} bold>{truncate(col, 12).padEnd(12)}</Text>
                ))}
              </Box>
              {data.rows.slice(0, widgetHeight - 3).map((row, i) => (
                <Box key={i}>
                  {row.map((cell, j) => (
                    <Text key={j} dimColor={i % 2 === 1}>{truncate(cell, 12).padEnd(12)}</Text>
                  ))}
                </Box>
              ))}
            </Box>
          );
        }

        case 'list': {
          const data = widget.data as { items: { label: string; value?: string | number }[] };
          return (
            <Box flexDirection="column">
              {data.items.slice(0, widgetHeight - 2).map((item, i) => (
                <Box key={i} justifyContent="space-between">
                  <Text>{truncate(item.label, widgetWidth - 15)}</Text>
                  {item.value !== undefined && (
                    <Text color={widget.color as never}>{item.value}</Text>
                  )}
                </Box>
              ))}
            </Box>
          );
        }

        case 'text': {
          const data = widget.data as { content: string };
          return <Text>{data.content}</Text>;
        }

        default:
          return <Text dimColor>Unknown widget type</Text>;
      }
    })();

    return (
      <Box
        key={widget.id}
        flexDirection="column"
        borderStyle={isSelected ? 'bold' : 'round'}
        borderColor={isSelected ? 'cyan' : 'gray'}
        width={widgetWidth}
        height={widgetHeight}
        paddingX={1}
      >
        <Text bold dimColor={!isSelected}>{truncate(widget.title, widgetWidth - 4)}</Text>
        {content}
      </Box>
    );
  };

  // Arrange widgets in rows
  const rows: Widget[][] = [];
  let currentRow: Widget[] = [];
  let currentRowWidth = 0;

  widgets.forEach(widget => {
    const widgetCols = widget.width || 1;
    if (currentRowWidth + widgetCols > columns) {
      if (currentRow.length > 0) {
        rows.push(currentRow);
      }
      currentRow = [widget];
      currentRowWidth = widgetCols;
    } else {
      currentRow.push(widget);
      currentRowWidth += widgetCols;
    }
  });
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  // Calculate widget indices for navigation
  let widgetIndex = 0;
  const widgetIndices: number[][] = rows.map(row => {
    return row.map(() => widgetIndex++);
  });

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Box flexDirection="column">
          <Text bold color="cyan">{title || 'Dashboard'}</Text>
          {subtitle && <Text dimColor>{subtitle}</Text>}
        </Box>
        {showTimestamp && (
          <Text dimColor>
            Last updated: {lastRefresh.toLocaleTimeString()}
          </Text>
        )}
      </Box>

      {/* Widgets grid */}
      <Box flexDirection="column" gap={1}>
        {rows.map((row, rowIndex) => {
          const rowIndices = widgetIndices[rowIndex] ?? [];
          return (
            <Box key={rowIndex} gap={1}>
              {row.map((widget, colIndex) => {
                const globalIndex = rowIndices[colIndex] ?? 0;
                return renderWidget(widget, globalIndex);
              })}
            </Box>
          );
        })}
      </Box>

      {/* Footer */}
      <Box marginTop={1} gap={2}>
        <Text dimColor><Text bold>←→↑↓</Text> navigate</Text>
        <Text dimColor><Text bold>Enter</Text> select</Text>
        <Text dimColor><Text bold>d</Text> drill-down</Text>
        <Text dimColor><Text bold>r</Text> refresh</Text>
        <Text dimColor><Text bold>ESC</Text> exit</Text>
      </Box>
    </Box>
  );
}

export default Dashboard;
