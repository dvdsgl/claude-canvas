// IPC Server - Canvas side (for standalone CLI mode)
// Listens on a Unix domain socket (Unix/macOS) or TCP socket (Windows)

import type { ControllerMessage, CanvasMessage } from "./types";
import { isWindows, getPortFilePath } from "./types";
import { unlinkSync, existsSync } from "fs";

export interface IPCServerOptions {
  socketPath: string; // For Unix, this is the socket path; for Windows, this is used to derive the port file
  onMessage: (msg: ControllerMessage) => void;
  onClientConnect?: () => void;
  onClientDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export interface IPCServer {
  broadcast: (msg: CanvasMessage) => void;
  close: () => void;
  port?: number; // Only set on Windows (TCP mode)
}

export async function createIPCServer(options: IPCServerOptions): Promise<IPCServer> {
  const { socketPath, onMessage, onClientConnect, onClientDisconnect, onError } = options;

  const clients = new Set<any>();
  let buffer = "";

  const socketHandlers = {
    open(socket: any) {
      clients.add(socket);
      onClientConnect?.();
    },

    data(socket: any, data: any) {
      // Accumulate data and parse complete JSON messages
      buffer += data.toString();

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim()) {
          try {
            const msg = JSON.parse(line) as ControllerMessage;
            onMessage(msg);
          } catch (e) {
            onError?.(new Error(`Failed to parse message: ${line}`));
          }
        }
      }
    },

    close(socket: any) {
      clients.delete(socket);
      onClientDisconnect?.();
    },

    error(socket: any, error: Error) {
      onError?.(error);
    },
  };

  if (isWindows) {
    // Windows: Use TCP socket on localhost
    const server = Bun.listen({
      hostname: "127.0.0.1",
      port: 0, // Let OS assign a free port
      socket: socketHandlers,
    });

    const port = server.port;

    // Extract canvas ID from socketPath and write port to file
    // socketPath format: C:\Users\...\AppData\Local\Temp\canvas-{id}.sock
    const match = socketPath.match(/canvas-([^.]+)\.sock$/);
    if (match) {
      const portFile = getPortFilePath(match[1]);
      await Bun.write(portFile, port.toString());
    }

    return {
      port,

      broadcast(msg: CanvasMessage) {
        const data = JSON.stringify(msg) + "\n";
        for (const client of clients) {
          client.write(data);
        }
      },

      close() {
        server.stop();
        // Clean up port file
        if (match) {
          const portFile = getPortFilePath(match[1]);
          if (existsSync(portFile)) {
            unlinkSync(portFile);
          }
        }
      },
    };
  } else {
    // Unix/macOS: Use Unix domain socket
    // Remove existing socket file if it exists
    if (existsSync(socketPath)) {
      unlinkSync(socketPath);
    }

    const server = Bun.listen({
      unix: socketPath,
      socket: socketHandlers,
    });

    return {
      broadcast(msg: CanvasMessage) {
        const data = JSON.stringify(msg) + "\n";
        for (const client of clients) {
          client.write(data);
        }
      },

      close() {
        server.stop();
        if (existsSync(socketPath)) {
          unlinkSync(socketPath);
        }
      },
    };
  }
}
