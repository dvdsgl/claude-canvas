import { test, expect, describe, spyOn, beforeEach, afterEach } from "bun:test";
import {
  formatError,
  createError,
  getErrorMessage,
  failedTo,
  notFound,
  invalid,
  timeout,
  connectionError,
  logError,
  logWarning,
  type ErrorCategory,
} from "./errors";

// ============================================
// formatError Tests
// ============================================

describe("formatError", () => {
  test("formats error with category prefix", () => {
    const result = formatError("config", "Something went wrong");
    expect(result).toBe("[Canvas:config] Something went wrong");
  });

  test("works with all error categories", () => {
    const categories: ErrorCategory[] = [
      "config",
      "connection",
      "ipc",
      "session",
      "terminal",
      "validation",
      "canvas",
    ];

    for (const category of categories) {
      const result = formatError(category, "test message");
      expect(result).toBe(`[Canvas:${category}] test message`);
    }
  });

  test("handles empty message", () => {
    const result = formatError("config", "");
    expect(result).toBe("[Canvas:config] ");
  });

  test("handles message with special characters", () => {
    const result = formatError("ipc", "Error: file \"test.json\" not found");
    expect(result).toBe("[Canvas:ipc] Error: file \"test.json\" not found");
  });

  test("handles multiline message", () => {
    const result = formatError("validation", "Line 1\nLine 2");
    expect(result).toBe("[Canvas:validation] Line 1\nLine 2");
  });
});

// ============================================
// createError Tests
// ============================================

describe("createError", () => {
  test("creates Error instance", () => {
    const error = createError("config", "Invalid configuration");
    expect(error).toBeInstanceOf(Error);
  });

  test("sets formatted message", () => {
    const error = createError("session", "Session expired");
    expect(error.message).toBe("[Canvas:session] Session expired");
  });

  test("error can be thrown and caught", () => {
    const error = createError("terminal", "Terminal not available");
    expect(() => {
      throw error;
    }).toThrow("[Canvas:terminal] Terminal not available");
  });
});

// ============================================
// getErrorMessage Tests
// ============================================

describe("getErrorMessage", () => {
  test("extracts message from Error instance", () => {
    const error = new Error("Something failed");
    expect(getErrorMessage(error)).toBe("Something failed");
  });

  test("extracts message from custom Error subclass", () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "CustomError";
      }
    }
    const error = new CustomError("Custom failure");
    expect(getErrorMessage(error)).toBe("Custom failure");
  });

  test("converts string to string", () => {
    expect(getErrorMessage("plain string error")).toBe("plain string error");
  });

  test("converts number to string", () => {
    expect(getErrorMessage(404)).toBe("404");
  });

  test("converts null to string", () => {
    expect(getErrorMessage(null)).toBe("null");
  });

  test("converts undefined to string", () => {
    expect(getErrorMessage(undefined)).toBe("undefined");
  });

  test("converts object to string", () => {
    const result = getErrorMessage({ code: "ERR_001" });
    expect(result).toBe("[object Object]");
  });

  test("converts array to string", () => {
    const result = getErrorMessage(["error1", "error2"]);
    expect(result).toBe("error1,error2");
  });

  test("handles boolean values", () => {
    expect(getErrorMessage(false)).toBe("false");
    expect(getErrorMessage(true)).toBe("true");
  });
});

// ============================================
// failedTo Tests
// ============================================

describe("failedTo", () => {
  test("formats basic failed action", () => {
    const result = failedTo("ipc", "connect to server");
    expect(result).toBe("[Canvas:ipc] Failed to connect to server");
  });

  test("includes context when provided", () => {
    const result = failedTo("session", "save session", "session-123");
    expect(result).toBe("[Canvas:session] Failed to save session (session-123)");
  });

  test("includes cause from Error", () => {
    const cause = new Error("Connection refused");
    const result = failedTo("connection", "establish connection", undefined, cause);
    expect(result).toBe("[Canvas:connection] Failed to establish connection: Connection refused");
  });

  test("includes both context and cause", () => {
    const cause = new Error("Permission denied");
    const result = failedTo("terminal", "spawn process", "canvas-abc", cause);
    expect(result).toBe("[Canvas:terminal] Failed to spawn process (canvas-abc): Permission denied");
  });

  test("handles string cause", () => {
    const result = failedTo("config", "parse config", undefined, "Invalid JSON");
    expect(result).toBe("[Canvas:config] Failed to parse config: Invalid JSON");
  });

  test("handles null cause", () => {
    const result = failedTo("validation", "validate input", undefined, null);
    expect(result).toBe("[Canvas:validation] Failed to validate input: null");
  });

  test("omits cause when undefined", () => {
    const result = failedTo("canvas", "render component", "MyComponent", undefined);
    expect(result).toBe("[Canvas:canvas] Failed to render component (MyComponent)");
    expect(result).not.toContain("undefined");
  });
});

// ============================================
// notFound Tests
// ============================================

describe("notFound", () => {
  test("formats basic not found error", () => {
    const result = notFound("config", "Configuration file");
    expect(result).toBe("[Canvas:config] Configuration file not found");
  });

  test("includes identifier when provided", () => {
    const result = notFound("session", "Session", "sess-xyz-123");
    expect(result).toBe("[Canvas:session] Session not found: sess-xyz-123");
  });

  test("handles empty identifier (treated as no identifier)", () => {
    // Empty string is falsy, so identifier is not appended
    const result = notFound("ipc", "Socket", "");
    expect(result).toBe("[Canvas:ipc] Socket not found");
  });

  test("works with file paths", () => {
    const result = notFound("config", "Config file", "/path/to/config.json");
    expect(result).toBe("[Canvas:config] Config file not found: /path/to/config.json");
  });
});

// ============================================
// invalid Tests
// ============================================

describe("invalid", () => {
  test("formats basic invalid error", () => {
    const result = invalid("validation", "input");
    expect(result).toBe("[Canvas:validation] Invalid input");
  });

  test("includes reason when provided", () => {
    const result = invalid("config", "port number", "must be between 1 and 65535");
    expect(result).toBe("[Canvas:config] Invalid port number: must be between 1 and 65535");
  });

  test("handles complex item names", () => {
    const result = invalid("ipc", "message format");
    expect(result).toBe("[Canvas:ipc] Invalid message format");
  });

  test("handles detailed reason", () => {
    const result = invalid(
      "validation",
      "date string",
      "expected ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ)"
    );
    expect(result).toContain("Invalid date string");
    expect(result).toContain("ISO 8601");
  });
});

// ============================================
// timeout Tests
// ============================================

describe("timeout", () => {
  test("formats timeout with seconds", () => {
    const result = timeout("connection", "Connection", 30000);
    expect(result).toBe("[Canvas:connection] Connection timed out after 30 seconds");
  });

  test("rounds milliseconds to nearest second", () => {
    const result = timeout("ipc", "Response", 5500);
    expect(result).toBe("[Canvas:ipc] Response timed out after 6 seconds");
  });

  test("handles sub-second timeout", () => {
    const result = timeout("canvas", "Render", 500);
    expect(result).toBe("[Canvas:canvas] Render timed out after 1 seconds");
  });

  test("handles zero timeout", () => {
    const result = timeout("session", "Initialization", 0);
    expect(result).toBe("[Canvas:session] Initialization timed out after 0 seconds");
  });

  test("handles large timeout values", () => {
    const result = timeout("connection", "Long operation", 300000); // 5 minutes
    expect(result).toBe("[Canvas:connection] Long operation timed out after 300 seconds");
  });

  test("handles very small values", () => {
    const result = timeout("ipc", "Quick check", 100);
    expect(result).toBe("[Canvas:ipc] Quick check timed out after 0 seconds");
  });
});

// ============================================
// connectionError Tests
// ============================================

describe("connectionError", () => {
  test("formats basic connection error", () => {
    const result = connectionError("localhost:3000");
    expect(result).toBe("[Canvas:connection] Failed to connect to localhost:3000");
  });

  test("includes cause when provided", () => {
    const cause = new Error("ECONNREFUSED");
    const result = connectionError("server", cause);
    expect(result).toBe("[Canvas:connection] Failed to connect to server: ECONNREFUSED");
  });

  test("handles string cause", () => {
    const result = connectionError("database", "timeout");
    expect(result).toBe("[Canvas:connection] Failed to connect to database: timeout");
  });

  test("always uses connection category", () => {
    const result = connectionError("any-target");
    expect(result).toStartWith("[Canvas:connection]");
  });

  test("handles complex target names", () => {
    const result = connectionError("canvas-abc123 via socket /tmp/canvas.sock");
    expect(result).toContain("canvas-abc123 via socket /tmp/canvas.sock");
  });
});

// ============================================
// logError Tests
// ============================================

describe("logError", () => {
  let consoleSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    consoleSpy = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test("logs formatted message", () => {
    logError("config", "Failed to load");
    expect(consoleSpy).toHaveBeenCalledWith("[Canvas:config] Failed to load");
  });

  test("logs with error when provided", () => {
    const error = new Error("File not found");
    logError("ipc", "Read failed", error);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[Canvas:ipc] Read failed",
      "File not found"
    );
  });

  test("handles string error", () => {
    logError("session", "Operation failed", "unknown cause");
    expect(consoleSpy).toHaveBeenCalledWith(
      "[Canvas:session] Operation failed",
      "unknown cause"
    );
  });

  test("handles null error", () => {
    logError("terminal", "Spawn failed", null);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[Canvas:terminal] Spawn failed",
      "null"
    );
  });

  test("logs single argument when no error", () => {
    logError("validation", "Input rejected");
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith("[Canvas:validation] Input rejected");
  });
});

// ============================================
// logWarning Tests
// ============================================

describe("logWarning", () => {
  let consoleSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    consoleSpy = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test("logs formatted warning", () => {
    logWarning("config", "Deprecated option used");
    expect(consoleSpy).toHaveBeenCalledWith(
      "[Canvas:config] Warning: Deprecated option used"
    );
  });

  test("includes Warning prefix in message", () => {
    logWarning("session", "Session will expire soon");
    const call = consoleSpy.mock.calls[0][0];
    expect(call).toContain("Warning:");
  });

  test("uses console.error for warnings", () => {
    logWarning("terminal", "Terminal size too small");
    expect(consoleSpy).toHaveBeenCalled();
  });
});

// ============================================
// Integration Tests
// ============================================

describe("Integration", () => {
  test("error messages are consistent across functions", () => {
    const formatted = formatError("ipc", "test");
    const fromFailedTo = failedTo("ipc", "test");
    const fromNotFound = notFound("ipc", "test");
    const fromInvalid = invalid("ipc", "test");
    const fromTimeout = timeout("ipc", "test", 1000);
    const fromConnection = connectionError("test");

    // All should have the same prefix format
    expect(formatted).toMatch(/^\[Canvas:\w+\]/);
    expect(fromFailedTo).toMatch(/^\[Canvas:\w+\]/);
    expect(fromNotFound).toMatch(/^\[Canvas:\w+\]/);
    expect(fromInvalid).toMatch(/^\[Canvas:\w+\]/);
    expect(fromTimeout).toMatch(/^\[Canvas:\w+\]/);
    expect(fromConnection).toMatch(/^\[Canvas:\w+\]/);
  });

  test("createError can be used with failedTo", () => {
    const message = failedTo("config", "load configuration", "app.json");
    const error = new Error(message);
    expect(error.message).toBe("[Canvas:config] Failed to load configuration (app.json)");
  });

  test("errors can be chained", () => {
    const innerError = new Error("ENOENT: no such file");
    const outerMessage = failedTo("config", "initialize app", undefined, innerError);
    expect(outerMessage).toContain("ENOENT: no such file");
  });

  test("getErrorMessage works with createError output", () => {
    const error = createError("validation", "Invalid input");
    const message = getErrorMessage(error);
    expect(message).toBe("[Canvas:validation] Invalid input");
  });
});

// ============================================
// Edge Cases
// ============================================

describe("Edge Cases", () => {
  test("handles Unicode characters", () => {
    const result = formatError("config", "文件未找到 (File not found)");
    expect(result).toBe("[Canvas:config] 文件未找到 (File not found)");
  });

  test("handles very long messages", () => {
    const longMessage = "x".repeat(10000);
    const result = formatError("ipc", longMessage);
    expect(result.length).toBe("[Canvas:ipc] ".length + 10000);
  });

  test("handles empty strings in all positions", () => {
    // Empty context/identifier strings are falsy, so parentheses/colons are not added
    expect(failedTo("config", "", "", "")).toBe("[Canvas:config] Failed to : ");
    expect(notFound("config", "", "")).toBe("[Canvas:config]  not found");
    expect(invalid("config", "", "")).toBe("[Canvas:config] Invalid ");
  });

  test("getErrorMessage handles object with toString", () => {
    const customObj = {
      toString() {
        return "Custom error representation";
      },
    };
    expect(getErrorMessage(customObj)).toBe("Custom error representation");
  });

  test("getErrorMessage handles Symbol", () => {
    const sym = Symbol("test");
    expect(getErrorMessage(sym)).toBe("Symbol(test)");
  });

  test("timeout handles negative values", () => {
    // Negative values round towards zero
    const result = timeout("ipc", "Operation", -1000);
    expect(result).toContain("-1 seconds");
  });

  test("failedTo with empty cause converts properly", () => {
    const result = failedTo("config", "process", undefined, "");
    expect(result).toBe("[Canvas:config] Failed to process: ");
  });
});
