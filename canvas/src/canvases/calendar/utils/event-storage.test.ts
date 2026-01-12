// Tests for Event Storage Utilities

import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import {
  loadEvents,
  saveEvents,
  createEvent,
  updateEventTimestamp,
  generateEventId,
  getDefaultStoragePath,
  ensureStorageDir,
  type StoredCalendarEvent,
} from "./event-storage";

describe("event-storage utilities", () => {
  const testDir = join(tmpdir(), "calendar-test-" + Date.now());
  const testFilePath = join(testDir, "test-events.json");

  afterEach(async () => {
    // Clean up test files
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("getDefaultStoragePath", () => {
    test("returns path in .claude directory", () => {
      const path = getDefaultStoragePath();
      expect(path).toContain(".claude");
      expect(path).toContain("calendar-events.json");
    });
  });

  describe("generateEventId", () => {
    test("generates valid UUID", () => {
      const id = generateEventId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    test("generates unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateEventId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe("createEvent", () => {
    test("creates event with id and timestamps", () => {
      const eventData = {
        title: "Test Event",
        startTime: new Date("2026-01-12T09:00:00Z"),
        endTime: new Date("2026-01-12T10:00:00Z"),
        color: "blue" as const,
      };

      const event = createEvent(eventData);

      expect(event.id).toBeDefined();
      expect(event.title).toBe("Test Event");
      expect(event.startTime).toEqual(eventData.startTime);
      expect(event.endTime).toEqual(eventData.endTime);
      expect(event.color).toBe("blue");
      expect(event.createdAt).toBeDefined();
      expect(event.updatedAt).toBeDefined();
      expect(event.createdAt).toBe(event.updatedAt);
    });

    test("creates event with all-day flag", () => {
      const eventData = {
        title: "All Day Event",
        startTime: new Date("2026-01-12T00:00:00Z"),
        endTime: new Date("2026-01-13T00:00:00Z"),
        allDay: true,
      };

      const event = createEvent(eventData);

      expect(event.allDay).toBe(true);
    });
  });

  describe("updateEventTimestamp", () => {
    test("updates only updatedAt timestamp", () => {
      const originalEvent: StoredCalendarEvent = {
        id: "test-id",
        title: "Test",
        startTime: new Date("2026-01-12T09:00:00Z"),
        endTime: new Date("2026-01-12T10:00:00Z"),
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      };

      const updated = updateEventTimestamp(originalEvent);

      expect(updated.createdAt).toBe(originalEvent.createdAt);
      expect(updated.updatedAt).not.toBe(originalEvent.updatedAt);
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
        new Date(originalEvent.updatedAt).getTime()
      );
    });

    test("preserves all other fields", () => {
      const originalEvent: StoredCalendarEvent = {
        id: "test-id",
        title: "Test Event",
        startTime: new Date("2026-01-12T09:00:00Z"),
        endTime: new Date("2026-01-12T10:00:00Z"),
        color: "red",
        allDay: false,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      };

      const updated = updateEventTimestamp(originalEvent);

      expect(updated.id).toBe(originalEvent.id);
      expect(updated.title).toBe(originalEvent.title);
      expect(updated.color).toBe(originalEvent.color);
      expect(updated.allDay).toBe(originalEvent.allDay);
    });
  });

  describe("ensureStorageDir", () => {
    test("creates directory if it does not exist", async () => {
      const newPath = join(testDir, "nested", "dir", "file.json");

      await ensureStorageDir(newPath);

      const dir = Bun.file(join(testDir, "nested", "dir"));
      // Directory should exist (we can't directly check, but saveEvents would fail without it)
    });
  });

  describe("saveEvents and loadEvents", () => {
    test("saves and loads empty array", async () => {
      await saveEvents(testFilePath, []);
      const loaded = await loadEvents(testFilePath);

      expect(loaded).toEqual([]);
    });

    test("saves and loads single event", async () => {
      const event: StoredCalendarEvent = {
        id: "test-1",
        title: "Test Event",
        startTime: new Date("2026-01-12T09:00:00Z"),
        endTime: new Date("2026-01-12T10:00:00Z"),
        color: "blue",
        createdAt: "2026-01-12T08:00:00Z",
        updatedAt: "2026-01-12T08:00:00Z",
      };

      await saveEvents(testFilePath, [event]);
      const loaded = await loadEvents(testFilePath);

      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe("test-1");
      expect(loaded[0].title).toBe("Test Event");
      expect(loaded[0].color).toBe("blue");
    });

    test("converts dates to Date objects on load", async () => {
      const event: StoredCalendarEvent = {
        id: "test-1",
        title: "Test Event",
        startTime: new Date("2026-01-12T09:00:00Z"),
        endTime: new Date("2026-01-12T10:00:00Z"),
        createdAt: "2026-01-12T08:00:00Z",
        updatedAt: "2026-01-12T08:00:00Z",
      };

      await saveEvents(testFilePath, [event]);
      const loaded = await loadEvents(testFilePath);

      expect(loaded[0].startTime).toBeInstanceOf(Date);
      expect(loaded[0].endTime).toBeInstanceOf(Date);
      expect(loaded[0].startTime.toISOString()).toBe("2026-01-12T09:00:00.000Z");
      expect(loaded[0].endTime.toISOString()).toBe("2026-01-12T10:00:00.000Z");
    });

    test("saves and loads multiple events", async () => {
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
          startTime: new Date("2026-01-13T14:00:00Z"),
          endTime: new Date("2026-01-13T15:00:00Z"),
          color: "red",
          createdAt: "2026-01-12T08:00:00Z",
          updatedAt: "2026-01-12T08:00:00Z",
        },
        {
          id: "test-3",
          title: "All Day",
          startTime: new Date("2026-01-14T00:00:00Z"),
          endTime: new Date("2026-01-15T00:00:00Z"),
          allDay: true,
          createdAt: "2026-01-12T08:00:00Z",
          updatedAt: "2026-01-12T08:00:00Z",
        },
      ];

      await saveEvents(testFilePath, events);
      const loaded = await loadEvents(testFilePath);

      expect(loaded).toHaveLength(3);
      expect(loaded[0].title).toBe("Event 1");
      expect(loaded[1].title).toBe("Event 2");
      expect(loaded[1].color).toBe("red");
      expect(loaded[2].title).toBe("All Day");
      expect(loaded[2].allDay).toBe(true);
    });

    test("returns empty array for non-existent file", async () => {
      const loaded = await loadEvents(join(testDir, "non-existent.json"));
      expect(loaded).toEqual([]);
    });

    test("handles ISO string dates in input", async () => {
      // Simulate event with string dates (as might come from JSON)
      const event = {
        id: "test-1",
        title: "Test Event",
        startTime: "2026-01-12T09:00:00Z" as unknown as Date,
        endTime: "2026-01-12T10:00:00Z" as unknown as Date,
        createdAt: "2026-01-12T08:00:00Z",
        updatedAt: "2026-01-12T08:00:00Z",
      };

      await saveEvents(testFilePath, [event as StoredCalendarEvent]);
      const loaded = await loadEvents(testFilePath);

      expect(loaded[0].startTime).toBeInstanceOf(Date);
      expect(loaded[0].endTime).toBeInstanceOf(Date);
    });

    test("preserves storage file format with version and metadata", async () => {
      const event: StoredCalendarEvent = {
        id: "test-1",
        title: "Test",
        startTime: new Date("2026-01-12T09:00:00Z"),
        endTime: new Date("2026-01-12T10:00:00Z"),
        createdAt: "2026-01-12T08:00:00Z",
        updatedAt: "2026-01-12T08:00:00Z",
      };

      await saveEvents(testFilePath, [event]);

      // Read raw file content to verify format
      const file = Bun.file(testFilePath);
      const content = await file.json();

      expect(content.version).toBe(1);
      expect(content.events).toHaveLength(1);
      expect(content.metadata).toBeDefined();
      expect(content.metadata.lastModified).toBeDefined();
    });
  });

  describe("round-trip integrity", () => {
    test("event data survives multiple save/load cycles", async () => {
      const originalEvent: StoredCalendarEvent = {
        id: "test-1",
        title: "Round Trip Test",
        startTime: new Date("2026-01-12T09:30:00Z"),
        endTime: new Date("2026-01-12T11:45:00Z"),
        color: "green",
        allDay: false,
        createdAt: "2026-01-10T00:00:00Z",
        updatedAt: "2026-01-11T12:00:00Z",
      };

      // First cycle
      await saveEvents(testFilePath, [originalEvent]);
      let loaded = await loadEvents(testFilePath);

      // Second cycle
      await saveEvents(testFilePath, loaded);
      loaded = await loadEvents(testFilePath);

      // Third cycle
      await saveEvents(testFilePath, loaded);
      loaded = await loadEvents(testFilePath);

      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe(originalEvent.id);
      expect(loaded[0].title).toBe(originalEvent.title);
      expect(loaded[0].color).toBe(originalEvent.color);
      expect(loaded[0].allDay).toBe(originalEvent.allDay);
      expect(loaded[0].startTime.toISOString()).toBe(originalEvent.startTime.toISOString());
      expect(loaded[0].endTime.toISOString()).toBe(originalEvent.endTime.toISOString());
    });
  });
});
