// IPC Server - Canvas side (for standalone CLI mode)
// Listens on a Unix domain socket (Unix/macOS) or TCP socket (Windows)

import type { Socket } from "bun";
import type { ControllerMessage, CanvasMessage } from "./types";
import { isWindows, getPortFilePath } from "./types";
import { unlinkSync, existsSync } from "fs";

// Type for IPC socket (TCP or Unix domain socket)
type IPCSocket = Socket<undefined>;

export interface IPCServerOptions<TReceive = ControllerMessage, TSend = CanvasMessage> {
  socketPath: string; // For Unix, this is the socket path; for Windows, this is used to derive the port file
  onMessage: (msg: TReceive) => void;
  onClientConnect?: () => void;
  onClientDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export interface IPCServer<TSend = CanvasMessage> {
  broadcast: (msg: TSend) => void;
  close: () => void;
  port?: number; // Only set on Windows (TCP mode)
}

export async function createIPCServer<TReceive = ControllerMessage, TSend = CanvasMessage>(
  options: IPCServerOptions<TReceive, TSend>
): Promise<IPCServer<TSend>> {
  const { socketPath, onMessage, onClientConnect, onClientDisconnect, onError } = options;

  const clients = new Set<IPCSocket>();
  // Use per-socket buffers to prevent race conditions with multiple clients
  const socketBuffers = new Map<IPCSocket, string>();

  const socketHandlers = {
    open(socket: IPCSocket) {
      clients.add(socket);
      socketBuffers.set(socket, "");
      onClientConnect?.();
    },

    data(socket: IPCSocket, data: Buffer) {
      // Accumulate data in per-socket buffer and parse complete JSON messages
      let buffer = socketBuffers.get(socket) || "";
      buffer += data.toString();

      const lines = buffer.split("\n");
      socketBuffers.set(socket, lines.pop() || "");

      for (const line of lines) {
        if (line.trim()) {
          try {
            const msg = JSON.parse(line) as TReceive;
            onMessage(msg);
          } catch (e) {
            onError?.(new Error(`Failed to parse message: ${line}`));
          }
        }
      }
    },

    close(socket: IPCSocket) {
      clients.delete(socket);
      socketBuffers.delete(socket);
      onClientDisconnect?.();
    },

    error(socket: IPCSocket, error: Error) {
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
    if (match && match[1]) {
      const portFile = getPortFilePath(match[1]);
      await Bun.write(portFile, port.toString());
    }

    return {
      port,

      broadcast(msg: TSend) {
        const data = JSON.stringify(msg) + "\n";
        for (const client of clients) {
          client.write(data);
        }
      },

      close() {
        server.stop();
        // Clean up port file
        if (match) {
          const portFile = getPortFilePath(match[1]!);
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
      broadcast(msg: TSend) {
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
