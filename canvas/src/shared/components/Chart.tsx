// Chart - Terminal-based charting components

import React from 'react';
import { Box, Text } from 'ink';
import type { DataPoint, DataSeries, ChartConfig, AxisConfig } from '../types';
import { useTerminalSize } from '../hooks';
import { formatNumber, formatPercent, CHART_COLORS, truncate } from '../utils';

// ============================================
// BAR CHART
// ============================================

export interface BarChartProps {
  data: DataPoint[];
  title?: string;
  height?: number;
  width?: number;
  horizontal?: boolean;
  showValues?: boolean;
  showLabels?: boolean;
  colors?: string[];
  maxValue?: number;
}

export function BarChart({
  data,
  title,
  height = 10,
  width,
  horizontal = true,
  showValues = true,
  showLabels = true,
  colors = CHART_COLORS,
  maxValue,
}: BarChartProps): React.ReactElement {
  const { width: termWidth } = useTerminalSize();
  const chartWidth = width || termWidth - 4;

  const max = maxValue || Math.max(...data.map(d => d.value), 1);
  const labelWidth = Math.max(...data.map(d => d.label.length), 8);

  if (horizontal) {
    const barMaxWidth = chartWidth - labelWidth - (showValues ? 12 : 2);

    return (
      <Box flexDirection="column">
        {title && <Text bold>{title}</Text>}
        {data.map((point, i) => {
          const barWidth = Math.round((point.value / max) * barMaxWidth);
          const color = point.color || colors[i % colors.length];

          return (
            <Box key={point.label}>
              <Text>{truncate(point.label, labelWidth).padEnd(labelWidth)} </Text>
              <Text color={color as never}>{'█'.repeat(barWidth)}</Text>
              {showValues && (
                <Text dimColor> {formatNumber(point.value, 1)}</Text>
              )}
            </Box>
          );
        })}
      </Box>
    );
  }

  // Vertical bar chart
  const barWidth = Math.floor((chartWidth - (showLabels ? labelWidth : 0)) / data.length) - 1;

  return (
    <Box flexDirection="column">
      {title && <Text bold>{title}</Text>}
      {Array.from({ length: height }).map((_, rowIndex) => {
        const threshold = ((height - rowIndex) / height) * max;
        return (
          <Box key={rowIndex}>
            {data.map((point, i) => {
              const color = point.color || colors[i % colors.length];
              const filled = point.value >= threshold;
              return (
                <Box key={point.label} width={barWidth + 1} justifyContent="center">
                  <Text color={filled ? color as never : undefined}>
                    {filled ? '█'.repeat(barWidth) : ' '.repeat(barWidth)}
                  </Text>
                </Box>
              );
            })}
          </Box>
        );
      })}
      {showLabels && (
        <Box>
          {data.map((point) => (
            <Box key={point.label} width={barWidth + 1} justifyContent="center">
              <Text dimColor>{truncate(point.label, barWidth)}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

// ============================================
// LINE CHART (Sparkline-style)
// ============================================

export interface LineChartProps {
  data: DataPoint[];
  title?: string;
  height?: number;
  width?: number;
  showAxis?: boolean;
  showPoints?: boolean;
  color?: string;
}

export function LineChart({
  data,
  title,
  height = 8,
  width,
  showAxis = true,
  showPoints = false,
  color = 'cyan',
}: LineChartProps): React.ReactElement {
  const { width: termWidth } = useTerminalSize();
  const chartWidth = width || termWidth - 10;

  if (data.length === 0) {
    return <Text dimColor>No data</Text>;
  }

  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // Characters for line drawing
  const chars = ['⣀', '⣤', '⣶', '⣿'];
  const pointChar = '●';

  // Build the chart grid
  const grid: string[][] = Array.from({ length: height }, () =>
    Array(chartWidth).fill(' ')
  );

  // Plot the line
  const sampledData = data.length <= chartWidth
    ? data
    : Array.from({ length: chartWidth }, (_, i) =>
        data[Math.floor(i * data.length / chartWidth)]
      );

  sampledData.forEach((point, x) => {
    const normalizedY = (point.value - min) / range;
    const y = Math.floor((1 - normalizedY) * (height - 1));
    if (y >= 0 && y < height && x < chartWidth) {
      grid[y][x] = showPoints ? pointChar : chars[Math.min(Math.floor(normalizedY * chars.length), chars.length - 1)];
    }
  });

  return (
    <Box flexDirection="column">
      {title && <Text bold>{title}</Text>}
      <Box>
        {showAxis && (
          <Box flexDirection="column" marginRight={1}>
            <Text dimColor>{formatNumber(max, 1).padStart(6)}</Text>
            {Array.from({ length: height - 2 }).map((_, i) => (
              <Text key={i}>{' '.repeat(6)}</Text>
            ))}
            <Text dimColor>{formatNumber(min, 1).padStart(6)}</Text>
          </Box>
        )}
        <Box flexDirection="column">
          {grid.map((row, i) => (
            <Text key={i} color={color as never}>{row.join('')}</Text>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

// ============================================
// PIE / DONUT CHART
// ============================================

export interface PieChartProps {
  data: DataPoint[];
  title?: string;
  showLegend?: boolean;
  showPercent?: boolean;
  donut?: boolean;
  colors?: string[];
}

export function PieChart({
  data,
  title,
  showLegend = true,
  showPercent = true,
  donut = false,
  colors = CHART_COLORS,
}: PieChartProps): React.ReactElement {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  // Simple text-based representation since true pie is hard in terminal
  return (
    <Box flexDirection="column">
      {title && <Text bold>{title}</Text>}
      <Box flexDirection="column">
        {data.map((point, i) => {
          const percent = total > 0 ? (point.value / total) * 100 : 0;
          const barWidth = Math.round(percent / 5); // 20 chars = 100%
          const color = point.color || colors[i % colors.length];

          return (
            <Box key={point.label}>
              <Text color={color as never}>{donut ? '○' : '●'} </Text>
              <Text color={color as never}>{'█'.repeat(barWidth)}{'░'.repeat(20 - barWidth)}</Text>
              {showLegend && <Text> {truncate(point.label, 15).padEnd(15)}</Text>}
              {showPercent && <Text dimColor> {formatPercent(percent, 1).padStart(6)}</Text>}
            </Box>
          );
        })}
      </Box>
      {total > 0 && (
        <Box marginTop={1}>
          <Text dimColor>Total: {formatNumber(total, 0)}</Text>
        </Box>
      )}
    </Box>
  );
}

// ============================================
// GAUGE CHART
// ============================================

export interface GaugeProps {
  value: number;
  max?: number;
  min?: number;
  title?: string;
  width?: number;
  showValue?: boolean;
  thresholds?: { value: number; color: string }[];
  unit?: string;
}

export function Gauge({
  value,
  max = 100,
  min = 0,
  title,
  width = 30,
  showValue = true,
  thresholds = [
    { value: 33, color: 'green' },
    { value: 66, color: 'yellow' },
    { value: 100, color: 'red' },
  ],
  unit = '',
}: GaugeProps): React.ReactElement {
  const range = max - min;
  const normalizedValue = Math.max(0, Math.min(1, (value - min) / range));
  const filled = Math.round(normalizedValue * width);

  // Determine color based on thresholds
  const percent = normalizedValue * 100;
  let color = 'white';
  for (const threshold of thresholds) {
    if (percent <= threshold.value) {
      color = threshold.color;
      break;
    }
  }

  return (
    <Box flexDirection="column">
      {title && <Text bold>{title}</Text>}
      <Box>
        <Text>[</Text>
        <Text color={color as never}>{'█'.repeat(filled)}</Text>
        <Text dimColor>{'░'.repeat(width - filled)}</Text>
        <Text>]</Text>
        {showValue && (
          <Text> {formatNumber(value, 1)}{unit} / {formatNumber(max, 0)}{unit}</Text>
        )}
      </Box>
    </Box>
  );
}

// ============================================
// SPARKLINE
// ============================================

export interface SparklineProps {
  values: number[];
  width?: number;
  color?: string;
  showMinMax?: boolean;
}

export function Sparkline({
  values,
  width = 20,
  color = 'cyan',
  showMinMax = false,
}: SparklineProps): React.ReactElement {
  if (values.length === 0) {
    return <Text dimColor>-</Text>;
  }

  const chars = '▁▂▃▄▅▆▇█';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // Resample if needed
  const sampled = values.length <= width
    ? values
    : Array.from({ length: width }, (_, i) =>
        values[Math.floor(i * values.length / width)]
      );

  const sparkline = sampled.map(v => {
    const normalized = (v - min) / range;
    const charIndex = Math.min(Math.floor(normalized * chars.length), chars.length - 1);
    return chars[charIndex];
  }).join('');

  return (
    <Box>
      {showMinMax && <Text dimColor>{formatNumber(min, 1)} </Text>}
      <Text color={color as never}>{sparkline}</Text>
      {showMinMax && <Text dimColor> {formatNumber(max, 1)}</Text>}
    </Box>
  );
}

// ============================================
// HEATMAP
// ============================================

export interface HeatmapProps {
  data: number[][];
  rowLabels?: string[];
  colLabels?: string[];
  title?: string;
  colorScale?: string[];
}

export function Heatmap({
  data,
  rowLabels,
  colLabels,
  title,
  colorScale = ['#0d47a1', '#1976d2', '#42a5f5', '#90caf9', '#ffee58', '#ffca28', '#ff9800', '#f44336'],
}: HeatmapProps): React.ReactElement {
  if (data.length === 0) {
    return <Text dimColor>No data</Text>;
  }

  const flatValues = data.flat();
  const min = Math.min(...flatValues);
  const max = Math.max(...flatValues);
  const range = max - min || 1;

  const chars = '░▒▓█';
  const labelWidth = rowLabels ? Math.max(...rowLabels.map(l => l.length)) : 0;

  return (
    <Box flexDirection="column">
      {title && <Text bold>{title}</Text>}
      {colLabels && (
        <Box>
          {labelWidth > 0 && <Text>{' '.repeat(labelWidth + 1)}</Text>}
          {colLabels.map(label => (
            <Text key={label} dimColor>{truncate(label, 3).padEnd(3)}</Text>
          ))}
        </Box>
      )}
      {data.map((row, rowIndex) => (
        <Box key={rowIndex}>
          {rowLabels && (
            <Text dimColor>{rowLabels[rowIndex]?.padEnd(labelWidth) || ''} </Text>
          )}
          {row.map((value, colIndex) => {
            const normalized = (value - min) / range;
            const charIndex = Math.min(Math.floor(normalized * chars.length), chars.length - 1);
            const colorIndex = Math.min(Math.floor(normalized * colorScale.length), colorScale.length - 1);

            return (
              <Text key={colIndex} backgroundColor={colorScale[colorIndex] as never}>
                {chars[charIndex].repeat(2)}
              </Text>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

// ============================================
// PROGRESS BARS
// ============================================

export interface ProgressBarProps {
  value: number;
  max?: number;
  width?: number;
  label?: string;
  showPercent?: boolean;
  color?: string;
  emptyChar?: string;
  fillChar?: string;
}

export function ProgressBar({
  value,
  max = 100,
  width = 30,
  label,
  showPercent = true,
  color = 'green',
  emptyChar = '░',
  fillChar = '█',
}: ProgressBarProps): React.ReactElement {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  const filled = Math.round((percent / 100) * width);

  return (
    <Box>
      {label && <Text>{label.padEnd(15)} </Text>}
      <Text>[</Text>
      <Text color={color as never}>{fillChar.repeat(filled)}</Text>
      <Text dimColor>{emptyChar.repeat(width - filled)}</Text>
      <Text>]</Text>
      {showPercent && <Text> {formatPercent(percent, 0).padStart(4)}</Text>}
    </Box>
  );
}

export interface MultiProgressProps {
  items: { label: string; value: number; max?: number; color?: string }[];
  width?: number;
  showPercent?: boolean;
}

export function MultiProgress({
  items,
  width = 30,
  showPercent = true,
}: MultiProgressProps): React.ReactElement {
  const labelWidth = Math.max(...items.map(i => i.label.length));

  return (
    <Box flexDirection="column">
      {items.map((item, i) => (
        <ProgressBar
          key={item.label}
          value={item.value}
          max={item.max}
          width={width}
          label={item.label.padEnd(labelWidth)}
          showPercent={showPercent}
          color={item.color || CHART_COLORS[i % CHART_COLORS.length]}
        />
      ))}
    </Box>
  );
}

// ============================================
// STACKED BAR
// ============================================

export interface StackedBarProps {
  segments: { label: string; value: number; color?: string }[];
  width?: number;
  showLegend?: boolean;
  title?: string;
}

export function StackedBar({
  segments,
  width = 40,
  showLegend = true,
  title,
}: StackedBarProps): React.ReactElement {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <Box flexDirection="column">
      {title && <Text bold>{title}</Text>}
      <Box>
        <Text>[</Text>
        {segments.map((segment, i) => {
          const segmentWidth = Math.round((segment.value / total) * width);
          const color = segment.color || CHART_COLORS[i % CHART_COLORS.length];
          return (
            <Text key={segment.label} color={color as never}>
              {'█'.repeat(segmentWidth)}
            </Text>
          );
        })}
        <Text>]</Text>
      </Box>
      {showLegend && (
        <Box marginTop={1} flexWrap="wrap">
          {segments.map((segment, i) => {
            const color = segment.color || CHART_COLORS[i % CHART_COLORS.length];
            const percent = (segment.value / total) * 100;
            return (
              <Box key={segment.label} marginRight={2}>
                <Text color={color as never}>■</Text>
                <Text> {segment.label} ({formatPercent(percent, 0)})</Text>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

// ============================================
// STAT CARD
// ============================================

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; label?: string };
  sparkline?: number[];
  color?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  sparkline,
  color = 'cyan',
}: StatCardProps): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={color as never} paddingX={1}>
      <Text dimColor>{title}</Text>
      <Text bold color={color as never}>
        {typeof value === 'number' ? formatNumber(value, 0) : value}
      </Text>
      {subtitle && <Text dimColor>{subtitle}</Text>}
      {trend && (
        <Box>
          <Text color={trend.value >= 0 ? 'green' : 'red'}>
            {trend.value >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(trend.value), 1)}
          </Text>
          {trend.label && <Text dimColor> {trend.label}</Text>}
        </Box>
      )}
      {sparkline && sparkline.length > 0 && (
        <Box marginTop={1}>
          <Sparkline values={sparkline} width={15} color={color} />
        </Box>
      )}
    </Box>
  );
}

export default {
  BarChart,
  LineChart,
  PieChart,
  Gauge,
  Sparkline,
  Heatmap,
  ProgressBar,
  MultiProgress,
  StackedBar,
  StatCard,
};
