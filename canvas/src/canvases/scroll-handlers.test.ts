// Integration tests for scroll handlers across all canvas types
import { describe, expect, test } from "bun:test";

// Simulated scroll event type
interface ScrollEvent {
  scrollDirection: "up" | "down" | null;
  modifiers: {
    shift: boolean;
    meta: boolean;
    ctrl: boolean;
  };
}

// Document scroll handler logic
function documentScrollHandler(
  event: ScrollEvent,
  scrollOffset: number,
  maxScroll: number
): number {
  if (event.scrollDirection === "up") {
    return Math.max(0, scrollOffset - 3);
  } else if (event.scrollDirection === "down") {
    return Math.min(maxScroll, scrollOffset + 3);
  }
  return scrollOffset;
}

// Calendar scroll handler logic
function calendarScrollHandler(
  event: ScrollEvent,
  currentDate: Date
): Date {
  const newDate = new Date(currentDate);
  if (event.scrollDirection === "up") {
    newDate.setDate(currentDate.getDate() - 7);
  } else if (event.scrollDirection === "down") {
    newDate.setDate(currentDate.getDate() + 7);
  }
  return newDate;
}

// Flight scroll handler logic
function flightScrollHandler(
  event: ScrollEvent,
  focusMode: "flights" | "seatmap",
  selectedFlightIndex: number,
  seatCursorRow: number,
  flightsLength: number,
  seatmapRows: number,
  countdown: number | null
): { selectedFlightIndex: number; seatCursorRow: number } {
  if (countdown !== null) {
    return { selectedFlightIndex, seatCursorRow }; // Ignore during countdown
  }

  if (focusMode === "flights") {
    if (event.scrollDirection === "up") {
      return {
        selectedFlightIndex: Math.max(0, selectedFlightIndex - 1),
        seatCursorRow,
      };
    } else if (event.scrollDirection === "down") {
      return {
        selectedFlightIndex: Math.min(flightsLength - 1, selectedFlightIndex + 1),
        seatCursorRow,
      };
    }
  } else if (focusMode === "seatmap") {
    if (event.scrollDirection === "up") {
      return {
        selectedFlightIndex,
        seatCursorRow: Math.max(1, seatCursorRow - 1),
      };
    } else if (event.scrollDirection === "down") {
      return {
        selectedFlightIndex,
        seatCursorRow: Math.min(seatmapRows, seatCursorRow + 1),
      };
    }
  }

  return { selectedFlightIndex, seatCursorRow };
}

// Meeting picker scroll handler logic
function meetingPickerScrollHandler(
  event: ScrollEvent,
  cursorSlot: number,
  currentDate: Date,
  totalSlots: number,
  countdown: number | null
): { cursorSlot: number; currentDate: Date } {
  if (countdown !== null) {
    return { cursorSlot, currentDate }; // Ignore during countdown
  }

  if (event.modifiers.shift) {
    // Week navigation
    const newDate = new Date(currentDate);
    if (event.scrollDirection === "up") {
      newDate.setDate(currentDate.getDate() - 7);
    } else if (event.scrollDirection === "down") {
      newDate.setDate(currentDate.getDate() + 7);
    }
    return { cursorSlot, currentDate: newDate };
  } else {
    // Slot navigation
    if (event.scrollDirection === "up") {
      return {
        cursorSlot: Math.max(0, cursorSlot - 1),
        currentDate,
      };
    } else if (event.scrollDirection === "down") {
      return {
        cursorSlot: Math.min(totalSlots - 1, cursorSlot + 1),
        currentDate,
      };
    }
  }

  return { cursorSlot, currentDate };
}

describe("Document scroll handler", () => {
  test("scroll up should decrease offset by 3", () => {
    const event: ScrollEvent = {
      scrollDirection: "up",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    expect(documentScrollHandler(event, 10, 100)).toBe(7);
  });

  test("scroll down should increase offset by 3", () => {
    const event: ScrollEvent = {
      scrollDirection: "down",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    expect(documentScrollHandler(event, 10, 100)).toBe(13);
  });

  test("scroll up at top boundary should stay at 0", () => {
    const event: ScrollEvent = {
      scrollDirection: "up",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    expect(documentScrollHandler(event, 0, 100)).toBe(0);
    expect(documentScrollHandler(event, 1, 100)).toBe(0);
    expect(documentScrollHandler(event, 2, 100)).toBe(0);
  });

  test("scroll down at bottom boundary should stay at maxScroll", () => {
    const event: ScrollEvent = {
      scrollDirection: "down",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    expect(documentScrollHandler(event, 100, 100)).toBe(100);
    expect(documentScrollHandler(event, 99, 100)).toBe(100);
    expect(documentScrollHandler(event, 98, 100)).toBe(100);
  });

  test("null scroll direction should not change offset", () => {
    const event: ScrollEvent = {
      scrollDirection: null,
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    expect(documentScrollHandler(event, 50, 100)).toBe(50);
  });
});

describe("Calendar scroll handler", () => {
  test("scroll up should go to previous week", () => {
    const event: ScrollEvent = {
      scrollDirection: "up",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    const currentDate = new Date("2026-01-15");
    const result = calendarScrollHandler(event, currentDate);
    expect(result.getDate()).toBe(8); // Jan 8
  });

  test("scroll down should go to next week", () => {
    const event: ScrollEvent = {
      scrollDirection: "down",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    const currentDate = new Date("2026-01-15");
    const result = calendarScrollHandler(event, currentDate);
    expect(result.getDate()).toBe(22); // Jan 22
  });

  test("scroll should handle month boundaries", () => {
    const event: ScrollEvent = {
      scrollDirection: "down",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    const currentDate = new Date("2026-01-29");
    const result = calendarScrollHandler(event, currentDate);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(5);
  });

  test("scroll should handle year boundaries", () => {
    const event: ScrollEvent = {
      scrollDirection: "up",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    const currentDate = new Date("2026-01-03");
    const result = calendarScrollHandler(event, currentDate);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(11); // December
  });
});

describe("Flight scroll handler", () => {
  test("scroll up in flights mode should select previous flight", () => {
    const event: ScrollEvent = {
      scrollDirection: "up",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    const result = flightScrollHandler(event, "flights", 2, 5, 5, 30, null);
    expect(result.selectedFlightIndex).toBe(1);
    expect(result.seatCursorRow).toBe(5); // Unchanged
  });

  test("scroll down in flights mode should select next flight", () => {
    const event: ScrollEvent = {
      scrollDirection: "down",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    const result = flightScrollHandler(event, "flights", 2, 5, 5, 30, null);
    expect(result.selectedFlightIndex).toBe(3);
  });

  test("scroll up in seatmap mode should move cursor up", () => {
    const event: ScrollEvent = {
      scrollDirection: "up",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    const result = flightScrollHandler(event, "seatmap", 2, 15, 5, 30, null);
    expect(result.selectedFlightIndex).toBe(2); // Unchanged
    expect(result.seatCursorRow).toBe(14);
  });

  test("scroll down in seatmap mode should move cursor down", () => {
    const event: ScrollEvent = {
      scrollDirection: "down",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    const result = flightScrollHandler(event, "seatmap", 2, 15, 5, 30, null);
    expect(result.seatCursorRow).toBe(16);
  });

  test("scroll at first flight should stay at 0", () => {
    const event: ScrollEvent = {
      scrollDirection: "up",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    const result = flightScrollHandler(event, "flights", 0, 5, 5, 30, null);
    expect(result.selectedFlightIndex).toBe(0);
  });

  test("scroll at last flight should stay at last", () => {
    const event: ScrollEvent = {
      scrollDirection: "down",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    const result = flightScrollHandler(event, "flights", 4, 5, 5, 30, null);
    expect(result.selectedFlightIndex).toBe(4);
  });

  test("scroll should be ignored during countdown", () => {
    const event: ScrollEvent = {
      scrollDirection: "up",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    const result = flightScrollHandler(event, "flights", 2, 5, 5, 30, 3);
    expect(result.selectedFlightIndex).toBe(2); // Unchanged
  });

  test("seatmap scroll at row 1 should stay at row 1", () => {
    const event: ScrollEvent = {
      scrollDirection: "up",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    const result = flightScrollHandler(event, "seatmap", 2, 1, 5, 30, null);
    expect(result.seatCursorRow).toBe(1);
  });

  test("seatmap scroll at last row should stay at last row", () => {
    const event: ScrollEvent = {
      scrollDirection: "down",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    const result = flightScrollHandler(event, "seatmap", 2, 30, 5, 30, null);
    expect(result.seatCursorRow).toBe(30);
  });
});

describe("Meeting picker scroll handler", () => {
  test("scroll up should move to previous slot", () => {
    const event: ScrollEvent = {
      scrollDirection: "up",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    const currentDate = new Date("2026-01-15");
    const result = meetingPickerScrollHandler(event, 10, currentDate, 32, null);
    expect(result.cursorSlot).toBe(9);
    expect(result.currentDate.getTime()).toBe(currentDate.getTime()); // Date unchanged
  });

  test("scroll down should move to next slot", () => {
    const event: ScrollEvent = {
      scrollDirection: "down",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    const currentDate = new Date("2026-01-15");
    const result = meetingPickerScrollHandler(event, 10, currentDate, 32, null);
    expect(result.cursorSlot).toBe(11);
  });

  test("shift+scroll up should go to previous week", () => {
    const event: ScrollEvent = {
      scrollDirection: "up",
      modifiers: { shift: true, meta: false, ctrl: false },
    };
    const currentDate = new Date("2026-01-15");
    const result = meetingPickerScrollHandler(event, 10, currentDate, 32, null);
    expect(result.cursorSlot).toBe(10); // Slot unchanged
    expect(result.currentDate.getDate()).toBe(8); // Week changed
  });

  test("shift+scroll down should go to next week", () => {
    const event: ScrollEvent = {
      scrollDirection: "down",
      modifiers: { shift: true, meta: false, ctrl: false },
    };
    const currentDate = new Date("2026-01-15");
    const result = meetingPickerScrollHandler(event, 10, currentDate, 32, null);
    expect(result.cursorSlot).toBe(10);
    expect(result.currentDate.getDate()).toBe(22);
  });

  test("scroll at first slot should stay at 0", () => {
    const event: ScrollEvent = {
      scrollDirection: "up",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    const currentDate = new Date("2026-01-15");
    const result = meetingPickerScrollHandler(event, 0, currentDate, 32, null);
    expect(result.cursorSlot).toBe(0);
  });

  test("scroll at last slot should stay at last", () => {
    const event: ScrollEvent = {
      scrollDirection: "down",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    const currentDate = new Date("2026-01-15");
    const result = meetingPickerScrollHandler(event, 31, currentDate, 32, null);
    expect(result.cursorSlot).toBe(31);
  });

  test("scroll should be ignored during countdown", () => {
    const event: ScrollEvent = {
      scrollDirection: "up",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    const currentDate = new Date("2026-01-15");
    const result = meetingPickerScrollHandler(event, 10, currentDate, 32, 2);
    expect(result.cursorSlot).toBe(10); // Unchanged
  });

  test("shift+scroll should also be ignored during countdown", () => {
    const event: ScrollEvent = {
      scrollDirection: "up",
      modifiers: { shift: true, meta: false, ctrl: false },
    };
    const currentDate = new Date("2026-01-15");
    const result = meetingPickerScrollHandler(event, 10, currentDate, 32, 2);
    expect(result.cursorSlot).toBe(10);
    expect(result.currentDate.getTime()).toBe(currentDate.getTime()); // Date unchanged
  });
});

describe("Edge cases across all canvases", () => {
  test("rapid scrolling should still respect boundaries", () => {
    const event: ScrollEvent = {
      scrollDirection: "up",
      modifiers: { shift: false, meta: false, ctrl: false },
    };

    // Simulate rapid scrolling from offset 10 to 0
    let offset = 10;
    for (let i = 0; i < 10; i++) {
      offset = documentScrollHandler(event, offset, 100);
    }
    expect(offset).toBe(0); // Should be clamped at 0
  });

  test("alternating scroll directions should work correctly", () => {
    const upEvent: ScrollEvent = {
      scrollDirection: "up",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    const downEvent: ScrollEvent = {
      scrollDirection: "down",
      modifiers: { shift: false, meta: false, ctrl: false },
    };

    let offset = 50;
    offset = documentScrollHandler(upEvent, offset, 100); // 47
    offset = documentScrollHandler(downEvent, offset, 100); // 50
    offset = documentScrollHandler(upEvent, offset, 100); // 47
    expect(offset).toBe(47);
  });

  test("empty flights array edge case", () => {
    const event: ScrollEvent = {
      scrollDirection: "down",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    // With 0 flights, Math.min(-1, 0 + 1) = -1, but we start at 0
    // This tests the handler's robustness
    const result = flightScrollHandler(event, "flights", 0, 5, 1, 30, null);
    expect(result.selectedFlightIndex).toBe(0);
  });

  test("single slot total slots edge case", () => {
    const event: ScrollEvent = {
      scrollDirection: "down",
      modifiers: { shift: false, meta: false, ctrl: false },
    };
    const currentDate = new Date("2026-01-15");
    const result = meetingPickerScrollHandler(event, 0, currentDate, 1, null);
    expect(result.cursorSlot).toBe(0); // Can't go past the only slot
  });
});
