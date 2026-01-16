// Modal Overlay Component - Base modal with dimmed background

import React from "react";
import { Box, Text, useStdout } from "ink";

interface ModalOverlayProps {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}

export function ModalOverlay({
  title,
  children,
  footer,
  width = 42,
}: ModalOverlayProps) {
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows || 24;
  const terminalWidth = stdout?.columns || 80;

  // Calculate centering
  const horizontalPadding = Math.max(0, Math.floor((terminalWidth - width) / 2));

  return (
    <Box
      flexDirection="column"
      width={terminalWidth}
      height={terminalHeight}
    >
      {/* Dimmed background - top portion */}
      <Box flexGrow={1} />

      {/* Modal box */}
      <Box flexDirection="column" paddingLeft={horizontalPadding}>
        <Box flexDirection="column" width={width}>
          {/* Title bar */}
          <Box borderStyle="round" borderColor="cyan" paddingX={1}>
            <Text color="cyan" bold>
              {title}
            </Text>
          </Box>

          {/* Content */}
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="gray"
            borderTop={false}
            paddingX={1}
            paddingY={1}
          >
            {children}
          </Box>

          {/* Footer */}
          {footer && (
            <Box
              borderStyle="round"
              borderColor="gray"
              borderTop={false}
              paddingX={1}
              justifyContent="space-between"
            >
              {footer}
            </Box>
          )}
        </Box>
      </Box>

      {/* Dimmed background - bottom portion */}
      <Box flexGrow={1} />
    </Box>
  );
}
