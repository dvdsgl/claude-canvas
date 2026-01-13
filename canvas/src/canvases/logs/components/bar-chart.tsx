// Bar Chart - Horizontal bar chart for top items

import React from "react";
import { Box, Text } from "ink";
import { LOGS_COLORS } from "../types";

interface Props {
  items: Array<{ name: string; count: number }>;
  maxWidth?: number;
  maxItems?: number;
  title?: string;
}

export function BarChart({ items, maxWidth = 40, maxItems = 10, title }: Props) {
  const displayItems = items.slice(0, maxItems);
  const maxCount = Math.max(...displayItems.map((i) => i.count), 1);
  const maxNameLen = Math.max(...displayItems.map((i) => i.name.length), 10);
  const barMaxWidth = maxWidth - maxNameLen - 10;

  return (
    <Box flexDirection="column">
      {title && (
        <Text color={LOGS_COLORS.secondary} bold>
          {title}
        </Text>
      )}
      {displayItems.map((item, index) => {
        const barWidth = Math.max(1, Math.floor((item.count / maxCount) * barMaxWidth));
        const bar = "\u2588".repeat(barWidth);
        const paddedName = item.name.padEnd(maxNameLen);

        return (
          <Box key={item.name}>
            <Text color={LOGS_COLORS.muted}>{paddedName} </Text>
            <Text color={index === 0 ? LOGS_COLORS.primary : LOGS_COLORS.success}>
              {bar}
            </Text>
            <Text color={LOGS_COLORS.muted}> {item.count}</Text>
          </Box>
        );
      })}
      {displayItems.length === 0 && (
        <Text color={LOGS_COLORS.muted}>No data</Text>
      )}
    </Box>
  );
}
