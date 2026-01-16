// Color Picker Component - Cycle through color options

import React from "react";
import { Box, Text } from "ink";
import { useSafeInput } from "../../../utils/use-safe-input";
import { EVENT_COLORS } from "../types";

// Available colors
const COLORS = Object.keys(EVENT_COLORS) as Array<keyof typeof EVENT_COLORS>;

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  focused?: boolean;
  label?: string;
}

export function ColorPicker({
  value,
  onChange,
  focused = false,
  label,
}: ColorPickerProps) {
  const currentIndex = COLORS.indexOf(value as keyof typeof EVENT_COLORS);
  const validIndex = currentIndex === -1 ? 0 : currentIndex;

  useSafeInput(
    (input, key) => {
      if (!focused) return;

      if (key.leftArrow) {
        const newIndex = (validIndex - 1 + COLORS.length) % COLORS.length;
        onChange(COLORS[newIndex]);
      } else if (key.rightArrow) {
        const newIndex = (validIndex + 1) % COLORS.length;
        onChange(COLORS[newIndex]);
      }
    },
    { isActive: focused }
  );

  const colorName = COLORS[validIndex];
  const inkColor = EVENT_COLORS[colorName];

  return (
    <Box>
      {label && <Text color="gray">{label.padEnd(10)}</Text>}
      <Text color={focused ? "white" : "gray"}>[</Text>
      <Text color={inkColor}>■ </Text>
      <Text color={focused ? "cyan" : "white"}>
        {colorName.padEnd(10)}
      </Text>
      <Text color={focused ? "white" : "gray"}>]</Text>
      {focused && (
        <Text color="gray"> ←→</Text>
      )}
    </Box>
  );
}
