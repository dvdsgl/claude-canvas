// Seatmap Panel Component - Interactive seat selection grid (horizontal plane layout)

import React from "react";
import { Box, Text } from "ink";
import { type Seatmap, CYBER_COLORS, buildSeat } from "../types";

interface Props {
  seatmap: Seatmap;
  selectedSeat: string | null;
  cursorRow: number;
  cursorCol: number;
  focused: boolean;
  maxHeight: number;
  maxWidth: number;
}

export function SeatmapPanel({
  seatmap,
  selectedSeat,
  cursorRow,
  cursorCol,
  focused,
  maxHeight,
  maxWidth,
}: Props) {
  // Calculate visible columns (rows in airplane terms) based on width
  // Each seat cell is 3 chars wide "[X]", row numbers are 3 chars " 1 "
  const seatWidth = 3;
  const labelWidth = 2; // "A " etc
  const availableWidth = maxWidth - labelWidth;
  const visibleCols = Math.max(1, Math.floor(availableWidth / seatWidth));

  // Scroll to keep cursor visible (cursorRow is the airplane row number 1-based)
  let startCol = 1;
  if (cursorRow > visibleCols) {
    startCol = cursorRow - visibleCols + 1;
  }
  const endCol = Math.min(startCol + visibleCols - 1, seatmap.rows);

  // Render row number header (airplane rows across top) with nose indicator
  const renderHeader = () => {
    const parts: React.JSX.Element[] = [];
    // Nose indicator and spacer
    parts.push(
      <Text key="nose" color={CYBER_COLORS.neonMagenta}>
        {"◀ "}
      </Text>
    );

    for (let row = startCol; row <= endCol; row++) {
      parts.push(
        <Text key={`row-${row}`} color={CYBER_COLORS.dim}>
          {String(row).padStart(2, " ")}{" "}
        </Text>
      );
    }

    return <Box>{parts}</Box>;
  };

  // Render a single seat letter row (shows all airplane rows for one seat letter)
  const renderSeatLetterRow = (letterIndex: number) => {
    const letter = seatmap.seatsPerRow[letterIndex];
    const isWindowSeat = letterIndex === 0 || letterIndex === seatmap.seatsPerRow.length - 1;
    const parts: React.JSX.Element[] = [];

    // Seat letter label with window indicator
    parts.push(
      <Text key="letter" color={isWindowSeat ? CYBER_COLORS.neonYellow : CYBER_COLORS.dim}>
        {letter}{" "}
      </Text>
    );

    // Render each airplane row's seat for this letter
    for (let row = startCol; row <= endCol; row++) {
      const seat = buildSeat(row, letter);

      // Determine seat status
      const isSelected = selectedSeat === seat;
      const isOccupied = seatmap.occupied.includes(seat);
      const isUnavailable = seatmap.unavailable.includes(seat);
      const isPremium = seatmap.premium.includes(seat);
      const isCursor = focused && cursorRow === row && cursorCol === letterIndex;

      // Determine display
      let char = "-";
      let color: string = CYBER_COLORS.neonCyan;
      let bgColor: string | undefined;

      if (isSelected) {
        char = "*";
        color = "black";
        bgColor = CYBER_COLORS.neonGreen;
      } else if (isOccupied || isUnavailable) {
        char = "X";
        color = CYBER_COLORS.neonRed;
      } else if (isPremium) {
        char = "+";
        color = CYBER_COLORS.neonYellow;
      }

      // Cursor highlight
      if (isCursor && !isSelected) {
        bgColor = CYBER_COLORS.neonCyan;
        color = "black";
      }

      parts.push(
        <Text key={seat} backgroundColor={bgColor} color={color}>
          [{char}]
        </Text>
      );
    }

    return <Box key={letter}>{parts}</Box>;
  };

  // Build all seat letter rows, inserting aisle where needed
  const seatRows: React.JSX.Element[] = [];
  for (let i = 0; i < seatmap.seatsPerRow.length; i++) {
    const letter = seatmap.seatsPerRow[i];
    seatRows.push(renderSeatLetterRow(i));

    // Add aisle after this letter if specified
    if (seatmap.aisleAfter.includes(letter)) {
      seatRows.push(
        <Box key={`aisle-${letter}`}>
          <Text color={CYBER_COLORS.dim}>
            {"  "}
          </Text>
        </Box>
      );
    }
  }

  return (
    <Box flexDirection="column">
      {/* Row number headers */}
      {renderHeader()}

      {/* Seat grid */}
      {seatRows}

      {/* Scroll indicator if needed */}
      {seatmap.rows > visibleCols && (
        <Box marginTop={0}>
          <Text color={CYBER_COLORS.dim}>
            {"  "}
            {startCol > 1 ? "< " : "  "}Row {cursorRow}/{seatmap.rows}
            {endCol < seatmap.rows ? " >" : ""}
          </Text>
        </Box>
      )}

      {/* Legend */}
      <Box marginTop={1}>
        <Text color={CYBER_COLORS.neonCyan}>[-]</Text>
        <Text color={CYBER_COLORS.dim}> avail </Text>
        <Text color={CYBER_COLORS.neonYellow}>[+]</Text>
        <Text color={CYBER_COLORS.dim}> premium </Text>
        <Text color={CYBER_COLORS.neonRed}>[X]</Text>
        <Text color={CYBER_COLORS.dim}> taken </Text>
        <Text color={CYBER_COLORS.neonGreen}>[*]</Text>
        <Text color={CYBER_COLORS.dim}> selected</Text>
      </Box>
    </Box>
  );
}
