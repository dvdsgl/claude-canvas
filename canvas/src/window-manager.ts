/**
 * Window Manager for Canvas Session
 *
 * Manages canvas windows across virtual desktops, tracking window handles,
 * canvas assignments, and providing APIs for window operations.
 */

import { spawn, spawnSync } from "child_process";
import { join } from "node:path";
import { existsSync } from "node:fs";
import * as vd from "./virtual-desktop";
import { getTempFilePath, getSocketPath, isWindows } from "./ipc/types";
import type { CellSpan, GridConfig, GridState } from "./grid";

/**
 * Find Windows Terminal executable
 */
function findWtExe(): string {
  // Common locations
  const localAppData = process.env.LOCALAPPDATA || "";
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";

  const possiblePaths = [
    // Microsoft Store version (most common)
    join(localAppData, "Microsoft", "WindowsApps", "wt.exe"),
    // Scoop
    join(process.env.USERPROFILE || "", "scoop", "apps", "windows-terminal", "current", "wt.exe"),
    // Chocolatey
    join(programFiles, "WindowsTerminal", "wt.exe"),
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p;
    }
  }

  // Fall back to hoping it's in PATH
  return "wt.exe";
}

/**
 * Spawn a Windows Terminal window using PowerShell Start-Process
 * This is more reliable than direct spawn on Windows
 */
async function spawnWtWindow(title: string, scriptPath: string): Promise<void> {
  const wtExe = findWtExe();
  const escapedWt = wtExe.replace(/\\/g, "\\\\");
  const escapedScript = scriptPath.replace(/\\/g, "\\\\");

  // Build PowerShell command without backticks in JS template
  // Use single quotes for the inner strings in PowerShell
  const psLines = [
    '$wtPath = "' + escapedWt + '"',
    '$title = "' + title + '"',
    '$script = "' + escapedScript + '"',
    'Start-Process -FilePath $wtPath -ArgumentList @("new-window", "--title", $title, "cmd", "/k", $script) -WindowStyle Normal'
  ];
  const psScript = psLines.join("; ");

  return new Promise((resolve, reject) => {
    const proc = spawn("powershell", [
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-Command", psScript
    ], {
      detached: true,
      stdio: "ignore",
    });

    proc.on("error", (err) => {
      reject(new Error("Failed to spawn window: " + err.message));
    });

    proc.unref();
    setTimeout(() => resolve(), 500);
  });
}

export interface CanvasWindow {
  id: string;                  // Unique window ID (e.g., "win-1")
  canvasId: string | null;     // Canvas instance ID (e.g., "calendar-abc123")
  canvasKind: string | null;   // Canvas type ("calendar", "document", etc.)
  windowHandle: number;        // Windows HWND
  title: string;               // Window title for lookup
  desktopIndex: number;        // Virtual desktop index
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  gridAssignment?: CellSpan;   // Grid cell assignment (optional)
}

export interface SessionState {
  desktopIndex: number;
  desktopName: string;
  mainDesktopIndex: number;
  windows: CanvasWindow[];
  createdAt: string;
  updatedAt: string;
  gridConfig?: GridConfig;     // Optional grid configuration
  gridState?: GridState;       // Optional grid state with assignments
}

const SESSION_FILE = getTempFilePath("canvas-session.json");

/**
 * Load session state from disk
 */
export async function loadSession(): Promise<SessionState | null> {
  try {
    const file = Bun.file(SESSION_FILE);
    if (await file.exists()) {
      const content = await file.text();
      return JSON.parse(content);
    }
  } catch (err) {
    // Session file may be corrupted or inaccessible - treat as no session
    console.error(`Failed to load session: ${err instanceof Error ? err.message : String(err)}`);
  }
  return null;
}

/**
 * Save session state to disk
 */
export async function saveSession(state: SessionState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  await Bun.write(SESSION_FILE, JSON.stringify(state, null, 2));
}

/**
 * Delete session file
 */
export async function deleteSession(): Promise<void> {
  try {
    const file = Bun.file(SESSION_FILE);
    if (await file.exists()) {
      await Bun.$`del "${SESSION_FILE}"`.quiet();
    }
  } catch (err) {
    // Session file deletion failed - may already be deleted or locked
    // This is non-critical so we continue silently
  }
}

/**
 * Generate a unique window ID
 */
export function generateWindowId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `win-${timestamp}-${random}`;
}

/**
 * Generate a unique canvas ID
 */
export function generateCanvasId(kind: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${kind}-${timestamp}-${random}`;
}

/**
 * Create a new empty Windows Terminal window
 * Returns the window title that can be used to find the handle
 */
export async function spawnEmptyWindow(windowId: string): Promise<{ title: string; pid?: number }> {
  const title = `Canvas: ${windowId}`;

  return new Promise((resolve, reject) => {
    // Create a minimal script that just waits
    const waitScript = getTempFilePath(`canvas-wait-${windowId}.cmd`);
    const scriptContent = `@echo off
title ${title}
echo Canvas window ready. Waiting for canvas assignment...
echo Window ID: ${windowId}
echo.
:loop
timeout /t 3600 /nobreak >nul
goto loop
`;
    Bun.write(waitScript, scriptContent).then(async () => {
      try {
        // Spawn a new Windows Terminal window using PowerShell
        await spawnWtWindow(title, waitScript);
        resolve({ title });
      } catch (err) {
        reject(err);
      }
    });
  });
}

/**
 * Wait for a window handle to become available
 */
export async function waitForWindowHandle(
  titlePattern: string,
  maxAttempts = 20,
  delayMs = 250
): Promise<number | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const handle = await vd.findWindowByTitle(titlePattern);
    if (handle) {
      return handle;
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  return null;
}

/**
 * Spawn a canvas in a new Windows Terminal window
 */
export async function spawnCanvasWindow(
  windowId: string,
  canvasKind: string,
  configJson?: string
): Promise<CanvasWindow> {
  const title = `Canvas: ${windowId}`;
  const canvasId = generateCanvasId(canvasKind);

  // Get paths
  const srcDir = import.meta.dir;
  const scriptDir = srcDir.endsWith("src")
    ? srcDir.slice(0, -3)
    : srcDir.replace(/[\\\/]src$/, "");

  const bunPath = process.execPath;
  const cliPath = join(scriptDir, "src", "cli.ts").replace(/\//g, "\\");
  const socketPath = getSocketPath(canvasId);

  // Build command arguments
  const cmdArgs = ["show", canvasKind, "--id", canvasId, "--socket", socketPath];

  // Write config if provided
  let configFile: string | undefined;
  if (configJson) {
    configFile = getTempFilePath(`canvas-config-${canvasId}.json`);
    await Bun.write(configFile, configJson);
  }

  // Create launcher script
  const scriptPath = getTempFilePath(`canvas-launch-${windowId}.cmd`);
  let command = `@echo off\ntitle ${title}\n"${bunPath}" "${cliPath}" ${cmdArgs.join(" ")}`;
  if (configFile) {
    command += ` --config-file "${configFile}"`;
  }
  await Bun.write(scriptPath, command);

  // Spawn using PowerShell helper
  await spawnWtWindow(title, scriptPath);

  // Wait for window and get handle
  const handle = await waitForWindowHandle(title);
  if (!handle) {
    throw new Error(`Could not find window handle for ${title}`);
  }

  return {
    id: windowId,
    canvasId,
    canvasKind,
    windowHandle: handle,
    title,
    desktopIndex: -1, // Will be set when moved to canvas desktop
  };
}

/**
 * Assign a canvas to an existing window
 * This kills the current process in the window and starts a new canvas
 */
export async function assignCanvas(
  window: CanvasWindow,
  canvasKind: string,
  configJson?: string
): Promise<CanvasWindow> {
  const canvasId = generateCanvasId(canvasKind);
  const title = `Canvas: ${window.id}`;

  // Get paths
  const srcDir = import.meta.dir;
  const scriptDir = srcDir.endsWith("src")
    ? srcDir.slice(0, -3)
    : srcDir.replace(/[\\\/]src$/, "");

  const bunPath = process.execPath;
  const cliPath = join(scriptDir, "src", "cli.ts").replace(/\//g, "\\");
  const socketPath = getSocketPath(canvasId);

  // Build command arguments
  const cmdArgs = ["show", canvasKind, "--id", canvasId, "--socket", socketPath];

  // Write config if provided
  let configFile: string | undefined;
  if (configJson) {
    configFile = getTempFilePath(`canvas-config-${canvasId}.json`);
    await Bun.write(configFile, configJson);
  }

  // Create launcher script
  const scriptPath = getTempFilePath(`canvas-launch-${window.id}.cmd`);
  let command = `@echo off\ntitle ${title}\n"${bunPath}" "${cliPath}" ${cmdArgs.join(" ")}`;
  if (configFile) {
    command += ` --config-file "${configFile}"`;
  }
  await Bun.write(scriptPath, command);

  // Send Ctrl+C to the window, then run new command
  // We'll use PowerShell to send keys to the window
  await Bun.$`powershell -NoProfile -Command "
    Add-Type @'
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport(\"user32.dll\")]
    public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
    public const uint WM_KEYDOWN = 0x0100;
    public const uint WM_KEYUP = 0x0101;
    public const int VK_CONTROL = 0x11;
    public const int VK_C = 0x43;
}
'@
    # Send Ctrl+C
    [Win32]::PostMessage([IntPtr]${window.windowHandle}, [Win32]::WM_KEYDOWN, [IntPtr][Win32]::VK_CONTROL, [IntPtr]0)
    [Win32]::PostMessage([IntPtr]${window.windowHandle}, [Win32]::WM_KEYDOWN, [IntPtr][Win32]::VK_C, [IntPtr]0)
    Start-Sleep -Milliseconds 50
    [Win32]::PostMessage([IntPtr]${window.windowHandle}, [Win32]::WM_KEYUP, [IntPtr][Win32]::VK_C, [IntPtr]0)
    [Win32]::PostMessage([IntPtr]${window.windowHandle}, [Win32]::WM_KEYUP, [IntPtr][Win32]::VK_CONTROL, [IntPtr]0)
  "`.quiet();

  // Wait a bit, then run the new command by closing and reopening the window
  await new Promise(r => setTimeout(r, 200));

  // Close the old window and spawn new one
  await vd.closeWindow(window.windowHandle);
  await new Promise(r => setTimeout(r, 300));

  // Spawn new window using PowerShell helper
  await spawnWtWindow(title, scriptPath);
  const newHandle = await waitForWindowHandle(title);

  if (!newHandle) {
    throw new Error(`Could not find new window handle for ${title}`);
  }

  // Move to the same desktop
  if (window.desktopIndex >= 0) {
    await vd.moveWindowToDesktop(newHandle, window.desktopIndex);
  }

  return {
    ...window,
    canvasId,
    canvasKind,
    windowHandle: newHandle,
  };
}

/**
 * Swap canvases between two windows
 */
export async function swapCanvases(
  window1: CanvasWindow,
  window2: CanvasWindow,
  configJson1?: string,
  configJson2?: string
): Promise<[CanvasWindow, CanvasWindow]> {
  // Store current canvas info
  const kind1 = window1.canvasKind;
  const kind2 = window2.canvasKind;

  // Assign canvas1's canvas to window2 and vice versa
  let newWindow1 = window1;
  let newWindow2 = window2;

  if (kind2) {
    newWindow1 = await assignCanvas(window1, kind2, configJson2);
  }
  if (kind1) {
    newWindow2 = await assignCanvas(window2, kind1, configJson1);
  }

  return [newWindow1, newWindow2];
}

/**
 * Close a canvas window
 */
export async function closeCanvasWindow(window: CanvasWindow): Promise<void> {
  try {
    await vd.closeWindow(window.windowHandle);
  } catch (err) {
    // Expected: Window may already be closed by user or system
  }
}

/**
 * Focus a canvas window
 */
export async function focusCanvasWindow(window: CanvasWindow): Promise<void> {
  // First switch to the desktop
  if (window.desktopIndex >= 0) {
    await vd.switchToDesktop(window.desktopIndex);
  }
  // Then focus the window
  await vd.focusWindow(window.windowHandle);
}

/**
 * Update window handles by searching for windows by title
 * Useful after windows have been moved or recreated
 */
export async function refreshWindowHandles(windows: CanvasWindow[]): Promise<CanvasWindow[]> {
  const updated: CanvasWindow[] = [];

  for (const win of windows) {
    const handle = await vd.findWindowByTitle(win.title);
    if (handle) {
      updated.push({
        ...win,
        windowHandle: handle,
      });
    }
    // Skip windows that no longer exist
  }

  return updated;
}

/**
 * Get session status summary
 */
export async function getSessionStatus(session: SessionState): Promise<{
  desktopName: string;
  windowCount: number;
  activeCanvases: number;
  windows: Array<{
    id: string;
    canvasKind: string | null;
    isAlive: boolean;
  }>;
}> {
  const windows: Array<{
    id: string;
    canvasKind: string | null;
    isAlive: boolean;
  }> = [];

  for (const win of session.windows) {
    // Check if window still exists
    const handle = await vd.findWindowByTitle(win.title);
    windows.push({
      id: win.id,
      canvasKind: win.canvasKind,
      isAlive: handle !== null,
    });
  }

  return {
    desktopName: session.desktopName,
    windowCount: session.windows.length,
    activeCanvases: windows.filter(w => w.canvasKind !== null).length,
    windows,
  };
}

// Re-export grid types for convenience
export type { CellSpan, GridConfig, GridState } from "./grid";
