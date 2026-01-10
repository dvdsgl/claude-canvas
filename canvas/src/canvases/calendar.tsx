import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import { MeetingPickerView } from "./calendar/scenarios/meeting-picker-view";
import { useMouse } from "./calendar/hooks/use-mouse";
import type { MeetingPickerConfig } from "../scenarios/types";

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  color?: string;
  allDay?: boolean;
}

export interface CalendarConfig {
  title?: string;
  events?: Array<{
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    color?: string;
    allDay?: boolean;
  }>;
  // Meeting picker config (when scenario is "meeting-picker")
  calendars?: MeetingPickerConfig["calendars"];
  slotGranularity?: MeetingPickerConfig["slotGranularity"];
  minDuration?: number;
  maxDuration?: number;
}

function isAllDayEvent(event: CalendarEvent): boolean {
  if (event.allDay) return true;
  // Also detect all-day events by checking if they span midnight to midnight
  const start = event.startTime;
  const end = event.endTime;
  return start.getHours() === 0 && start.getMinutes() === 0 &&
         end.getHours() === 0 && end.getMinutes() === 0 &&
         end.getTime() - start.getTime() >= 24 * 60 * 60 * 1000;
}

interface Props {
  id: string;
  config?: CalendarConfig;
  socketPath?: string;
  scenario?: string;
}

const START_HOUR = 6;
const END_HOUR = 22;

// Notion-like color palette with text colors for contrast
const INK_COLORS = ["yellow", "green", "blue", "magenta", "red", "cyan"];
// Text colors: dark for light backgrounds, white for dark backgrounds
const TEXT_COLORS: Record<string, string> = {
  yellow: "black",
  cyan: "black",
  green: "white",
  blue: "white",
  magenta: "white",
  red: "white",
};

function getWeekDays(baseDate: Date): Date[] {
  const days: Date[] = [];
  const dayOfWeek = baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));

  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    days.push(day);
  }
  return days;
}

function formatDayName(date: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[date.getDay()];
}

function formatDayNumber(date: Date): string {
  return date.getDate().toString();
}

function formatMonthYear(date: Date): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatHour(hour: number): string {
  if (hour === 0 || hour === 12) return "12";
  return hour < 12 ? `${hour}` : `${hour - 12}`;
}

function getAmPm(hour: number): string {
  return hour < 12 ? "am" : "pm";
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function getDemoEvents(): CalendarEvent[] {
  const today = new Date();
  const monday = new Date(today);
  const dayOfWeek = today.getDay();
  monday.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));

  return [
    {
      id: "1",
      title: "Team Standup",
      startTime: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 9, 0),
      endTime: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 9, 30),
      color: INK_COLORS[0],
    },
    {
      id: "2",
      title: "Design Review",
      startTime: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 1, 14, 0),
      endTime: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 1, 15, 30),
      color: INK_COLORS[1],
    },
    {
      id: "3",
      title: "Lunch with Sarah",
      startTime: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 2, 12, 0),
      endTime: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 2, 13, 0),
      color: INK_COLORS[2],
    },
    {
      id: "4",
      title: "Product Planning",
      startTime: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3, 10, 0),
      endTime: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3, 11, 30),
      color: INK_COLORS[3],
    },
    {
      id: "5",
      title: "1:1 with Manager",
      startTime: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4, 15, 0),
      endTime: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4, 16, 0),
      color: INK_COLORS[4],
    },
    {
      id: "6",
      title: "Sprint Retro",
      startTime: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4, 11, 0),
      endTime: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4, 12, 0),
      color: INK_COLORS[5],
    },
  ];
}

interface DayColumnProps {
  date: Date;
  events: CalendarEvent[];
  isToday: boolean;
  columnWidth: number;
  slotHeights: number[];
  currentTime: Date;
}

function DayColumn({ date, events, isToday, columnWidth, slotHeights, currentTime }: DayColumnProps) {
  // Filter to only timed events (not all-day) for this day
  const dayEvents = events.filter((e) => isSameDay(e.startTime, date) && !isAllDayEvent(e));

  // Calculate current time position for the "now" line (show on ALL days)
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentTimeDecimal = currentHour + currentMinute / 60;
  const showNowLine = currentHour >= START_HOUR && currentHour < END_HOUR;

  // Build half-hour slots (2 rows per hour)
  const slots: JSX.Element[] = [];
  let slotIndex = 0;
  let cumulativeHeight = 0;

  for (let hour = START_HOUR; hour < END_HOUR; hour++) {
    for (let half = 0; half < 2; half++) {
      const slotMinute = half * 30;
      const slotTime = hour + slotMinute / 60;
      const slotEndTime = slotTime + 0.5;
      const thisSlotHeight = slotHeights[slotIndex] || 1;

      const slotEvent = dayEvents.find(e => {
        const eventStartTime = e.startTime.getHours() + e.startTime.getMinutes() / 60;
        const eventEndTime = e.endTime.getHours() + e.endTime.getMinutes() / 60;
        return slotTime >= eventStartTime && slotTime < eventEndTime;
      });

      const isEventStart = slotEvent &&
        slotEvent.startTime.getHours() === hour &&
        Math.floor(slotEvent.startTime.getMinutes() / 30) === half;
      const eventTitle = slotEvent?.title.slice(0, columnWidth - 2) || "";

      // Check if the "now" line should appear in this slot
      const nowInThisSlot = showNowLine && currentTimeDecimal >= slotTime && currentTimeDecimal < slotEndTime;
      // Calculate which line within the slot the now line should appear on
      const nowLinePosition = nowInThisSlot
        ? Math.floor(((currentTimeDecimal - slotTime) / 0.5) * thisSlotHeight)
        : -1;

      // Build content for multiple lines if thisSlotHeight > 1
      const lines: JSX.Element[] = [];
      for (let line = 0; line < thisSlotHeight; line++) {
        const isNowLine = line === nowLinePosition;

        if (isNowLine && !slotEvent) {
          // Draw red "now" line
          lines.push(
            <Text key={line} color="red">{"━".repeat(columnWidth - 1)}</Text>
          );
        } else if (slotEvent) {
          // Use contrasting text color based on background
          const textColor = isNowLine ? "red" : (TEXT_COLORS[slotEvent.color || "blue"] || "white");
          lines.push(
            <Text key={line} backgroundColor={slotEvent.color} color={textColor} bold>
              {line === 0 && isEventStart
                ? ` ${eventTitle}`.padEnd(columnWidth - 1)
                : " ".repeat(columnWidth - 1)}
            </Text>
          );
        } else {
          lines.push(
            <Text key={line} color="gray" dimColor>
              {line === 0 ? (half === 0 ? "─".repeat(columnWidth - 1) : "┄".repeat(columnWidth - 1)) : " ".repeat(columnWidth - 1)}
            </Text>
          );
        }
      }

      slots.push(
        <Box key={`${hour}-${half}`} flexDirection="column" height={thisSlotHeight}>
          {lines}
        </Box>
      );
      slotIndex++;
      cumulativeHeight += thisSlotHeight;
    }
  }

  return (
    <Box flexDirection="column" width={columnWidth} flexGrow={1}>
      {/* Time slots only - headers are rendered separately */}
      <Box flexDirection="column" flexGrow={1}>
        {slots}
      </Box>
    </Box>
  );
}

interface DayHeadersRowProps {
  weekDays: Date[];
  today: Date;
  columnWidth: number;
  timeColumnWidth: number;
}

function DayHeadersRow({ weekDays, today, columnWidth, timeColumnWidth }: DayHeadersRowProps) {
  return (
    <Box>
      {/* Empty space for time column */}
      <Box width={timeColumnWidth}>
        <Text>{" "}</Text>
      </Box>
      {/* Day headers */}
      {weekDays.map((day, i) => {
        const isToday = isSameDay(day, today);
        return (
          <Box key={i} width={columnWidth} flexDirection="column">
            <Box justifyContent="center" width="100%">
              <Text color={isToday ? "blue" : "gray"}>{formatDayName(day)}</Text>
            </Box>
            <Box justifyContent="center" width="100%">
              {isToday ? (
                <Text backgroundColor="blue" color="white" bold>{` ${formatDayNumber(day)} `}</Text>
              ) : (
                <Text bold>{formatDayNumber(day)}</Text>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

interface AllDayRowProps {
  weekDays: Date[];
  events: CalendarEvent[];
  columnWidth: number;
  timeColumnWidth: number;
}

function AllDayEventsRow({ weekDays, events, columnWidth, timeColumnWidth }: AllDayRowProps) {
  // Get all-day events for the week
  const allDayEvents = events.filter(isAllDayEvent);

  if (allDayEvents.length === 0) {
    return null;
  }

  return (
    <Box>
      {/* Empty space for time column */}
      <Box width={timeColumnWidth}>
        <Text>{" "}</Text>
      </Box>
      {/* All-day event cells for each day */}
      {weekDays.map((day, i) => {
        const dayAllDay = allDayEvents.filter((e) => isSameDay(e.startTime, day));
        return (
          <Box key={i} width={columnWidth} flexDirection="column">
            {dayAllDay.length > 0 ? (
              dayAllDay.map((event) => {
                const textColor = TEXT_COLORS[event.color || "blue"] || "white";
                const title = event.title.slice(0, columnWidth - 2);
                return (
                  <Box key={event.id} height={1}>
                    <Text backgroundColor={event.color || "blue"} color={textColor} bold>
                      {` ${title}`.padEnd(columnWidth - 1)}
                    </Text>
                  </Box>
                );
              })
            ) : (
              <Box height={1}>
                <Text color="gray" dimColor>{" ".repeat(columnWidth - 1)}</Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

export function Calendar({ id, config, socketPath, scenario = "display" }: Props) {
  // Route to meeting picker if that scenario is requested
  if (scenario === "meeting-picker" && config?.calendars) {
    const pickerConfig: MeetingPickerConfig = {
      calendars: config.calendars,
      slotGranularity: config.slotGranularity || 30,
      minDuration: config.minDuration || 30,
      maxDuration: config.maxDuration || 120,
      title: config.title,
      startHour: 6,
      endHour: 22,
    };
    return <MeetingPickerView id={id} config={pickerConfig} socketPath={socketPath} />;
  }

  // Default display scenario
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dimensions, setDimensions] = useState({
    width: stdout?.columns || 120,
    height: stdout?.rows || 40,
  });

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
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
    updateDimensions(); // Initial update

    return () => {
      stdout?.off("resize", updateDimensions);
    };
  }, [stdout]);

  const termWidth = dimensions.width;
  const termHeight = dimensions.height;
  const timeColumnWidth = 6;
  const availableWidth = termWidth - timeColumnWidth - 4;
  const columnWidth = Math.max(12, Math.floor(availableWidth / 7));

  // Calculate slot heights to fill vertical space exactly
  const headerHeight = 5; // Title (1) + marginBottom (1) + day name (1) + day number (1) + marginBottom (1)
  const footerHeight = 1; // Help bar
  const availableHeight = Math.max(1, termHeight - headerHeight - footerHeight);
  const totalSlots = (END_HOUR - START_HOUR) * 2; // 2 slots per hour
  const baseSlotHeight = Math.max(1, Math.floor(availableHeight / totalSlots));
  const extraRows = availableHeight - (baseSlotHeight * totalSlots);
  // Create array of slot heights - first `extraRows` slots get +1 height
  const slotHeights = Array.from({ length: totalSlots }, (_, i) =>
    baseSlotHeight + (i < extraRows ? 1 : 0)
  );

  const events: CalendarEvent[] = config?.events
    ? config.events.map((e) => ({
        ...e,
        startTime: new Date(e.startTime),
        endTime: new Date(e.endTime),
      }))
    : getDemoEvents();

  const weekDays = getWeekDays(currentDate);
  const today = new Date();

  useInput((input, key) => {
    if (input === "q" || key.escape) {
      exit();
    } else if (input === "n" || key.rightArrow) {
      setCurrentDate((d) => {
        const next = new Date(d);
        next.setDate(d.getDate() + 7);
        return next;
      });
    } else if (input === "p" || key.leftArrow) {
      setCurrentDate((d) => {
        const prev = new Date(d);
        prev.setDate(d.getDate() - 7);
        return prev;
      });
    } else if (input === "t") {
      setCurrentDate(new Date());
    }
  });

  // Scroll handler for week navigation
  const handleScroll = useCallback((event: { scrollDirection: "up" | "down" | null }) => {
    if (event.scrollDirection === "up") {
      setCurrentDate((d) => {
        const prev = new Date(d);
        prev.setDate(d.getDate() - 7);
        return prev;
      });
    } else if (event.scrollDirection === "down") {
      setCurrentDate((d) => {
        const next = new Date(d);
        next.setDate(d.getDate() + 7);
        return next;
      });
    }
  }, []);

  // Enable mouse scroll
  useMouse({
    enabled: true,
    onScroll: handleScroll,
  });

  // Build time column (2 rows per hour, matching slot heights)
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentTimeDecimal = currentHour + currentMinute / 60;
  const showNowIndicator = currentHour >= START_HOUR && currentHour < END_HOUR;

  const timeSlots: JSX.Element[] = [];
  let timeSlotIndex = 0;
  for (let hour = START_HOUR; hour < END_HOUR; hour++) {
    // Hour label on first half
    const slotTime = hour;
    const slotEndTime = hour + 0.5;
    const firstHalfHeight = slotHeights[timeSlotIndex] || 1;

    // Check if current time is in this slot
    const nowInFirstHalf = showNowIndicator && currentTimeDecimal >= slotTime && currentTimeDecimal < slotEndTime;
    const nowLineInFirstHalf = nowInFirstHalf
      ? Math.floor(((currentTimeDecimal - slotTime) / 0.5) * firstHalfHeight)
      : -1;

    const firstHalfLines: JSX.Element[] = [];
    for (let line = 0; line < firstHalfHeight; line++) {
      const isNowLine = line === nowLineInFirstHalf;
      if (isNowLine) {
        // Show current time in red (12-hour format)
        const hour12 = currentHour === 0 ? 12 : currentHour > 12 ? currentHour - 12 : currentHour;
        const ampm = currentHour < 12 ? "a" : "p";
        const timeStr = `${hour12}:${currentMinute.toString().padStart(2, "0")}${ampm}`;
        firstHalfLines.push(
          <Text key={line} color="red" bold>
            {timeStr.padStart(timeColumnWidth - 1)}
          </Text>
        );
      } else {
        firstHalfLines.push(
          <Text key={line} color="gray">
            {line === 0 ? `${formatHour(hour)}${getAmPm(hour)}`.padStart(timeColumnWidth - 1) : " ".repeat(timeColumnWidth - 1)}
          </Text>
        );
      }
    }
    timeSlots.push(
      <Box key={`${hour}-0`} flexDirection="column" height={firstHalfHeight} width={timeColumnWidth}>
        {firstHalfLines}
      </Box>
    );
    timeSlotIndex++;

    // Second half
    const secondSlotTime = hour + 0.5;
    const secondSlotEndTime = hour + 1;
    const secondHalfHeight = slotHeights[timeSlotIndex] || 1;

    const nowInSecondHalf = showNowIndicator && currentTimeDecimal >= secondSlotTime && currentTimeDecimal < secondSlotEndTime;
    const nowLineInSecondHalf = nowInSecondHalf
      ? Math.floor(((currentTimeDecimal - secondSlotTime) / 0.5) * secondHalfHeight)
      : -1;

    const secondHalfLines: JSX.Element[] = [];
    for (let line = 0; line < secondHalfHeight; line++) {
      const isNowLine = line === nowLineInSecondHalf;
      if (isNowLine) {
        // Show current time in red (12-hour format)
        const hour12 = currentHour === 0 ? 12 : currentHour > 12 ? currentHour - 12 : currentHour;
        const ampm = currentHour < 12 ? "a" : "p";
        const timeStr = `${hour12}:${currentMinute.toString().padStart(2, "0")}${ampm}`;
        secondHalfLines.push(
          <Text key={line} color="red" bold>
            {timeStr.padStart(timeColumnWidth - 1)}
          </Text>
        );
      } else {
        secondHalfLines.push(<Text key={line}>{" "}</Text>);
      }
    }
    timeSlots.push(
      <Box key={`${hour}-1`} flexDirection="column" height={secondHalfHeight} width={timeColumnWidth}>
        {secondHalfLines}
      </Box>
    );
    timeSlotIndex++;
  }

  // Check if there are any all-day events
  const hasAllDayEvents = events.some(isAllDayEvent);

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight} paddingX={1}>
      {/* Title bar */}
      <Box marginBottom={1}>
        <Text bold color="white">{formatMonthYear(weekDays[0])}</Text>
      </Box>

      {/* Day headers row */}
      <DayHeadersRow
        weekDays={weekDays}
        today={today}
        columnWidth={columnWidth}
        timeColumnWidth={timeColumnWidth}
      />

      {/* All-day events row (if any) */}
      {hasAllDayEvents && (
        <AllDayEventsRow
          weekDays={weekDays}
          events={events}
          columnWidth={columnWidth}
          timeColumnWidth={timeColumnWidth}
        />
      )}

      {/* Calendar time grid */}
      <Box flexGrow={1}>
        {/* Time column */}
        <Box flexDirection="column" width={timeColumnWidth}>
          {timeSlots}
        </Box>

        {/* Day columns (time slots only) */}
        {weekDays.map((day, i) => (
          <DayColumn
            key={i}
            date={day}
            events={events}
            isToday={isSameDay(day, today)}
            columnWidth={columnWidth}
            slotHeights={slotHeights}
            currentTime={currentTime}
          />
        ))}
      </Box>

      {/* Help bar */}
      <Box>
        <Text color="gray">{"←/→/scroll week  •  t today  •  q quit"}</Text>
      </Box>
    </Box>
  );
}
