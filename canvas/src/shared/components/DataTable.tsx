// DataTable - A flexible, sortable, filterable table component

import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Column, SortConfig } from '../types';
import { useNavigation, useTerminalSize, useSelection } from '../hooks';
import { formatMoney, formatDate, formatDateTime, formatPercent, truncate, padRight } from '../utils';

export interface DataTableProps<T extends Record<string, unknown>> {
  data: T[];
  columns: Column<T>[];
  onSelect?: (row: T, index: number) => void;
  onActivate?: (row: T, index: number) => void;
  selectable?: boolean;
  multiSelect?: boolean;
  sortable?: boolean;
  maxHeight?: number;
  showHeader?: boolean;
  showBorder?: boolean;
  showRowNumbers?: boolean;
  striped?: boolean;
  compact?: boolean;
  emptyMessage?: string;
  keyField?: keyof T;
  initialSort?: SortConfig;
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  onSelect,
  onActivate,
  selectable = true,
  multiSelect = false,
  sortable = true,
  maxHeight,
  showHeader = true,
  showBorder = true,
  showRowNumbers = false,
  striped = false,
  compact = false,
  emptyMessage = 'No data',
  keyField = 'id' as keyof T,
  initialSort,
}: DataTableProps<T>): React.ReactElement {
  const { width } = useTerminalSize();
  const [sortConfig, setSortConfig] = useState<SortConfig | undefined>(initialSort);
  const [sortColumnIndex, setSortColumnIndex] = useState(0);
  const [isSortMode, setIsSortMode] = useState(false);

  // Calculate column widths
  const columnWidths = useMemo(() => {
    const availableWidth = width - (showBorder ? 4 : 0) - (showRowNumbers ? 5 : 0);
    const totalSpecified = columns.reduce((sum, col) => sum + (col.width || 0), 0);
    const unspecifiedCount = columns.filter(col => !col.width).length;
    const remainingWidth = Math.max(0, availableWidth - totalSpecified);
    const defaultWidth = unspecifiedCount > 0 ? Math.floor(remainingWidth / unspecifiedCount) : 10;

    return columns.map(col => col.width || Math.max(defaultWidth, 8));
  }, [columns, width, showBorder, showRowNumbers]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.column];
      const bVal = b[sortConfig.column];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison = aVal < bVal ? -1 : 1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [data, sortConfig]);

  // Navigation
  const { selectedIndex, setSelectedIndex } = useNavigation({
    itemCount: sortedData.length,
    onActivate: (index) => onActivate?.(sortedData[index], index),
  });

  // Multi-select
  const { selected, toggle, isSelected, selectAll, deselectAll } = useSelection(
    sortedData,
    (item) => String(item[keyField])
  );

  // Handle input
  useInput((input, key) => {
    if (isSortMode) {
      if (key.leftArrow) {
        setSortColumnIndex(i => Math.max(0, i - 1));
      } else if (key.rightArrow) {
        setSortColumnIndex(i => Math.min(columns.length - 1, i + 1));
      } else if (key.return) {
        const col = columns[sortColumnIndex];
        if (col.sortable !== false) {
          setSortConfig(prev => {
            if (prev?.column === col.key) {
              return prev.direction === 'asc'
                ? { column: col.key, direction: 'desc' }
                : undefined;
            }
            return { column: col.key, direction: 'asc' };
          });
        }
        setIsSortMode(false);
      } else if (key.escape) {
        setIsSortMode(false);
      }
    } else {
      if (input === 's' && sortable) {
        setIsSortMode(true);
      } else if (input === ' ' && multiSelect) {
        toggle(sortedData[selectedIndex]);
      } else if (input === 'a' && multiSelect) {
        selectAll();
      } else if (input === 'd' && multiSelect) {
        deselectAll();
      } else if (key.return) {
        onSelect?.(sortedData[selectedIndex], selectedIndex);
      }
    }
  });

  // Format cell value
  const formatCell = (col: Column<T>, row: T): string => {
    const value = row[col.key];

    if (col.render) {
      return col.render(value, row);
    }

    if (value === null || value === undefined) {
      return '-';
    }

    switch (col.format) {
      case 'currency':
        return formatMoney({ amount: Number(value), currency: 'USD' });
      case 'date':
        return formatDate(String(value));
      case 'datetime':
        return formatDateTime(String(value));
      case 'percent':
        return formatPercent(Number(value));
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'number':
        return Number(value).toLocaleString();
      default:
        return String(value);
    }
  };

  // Calculate visible rows
  const visibleRowCount = maxHeight ? Math.min(maxHeight - (showHeader ? 2 : 0), sortedData.length) : sortedData.length;
  const scrollOffset = Math.max(0, Math.min(selectedIndex - Math.floor(visibleRowCount / 2), sortedData.length - visibleRowCount));
  const visibleRows = sortedData.slice(scrollOffset, scrollOffset + visibleRowCount);

  const rowHeight = compact ? 1 : 1;
  const borderChar = showBorder ? '│' : '';
  const headerBorderTop = showBorder ? '┌' + columns.map((_, i) => '─'.repeat(columnWidths[i] + 2)).join('┬') + '┐' : '';
  const headerBorderBottom = showBorder ? '├' + columns.map((_, i) => '─'.repeat(columnWidths[i] + 2)).join('┼') + '┤' : '';
  const footerBorder = showBorder ? '└' + columns.map((_, i) => '─'.repeat(columnWidths[i] + 2)).join('┴') + '┘' : '';

  if (data.length === 0) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text dimColor>{emptyMessage}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Header */}
      {showHeader && (
        <>
          {showBorder && <Text>{headerBorderTop}</Text>}
          <Box>
            {showBorder && <Text>{borderChar}</Text>}
            {showRowNumbers && <Text> # </Text>}
            {columns.map((col, i) => {
              const sortIndicator = sortConfig?.column === col.key
                ? sortConfig.direction === 'asc' ? ' ▲' : ' ▼'
                : '';
              const headerText = truncate(col.header + sortIndicator, columnWidths[i]);
              const isSortTarget = isSortMode && sortColumnIndex === i;

              return (
                <Box key={col.key} width={columnWidths[i] + 2} justifyContent={col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start'}>
                  <Text bold inverse={isSortTarget}>
                    {' '}{padRight(headerText, columnWidths[i])}{' '}
                  </Text>
                  {showBorder && i < columns.length - 1 && <Text>{borderChar}</Text>}
                </Box>
              );
            })}
            {showBorder && <Text>{borderChar}</Text>}
          </Box>
          {showBorder && <Text>{headerBorderBottom}</Text>}
        </>
      )}

      {/* Rows */}
      {visibleRows.map((row, visibleIndex) => {
        const actualIndex = scrollOffset + visibleIndex;
        const isRowSelected = actualIndex === selectedIndex;
        const isRowChecked = multiSelect && isSelected(row);
        const isStriped = striped && actualIndex % 2 === 1;

        return (
          <Box key={String(row[keyField])}>
            {showBorder && <Text>{borderChar}</Text>}
            {showRowNumbers && (
              <Text dimColor> {String(actualIndex + 1).padStart(2)} </Text>
            )}
            {columns.map((col, i) => {
              const cellValue = formatCell(col, row);
              const displayValue = truncate(cellValue, columnWidths[i]);
              const aligned = col.align === 'right'
                ? displayValue.padStart(columnWidths[i])
                : col.align === 'center'
                ? displayValue.padStart(Math.floor((columnWidths[i] + displayValue.length) / 2)).padEnd(columnWidths[i])
                : padRight(displayValue, columnWidths[i]);

              return (
                <Box key={col.key} width={columnWidths[i] + 2}>
                  <Text
                    inverse={isRowSelected}
                    dimColor={isStriped && !isRowSelected}
                    color={isRowChecked ? 'green' : undefined}
                  >
                    {isRowChecked && i === 0 ? '✓' : ' '}
                    {aligned}
                    {' '}
                  </Text>
                  {showBorder && i < columns.length - 1 && <Text>{borderChar}</Text>}
                </Box>
              );
            })}
            {showBorder && <Text>{borderChar}</Text>}
          </Box>
        );
      })}

      {showBorder && <Text>{footerBorder}</Text>}

      {/* Footer / Status */}
      <Box marginTop={1}>
        <Text dimColor>
          {selectedIndex + 1}/{sortedData.length}
          {multiSelect && selected.size > 0 && ` (${selected.size} selected)`}
          {sortConfig && ` sorted by ${sortConfig.column} ${sortConfig.direction}`}
          {' '} | ↑↓ navigate | Enter select
          {sortable && ' | s sort'}
          {multiSelect && ' | Space toggle | a all | d none'}
        </Text>
      </Box>
    </Box>
  );
}

export default DataTable;
