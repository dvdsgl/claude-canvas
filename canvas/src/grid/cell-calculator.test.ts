// Tests for Cell Calculator
// Tests pixel position calculations from grid configuration

import { test, expect, describe } from "bun:test";
import {
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
import type { GridConfig, CellSpan, MonitorInfo } from "./types";

// Mock monitor for testing - 1920x1080 with taskbar
const mockMonitor: MonitorInfo = {
  index: 0,
  name: "\\\\.\\\DISPLAY1",
  width: 1920,
  height: 1080,
  workAreaX: 0,
  workAreaY: 0,
  workAreaWidth: 1920,
  workAreaHeight: 1040, // 40px taskbar
  scaleFactor: 1.0,
  isPrimary: true,
};

// Default 3x3 grid config
const default3x3Config: GridConfig = {
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

describe("calculateSingleCellSize", () => {
  test("calculates cell size for 3x3 grid", () => {
    const size = calculateSingleCellSize(default3x3Config, mockMonitor);

    // Available: 1920px wide, 1040px tall
    // Gaps: 2 horizontal gaps * 4px = 8px, 2 vertical gaps * 4px = 8px
    // Cell width: floor((1920 - 8) / 3) = 637
    // Cell height: floor((1040 - 8) / 3) = 344
    expect(size.width).toBe(637);
    expect(size.height).toBe(344);
  });

  test("accounts for margins", () => {
    const configWithMargins: GridConfig = {
      ...default3x3Config,
      marginTop: 10,
      marginBottom: 10,
      marginLeft: 20,
      marginRight: 20,
    };

    const size = calculateSingleCellSize(configWithMargins, mockMonitor);

    // Available: 1920 - 40 = 1880 wide, 1040 - 20 = 1020 tall
    // Gaps: 8px horizontal, 8px vertical
    // Cell width: floor((1880 - 8) / 3) = 624
    // Cell height: floor((1020 - 8) / 3) = 337
    expect(size.width).toBe(624);
    expect(size.height).toBe(337);
  });

  test("handles single cell grid", () => {
    const config: GridConfig = {
      ...default3x3Config,
      rows: 1,
      columns: 1,
    };

    const size = calculateSingleCellSize(config, mockMonitor);

    // No gaps for 1x1 grid
    expect(size.width).toBe(1920);
    expect(size.height).toBe(1040);
  });
});

describe("calculateCellRect", () => {
  test("calculates position for cell 0,0", () => {
    const span: CellSpan = { startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 1 };
    const rect = calculateCellRect(span, default3x3Config, mockMonitor);

    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    expect(rect.width).toBe(637);
    expect(rect.height).toBe(344);
  });

  test("calculates position for cell 1,1 (center)", () => {
    const span: CellSpan = { startRow: 1, startColumn: 1, rowSpan: 1, columnSpan: 1 };
    const rect = calculateCellRect(span, default3x3Config, mockMonitor);

    // Position should account for gap
    // x = 1 * (637 + 4) = 641
    // y = 1 * (344 + 4) = 348
    expect(rect.x).toBe(641);
    expect(rect.y).toBe(348);
  });

  test("calculates position for cell 2,2 (bottom-right)", () => {
    const span: CellSpan = { startRow: 2, startColumn: 2, rowSpan: 1, columnSpan: 1 };
    const rect = calculateCellRect(span, default3x3Config, mockMonitor);

    // x = 2 * (637 + 4) = 1282
    // y = 2 * (344 + 4) = 696
    expect(rect.x).toBe(1282);
    expect(rect.y).toBe(696);
  });

  test("calculates multi-cell span (2x2)", () => {
    const span: CellSpan = { startRow: 0, startColumn: 0, rowSpan: 2, columnSpan: 2 };
    const rect = calculateCellRect(span, default3x3Config, mockMonitor);

    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    // Width: 2 cells + 1 gap = 637*2 + 4 = 1278
    // Height: 2 cells + 1 gap = 344*2 + 4 = 692
    expect(rect.width).toBe(1278);
    expect(rect.height).toBe(692);
  });

  test("calculates full row span", () => {
    const span: CellSpan = { startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 3 };
    const rect = calculateCellRect(span, default3x3Config, mockMonitor);

    // Width: 3 cells + 2 gaps = 637*3 + 8 = 1919
    expect(rect.width).toBe(1919);
    expect(rect.height).toBe(344);
  });
});

describe("calculateAllCells", () => {
  test("generates all cells for 3x3 grid", () => {
    const dimensions = calculateAllCells(default3x3Config, mockMonitor);

    expect(dimensions.cells).toHaveLength(9);
    expect(dimensions.cellWidth).toBe(637);
    expect(dimensions.cellHeight).toBe(344);
  });

  test("cells are in row-major order", () => {
    const dimensions = calculateAllCells(default3x3Config, mockMonitor);

    // First row
    expect(dimensions.cells[0]).toEqual({ row: 0, column: 0, rect: expect.any(Object) });
    expect(dimensions.cells[1]).toEqual({ row: 0, column: 1, rect: expect.any(Object) });
    expect(dimensions.cells[2]).toEqual({ row: 0, column: 2, rect: expect.any(Object) });

    // Second row
    expect(dimensions.cells[3]).toEqual({ row: 1, column: 0, rect: expect.any(Object) });
  });
});

describe("getCellAtPosition", () => {
  test("finds cell at pixel position", () => {
    // Point in center cell (1,1)
    const cell = getCellAtPosition(700, 400, default3x3Config, mockMonitor);

    expect(cell).toEqual({ row: 1, column: 1 });
  });

  test("returns null for position outside grid", () => {
    const cell = getCellAtPosition(2000, 500, default3x3Config, mockMonitor);

    expect(cell).toBeNull();
  });

  test("finds corner cell (0,0)", () => {
    const cell = getCellAtPosition(10, 10, default3x3Config, mockMonitor);

    expect(cell).toEqual({ row: 0, column: 0 });
  });

  test("finds bottom-right cell (2,2)", () => {
    const cell = getCellAtPosition(1500, 800, default3x3Config, mockMonitor);

    expect(cell).toEqual({ row: 2, column: 2 });
  });
});

describe("getCellCenter", () => {
  test("calculates center of cell 0,0", () => {
    const center = getCellCenter(0, 0, default3x3Config, mockMonitor);

    // Cell width: 637, height: 344
    // Center: (318, 172)
    expect(center.x).toBe(318);
    expect(center.y).toBe(172);
  });

  test("calculates center of cell 1,1", () => {
    const center = getCellCenter(1, 1, default3x3Config, mockMonitor);

    // Cell at (641, 348), size 637x344
    // Center: 641 + 318 = 959, 348 + 172 = 520
    expect(center.x).toBe(959);
    expect(center.y).toBe(520);
  });
});

describe("calculateRemainingSpace", () => {
  test("calculates leftover pixels from integer division", () => {
    const remaining = calculateRemainingSpace(default3x3Config, mockMonitor);

    // Width: 1920 - (637*3 + 8) = 1920 - 1919 = 1
    // Height: 1040 - (344*3 + 8) = 1040 - 1040 = 0
    expect(remaining.horizontal).toBe(1);
    expect(remaining.vertical).toBe(0);
  });
});

describe("cellToExcelNotation", () => {
  test("converts single-letter columns", () => {
    expect(cellToExcelNotation(0, 0)).toBe("A1");
    expect(cellToExcelNotation(0, 1)).toBe("B1");
    expect(cellToExcelNotation(0, 25)).toBe("Z1");
  });

  test("converts multi-letter columns", () => {
    expect(cellToExcelNotation(0, 26)).toBe("AA1");
    expect(cellToExcelNotation(0, 27)).toBe("AB1");
    expect(cellToExcelNotation(0, 51)).toBe("AZ1");
    expect(cellToExcelNotation(0, 52)).toBe("BA1");
  });

  test("converts row numbers", () => {
    expect(cellToExcelNotation(0, 0)).toBe("A1");
    expect(cellToExcelNotation(1, 0)).toBe("A2");
    expect(cellToExcelNotation(9, 0)).toBe("A10");
    expect(cellToExcelNotation(99, 0)).toBe("A100");
  });

  test("converts various cells", () => {
    expect(cellToExcelNotation(2, 2)).toBe("C3");
    expect(cellToExcelNotation(4, 3)).toBe("D5");
  });
});

describe("excelNotationToCell", () => {
  test("parses single-letter columns", () => {
    expect(excelNotationToCell("A1")).toEqual({ row: 0, column: 0 });
    expect(excelNotationToCell("B1")).toEqual({ row: 0, column: 1 });
    expect(excelNotationToCell("Z1")).toEqual({ row: 0, column: 25 });
  });

  test("parses multi-letter columns", () => {
    expect(excelNotationToCell("AA1")).toEqual({ row: 0, column: 26 });
    expect(excelNotationToCell("AB1")).toEqual({ row: 0, column: 27 });
    expect(excelNotationToCell("BA1")).toEqual({ row: 0, column: 52 });
  });

  test("parses row numbers", () => {
    expect(excelNotationToCell("A2")).toEqual({ row: 1, column: 0 });
    expect(excelNotationToCell("A10")).toEqual({ row: 9, column: 0 });
    expect(excelNotationToCell("A100")).toEqual({ row: 99, column: 0 });
  });

  test("handles lowercase input", () => {
    expect(excelNotationToCell("a1")).toEqual({ row: 0, column: 0 });
    expect(excelNotationToCell("c3")).toEqual({ row: 2, column: 2 });
  });

  test("returns null for invalid input", () => {
    expect(excelNotationToCell("")).toBeNull();
    expect(excelNotationToCell("1A")).toBeNull();
    expect(excelNotationToCell("A")).toBeNull();
    expect(excelNotationToCell("1")).toBeNull();
    expect(excelNotationToCell("A0")).toBeNull(); // Row 0 is invalid
  });

  test("round-trips with cellToExcelNotation", () => {
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 30; col++) {
        const notation = cellToExcelNotation(row, col);
        const parsed = excelNotationToCell(notation);
        expect(parsed).toEqual({ row, column: col });
      }
    }
  });
});

describe("formatCellSpan", () => {
  test("formats single cell", () => {
    const span: CellSpan = { startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 1 };
    expect(formatCellSpan(span)).toBe("A1");
  });

  test("formats cell range", () => {
    const span: CellSpan = { startRow: 0, startColumn: 0, rowSpan: 2, columnSpan: 2 };
    expect(formatCellSpan(span)).toBe("A1:B2");
  });

  test("formats row span", () => {
    const span: CellSpan = { startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 3 };
    expect(formatCellSpan(span)).toBe("A1:C1");
  });

  test("formats column span", () => {
    const span: CellSpan = { startRow: 0, startColumn: 0, rowSpan: 3, columnSpan: 1 };
    expect(formatCellSpan(span)).toBe("A1:A3");
  });
});

describe("formatCellSpanCoords", () => {
  test("formats single cell", () => {
    const span: CellSpan = { startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 1 };
    expect(formatCellSpanCoords(span)).toBe("0,0");
  });

  test("formats cell range", () => {
    const span: CellSpan = { startRow: 0, startColumn: 0, rowSpan: 2, columnSpan: 3 };
    expect(formatCellSpanCoords(span)).toBe("0,0:2x3");
  });

  test("formats offset cell", () => {
    const span: CellSpan = { startRow: 1, startColumn: 2, rowSpan: 1, columnSpan: 1 };
    expect(formatCellSpanCoords(span)).toBe("1,2");
  });
});
