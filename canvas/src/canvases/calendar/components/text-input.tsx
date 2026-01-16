// Text Input Component - Terminal text input field

import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { useSafeInput } from "../../../utils/use-safe-input";

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  focused?: boolean;
  width?: number;
  label?: string;
}

export function TextInput({
  value,
  onChange,
  placeholder = "",
  focused = false,
  width = 24,
  label,
}: TextInputProps) {
  const [cursorPosition, setCursorPosition] = useState(value.length);

  // Keep cursor at end when value changes externally
  useEffect(() => {
    setCursorPosition(value.length);
  }, [value]);

  useSafeInput(
    (input, key) => {
      if (!focused) return;

      if (key.backspace || key.delete) {
        if (cursorPosition > 0) {
          const newValue =
            value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
          onChange(newValue);
          setCursorPosition(cursorPosition - 1);
        }
      } else if (key.leftArrow) {
        setCursorPosition(Math.max(0, cursorPosition - 1));
      } else if (key.rightArrow) {
        setCursorPosition(Math.min(value.length, cursorPosition + 1));
      } else if (key.ctrl && input === "a") {
        // Select all / go to start
        setCursorPosition(0);
      } else if (key.ctrl && input === "e") {
        // Go to end
        setCursorPosition(value.length);
      } else if (!key.ctrl && !key.meta && input && input.length === 1) {
        // Regular character input
        const newValue =
          value.slice(0, cursorPosition) + input + value.slice(cursorPosition);
        onChange(newValue);
        setCursorPosition(cursorPosition + 1);
      }
    },
    { isActive: focused }
  );

  // Build the display string with cursor
  const displayValue = value || (focused ? "" : placeholder);
  const paddedValue = displayValue.padEnd(width);
  const visibleValue = paddedValue.slice(0, width);

  // Insert cursor character at position
  let displayWithCursor = visibleValue;
  if (focused) {
    const beforeCursor = visibleValue.slice(0, cursorPosition);
    const cursorChar = visibleValue[cursorPosition] || " ";
    const afterCursor = visibleValue.slice(cursorPosition + 1);
    displayWithCursor = beforeCursor + cursorChar + afterCursor;
  }

  return (
    <Box>
      {label && (
        <Text color="gray">{label.padEnd(10)}</Text>
      )}
      <Text color={focused ? "white" : "gray"}>
        [
      </Text>
      {focused ? (
        <>
          <Text>{value.slice(0, cursorPosition)}</Text>
          <Text inverse>{value[cursorPosition] || " "}</Text>
          <Text>{value.slice(cursorPosition + 1).padEnd(width - value.length)}</Text>
        </>
      ) : (
        <Text color={value ? "white" : "gray"}>
          {(value || placeholder).slice(0, width).padEnd(width)}
        </Text>
      )}
      <Text color={focused ? "white" : "gray"}>
        ]
      </Text>
    </Box>
  );
}
