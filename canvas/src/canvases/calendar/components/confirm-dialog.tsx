// Confirm Dialog Component - Yes/No confirmation

import React, { useState } from "react";
import { Box, Text } from "ink";
import { useSafeInput } from "../../../utils/use-safe-input";
import { ModalOverlay } from "./modal-overlay";

interface ConfirmDialogProps {
  title: string;
  message: string;
  itemName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmKey?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  itemName,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  confirmKey = "d",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [focused, setFocused] = useState<"confirm" | "cancel">("cancel");

  useSafeInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.leftArrow || key.rightArrow || key.tab) {
      setFocused(focused === "confirm" ? "cancel" : "confirm");
      return;
    }

    if (key.return) {
      if (focused === "confirm") {
        onConfirm();
      } else {
        onCancel();
      }
      return;
    }

    // Direct key shortcut for confirm
    if (input.toLowerCase() === confirmKey.toLowerCase()) {
      onConfirm();
    }
  });

  return (
    <ModalOverlay
      title={title}
      width={40}
      footer={
        <Box>
          <Text
            color={focused === "confirm" ? "black" : "red"}
            backgroundColor={focused === "confirm" ? "red" : undefined}
            bold
          >
            {` [${confirmLabel}] `}
          </Text>
          <Text>  </Text>
          <Text
            color={focused === "cancel" ? "black" : "gray"}
            backgroundColor={focused === "cancel" ? "white" : undefined}
          >
            {` [${cancelLabel}] `}
          </Text>
          <Text color="gray">   {confirmKey}/Esc</Text>
        </Box>
      }
    >
      <Box flexDirection="column">
        <Text>{message}</Text>
        {itemName && (
          <Box marginTop={1}>
            <Text color="cyan" bold>
              "{itemName}"
            </Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text color="gray">This action cannot be undone.</Text>
        </Box>
      </Box>
    </ModalOverlay>
  );
}
