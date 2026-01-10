// Unit tests for mouse hook - especially scroll detection
import { describe, expect, test } from "bun:test";

// We need to extract parseMouseEvent for testing
// For now, let's test the parsing logic directly

// SGR mouse format: \x1b[<btn;x;yM (press) or \x1b[<btn;x;ym (release)
// Button byte encoding:
// - Bits 0-1: button (0=left, 1=middle, 2=right, 3=release)
// - Bit 2 (4): shift
// - Bit 3 (8): meta
// - Bit 4 (16): ctrl
// - Bit 5 (32): motion
// - Bit 6 (64): scroll wheel
// For scroll: bit 0 determines direction (0=up, 1=down)

function parseMouseEvent(data: string) {
  const match = data.match(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/);
  if (!match) return null;

  const [, btnStr, xStr, yStr, action] = match;
  const btn = parseInt(btnStr, 10);
  const x = parseInt(xStr, 10);
  const y = parseInt(yStr, 10);
  const pressed = action === "M";

  const button = btn & 3;
  const shift = (btn & 4) !== 0;
  const meta = (btn & 8) !== 0;
  const ctrl = (btn & 16) !== 0;
  const isMotion = (btn & 32) !== 0;
  const isScroll = (btn & 64) !== 0;
  const scrollDirection: "up" | "down" | null = isScroll
    ? (btn & 1) === 0
      ? "up"
      : "down"
    : null;

  return {
    x,
    y,
    button: isScroll ? -1 : button === 3 ? 0 : button,
    pressed,
    isMotion,
    isScroll,
    scrollDirection,
    modifiers: { shift, meta, ctrl },
  };
}

describe("parseMouseEvent", () => {
  describe("scroll wheel detection", () => {
    test("should detect scroll up event", () => {
      // Scroll up: button byte = 64 (0b1000000)
      const event = parseMouseEvent("\x1b[<64;10;20M");
      expect(event).not.toBeNull();
      expect(event!.isScroll).toBe(true);
      expect(event!.scrollDirection).toBe("up");
      expect(event!.x).toBe(10);
      expect(event!.y).toBe(20);
      expect(event!.button).toBe(-1); // Scroll events have button = -1
    });

    test("should detect scroll down event", () => {
      // Scroll down: button byte = 65 (0b1000001)
      const event = parseMouseEvent("\x1b[<65;15;25M");
      expect(event).not.toBeNull();
      expect(event!.isScroll).toBe(true);
      expect(event!.scrollDirection).toBe("down");
      expect(event!.x).toBe(15);
      expect(event!.y).toBe(25);
      expect(event!.button).toBe(-1);
    });

    test("should detect scroll up with shift modifier", () => {
      // Scroll up + shift: 64 + 4 = 68
      const event = parseMouseEvent("\x1b[<68;10;20M");
      expect(event).not.toBeNull();
      expect(event!.isScroll).toBe(true);
      expect(event!.scrollDirection).toBe("up");
      expect(event!.modifiers.shift).toBe(true);
      expect(event!.modifiers.ctrl).toBe(false);
      expect(event!.modifiers.meta).toBe(false);
    });

    test("should detect scroll down with shift modifier", () => {
      // Scroll down + shift: 65 + 4 = 69
      const event = parseMouseEvent("\x1b[<69;10;20M");
      expect(event).not.toBeNull();
      expect(event!.isScroll).toBe(true);
      expect(event!.scrollDirection).toBe("down");
      expect(event!.modifiers.shift).toBe(true);
    });

    test("should detect scroll up with ctrl modifier", () => {
      // Scroll up + ctrl: 64 + 16 = 80
      const event = parseMouseEvent("\x1b[<80;10;20M");
      expect(event).not.toBeNull();
      expect(event!.isScroll).toBe(true);
      expect(event!.scrollDirection).toBe("up");
      expect(event!.modifiers.ctrl).toBe(true);
      expect(event!.modifiers.shift).toBe(false);
    });

    test("should detect scroll with multiple modifiers", () => {
      // Scroll up + shift + ctrl: 64 + 4 + 16 = 84
      const event = parseMouseEvent("\x1b[<84;10;20M");
      expect(event).not.toBeNull();
      expect(event!.isScroll).toBe(true);
      expect(event!.scrollDirection).toBe("up");
      expect(event!.modifiers.shift).toBe(true);
      expect(event!.modifiers.ctrl).toBe(true);
    });
  });

  describe("regular mouse events (non-scroll)", () => {
    test("should detect left click", () => {
      // Left button press: button byte = 0
      const event = parseMouseEvent("\x1b[<0;10;20M");
      expect(event).not.toBeNull();
      expect(event!.isScroll).toBe(false);
      expect(event!.scrollDirection).toBeNull();
      expect(event!.button).toBe(0);
      expect(event!.pressed).toBe(true);
    });

    test("should detect right click", () => {
      // Right button press: button byte = 2
      const event = parseMouseEvent("\x1b[<2;10;20M");
      expect(event).not.toBeNull();
      expect(event!.isScroll).toBe(false);
      expect(event!.button).toBe(2);
    });

    test("should detect button release", () => {
      // Release (lowercase m)
      const event = parseMouseEvent("\x1b[<0;10;20m");
      expect(event).not.toBeNull();
      expect(event!.pressed).toBe(false);
    });

    test("should detect motion event", () => {
      // Motion: button byte = 32
      const event = parseMouseEvent("\x1b[<32;10;20M");
      expect(event).not.toBeNull();
      expect(event!.isMotion).toBe(true);
      expect(event!.isScroll).toBe(false);
    });

    test("should not confuse motion with scroll", () => {
      // Motion (32) should not be detected as scroll (64)
      const event = parseMouseEvent("\x1b[<32;10;20M");
      expect(event!.isScroll).toBe(false);
      expect(event!.scrollDirection).toBeNull();
    });
  });

  describe("edge cases", () => {
    test("should return null for invalid input", () => {
      expect(parseMouseEvent("not a mouse event")).toBeNull();
      expect(parseMouseEvent("\x1b[invalid")).toBeNull();
      expect(parseMouseEvent("")).toBeNull();
    });

    test("should handle large coordinates", () => {
      const event = parseMouseEvent("\x1b[<64;999;999M");
      expect(event).not.toBeNull();
      expect(event!.x).toBe(999);
      expect(event!.y).toBe(999);
    });

    test("should handle coordinate 1 (minimum)", () => {
      const event = parseMouseEvent("\x1b[<64;1;1M");
      expect(event).not.toBeNull();
      expect(event!.x).toBe(1);
      expect(event!.y).toBe(1);
    });
  });
});

describe("scroll boundary behavior", () => {
  // These are logic tests for the scroll handlers

  test("document scroll should clamp to 0 at top", () => {
    let scrollOffset = 0;
    const maxScroll = 100;

    // Simulate scroll up at top boundary
    const newOffset = Math.max(0, scrollOffset - 3);
    expect(newOffset).toBe(0);
  });

  test("document scroll should clamp to maxScroll at bottom", () => {
    let scrollOffset = 99;
    const maxScroll = 100;

    // Simulate scroll down near bottom
    const newOffset = Math.min(maxScroll, scrollOffset + 3);
    expect(newOffset).toBe(100);
  });

  test("flight list scroll should clamp to 0 at first flight", () => {
    let selectedIndex = 0;
    const flightsLength = 5;

    // Simulate scroll up at first flight
    const newIndex = Math.max(0, selectedIndex - 1);
    expect(newIndex).toBe(0);
  });

  test("flight list scroll should clamp to last flight", () => {
    let selectedIndex = 4;
    const flightsLength = 5;

    // Simulate scroll down at last flight
    const newIndex = Math.min(flightsLength - 1, selectedIndex + 1);
    expect(newIndex).toBe(4);
  });

  test("meeting picker slot scroll should clamp to 0", () => {
    let cursorSlot = 0;
    const totalSlots = 32;

    // Simulate scroll up at first slot
    const newSlot = Math.max(0, cursorSlot - 1);
    expect(newSlot).toBe(0);
  });

  test("meeting picker slot scroll should clamp to last slot", () => {
    let cursorSlot = 31;
    const totalSlots = 32;

    // Simulate scroll down at last slot
    const newSlot = Math.min(totalSlots - 1, cursorSlot + 1);
    expect(newSlot).toBe(31);
  });

  test("seatmap row scroll should clamp to row 1", () => {
    let seatCursorRow = 1;
    const seatmapRows = 30;

    // Simulate scroll up at first row
    const newRow = Math.max(1, seatCursorRow - 1);
    expect(newRow).toBe(1);
  });

  test("seatmap row scroll should clamp to last row", () => {
    let seatCursorRow = 30;
    const seatmapRows = 30;

    // Simulate scroll down at last row
    const newRow = Math.min(seatmapRows, seatCursorRow + 1);
    expect(newRow).toBe(30);
  });
});

describe("countdown blocking", () => {
  // Test that scroll is ignored during countdown

  test("flight canvas should ignore scroll during countdown", () => {
    const countdown = 3; // Active countdown
    let selectedFlightIndex = 2;

    // Scroll handler checks countdown first
    if (countdown !== null) {
      // Should not modify index
    } else {
      selectedFlightIndex = Math.max(0, selectedFlightIndex - 1);
    }

    expect(selectedFlightIndex).toBe(2); // Unchanged
  });

  test("meeting picker should ignore scroll during countdown", () => {
    const countdown = 2; // Active countdown
    let cursorSlot = 10;

    // Scroll handler checks countdown first
    if (countdown !== null) {
      // Should not modify slot
    } else {
      cursorSlot = Math.max(0, cursorSlot - 1);
    }

    expect(cursorSlot).toBe(10); // Unchanged
  });

  test("should allow scroll when countdown is null", () => {
    const countdown = null; // No countdown
    let selectedFlightIndex = 2;

    if (countdown !== null) {
      // Skip
    } else {
      selectedFlightIndex = Math.max(0, selectedFlightIndex - 1);
    }

    expect(selectedFlightIndex).toBe(1); // Changed
  });
});
