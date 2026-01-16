// High-Level Canvas API for Claude
// Provides simple async interface for spawning interactive canvases

import { createIPCServer } from "../ipc/server";
import { getSocketPath } from "../ipc/types";
import { spawnCanvas } from "../terminal";
import type { CanvasMessage, ControllerMessage } from "../ipc/types";
import type {
  MeetingPickerConfig,
  MeetingPickerResult,
  DocumentConfig,
  DocumentSelection,
} from "../scenarios/types";
import type { FlightConfig, FlightResult } from "../canvases/flight/types";
import {
  validateMeetingPickerConfig,
  validateDocumentConfig,
  validateFlightConfig,
  validateBaseCalendarConfig,
  formatValidationErrors,
} from "./validation";
import { timeout, connectionError, failedTo } from "../utils/errors";

// Grid system imports
import type {
  GridConfig,
  GridState,
  CellSpan,
  CellSpec,
  PixelRect,
  GridLayoutInfo,
  CellAddress,
} from "../grid";
import {
  initializeGridState,
  parseCellSpec,
  validateCellSpan,
  findAvailableSpan,
  assignWindowToGrid,
  removeWindowFromGrid,
  getWindowCellSpan,
  calculateWindowRect,
  getGridLayoutInfo,
  visualizeGrid,
  getAvailableCells,
  formatCellSpecExcel,
  DEFAULT_GRID_CONFIG,
} from "../grid";

// Re-export types for API consumers
export type { FlightConfig, FlightResult };

// Re-export grid types for API consumers
export type {
  GridConfig,
  GridState,
  CellSpan,
  CellSpec,
  PixelRect,
  GridLayoutInfo,
  CellAddress,
};
export { DEFAULT_GRID_CONFIG };

export interface CanvasResult<T = unknown> {
  success: boolean;
  data?: T;
  cancelled?: boolean;
  error?: string;
}

export interface SpawnOptions {
  timeout?: number; // ms, default 5 minutes for user selection
  connectionTimeout?: number; // ms, default 30 seconds for canvas to connect
  onReady?: () => void;

  // Grid positioning options
  gridPosition?: CellSpec; // Cell spec like "A1", "B2:C3", or "0,0:2x2"
  gridState?: GridState;   // Current grid state for validation/auto-placement
  autoPlace?: boolean;     // Auto-find available cell if gridPosition not specified
  cellSpan?: {             // Size hint for auto-placement (default: 1x1)
    rows?: number;
    columns?: number;
  };
}

/**
 * Spawn an interactive canvas and wait for user selection
 */
export async function spawnCanvasWithIPC<TConfig, TResult>(
  kind: string,
  scenario: string,
  config: TConfig,
  options: SpawnOptions = {}
): Promise<CanvasResult<TResult>> {
  const { timeout: selectionTimeout = 300000, connectionTimeout = 30000, onReady } = options;
  const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const socketPath = getSocketPath(id);

  let resolved = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let connectionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let clientConnected = false;
  let server: Awaited<ReturnType<typeof createIPCServer<CanvasMessage, ControllerMessage>>> | null = null;

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (connectionTimeoutId) {
      clearTimeout(connectionTimeoutId);
      connectionTimeoutId = null;
    }
    if (server) {
      server.close();
    }
  };

  return new Promise((resolve) => {
    const initServer = async () => {
      try {
        // Server receives CanvasMessage from canvas, sends ControllerMessage to canvas
        server = await createIPCServer<CanvasMessage, ControllerMessage>({
          socketPath,
          onClientConnect() {
            // Canvas connected, clear connection timeout
            clientConnected = true;
            if (connectionTimeoutId) {
              clearTimeout(connectionTimeoutId);
              connectionTimeoutId = null;
            }
          },
          onMessage(msg) {
            if (resolved) return;

            switch (msg.type) {
              case "ready":
                onReady?.();
                break;

              case "selected":
                resolved = true;
                cleanup();
                resolve({
                  success: true,
                  data: msg.data as TResult,
                });
                break;

              case "cancelled":
                resolved = true;
                cleanup();
                resolve({
                  success: true,
                  cancelled: true,
                });
                break;

              case "error":
                resolved = true;
                cleanup();
                resolve({
                  success: false,
                  error: failedTo("canvas", "process request", scenario, msg.message),
                });
                break;

              case "pong":
                // Response to ping, ignore
                break;
            }
          },
          onClientDisconnect() {
            if (!resolved) {
              resolved = true;
              cleanup();
              resolve({
                success: false,
                error: connectionError("canvas", "disconnected unexpectedly"),
              });
            }
          },
          onError(error) {
            if (!resolved) {
              resolved = true;
              cleanup();
              resolve({
                success: false,
                error: failedTo("ipc", "communicate with canvas", undefined, error),
              });
            }
          },
        });

        // Set connection timeout - fires if canvas doesn't connect within connectionTimeout
        connectionTimeoutId = setTimeout(() => {
          if (!resolved && !clientConnected) {
            resolved = true;
            cleanup();
            resolve({
              success: false,
              error: timeout("connection", "Canvas connection", connectionTimeout),
            });
          }
        }, connectionTimeout);

        // Set overall timeout for user selection
        timeoutId = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            const closeMsg: ControllerMessage = { type: "close" };
            server?.broadcast(closeMsg);
            cleanup();
            resolve({
              success: false,
              error: timeout("canvas", "User selection", selectionTimeout),
            });
          }
        }, selectionTimeout);

        // Spawn the canvas
        await spawnCanvas(kind, id, JSON.stringify(config), {
          socketPath,
          scenario,
        });
      } catch (err) {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve({
            success: false,
            error: failedTo("canvas", "spawn canvas", kind, err),
          });
        }
      }
    };

    initServer();
  });
}

/**
 * Spawn a meeting picker canvas
 * Convenience wrapper for the meeting-picker scenario
 */
export async function pickMeetingTime(
  config: MeetingPickerConfig,
  options?: SpawnOptions
): Promise<CanvasResult<MeetingPickerResult>> {
  // Validate config before spawning
  const validation = validateMeetingPickerConfig(config);
  if (!validation.valid) {
    return {
      success: false,
      error: formatValidationErrors(validation),
    };
  }

  return spawnCanvasWithIPC<MeetingPickerConfig, MeetingPickerResult>(
    "calendar",
    "meeting-picker",
    config,
    options
  );
}

/**
 * Display a calendar (non-interactive)
 * Convenience wrapper for the display scenario
 */
export async function displayCalendar(
  config: {
    title?: string;
    events?: Array<{
      id: string;
      title: string;
      startTime: string;
      endTime: string;
      color?: string;
      allDay?: boolean;
    }>;
  },
  options?: SpawnOptions
): Promise<CanvasResult<void>> {
  // Validate config before spawning
  const validation = validateBaseCalendarConfig(config);
  if (!validation.valid) {
    return {
      success: false,
      error: formatValidationErrors(validation),
    };
  }

  return spawnCanvasWithIPC("calendar", "display", config, options);
}

// ============================================
// Document Canvas API
// ============================================

/**
 * Display a document (read-only view)
 * Shows markdown-rendered content with optional diff highlighting
 */
export async function displayDocument(
  config: DocumentConfig,
  options?: SpawnOptions
): Promise<CanvasResult<void>> {
  // Validate config before spawning
  const validation = validateDocumentConfig(config);
  if (!validation.valid) {
    return {
      success: false,
      error: formatValidationErrors(validation),
    };
  }

  return spawnCanvasWithIPC("document", "display", config, options);
}

/**
 * Open a document for editing/selection
 * Returns the selected text when user makes a selection via click-and-drag
 * Selection is sent automatically as the user selects text
 */
export async function editDocument(
  config: DocumentConfig,
  options?: SpawnOptions
): Promise<CanvasResult<DocumentSelection>> {
  // Validate config before spawning
  const validation = validateDocumentConfig(config);
  if (!validation.valid) {
    return {
      success: false,
      error: formatValidationErrors(validation),
    };
  }

  return spawnCanvasWithIPC<DocumentConfig, DocumentSelection>(
    "document",
    "edit",
    config,
    options
  );
}

// ============================================
// Flight Canvas API
// ============================================

/**
 * Open flight booking canvas for flight selection and optional seat selection
 * Returns the selected flight and optional seat
 */
export async function bookFlight(
  config: FlightConfig,
  options?: SpawnOptions
): Promise<CanvasResult<FlightResult>> {
  // Validate config before spawning
  const validation = validateFlightConfig(config);
  if (!validation.valid) {
    return {
      success: false,
      error: formatValidationErrors(validation),
    };
  }

  return spawnCanvasWithIPC<FlightConfig, FlightResult>(
    "flight",
    "booking",
    config,
    options
  );
}

// ============================================
// Grid Management API
// ============================================

/**
 * Create a new grid state for managing canvas positions
 * @param desktopIndex - Virtual desktop index (default: 0)
 * @param config - Partial grid configuration (defaults to 3x3 grid)
 */
export function createGridState(
  desktopIndex: number = 0,
  config: Partial<GridConfig> = {}
): GridState {
  return initializeGridState(desktopIndex, config);
}

/**
 * Parse a cell specification string into a CellSpan
 * Supports formats: "A1", "A1:C2", "0,0", "0,0:2x3"
 */
export function parseGridPosition(spec: CellSpec): {
  success: boolean;
  cellSpan?: CellSpan;
  error?: string;
} {
  return parseCellSpec(spec);
}

/**
 * Find an available position in the grid for a canvas
 * @param gridState - Current grid state
 * @param rows - Number of rows needed (default: 1)
 * @param columns - Number of columns needed (default: 1)
 * @returns Cell span if available, null if grid is full
 */
export function findAvailableGridPosition(
  gridState: GridState,
  rows: number = 1,
  columns: number = 1
): CellSpan | null {
  return findAvailableSpan(rows, columns, gridState);
}

/**
 * Assign a canvas window to a grid position
 * @param windowId - Canvas window ID
 * @param position - Cell spec or CellSpan
 * @param gridState - Current grid state
 * @returns Updated grid state, or error if position is invalid/occupied
 */
export function assignToGrid(
  windowId: string,
  position: CellSpec | CellSpan,
  gridState: GridState
): { success: boolean; gridState?: GridState; error?: string } {
  // Parse position if it's a string
  let cellSpan: CellSpan;
  if (typeof position === "string") {
    const parsed = parseCellSpec(position);
    if (!parsed.success || !parsed.cellSpan) {
      return { success: false, error: parsed.error || "Invalid cell specification" };
    }
    cellSpan = parsed.cellSpan;
  } else {
    cellSpan = position;
  }

  // Validate the position
  const validation = validateCellSpan(cellSpan, gridState, windowId);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Assign to grid
  const newState = assignWindowToGrid(windowId, cellSpan, gridState);
  return { success: true, gridState: newState };
}

/**
 * Remove a canvas window from the grid
 */
export function removeFromGrid(
  windowId: string,
  gridState: GridState
): GridState {
  return removeWindowFromGrid(windowId, gridState);
}

/**
 * Get the grid position of a canvas window
 */
export function getGridPosition(
  windowId: string,
  gridState: GridState
): CellSpan | null {
  return getWindowCellSpan(windowId, gridState);
}

/**
 * Get the pixel rectangle for a canvas window's grid position
 */
export async function getWindowRect(
  windowId: string,
  gridState: GridState
): Promise<PixelRect | null> {
  return calculateWindowRect(windowId, gridState);
}

/**
 * Get available (unoccupied) cells in the grid
 */
export function getAvailableGridCells(gridState: GridState): CellAddress[] {
  return getAvailableCells(gridState);
}

/**
 * Get complete grid layout information including all assignments
 * @param gridState - Current grid state
 * @param windowKinds - Map of window IDs to canvas kinds (optional)
 */
export async function getGridLayout(
  gridState: GridState,
  windowKinds: Map<string, string | null> = new Map()
): Promise<GridLayoutInfo> {
  return getGridLayoutInfo(gridState, windowKinds);
}

/**
 * Format a cell span in Excel notation (e.g., "A1" or "A1:C2")
 */
export function formatGridPosition(cellSpan: CellSpan): string {
  return formatCellSpecExcel(cellSpan);
}

/**
 * Generate ASCII visualization of grid layout
 * @param gridState - Current grid state
 * @param windowNames - Map of window IDs to display names (optional)
 */
export function visualizeGridLayout(
  gridState: GridState,
  windowNames: Map<string, string> = new Map()
): string {
  return visualizeGrid(gridState, windowNames);
}

/**
 * Helper to spawn a canvas with automatic grid placement
 * Finds the first available cell and assigns the canvas to it
 */
export async function spawnCanvasInGrid<TConfig, TResult>(
  kind: string,
  scenario: string,
  config: TConfig,
  gridState: GridState,
  options: SpawnOptions = {}
): Promise<{
  result: CanvasResult<TResult>;
  gridState: GridState;
  windowId: string;
}> {
  const windowId = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const rows = options.cellSpan?.rows ?? 1;
  const columns = options.cellSpan?.columns ?? 1;

  // Determine cell position
  let cellSpan: CellSpan | null = null;

  if (options.gridPosition) {
    // Use specified position
    const parsed = parseCellSpec(options.gridPosition);
    if (!parsed.success || !parsed.cellSpan) {
      return {
        result: { success: false, error: parsed.error || "Invalid grid position" },
        gridState,
        windowId,
      };
    }
    cellSpan = parsed.cellSpan;

    // Validate position
    const validation = validateCellSpan(cellSpan, gridState);
    if (!validation.valid) {
      return {
        result: { success: false, error: validation.error },
        gridState,
        windowId,
      };
    }
  } else if (options.autoPlace !== false) {
    // Auto-find available position (default behavior)
    cellSpan = findAvailableSpan(rows, columns, gridState);
    if (!cellSpan) {
      return {
        result: { success: false, error: "No available grid cells for requested size" },
        gridState,
        windowId,
      };
    }
  }

  // Assign to grid if we have a position
  let newGridState = gridState;
  if (cellSpan) {
    newGridState = assignWindowToGrid(windowId, cellSpan, gridState);
  }

  // Spawn the canvas (using existing spawnCanvasWithIPC)
  const result = await spawnCanvasWithIPC<TConfig, TResult>(
    kind,
    scenario,
    config,
    {
      ...options,
      gridState: newGridState,
    }
  );

  // If spawn failed, remove from grid
  if (!result.success && cellSpan) {
    newGridState = removeWindowFromGrid(windowId, newGridState);
  }

  return {
    result,
    gridState: newGridState,
    windowId,
  };
}
