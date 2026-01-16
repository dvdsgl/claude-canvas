// IPC Message Types for Canvas Communication
import { tmpdir } from "node:os";
import { join } from "node:path";
import { notFound, failedTo, getErrorMessage } from "../utils/errors";

// Platform detection
export const isWindows = process.platform === "win32";

// Messages sent from Controller (Claude) to Canvas
export type ControllerMessage =
  | { type: "close" }
  | { type: "update"; config: unknown }
  | { type: "ping" }
  | { type: "getSelection" }
  | { type: "getContent" };

// Messages sent from Canvas to Controller (Claude)
export type CanvasMessage =
  | { type: "ready"; scenario: string }
  | { type: "selected"; data: unknown }
  | { type: "cancelled"; reason?: string }
  | { type: "error"; message: string }
  | { type: "pong" }
  | { type: "selection"; data: { selectedText: string; startOffset: number; endOffset: number } | null }
  | { type: "content"; data: { content: string; cursorPosition: number } };

// Connection info for cross-platform IPC
export interface ConnectionInfo {
  type: "unix" | "tcp";
  // For Unix sockets
  socketPath?: string;
  // For TCP (Windows)
  host?: string;
  port?: number;
}

// Port file path (stores TCP port for Windows IPC)
export function getPortFilePath(id: string): string {
  return join(tmpdir(), `canvas-${id}.port`);
}

// Socket path convention (Unix only)
export function getSocketPath(id: string): string {
  if (isWindows) {
    // On Windows, we use TCP - this returns a placeholder
    // The actual port is stored in the port file
    return join(tmpdir(), `canvas-${id}.sock`);
  }
  // Use os.tmpdir() for cross-platform compatibility
  return join(tmpdir(), `canvas-${id}.sock`);
}

// Get temp file path (cross-platform)
export function getTempFilePath(filename: string): string {
  return join(tmpdir(), filename);
}

// Get connection info for a canvas
export async function getConnectionInfo(id: string): Promise<ConnectionInfo> {
  if (isWindows) {
    // On Windows, read port from port file
    const portFile = getPortFilePath(id);
    try {
      const file = Bun.file(portFile);
      if (await file.exists()) {
        const port = parseInt((await file.text()).trim(), 10);
        if (!isNaN(port)) {
          return { type: "tcp", host: "127.0.0.1", port };
        }
      }
    } catch (err) {
      // Port file read failed - connection info unavailable
      throw new Error(failedTo("ipc", "read connection info", `canvas ${id}`, err));
    }
    throw new Error(notFound("ipc", "Connection info", `canvas ${id}`));
  } else {
    // On Unix, use socket path
    return { type: "unix", socketPath: getSocketPath(id) };
  }
}

// Allocate a free TCP port (for Windows)
export async function allocateTcpPort(): Promise<number> {
  // Create a temporary server to find a free port
  return new Promise((resolve, reject) => {
    const server = Bun.listen({
      hostname: "127.0.0.1",
      port: 0, // Let OS assign a free port
      socket: {
        open() {},
        data() {},
        close() {},
        error() {},
      },
    });
    const port = server.port;
    server.stop();
    resolve(port);
  });
}
