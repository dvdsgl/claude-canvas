// Edit View Component - Calendar with full CRUD operations

import React, { useState, useEffect } from "react";
import { Box, Text, useApp, useStdout } from "ink";
import { useSafeInput } from "../../../utils/use-safe-input";
import { useStorage } from "../hooks/use-storage";
import { EventModal } from "../components/event-modal";
import { ConfirmDialog } from "../components/confirm-dialog";
import type { CalendarEvent, EditCalendarConfig } from "../types";
import {
  getWeekDays,
  formatDayName,
  formatDayNumber,
  formatMonthYear,
  formatHour,
  getAmPm,
  isSameDay,
  TEXT_COLORS,
} from "../types";

interface Props {
  id: string;
  config?: EditCalendarConfig;
  socketPath?: string;
}

type ModalMode = "closed" | "create" | "edit" | "delete";

const START_HOUR = 6;
const END_HOUR = 22;

function isAllDayEvent(event: CalendarEvent): boolean {
  if (event.allDay) return true;
  const start = event.startTime;
  const end = event.endTime;
  return (
    start.getHours() === 0 &&
    start.getMinutes() === 0 &&
    end.getHours() === 0 &&
    end.getMinutes() === 0 &&
    end.getTime() - start.getTime() >= 24 * 60 * 60 * 1000
  );
}

export function EditView({ id, config, socketPath }: Props) {
  const { exit } = useApp();
  const { stdout } = useStdout();

  // Storage hook for CRUD operations
  const {
    events,
    isLoading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
  } = useStorage({ filePath: config?.storageFile });

  // View state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dimensions, setDimensions] = useState({
    width: stdout?.columns || 120,
    height: stdout?.rows || 40,
  });

  // Cursor state for navigation
  const [cursorDay, setCursorDay] = useState(0); // 0-6 (day of week)
  const [cursorSlot, setCursorSlot] = useState(6); // Time slot index (0 = 6am, etc.)

  // Selection and modal state
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>("closed");

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

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
  const availableWidth = termWidth - timeColumnWidth - 4;
  const columnWidth = Math.max(12, Math.floor(availableWidth / 7));

  // Calculate slot heights
  const headerHeight = 5;
  const footerHeight = 1;
  const availableHeight = Math.max(1, termHeight - headerHeight - footerHeight);
  const totalSlots = (END_HOUR - START_HOUR) * 2;
  const baseSlotHeight = Math.max(1, Math.floor(availableHeight / totalSlots));
  const extraRows = availableHeight - baseSlotHeight * totalSlots;
  const slotHeights = Array.from({ length: totalSlots }, (_, i) =>
    baseSlotHeight + (i < extraRows ? 1 : 0)
  );

  const weekDays = getWeekDays(currentDate);
  const today = new Date();

  // Get event at cursor position
  const getCursorDate = () => weekDays[cursorDay];
  const getCursorTime = () => {
    const slotHour = START_HOUR + Math.floor(cursorSlot / 2);
    const slotMinute = (cursorSlot % 2) * 30;
    return `${slotHour.toString().padStart(2, "0")}:${slotMinute.toString().padStart(2, "0")}`;
  };

  const getEventAtCursor = (): CalendarEvent | null => {
    const cursorDate = getCursorDate();
    const slotHour = START_HOUR + Math.floor(cursorSlot / 2);
    const slotMinute = (cursorSlot % 2) * 30;
    const slotTime = slotHour + slotMinute / 60;

    return (
      events.find((e) => {
        if (!isSameDay(e.startTime, cursorDate)) return false;
        if (isAllDayEvent(e)) return false;
        const eventStart = e.startTime.getHours() + e.startTime.getMinutes() / 60;
        const eventEnd = e.endTime.getHours() + e.endTime.getMinutes() / 60;
        return slotTime >= eventStart && slotTime < eventEnd;
      }) || null
    );
  };

  const selectedEvent = selectedEventId
    ? events.find((e) => e.id === selectedEventId) || null
    : null;

  // Handle keyboard input
  useSafeInput(
    (input, key) => {
      // Don't handle input when modal is open
      if (modalMode !== "closed") return;

      if (input === "q" || key.escape) {
        exit();
        return;
      }

      // Navigation
      if (key.upArrow) {
        setCursorSlot((s) => Math.max(0, s - 1));
      } else if (key.downArrow) {
        setCursorSlot((s) => Math.min(totalSlots - 1, s + 1));
      } else if (key.leftArrow) {
        setCursorDay((d) => Math.max(0, d - 1));
      } else if (key.rightArrow) {
        setCursorDay((d) => Math.min(6, d + 1));
      }

      // Week navigation
      if (input === "n") {
        setCurrentDate((d) => {
          const next = new Date(d);
          next.setDate(d.getDate() + 7);
          return next;
        });
      } else if (input === "p") {
        setCurrentDate((d) => {
          const prev = new Date(d);
          prev.setDate(d.getDate() - 7);
          return prev;
        });
      } else if (input === "t") {
        setCurrentDate(new Date());
      }

      // CRUD operations
      if (input === "c") {
        // Create new event at cursor
        setModalMode("create");
      } else if (input === "e" || key.return) {
        // Edit selected event
        const eventAtCursor = getEventAtCursor();
        if (eventAtCursor) {
          setSelectedEventId(eventAtCursor.id);
          setModalMode("edit");
        }
      } else if (input === "d" || key.delete) {
        // Delete selected event
        const eventAtCursor = getEventAtCursor();
        if (eventAtCursor) {
          setSelectedEventId(eventAtCursor.id);
          setModalMode("delete");
        }
      }
    },
    { isActive: modalMode === "closed" }
  );

  // Handle modal actions
  const handleSave = async (eventData: CalendarEvent | Omit<CalendarEvent, "id">) => {
    try {
      if (modalMode === "create") {
        await createEvent(eventData as Omit<CalendarEvent, "id">);
      } else if (modalMode === "edit" && "id" in eventData) {
        await updateEvent(eventData.id, eventData);
      }
      setModalMode("closed");
      setSelectedEventId(null);
    } catch (err) {
      // Error is handled by useStorage
    }
  };

  const handleDelete = async () => {
    if (selectedEventId) {
      try {
        await deleteEvent(selectedEventId);
        setModalMode("closed");
        setSelectedEventId(null);
      } catch (err) {
        // Error is handled by useStorage
      }
    }
  };

  const handleCancel = () => {
    setModalMode("closed");
    setSelectedEventId(null);
  };

  // Render time column
  const renderTimeColumn = () => {
    const slots: React.JSX.Element[] = [];
    for (let i = 0; i < totalSlots; i++) {
      const hour = START_HOUR + Math.floor(i / 2);
      const isFirstHalf = i % 2 === 0;
      const height = slotHeights[i];

      slots.push(
        <Box key={i} height={height} width={timeColumnWidth}>
          <Text color="gray">
            {isFirstHalf ? `${formatHour(hour)}${getAmPm(hour)}`.padStart(timeColumnWidth - 1) : ""}
          </Text>
        </Box>
      );
    }
    return slots;
  };

  // Render day column with cursor
  const renderDayColumn = (dayIndex: number) => {
    const day = weekDays[dayIndex];
    const dayEvents = events.filter(
      (e) => isSameDay(e.startTime, day) && !isAllDayEvent(e)
    );

    const slots: React.JSX.Element[] = [];
    for (let i = 0; i < totalSlots; i++) {
      const slotHour = START_HOUR + Math.floor(i / 2);
      const slotMinute = (i % 2) * 30;
      const slotTime = slotHour + slotMinute / 60;
      const height = slotHeights[i];

      const isCursor = dayIndex === cursorDay && i === cursorSlot;

      // Find event in this slot
      const slotEvent = dayEvents.find((e) => {
        const eventStart = e.startTime.getHours() + e.startTime.getMinutes() / 60;
        const eventEnd = e.endTime.getHours() + e.endTime.getMinutes() / 60;
        return slotTime >= eventStart && slotTime < eventEnd;
      });

      const isEventStart =
        slotEvent &&
        slotEvent.startTime.getHours() === slotHour &&
        Math.floor(slotEvent.startTime.getMinutes() / 30) === i % 2;

      let content: React.JSX.Element;
      if (slotEvent) {
        const textColor = TEXT_COLORS[slotEvent.color || "blue"] || "white";
        const title = isEventStart ? ` ${slotEvent.title}`.slice(0, columnWidth - 2) : "";
        content = (
          <Text
            backgroundColor={isCursor ? "white" : slotEvent.color}
            color={isCursor ? "black" : textColor}
            bold
          >
            {title.padEnd(columnWidth - 1)}
          </Text>
        );
      } else if (isCursor) {
        content = (
          <Text backgroundColor="gray" color="white">
            {" ".repeat(columnWidth - 1)}
          </Text>
        );
      } else {
        content = (
          <Text color="gray" dimColor>
            {i % 2 === 0 ? "─".repeat(columnWidth - 1) : "┄".repeat(columnWidth - 1)}
          </Text>
        );
      }

      slots.push(
        <Box key={i} height={height}>
          {content}
        </Box>
      );
    }

    return (
      <Box flexDirection="column" width={columnWidth}>
        {slots}
      </Box>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <Box flexDirection="column" padding={2}>
        <Text>Loading events...</Text>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box flexDirection="column" padding={2}>
        <Text color="red">Error: {error.message}</Text>
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

      {/* Calendar view (hidden when modal is open) */}
      {modalMode === "closed" && (
        <Box flexDirection="column" paddingX={1} height={termHeight}>
          {/* Title bar */}
          <Box marginBottom={1}>
            <Text bold color="cyan">
              {formatMonthYear(weekDays[0])}
            </Text>
            <Text color="gray"> - Edit Mode</Text>
            <Text color="gray"> ({events.length} events)</Text>
          </Box>

          {/* Day headers */}
          <Box>
            <Box width={timeColumnWidth}>
              <Text> </Text>
            </Box>
            {weekDays.map((day, i) => {
              const isToday = isSameDay(day, today);
              const isCursorDay = i === cursorDay;
              return (
                <Box key={i} width={columnWidth} flexDirection="column">
                  <Box justifyContent="center">
                    <Text color={isToday ? "blue" : isCursorDay ? "cyan" : "gray"}>
                      {formatDayName(day)}
                    </Text>
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
                    ) : (
                      <Text bold>{formatDayNumber(day)}</Text>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>

          {/* Calendar grid */}
          <Box flexGrow={1}>
            <Box flexDirection="column" width={timeColumnWidth}>
              {renderTimeColumn()}
            </Box>
            {weekDays.map((_, i) => (
              <React.Fragment key={i}>{renderDayColumn(i)}</React.Fragment>
            ))}
          </Box>

          {/* Help bar */}
          <Box>
            <Text color="gray">
              {"↑↓←→ move  •  c create  •  e/Enter edit  •  d delete  •  n/p week  •  t today  •  q quit"}
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
