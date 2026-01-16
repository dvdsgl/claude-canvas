// Grid Types - Type definitions for grid-based window management

/**
 * Cell address in the grid (0-indexed)
 */
export interface CellAddress {
  row: number;
  column: number;
}

/**
 * Cell span defines which cells a window occupies
 * Uses top-left corner and span dimensions
 */
export interface CellSpan {
  startRow: number;
  startColumn: number;
  rowSpan: number;      // Number of rows the window spans (minimum 1)
  columnSpan: number;   // Number of columns the window spans (minimum 1)
}

/**
 * Pixel rectangle for window positioning
 */
export interface PixelRect {
  x: number;      // Left edge in pixels
  y: number;      // Top edge in pixels
  width: number;  // Width in pixels
  height: number; // Height in pixels
}

/**
 * Monitor/Screen information
 */
export interface MonitorInfo {
  index: number;
  name: string;
  width: number;           // Screen width in pixels
  height: number;          // Screen height in pixels
  workAreaX: number;       // Work area left (excludes taskbar)
  workAreaY: number;       // Work area top
  workAreaWidth: number;   // Work area width
  workAreaHeight: number;  // Work area height
  scaleFactor: number;     // DPI scaling (1.0, 1.25, 1.5, etc.)
  isPrimary: boolean;
}

/**
 * Grid configuration for a virtual desktop
 */
export interface GridConfig {
  rows: number;              // Number of grid rows (e.g., 3)
  columns: number;           // Number of grid columns (e.g., 3)
  monitorIndex: number;      // Which monitor this grid applies to

  // Gaps between cells in pixels
  cellGapHorizontal: number;
  cellGapVertical: number;

  // Margin from screen edges in pixels
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
}

/**
 * Default grid configuration
 */
export const DEFAULT_GRID_CONFIG: GridConfig = {
  rows: 3,
  columns: 3,
  monitorIndex: 0,
  cellGapHorizontal: 4,
  cellGapVertical: 4,
  marginTop: 0,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
};

/**
 * Cell assignment - links a window to grid cells
 */
export interface CellAssignment {
  windowId: string;       // References CanvasWindow.id
  cellSpan: CellSpan;     // Which cells this window occupies
  zIndex?: number;        // For overlapping windows (future)
}

/**
 * Grid state for a desktop - stored in session
 */
export interface GridState {
  desktopIndex: number;
  config: GridConfig;
  assignments: CellAssignment[];
  lastUpdated: string;    // ISO timestamp
}

/**
 * Calculated cell dimensions for a specific grid configuration
 */
export interface CellDimensions {
  cellWidth: number;      // Width of each cell in pixels
  cellHeight: number;     // Height of each cell in pixels
  cells: Array<{
    row: number;
    column: number;
    rect: PixelRect;      // Exact pixel position for this cell
  }>;
}

/**
 * Result of grid layout visualization
 */
export interface GridLayoutInfo {
  config: GridConfig;
  monitor: MonitorInfo;
  dimensions: CellDimensions;
  assignments: Array<{
    windowId: string;
    canvasKind: string | null;
    cellSpec: string;
    position: PixelRect;
  }>;
  availableCells: CellAddress[];
}

/**
 * Options for window positioning
 */
export interface PositionOptions {
  noActivate?: boolean;    // Don't bring window to foreground
  showWindow?: boolean;    // Show if hidden
  topMost?: boolean;       // Keep on top
}

/**
 * Tab information for terminal windows
 */
export interface TabInfo {
  id: string;
  title: string;
  isActive: boolean;
}

/**
 * Parse result for cell specification
 */
export interface CellSpecParseResult {
  success: boolean;
  cellSpan?: CellSpan;
  error?: string;
}

/**
 * Cell specification formats supported:
 * - "0,0" - Single cell at row 0, column 0
 * - "0,0:2x3" - Span starting at (0,0), 2 rows by 3 columns
 * - "A1" - Excel-style single cell
 * - "A1:C2" - Excel-style range
 */
export type CellSpec = string;

/**
 * Helper to create a single-cell span
 */
export function singleCell(row: number, column: number): CellSpan {
  return {
    startRow: row,
    startColumn: column,
    rowSpan: 1,
    columnSpan: 1,
  };
}

/**
 * Helper to create a multi-cell span
 */
export function cellSpan(
  startRow: number,
  startColumn: number,
  rowSpan: number,
  columnSpan: number
): CellSpan {
  return {
    startRow,
    startColumn,
    rowSpan: Math.max(1, rowSpan),
    columnSpan: Math.max(1, columnSpan),
  };
}

/**
 * Check if two cell spans overlap
 */
export function cellSpansOverlap(a: CellSpan, b: CellSpan): boolean {
  const aEndRow = a.startRow + a.rowSpan - 1;
  const aEndCol = a.startColumn + a.columnSpan - 1;
  const bEndRow = b.startRow + b.rowSpan - 1;
  const bEndCol = b.startColumn + b.columnSpan - 1;

  return !(
    aEndRow < b.startRow ||
    a.startRow > bEndRow ||
    aEndCol < b.startColumn ||
    a.startColumn > bEndCol
  );
}

/**
 * Check if a cell span is within grid bounds
 */
export function isWithinGrid(span: CellSpan, config: GridConfig): boolean {
  return (
    span.startRow >= 0 &&
    span.startColumn >= 0 &&
    span.startRow + span.rowSpan <= config.rows &&
    span.startColumn + span.columnSpan <= config.columns
  );
}

/**
 * Get all cells covered by a span
 */
export function getCellsInSpan(span: CellSpan): CellAddress[] {
  const cells: CellAddress[] = [];
  for (let row = span.startRow; row < span.startRow + span.rowSpan; row++) {
    for (let col = span.startColumn; col < span.startColumn + span.columnSpan; col++) {
      cells.push({ row, column: col });
    }
  }
  return cells;
}
