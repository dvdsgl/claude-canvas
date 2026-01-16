// Tests for Grid Manager
// Tests core grid operations including cell spec parsing, validation, and state management

import { test, expect, describe, beforeEach } from "bun:test";
import {
  initializeGridState,
  parseCellSpec,
  formatCellSpec,
  formatCellSpecCoords,
  validateCellSpan,
  getAvailableCells,
  findAvailableSpan,
  assignWindowToGrid,
  removeWindowFromGrid,
  getWindowCellSpan,
  swapWindowPositions,
  visualizeGrid,
} from "./grid-manager";
import type { GridState, CellSpan } from "./types";

describe("initializeGridState", () => {
  test("creates default 3x3 grid state", () => {
    const state = initializeGridState(0);

    expect(state.desktopIndex).toBe(0);
    expect(state.config.rows).toBe(3);
    expect(state.config.columns).toBe(3);
    expect(state.config.cellGapHorizontal).toBe(4);
    expect(state.config.cellGapVertical).toBe(4);
    expect(state.assignments).toEqual([]);
    expect(state.lastUpdated).toBeDefined();
  });

  test("accepts custom configuration", () => {
    const state = initializeGridState(1, {
      rows: 4,
      columns: 2,
      cellGapHorizontal: 8,
      marginTop: 10,
    });

    expect(state.desktopIndex).toBe(1);
    expect(state.config.rows).toBe(4);
    expect(state.config.columns).toBe(2);
    expect(state.config.cellGapHorizontal).toBe(8);
    expect(state.config.marginTop).toBe(10);
    // Defaults for unspecified values
    expect(state.config.cellGapVertical).toBe(4);
    expect(state.config.marginBottom).toBe(0);
  });
});

describe("parseCellSpec", () => {
  describe("coordinate format", () => {
    test("parses single cell 0,0", () => {
      const result = parseCellSpec("0,0");

      expect(result.success).toBe(true);
      expect(result.cellSpan).toBeDefined();
      expect(result.cellSpan!).toEqual({
        startRow: 0,
        startColumn: 0,
        rowSpan: 1,
        columnSpan: 1,
      });
    });

    test("parses single cell with spaces", () => {
      const result = parseCellSpec(" 1 , 2 ");

      expect(result.success).toBe(true);
      expect(result.cellSpan).toBeDefined();
      expect(result.cellSpan!.startRow).toBe(1);
      expect(result.cellSpan!.startColumn).toBe(2);
    });

    test("parses span 0,0:2x3", () => {
      const result = parseCellSpec("0,0:2x3");

      expect(result.success).toBe(true);
      expect(result.cellSpan).toBeDefined();
      expect(result.cellSpan!).toEqual({
        startRow: 0,
        startColumn: 0,
        rowSpan: 2,
        columnSpan: 3,
      });
    });

    test("parses span with spaces and uppercase X", () => {
      const result = parseCellSpec("1,1 : 2 X 2");

      expect(result.success).toBe(true);
      expect(result.cellSpan).toBeDefined();
      expect(result.cellSpan!).toEqual({
        startRow: 1,
        startColumn: 1,
        rowSpan: 2,
        columnSpan: 2,
      });
    });

    test("rejects span with 0 dimensions", () => {
      const result = parseCellSpec("0,0:0x1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("at least 1");
      }
    });
  });

  describe("Excel-style format", () => {
    test("parses single cell A1", () => {
      const result = parseCellSpec("A1");

      expect(result.success).toBe(true);
      expect(result.cellSpan).toBeDefined();
      expect(result.cellSpan!).toEqual({
        startRow: 0,
        startColumn: 0,
        rowSpan: 1,
        columnSpan: 1,
      });
    });

    test("parses single cell C3", () => {
      const result = parseCellSpec("C3");

      expect(result.success).toBe(true);
      expect(result.cellSpan).toBeDefined();
      expect(result.cellSpan!).toEqual({
        startRow: 2,
        startColumn: 2,
        rowSpan: 1,
        columnSpan: 1,
      });
    });

    test("parses range A1:B2", () => {
      const result = parseCellSpec("A1:B2");

      expect(result.success).toBe(true);
      expect(result.cellSpan).toBeDefined();
      expect(result.cellSpan!).toEqual({
        startRow: 0,
        startColumn: 0,
        rowSpan: 2,
        columnSpan: 2,
      });
    });

    test("parses range A1:C1 (single row)", () => {
      const result = parseCellSpec("A1:C1");

      expect(result.success).toBe(true);
      expect(result.cellSpan).toBeDefined();
      expect(result.cellSpan!).toEqual({
        startRow: 0,
        startColumn: 0,
        rowSpan: 1,
        columnSpan: 3,
      });
    });

    test("handles reverse range B2:A1", () => {
      const result = parseCellSpec("B2:A1");

      expect(result.success).toBe(true);
      expect(result.cellSpan).toBeDefined();
      // Should normalize to top-left start
      expect(result.cellSpan!.startRow).toBe(0);
      expect(result.cellSpan!.startColumn).toBe(0);
      expect(result.cellSpan!.rowSpan).toBe(2);
      expect(result.cellSpan!.columnSpan).toBe(2);
    });

    test("handles lowercase input", () => {
      const result = parseCellSpec("a1:c3");

      expect(result.success).toBe(true);
      expect(result.cellSpan).toBeDefined();
      expect(result.cellSpan!.startRow).toBe(0);
      expect(result.cellSpan!.startColumn).toBe(0);
    });
  });

  describe("invalid input", () => {
    test("rejects empty string", () => {
      const result = parseCellSpec("");

      expect(result.success).toBe(false);
    });

    test("rejects invalid format", () => {
      const result = parseCellSpec("invalid");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Invalid cell specification");
      }
    });

    test("rejects mixed format", () => {
      const result = parseCellSpec("A1:1,2");

      expect(result.success).toBe(false);
    });
  });
});

describe("formatCellSpec", () => {
  test("formats single cell", () => {
    const span: CellSpan = { startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 1 };
    expect(formatCellSpec(span)).toBe("A1");
  });

  test("formats range", () => {
    const span: CellSpan = { startRow: 0, startColumn: 0, rowSpan: 2, columnSpan: 3 };
    expect(formatCellSpec(span)).toBe("A1:C2");
  });
});

describe("formatCellSpecCoords", () => {
  test("formats single cell", () => {
    const span: CellSpan = { startRow: 1, startColumn: 2, rowSpan: 1, columnSpan: 1 };
    expect(formatCellSpecCoords(span)).toBe("1,2");
  });

  test("formats span", () => {
    const span: CellSpan = { startRow: 0, startColumn: 0, rowSpan: 2, columnSpan: 3 };
    expect(formatCellSpecCoords(span)).toBe("0,0:2x3");
  });
});

describe("validateCellSpan", () => {
  let gridState: GridState;

  beforeEach(() => {
    gridState = initializeGridState(0, { rows: 3, columns: 3 });
  });

  test("validates cell within bounds", () => {
    const span: CellSpan = { startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 1 };
    const result = validateCellSpan(span, gridState);

    expect(result.valid).toBe(true);
  });

  test("rejects cell outside bounds (row)", () => {
    const span: CellSpan = { startRow: 3, startColumn: 0, rowSpan: 1, columnSpan: 1 };
    const result = validateCellSpan(span, gridState);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("outside grid bounds");
  });

  test("rejects cell outside bounds (column)", () => {
    const span: CellSpan = { startRow: 0, startColumn: 3, rowSpan: 1, columnSpan: 1 };
    const result = validateCellSpan(span, gridState);

    expect(result.valid).toBe(false);
  });

  test("rejects span that extends outside bounds", () => {
    const span: CellSpan = { startRow: 2, startColumn: 2, rowSpan: 2, columnSpan: 1 };
    const result = validateCellSpan(span, gridState);

    expect(result.valid).toBe(false);
  });

  test("detects overlap with existing assignment", () => {
    // Assign window to A1
    gridState = assignWindowToGrid(
      "win-1",
      { startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 1 },
      gridState
    );

    // Try to assign another window to same cell
    const span: CellSpan = { startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 1 };
    const result = validateCellSpan(span, gridState);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("overlaps");
  });

  test("detects partial overlap", () => {
    // Assign window to A1:B2
    gridState = assignWindowToGrid(
      "win-1",
      { startRow: 0, startColumn: 0, rowSpan: 2, columnSpan: 2 },
      gridState
    );

    // Try to assign to B2 (overlaps)
    const span: CellSpan = { startRow: 1, startColumn: 1, rowSpan: 1, columnSpan: 1 };
    const result = validateCellSpan(span, gridState);

    expect(result.valid).toBe(false);
  });

  test("allows excluding window from overlap check", () => {
    // Assign window to A1
    gridState = assignWindowToGrid(
      "win-1",
      { startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 1 },
      gridState
    );

    // Validate same cell, excluding win-1 (for moving/resizing)
    const span: CellSpan = { startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 1 };
    const result = validateCellSpan(span, gridState, "win-1");

    expect(result.valid).toBe(true);
  });
});

describe("getAvailableCells", () => {
  let gridState: GridState;

  beforeEach(() => {
    gridState = initializeGridState(0, { rows: 3, columns: 3 });
  });

  test("returns all cells for empty grid", () => {
    const available = getAvailableCells(gridState);

    expect(available).toHaveLength(9);
    expect(available).toContainEqual({ row: 0, column: 0 });
    expect(available).toContainEqual({ row: 2, column: 2 });
  });

  test("excludes occupied cells", () => {
    gridState = assignWindowToGrid(
      "win-1",
      { startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 1 },
      gridState
    );

    const available = getAvailableCells(gridState);

    expect(available).toHaveLength(8);
    expect(available).not.toContainEqual({ row: 0, column: 0 });
  });

  test("excludes all cells in a span", () => {
    gridState = assignWindowToGrid(
      "win-1",
      { startRow: 0, startColumn: 0, rowSpan: 2, columnSpan: 2 },
      gridState
    );

    const available = getAvailableCells(gridState);

    expect(available).toHaveLength(5);
    expect(available).not.toContainEqual({ row: 0, column: 0 });
    expect(available).not.toContainEqual({ row: 0, column: 1 });
    expect(available).not.toContainEqual({ row: 1, column: 0 });
    expect(available).not.toContainEqual({ row: 1, column: 1 });
  });
});

describe("findAvailableSpan", () => {
  let gridState: GridState;

  beforeEach(() => {
    gridState = initializeGridState(0, { rows: 3, columns: 3 });
  });

  test("finds 1x1 span in empty grid", () => {
    const span = findAvailableSpan(1, 1, gridState);

    expect(span).toEqual({
      startRow: 0,
      startColumn: 0,
      rowSpan: 1,
      columnSpan: 1,
    });
  });

  test("finds 2x2 span in empty grid", () => {
    const span = findAvailableSpan(2, 2, gridState);

    expect(span).toEqual({
      startRow: 0,
      startColumn: 0,
      rowSpan: 2,
      columnSpan: 2,
    });
  });

  test("finds span after existing assignment", () => {
    gridState = assignWindowToGrid(
      "win-1",
      { startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 1 },
      gridState
    );

    const span = findAvailableSpan(1, 1, gridState);

    // Should find next available cell
    expect(span).not.toBeNull();
    expect(span?.startRow).toBe(0);
    expect(span?.startColumn).toBe(1);
  });

  test("returns null when no span fits", () => {
    // Fill most of the grid
    gridState = assignWindowToGrid(
      "win-1",
      { startRow: 0, startColumn: 0, rowSpan: 2, columnSpan: 3 },
      gridState
    );
    gridState = assignWindowToGrid(
      "win-2",
      { startRow: 2, startColumn: 0, rowSpan: 1, columnSpan: 2 },
      gridState
    );

    // Try to find 2x2 span (won't fit)
    const span = findAvailableSpan(2, 2, gridState);

    expect(span).toBeNull();
  });

  test("returns null for span larger than grid", () => {
    const span = findAvailableSpan(4, 4, gridState);

    expect(span).toBeNull();
  });
});

describe("assignWindowToGrid", () => {
  let gridState: GridState;

  beforeEach(() => {
    gridState = initializeGridState(0);
  });

  test("adds new window assignment", () => {
    const span: CellSpan = { startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 1 };
    const newState = assignWindowToGrid("win-1", span, gridState);

    expect(newState.assignments).toHaveLength(1);
    expect(newState.assignments[0].windowId).toBe("win-1");
    expect(newState.assignments[0].cellSpan).toEqual(span);
  });

  test("updates existing window assignment", () => {
    const span1: CellSpan = { startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 1 };
    const span2: CellSpan = { startRow: 1, startColumn: 1, rowSpan: 1, columnSpan: 1 };

    let state = assignWindowToGrid("win-1", span1, gridState);
    state = assignWindowToGrid("win-1", span2, state);

    expect(state.assignments).toHaveLength(1);
    expect(state.assignments[0].cellSpan).toEqual(span2);
  });

  test("updates lastUpdated timestamp", () => {
    const span: CellSpan = { startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 1 };
    const newState = assignWindowToGrid("win-1", span, gridState);

    // Verify lastUpdated is a valid ISO timestamp
    expect(newState.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(new Date(newState.lastUpdated).getTime()).toBeGreaterThanOrEqual(
      new Date(gridState.lastUpdated).getTime()
    );
  });
});

describe("removeWindowFromGrid", () => {
  test("removes existing assignment", () => {
    let state = initializeGridState(0);
    state = assignWindowToGrid(
      "win-1",
      { startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 1 },
      state
    );
    state = assignWindowToGrid(
      "win-2",
      { startRow: 1, startColumn: 0, rowSpan: 1, columnSpan: 1 },
      state
    );

    const newState = removeWindowFromGrid("win-1", state);

    expect(newState.assignments).toHaveLength(1);
    expect(newState.assignments[0].windowId).toBe("win-2");
  });

  test("handles non-existent window", () => {
    const state = initializeGridState(0);
    const newState = removeWindowFromGrid("non-existent", state);

    expect(newState.assignments).toHaveLength(0);
  });
});

describe("getWindowCellSpan", () => {
  test("returns cell span for assigned window", () => {
    let state = initializeGridState(0);
    const span: CellSpan = { startRow: 1, startColumn: 2, rowSpan: 1, columnSpan: 1 };
    state = assignWindowToGrid("win-1", span, state);

    const result = getWindowCellSpan("win-1", state);

    expect(result).toEqual(span);
  });

  test("returns null for unassigned window", () => {
    const state = initializeGridState(0);

    const result = getWindowCellSpan("non-existent", state);

    expect(result).toBeNull();
  });
});

describe("swapWindowPositions", () => {
  test("swaps cell spans between two windows", () => {
    let state = initializeGridState(0);
    const span1: CellSpan = { startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 1 };
    const span2: CellSpan = { startRow: 2, startColumn: 2, rowSpan: 1, columnSpan: 1 };

    state = assignWindowToGrid("win-1", span1, state);
    state = assignWindowToGrid("win-2", span2, state);

    const newState = swapWindowPositions("win-1", "win-2", state);

    expect(getWindowCellSpan("win-1", newState)).toEqual(span2);
    expect(getWindowCellSpan("win-2", newState)).toEqual(span1);
  });

  test("throws when window not assigned", () => {
    let state = initializeGridState(0);
    state = assignWindowToGrid(
      "win-1",
      { startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 1 },
      state
    );

    expect(() => swapWindowPositions("win-1", "win-2", state)).toThrow(
      "Both windows must have grid assignments"
    );
  });
});

describe("visualizeGrid", () => {
  test("generates ASCII visualization for empty grid", () => {
    const state = initializeGridState(0, { rows: 2, columns: 2 });
    const windowNames = new Map<string, string>();

    const output = visualizeGrid(state, windowNames);

    expect(output).toContain("[A1]");
    expect(output).toContain("[B1]");
    expect(output).toContain("[A2]");
    expect(output).toContain("[B2]");
    expect(output).toContain("+");
    expect(output).toContain("|");
  });

  test("shows window names in assigned cells", () => {
    let state = initializeGridState(0, { rows: 2, columns: 2 });
    state = assignWindowToGrid(
      "win-1",
      { startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 1 },
      state
    );

    const windowNames = new Map([["win-1", "Calendar"]]);

    const output = visualizeGrid(state, windowNames);

    expect(output).toContain("Calendar");
    expect(output).toContain("[B1]"); // Unassigned cell
  });

  test("shows ... for spanned cells", () => {
    let state = initializeGridState(0, { rows: 2, columns: 2 });
    state = assignWindowToGrid(
      "win-1",
      { startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 2 },
      state
    );

    const windowNames = new Map([["win-1", "Wide"]]);

    const output = visualizeGrid(state, windowNames);

    expect(output).toContain("Wide");
    expect(output).toContain("...");
  });
});
