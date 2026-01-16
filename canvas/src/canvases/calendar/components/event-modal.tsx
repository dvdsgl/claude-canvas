// Event Modal Component - Create/edit event form

import React, { useState } from "react";
import { Box, Text } from "ink";
import { useSafeInput } from "../../../utils/use-safe-input";
import { ModalOverlay } from "./modal-overlay";
import { TextInput } from "./text-input";
import { TimePicker } from "./time-picker";
import { ColorPicker } from "./color-picker";
import type { CalendarEvent } from "../types";

interface EventModalProps {
  mode: "create" | "edit";
  event?: CalendarEvent;
  defaultDate?: Date;
  defaultStartTime?: string; // "HH:MM"
  onSave: (event: Omit<CalendarEvent, "id"> | CalendarEvent) => void;
  onCancel: () => void;
}

type Field = "title" | "date" | "startTime" | "endTime" | "color" | "allDay" | "save" | "cancel";

const FIELDS: Field[] = ["title", "date", "startTime", "endTime", "color", "allDay", "save", "cancel"];

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  if (isNaN(date.getTime())) return null;
  return date;
}

function formatTimeInput(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function EventModal({
  mode,
  event,
  defaultDate,
  defaultStartTime = "09:00",
  onSave,
  onCancel,
}: EventModalProps) {
  // Initialize form state
  const now = defaultDate || new Date();
  const initialStartTime = event ? formatTimeInput(event.startTime) : defaultStartTime;
  const initialEndTime = event
    ? formatTimeInput(event.endTime)
    : (() => {
        const [h, m] = defaultStartTime.split(":").map(Number);
        return `${((h + 1) % 24).toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      })();

  const [title, setTitle] = useState(event?.title || "");
  const [dateStr, setDateStr] = useState(
    event ? formatDateInput(event.startTime) : formatDateInput(now)
  );
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [color, setColor] = useState(event?.color || "blue");
  const [allDay, setAllDay] = useState(event?.allDay || false);
  const [focusedField, setFocusedField] = useState<Field>("title");

  useSafeInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.tab) {
      const currentIndex = FIELDS.indexOf(focusedField);
      if (key.shift) {
        // Shift+Tab: previous field
        const prevIndex = (currentIndex - 1 + FIELDS.length) % FIELDS.length;
        setFocusedField(FIELDS[prevIndex]);
      } else {
        // Tab: next field
        const nextIndex = (currentIndex + 1) % FIELDS.length;
        setFocusedField(FIELDS[nextIndex]);
      }
      return;
    }

    if (key.return) {
      if (focusedField === "cancel") {
        onCancel();
        return;
      }

      if (focusedField === "save" || focusedField === "allDay") {
        // Save the event
        const parsedDate = parseDateInput(dateStr);
        if (!parsedDate || !title.trim()) {
          // Validation failed - could show error
          return;
        }

        const [startH, startM] = startTime.split(":").map(Number);
        const [endH, endM] = endTime.split(":").map(Number);

        const eventStartTime = new Date(parsedDate);
        eventStartTime.setHours(startH, startM, 0, 0);

        const eventEndTime = new Date(parsedDate);
        eventEndTime.setHours(endH, endM, 0, 0);

        // If end time is before start time, assume next day
        if (eventEndTime <= eventStartTime) {
          eventEndTime.setDate(eventEndTime.getDate() + 1);
        }

        const newEvent: Omit<CalendarEvent, "id"> | CalendarEvent = {
          ...(event?.id ? { id: event.id } : {}),
          title: title.trim(),
          startTime: eventStartTime,
          endTime: eventEndTime,
          color,
          allDay,
        };

        onSave(newEvent as CalendarEvent);
        return;
      }
    }

    // Space toggles allDay
    if (input === " " && focusedField === "allDay") {
      setAllDay(!allDay);
    }
  });

  const title_text = mode === "create" ? "Create Event" : "Edit Event";

  return (
    <ModalOverlay
      title={title_text}
      footer={
        <Box>
          <Text
            color={focusedField === "save" ? "black" : "cyan"}
            backgroundColor={focusedField === "save" ? "cyan" : undefined}
          >
            {" [Save] "}
          </Text>
          <Text>  </Text>
          <Text
            color={focusedField === "cancel" ? "black" : "gray"}
            backgroundColor={focusedField === "cancel" ? "white" : undefined}
          >
            {" [Cancel] "}
          </Text>
          <Text color="gray">   Tab/Enter/Esc</Text>
        </Box>
      }
    >
      <Box flexDirection="column">
        <TextInput
          label="Title:"
          value={title}
          onChange={setTitle}
          focused={focusedField === "title"}
          width={20}
          placeholder="Event name"
        />

        <Box marginTop={1}>
          <TextInput
            label="Date:"
            value={dateStr}
            onChange={setDateStr}
            focused={focusedField === "date"}
            width={20}
            placeholder="YYYY-MM-DD"
          />
        </Box>

        <Box marginTop={1}>
          <TimePicker
            label="Start:"
            value={startTime}
            onChange={setStartTime}
            focused={focusedField === "startTime"}
          />
        </Box>

        <Box marginTop={1}>
          <TimePicker
            label="End:"
            value={endTime}
            onChange={setEndTime}
            focused={focusedField === "endTime"}
          />
        </Box>

        <Box marginTop={1}>
          <ColorPicker
            label="Color:"
            value={color}
            onChange={setColor}
            focused={focusedField === "color"}
          />
        </Box>

        <Box marginTop={1}>
          <Text color="gray">{"All Day:  ".padEnd(10)}</Text>
          <Text
            color={focusedField === "allDay" ? "cyan" : "white"}
            inverse={focusedField === "allDay"}
          >
            [{allDay ? "x" : " "}]
          </Text>
          {focusedField === "allDay" && (
            <Text color="gray"> Space to toggle</Text>
          )}
        </Box>
      </Box>
    </ModalOverlay>
  );
}
