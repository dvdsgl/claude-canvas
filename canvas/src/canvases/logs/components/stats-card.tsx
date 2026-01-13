// Stats Card - Single metric display

import React from "react";
import { Box, Text } from "ink";
import { LOGS_COLORS } from "../types";

interface Props {
  label: string;
  value: number | string;
  color?: string;
  width?: number;
}

export function StatsCard({ label, value, color = LOGS_COLORS.primary, width = 20 }: Props) {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={LOGS_COLORS.muted}
      paddingX={1}
      width={width}
    >
      <Text color={LOGS_COLORS.muted}>{label}</Text>
      <Text color={color} bold>
        {typeof value === "number" ? value.toLocaleString() : value}
      </Text>
    </Box>
  );
}
