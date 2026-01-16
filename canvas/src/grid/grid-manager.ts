// Grid Manager - Core grid operations

import type {
  GridConfig,
  GridState,
  CellAssignment,
  CellSpan,
  CellDimensions,
  PixelRect,
  MonitorInfo,
  CellAddress,
  CellSpecParseResult,
  GridLayoutInfo,
  DEFAULT_GRID_CONFIG,
} from "./types";
import {
  cellSpansOverlap,
  isWithinGrid,
  getCellsInSpan,
  singleCell,
} from "./types";
import * as calculator from "./cell-calculator";
import * as monitor from "./monitor-info";
import * as positioner from "./window-positioner";

// Re-export default config
export { DEFAULT_GRID_CONFIG } from "./types";

/**
 * Initialize grid state for a desktop
 */
export function initializeGridState(
  desktopIndex: number,
  config: Partial<GridConfig> = {}
): GridState {
  const fullConfig: GridConfig = {
    rows: config.rows ?? 3,
    columns: config.columns ?? 3,
    monitorIndex: config.monitorIndex ?? 0,
    cellGapHorizontal: config.cellGapHorizontal ?? 4,
    cellGapVertical: config.cellGapVertical ?? 4,
    marginTop: config.marginTop ?? 0,
    marginBottom: config.marginBottom ?? 0,
    marginLeft: config.marginLeft ?? 0,
    marginRight: config.marginRight ?? 0,
  };

  return {
    desktopIndex,
    config: fullConfig,
    assignments: [],
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Parse cell specification string to CellSpan
 *
 * Supported formats:
 * - "0,0" - Single cell at row 0, column 0
 * - "0,0:2x3" - Span starting at (0,0), 2 rows by 3 columns
 * - "A1" - Excel-style single cell
 * - "A1:C2" - Excel-style range
 */
export function parseCellSpec(spec: string): CellSpecParseResult {
  const trimmed = spec.trim().toUpperCase();

  // Try coordinate format: "0,0" or "0,0:2x3"
  const coordMatch = trimmed.match(/^(\d+)\s*,\s*(\d+)(?:\s*:\s*(\d+)\s*[xX]\s*(\d+))?$/);
  if (coordMatch) {
    const [, rowStr, colStr, rowSpanStr, colSpanStr] = coordMatch;
    const row = parseInt(rowStr, 10);
    const col = parseInt(colStr, 10);
    const rowSpan = rowSpanStr ? parseInt(rowSpanStr, 10) : 1;
    const colSpan = colSpanStr ? parseInt(colSpanStr, 10) : 1;

    if (rowSpan < 1 || colSpan < 1) {
      return { success: false, error: "Span dimensions must be at least 1" };
    }

    return {
      success: true,
      cellSpan: { startRow: row, startColumn: col, rowSpan, columnSpan: colSpan },
    };
  }

  // Try Excel-style format: "A1" or "A1:B2"
  const excelMatch = trimmed.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
  if (excelMatch) {
    const [, startColStr, startRowStr, endColStr, endRowStr] = excelMatch;

    const startCell = calculator.excelNotationToCell(startColStr + startRowStr);
    if (!startCell) {
      return { success: false, error: `Invalid cell notation: ${startColStr}${startRowStr}` };
    }

    if (endColStr && endRowStr) {
      const endCell = calculator.excelNotationToCell(endColStr + endRowStr);
      if (!endCell) {
        return { success: false, error: `Invalid cell notation: ${endColStr}${endRowStr}` };
      }

      // Ensure start is top-left
      const minRow = Math.min(startCell.row, endCell.row);
      const minCol = Math.min(startCell.column, endCell.column);
      const maxRow = Math.max(startCell.row, endCell.row);
      const maxCol = Math.max(startCell.column, endCell.column);

      return {
        success: true,
        cellSpan: {
          startRow: minRow,
          startColumn: minCol,
          rowSpan: maxRow - minRow + 1,
          columnSpan: maxCol - minCol + 1,
        },
      };
    }

    return {
      success: true,
      cellSpan: singleCell(startCell.row, startCell.column),
    };
  }

  return { success: false, error: `Invalid cell specification: ${spec}` };
}

/**
 * Format cell span for display (Excel-style)
 */
export function formatCellSpec(span: CellSpan): string {
  return calculator.formatCellSpan(span);
}

/**
 * Format cell span in coordinate notation
 */
export function formatCellSpecCoords(span: CellSpan): string {
  return calculator.formatCellSpanCoords(span);
}

/**
 * Validate cell span against grid configuration and existing assignments
 */
export function validateCellSpan(
  cellSpan: CellSpan,
  gridState: GridState,
  excludeWindowId?: string
): { valid: boolean; error?: string } {
  // Check bounds
  if (!isWithinGrid(cellSpan, gridState.config)) {
    return {
      valid: false,
      error: `Cell span ${formatCellSpec(cellSpan)} is outside grid bounds (${gridState.config.rows}x${gridState.config.columns})`,
    };
  }

  // Check for overlaps with existing assignments
  for (const assignment of gridState.assignments) {
    if (excludeWindowId && assignment.windowId === excludeWindowId) {
      continue; // Skip self when moving/resizing
    }

    if (cellSpansOverlap(cellSpan, assignment.cellSpan)) {
      return {
        valid: false,
        error: `Cell span overlaps with window ${assignment.windowId} at ${formatCellSpec(assignment.cellSpan)}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Get available (unoccupied) cells in the grid
 */
export function getAvailableCells(gridState: GridState): CellAddress[] {
  const { rows, columns } = gridState.config;
  const available: CellAddress[] = [];

  // Create a set of occupied cells
  const occupied = new Set<string>();
  for (const assignment of gridState.assignments) {
    const cells = getCellsInSpan(assignment.cellSpan);
    for (const cell of cells) {
      occupied.add(`${cell.row},${cell.column}`);
    }
  }

  // Find unoccupied cells
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      if (!occupied.has(`${row},${col}`)) {
        available.push({ row, column: col });
      }
    }
  }

  return available;
}

/**
 * Find first available cell that fits the requested span
 */
export function findAvailableSpan(
  rowSpan: number,
  columnSpan: number,
  gridState: GridState
): CellSpan | null {
  const { rows, columns } = gridState.config;

  for (let row = 0; row <= rows - rowSpan; row++) {
    for (let col = 0; col <= columns - columnSpan; col++) {
      const testSpan: CellSpan = {
        startRow: row,
        startColumn: col,
        rowSpan,
        columnSpan,
      };

      const { valid } = validateCellSpan(testSpan, gridState);
      if (valid) {
        return testSpan;
      }
    }
  }

  return null;
}

/**
 * Assign a window to grid cells
 */
export function assignWindowToGrid(
  windowId: string,
  cellSpan: CellSpan,
  gridState: GridState
): GridState {
  // Remove any existing assignment for this window
  const newAssignments = gridState.assignments.filter(a => a.windowId !== windowId);

  // Add new assignment
  newAssignments.push({ windowId, cellSpan });

  return {
    ...gridState,
    assignments: newAssignments,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Remove window from grid
 */
export function removeWindowFromGrid(
  windowId: string,
  gridState: GridState
): GridState {
  return {
    ...gridState,
    assignments: gridState.assignments.filter(a => a.windowId !== windowId),
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get cell span for a window
 */
export function getWindowCellSpan(
  windowId: string,
  gridState: GridState
): CellSpan | null {
  const assignment = gridState.assignments.find(a => a.windowId === windowId);
  return assignment ? assignment.cellSpan : null;
}

/**
 * Calculate pixel rectangle for a window's cell assignment
 */
export async function calculateWindowRect(
  windowId: string,
  gridState: GridState
): Promise<PixelRect | null> {
  const span = getWindowCellSpan(windowId, gridState);
  if (!span) return null;

  const monitorInfo = await monitor.getMonitor(gridState.config.monitorIndex);
  if (!monitorInfo) return null;

  return calculator.calculateCellRect(span, gridState.config, monitorInfo);
}

/**
 * Position a window according to its grid assignment
 */
export async function positionWindow(
  windowId: string,
  windowHandle: number,
  gridState: GridState
): Promise<void> {
  const rect = await calculateWindowRect(windowId, gridState);
  if (!rect) {
    throw new Error(`No grid assignment found for window ${windowId}`);
  }

  await positioner.setWindowPosition(windowHandle, rect, { showWindow: true });
}

/**
 * Get calculated cell dimensions for current grid configuration
 */
export async function getCellDimensions(
  config: GridConfig
): Promise<CellDimensions> {
  const monitorInfo = await monitor.getMonitor(config.monitorIndex);
  if (!monitorInfo) {
    throw new Error(`Monitor ${config.monitorIndex} not found`);
  }

  return calculator.calculateAllCells(config, monitorInfo);
}

/**
 * Get complete grid layout information
 */
export async function getGridLayoutInfo(
  gridState: GridState,
  windowKinds: Map<string, string | null>
): Promise<GridLayoutInfo> {
  const monitorInfo = await monitor.getMonitor(gridState.config.monitorIndex);
  if (!monitorInfo) {
    throw new Error(`Monitor ${gridState.config.monitorIndex} not found`);
  }

  const dimensions = calculator.calculateAllCells(gridState.config, monitorInfo);

  const assignments = gridState.assignments.map(a => ({
    windowId: a.windowId,
    canvasKind: windowKinds.get(a.windowId) ?? null,
    cellSpec: formatCellSpec(a.cellSpan),
    position: calculator.calculateCellRect(a.cellSpan, gridState.config, monitorInfo),
  }));

  const availableCells = getAvailableCells(gridState);

  return {
    config: gridState.config,
    monitor: monitorInfo,
    dimensions,
    assignments,
    availableCells,
  };
}

/**
 * Swap grid positions of two windows
 */
export function swapWindowPositions(
  windowId1: string,
  windowId2: string,
  gridState: GridState
): GridState {
  const span1 = getWindowCellSpan(windowId1, gridState);
  const span2 = getWindowCellSpan(windowId2, gridState);

  if (!span1 || !span2) {
    throw new Error("Both windows must have grid assignments to swap");
  }

  // Update assignments
  const newAssignments = gridState.assignments.map(a => {
    if (a.windowId === windowId1) {
      return { ...a, cellSpan: span2 };
    }
    if (a.windowId === windowId2) {
      return { ...a, cellSpan: span1 };
    }
    return a;
  });

  return {
    ...gridState,
    assignments: newAssignments,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Generate ASCII visualization of grid layout
 */
export function visualizeGrid(
  gridState: GridState,
  windowNames: Map<string, string>
): string {
  const { rows, columns } = gridState.config;
  const cellWidth = 16;

  // Create a grid representation
  const grid: (string | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => null)
  );

  // Mark occupied cells
  for (const assignment of gridState.assignments) {
    const { startRow, startColumn, rowSpan, columnSpan } = assignment.cellSpan;
    const name = windowNames.get(assignment.windowId) || assignment.windowId.slice(0, 10);

    for (let r = startRow; r < startRow + rowSpan; r++) {
      for (let c = startColumn; c < startColumn + columnSpan; c++) {
        if (r < rows && c < columns) {
          // Show name only in first cell
          if (r === startRow && c === startColumn) {
            grid[r][c] = name;
          } else {
            grid[r][c] = "...";
          }
        }
      }
    }
  }

  // Build ASCII output
  const lines: string[] = [];
  const horizontalLine = "+" + ("-".repeat(cellWidth) + "+").repeat(columns);

  lines.push(horizontalLine);

  for (let r = 0; r < rows; r++) {
    let row = "|";
    for (let c = 0; c < columns; c++) {
      const content = grid[r][c] || `[${calculator.cellToExcelNotation(r, c)}]`;
      const padded = content.padStart((cellWidth + content.length) / 2).padEnd(cellWidth);
      row += padded + "|";
    }
    lines.push(row);
    lines.push(horizontalLine);
  }

  return lines.join("\n");
}
