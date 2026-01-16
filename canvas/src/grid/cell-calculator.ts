// Cell Calculator - Compute pixel positions from grid configuration

import type {
  GridConfig,
  CellSpan,
  PixelRect,
  MonitorInfo,
  CellDimensions,
  CellAddress,
} from "./types";

/**
 * Calculate pixel rectangle for a cell span
 */
export function calculateCellRect(
  cellSpan: CellSpan,
  config: GridConfig,
  monitor: MonitorInfo
): PixelRect {
  const { workAreaX, workAreaY, workAreaWidth, workAreaHeight } = monitor;
  const { rows, columns, cellGapHorizontal, cellGapVertical } = config;
  const { marginTop, marginBottom, marginLeft, marginRight } = config;

  // Calculate available space after margins
  const availableWidth = workAreaWidth - marginLeft - marginRight;
  const availableHeight = workAreaHeight - marginTop - marginBottom;

  // Calculate total gap space
  const totalHGap = (columns - 1) * cellGapHorizontal;
  const totalVGap = (rows - 1) * cellGapVertical;

  // Calculate cell dimensions
  const cellWidth = Math.floor((availableWidth - totalHGap) / columns);
  const cellHeight = Math.floor((availableHeight - totalVGap) / rows);

  // Calculate position for the cell span
  const x = workAreaX + marginLeft +
            cellSpan.startColumn * (cellWidth + cellGapHorizontal);
  const y = workAreaY + marginTop +
            cellSpan.startRow * (cellHeight + cellGapVertical);

  // Calculate size for the span (including internal gaps)
  const width = cellSpan.columnSpan * cellWidth +
                (cellSpan.columnSpan - 1) * cellGapHorizontal;
  const height = cellSpan.rowSpan * cellHeight +
                 (cellSpan.rowSpan - 1) * cellGapVertical;

  return { x, y, width, height };
}

/**
 * Calculate dimensions for a single cell
 */
export function calculateSingleCellSize(
  config: GridConfig,
  monitor: MonitorInfo
): { width: number; height: number } {
  const { workAreaWidth, workAreaHeight } = monitor;
  const { rows, columns, cellGapHorizontal, cellGapVertical } = config;
  const { marginTop, marginBottom, marginLeft, marginRight } = config;

  const availableWidth = workAreaWidth - marginLeft - marginRight;
  const availableHeight = workAreaHeight - marginTop - marginBottom;

  const totalHGap = (columns - 1) * cellGapHorizontal;
  const totalVGap = (rows - 1) * cellGapVertical;

  const cellWidth = Math.floor((availableWidth - totalHGap) / columns);
  const cellHeight = Math.floor((availableHeight - totalVGap) / rows);

  return { width: cellWidth, height: cellHeight };
}

/**
 * Get all cell dimensions for visualization and assignment
 */
export function calculateAllCells(
  config: GridConfig,
  monitor: MonitorInfo
): CellDimensions {
  const { width: cellWidth, height: cellHeight } = calculateSingleCellSize(config, monitor);
  const cells: CellDimensions["cells"] = [];

  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.columns; col++) {
      const span: CellSpan = {
        startRow: row,
        startColumn: col,
        rowSpan: 1,
        columnSpan: 1,
      };
      const rect = calculateCellRect(span, config, monitor);
      cells.push({ row, column: col, rect });
    }
  }

  return {
    cellWidth,
    cellHeight,
    cells,
  };
}

/**
 * Find which cell contains a given pixel position
 */
export function getCellAtPosition(
  x: number,
  y: number,
  config: GridConfig,
  monitor: MonitorInfo
): CellAddress | null {
  const dimensions = calculateAllCells(config, monitor);

  for (const cell of dimensions.cells) {
    const { rect } = cell;
    if (
      x >= rect.x &&
      x < rect.x + rect.width &&
      y >= rect.y &&
      y < rect.y + rect.height
    ) {
      return { row: cell.row, column: cell.column };
    }
  }

  return null;
}

/**
 * Get the center point of a cell
 */
export function getCellCenter(
  row: number,
  column: number,
  config: GridConfig,
  monitor: MonitorInfo
): { x: number; y: number } {
  const rect = calculateCellRect(
    { startRow: row, startColumn: column, rowSpan: 1, columnSpan: 1 },
    config,
    monitor
  );
  return {
    x: rect.x + Math.floor(rect.width / 2),
    y: rect.y + Math.floor(rect.height / 2),
  };
}

/**
 * Calculate remaining space distribution
 * Due to integer division, some pixels may be lost - this returns the leftovers
 */
export function calculateRemainingSpace(
  config: GridConfig,
  monitor: MonitorInfo
): { horizontal: number; vertical: number } {
  const { workAreaWidth, workAreaHeight } = monitor;
  const { rows, columns, cellGapHorizontal, cellGapVertical } = config;
  const { marginTop, marginBottom, marginLeft, marginRight } = config;

  const availableWidth = workAreaWidth - marginLeft - marginRight;
  const availableHeight = workAreaHeight - marginTop - marginBottom;

  const totalHGap = (columns - 1) * cellGapHorizontal;
  const totalVGap = (rows - 1) * cellGapVertical;

  const cellWidth = Math.floor((availableWidth - totalHGap) / columns);
  const cellHeight = Math.floor((availableHeight - totalVGap) / rows);

  const usedWidth = cellWidth * columns + totalHGap;
  const usedHeight = cellHeight * rows + totalVGap;

  return {
    horizontal: availableWidth - usedWidth,
    vertical: availableHeight - usedHeight,
  };
}

/**
 * Convert cell address to Excel-style notation (A1, B2, etc.)
 */
export function cellToExcelNotation(row: number, column: number): string {
  // Column: 0 -> A, 1 -> B, etc.
  let colStr = "";
  let c = column;
  do {
    colStr = String.fromCharCode(65 + (c % 26)) + colStr;
    c = Math.floor(c / 26) - 1;
  } while (c >= 0);

  // Row: 0-indexed to 1-indexed
  const rowStr = (row + 1).toString();

  return colStr + rowStr;
}

/**
 * Parse Excel-style notation to cell address (A1 -> {row: 0, column: 0})
 */
export function excelNotationToCell(notation: string): CellAddress | null {
  const match = notation.toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;

  const [, colStr, rowStr] = match;

  // Parse column (A=0, B=1, ..., Z=25, AA=26, etc.)
  let column = 0;
  for (let i = 0; i < colStr.length; i++) {
    column = column * 26 + (colStr.charCodeAt(i) - 64);
  }
  column -= 1; // Convert to 0-indexed

  // Parse row (1-indexed to 0-indexed)
  const row = parseInt(rowStr, 10) - 1;

  if (row < 0 || column < 0) return null;

  return { row, column };
}

/**
 * Format a cell span as a human-readable string
 */
export function formatCellSpan(span: CellSpan): string {
  const startCell = cellToExcelNotation(span.startRow, span.startColumn);

  if (span.rowSpan === 1 && span.columnSpan === 1) {
    return startCell;
  }

  const endRow = span.startRow + span.rowSpan - 1;
  const endCol = span.startColumn + span.columnSpan - 1;
  const endCell = cellToExcelNotation(endRow, endCol);

  return `${startCell}:${endCell}`;
}

/**
 * Format a cell span in coordinate notation
 */
export function formatCellSpanCoords(span: CellSpan): string {
  if (span.rowSpan === 1 && span.columnSpan === 1) {
    return `${span.startRow},${span.startColumn}`;
  }
  return `${span.startRow},${span.startColumn}:${span.rowSpan}x${span.columnSpan}`;
}
