// useStorage Hook - React hook for calendar event CRUD operations

import { useState, useEffect, useCallback } from "react";
import type { CalendarEvent } from "../types";
import {
  loadEvents,
  saveEvents,
  createEvent,
  updateEventTimestamp,
  getDefaultStoragePath,
  type StoredCalendarEvent,
} from "../utils/event-storage";

export interface UseStorageOptions {
  filePath?: string;
}

export interface UseStorageReturn {
  events: CalendarEvent[];
  isLoading: boolean;
  error: Error | null;
  createEvent: (event: Omit<CalendarEvent, "id">) => Promise<CalendarEvent>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<CalendarEvent | null>;
  deleteEvent: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

// Ensure event has Date objects for startTime/endTime
// Defined outside hook to avoid recreation and hoisting issues
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

export function useStorage(options?: UseStorageOptions): UseStorageReturn {
  const filePath = options?.filePath || getDefaultStoragePath();

  const [events, setEvents] = useState<StoredCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load events on mount
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        const loaded = await loadEvents(filePath);
        if (mounted) {
          // Ensure dates are Date objects after loading
          setEvents(loaded.map(ensureDates));
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [filePath]);

  // Refresh events from file
  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const loaded = await loadEvents(filePath);
      setEvents(loaded.map(ensureDates));
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [filePath]);

  // Create a new event
  const handleCreateEvent = useCallback(
    async (eventData: Omit<CalendarEvent, "id">): Promise<CalendarEvent> => {
      // Ensure input dates are Date objects
      const normalizedData = {
        ...eventData,
        startTime: eventData.startTime instanceof Date
          ? eventData.startTime
          : new Date(eventData.startTime),
        endTime: eventData.endTime instanceof Date
          ? eventData.endTime
          : new Date(eventData.endTime),
      };

      const newEvent = createEvent(normalizedData);
      const updatedEvents = [...events, newEvent].map(ensureDates);

      try {
        await saveEvents(filePath, updatedEvents);
        setEvents(updatedEvents);
        return ensureDates(newEvent);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    [events, filePath]
  );

  // Update an existing event
  const handleUpdateEvent = useCallback(
    async (id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent | null> => {
      const eventIndex = events.findIndex((e) => e.id === id);
      if (eventIndex === -1) {
        return null;
      }

      // Normalize dates in updates
      const normalizedUpdates = { ...updates };
      if (normalizedUpdates.startTime) {
        normalizedUpdates.startTime = normalizedUpdates.startTime instanceof Date
          ? normalizedUpdates.startTime
          : new Date(normalizedUpdates.startTime);
      }
      if (normalizedUpdates.endTime) {
        normalizedUpdates.endTime = normalizedUpdates.endTime instanceof Date
          ? normalizedUpdates.endTime
          : new Date(normalizedUpdates.endTime);
      }

      const updatedEvent = updateEventTimestamp({
        ...events[eventIndex],
        ...normalizedUpdates,
      });

      const updatedEvents = [...events].map(ensureDates);
      updatedEvents[eventIndex] = ensureDates(updatedEvent);

      try {
        await saveEvents(filePath, updatedEvents);
        setEvents(updatedEvents);
        return ensureDates(updatedEvent);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    [events, filePath]
  );

  // Delete an event
  const handleDeleteEvent = useCallback(
    async (id: string): Promise<boolean> => {
      const eventIndex = events.findIndex((e) => e.id === id);
      if (eventIndex === -1) {
        return false;
      }

      const updatedEvents = events.filter((e) => e.id !== id).map(ensureDates);

      try {
        await saveEvents(filePath, updatedEvents);
        setEvents(updatedEvents);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    [events, filePath]
  );

  return {
    events,
    isLoading,
    error,
    createEvent: handleCreateEvent,
    updateEvent: handleUpdateEvent,
    deleteEvent: handleDeleteEvent,
    refresh,
  };
}
