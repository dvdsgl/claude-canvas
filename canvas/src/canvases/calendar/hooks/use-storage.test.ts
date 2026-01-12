// Tests for useStorage Hook

import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import {
  loadEvents,
  saveEvents,
  type StoredCalendarEvent,
} from "../utils/event-storage";

// Since we can't easily test React hooks without a test renderer,
// we'll test the underlying storage operations that the hook uses.
// These tests verify the Date normalization logic that was fixed.

describe("useStorage - Date normalization logic", () => {
  const testDir = join(tmpdir(), "storage-hook-test-" + Date.now());
  const testFilePath = join(testDir, "test-events.json");

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // Helper to simulate what ensureDates does
  function ensureDates(event: StoredCalendarEvent): StoredCalendarEvent {
    return {
      ...event,
      startTime: event.startTime instanceof Date
        ? event.startTime
        : new Date(event.startTime),
      endTime: event.endTime instanceof Date
        ? event.endTime
        : new Date(event.endTime),
    };
  }

  describe("ensureDates function", () => {
    test("preserves Date objects", () => {
      const event: StoredCalendarEvent = {
        id: "test-1",
        title: "Test",
        startTime: new Date("2026-01-12T09:00:00Z"),
        endTime: new Date("2026-01-12T10:00:00Z"),
        createdAt: "2026-01-12T08:00:00Z",
        updatedAt: "2026-01-12T08:00:00Z",
      };

      const result = ensureDates(event);

      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.endTime).toBeInstanceOf(Date);
      expect(result.startTime).toBe(event.startTime); // Same reference
      expect(result.endTime).toBe(event.endTime);
    });

    test("converts ISO strings to Date objects", () => {
      const event = {
        id: "test-1",
        title: "Test",
        startTime: "2026-01-12T09:00:00.000Z" as unknown as Date,
        endTime: "2026-01-12T10:00:00.000Z" as unknown as Date,
        createdAt: "2026-01-12T08:00:00Z",
        updatedAt: "2026-01-12T08:00:00Z",
      } as StoredCalendarEvent;

      const result = ensureDates(event);

      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.endTime).toBeInstanceOf(Date);
      expect(result.startTime.toISOString()).toBe("2026-01-12T09:00:00.000Z");
      expect(result.endTime.toISOString()).toBe("2026-01-12T10:00:00.000Z");
    });

    test("handles mixed Date and string inputs", () => {
      const event = {
        id: "test-1",
        title: "Test",
        startTime: new Date("2026-01-12T09:00:00Z"),
        endTime: "2026-01-12T10:00:00.000Z" as unknown as Date,
        createdAt: "2026-01-12T08:00:00Z",
        updatedAt: "2026-01-12T08:00:00Z",
      } as StoredCalendarEvent;

      const result = ensureDates(event);

      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.endTime).toBeInstanceOf(Date);
    });
  });

  describe("CRUD operations with Date normalization", () => {
    test("create operation normalizes dates before state update", async () => {
      // Simulate creating an event with string dates (as might happen)
      const eventData = {
        title: "New Event",
        startTime: new Date("2026-01-12T09:00:00Z"),
        endTime: new Date("2026-01-12T10:00:00Z"),
        color: "blue" as const,
      };

      // Create event (simulating what handleCreateEvent does)
      const newEvent: StoredCalendarEvent = {
        id: crypto.randomUUID(),
        ...eventData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to storage
      await saveEvents(testFilePath, [newEvent]);

      // Load back (simulating what happens on next render)
      const loaded = await loadEvents(testFilePath);
      const normalized = loaded.map(ensureDates);

      expect(normalized[0].startTime).toBeInstanceOf(Date);
      expect(normalized[0].endTime).toBeInstanceOf(Date);
    });

    test("update operation preserves date types", async () => {
      // Create initial event
      const initialEvent: StoredCalendarEvent = {
        id: "test-1",
        title: "Initial",
        startTime: new Date("2026-01-12T09:00:00Z"),
        endTime: new Date("2026-01-12T10:00:00Z"),
        createdAt: "2026-01-12T08:00:00Z",
        updatedAt: "2026-01-12T08:00:00Z",
      };

      await saveEvents(testFilePath, [initialEvent]);

      // Load, update, and save (simulating handleUpdateEvent)
      let events = await loadEvents(testFilePath);
      events = events.map(ensureDates);

      // Apply update with new times
      const updates = {
        title: "Updated",
        startTime: new Date("2026-01-12T11:00:00Z"),
        endTime: new Date("2026-01-12T12:00:00Z"),
      };

      const updatedEvent = ensureDates({
        ...events[0],
        ...updates,
        updatedAt: new Date().toISOString(),
      });

      await saveEvents(testFilePath, [updatedEvent]);

      // Load again and verify
      const reloaded = await loadEvents(testFilePath);
      const normalized = reloaded.map(ensureDates);

      expect(normalized[0].title).toBe("Updated");
      expect(normalized[0].startTime).toBeInstanceOf(Date);
      expect(normalized[0].startTime.toISOString()).toBe("2026-01-12T11:00:00.000Z");
    });

    test("delete operation maintains date types for remaining events", async () => {
      // Create multiple events
      const events: StoredCalendarEvent[] = [
        {
          id: "test-1",
          title: "Event 1",
          startTime: new Date("2026-01-12T09:00:00Z"),
          endTime: new Date("2026-01-12T10:00:00Z"),
          createdAt: "2026-01-12T08:00:00Z",
          updatedAt: "2026-01-12T08:00:00Z",
        },
        {
          id: "test-2",
          title: "Event 2",
          startTime: new Date("2026-01-13T09:00:00Z"),
          endTime: new Date("2026-01-13T10:00:00Z"),
          createdAt: "2026-01-12T08:00:00Z",
          updatedAt: "2026-01-12T08:00:00Z",
        },
      ];

      await saveEvents(testFilePath, events);

      // Load, delete one, and save (simulating handleDeleteEvent)
      let loaded = await loadEvents(testFilePath);
      loaded = loaded.map(ensureDates);

      const remaining = loaded.filter(e => e.id !== "test-1").map(ensureDates);
      await saveEvents(testFilePath, remaining);

      // Load again and verify
      const reloaded = await loadEvents(testFilePath);
      const normalized = reloaded.map(ensureDates);

      expect(normalized).toHaveLength(1);
      expect(normalized[0].id).toBe("test-2");
      expect(normalized[0].startTime).toBeInstanceOf(Date);
      expect(normalized[0].endTime).toBeInstanceOf(Date);
    });
  });

  describe("edge cases", () => {
    test("handles events with only required fields", async () => {
      const minimalEvent: StoredCalendarEvent = {
        id: "test-1",
        title: "Minimal",
        startTime: new Date("2026-01-12T09:00:00Z"),
        endTime: new Date("2026-01-12T10:00:00Z"),
        createdAt: "2026-01-12T08:00:00Z",
        updatedAt: "2026-01-12T08:00:00Z",
      };

      await saveEvents(testFilePath, [minimalEvent]);
      const loaded = await loadEvents(testFilePath);
      const normalized = loaded.map(ensureDates);

      expect(normalized[0].startTime).toBeInstanceOf(Date);
      expect(normalized[0].endTime).toBeInstanceOf(Date);
      expect(normalized[0].color).toBeUndefined();
      expect(normalized[0].allDay).toBeUndefined();
    });

    test("handles events spanning multiple days", async () => {
      const multiDayEvent: StoredCalendarEvent = {
        id: "test-1",
        title: "Multi-day",
        startTime: new Date("2026-01-12T09:00:00Z"),
        endTime: new Date("2026-01-15T17:00:00Z"),
        createdAt: "2026-01-12T08:00:00Z",
        updatedAt: "2026-01-12T08:00:00Z",
      };

      await saveEvents(testFilePath, [multiDayEvent]);
      const loaded = await loadEvents(testFilePath);
      const normalized = loaded.map(ensureDates);

      expect(normalized[0].startTime).toBeInstanceOf(Date);
      expect(normalized[0].endTime).toBeInstanceOf(Date);

      // Verify multi-day span is preserved
      const duration = normalized[0].endTime.getTime() - normalized[0].startTime.getTime();
      const days = duration / (1000 * 60 * 60 * 24);
      expect(days).toBeGreaterThan(3);
    });

    test("handles dates at midnight (all-day events)", async () => {
      const allDayEvent: StoredCalendarEvent = {
        id: "test-1",
        title: "All Day",
        startTime: new Date("2026-01-12T00:00:00Z"),
        endTime: new Date("2026-01-13T00:00:00Z"),
        allDay: true,
        createdAt: "2026-01-12T08:00:00Z",
        updatedAt: "2026-01-12T08:00:00Z",
      };

      await saveEvents(testFilePath, [allDayEvent]);
      const loaded = await loadEvents(testFilePath);
      const normalized = loaded.map(ensureDates);

      expect(normalized[0].startTime.getUTCHours()).toBe(0);
      expect(normalized[0].startTime.getUTCMinutes()).toBe(0);
      expect(normalized[0].endTime.getUTCHours()).toBe(0);
      expect(normalized[0].endTime.getUTCMinutes()).toBe(0);
    });

    test("handles rapid consecutive operations", async () => {
      const events: StoredCalendarEvent[] = [];

      // Create 10 events rapidly
      for (let i = 0; i < 10; i++) {
        events.push({
          id: `test-${i}`,
          title: `Event ${i}`,
          startTime: new Date(`2026-01-${12 + i}T09:00:00Z`),
          endTime: new Date(`2026-01-${12 + i}T10:00:00Z`),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      await saveEvents(testFilePath, events);
      const loaded = await loadEvents(testFilePath);
      const normalized = loaded.map(ensureDates);

      expect(normalized).toHaveLength(10);
      normalized.forEach((event, i) => {
        expect(event.startTime).toBeInstanceOf(Date);
        expect(event.endTime).toBeInstanceOf(Date);
        expect(event.title).toBe(`Event ${i}`);
      });
    });
  });
});
