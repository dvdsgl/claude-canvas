// Event Storage Utilities - JSON file persistence for calendar events

import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import type { CalendarEvent } from "../types";

// Extended event type with timestamps
export interface StoredCalendarEvent extends CalendarEvent {
  createdAt: string;
  updatedAt: string;
}

// Internal serialized type for JSON storage (dates as ISO strings)
interface SerializedEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  color?: string;
  allDay?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Storage file format
export interface EventStorageFile {
  version: number;
  events: StoredCalendarEvent[];
  metadata: {
    lastModified: string;
  };
}

// Default storage path
export function getDefaultStoragePath(): string {
  return join(homedir(), ".claude", "calendar-events.json");
}

// Ensure the storage directory exists
export async function ensureStorageDir(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
}

// Create an empty storage file structure
function createEmptyStorage(): EventStorageFile {
  return {
    version: 1,
    events: [],
    metadata: {
      lastModified: new Date().toISOString(),
    },
  };
}

// Load events from JSON file
export async function loadEvents(filePath: string): Promise<StoredCalendarEvent[]> {
  try {
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      return [];
    }

    const content = await file.text();
    // JSON contains serialized events with string dates
    const data: { version: number; events: SerializedEvent[]; metadata: { lastModified: string } } = JSON.parse(content);

    // Validate version
    if (data.version !== 1) {
      console.warn(`Unknown storage version: ${data.version}, attempting to load anyway`);
    }

    // Parse date strings back to Date objects in events
    return data.events.map((event): StoredCalendarEvent => ({
      ...event,
      startTime: new Date(event.startTime),
      endTime: new Date(event.endTime),
    }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    console.error("Failed to load events:", error);
    return [];
  }
}

// Save events to JSON file
export async function saveEvents(
  filePath: string,
  events: StoredCalendarEvent[]
): Promise<void> {
  await ensureStorageDir(filePath);

  // Serialize dates to ISO strings for JSON storage
  const serializedEvents: SerializedEvent[] = events.map((event) => ({
    ...event,
    startTime: event.startTime instanceof Date
      ? event.startTime.toISOString()
      : String(event.startTime),
    endTime: event.endTime instanceof Date
      ? event.endTime.toISOString()
      : String(event.endTime),
  }));

  // EventStorageFile expects StoredCalendarEvent[] but we're storing serialized strings
  // The loadEvents function reverses this transformation
  const storage = {
    version: 1,
    events: serializedEvents,
    metadata: {
      lastModified: new Date().toISOString(),
    },
  };

  const content = JSON.stringify(storage, null, 2);
  await Bun.write(filePath, content);
}

// Generate a new event ID
export function generateEventId(): string {
  return crypto.randomUUID();
}

// Create a new event with timestamps
export function createEvent(
  eventData: Omit<CalendarEvent, "id">
): StoredCalendarEvent {
  const now = new Date().toISOString();
  return {
    id: generateEventId(),
    ...eventData,
    createdAt: now,
    updatedAt: now,
  };
}

// Update an event's timestamp
export function updateEventTimestamp(
  event: StoredCalendarEvent
): StoredCalendarEvent {
  return {
    ...event,
    updatedAt: new Date().toISOString(),
  };
}
