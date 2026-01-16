// Time Picker Component - HH:MM time selection

import React, { useState } from "react";
import { Box, Text } from "ink";
import { useSafeInput } from "../../../utils/use-safe-input";

interface TimePickerProps {
  value: string; // "HH:MM" format
  onChange: (value: string) => void;
  focused?: boolean;
  label?: string;
}

export function TimePicker({
  value,
  onChange,
  focused = false,
  label,
}: TimePickerProps) {
  // Parse current value
  const [hours, minutes] = value.split(":").map((v) => parseInt(v, 10) || 0);

  // Track which part is being edited (0 = hours, 1 = minutes)
  const [editPart, setEditPart] = useState(0);

  useSafeInput(
    (input, key) => {
      if (!focused) return;

      if (key.leftArrow) {
        setEditPart(0);
      } else if (key.rightArrow) {
        setEditPart(1);
      } else if (key.upArrow) {
        if (editPart === 0) {
          // Increment hours
          const newHours = (hours + 1) % 24;
          onChange(`${newHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`);
        } else {
          // Increment minutes by 15
          const newMinutes = (minutes + 15) % 60;
          onChange(`${hours.toString().padStart(2, "0")}:${newMinutes.toString().padStart(2, "0")}`);
        }
      } else if (key.downArrow) {
        if (editPart === 0) {
          // Decrement hours
          const newHours = (hours - 1 + 24) % 24;
          onChange(`${newHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`);
        } else {
          // Decrement minutes by 15
          const newMinutes = (minutes - 15 + 60) % 60;
          onChange(`${hours.toString().padStart(2, "0")}:${newMinutes.toString().padStart(2, "0")}`);
        }
      } else if (/^[0-9]$/.test(input)) {
        // Direct numeric input
        const digit = parseInt(input, 10);
        if (editPart === 0) {
          // Hours: if current is 0-1, allow two-digit entry
          let newHours: number;
          if (hours < 3) {
            newHours = hours * 10 + digit;
            if (newHours > 23) newHours = digit;
          } else {
            newHours = digit;
          }
          onChange(`${newHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`);
          if (newHours > 2) setEditPart(1);
        } else {
          // Minutes
          let newMinutes: number;
          if (minutes < 6) {
            newMinutes = minutes * 10 + digit;
            if (newMinutes > 59) newMinutes = digit;
          } else {
            newMinutes = digit;
          }
          onChange(`${hours.toString().padStart(2, "0")}:${newMinutes.toString().padStart(2, "0")}`);
        }
      }
    },
    { isActive: focused }
  );

  const hoursStr = hours.toString().padStart(2, "0");
  const minutesStr = minutes.toString().padStart(2, "0");

  return (
    <Box>
      {label && <Text color="gray">{label.padEnd(10)}</Text>}
      <Text color={focused ? "white" : "gray"}>[</Text>
      <Text inverse={focused && editPart === 0} color={focused ? "cyan" : "white"}>
        {hoursStr}
      </Text>
      <Text color={focused ? "white" : "gray"}>:</Text>
      <Text inverse={focused && editPart === 1} color={focused ? "cyan" : "white"}>
        {minutesStr}
      </Text>
      <Text color={focused ? "white" : "gray"}>{"           ]"}</Text>
      {focused && (
        <Text color="gray"> ↑↓</Text>
      )}
    </Box>
  );
}
