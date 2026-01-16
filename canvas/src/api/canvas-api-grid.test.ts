import { test, expect, describe, mock, beforeEach } from "bun:test";
import {
  createGridState,
  parseGridPosition,
  findAvailableGridPosition,
  assignToGrid,
  removeFromGrid,
  getGridPosition,
  getWindowRect,
  getAvailableGridCells,
  getGridLayout,
  formatGridPosition,
  visualizeGridLayout,
  DEFAULT_GRID_CONFIG,
  type GridState,
  type CellSpan,
} from "./canvas-api";

// ============================================
// createGridState Tests
// ============================================

describe("createGridState", () => {
  test("creates grid state with default config", () => {
    const state = createGridState();
    expect(state).toBeDefined();
    expect(state.desktopIndex).toBe(0);
    expect(state.config).toBeDefined();
    expect(Array.isArray(state.assignments)).toBe(true);
    expect(state.assignments.length).toBe(0);
  });

  test("creates grid state with custom desktop index", () => {
    const state = createGridState(2);
    expect(state.desktopIndex).toBe(2);
  });

  test("creates grid state with custom config", () => {
    const state = createGridState(0, { rows: 4, columns: 4 });
    expect(state.config.rows).toBe(4);
    expect(state.config.columns).toBe(4);
  });

  test("creates grid state with partial config", () => {
    const state = createGridState(0, { rows: 5 });
    expect(state.config.rows).toBe(5);
    // Should have default columns
    expect(state.config.columns).toBe(DEFAULT_GRID_CONFIG.columns);
  });

  test("creates independent grid states", () => {
    const state1 = createGridState(0);
    const state2 = createGridState(1);
    expect(state1.desktopIndex).not.toBe(state2.desktopIndex);
    expect(state1.assignments).not.toBe(state2.assignments);
  });

  test("includes lastUpdated timestamp", () => {
    const state = createGridState();
    expect(state.lastUpdated).toBeDefined();
    expect(typeof state.lastUpdated).toBe("string");
    // Should be a valid ISO date
    expect(new Date(state.lastUpdated).getTime()).toBeGreaterThan(0);
  });
});

// ============================================
// parseGridPosition Tests
// ============================================

describe("parseGridPosition", () => {
  test("parses single Excel-style cell", () => {
    const result = parseGridPosition("A1");
    expect(result.success).toBe(true);
    expect(result.cellSpan).toBeDefined();
    expect(result.cellSpan?.startRow).toBe(0);
    expect(result.cellSpan?.startColumn).toBe(0);
    expect(result.cellSpan?.rowSpan).toBe(1);
    expect(result.cellSpan?.columnSpan).toBe(1);
  });

  test("parses Excel-style range", () => {
    const result = parseGridPosition("A1:C2");
    expect(result.success).toBe(true);
    expect(result.cellSpan?.startRow).toBe(0);
    expect(result.cellSpan?.startColumn).toBe(0);
    expect(result.cellSpan?.rowSpan).toBe(2);
    expect(result.cellSpan?.columnSpan).toBe(3);
  });

  test("parses coordinate-style single cell", () => {
    const result = parseGridPosition("0,0");
    expect(result.success).toBe(true);
    expect(result.cellSpan?.startRow).toBe(0);
    expect(result.cellSpan?.startColumn).toBe(0);
  });

  test("parses coordinate-style with size", () => {
    const result = parseGridPosition("1,1:2x3");
    expect(result.success).toBe(true);
    expect(result.cellSpan?.startRow).toBe(1);
    expect(result.cellSpan?.startColumn).toBe(1);
    expect(result.cellSpan?.rowSpan).toBe(2);
    expect(result.cellSpan?.columnSpan).toBe(3);
  });

  test("parses B2 cell", () => {
    const result = parseGridPosition("B2");
    expect(result.success).toBe(true);
    expect(result.cellSpan?.startRow).toBe(1);
    expect(result.cellSpan?.startColumn).toBe(1);
  });

  test("returns error for invalid format", () => {
    const result = parseGridPosition("invalid");
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("returns error for empty string", () => {
    const result = parseGridPosition("");
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("handles lowercase Excel notation", () => {
    const result = parseGridPosition("a1");
    expect(result.success).toBe(true);
    expect(result.cellSpan?.startRow).toBe(0);
    expect(result.cellSpan?.startColumn).toBe(0);
  });

  test("handles mixed case Excel range", () => {
    const result = parseGridPosition("a1:B2");
    expect(result.success).toBe(true);
    expect(result.cellSpan?.rowSpan).toBe(2);
    expect(result.cellSpan?.columnSpan).toBe(2);
  });
});

// ============================================
// findAvailableGridPosition Tests
// ============================================

describe("findAvailableGridPosition", () => {
  let gridState: GridState;

  beforeEach(() => {
    gridState = createGridState(0, { rows: 3, columns: 3 });
  });

  test("finds first cell in empty grid", () => {
    const result = findAvailableGridPosition(gridState);
    expect(result).not.toBeNull();
    expect(result?.startRow).toBe(0);
    expect(result?.startColumn).toBe(0);
  });

  test("finds cell with requested size", () => {
    const result = findAvailableGridPosition(gridState, 2, 2);
    expect(result).not.toBeNull();
    expect(result?.rowSpan).toBe(2);
    expect(result?.columnSpan).toBe(2);
  });

  test("returns null when no space for requested size", () => {
    // Fill the grid completely
    const state = createGridState(0, { rows: 2, columns: 2 });
    // Assign all cells
    let currentState = state;
    currentState = assignToGrid("w1", "A1", currentState).gridState!;
    currentState = assignToGrid("w2", "B1", currentState).gridState!;
    currentState = assignToGrid("w3", "A2", currentState).gridState!;
    currentState = assignToGrid("w4", "B2", currentState).gridState!;

    const result = findAvailableGridPosition(currentState);
    expect(result).toBeNull();
  });

  test("finds available cell after some are occupied", () => {
    const assigned = assignToGrid("window1", "A1", gridState);
    expect(assigned.success).toBe(true);

    const result = findAvailableGridPosition(assigned.gridState!);
    expect(result).not.toBeNull();
    // Should find next available cell (not A1)
    expect(result?.startRow !== 0 || result?.startColumn !== 0).toBe(true);
  });

  test("returns null for size larger than grid", () => {
    const result = findAvailableGridPosition(gridState, 10, 10);
    expect(result).toBeNull();
  });
});

// ============================================
// assignToGrid Tests
// ============================================

describe("assignToGrid", () => {
  let gridState: GridState;

  beforeEach(() => {
    gridState = createGridState(0, { rows: 3, columns: 3 });
  });

  test("assigns window to grid with string position", () => {
    const result = assignToGrid("window1", "A1", gridState);
    expect(result.success).toBe(true);
    expect(result.gridState).toBeDefined();
    const hasWindow = result.gridState?.assignments.some(a => a.windowId === "window1");
    expect(hasWindow).toBe(true);
  });

  test("assigns window to grid with CellSpan position", () => {
    const cellSpan: CellSpan = {
      startRow: 0,
      startColumn: 0,
      rowSpan: 1,
      columnSpan: 1,
    };
    const result = assignToGrid("window1", cellSpan, gridState);
    expect(result.success).toBe(true);
    const hasWindow = result.gridState?.assignments.some(a => a.windowId === "window1");
    expect(hasWindow).toBe(true);
  });

  test("fails for invalid position string", () => {
    const result = assignToGrid("window1", "invalid", gridState);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("fails for occupied position", () => {
    const first = assignToGrid("window1", "A1", gridState);
    expect(first.success).toBe(true);

    const second = assignToGrid("window2", "A1", first.gridState!);
    expect(second.success).toBe(false);
    expect(second.error).toContain("overlap");
  });

  test("fails for position outside grid bounds", () => {
    const result = assignToGrid("window1", "Z99", gridState);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("allows same window to reassign position", () => {
    const first = assignToGrid("window1", "A1", gridState);
    expect(first.success).toBe(true);

    // Same window can move to new position
    const second = assignToGrid("window1", "B1", first.gridState!);
    expect(second.success).toBe(true);
  });

  test("assigns multi-cell span", () => {
    const result = assignToGrid("window1", "A1:B2", gridState);
    expect(result.success).toBe(true);

    const pos = getGridPosition("window1", result.gridState!);
    expect(pos?.rowSpan).toBe(2);
    expect(pos?.columnSpan).toBe(2);
  });
});

// ============================================
// removeFromGrid Tests
// ============================================

describe("removeFromGrid", () => {
  let gridState: GridState;

  beforeEach(() => {
    gridState = createGridState(0, { rows: 3, columns: 3 });
  });

  test("removes window from grid", () => {
    const assigned = assignToGrid("window1", "A1", gridState);
    const hasWindowBefore = assigned.gridState?.assignments.some(a => a.windowId === "window1");
    expect(hasWindowBefore).toBe(true);

    const removed = removeFromGrid("window1", assigned.gridState!);
    const hasWindowAfter = removed.assignments.some(a => a.windowId === "window1");
    expect(hasWindowAfter).toBe(false);
  });

  test("handles removing non-existent window", () => {
    // Should not throw
    const result = removeFromGrid("nonexistent", gridState);
    const hasWindow = result.assignments.some(a => a.windowId === "nonexistent");
    expect(hasWindow).toBe(false);
  });

  test("frees up cell for reuse after removal", () => {
    const assigned = assignToGrid("window1", "A1", gridState);
    const removed = removeFromGrid("window1", assigned.gridState!);

    // Should be able to assign another window to A1
    const reassigned = assignToGrid("window2", "A1", removed);
    expect(reassigned.success).toBe(true);
  });
});

// ============================================
// getGridPosition Tests
// ============================================

describe("getGridPosition", () => {
  let gridState: GridState;

  beforeEach(() => {
    gridState = createGridState(0, { rows: 3, columns: 3 });
  });

  test("returns position for assigned window", () => {
    const assigned = assignToGrid("window1", "B2", gridState);
    const pos = getGridPosition("window1", assigned.gridState!);

    expect(pos).not.toBeNull();
    expect(pos?.startRow).toBe(1);
    expect(pos?.startColumn).toBe(1);
  });

  test("returns null for non-existent window", () => {
    const pos = getGridPosition("nonexistent", gridState);
    expect(pos).toBeNull();
  });

  test("returns correct span for multi-cell window", () => {
    const assigned = assignToGrid("window1", "A1:C2", gridState);
    const pos = getGridPosition("window1", assigned.gridState!);

    expect(pos?.rowSpan).toBe(2);
    expect(pos?.columnSpan).toBe(3);
  });
});

// ============================================
// getWindowRect Tests
// ============================================

describe("getWindowRect", () => {
  let gridState: GridState;

  beforeEach(() => {
    gridState = createGridState(0, { rows: 3, columns: 3 });
  });

  test("returns null for non-existent window", async () => {
    const rect = await getWindowRect("nonexistent", gridState);
    expect(rect).toBeNull();
  });

  test("returns rect for assigned window", async () => {
    const assigned = assignToGrid("window1", "A1", gridState);
    const rect = await getWindowRect("window1", assigned.gridState!);

    // Should have pixel dimensions
    expect(rect).not.toBeNull();
    if (rect) {
      expect(typeof rect.x).toBe("number");
      expect(typeof rect.y).toBe("number");
      expect(typeof rect.width).toBe("number");
      expect(typeof rect.height).toBe("number");
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.height).toBeGreaterThan(0);
    }
  });
});

// ============================================
// getAvailableGridCells Tests
// ============================================

describe("getAvailableGridCells", () => {
  let gridState: GridState;

  beforeEach(() => {
    gridState = createGridState(0, { rows: 2, columns: 2 });
  });

  test("returns all cells for empty grid", () => {
    const available = getAvailableGridCells(gridState);
    expect(available.length).toBe(4); // 2x2 grid
  });

  test("excludes occupied cells", () => {
    const assigned = assignToGrid("window1", "A1", gridState);
    const available = getAvailableGridCells(assigned.gridState!);

    expect(available.length).toBe(3);
    // A1 should not be in the list
    const hasA1 = available.some(cell => cell.row === 0 && cell.column === 0);
    expect(hasA1).toBe(false);
  });

  test("returns empty array for full grid", () => {
    let state = gridState;
    state = assignToGrid("w1", "A1", state).gridState!;
    state = assignToGrid("w2", "B1", state).gridState!;
    state = assignToGrid("w3", "A2", state).gridState!;
    state = assignToGrid("w4", "B2", state).gridState!;

    const available = getAvailableGridCells(state);
    expect(available.length).toBe(0);
  });

  test("excludes all cells covered by multi-cell span", () => {
    const assigned = assignToGrid("window1", "A1:B2", gridState);
    const available = getAvailableGridCells(assigned.gridState!);

    // All 4 cells should be occupied
    expect(available.length).toBe(0);
  });
});

// ============================================
// getGridLayout Tests
// ============================================

describe("getGridLayout", () => {
  let gridState: GridState;

  beforeEach(() => {
    gridState = createGridState(0, { rows: 3, columns: 3 });
  });

  test("returns layout info for empty grid", async () => {
    const layout = await getGridLayout(gridState);

    expect(layout).toBeDefined();
    expect(layout.config).toBeDefined();
    expect(layout.config.rows).toBe(3);
    expect(layout.config.columns).toBe(3);
    expect(layout.availableCells.length).toBe(9); // 3x3
    expect(layout.assignments.length).toBe(0);
  });

  test("returns layout info with assigned windows", async () => {
    const assigned = assignToGrid("window1", "A1", gridState);
    const layout = await getGridLayout(assigned.gridState!);

    expect(layout.assignments.length).toBe(1);
    expect(layout.availableCells.length).toBe(8);
  });

  test("includes window kinds in layout", async () => {
    const assigned = assignToGrid("cal-123", "A1", gridState);
    const windowKinds = new Map<string, string | null>([["cal-123", "calendar"]]);

    const layout = await getGridLayout(assigned.gridState!, windowKinds);

    expect(layout.assignments[0].canvasKind).toBe("calendar");
  });

  test("handles multi-cell spans in layout", async () => {
    const assigned = assignToGrid("window1", "A1:B2", gridState);
    const layout = await getGridLayout(assigned.gridState!);

    expect(layout.availableCells.length).toBe(5); // 9 - 4 = 5
    expect(layout.assignments.length).toBe(1);
    expect(layout.assignments[0].cellSpec).toBe("A1:B2");
  });

  test("includes dimensions in layout", async () => {
    const layout = await getGridLayout(gridState);

    expect(layout.dimensions).toBeDefined();
    expect(layout.dimensions.cellWidth).toBeGreaterThan(0);
    expect(layout.dimensions.cellHeight).toBeGreaterThan(0);
  });

  test("includes monitor info in layout", async () => {
    const layout = await getGridLayout(gridState);

    expect(layout.monitor).toBeDefined();
    expect(layout.monitor.width).toBeGreaterThan(0);
    expect(layout.monitor.height).toBeGreaterThan(0);
  });
});

// ============================================
// formatGridPosition Tests
// ============================================

describe("formatGridPosition", () => {
  test("formats single cell as Excel notation", () => {
    const cellSpan: CellSpan = {
      startRow: 0,
      startColumn: 0,
      rowSpan: 1,
      columnSpan: 1,
    };
    expect(formatGridPosition(cellSpan)).toBe("A1");
  });

  test("formats B2 correctly", () => {
    const cellSpan: CellSpan = {
      startRow: 1,
      startColumn: 1,
      rowSpan: 1,
      columnSpan: 1,
    };
    expect(formatGridPosition(cellSpan)).toBe("B2");
  });

  test("formats range as Excel notation", () => {
    const cellSpan: CellSpan = {
      startRow: 0,
      startColumn: 0,
      rowSpan: 2,
      columnSpan: 3,
    };
    expect(formatGridPosition(cellSpan)).toBe("A1:C2");
  });

  test("formats C3 single cell", () => {
    const cellSpan: CellSpan = {
      startRow: 2,
      startColumn: 2,
      rowSpan: 1,
      columnSpan: 1,
    };
    expect(formatGridPosition(cellSpan)).toBe("C3");
  });
});

// ============================================
// visualizeGridLayout Tests
// ============================================

describe("visualizeGridLayout", () => {
  let gridState: GridState;

  beforeEach(() => {
    gridState = createGridState(0, { rows: 3, columns: 3 });
  });

  test("returns string visualization", () => {
    const viz = visualizeGridLayout(gridState);
    expect(typeof viz).toBe("string");
    expect(viz.length).toBeGreaterThan(0);
  });

  test("shows empty cells", () => {
    const viz = visualizeGridLayout(gridState);
    // Should contain grid structure characters
    expect(viz).toContain("-");
    expect(viz).toContain("|");
    expect(viz).toContain("+");
  });

  test("shows assigned windows", () => {
    const assigned = assignToGrid("window1", "A1", gridState);
    const windowNames = new Map([["window1", "Cal"]]);

    const viz = visualizeGridLayout(assigned.gridState!, windowNames);
    expect(viz).toContain("Cal");
  });

  test("handles windows without names", () => {
    const assigned = assignToGrid("window1", "A1", gridState);

    // Should not throw without windowNames
    const viz = visualizeGridLayout(assigned.gridState!);
    expect(typeof viz).toBe("string");
    // Should show part of windowId
    expect(viz).toContain("window1");
  });

  test("shows cell references for empty cells", () => {
    const viz = visualizeGridLayout(gridState);
    // Should show Excel notation in brackets for empty cells
    expect(viz).toContain("[A1]");
    expect(viz).toContain("[B2]");
    expect(viz).toContain("[C3]");
  });
});

// ============================================
// Integration Tests
// ============================================

describe("Grid API Integration", () => {
  test("complete workflow: create, assign, query, remove", () => {
    // Create grid
    const grid = createGridState(0, { rows: 3, columns: 3 });
    expect(grid.assignments.length).toBe(0);

    // Find available position
    const available = findAvailableGridPosition(grid);
    expect(available).not.toBeNull();

    // Assign window
    const assigned = assignToGrid("myWindow", available!, grid);
    expect(assigned.success).toBe(true);

    // Query position
    const pos = getGridPosition("myWindow", assigned.gridState!);
    expect(pos).toEqual(available);

    // Format position
    const formatted = formatGridPosition(pos!);
    expect(formatted).toBe("A1");

    // Remove window
    const removed = removeFromGrid("myWindow", assigned.gridState!);
    const hasWindow = removed.assignments.some(a => a.windowId === "myWindow");
    expect(hasWindow).toBe(false);
  });

  test("multiple windows on grid", () => {
    let grid = createGridState(0, { rows: 3, columns: 3 });

    // Assign multiple windows
    grid = assignToGrid("win1", "A1", grid).gridState!;
    grid = assignToGrid("win2", "B1", grid).gridState!;
    grid = assignToGrid("win3", "C1", grid).gridState!;

    expect(grid.assignments.length).toBe(3);

    const available = getAvailableGridCells(grid);
    expect(available.length).toBe(6); // 9 - 3 = 6

    // Visualization should show all windows
    const names = new Map([
      ["win1", "W1"],
      ["win2", "W2"],
      ["win3", "W3"],
    ]);
    const viz = visualizeGridLayout(grid, names);
    expect(viz).toContain("W1");
    expect(viz).toContain("W2");
    expect(viz).toContain("W3");
  });

  test("parse and format are inverse operations", () => {
    const positions = ["A1", "B2", "C3", "A1:B2", "A1:C3"];

    for (const pos of positions) {
      const parsed = parseGridPosition(pos);
      expect(parsed.success).toBe(true);

      const formatted = formatGridPosition(parsed.cellSpan!);
      expect(formatted).toBe(pos);
    }
  });

  test("grid state is immutable", () => {
    const original = createGridState();
    const assigned = assignToGrid("win1", "A1", original);

    // Original should be unchanged
    expect(original.assignments.length).toBe(0);
    expect(assigned.gridState?.assignments.length).toBe(1);
  });
});

// ============================================
// Edge Cases
// ============================================

describe("Edge Cases", () => {
  test("handles 1x1 grid", () => {
    const grid = createGridState(0, { rows: 1, columns: 1 });

    const assigned = assignToGrid("win1", "A1", grid);
    expect(assigned.success).toBe(true);

    const available = getAvailableGridCells(assigned.gridState!);
    expect(available.length).toBe(0);
  });

  test("handles large grid", () => {
    const grid = createGridState(0, { rows: 10, columns: 10 });

    const available = getAvailableGridCells(grid);
    expect(available.length).toBe(100);
  });

  test("handles column letters beyond Z", () => {
    // This tests the Excel notation for columns > 26
    const grid = createGridState(0, { rows: 1, columns: 30 });

    // Assign to column 27 (AA in Excel)
    const result = assignToGrid("win1", { startRow: 0, startColumn: 26, rowSpan: 1, columnSpan: 1 }, grid);
    expect(result.success).toBe(true);
  });

  test("handles zero-based indexing correctly", () => {
    const grid = createGridState();

    // A1 should be row 0, column 0
    const result = assignToGrid("win1", "A1", grid);
    const pos = getGridPosition("win1", result.gridState!);

    expect(pos?.startRow).toBe(0);
    expect(pos?.startColumn).toBe(0);
  });

  test("handles window ID with special characters", () => {
    const grid = createGridState();
    const windowId = "calendar-2024-01-15T10:30:00Z-abc123";

    const assigned = assignToGrid(windowId, "A1", grid);
    expect(assigned.success).toBe(true);

    const pos = getGridPosition(windowId, assigned.gridState!);
    expect(pos).not.toBeNull();
  });

  test("preserves grid config after operations", () => {
    const config = { rows: 5, columns: 4 };
    let grid = createGridState(0, config);

    grid = assignToGrid("win1", "A1", grid).gridState!;
    grid = removeFromGrid("win1", grid);

    expect(grid.config.rows).toBe(5);
    expect(grid.config.columns).toBe(4);
  });

  test("handles coordinate format with spaces", () => {
    const result = parseGridPosition("1 , 2");
    expect(result.success).toBe(true);
    expect(result.cellSpan?.startRow).toBe(1);
    expect(result.cellSpan?.startColumn).toBe(2);
  });

  test("handles coordinate format with size", () => {
    const result = parseGridPosition("0,0:3x2");
    expect(result.success).toBe(true);
    expect(result.cellSpan?.rowSpan).toBe(3);
    expect(result.cellSpan?.columnSpan).toBe(2);
  });
});
