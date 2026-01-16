// IPC Client - Controller side
// Connects to the canvas's Unix domain socket (Unix/macOS) or TCP socket (Windows)

import type { ControllerMessage, CanvasMessage, ConnectionInfo } from "./types";
import { isWindows, getPortFilePath } from "./types";
import type { Socket } from "bun";

export interface IPCClientOptions<TReceive = CanvasMessage, TSend = ControllerMessage> {
  socketPath: string; // For Unix; on Windows, port is read from port file
  onMessage: (msg: TReceive) => void;
  onDisconnect: () => void;
  onError?: (error: Error) => void;
}

export interface IPCClient<TSend = ControllerMessage> {
  send: (msg: TSend) => void;
  close: () => void;
  isConnected: () => boolean;
}

// Connect using socketPath (for Unix) or by reading port file (for Windows)
export async function connectToController<TReceive = CanvasMessage, TSend = ControllerMessage>(
  options: IPCClientOptions<TReceive, TSend>
): Promise<IPCClient<TSend>> {
  const { socketPath, onMessage, onDisconnect, onError } = options;

  let connected = false;
  let buffer = "";

  const socketHandlers = {
    open(socket: any) {
      connected = true;
    },

    data(socket: any, data: any) {
      // Accumulate data and parse complete JSON messages
      buffer += data.toString();

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

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

    close() {
      connected = false;
      onDisconnect();
    },

    error(socket: any, error: Error) {
      onError?.(error);
    },
  };

  let socket: any;

  if (isWindows) {
    // Windows: Read port from port file and connect via TCP
    const match = socketPath.match(/canvas-([^.]+)\.sock$/);
    if (!match || !match[1]) {
      throw new Error(`Invalid socket path format: ${socketPath}`);
    }

    const portFile = getPortFilePath(match[1]);
    const file = Bun.file(portFile);

    if (!(await file.exists())) {
      throw new Error(`Port file not found: ${portFile}`);
    }

    const port = parseInt((await file.text()).trim(), 10);
    if (isNaN(port)) {
      throw new Error(`Invalid port in port file: ${portFile}`);
    }

    socket = await Bun.connect({
      hostname: "127.0.0.1",
      port,
      socket: socketHandlers,
    });
  } else {
    // Unix/macOS: Connect via Unix domain socket
    socket = await Bun.connect({
      unix: socketPath,
      socket: socketHandlers,
    });
  }

  connected = true;

  return {
    send(msg: TSend) {
      if (connected) {
        socket.write(JSON.stringify(msg) + "\n");
      }
    },

    close() {
      socket.end();
      connected = false;
    },

    isConnected() {
      return connected;
    },
  };
}

// Connect directly with connection info (more explicit API)
export async function connectWithInfo<TReceive = CanvasMessage, TSend = ControllerMessage>(
  connectionInfo: ConnectionInfo,
  options: Omit<IPCClientOptions<TReceive, TSend>, "socketPath">
): Promise<IPCClient<TSend>> {
  const { onMessage, onDisconnect, onError } = options;

  let connected = false;
  let buffer = "";

  const socketHandlers = {
    open(socket: any) {
      connected = true;
    },

    data(socket: any, data: any) {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

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

    close() {
      connected = false;
      onDisconnect();
    },

    error(socket: any, error: Error) {
      onError?.(error);
    },
  };

  let socket: any;

  if (connectionInfo.type === "tcp") {
    if (connectionInfo.port === undefined) {
      throw new Error("TCP connection requires port");
    }
    socket = await Bun.connect({
      hostname: connectionInfo.host || "127.0.0.1",
      port: connectionInfo.port,
      socket: socketHandlers,
    });
  } else {
    if (!connectionInfo.socketPath) {
      throw new Error("Unix connection requires socketPath");
    }
    socket = await Bun.connect({
      unix: connectionInfo.socketPath,
      socket: socketHandlers,
    });
  }

  connected = true;

  return {
    send(msg: TSend) {
      if (connected) {
        socket.write(JSON.stringify(msg) + "\n");
      }
    },

    close() {
      socket.end();
      connected = false;
    },

    isConnected() {
      return connected;
    },
  };
}

// Attempt to connect with retries
export async function connectWithRetry<TReceive = CanvasMessage, TSend = ControllerMessage>(
  options: IPCClientOptions<TReceive, TSend>,
  maxRetries = 10,
  retryDelayMs = 100
): Promise<IPCClient<TSend>> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await connectToController(options);
    } catch (e) {
      lastError = e as Error;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw lastError || new Error("Failed to connect to controller");
}
