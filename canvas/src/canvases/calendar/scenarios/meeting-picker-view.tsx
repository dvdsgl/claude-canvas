// Meeting Picker View - Interactive calendar for selecting meeting times

import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import { useMouse, type MouseEvent } from "../hooks/use-mouse";
import { useIPC } from "../hooks/use-ipc";
import type { MeetingPickerConfig, MeetingPickerResult, NamedCalendar } from "../../../scenarios/types";
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
  config: MeetingPickerConfig;
  socketPath?: string;
}

interface SlotInfo {
  dayIndex: number;
  slotIndex: number;
  day: Date;
  startTime: Date;
  endTime: Date;
}

export function MeetingPickerView({ id, config, socketPath }: Props) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dimensions, setDimensions] = useState({
    width: stdout?.columns || 120,
    height: stdout?.rows || 40,
  });
  const [hoveredSlot, setHoveredSlot] = useState<SlotInfo | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotInfo | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null); // null = not counting, 3/2/1 = counting
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  // Keyboard cursor position (for arrow key navigation)
  const [cursorDay, setCursorDay] = useState(0);
  const [cursorSlot, setCursorSlot] = useState(0);
  const [usingKeyboard, setUsingKeyboard] = useState(true); // Start with keyboard mode

  // Simple ASCII spinner (single-width chars only)
  const spinnerChars = ["|", "/", "-", "\\"];

  const {
    calendars = [],
    slotGranularity = 30,
    startHour = 6,
    endHour = 22,
  } = config;

  const ipc = useIPC({
    socketPath,
    scenario: "meeting-picker",
    onClose: () => exit(),
  });

  // Countdown timer effect
  useEffect(() => {
    if (countdown === null) return;

    if (countdown === -1) {
      // Final state after checkmark shown - now exit
      exit();
      return;
    }

    if (countdown === 0) {
      // Show checkmark for 1 second, then exit
      const timer = setTimeout(() => {
        setCountdown(-1);
      }, 1000);
      return () => clearTimeout(timer);
    }

    // Tick down every second
    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, exit]);

  // Spinner animation
  useEffect(() => {
    if (countdown === null) return;
    const interval = setInterval(() => {
      setSpinnerFrame((f) => (f + 1) % spinnerChars.length);
    }, 100);
    return () => clearInterval(interval);
  }, [countdown, spinnerChars.length]);

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

  const termWidth = dimensions.width;
  const termHeight = dimensions.height;
  const timeColumnWidth = 6;
  const availableWidth = termWidth - timeColumnWidth - 4;
  const columnWidth = Math.max(12, Math.floor(availableWidth / 7));

  // Calculate slots
  const slotsPerHour = 60 / slotGranularity;
  const totalSlots = (endHour - startHour) * slotsPerHour;

  // Calculate slot heights to fill vertical space
  const headerHeight = 5;
  const footerHeight = 2;
  const availableHeight = Math.max(1, termHeight - headerHeight - footerHeight);
  const baseSlotHeight = Math.max(1, Math.floor(availableHeight / totalSlots));
  const extraRows = availableHeight - baseSlotHeight * totalSlots;
  const slotHeights = Array.from({ length: totalSlots }, (_, i) =>
    baseSlotHeight + (i < extraRows ? 1 : 0)
  );

  // Calculate cumulative heights for grid positioning
  const cumulativeHeights = slotHeights.reduce((acc, h, i) => {
    acc.push((acc[i - 1] || 0) + h);
    return acc;
  }, [] as number[]);

  const weekDays = getWeekDays(currentDate);
  const today = new Date();

  // Build busy map: Map<"dayIndex-slotIndex", color[]>
  const busyMap = new Map<string, string[]>();

  for (const calendar of calendars) {
    for (const event of calendar.events) {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);

      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const day = weekDays[dayIndex];
        if (!isSameDay(eventStart, day) && !isSameDay(eventEnd, day)) continue;

        const dayStart = new Date(day);
        dayStart.setHours(startHour, 0, 0, 0);
        const dayEnd = new Date(day);
        dayEnd.setHours(endHour, 0, 0, 0);

        for (let slotIndex = 0; slotIndex < totalSlots; slotIndex++) {
          const slotStart = new Date(day);
          const slotMinutes = slotIndex * slotGranularity;
          slotStart.setHours(
            startHour + Math.floor(slotMinutes / 60),
            slotMinutes % 60,
            0,
            0
          );
          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + slotGranularity);

          // Check if event overlaps this slot
          if (eventStart < slotEnd && eventEnd > slotStart) {
            const key = `${dayIndex}-${slotIndex}`;
            const colors = busyMap.get(key) || [];
            if (!colors.includes(calendar.color)) {
              colors.push(calendar.color);
            }
            busyMap.set(key, colors);
          }
        }
      }
    }
  }

  // Convert terminal position to slot
  const terminalToSlot = useCallback(
    (x: number, y: number): SlotInfo | null => {
      // Account for padding and time column
      const gridLeft = timeColumnWidth + 2; // 2 for paddingX
      const gridTop = headerHeight + 1;

      const relX = x - gridLeft;
      const relY = y - gridTop;

      if (relX < 0 || relY < 0) return null;

      const dayIndex = Math.floor(relX / columnWidth);
      if (dayIndex >= 7) return null;

      // Find slot from cumulative heights
      let slotIndex = 0;
      let cumHeight = 0;
      for (let i = 0; i < totalSlots; i++) {
        cumHeight += slotHeights[i];
        if (relY < cumHeight) {
          slotIndex = i;
          break;
        }
        if (i === totalSlots - 1) {
          slotIndex = i;
        }
      }

      if (slotIndex >= totalSlots) return null;

      const day = weekDays[dayIndex];
      const slotMinutes = slotIndex * slotGranularity;
      const startTime = new Date(day);
      startTime.setHours(
        startHour + Math.floor(slotMinutes / 60),
        slotMinutes % 60,
        0,
        0
      );
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + slotGranularity);

      return { dayIndex, slotIndex, day, startTime, endTime };
    },
    [weekDays, columnWidth, slotHeights, totalSlots, slotGranularity, startHour, timeColumnWidth, headerHeight]
  );

  // Check if a slot is free (no one is busy)
  const isSlotFree = useCallback(
    (dayIndex: number, slotIndex: number): boolean => {
      const key = `${dayIndex}-${slotIndex}`;
      return !busyMap.has(key);
    },
    [busyMap]
  );

  // Handle mouse events
  const handleMouseClick = useCallback(
    (event: MouseEvent) => {
      const slot = terminalToSlot(event.x, event.y);
      if (slot && isSlotFree(slot.dayIndex, slot.slotIndex)) {
        // Send selection via IPC
        const result: MeetingPickerResult = {
          startTime: slot.startTime.toISOString(),
          endTime: slot.endTime.toISOString(),
          duration: slotGranularity,
        };
        ipc.sendSelected(result);

        if (event.modifiers.shift) {
          // Power user: Shift+click skips countdown
          setSelectedSlot(slot);
          setCountdown(0); // Go straight to confirmed state
        } else {
          setSelectedSlot(slot);
          setCountdown(3); // Start 3 second countdown
        }
      }
    },
    [terminalToSlot, isSlotFree, slotGranularity, ipc]
  );

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      const slot = terminalToSlot(event.x, event.y);
      setHoveredSlot(slot);
      setUsingKeyboard(false); // Switch to mouse mode
      // Sync cursor so keyboard continues from mouse position
      if (slot) {
        setCursorDay(slot.dayIndex);
        setCursorSlot(slot.slotIndex);
      }
    },
    [terminalToSlot]
  );

  // Scroll handler for time slot and week navigation
  const handleScroll = useCallback(
    (event: MouseEvent) => {
      if (countdown !== null) return; // Ignore during countdown

      if (event.modifiers.shift) {
        // Shift+scroll = week navigation
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
      } else {
        // Regular scroll = time slot navigation
        setUsingKeyboard(true);
        if (event.scrollDirection === "up") {
          setCursorSlot((s) => Math.max(0, s - 1));
        } else if (event.scrollDirection === "down") {
          setCursorSlot((s) => Math.min(totalSlots - 1, s + 1));
        }
      }
    },
    [countdown, totalSlots]
  );

  useMouse({
    enabled: true,
    onClick: handleMouseClick,
    onMove: handleMouseMove,
    onScroll: handleScroll,
  });

  // Get slot info for cursor position
  const getCursorSlotInfo = useCallback((): SlotInfo | null => {
    if (cursorDay < 0 || cursorDay >= 7) return null;
    if (cursorSlot < 0 || cursorSlot >= totalSlots) return null;

    const day = weekDays[cursorDay];
    const slotMinutes = cursorSlot * slotGranularity;
    const startTime = new Date(day);
    startTime.setHours(
      startHour + Math.floor(slotMinutes / 60),
      slotMinutes % 60,
      0,
      0
    );
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + slotGranularity);

    return { dayIndex: cursorDay, slotIndex: cursorSlot, day, startTime, endTime };
  }, [cursorDay, cursorSlot, weekDays, totalSlots, slotGranularity, startHour]);

  // Keyboard controls
  useInput((input, key) => {
    if (input === "q" || key.escape) {
      if (countdown !== null) {
        // Cancel countdown, deselect
        setCountdown(null);
        setSelectedSlot(null);
      } else {
        ipc.sendCancelled("User pressed escape");
        exit();
      }
    } else if ((key.return || input === " ") && countdown === null) {
      // Select current cursor position and start countdown
      if (usingKeyboard) {
        const cursorInfo = getCursorSlotInfo();
        if (cursorInfo && isSlotFree(cursorInfo.dayIndex, cursorInfo.slotIndex)) {
          const result: MeetingPickerResult = {
            startTime: cursorInfo.startTime.toISOString(),
            endTime: cursorInfo.endTime.toISOString(),
            duration: slotGranularity,
          };
          ipc.sendSelected(result);

          if (key.shift) {
            // Power user: Shift+Enter skips countdown
            setSelectedSlot(cursorInfo);
            setCountdown(0); // Go straight to confirmed state
          } else {
            setSelectedSlot(cursorInfo);
            setCountdown(3); // Start 3 second countdown
          }
        }
      }
    } else if (key.upArrow) {
      // Move cursor up (earlier time) - cancel countdown if active
      if (countdown !== null) {
        setCountdown(null);
        setSelectedSlot(null);
      }
      setUsingKeyboard(true);
      setCursorSlot((s) => Math.max(0, s - 1));
    } else if (key.downArrow) {
      // Move cursor down (later time) - cancel countdown if active
      if (countdown !== null) {
        setCountdown(null);
        setSelectedSlot(null);
      }
      setUsingKeyboard(true);
      setCursorSlot((s) => Math.min(totalSlots - 1, s + 1));
    } else if (key.leftArrow) {
      // Move cursor left (previous day) - cancel countdown if active
      if (countdown !== null) {
        setCountdown(null);
        setSelectedSlot(null);
      }
      setUsingKeyboard(true);
      setCursorDay((d) => Math.max(0, d - 1));
    } else if (key.rightArrow) {
      // Move cursor right (next day) - cancel countdown if active
      if (countdown !== null) {
        setCountdown(null);
        setSelectedSlot(null);
      }
      setUsingKeyboard(true);
      setCursorDay((d) => Math.min(6, d + 1));
    } else if (input === "n") {
      // Next week
      setCurrentDate((d) => {
        const next = new Date(d);
        next.setDate(d.getDate() + 7);
        return next;
      });
    } else if (input === "p") {
      // Previous week
      setCurrentDate((d) => {
        const prev = new Date(d);
        prev.setDate(d.getDate() - 7);
        return prev;
      });
    } else if (input === "t") {
      setCurrentDate(new Date());
    }
  });

  // Render time column
  const renderTimeColumn = () => {
    const slots: JSX.Element[] = [];
    for (let slotIndex = 0; slotIndex < totalSlots; slotIndex++) {
      const height = slotHeights[slotIndex];
      const slotMinutes = slotIndex * slotGranularity;
      const hour = startHour + Math.floor(slotMinutes / 60);
      const minute = slotMinutes % 60;
      const showLabel = minute === 0;

      const lines: JSX.Element[] = [];
      for (let line = 0; line < height; line++) {
        lines.push(
          <Text key={line} color="gray">
            {line === 0 && showLabel
              ? `${formatHour(hour)}${getAmPm(hour)}`.padStart(timeColumnWidth - 1)
              : " ".repeat(timeColumnWidth - 1)}
          </Text>
        );
      }
      slots.push(
        <Box key={slotIndex} flexDirection="column" height={height}>
          {lines}
        </Box>
      );
    }
    return slots;
  };

  // Render day column
  const renderDayColumn = (dayIndex: number) => {
    const day = weekDays[dayIndex];
    const slots: JSX.Element[] = [];

    for (let slotIndex = 0; slotIndex < totalSlots; slotIndex++) {
      const height = slotHeights[slotIndex];
      const key = `${dayIndex}-${slotIndex}`;
      const busyColors = busyMap.get(key) || [];
      const isBusy = busyColors.length > 0;
      const isHovered =
        hoveredSlot?.dayIndex === dayIndex && hoveredSlot?.slotIndex === slotIndex;
      const isSelected =
        selectedSlot?.dayIndex === dayIndex && selectedSlot?.slotIndex === slotIndex;
      const isCursor = cursorDay === dayIndex && cursorSlot === slotIndex;
      const isFree = !isBusy;

      const lines: JSX.Element[] = [];
      for (let line = 0; line < height; line++) {
        let content = " ".repeat(columnWidth - 1);
        let bgColor: string | undefined;
        let textColor = "gray";

        if (isSelected) {
          bgColor = "green";
          textColor = "black";
          if (countdown !== null && countdown > 0) {
            // Counting down
            const spin = spinnerChars[spinnerFrame];
            if (line === 0) {
              content = (" " + spin + " " + countdown + "...").padEnd(columnWidth - 1);
            } else if (line === 1 && height > 1) {
              content = " esc cancel".padEnd(columnWidth - 1);
            }
          } else if (countdown === 0 || countdown === -1) {
            // Confirmed - show checkmark
            if (line === 0) content = " * confirmed".padEnd(columnWidth - 1);
          } else {
            if (line === 0) content = " ok".padEnd(columnWidth - 1);
          }
        } else if (isCursor && isFree && usingKeyboard) {
          bgColor = "blue";
          textColor = "white";
          if (line === 0) content = " return".padEnd(columnWidth - 1);
        } else if (isCursor && isBusy && usingKeyboard) {
          bgColor = busyColors[0];
          textColor = "white";
          if (line === 0) content = " busy".padEnd(columnWidth - 1);
        } else if (isBusy) {
          bgColor = busyColors[0];
          textColor = TEXT_COLORS[bgColor] || "white";
          if (line === 0) {
            const names = calendars
              .filter((c) => busyColors.includes(c.color))
              .map((c) => c.name)
              .join(", ");
            content = (" " + names).slice(0, columnWidth - 1).padEnd(columnWidth - 1);
          }
        } else if (isHovered && isFree && !usingKeyboard && countdown === null) {
          // Mouse hover - only show when not in countdown
          bgColor = "white";
          textColor = "black";
        } else {
          // Free slot
          const slotMinutes = slotIndex * slotGranularity;
          const minute = slotMinutes % 60;
          if (line === 0) {
            content = minute === 0 ? "─".repeat(columnWidth - 1) : "┄".repeat(columnWidth - 1);
          }
        }

        lines.push(
          <Text
            key={line}
            backgroundColor={bgColor}
            color={textColor}
            dimColor={!isBusy && !isHovered && !isSelected}
          >
            {content}
          </Text>
        );
      }

      slots.push(
        <Box key={slotIndex} flexDirection="column" height={height}>
          {lines}
        </Box>
      );
    }

    return <Box key={dayIndex} flexDirection="column" width={columnWidth}>{slots}</Box>;
  };

  // Render legend
  const renderLegend = () => {
    return (
      <Box>
        {calendars.map((calendar, i) => (
          <Box key={i} marginRight={2}>
            <Text backgroundColor={calendar.color} color={TEXT_COLORS[calendar.color] || "white"}>
              {` ${calendar.name} `}
            </Text>
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight} paddingX={1}>
      {/* Title bar */}
      <Box marginBottom={1}>
        <Text bold color="white">
          {formatMonthYear(weekDays[0])} - Select a meeting time
        </Text>
      </Box>

      {/* Legend */}
      {renderLegend()}

      {/* Day headers row */}
      <Box>
        <Box width={timeColumnWidth}>
          <Text> </Text>
        </Box>
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today);
          return (
            <Box key={i} width={columnWidth} flexDirection="column">
              <Box justifyContent="center" width="100%">
                <Text color={isToday ? "blue" : "gray"}>{formatDayName(day)}</Text>
              </Box>
              <Box justifyContent="center" width="100%">
                {isToday ? (
                  <Text backgroundColor="blue" color="white" bold>
                    {` ${formatDayNumber(day)} `}
                  </Text>
                ) : (
                  <Text bold>{formatDayNumber(day)}</Text>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Calendar time grid */}
      <Box flexGrow={1}>
        <Box flexDirection="column" width={timeColumnWidth}>
          {renderTimeColumn()}
        </Box>
        {weekDays.map((_, dayIndex) => renderDayColumn(dayIndex))}
      </Box>

      {/* Help bar */}
      <Box flexDirection="column">
        {countdown !== null && selectedSlot ? (
          <Text color="gray">Esc to cancel</Text>
        ) : (
          <>
            <Text color="gray">{"↑↓←→/scroll move • Space/Enter select • n/p/Shift+scroll week • t today • q cancel"}</Text>
            {(() => {
              const cursorInfo = getCursorSlotInfo();
              if (cursorInfo) {
                const free = isSlotFree(cursorInfo.dayIndex, cursorInfo.slotIndex);
                return (
                  <Text color={free ? "cyan" : "gray"}>
                    {cursorInfo.startTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    {" - "}
                    {cursorInfo.endTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    {" "}
                    {cursorInfo.day.toLocaleDateString([], { weekday: "short" })}
                    {free ? "" : " (busy)"}
                  </Text>
                );
              }
              return null;
            })()}
          </>
        )}
      </Box>
    </Box>
  );
}
