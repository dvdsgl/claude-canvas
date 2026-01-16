// Advanced Calendar - Unified calendar with all features
// Merges display, meeting picker, and edit functionalities

import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useApp, useStdout } from "ink";
import { useSafeInput } from "../utils/use-safe-input";
import { useMouse, type MouseEvent } from "./calendar/hooks/use-mouse";
import { useStorage } from "./calendar/hooks/use-storage";
import { useIPC } from "./calendar/hooks/use-ipc";
import { EventModal } from "./calendar/components/event-modal";
import { ConfirmDialog } from "./calendar/components/confirm-dialog";
import type { CalendarEvent } from "./calendar/types";
import type { MeetingPickerConfig, NamedCalendar } from "../scenarios/types";
import {
  getWeekDays,
  formatDayName,
  formatDayNumber,
  formatMonthYear,
  formatHour,
  getAmPm,
  isSameDay,
  isAllDayEvent,
  TEXT_COLORS,
  INK_COLORS,
} from "./calendar/types";

// View modes
type ViewMode = "day" | "week" | "month";
type ModalMode = "closed" | "create" | "edit" | "delete";

// Configuration
export interface AdvancedCalendarConfig {
  title?: string;
  events?: Array<{
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    color?: string;
    allDay?: boolean;
  }>;
  // Multi-calendar support (meeting picker mode)
  calendars?: NamedCalendar[];
  // Storage for persistence
  storageFile?: string;
  // Time boundaries
  startHour?: number;
  endHour?: number;
  // Working hours (for visual distinction)
  workingHoursStart?: number;
  workingHoursEnd?: number;
  // Initial view
  defaultView?: ViewMode;
  // Enable editing
  editable?: boolean;
  // Meeting picker mode
  meetingPickerMode?: boolean;
  slotGranularity?: 15 | 30 | 60;
}

interface Props {
  id: string;
  config?: AdvancedCalendarConfig;
  socketPath?: string;
}

const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 22;

// Get days for month view
function getMonthDays(baseDate: Date): Date[] {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Start from the previous Sunday/Monday
  const startDate = new Date(firstDay);
  const dayOfWeek = startDate.getDay();
  startDate.setDate(startDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  const days: Date[] = [];
  const currentDate = new Date(startDate);

  // Get 6 weeks of days (42 days)
  for (let i = 0; i < 42; i++) {
    days.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return days;
}

// Get single day for day view
function getDayDays(baseDate: Date): Date[] {
  return [new Date(baseDate)];
}

// Get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// Format event duration
function formatDuration(start: Date, end: Date): string {
  const mins = Math.round((end.getTime() - start.getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h${remainMins}m` : `${hrs}h`;
}

// Format cursor time for status line
function formatCursorDateTime(date: Date, time: string): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} @ ${time}`;
}

export function AdvancedCalendar({ id, config, socketPath }: Props) {
  const { exit } = useApp();
  const { stdout } = useStdout();

  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(config?.defaultView || "week");
  const [dimensions, setDimensions] = useState({
    width: stdout?.columns || 120,
    height: stdout?.rows || 40,
  });
  const [showHelp, setShowHelp] = useState(false);

  // Cursor/selection state
  const [cursorDay, setCursorDay] = useState(0);
  const [cursorSlot, setCursorSlot] = useState(6); // Default to 9am (slot 6 from 6am)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>("closed");
  const [cycledEventIndex, setCycledEventIndex] = useState(0); // For cycling through overlapping events

  // Mouse hover state
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [usingMouse, setUsingMouse] = useState(false);

  // Configuration
  const startHour = config?.startHour ?? DEFAULT_START_HOUR;
  const endHour = config?.endHour ?? DEFAULT_END_HOUR;
  const workingHoursStart = config?.workingHoursStart ?? 9; // Default 9am
  const workingHoursEnd = config?.workingHoursEnd ?? 17; // Default 5pm
  const editable = config?.editable !== false;
  const meetingPickerMode = config?.meetingPickerMode || false;
  const slotGranularity = config?.slotGranularity || 30;

  // Storage for persistence
  const storage = useStorage({ filePath: config?.storageFile });

  // IPC for communication
  const ipc = useIPC({
    socketPath,
    scenario: meetingPickerMode ? "meeting-picker" : "advanced",
    onClose: () => exit(),
  });

  // Combine events from config and storage
  const configEvents: CalendarEvent[] = config?.events?.map((e) => ({
    ...e,
    startTime: new Date(e.startTime),
    endTime: new Date(e.endTime),
  })) || [];

  const events = config?.storageFile ? storage.events : configEvents;

  // Multi-calendar events (meeting picker mode)
  const calendars = config?.calendars || [];
  const allCalendarEvents: CalendarEvent[] = calendars.flatMap((cal) =>
    cal.events.map((e) => ({
      ...e,
      startTime: new Date(e.startTime),
      endTime: new Date(e.endTime),
      color: cal.color,
    }))
  );

  const displayEvents = meetingPickerMode ? allCalendarEvents : events;

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll to current time on startup (week/day view only)
  useEffect(() => {
    if (viewMode !== "month") {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Only scroll if current time is within visible range
      if (currentHour >= startHour && currentHour < endHour) {
        const currentSlotIndex = Math.floor(
          ((currentHour - startHour) * 60 + currentMinute) / slotGranularity
        );
        setCursorSlot(currentSlotIndex);
      }

      // Also scroll to today's column if today is in view
      const todayIndex = viewDays.findIndex((d) => isSameDay(d, now));
      if (todayIndex >= 0 && todayIndex < numColumns) {
        setCursorDay(todayIndex);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Listen for terminal resize
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: stdout?.columns || 120,
        height: stdout?.rows || 40,
      });
    };
    stdout?.on("resize", updateDimensions);
    updateDimensions();
    return () => {
      stdout?.off("resize", updateDimensions);
    };
  }, [stdout]);

  // Calculate dimensions
  const termWidth = dimensions.width;
  const termHeight = dimensions.height;
  const timeColumnWidth = 6;

  // Get days based on view mode
  const viewDays = viewMode === "month"
    ? getMonthDays(currentDate)
    : viewMode === "day"
      ? getDayDays(currentDate)
      : getWeekDays(currentDate);

  const numColumns = viewMode === "month" ? 7 : viewMode === "day" ? 1 : 7;
  const availableWidth = termWidth - timeColumnWidth - 4;
  const columnWidth = Math.max(12, Math.floor(availableWidth / numColumns));

  // Calculate slot heights for week/day view
  const headerHeight = viewMode === "month" ? 3 : 5;
  const footerHeight = 2;
  const availableHeight = Math.max(1, termHeight - headerHeight - footerHeight);
  const totalSlots = (endHour - startHour) * (60 / slotGranularity);
  const baseSlotHeight = viewMode === "month" ? 1 : Math.max(1, Math.floor(availableHeight / totalSlots));
  const extraRows = viewMode === "month" ? 0 : availableHeight - baseSlotHeight * totalSlots;
  const slotHeights = Array.from({ length: totalSlots }, (_, i) =>
    baseSlotHeight + (i < extraRows ? 1 : 0)
  );

  const today = new Date();

  // Get cursor date and time
  const getCursorDate = () => viewDays[cursorDay] || viewDays[0];
  const getCursorTime = () => {
    const slotMinutes = cursorSlot * slotGranularity;
    const hours = startHour + Math.floor(slotMinutes / 60);
    const minutes = slotMinutes % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  };

  // Get event at cursor position
  const getEventAtCursor = (): CalendarEvent | null => {
    const cursorDate = getCursorDate();
    const slotMinutes = cursorSlot * slotGranularity;
    const slotHour = startHour + Math.floor(slotMinutes / 60);
    const slotMinute = slotMinutes % 60;
    const slotTime = slotHour + slotMinute / 60;

    return (
      displayEvents.find((e) => {
        if (!isSameDay(e.startTime, cursorDate)) return false;
        if (isAllDayEvent(e)) return false;
        const eventStart = e.startTime.getHours() + e.startTime.getMinutes() / 60;
        const eventEnd = e.endTime.getHours() + e.endTime.getMinutes() / 60;
        return slotTime >= eventStart && slotTime < eventEnd;
      }) || null
    );
  };

  // Mouse handling
  const handleMouseClick = useCallback((event: MouseEvent) => {
    setUsingMouse(true);

    // Calculate which day/slot was clicked
    const gridLeft = timeColumnWidth + 2;
    const gridTop = headerHeight + 1;

    const relX = event.x - gridLeft;
    const relY = event.y - gridTop;

    if (relX < 0 || relY < 0) return;

    const dayIndex = Math.floor(relX / columnWidth);
    if (dayIndex >= numColumns) return;

    // Calculate slot from Y position
    let cumulativeHeight = 0;
    let slotIndex = 0;
    for (let i = 0; i < slotHeights.length; i++) {
      if (relY < cumulativeHeight + slotHeights[i]) {
        slotIndex = i;
        break;
      }
      cumulativeHeight += slotHeights[i];
      slotIndex = i;
    }

    setCursorDay(dayIndex);
    setCursorSlot(slotIndex);

    // Check if clicked on an event
    const clickedEvent = getEventAtPosition(dayIndex, slotIndex);
    if (clickedEvent && editable && !meetingPickerMode) {
      setSelectedEventId(clickedEvent.id);
      setModalMode("edit");
    } else if (meetingPickerMode) {
      // In meeting picker mode, clicking selects the slot
      handleSelectSlot();
    }
  }, [columnWidth, numColumns, slotHeights, editable, meetingPickerMode]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    const gridLeft = timeColumnWidth + 2;
    const gridTop = headerHeight + 1;

    const relX = event.x - gridLeft;
    const relY = event.y - gridTop;

    if (relX < 0 || relY < 0) {
      setHoveredDay(null);
      setHoveredSlot(null);
      return;
    }

    const dayIndex = Math.floor(relX / columnWidth);
    if (dayIndex >= numColumns) {
      setHoveredDay(null);
      setHoveredSlot(null);
      return;
    }

    let cumulativeHeight = 0;
    let slotIndex = 0;
    for (let i = 0; i < slotHeights.length; i++) {
      if (relY < cumulativeHeight + slotHeights[i]) {
        slotIndex = i;
        break;
      }
      cumulativeHeight += slotHeights[i];
      slotIndex = i;
    }

    setHoveredDay(dayIndex);
    setHoveredSlot(slotIndex);
  }, [columnWidth, numColumns, slotHeights]);

  // Enable mouse tracking
  useMouse({
    enabled: modalMode === "closed",
    onClick: handleMouseClick,
    onMove: handleMouseMove,
  });

  // Get event at specific position
  const getEventAtPosition = (dayIndex: number, slotIndex: number): CalendarEvent | null => {
    const day = viewDays[dayIndex];
    if (!day) return null;

    const slotMinutes = slotIndex * slotGranularity;
    const slotHour = startHour + Math.floor(slotMinutes / 60);
    const slotMinute = slotMinutes % 60;
    const slotTime = slotHour + slotMinute / 60;

    return (
      displayEvents.find((e) => {
        if (!isSameDay(e.startTime, day)) return false;
        if (isAllDayEvent(e)) return false;
        const eventStart = e.startTime.getHours() + e.startTime.getMinutes() / 60;
        const eventEnd = e.endTime.getHours() + e.endTime.getMinutes() / 60;
        return slotTime >= eventStart && slotTime < eventEnd;
      }) || null
    );
  };

  // Count events at a specific slot (for conflict detection)
  const countEventsAtSlot = (dayIndex: number, slotIndex: number): number => {
    const day = viewDays[dayIndex];
    if (!day) return 0;

    const slotMinutes = slotIndex * slotGranularity;
    const slotHour = startHour + Math.floor(slotMinutes / 60);
    const slotMinute = slotMinutes % 60;
    const slotTime = slotHour + slotMinute / 60;

    return displayEvents.filter((e) => {
      if (!isSameDay(e.startTime, day)) return false;
      if (isAllDayEvent(e)) return false;
      const eventStart = e.startTime.getHours() + e.startTime.getMinutes() / 60;
      const eventEnd = e.endTime.getHours() + e.endTime.getMinutes() / 60;
      return slotTime >= eventStart && slotTime < eventEnd;
    }).length;
  };

  // Get all events at cursor position (for cycling through conflicts)
  const getAllEventsAtCursor = (): CalendarEvent[] => {
    const cursorDate = getCursorDate();
    const slotMinutes = cursorSlot * slotGranularity;
    const slotHour = startHour + Math.floor(slotMinutes / 60);
    const slotMinute = slotMinutes % 60;
    const slotTime = slotHour + slotMinute / 60;

    return displayEvents.filter((e) => {
      if (!isSameDay(e.startTime, cursorDate)) return false;
      if (isAllDayEvent(e)) return false;
      const eventStart = e.startTime.getHours() + e.startTime.getMinutes() / 60;
      const eventEnd = e.endTime.getHours() + e.endTime.getMinutes() / 60;
      return slotTime >= eventStart && slotTime < eventEnd;
    });
  };

  // Get currently cycled event at cursor
  const getCycledEventAtCursor = (): CalendarEvent | null => {
    const events = getAllEventsAtCursor();
    if (events.length === 0) return null;
    const safeIndex = cycledEventIndex % events.length;
    return events[safeIndex];
  };

  // Handle slot selection in meeting picker mode
  const handleSelectSlot = () => {
    if (!meetingPickerMode) return;

    const day = getCursorDate();
    const slotMinutes = cursorSlot * slotGranularity;
    const hours = startHour + Math.floor(slotMinutes / 60);
    const minutes = slotMinutes % 60;

    const startTime = new Date(day);
    startTime.setHours(hours, minutes, 0, 0);

    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + slotGranularity);

    ipc.sendSelected({
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: slotGranularity,
    });

    exit();
  };

  // Handle keyboard input
  useSafeInput(
    (input, key) => {
      if (modalMode !== "closed") return;

      setUsingMouse(false);

      // Help toggle
      if (input === "h" || input === "?") {
        setShowHelp((h) => !h);
        return;
      }

      // Close help with any key if open
      if (showHelp) {
        setShowHelp(false);
        return;
      }

      if (input === "q" || key.escape) {
        if (meetingPickerMode) {
          ipc.sendCancelled("User cancelled");
        }
        exit();
        return;
      }

      // View mode switching
      if (input === "1") {
        setViewMode("day");
        setCursorDay(0);
      } else if (input === "2") {
        setViewMode("week");
      } else if (input === "3") {
        setViewMode("month");
        setCursorSlot(0);
      }

      // Navigation
      const maxDays = viewMode === "month" ? 41 : viewMode === "day" ? 0 : 6;
      const maxSlots = totalSlots - 1;
      const slotsPerHour = 60 / slotGranularity;

      if (key.upArrow) {
        setCycledEventIndex(0); // Reset cycle on cursor move
        if (viewMode === "month") {
          setCursorDay((d) => Math.max(0, d - 7));
        } else if (key.shift) {
          // Shift+Up: Jump by 1 hour
          setCursorSlot((s) => Math.max(0, s - slotsPerHour));
        } else {
          setCursorSlot((s) => Math.max(0, s - 1));
        }
      } else if (key.downArrow) {
        setCycledEventIndex(0); // Reset cycle on cursor move
        if (viewMode === "month") {
          setCursorDay((d) => Math.min(maxDays, d + 7));
        } else if (key.shift) {
          // Shift+Down: Jump by 1 hour
          setCursorSlot((s) => Math.min(maxSlots, s + slotsPerHour));
        } else {
          setCursorSlot((s) => Math.min(maxSlots, s + 1));
        }
      } else if (key.leftArrow) {
        setCycledEventIndex(0); // Reset cycle on cursor move
        setCursorDay((d) => Math.max(0, d - 1));
      } else if (key.rightArrow) {
        setCycledEventIndex(0); // Reset cycle on cursor move
        setCursorDay((d) => Math.min(maxDays, d + 1));
      }

      // Tab key to cycle through overlapping events
      if (key.tab) {
        const eventsAtCursor = getAllEventsAtCursor();
        if (eventsAtCursor.length > 1) {
          if (key.shift) {
            // Shift+Tab: cycle backward
            setCycledEventIndex((i) => (i - 1 + eventsAtCursor.length) % eventsAtCursor.length);
          } else {
            // Tab: cycle forward
            setCycledEventIndex((i) => (i + 1) % eventsAtCursor.length);
          }
        }
      }

      // PageUp/PageDown for week navigation
      if (key.pageUp) {
        setCurrentDate((d) => {
          const prev = new Date(d);
          prev.setDate(d.getDate() - 7);
          return prev;
        });
      } else if (key.pageDown) {
        setCurrentDate((d) => {
          const next = new Date(d);
          next.setDate(d.getDate() + 7);
          return next;
        });
      }

      // j/k to jump to next/previous event
      if (input === "j" && viewMode !== "month") {
        // Jump to next event
        const cursorDate = getCursorDate();
        const currentSlotTime = startHour + (cursorSlot * slotGranularity) / 60;

        // Find events after current cursor position
        const dayEvents = displayEvents
          .filter((e) => isSameDay(e.startTime, cursorDate) && !isAllDayEvent(e))
          .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

        const nextEvent = dayEvents.find((e) => {
          const eventStart = e.startTime.getHours() + e.startTime.getMinutes() / 60;
          return eventStart > currentSlotTime;
        });

        if (nextEvent) {
          const eventStartSlot = Math.floor(
            ((nextEvent.startTime.getHours() - startHour) * 60 + nextEvent.startTime.getMinutes()) / slotGranularity
          );
          setCursorSlot(Math.max(0, Math.min(maxSlots, eventStartSlot)));
          setCycledEventIndex(0);
        }
      } else if (input === "k" && viewMode !== "month") {
        // Jump to previous event
        const cursorDate = getCursorDate();
        const currentSlotTime = startHour + (cursorSlot * slotGranularity) / 60;

        // Find events before current cursor position
        const dayEvents = displayEvents
          .filter((e) => isSameDay(e.startTime, cursorDate) && !isAllDayEvent(e))
          .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

        const prevEvent = dayEvents.find((e) => {
          const eventStart = e.startTime.getHours() + e.startTime.getMinutes() / 60;
          return eventStart < currentSlotTime;
        });

        if (prevEvent) {
          const eventStartSlot = Math.floor(
            ((prevEvent.startTime.getHours() - startHour) * 60 + prevEvent.startTime.getMinutes()) / slotGranularity
          );
          setCursorSlot(Math.max(0, Math.min(maxSlots, eventStartSlot)));
          setCycledEventIndex(0);
        }
      }

      // Home/End keys for start/end of day (or week in month view)
      if (input === "H" || key.home) {
        // Home: Go to start
        if (viewMode === "month") {
          setCursorDay((d) => Math.floor(d / 7) * 7); // Start of week row
        } else {
          setCursorSlot(0); // Start of day
        }
      } else if (input === "E" || key.end) {
        // End: Go to end
        if (viewMode === "month") {
          setCursorDay((d) => Math.floor(d / 7) * 7 + 6); // End of week row
        } else {
          setCursorSlot(maxSlots); // End of day
        }
      }

      // Period navigation
      if (input === "n") {
        setCurrentDate((d) => {
          const next = new Date(d);
          if (viewMode === "month") {
            next.setMonth(d.getMonth() + 1);
          } else if (viewMode === "week") {
            next.setDate(d.getDate() + 7);
          } else {
            next.setDate(d.getDate() + 1);
          }
          return next;
        });
      } else if (input === "p") {
        setCurrentDate((d) => {
          const prev = new Date(d);
          if (viewMode === "month") {
            prev.setMonth(d.getMonth() - 1);
          } else if (viewMode === "week") {
            prev.setDate(d.getDate() - 7);
          } else {
            prev.setDate(d.getDate() - 1);
          }
          return prev;
        });
      } else if (input === "t") {
        setCurrentDate(new Date());
      } else if (input === "y") {
        // Year forward
        setCurrentDate((d) => {
          const next = new Date(d);
          next.setFullYear(d.getFullYear() + 1);
          return next;
        });
      } else if (input === "Y") {
        // Year backward
        setCurrentDate((d) => {
          const prev = new Date(d);
          prev.setFullYear(d.getFullYear() - 1);
          return prev;
        });
      }

      // CRUD operations (only when editable and not in meeting picker mode)
      if (editable && !meetingPickerMode) {
        if (input === "c") {
          setModalMode("create");
        } else if (input === "e" || key.return) {
          // Use cycled event when multiple events overlap
          const eventAtCursor = getCycledEventAtCursor() || getEventAtCursor();
          if (eventAtCursor) {
            setSelectedEventId(eventAtCursor.id);
            setModalMode("edit");
          } else if (input === " " || key.return) {
            // Create new event at cursor if no event exists
            setModalMode("create");
          }
        } else if (input === "d" || key.delete) {
          // Use cycled event when multiple events overlap
          const eventAtCursor = getCycledEventAtCursor() || getEventAtCursor();
          if (eventAtCursor) {
            setSelectedEventId(eventAtCursor.id);
            setModalMode("delete");
          }
        }
      }

      // Meeting picker selection
      if (meetingPickerMode && (input === " " || key.return)) {
        handleSelectSlot();
      }
    },
    { isActive: modalMode === "closed" }
  );

  // Modal handlers
  const handleSave = async (eventData: CalendarEvent | Omit<CalendarEvent, "id">) => {
    try {
      if (modalMode === "create") {
        await storage.createEvent(eventData as Omit<CalendarEvent, "id">);
      } else if (modalMode === "edit" && "id" in eventData) {
        await storage.updateEvent(eventData.id, eventData);
      }
      setModalMode("closed");
      setSelectedEventId(null);
    } catch (err) {
      // Error handled by storage
    }
  };

  const handleDelete = async () => {
    if (selectedEventId) {
      try {
        await storage.deleteEvent(selectedEventId);
        setModalMode("closed");
        setSelectedEventId(null);
      } catch (err) {
        // Error handled by storage
      }
    }
  };

  const handleCancel = () => {
    setModalMode("closed");
    setSelectedEventId(null);
  };

  const selectedEvent = selectedEventId
    ? displayEvents.find((e) => e.id === selectedEventId) || null
    : null;

  // Render time column
  const renderTimeColumn = () => {
    if (viewMode === "month") return null;

    // Calculate busy hours (hours with at least one event across visible days)
    const busySlots = new Set<number>();
    viewDays.slice(0, numColumns).forEach((day) => {
      displayEvents.forEach((e) => {
        if (!isSameDay(e.startTime, day) || isAllDayEvent(e)) return;
        const eventStartSlot = Math.floor(
          ((e.startTime.getHours() - startHour) * 60 + e.startTime.getMinutes()) / slotGranularity
        );
        const eventEndSlot = Math.ceil(
          ((e.endTime.getHours() - startHour) * 60 + e.endTime.getMinutes()) / slotGranularity
        );
        for (let s = Math.max(0, eventStartSlot); s < Math.min(totalSlots, eventEndSlot); s++) {
          busySlots.add(s);
        }
      });
    });

    const slots: React.JSX.Element[] = [];
    for (let i = 0; i < totalSlots; i++) {
      const slotMinutes = i * slotGranularity;
      const hour = startHour + Math.floor(slotMinutes / 60);
      const minute = slotMinutes % 60;
      const showLabel = minute === 0;
      const height = slotHeights[i];
      const isCursorRow = !usingMouse && cursorSlot === i;
      const isWorkingHour = hour >= workingHoursStart && hour < workingHoursEnd;
      const isBusySlot = busySlots.has(i);

      // Show time label at hour boundaries, or show cursor time when cursor is on non-hour slot
      // Add busy indicator (●) for slots with events
      const busyIndicator = isBusySlot && showLabel ? "●" : "";
      const timeLabel = showLabel
        ? `${busyIndicator}${formatHour(hour)}${getAmPm(hour)}`.padStart(timeColumnWidth - 1)
        : isCursorRow
          ? `${hour}:${minute.toString().padStart(2, "0")}`.padStart(timeColumnWidth - 1)
          : "";

      // Color: cyan for cursor, yellow for busy hours, gray for non-working, white for working
      const textColor = isCursorRow
        ? "cyan"
        : isBusySlot && showLabel
          ? "yellow"
          : isWorkingHour
            ? "white"
            : "gray";

      slots.push(
        <Box key={`time-${i}`} height={height} width={timeColumnWidth}>
          <Text color={textColor} bold={isCursorRow} dimColor={!isWorkingHour && !isCursorRow && !isBusySlot}>
            {timeLabel}
          </Text>
        </Box>
      );
    }
    return <Box key="time-column" flexDirection="column">{slots}</Box>;
  };

  // Render day column (week/day view)
  const renderDayColumn = (dayIndex: number) => {
    const day = viewDays[dayIndex];
    const isToday = isSameDay(day, currentTime);
    const dayEvents = displayEvents.filter(
      (e) => isSameDay(e.startTime, day) && !isAllDayEvent(e)
    );

    const slots: React.JSX.Element[] = [];
    for (let i = 0; i < totalSlots; i++) {
      const height = slotHeights[i];
      const slotMinutes = i * slotGranularity;
      const slotHour = startHour + Math.floor(slotMinutes / 60);
      const slotMinute = slotMinutes % 60;
      const slotTime = slotHour + slotMinute / 60;
      const nextSlotTime = slotTime + slotGranularity / 60;

      // Check if current time falls in this slot (for "now" indicator)
      const nowTime = currentTime.getHours() + currentTime.getMinutes() / 60;
      const isNowSlot = isToday && nowTime >= slotTime && nowTime < nextSlotTime;

      const isCursor = !usingMouse && cursorDay === dayIndex && cursorSlot === i;
      const isHovered = usingMouse && hoveredDay === dayIndex && hoveredSlot === i;

      // Find event in this slot
      const slotEvent = dayEvents.find((e) => {
        const eventStart = e.startTime.getHours() + e.startTime.getMinutes() / 60;
        const eventEnd = e.endTime.getHours() + e.endTime.getMinutes() / 60;
        return slotTime >= eventStart && slotTime < eventEnd;
      });

      const isEventStart =
        slotEvent &&
        slotEvent.startTime.getHours() === slotHour &&
        Math.floor(slotEvent.startTime.getMinutes() / slotGranularity) * slotGranularity === slotMinute;

      // Check for overlapping events (conflict)
      const conflictCount = countEventsAtSlot(dayIndex, i);
      const hasConflict = conflictCount > 1;

      let content: React.JSX.Element;
      if (slotEvent) {
        const textColor = (isCursor || isHovered) ? "black" : (TEXT_COLORS[slotEvent.color || "blue"] || "white");
        const bgColor = (isCursor || isHovered) ? "white" : slotEvent.color;
        // Show title with duration on the first slot of the event
        const duration = formatDuration(slotEvent.startTime, slotEvent.endTime);
        const maxLen = columnWidth - 2;
        let title = "";
        if (isEventStart) {
          // Try to fit title + duration, otherwise just title
          // Add conflict indicator if multiple events overlap
          const conflictPrefix = hasConflict ? `[${conflictCount}] ` : " ";
          const fullTitle = `${conflictPrefix}${slotEvent.title} (${duration})`;
          if (fullTitle.length <= maxLen) {
            title = fullTitle;
          } else {
            title = `${conflictPrefix}${slotEvent.title}`.slice(0, maxLen);
          }
        }
        content = (
          <Text backgroundColor={hasConflict && !isCursor && !isHovered ? "red" : bgColor} color={textColor} bold>
            {title.padEnd(columnWidth - 1)}
          </Text>
        );
      } else if (isCursor || isHovered) {
        // Highlight cursor/hovered slot - show green for available in meeting-picker mode
        const bgColor = meetingPickerMode ? "green" : "gray";
        const label = meetingPickerMode ? " Available " : "";
        content = (
          <Text backgroundColor={bgColor} color="white">
            {label.padEnd(columnWidth - 1)}
          </Text>
        );
      } else if (meetingPickerMode) {
        // In meeting picker mode, show available slots with subtle green color
        content = (
          <Text color="green">
            {slotMinute === 0 ? "═".repeat(columnWidth - 1) : "─".repeat(columnWidth - 1)}
          </Text>
        );
      } else if (isNowSlot) {
        // Current time indicator - red line for "now"
        content = (
          <Text color="red" bold>
            {"▶" + "━".repeat(columnWidth - 2)}
          </Text>
        );
      } else {
        content = (
          <Text color="gray" dimColor>
            {slotMinute === 0 ? "─".repeat(columnWidth - 1) : "┄".repeat(columnWidth - 1)}
          </Text>
        );
      }

      slots.push(
        <Box key={`day${dayIndex}-slot${i}`} height={height}>
          {content}
        </Box>
      );
    }

    return (
      <Box key={`day-col-${dayIndex}`} flexDirection="column" width={columnWidth}>
        {slots}
      </Box>
    );
  };

  // Render month view cell
  const renderMonthCell = (dayIndex: number) => {
    const day = viewDays[dayIndex];
    const isCurrentMonth = day.getMonth() === currentDate.getMonth();
    const isToday = isSameDay(day, today);
    const isCursor = cursorDay === dayIndex;
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const dayEvents = displayEvents.filter((e) => isSameDay(e.startTime, day));

    const cellWidth = columnWidth;
    // Show event count badge and first event title
    const maxTitleLen = Math.max(1, cellWidth - 4);
    const firstEvent = dayEvents[0];

    // Calculate total hours scheduled for the day
    const totalMinutes = dayEvents.reduce((acc, e) => {
      if (isAllDayEvent(e)) return acc;
      return acc + (e.endTime.getTime() - e.startTime.getTime()) / 60000;
    }, 0);
    const hoursScheduled = Math.round(totalMinutes / 60 * 10) / 10;

    // Build event display: show count badge + first event title
    let eventDisplay = "";
    if (dayEvents.length > 0) {
      if (dayEvents.length === 1) {
        eventDisplay = firstEvent.title.slice(0, maxTitleLen);
      } else {
        // Show count badge + truncated title
        const badge = `[${dayEvents.length}]`;
        eventDisplay = `${badge} ${firstEvent.title}`.slice(0, maxTitleLen);
      }
    }

    return (
      <Box
        key={`month-cell-${dayIndex}`}
        width={cellWidth}
        height={3}
        flexDirection="column"
        borderStyle={isCursor ? "round" : undefined}
        borderColor={isCursor ? "cyan" : undefined}
      >
        <Box justifyContent="center">
          <Text
            color={isToday ? "blue" : isWeekend ? "magenta" : isCurrentMonth ? "white" : "gray"}
            backgroundColor={isToday ? "blue" : undefined}
            bold={isToday}
            dimColor={!isCurrentMonth && !isToday}
          >
            {formatDayNumber(day).padStart(2)}
          </Text>
          {dayEvents.length > 0 && hoursScheduled > 0 && (
            <Text color="gray" dimColor>
              {` ${hoursScheduled}h`}
            </Text>
          )}
        </Box>
        <Box justifyContent="center">
          <Text color={firstEvent?.color || "gray"} dimColor={!isCurrentMonth}>
            {eventDisplay}
          </Text>
        </Box>
      </Box>
    );
  };

  // Render legend for multi-calendar mode
  const renderLegend = () => {
    if (!meetingPickerMode || calendars.length === 0) return null;

    return (
      <Box marginBottom={1}>
        {calendars.map((cal, i) => (
          <Box key={`legend-${cal.name}-${i}`} marginRight={2}>
            <Text backgroundColor={cal.color} color={TEXT_COLORS[cal.color] || "white"}>
              {` ${cal.name} `}
            </Text>
          </Box>
        ))}
      </Box>
    );
  };

  // Loading state
  if (storage.isLoading && config?.storageFile) {
    return (
      <Box flexDirection="column" padding={2}>
        <Text>Loading events...</Text>
      </Box>
    );
  }

  // Error state
  if (storage.error && config?.storageFile) {
    return (
      <Box flexDirection="column" padding={2}>
        <Text color="red">Error: {storage.error.message}</Text>
        <Text color="gray">Press q to quit</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight}>
      {/* Modal overlays */}
      {modalMode === "create" && (
        <EventModal
          mode="create"
          defaultDate={getCursorDate()}
          defaultStartTime={getCursorTime()}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}

      {modalMode === "edit" && selectedEvent && (
        <EventModal
          mode="edit"
          event={selectedEvent}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}

      {modalMode === "delete" && selectedEvent && (
        <ConfirmDialog
          title="Delete Event?"
          message="Are you sure you want to delete"
          itemName={selectedEvent.title}
          onConfirm={handleDelete}
          onCancel={handleCancel}
        />
      )}

      {/* Calendar view */}
      {modalMode === "closed" && (
        <Box flexDirection="column" paddingX={1} height={termHeight}>
          {/* Title bar with view mode */}
          <Box marginBottom={1}>
            <Text bold color="cyan">
              {formatMonthYear(viewMode === "month" ? currentDate : viewDays[0])}
            </Text>
            {viewMode === "week" && (
              <Text color="gray"> (W{getWeekNumber(viewDays[0])})</Text>
            )}
            {meetingPickerMode && (
              <Text color="gray"> - Select a meeting time</Text>
            )}
            {editable && !meetingPickerMode && (() => {
              // Calculate week/day summary
              const visibleEvents = displayEvents.filter((e) =>
                viewDays.slice(0, numColumns).some((day) => isSameDay(e.startTime, day))
              );
              const totalMinutes = visibleEvents.reduce((acc, e) => {
                if (isAllDayEvent(e)) return acc;
                return acc + (e.endTime.getTime() - e.startTime.getTime()) / 60000;
              }, 0);
              const totalHours = Math.round(totalMinutes / 60 * 10) / 10;

              return (
                <Text color="gray">
                  {` (${visibleEvents.length} events, ${totalHours}h scheduled)`}
                </Text>
              );
            })()}
            <Box marginLeft={2}>
              <Text color={viewMode === "day" ? "cyan" : "gray"} inverse={viewMode === "day"}>
                {" 1:Day "}
              </Text>
              <Text color={viewMode === "week" ? "cyan" : "gray"} inverse={viewMode === "week"}>
                {" 2:Week "}
              </Text>
              <Text color={viewMode === "month" ? "cyan" : "gray"} inverse={viewMode === "month"}>
                {" 3:Month "}
              </Text>
            </Box>
          </Box>

          {/* Legend for multi-calendar */}
          {renderLegend()}

          {/* Day headers */}
          {viewMode !== "month" && (
            <Box>
              <Box width={timeColumnWidth}>
                <Text> </Text>
              </Box>
              {viewDays.slice(0, numColumns).map((day, i) => {
                const isToday = isSameDay(day, today);
                const isCursorDay = i === cursorDay;
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const dayEventCount = displayEvents.filter((e) => isSameDay(e.startTime, day)).length;
                return (
                  <Box key={`header-${i}`} width={columnWidth} flexDirection="column">
                    <Box justifyContent="center">
                      <Text color={isToday ? "blue" : isCursorDay ? "cyan" : isWeekend ? "magenta" : "gray"}>
                        {formatDayName(day)}
                      </Text>
                      {dayEventCount > 0 && (
                        <Text color="yellow" dimColor> {dayEventCount}</Text>
                      )}
                    </Box>
                    <Box justifyContent="center">
                      {isToday ? (
                        <Text backgroundColor="blue" color="white" bold>
                          {` ${formatDayNumber(day)} `}
                        </Text>
                      ) : isCursorDay ? (
                        <Text color="cyan" bold>
                          {formatDayNumber(day)}
                        </Text>
                      ) : isWeekend ? (
                        <Text color="magenta" dimColor>{formatDayNumber(day)}</Text>
                      ) : (
                        <Text bold>{formatDayNumber(day)}</Text>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}

          {/* All-day events row */}
          {viewMode !== "month" && (
            <Box>
              <Box width={timeColumnWidth}>
                <Text color="gray" dimColor>all</Text>
              </Box>
              {viewDays.slice(0, numColumns).map((day, i) => {
                const allDayEvents = displayEvents.filter(
                  (e) => isSameDay(e.startTime, day) && isAllDayEvent(e)
                );
                const firstAllDay = allDayEvents[0];
                return (
                  <Box key={`allday-${i}`} width={columnWidth}>
                    {firstAllDay ? (
                      <Text backgroundColor={firstAllDay.color || "yellow"} color={TEXT_COLORS[firstAllDay.color || "yellow"] || "black"}>
                        {` ${firstAllDay.title}`.slice(0, columnWidth - 1).padEnd(columnWidth - 1)}
                      </Text>
                    ) : (
                      <Text color="gray" dimColor>{"┄".repeat(columnWidth - 1)}</Text>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}

          {/* Month view day headers */}
          {viewMode === "month" && (
            <Box>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => {
                const isWeekend = i >= 5; // Sat=5, Sun=6 in this array
                return (
                  <Box key={`weekday-${i}`} width={columnWidth} justifyContent="center">
                    <Text color={isWeekend ? "magenta" : "gray"} bold dimColor={isWeekend}>{day}</Text>
                  </Box>
                );
              })}
            </Box>
          )}

          {/* Calendar grid */}
          <Box flexGrow={1}>
            {viewMode === "month" ? (
              // Month view grid
              <Box flexDirection="column">
                {[0, 1, 2, 3, 4, 5].map((week) => (
                  <Box key={`week-${week}`}>
                    {[0, 1, 2, 3, 4, 5, 6].map((day) => renderMonthCell(week * 7 + day))}
                  </Box>
                ))}
              </Box>
            ) : (
              // Week/Day view grid
              <>
                {renderTimeColumn()}
                {viewDays.slice(0, numColumns).map((_, i) => renderDayColumn(i))}
              </>
            )}
          </Box>

          {/* Status line - cursor position and event info */}
          {viewMode === "month" && (
            <Box marginBottom={0}>
              {(() => {
                const cursorDate = viewDays[cursorDay];
                const dayEvents = displayEvents.filter((e) => isSameDay(e.startTime, cursorDate));
                const totalMinutes = dayEvents.reduce((acc, e) => {
                  if (isAllDayEvent(e)) return acc;
                  return acc + (e.endTime.getTime() - e.startTime.getTime()) / 60000;
                }, 0);
                const totalHours = Math.round(totalMinutes / 60 * 10) / 10;

                return (
                  <>
                    <Text color="cyan">
                      {formatCursorDateTime(cursorDate, "00:00").split(" @ ")[0]}
                    </Text>
                    {dayEvents.length > 0 ? (
                      <Text color="yellow">
                        {` ─ ${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""}`}
                        <Text color="gray">{` (${totalHours}h scheduled)`}</Text>
                      </Text>
                    ) : (
                      <Text color="green" dimColor>
                        {" ─ No events"}
                      </Text>
                    )}
                  </>
                );
              })()}
            </Box>
          )}
          {viewMode !== "month" && (
            <Box marginBottom={0}>
              <Text color="cyan">
                {formatCursorDateTime(getCursorDate(), getCursorTime())}
              </Text>
              {(() => {
                const eventsAtCursor = getAllEventsAtCursor();
                const currentEvent = getCycledEventAtCursor();
                if (eventsAtCursor.length === 0) {
                  // Show "Free" status when no events
                  return (
                    <Text color="green" dimColor>
                      {" ─ Free"}
                    </Text>
                  );
                }
                if (eventsAtCursor.length === 1 && currentEvent) {
                  // Show detailed event info
                  const duration = formatDuration(currentEvent.startTime, currentEvent.endTime);
                  const startTime = `${currentEvent.startTime.getHours()}:${currentEvent.startTime.getMinutes().toString().padStart(2, "0")}`;
                  const endTime = `${currentEvent.endTime.getHours()}:${currentEvent.endTime.getMinutes().toString().padStart(2, "0")}`;
                  return (
                    <>
                      <Text color="yellow">
                        {" ─ "}{currentEvent.title}
                      </Text>
                      <Text color="gray">
                        {` (${startTime}-${endTime}, ${duration})`}
                      </Text>
                    </>
                  );
                }
                // Multiple events - show cycling info with details
                if (currentEvent) {
                  const currentIndex = (cycledEventIndex % eventsAtCursor.length) + 1;
                  const duration = formatDuration(currentEvent.startTime, currentEvent.endTime);
                  return (
                    <>
                      <Text color="yellow">
                        {" ─ "}{currentEvent.title}
                      </Text>
                      <Text color="gray">
                        {` (${duration})`}
                      </Text>
                      <Text color="red" bold>
                        {` [${currentIndex}/${eventsAtCursor.length}]`}
                      </Text>
                      <Text color="gray" dimColor>
                        {" Tab→"}
                      </Text>
                    </>
                  );
                }
                return null;
              })()}
            </Box>
          )}

          {/* Help bar */}
          <Box>
            <Text color="gray">
              {"↑↓←→ nav  •  j/k jump  •  Tab cycle  •  PgUp/Dn week  •  n/p period  •  h help  •  q quit"}
            </Text>
          </Box>
        </Box>
      )}

      {/* Help overlay */}
      {showHelp && (
        <Box
          position="absolute"
          marginTop={5}
          marginLeft={5}
          flexDirection="column"
          borderStyle="round"
          borderColor="cyan"
          paddingX={2}
          paddingY={1}
        >
          <Text bold color="cyan">{"═══ Keyboard Shortcuts ═══"}</Text>
          <Text> </Text>
          <Text><Text bold color="yellow">Navigation</Text></Text>
          <Text color="white">  ↑↓←→       Move cursor</Text>
          <Text color="white">  Shift+↑↓   Jump by 1 hour</Text>
          <Text color="white">  H / E      Start / End of day</Text>
          <Text color="white">  PgUp/PgDn  Previous / Next week</Text>
          <Text color="white">  n / p      Next / Previous period</Text>
          <Text color="white">  y / Y      Next / Previous year</Text>
          <Text color="white">  t          Go to today</Text>
          <Text> </Text>
          <Text><Text bold color="yellow">Event Selection</Text></Text>
          <Text color="white">  j / k      Jump to next / prev event</Text>
          <Text color="white">  Tab        Cycle through overlaps</Text>
          <Text color="white">  Shift+Tab  Cycle backwards</Text>
          <Text> </Text>
          <Text><Text bold color="yellow">Views</Text></Text>
          <Text color="white">  1          Day view</Text>
          <Text color="white">  2          Week view</Text>
          <Text color="white">  3          Month view</Text>
          {editable && !meetingPickerMode && (
            <>
              <Text> </Text>
              <Text><Text bold color="yellow">Events</Text></Text>
              <Text color="white">  c          Create event</Text>
              <Text color="white">  e / Enter  Edit event</Text>
              <Text color="white">  d / Del    Delete event</Text>
            </>
          )}
          {meetingPickerMode && (
            <>
              <Text> </Text>
              <Text><Text bold color="yellow">Selection</Text></Text>
              <Text color="white">  Space      Select time slot</Text>
            </>
          )}
          <Text> </Text>
          <Text color="gray">Press any key to close</Text>
        </Box>
      )}
    </Box>
  );
}
