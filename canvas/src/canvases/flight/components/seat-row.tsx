// Seat Row Component - Single row of seats

import React from "react";
import { Box, Text } from "ink";
import { type Seatmap, CYBER_COLORS, buildSeat } from "../types";

interface Props {
  row: number;
  seatmap: Seatmap;
  selectedSeat: string | null;
  cursorCol: number; // -1 if cursor not on this row
  focused: boolean;
}

export function SeatRow({ row, seatmap, selectedSeat, cursorCol, focused }: Props) {
  const parts: React.JSX.Element[] = [];

  // Row number
  parts.push(
    <Text key="rownum" color={CYBER_COLORS.dim}>
      {String(row).padStart(2, " ")}
    </Text>
  );

  for (let col = 0; col < seatmap.seatsPerRow.length; col++) {
    const letter = seatmap.seatsPerRow[col];
    const seat = buildSeat(row, letter);
    const isAisle = seatmap.aisleAfter.includes(letter);

    // Determine seat status
    const isSelected = selectedSeat === seat;
    const isOccupied = seatmap.occupied.includes(seat);
    const isUnavailable = seatmap.unavailable.includes(seat);
    const isPremium = seatmap.premium.includes(seat);
    const isCursor = focused && cursorCol === col;

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

    // Add aisle space
    if (isAisle) {
      parts.push(
        <Text key={`aisle-${seat}`} color={CYBER_COLORS.dim}>
          {"   "}
        </Text>
      );
    }
  }

  return <Box>{parts}</Box>;
}
