/**
 * Session Manager for Canvas Virtual Desktop
 *
 * Handles the complete lifecycle of a canvas session:
 * - Creating dedicated virtual desktop
 * - Spawning and managing windows
 * - Persisting state for reconnection
 * - Cleanup on session end
 * - Grid-based window layout management
 */

import * as vd from "./virtual-desktop";
import * as wm from "./window-manager";
import type { SessionState, CanvasWindow } from "./window-manager";
import * as grid from "./grid";
import type { CellSpan, GridConfig, GridState, GridLayoutInfo } from "./grid";

const DEFAULT_DESKTOP_NAME = "Canvas Session";

export interface SessionStartOptions {
  name?: string;           // Desktop name (default: "Canvas Session")
  windowCount?: number;    // Number of windows to create (default: 2)
  canvasConfigs?: Array<{  // Optional initial canvas configs for each window
    kind: string;
    config?: unknown;
  }>;
}

export interface SessionInfo {
  isRunning: boolean;
  desktopName?: string;
  desktopIndex?: number;
  mainDesktopIndex?: number;
  windowCount?: number;
  activeCanvases?: number;
  createdAt?: string;
}

/**
 * Check if the VirtualDesktop module is available
 */
export async function checkDependencies(): Promise<{
  moduleInstalled: boolean;
  platform: string;
  ready: boolean;
  error?: string;
}> {
  const platform = process.platform;

  if (platform !== "win32") {
    return {
      moduleInstalled: false,
      platform,
      ready: false,
      error: "Virtual desktop sessions are only supported on Windows",
    };
  }

  const moduleInstalled = await vd.isModuleInstalled();

  if (!moduleInstalled) {
    return {
      moduleInstalled: false,
      platform,
      ready: false,
      error: "VirtualDesktop PowerShell module is not installed. Run: Install-Module VirtualDesktop -Scope CurrentUser",
    };
  }

  return {
    moduleInstalled: true,
    platform,
    ready: true,
  };
}

/**
 * Get current session info
 */
export async function getSessionInfo(): Promise<SessionInfo> {
  const session = await wm.loadSession();

  if (!session) {
    return { isRunning: false };
  }

  // Verify the desktop still exists
  try {
    const desktops = await vd.listDesktops();
    const exists = desktops.some(d => d.index === session.desktopIndex);

    if (!exists) {
      // Desktop was removed externally
      await wm.deleteSession();
      return { isRunning: false };
    }

    // Get window status
    const status = await wm.getSessionStatus(session);

    return {
      isRunning: true,
      desktopName: session.desktopName,
      desktopIndex: session.desktopIndex,
      mainDesktopIndex: session.mainDesktopIndex,
      windowCount: status.windowCount,
      activeCanvases: status.activeCanvases,
      createdAt: session.createdAt,
    };
  } catch (err) {
    // Desktop verification failed - treat as no active session
    // This can happen if virtual desktop APIs are unavailable
    console.error(`Session verification failed: ${err instanceof Error ? err.message : String(err)}`);
    return { isRunning: false };
  }
}

/**
 * Start a new canvas session
 */
export async function startSession(options: SessionStartOptions = {}): Promise<SessionState> {
  // Check if session already running
  const existing = await wm.loadSession();
  if (existing) {
    // Verify it's still valid
    const info = await getSessionInfo();
    if (info.isRunning) {
      throw new Error("A canvas session is already running. Stop it first with 'canvas session stop'");
    }
    // Stale session, clean up
    await wm.deleteSession();
  }

  // Check dependencies
  const deps = await checkDependencies();
  if (!deps.ready) {
    throw new Error(deps.error || "Dependencies not met");
  }

  const desktopName = options.name || DEFAULT_DESKTOP_NAME;
  const windowCount = options.windowCount || 2;

  // Remember current desktop
  const mainDesktopIndex = await vd.getCurrentDesktopIndex();

  // Check if canvas desktop already exists
  let desktopIndex = await vd.findDesktopByName(desktopName);

  if (desktopIndex === null) {
    // Create new desktop
    desktopIndex = await vd.createDesktop(desktopName);
    console.log(`Created virtual desktop "${desktopName}" at index ${desktopIndex}`);
  } else {
    console.log(`Found existing desktop "${desktopName}" at index ${desktopIndex}`);
  }

  // Create session state
  const session: SessionState = {
    desktopIndex,
    desktopName,
    mainDesktopIndex,
    windows: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Switch to canvas desktop
  await vd.switchToDesktop(desktopIndex);

  // Spawn windows - save session after each window to prevent race conditions and data loss
  const canvasConfigs = options.canvasConfigs || [];
  const createdWindows: CanvasWindow[] = [];

  for (let i = 0; i < windowCount; i++) {
    const windowId = wm.generateWindowId();
    const config = canvasConfigs[i];

    let window: CanvasWindow;

    try {
      if (config) {
        // Spawn with initial canvas
        const configJson = config.config ? JSON.stringify(config.config) : undefined;
        window = await wm.spawnCanvasWindow(windowId, config.kind, configJson);
      } else {
        // Spawn empty window
        const { title } = await wm.spawnEmptyWindow(windowId);

        // Wait for handle with timeout protection
        const handle = await wm.waitForWindowHandle(title);
        if (!handle) {
          console.error(`Warning: Could not get handle for window ${windowId}`);
          continue;
        }

        window = {
          id: windowId,
          canvasId: null,
          canvasKind: null,
          windowHandle: handle,
          title,
          desktopIndex,
        };
      }

      // Move window to canvas desktop (in case it opened elsewhere)
      try {
        await vd.moveWindowToDesktop(window.windowHandle, desktopIndex);
        window.desktopIndex = desktopIndex;
      } catch (err) {
        console.error(`Warning: Could not move window ${windowId} to canvas desktop`);
      }

      // Add to tracked windows and save immediately to prevent data loss on partial failure
      createdWindows.push(window);
      session.windows = [...createdWindows];
      await wm.saveSession(session);

      console.log(`  Created window ${i + 1}/${windowCount}: ${window.id}${window.canvasKind ? ` (${window.canvasKind})` : ""}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`Warning: Failed to create window ${i + 1}/${windowCount}: ${errorMessage}`);
      // Continue to next window - session state for previous windows is already saved
    }
  }

  // Final session save with all windows
  session.windows = createdWindows;
  await wm.saveSession(session);

  return session;
}

/**
 * Stop the current session
 */
export async function stopSession(options: {
  removeDesktop?: boolean;
} = {}): Promise<void> {
  const session = await wm.loadSession();

  if (!session) {
    console.log("No active session to stop");
    return;
  }

  console.log("Stopping canvas session...");

  // Switch back to main desktop first
  try {
    await vd.switchToDesktop(session.mainDesktopIndex);
    console.log(`  Switched back to desktop ${session.mainDesktopIndex}`);
  } catch (err) {
    // Expected: May fail if desktop no longer exists or was already switched
    console.log(`  Could not switch to main desktop: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Close all windows
  for (const window of session.windows) {
    try {
      await wm.closeCanvasWindow(window);
      console.log(`  Closed window ${window.id}`);
    } catch (err) {
      // Expected: Window may already be closed by user or system
      console.log(`  Window ${window.id} already closed or inaccessible`);
    }
  }

  // Optionally remove the desktop
  if (options.removeDesktop !== false) {
    try {
      await vd.removeDesktop(session.desktopIndex);
      console.log(`  Removed desktop "${session.desktopName}"`);
    } catch (err) {
      console.log(`  Could not remove desktop: ${err}`);
    }
  }

  // Delete session file
  await wm.deleteSession();
  console.log("Session stopped");
}

/**
 * Add a window to the current session
 */
export async function addWindow(canvasKind?: string, config?: unknown): Promise<CanvasWindow> {
  const session = await wm.loadSession();
  if (!session) {
    throw new Error("No active session. Start one with 'canvas session start'");
  }

  const windowId = wm.generateWindowId();

  let window: CanvasWindow;

  if (canvasKind) {
    const configJson = config ? JSON.stringify(config) : undefined;
    window = await wm.spawnCanvasWindow(windowId, canvasKind, configJson);
  } else {
    const { title } = await wm.spawnEmptyWindow(windowId);
    const handle = await wm.waitForWindowHandle(title);

    if (!handle) {
      throw new Error("Could not get window handle");
    }

    window = {
      id: windowId,
      canvasId: null,
      canvasKind: null,
      windowHandle: handle,
      title,
      desktopIndex: session.desktopIndex,
    };
  }

  // Move to canvas desktop
  await vd.moveWindowToDesktop(window.windowHandle, session.desktopIndex);
  window.desktopIndex = session.desktopIndex;

  // Update session
  session.windows.push(window);
  await wm.saveSession(session);

  return window;
}

/**
 * Close a window from the current session
 */
export async function closeWindow(windowId: string): Promise<void> {
  const session = await wm.loadSession();
  if (!session) {
    throw new Error("No active session");
  }

  const window = session.windows.find(w => w.id === windowId);
  if (!window) {
    throw new Error(`Window not found: ${windowId}`);
  }

  await wm.closeCanvasWindow(window);

  // Remove from session
  session.windows = session.windows.filter(w => w.id !== windowId);
  await wm.saveSession(session);
}

/**
 * Assign a canvas to a window
 */
export async function assignCanvas(
  windowId: string,
  canvasKind: string,
  config?: unknown
): Promise<CanvasWindow> {
  const session = await wm.loadSession();
  if (!session) {
    throw new Error("No active session");
  }

  const windowIndex = session.windows.findIndex(w => w.id === windowId);
  if (windowIndex === -1) {
    throw new Error(`Window not found: ${windowId}`);
  }

  const window = session.windows[windowIndex];
  if (!window) {
    throw new Error(`Window at index ${windowIndex} not found`);
  }
  const configJson = config ? JSON.stringify(config) : undefined;

  const updated = await wm.assignCanvas(window, canvasKind, configJson);

  // Update session
  session.windows[windowIndex] = updated;
  await wm.saveSession(session);

  return updated;
}

/**
 * Swap canvases between two windows
 */
export async function swapCanvases(
  windowId1: string,
  windowId2: string
): Promise<void> {
  const session = await wm.loadSession();
  if (!session) {
    throw new Error("No active session");
  }

  const index1 = session.windows.findIndex(w => w.id === windowId1);
  const index2 = session.windows.findIndex(w => w.id === windowId2);

  if (index1 === -1) throw new Error(`Window not found: ${windowId1}`);
  if (index2 === -1) throw new Error(`Window not found: ${windowId2}`);

  const win1 = session.windows[index1];
  const win2 = session.windows[index2];
  if (!win1 || !win2) {
    throw new Error("Window not found at expected index");
  }

  const [updated1, updated2] = await wm.swapCanvases(win1, win2);

  session.windows[index1] = updated1;
  session.windows[index2] = updated2;
  await wm.saveSession(session);
}

/**
 * List all windows in the current session
 */
export async function listWindows(): Promise<CanvasWindow[]> {
  const session = await wm.loadSession();
  if (!session) {
    return [];
  }

  // Refresh handles to check which windows are still alive
  session.windows = await wm.refreshWindowHandles(session.windows);
  await wm.saveSession(session);

  return session.windows;
}

/**
 * Focus a specific window
 */
export async function focusWindow(windowId: string): Promise<void> {
  const session = await wm.loadSession();
  if (!session) {
    throw new Error("No active session");
  }

  const window = session.windows.find(w => w.id === windowId);
  if (!window) {
    throw new Error(`Window not found: ${windowId}`);
  }

  await wm.focusCanvasWindow(window);
}

/**
 * Switch to the canvas desktop
 */
export async function switchToCanvasDesktop(): Promise<void> {
  const session = await wm.loadSession();
  if (!session) {
    throw new Error("No active session");
  }

  await vd.switchToDesktop(session.desktopIndex);
}

/**
 * Switch to the main (original) desktop
 */
export async function switchToMainDesktop(): Promise<void> {
  const session = await wm.loadSession();
  if (!session) {
    throw new Error("No active session");
  }

  await vd.switchToDesktop(session.mainDesktopIndex);
}

/**
 * Reconnect to an existing session
 * Useful after restarting Claude Code
 */
export async function reconnectSession(): Promise<SessionState | null> {
  const session = await wm.loadSession();
  if (!session) {
    return null;
  }

  // Verify desktop exists
  const desktops = await vd.listDesktops();
  if (!desktops.some(d => d.index === session.desktopIndex)) {
    console.log("Canvas desktop no longer exists, cleaning up session");
    await wm.deleteSession();
    return null;
  }

  // Refresh window handles
  session.windows = await wm.refreshWindowHandles(session.windows);

  if (session.windows.length === 0) {
    console.log("No windows remaining, cleaning up session");
    await wm.deleteSession();
    return null;
  }

  await wm.saveSession(session);
  return session;
}

/**
 * Get detailed session status
 */
export async function getDetailedStatus(): Promise<{
  session: SessionState | null;
  status: Awaited<ReturnType<typeof wm.getSessionStatus>>;
} | null> {
  const session = await wm.loadSession();
  if (!session) {
    return null;
  }

  const status = await wm.getSessionStatus(session);
  return { session, status };
}

// ============================================
// Grid Management Functions
// ============================================

/**
 * Configure the grid layout for the current session
 */
export async function configureGrid(config: Partial<GridConfig>): Promise<GridState> {
  const session = await wm.loadSession();
  if (!session) {
    throw new Error("No active session. Start one with 'canvas session start'");
  }

  // Merge with existing config or use defaults
  const fullConfig: GridConfig = {
    rows: config.rows ?? session.gridConfig?.rows ?? 3,
    columns: config.columns ?? session.gridConfig?.columns ?? 3,
    monitorIndex: config.monitorIndex ?? session.gridConfig?.monitorIndex ?? 0,
    cellGapHorizontal: config.cellGapHorizontal ?? session.gridConfig?.cellGapHorizontal ?? 4,
    cellGapVertical: config.cellGapVertical ?? session.gridConfig?.cellGapVertical ?? 4,
    marginTop: config.marginTop ?? session.gridConfig?.marginTop ?? 0,
    marginBottom: config.marginBottom ?? session.gridConfig?.marginBottom ?? 0,
    marginLeft: config.marginLeft ?? session.gridConfig?.marginLeft ?? 0,
    marginRight: config.marginRight ?? session.gridConfig?.marginRight ?? 0,
  };

  // Initialize grid state
  const gridState = grid.initializeGridState(session.desktopIndex, fullConfig);

  // Preserve existing assignments
  if (session.gridState?.assignments) {
    for (const assignment of session.gridState.assignments) {
      const validation = grid.validateCellSpan(assignment.cellSpan, gridState);
      if (validation.valid) {
        gridState.assignments.push(assignment);
      }
    }
  }

  // Update session
  session.gridConfig = fullConfig;
  session.gridState = gridState;
  await wm.saveSession(session);

  return gridState;
}

/**
 * Get the current grid configuration
 */
export async function getGridConfig(): Promise<GridConfig | null> {
  const session = await wm.loadSession();
  return session?.gridConfig ?? null;
}

/**
 * Assign a window to a grid cell
 *
 * @param windowId - Window ID to assign
 * @param cellSpec - Cell specification (e.g., "A1", "0,0", "A1:B2", "0,0:2x2")
 * @param autoPosition - If true, immediately position the window
 */
export async function assignWindowToCell(
  windowId: string,
  cellSpec: string,
  autoPosition = true
): Promise<CanvasWindow> {
  const session = await wm.loadSession();
  if (!session) {
    throw new Error("No active session");
  }

  // Find the window
  const windowIndex = session.windows.findIndex(w => w.id === windowId);
  if (windowIndex === -1) {
    throw new Error(`Window not found: ${windowId}`);
  }

  const window = session.windows[windowIndex];
  if (!window) {
    throw new Error(`Window at index ${windowIndex} not found`);
  }

  // Ensure grid is configured
  if (!session.gridConfig || !session.gridState) {
    // Auto-initialize with defaults
    await configureGrid({});
    // Reload session after grid init
    const reloaded = await wm.loadSession();
    if (!reloaded?.gridState) {
      throw new Error("Failed to initialize grid");
    }
    session.gridConfig = reloaded.gridConfig;
    session.gridState = reloaded.gridState;
  }

  // Parse cell specification
  const parseResult = grid.parseCellSpec(cellSpec);
  if (!parseResult.success) {
    throw new Error(parseResult.error || "Invalid cell specification");
  }

  const cellSpan = parseResult.cellSpan!;

  // Validate against current grid
  const validation = grid.validateCellSpan(cellSpan, session.gridState, windowId);
  if (!validation.valid) {
    throw new Error(validation.error || "Invalid cell assignment");
  }

  // Update grid state
  session.gridState = grid.assignWindowToGrid(windowId, cellSpan, session.gridState);

  // Update window's grid assignment
  window.gridAssignment = cellSpan;
  session.windows[windowIndex] = window;

  // Save session
  await wm.saveSession(session);

  // Position window if requested
  if (autoPosition && window.windowHandle) {
    try {
      const rect = await grid.calculateWindowRect(windowId, session.gridState);
      if (rect) {
        await grid.setWindowPosition(window.windowHandle, rect, { showWindow: true });
        window.position = rect;
        session.windows[windowIndex] = window;
        await wm.saveSession(session);
      }
    } catch (err) {
      console.error(`Warning: Could not position window ${windowId}: ${err}`);
    }
  }

  return window;
}

/**
 * Remove a window from the grid (but keep the window open)
 */
export async function removeWindowFromGrid(windowId: string): Promise<void> {
  const session = await wm.loadSession();
  if (!session) {
    throw new Error("No active session");
  }

  if (!session.gridState) {
    return; // No grid configured
  }

  // Find the window
  const windowIndex = session.windows.findIndex(w => w.id === windowId);
  if (windowIndex !== -1) {
    const window = session.windows[windowIndex];
    if (window) {
      window.gridAssignment = undefined;
      session.windows[windowIndex] = window;
    }
  }

  // Update grid state
  session.gridState = grid.removeWindowFromGrid(windowId, session.gridState);
  await wm.saveSession(session);
}

/**
 * Apply grid positions to all assigned windows
 */
export async function applyGridPositions(): Promise<{
  positioned: string[];
  failed: string[];
}> {
  const session = await wm.loadSession();
  if (!session) {
    throw new Error("No active session");
  }

  if (!session.gridState) {
    throw new Error("No grid configured. Run 'canvas grid configure' first");
  }

  const positioned: string[] = [];
  const failed: string[] = [];

  for (const assignment of session.gridState.assignments) {
    const window = session.windows.find(w => w.id === assignment.windowId);
    if (!window || !window.windowHandle) {
      failed.push(assignment.windowId);
      continue;
    }

    try {
      const rect = await grid.calculateWindowRect(assignment.windowId, session.gridState);
      if (rect) {
        await grid.setWindowPosition(window.windowHandle, rect, { showWindow: true });

        // Update window position in session
        const windowIndex = session.windows.findIndex(w => w.id === assignment.windowId);
        if (windowIndex !== -1) {
          const win = session.windows[windowIndex];
          if (win) {
            win.position = rect;
            win.gridAssignment = assignment.cellSpan;
            session.windows[windowIndex] = win;
          }
        }

        positioned.push(assignment.windowId);
      } else {
        failed.push(assignment.windowId);
      }
    } catch (err) {
      console.error(`Failed to position ${assignment.windowId}: ${err}`);
      failed.push(assignment.windowId);
    }
  }

  await wm.saveSession(session);

  return { positioned, failed };
}

/**
 * Get the current grid layout information
 */
export async function getGridLayout(): Promise<GridLayoutInfo | null> {
  const session = await wm.loadSession();
  if (!session?.gridState) {
    return null;
  }

  // Build a map of window IDs to canvas kinds
  const windowKinds = new Map<string, string | null>();
  for (const window of session.windows) {
    windowKinds.set(window.id, window.canvasKind);
  }

  return grid.getGridLayoutInfo(session.gridState, windowKinds);
}

/**
 * Get available (unoccupied) cells in the grid
 */
export async function getAvailableCells(): Promise<grid.CellAddress[]> {
  const session = await wm.loadSession();
  if (!session?.gridState) {
    return [];
  }

  return grid.getAvailableCells(session.gridState);
}

/**
 * Swap grid positions of two windows
 */
export async function swapGridPositions(
  windowId1: string,
  windowId2: string,
  autoPosition = true
): Promise<void> {
  const session = await wm.loadSession();
  if (!session) {
    throw new Error("No active session");
  }

  if (!session.gridState) {
    throw new Error("No grid configured");
  }

  // Swap in grid state
  session.gridState = grid.swapWindowPositions(windowId1, windowId2, session.gridState);

  // Update window assignments
  const span1 = grid.getWindowCellSpan(windowId1, session.gridState);
  const span2 = grid.getWindowCellSpan(windowId2, session.gridState);

  const win1Index = session.windows.findIndex(w => w.id === windowId1);
  const win2Index = session.windows.findIndex(w => w.id === windowId2);

  if (win1Index !== -1 && span1) {
    const win = session.windows[win1Index];
    if (win) {
      win.gridAssignment = span1;
      session.windows[win1Index] = win;
    }
  }

  if (win2Index !== -1 && span2) {
    const win = session.windows[win2Index];
    if (win) {
      win.gridAssignment = span2;
      session.windows[win2Index] = win;
    }
  }

  await wm.saveSession(session);

  // Reposition if requested
  if (autoPosition) {
    await applyGridPositions();
  }
}

/**
 * Move a window to a different cell (removes from current cell first)
 */
export async function moveWindowInGrid(
  windowId: string,
  newCellSpec: string,
  autoPosition = true
): Promise<void> {
  // Remove from current position first
  await removeWindowFromGrid(windowId);

  // Assign to new position
  await assignWindowToCell(windowId, newCellSpec, autoPosition);
}

/**
 * Find first available span that fits the requested dimensions
 */
export async function findAvailableSpan(
  rowSpan: number,
  columnSpan: number
): Promise<CellSpan | null> {
  const session = await wm.loadSession();
  if (!session?.gridState) {
    return null;
  }

  return grid.findAvailableSpan(rowSpan, columnSpan, session.gridState);
}

/**
 * Generate ASCII visualization of the grid
 */
export async function visualizeGrid(): Promise<string> {
  const session = await wm.loadSession();
  if (!session?.gridState) {
    return "No grid configured";
  }

  // Build window names map
  const windowNames = new Map<string, string>();
  for (const window of session.windows) {
    const name = window.canvasKind
      ? `${window.canvasKind.slice(0, 8)}`
      : window.id.slice(0, 8);
    windowNames.set(window.id, name);
  }

  return grid.visualizeGrid(session.gridState, windowNames);
}

/**
 * Get monitor information for the grid
 */
export async function getMonitorInfo(monitorIndex?: number): Promise<grid.MonitorInfo | null> {
  const session = await wm.loadSession();
  const idx = monitorIndex ?? session?.gridConfig?.monitorIndex ?? 0;
  return grid.getMonitor(idx);
}

/**
 * Get all monitors
 */
export async function getAllMonitors(): Promise<grid.MonitorInfo[]> {
  return grid.getAllMonitors();
}

// Re-export grid types and functions for convenience
export type { CellSpan, GridConfig, GridState, GridLayoutInfo };
export { parseCellSpec, formatCellSpecExcel, formatCellSpecCoordinate } from "./grid";
