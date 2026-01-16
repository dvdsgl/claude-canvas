import { test, expect, describe } from "bun:test";
import {
  validateMeetingPickerConfig,
  validateDocumentConfig,
  validateFlightConfig,
  validateBaseCalendarConfig,
  formatValidationErrors,
  type ValidationResult,
} from "./validation";

// ============================================
// Test Helpers - Valid Config Factories
// ============================================

function createValidCalendarEvent(overrides = {}) {
  return {
    id: "event-1",
    title: "Test Event",
    startTime: "2024-01-15T10:00:00Z",
    endTime: "2024-01-15T11:00:00Z",
    ...overrides,
  };
}

function createValidCalendar(overrides = {}) {
  return {
    name: "Work Calendar",
    color: "#3b82f6",
    events: [createValidCalendarEvent()],
    ...overrides,
  };
}

function createValidMeetingPickerConfig(overrides = {}) {
  return {
    calendars: [createValidCalendar()],
    slotGranularity: 30,
    minDuration: 30,
    maxDuration: 120,
    ...overrides,
  };
}

function createValidAirport(overrides = {}) {
  return {
    code: "JFK",
    name: "John F. Kennedy International",
    city: "New York",
    timezone: "America/New_York",
    ...overrides,
  };
}

function createValidSeatmap(overrides = {}) {
  return {
    rows: 30,
    seatsPerRow: ["A", "B", "C", "D", "E", "F"],
    aisleAfter: ["C"],
    unavailable: [],
    premium: ["1A", "1B", "1C"],
    occupied: ["5A", "5B"],
    ...overrides,
  };
}

function createValidFlight(overrides = {}) {
  return {
    id: "fl-1",
    airline: "United Airlines",
    flightNumber: "UA123",
    origin: createValidAirport(),
    destination: createValidAirport({ code: "LAX", city: "Los Angeles", timezone: "America/Los_Angeles" }),
    departureTime: "2024-01-15T08:00:00Z",
    arrivalTime: "2024-01-15T11:00:00Z",
    duration: 180,
    price: 299,
    currency: "USD",
    cabinClass: "economy",
    stops: 0,
    ...overrides,
  };
}

function createValidFlightConfig(overrides = {}) {
  return {
    flights: [createValidFlight()],
    ...overrides,
  };
}

function createValidDocumentConfig(overrides = {}) {
  return {
    content: "# Hello World\n\nThis is a test document.",
    ...overrides,
  };
}

function createValidBaseCalendarConfig(overrides = {}) {
  return {
    events: [createValidCalendarEvent()],
    startHour: 8,
    endHour: 18,
    ...overrides,
  };
}

// ============================================
// validateMeetingPickerConfig Tests
// ============================================

describe("validateMeetingPickerConfig", () => {
  test("accepts valid config", () => {
    const result = validateMeetingPickerConfig(createValidMeetingPickerConfig());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("rejects null config", () => {
    const result = validateMeetingPickerConfig(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Config must be an object");
  });

  test("rejects undefined config", () => {
    const result = validateMeetingPickerConfig(undefined);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Config must be an object");
  });

  test("rejects non-object config", () => {
    const result = validateMeetingPickerConfig("not an object");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Config must be an object");
  });

  describe("calendars validation", () => {
    test("rejects missing calendars", () => {
      const result = validateMeetingPickerConfig({
        slotGranularity: 30,
        minDuration: 30,
        maxDuration: 120,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("calendars must be an array");
    });

    test("rejects empty calendars array", () => {
      const result = validateMeetingPickerConfig(createValidMeetingPickerConfig({ calendars: [] }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("calendars must not be empty");
    });

    test("rejects calendar without name", () => {
      const result = validateMeetingPickerConfig(createValidMeetingPickerConfig({
        calendars: [{ color: "#fff", events: [] }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("calendars[0].name"))).toBe(true);
    });

    test("rejects calendar with empty name", () => {
      const result = validateMeetingPickerConfig(createValidMeetingPickerConfig({
        calendars: [{ name: "  ", color: "#fff", events: [] }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("calendars[0].name") && e.includes("empty"))).toBe(true);
    });

    test("rejects calendar without color", () => {
      const result = validateMeetingPickerConfig(createValidMeetingPickerConfig({
        calendars: [{ name: "Test", events: [] }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("calendars[0].color"))).toBe(true);
    });

    test("rejects non-object calendar entry", () => {
      const result = validateMeetingPickerConfig(createValidMeetingPickerConfig({
        calendars: ["not an object"],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("calendars[0] must be an object");
    });
  });

  describe("calendar events validation", () => {
    test("validates events within calendars", () => {
      const result = validateMeetingPickerConfig(createValidMeetingPickerConfig({
        calendars: [{
          name: "Test",
          color: "#fff",
          events: [{ id: "1" }], // Missing title, startTime, endTime
        }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("events[0].title"))).toBe(true);
      expect(result.errors.some(e => e.includes("events[0].startTime"))).toBe(true);
      expect(result.errors.some(e => e.includes("events[0].endTime"))).toBe(true);
    });

    test("rejects event with invalid datetime", () => {
      const result = validateMeetingPickerConfig(createValidMeetingPickerConfig({
        calendars: [{
          name: "Test",
          color: "#fff",
          events: [createValidCalendarEvent({ startTime: "not-a-date" })],
        }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("startTime") && e.includes("ISO datetime"))).toBe(true);
    });

    test("rejects non-object event", () => {
      const result = validateMeetingPickerConfig(createValidMeetingPickerConfig({
        calendars: [{
          name: "Test",
          color: "#fff",
          events: [null],
        }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("events[0] must be an object");
    });
  });

  describe("slotGranularity validation", () => {
    test("accepts 15 minute granularity", () => {
      const result = validateMeetingPickerConfig(createValidMeetingPickerConfig({ slotGranularity: 15 }));
      expect(result.valid).toBe(true);
    });

    test("accepts 30 minute granularity", () => {
      const result = validateMeetingPickerConfig(createValidMeetingPickerConfig({ slotGranularity: 30 }));
      expect(result.valid).toBe(true);
    });

    test("accepts 60 minute granularity", () => {
      const result = validateMeetingPickerConfig(createValidMeetingPickerConfig({ slotGranularity: 60 }));
      expect(result.valid).toBe(true);
    });

    test("rejects invalid granularity", () => {
      const result = validateMeetingPickerConfig(createValidMeetingPickerConfig({ slotGranularity: 45 }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("slotGranularity"))).toBe(true);
    });
  });

  describe("duration validation", () => {
    test("rejects non-positive minDuration", () => {
      const result = validateMeetingPickerConfig(createValidMeetingPickerConfig({ minDuration: 0 }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("minDuration") && e.includes("positive"))).toBe(true);
    });

    test("rejects negative minDuration", () => {
      const result = validateMeetingPickerConfig(createValidMeetingPickerConfig({ minDuration: -10 }));
      expect(result.valid).toBe(false);
    });

    test("rejects non-positive maxDuration", () => {
      const result = validateMeetingPickerConfig(createValidMeetingPickerConfig({ maxDuration: 0 }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("maxDuration") && e.includes("positive"))).toBe(true);
    });

    test("rejects minDuration greater than maxDuration", () => {
      const result = validateMeetingPickerConfig(createValidMeetingPickerConfig({
        minDuration: 120,
        maxDuration: 30,
      }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("minDuration must not exceed maxDuration");
    });

    test("accepts minDuration equal to maxDuration", () => {
      const result = validateMeetingPickerConfig(createValidMeetingPickerConfig({
        minDuration: 60,
        maxDuration: 60,
      }));
      expect(result.valid).toBe(true);
    });
  });
});

// ============================================
// validateDocumentConfig Tests
// ============================================

describe("validateDocumentConfig", () => {
  test("accepts valid config", () => {
    const result = validateDocumentConfig(createValidDocumentConfig());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("accepts config with empty content string", () => {
    const result = validateDocumentConfig(createValidDocumentConfig({ content: "" }));
    expect(result.valid).toBe(true);
  });

  test("rejects null config", () => {
    const result = validateDocumentConfig(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Config must be an object");
  });

  test("rejects missing content", () => {
    const result = validateDocumentConfig({});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("content must be a string");
  });

  test("rejects non-string content", () => {
    const result = validateDocumentConfig({ content: 123 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("content must be a string");
  });

  describe("diffs validation", () => {
    test("accepts config without diffs", () => {
      const result = validateDocumentConfig(createValidDocumentConfig());
      expect(result.valid).toBe(true);
    });

    test("accepts config with empty diffs array", () => {
      const result = validateDocumentConfig(createValidDocumentConfig({ diffs: [] }));
      expect(result.valid).toBe(true);
    });

    test("accepts valid diffs", () => {
      const result = validateDocumentConfig(createValidDocumentConfig({
        diffs: [
          { startOffset: 0, endOffset: 10, type: "add" },
          { startOffset: 20, endOffset: 30, type: "delete" },
        ],
      }));
      expect(result.valid).toBe(true);
    });

    test("rejects non-array diffs", () => {
      const result = validateDocumentConfig(createValidDocumentConfig({ diffs: "not an array" }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("diffs must be an array");
    });

    test("rejects diff with missing startOffset", () => {
      const result = validateDocumentConfig(createValidDocumentConfig({
        diffs: [{ endOffset: 10, type: "add" }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("diffs[0].startOffset"))).toBe(true);
    });

    test("rejects diff with negative startOffset", () => {
      const result = validateDocumentConfig(createValidDocumentConfig({
        diffs: [{ startOffset: -5, endOffset: 10, type: "add" }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("diffs[0].startOffset") && e.includes("non-negative"))).toBe(true);
    });

    test("rejects diff with invalid type", () => {
      const result = validateDocumentConfig(createValidDocumentConfig({
        diffs: [{ startOffset: 0, endOffset: 10, type: "modify" }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("diffs[0].type"))).toBe(true);
    });

    test("rejects non-object diff entry", () => {
      const result = validateDocumentConfig(createValidDocumentConfig({
        diffs: [null],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("diffs[0] must be an object");
    });
  });
});

// ============================================
// validateFlightConfig Tests
// ============================================

describe("validateFlightConfig", () => {
  test("accepts valid config", () => {
    const result = validateFlightConfig(createValidFlightConfig());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("rejects null config", () => {
    const result = validateFlightConfig(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Config must be an object");
  });

  test("rejects missing flights", () => {
    const result = validateFlightConfig({});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("flights must be an array");
  });

  test("rejects empty flights array", () => {
    const result = validateFlightConfig({ flights: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("flights must not be empty");
  });

  describe("flight validation", () => {
    test("rejects flight without id", () => {
      const flight = createValidFlight();
      delete (flight as Record<string, unknown>).id;
      const result = validateFlightConfig({ flights: [flight] });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("flights[0].id"))).toBe(true);
    });

    test("rejects flight without airline", () => {
      const flight = createValidFlight();
      delete (flight as Record<string, unknown>).airline;
      const result = validateFlightConfig({ flights: [flight] });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("flights[0].airline"))).toBe(true);
    });

    test("rejects flight with invalid departure time", () => {
      const result = validateFlightConfig({
        flights: [createValidFlight({ departureTime: "invalid" })],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("departureTime") && e.includes("ISO datetime"))).toBe(true);
    });

    test("rejects flight with zero duration", () => {
      const result = validateFlightConfig({
        flights: [createValidFlight({ duration: 0 })],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("duration") && e.includes("positive"))).toBe(true);
    });

    test("rejects flight with negative price", () => {
      const result = validateFlightConfig({
        flights: [createValidFlight({ price: -100 })],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("price") && e.includes("non-negative"))).toBe(true);
    });

    test("accepts flight with zero price (free)", () => {
      const result = validateFlightConfig({
        flights: [createValidFlight({ price: 0 })],
      });
      expect(result.valid).toBe(true);
    });

    test("rejects flight with invalid cabin class", () => {
      const result = validateFlightConfig({
        flights: [createValidFlight({ cabinClass: "luxury" })],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("cabinClass"))).toBe(true);
    });

    test("accepts all valid cabin classes", () => {
      for (const cabinClass of ["economy", "premium", "business", "first"]) {
        const result = validateFlightConfig({
          flights: [createValidFlight({ cabinClass })],
        });
        expect(result.valid).toBe(true);
      }
    });

    test("rejects non-object flight entry", () => {
      const result = validateFlightConfig({ flights: [null] });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("flights[0] must be an object");
    });
  });

  describe("airport validation", () => {
    test("rejects flight with missing origin airport", () => {
      const flight = createValidFlight();
      delete (flight as Record<string, unknown>).origin;
      const result = validateFlightConfig({ flights: [flight] });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("flights[0].origin"))).toBe(true);
    });

    test("rejects airport without code", () => {
      const result = validateFlightConfig({
        flights: [createValidFlight({ origin: { name: "Test", city: "Test", timezone: "UTC" } })],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("origin.code"))).toBe(true);
    });

    test("rejects airport with empty city", () => {
      const result = validateFlightConfig({
        flights: [createValidFlight({ origin: createValidAirport({ city: "" }) })],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("origin.city") && e.includes("empty"))).toBe(true);
    });
  });

  describe("seatmap validation", () => {
    test("accepts flight without seatmap", () => {
      const result = validateFlightConfig(createValidFlightConfig());
      expect(result.valid).toBe(true);
    });

    test("accepts flight with valid seatmap", () => {
      const result = validateFlightConfig({
        flights: [createValidFlight({ seatmap: createValidSeatmap() })],
      });
      expect(result.valid).toBe(true);
    });

    test("rejects seatmap with zero rows", () => {
      const result = validateFlightConfig({
        flights: [createValidFlight({ seatmap: createValidSeatmap({ rows: 0 }) })],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("seatmap.rows") && e.includes("positive"))).toBe(true);
    });

    test("rejects seatmap with empty seatsPerRow", () => {
      const result = validateFlightConfig({
        flights: [createValidFlight({ seatmap: createValidSeatmap({ seatsPerRow: [] }) })],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("seatsPerRow") && e.includes("empty"))).toBe(true);
    });

    test("rejects seatmap with non-array aisleAfter", () => {
      const result = validateFlightConfig({
        flights: [createValidFlight({ seatmap: createValidSeatmap({ aisleAfter: "C" }) })],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("aisleAfter") && e.includes("array"))).toBe(true);
    });

    test("rejects non-object seatmap", () => {
      const result = validateFlightConfig({
        flights: [createValidFlight({ seatmap: "invalid" })],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("seatmap") && e.includes("object"))).toBe(true);
    });
  });
});

// ============================================
// validateBaseCalendarConfig Tests
// ============================================

describe("validateBaseCalendarConfig", () => {
  test("accepts valid config", () => {
    const result = validateBaseCalendarConfig(createValidBaseCalendarConfig());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("accepts empty config (all optional)", () => {
    const result = validateBaseCalendarConfig({});
    expect(result.valid).toBe(true);
  });

  test("rejects null config", () => {
    const result = validateBaseCalendarConfig(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Config must be an object");
  });

  describe("events validation", () => {
    test("accepts config without events", () => {
      const result = validateBaseCalendarConfig({ startHour: 8, endHour: 18 });
      expect(result.valid).toBe(true);
    });

    test("accepts config with empty events array", () => {
      const result = validateBaseCalendarConfig({ events: [] });
      expect(result.valid).toBe(true);
    });

    test("rejects non-array events", () => {
      const result = validateBaseCalendarConfig({ events: "not an array" });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("events must be an array");
    });

    test("validates events in array", () => {
      const result = validateBaseCalendarConfig({
        events: [{ id: "1" }], // Missing required fields
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("events[0].title"))).toBe(true);
    });
  });

  describe("hour range validation", () => {
    test("accepts valid hour range", () => {
      const result = validateBaseCalendarConfig({ startHour: 9, endHour: 17 });
      expect(result.valid).toBe(true);
    });

    test("accepts startHour of 0", () => {
      const result = validateBaseCalendarConfig({ startHour: 0, endHour: 12 });
      expect(result.valid).toBe(true);
    });

    test("accepts endHour of 24", () => {
      const result = validateBaseCalendarConfig({ startHour: 12, endHour: 24 });
      expect(result.valid).toBe(true);
    });

    test("rejects negative startHour", () => {
      const result = validateBaseCalendarConfig({ startHour: -1 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("startHour"))).toBe(true);
    });

    test("rejects startHour greater than 23", () => {
      const result = validateBaseCalendarConfig({ startHour: 24 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("startHour"))).toBe(true);
    });

    test("rejects negative endHour", () => {
      const result = validateBaseCalendarConfig({ endHour: -1 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("endHour"))).toBe(true);
    });

    test("rejects endHour greater than 24", () => {
      const result = validateBaseCalendarConfig({ endHour: 25 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("endHour"))).toBe(true);
    });

    test("rejects startHour equal to endHour", () => {
      const result = validateBaseCalendarConfig({ startHour: 12, endHour: 12 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("startHour must be less than endHour");
    });

    test("rejects startHour greater than endHour", () => {
      const result = validateBaseCalendarConfig({ startHour: 18, endHour: 9 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("startHour must be less than endHour");
    });

    test("rejects non-number startHour", () => {
      const result = validateBaseCalendarConfig({ startHour: "9" });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("startHour"))).toBe(true);
    });
  });
});

// ============================================
// formatValidationErrors Tests
// ============================================

describe("formatValidationErrors", () => {
  test("returns success message for valid result", () => {
    const result: ValidationResult = { valid: true, errors: [] };
    expect(formatValidationErrors(result)).toBe("Config is valid");
  });

  test("formats single error", () => {
    const result: ValidationResult = { valid: false, errors: ["content must be a string"] };
    const formatted = formatValidationErrors(result);
    expect(formatted).toContain("Invalid config:");
    expect(formatted).toContain("- content must be a string");
  });

  test("formats multiple errors", () => {
    const result: ValidationResult = {
      valid: false,
      errors: ["error one", "error two", "error three"],
    };
    const formatted = formatValidationErrors(result);
    expect(formatted).toContain("Invalid config:");
    expect(formatted).toContain("- error one");
    expect(formatted).toContain("- error two");
    expect(formatted).toContain("- error three");
  });

  test("uses newlines between errors", () => {
    const result: ValidationResult = {
      valid: false,
      errors: ["error one", "error two"],
    };
    const formatted = formatValidationErrors(result);
    expect(formatted.split("\n")).toHaveLength(3); // Header + 2 errors
  });
});

// ============================================
// Edge Cases and Integration Tests
// ============================================

describe("Edge Cases", () => {
  test("handles deeply nested validation errors", () => {
    const result = validateFlightConfig({
      flights: [
        createValidFlight(),
        {
          id: "fl-2",
          airline: "", // Empty
          flightNumber: "UA456",
          origin: { code: "" }, // Incomplete
          destination: createValidAirport(),
          departureTime: "2024-01-15T12:00:00Z",
          arrivalTime: "invalid-date", // Invalid
          duration: -10, // Negative
          price: 199,
          currency: "USD",
          cabinClass: "economy",
          stops: 0,
        },
      ],
    });
    expect(result.valid).toBe(false);
    // Should have multiple errors for the second flight
    expect(result.errors.filter(e => e.includes("flights[1]")).length).toBeGreaterThan(3);
  });

  test("validates multiple flights independently", () => {
    const result = validateFlightConfig({
      flights: [
        createValidFlight({ id: "fl-1" }),
        createValidFlight({ id: "fl-2" }),
        createValidFlight({ id: "fl-3" }),
      ],
    });
    expect(result.valid).toBe(true);
  });

  test("accumulates errors from multiple sources", () => {
    const result = validateMeetingPickerConfig({
      calendars: [
        { name: "", color: "#fff", events: [] }, // Empty name
        { name: "Test", color: "", events: [] }, // Empty color
      ],
      slotGranularity: 45, // Invalid
      minDuration: 0, // Invalid
      maxDuration: -10, // Invalid
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
  });
});
