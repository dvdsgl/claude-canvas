// IPC hook for canvas-side communication with controller

import { useState, useEffect, useCallback, useRef } from "react";
import { useApp } from "ink";
import { connectWithRetry, type IPCClient } from "../../../ipc/client";
import type { CanvasMessage, ControllerMessage } from "../../../ipc/types";

// Canvas side: receives ControllerMessage, sends CanvasMessage
type CanvasSideClient = IPCClient<CanvasMessage>;

export interface UseIPCOptions {
  socketPath: string | undefined;
  scenario: string;
  onClose?: () => void;
  onUpdate?: (config: unknown) => void;
}

export interface IPCHandle {
  isConnected: boolean;
  sendReady: () => void;
  sendSelected: (data: unknown) => void;
  sendCancelled: (reason?: string) => void;
  sendError: (message: string) => void;
}

export function useIPC(options: UseIPCOptions): IPCHandle {
  const { socketPath, scenario, onClose, onUpdate } = options;
  const { exit } = useApp();
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef<CanvasSideClient | null>(null);
  const onCloseRef = useRef(onClose);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onCloseRef.current = onClose;
    onUpdateRef.current = onUpdate;
  }, [onClose, onUpdate]);

  // Connect to controller on mount
  useEffect(() => {
    if (!socketPath) return;

    let mounted = true;

    const connect = async () => {
      try {
        // Canvas receives ControllerMessage, sends CanvasMessage
        const client = await connectWithRetry<ControllerMessage, CanvasMessage>({
          socketPath,
          onMessage: (msg) => {
            switch (msg.type) {
              case "close":
                onCloseRef.current?.();
                exit();
                break;
              case "update":
                onUpdateRef.current?.(msg.config);
                break;
              case "ping":
                client.send({ type: "pong" });
                break;
            }
          },
          onDisconnect: () => {
            if (mounted) {
              setIsConnected(false);
            }
          },
          onError: (err) => {
            console.error("IPC error:", err);
          },
        });

        if (mounted) {
          clientRef.current = client;
          setIsConnected(true);
          // Send ready message automatically
          client.send({ type: "ready", scenario });
        } else {
          client.close();
        }
      } catch (err) {
        console.error("Failed to connect to controller:", err);
      }
    };

    connect();

    return () => {
      mounted = false;
      clientRef.current?.close();
      clientRef.current = null;
    };
  }, [socketPath, scenario, exit]);

  const sendReady = useCallback(() => {
    clientRef.current?.send({ type: "ready", scenario });
  }, [scenario]);

  const sendSelected = useCallback((data: unknown) => {
    clientRef.current?.send({ type: "selected", data });
  }, []);

  const sendCancelled = useCallback((reason?: string) => {
    clientRef.current?.send({ type: "cancelled", reason });
  }, []);

  const sendError = useCallback((message: string) => {
    clientRef.current?.send({ type: "error", message });
  }, []);

  return {
    isConnected,
    sendReady,
    sendSelected,
    sendCancelled,
    sendError,
  };
}
