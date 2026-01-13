// Heat Map - Activity grid by hour and day

import React from "react";
import { Box, Text } from "ink";
import { type HeatMapCell, LOGS_COLORS } from "../types";

interface Props {
  cells: HeatMapCell[];
  width?: number;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const INTENSITY_CHARS = [" ", "\u2591", "\u2592", "\u2593", "\u2588"];

export function HeatMap({ cells, width = 60 }: Props) {
  // Group cells by day
  const grid: HeatMapCell[][] = [];
  for (let day = 0; day < 7; day++) {
    grid[day] = cells.filter((c) => c.day === day).sort((a, b) => a.hour - b.hour);
  }

  return (
    <Box flexDirection="column">
      <Text color={LOGS_COLORS.secondary} bold>
        Activity Heat Map (Hour x Day)
      </Text>

      {/* Hour labels */}
      <Box>
        <Text color={LOGS_COLORS.muted}>{"    "}</Text>
        {[0, 6, 12, 18, 23].map((h) => (
          <Text key={h} color={LOGS_COLORS.muted}>
            {h.toString().padStart(2)}
            {"  "}
          </Text>
        ))}
      </Box>

      {/* Grid rows */}
      {grid.map((row, dayIndex) => (
        <Box key={dayIndex}>
          <Text color={LOGS_COLORS.muted}>{DAYS[dayIndex]} </Text>
          {row.map((cell) => (
            <Text
              key={cell.hour}
              color={LOGS_COLORS.heatmap[cell.intensity]}
            >
              {INTENSITY_CHARS[cell.intensity]}
            </Text>
          ))}
        </Box>
      ))}

      {/* Legend */}
      <Box marginTop={1}>
        <Text color={LOGS_COLORS.muted}>Less </Text>
        {INTENSITY_CHARS.map((char, i) => (
          <Text key={`legend-${i}`} color={LOGS_COLORS.heatmap[i]}>
            {char}
          </Text>
        ))}
        <Text color={LOGS_COLORS.muted}> More</Text>
      </Box>
    </Box>
  );
}
