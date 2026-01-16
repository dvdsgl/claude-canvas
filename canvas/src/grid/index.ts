// Grid Module - Main exports

// Types
export type {
  CellAddress,
  CellSpan,
  PixelRect,
  MonitorInfo,
  GridConfig,
  CellAssignment,
  GridState,
  CellDimensions,
  GridLayoutInfo,
  PositionOptions,
  TabInfo,
  CellSpecParseResult,
  CellSpec,
} from "./types";

export {
  DEFAULT_GRID_CONFIG,
  singleCell,
  cellSpan,
  cellSpansOverlap,
  isWithinGrid,
  getCellsInSpan,
} from "./types";

// Monitor info
export {
  getAllMonitors,
  getPrimaryMonitor,
  getMonitor,
  getMonitorCount,
  getCachedMonitors,
  clearMonitorCache,
} from "./monitor-info";

// Cell calculator
export {
  calculateCellRect,
  calculateSingleCellSize,
  calculateAllCells,
  getCellAtPosition,
  getCellCenter,
  calculateRemainingSpace,
  cellToExcelNotation,
  excelNotationToCell,
  formatCellSpan,
  formatCellSpanCoords,
} from "./cell-calculator";

// Window positioner
export {
  setWindowPosition,
  getWindowPosition,
  isWindowValid,
  bringToForeground,
  minimizeWindow,
  restoreWindow,
  getWindowFrameSize,
} from "./window-positioner";

// Grid manager
export {
  initializeGridState,
  parseCellSpec,
  formatCellSpec as formatCellSpecExcel,
  formatCellSpecCoords as formatCellSpecCoordinate,
  validateCellSpan,
  getAvailableCells,
  findAvailableSpan,
  assignWindowToGrid,
  removeWindowFromGrid,
  getWindowCellSpan,
  calculateWindowRect,
  positionWindow,
  getCellDimensions,
  getGridLayoutInfo,
  swapWindowPositions,
  visualizeGrid,
} from "./grid-manager";
