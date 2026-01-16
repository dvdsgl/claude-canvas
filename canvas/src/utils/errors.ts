// Standardized error utilities for Canvas
// Provides consistent error message formatting across the codebase

/**
 * Error category for consistent prefixing
 */
export type ErrorCategory =
  | "config"
  | "connection"
  | "ipc"
  | "session"
  | "terminal"
  | "validation"
  | "canvas";

/**
 * Format an error message with consistent structure
 * Format: "[Canvas:<category>] <message>"
 */
export function formatError(category: ErrorCategory, message: string): string {
  return `[Canvas:${category}] ${message}`;
}

/**
 * Create an Error with formatted message
 */
export function createError(category: ErrorCategory, message: string): Error {
  return new Error(formatError(category, message));
}

/**
 * Extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Format a "failed to" error with context
 */
export function failedTo(
  category: ErrorCategory,
  action: string,
  context?: string,
  cause?: unknown
): string {
  let message = `Failed to ${action}`;
  if (context) {
    message += ` (${context})`;
  }
  if (cause !== undefined) {
    message += `: ${getErrorMessage(cause)}`;
  }
  return formatError(category, message);
}

/**
 * Format a "not found" error
 */
export function notFound(
  category: ErrorCategory,
  resource: string,
  identifier?: string
): string {
  let message = `${resource} not found`;
  if (identifier) {
    message += `: ${identifier}`;
  }
  return formatError(category, message);
}

/**
 * Format an "invalid" error
 */
export function invalid(
  category: ErrorCategory,
  item: string,
  reason?: string
): string {
  let message = `Invalid ${item}`;
  if (reason) {
    message += `: ${reason}`;
  }
  return formatError(category, message);
}

/**
 * Format a timeout error
 */
export function timeout(
  category: ErrorCategory,
  operation: string,
  durationMs: number
): string {
  const seconds = Math.round(durationMs / 1000);
  return formatError(
    category,
    `${operation} timed out after ${seconds} seconds`
  );
}

/**
 * Format a connection error
 */
export function connectionError(
  target: string,
  cause?: unknown
): string {
  let message = `Failed to connect to ${target}`;
  if (cause !== undefined) {
    message += `: ${getErrorMessage(cause)}`;
  }
  return formatError("connection", message);
}

/**
 * Log an error with consistent formatting
 */
export function logError(
  category: ErrorCategory,
  message: string,
  error?: unknown
): void {
  if (error !== undefined) {
    console.error(formatError(category, message), getErrorMessage(error));
  } else {
    console.error(formatError(category, message));
  }
}

/**
 * Log a warning with consistent formatting
 */
export function logWarning(
  category: ErrorCategory,
  message: string
): void {
  console.error(formatError(category, `Warning: ${message}`));
}
