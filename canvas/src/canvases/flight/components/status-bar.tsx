// Status Bar Component - Bottom help text and status

import React from "react";
import { Box, Text } from "ink";
import { type FocusMode, CYBER_COLORS } from "../types";

interface Props {
  focusMode: FocusMode;
  hasSeatmap: boolean;
  selectedSeat: string | null;
  countdown: number | null;
  spinnerFrame: number;
  spinnerChars: string[];
  width: number;
}

export function StatusBar({
  focusMode,
  hasSeatmap,
  selectedSeat,
  countdown,
  spinnerFrame,
  spinnerChars,
  width,
}: Props) {
  const border = "=".repeat(width - 2);

  // Build help text based on current state
  let helpText: string;
  let statusText: string = "";

  if (countdown !== null) {
    if (countdown === 0) {
      helpText = "CONFIRMED";
      statusText = "* Booking confirmed!";
    } else if (countdown === -1) {
      helpText = "CONFIRMED";
      statusText = "Exiting...";
    } else {
      const spinner = spinnerChars[spinnerFrame];
      helpText = `${spinner} Confirming in ${countdown}... Press ESC to cancel`;
      statusText = "";
    }
  } else if (focusMode === "flights") {
    helpText = "^v/scroll navigate";
    if (hasSeatmap) {
      helpText += " | Tab seatmap";
    }
    helpText += " | Enter select | q quit";
  } else {
    helpText = "arrows/scroll navigate | Space select seat | Tab flights | Enter confirm | q quit";
    if (selectedSeat) {
      statusText = `Selected: ${selectedSeat}`;
    }
  }

  return (
    <Box flexDirection="column">
      <Text color={CYBER_COLORS.neonMagenta}>{border}</Text>
      <Box justifyContent="space-between" width={width - 2}>
        <Text color={CYBER_COLORS.dim}>{helpText}</Text>
        <Text color={CYBER_COLORS.neonGreen}>{statusText}</Text>
      </Box>
    </Box>
  );
}
