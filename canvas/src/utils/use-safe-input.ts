// Safe Input Hook - Wraps Ink's useInput to handle non-TTY environments gracefully

import { useInput, type Key } from "ink";

type Handler = (input: string, key: Key) => void;

interface Options {
  isActive?: boolean;
}

/**
 * A safe wrapper around Ink's useInput that handles non-TTY environments.
 * When stdin is not a TTY (e.g., when running in non-interactive mode),
 * the input handler is disabled to prevent "Raw mode is not supported" errors.
 */
export function useSafeInput(inputHandler: Handler, options: Options = {}): void {
  // Check if stdin is a TTY - if not, disable input handling
  const isTTY = process.stdin.isTTY ?? false;
  const isActive = options.isActive !== false && isTTY;

  useInput(inputHandler, { isActive });
}
