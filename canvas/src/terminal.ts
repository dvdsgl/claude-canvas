import { spawn, spawnSync } from "child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { isWindows, getSocketPath, getTempFilePath } from "./ipc/types";

export interface TerminalEnvironment {
  inTmux: boolean;
  inWindowsTerminal: boolean;
  platform: "windows" | "unix";
  summary: string;
}

export function detectTerminal(): TerminalEnvironment {
  const inTmux = !!process.env.TMUX;
  const inWindowsTerminal = !!process.env.WT_SESSION;
  const platform = isWindows ? "windows" : "unix";

  let summary: string;
  if (isWindows) {
    summary = inWindowsTerminal ? "Windows Terminal" : "Windows (no WT)";
  } else {
    summary = inTmux ? "tmux" : "no tmux";
  }

  return { inTmux, inWindowsTerminal, platform, summary };
}

export interface SpawnResult {
  method: string;
  pid?: number;
}

export interface SpawnOptions {
  socketPath?: string;
  scenario?: string;
}

export async function spawnCanvas(
  kind: string,
  id: string,
  configJson?: string,
  options?: SpawnOptions
): Promise<SpawnResult> {
  const env = detectTerminal();

  if (isWindows) {
    return spawnCanvasWindows(kind, id, configJson, options, env);
  } else {
    return spawnCanvasUnix(kind, id, configJson, options, env);
  }
}

// ============================================
// Unix/macOS Implementation (tmux)
// ============================================

async function spawnCanvasUnix(
  kind: string,
  id: string,
  configJson?: string,
  options?: SpawnOptions,
  env?: TerminalEnvironment
): Promise<SpawnResult> {
  if (!env?.inTmux) {
    throw new Error("Canvas requires tmux on Unix/macOS. Please run inside a tmux session.");
  }

  // Get the directory of this script (skill directory)
  const scriptDir = import.meta.dir.replace("/src", "");
  const runScript = `${scriptDir}/run-canvas.sh`;

  // Auto-generate socket path for IPC if not provided
  const socketPath = options?.socketPath || getSocketPath(id);

  // Build the command to run
  let command = `${runScript} show ${kind} --id ${id}`;
  if (configJson) {
    // Write config to a temp file to avoid shell escaping issues
    const configFile = getTempFilePath(`canvas-config-${id}.json`);
    await Bun.write(configFile, configJson);
    command += ` --config "$(cat ${configFile})"`;
  }
  command += ` --socket ${socketPath}`;
  if (options?.scenario) {
    command += ` --scenario ${options.scenario}`;
  }

  const result = await spawnTmux(command);
  if (result) return { method: "tmux" };

  throw new Error("Failed to spawn tmux pane");
}

// File to track the canvas pane ID (Unix)
const CANVAS_PANE_FILE_UNIX = "/tmp/claude-canvas-pane-id";

async function getCanvasPaneId(): Promise<string | null> {
  try {
    const file = Bun.file(CANVAS_PANE_FILE_UNIX);
    if (await file.exists()) {
      const paneId = (await file.text()).trim();
      // Verify the pane still exists by checking if tmux can find it
      const result = spawnSync("tmux", ["display-message", "-t", paneId, "-p", "#{pane_id}"]);
      const output = result.stdout?.toString().trim();
      // Pane exists only if command succeeds AND returns the same pane ID
      if (result.status === 0 && output === paneId) {
        return paneId;
      }
      // Stale pane reference - clean up the file
      await Bun.write(CANVAS_PANE_FILE_UNIX, "");
    }
  } catch {
    // Ignore errors
  }
  return null;
}

async function saveCanvasPaneId(paneId: string): Promise<void> {
  await Bun.write(CANVAS_PANE_FILE_UNIX, paneId);
}

async function createNewPane(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Use split-window -h for vertical split (side by side)
    // -p 67 gives canvas 2/3 width (1:2 ratio, Claude:Canvas)
    // -P -F prints the new pane ID so we can save it
    const args = ["split-window", "-h", "-p", "67", "-P", "-F", "#{pane_id}", command];
    const proc = spawn("tmux", args);
    let paneId = "";
    proc.stdout?.on("data", (data) => {
      paneId += data.toString();
    });
    proc.on("close", async (code) => {
      if (code === 0 && paneId.trim()) {
        await saveCanvasPaneId(paneId.trim());
      }
      resolve(code === 0);
    });
    proc.on("error", () => resolve(false));
  });
}

async function reuseExistingPane(paneId: string, command: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Send Ctrl+C to interrupt any running process
    const killProc = spawn("tmux", ["send-keys", "-t", paneId, "C-c"]);
    killProc.on("close", () => {
      // Wait for process to terminate before sending new command
      setTimeout(() => {
        // Clear the terminal and run the new command
        const args = ["send-keys", "-t", paneId, `clear && ${command}`, "Enter"];
        const proc = spawn("tmux", args);
        proc.on("close", (code) => resolve(code === 0));
        proc.on("error", () => resolve(false));
      }, 150);
    });
    killProc.on("error", () => resolve(false));
  });
}

async function spawnTmux(command: string): Promise<boolean> {
  // Check if we have an existing canvas pane to reuse
  const existingPaneId = await getCanvasPaneId();

  if (existingPaneId) {
    // Try to reuse existing pane
    const reused = await reuseExistingPane(existingPaneId, command);
    if (reused) {
      return true;
    }
    // Reuse failed (pane may have been closed) - clear stale reference and create new
    await Bun.write(CANVAS_PANE_FILE_UNIX, "");
  }

  // Create a new split pane
  return createNewPane(command);
}

// ============================================
// Windows Implementation (Windows Terminal)
// ============================================

// File to track the canvas process ID (Windows)
const CANVAS_PID_FILE_WIN = () => getTempFilePath("claude-canvas-pid");

async function spawnCanvasWindows(
  kind: string,
  id: string,
  configJson?: string,
  options?: SpawnOptions,
  env?: TerminalEnvironment
): Promise<SpawnResult> {
  // Get the directory of this script - import.meta.dir gives us the src directory
  // We need to go up one level to get the canvas directory
  const srcDir = import.meta.dir;
  const scriptDir = srcDir.endsWith("src")
    ? srcDir.slice(0, -3)  // Remove "src" from end
    : srcDir.replace(/[\\\/]src$/, "");

  // Auto-generate socket path for IPC if not provided
  const socketPath = options?.socketPath || getSocketPath(id);

  // Build the command arguments
  const bunPath = process.execPath; // Path to bun executable
  // Normalize path separators for Windows
  const cliPath = join(scriptDir, "src", "cli.ts").replace(/\//g, "\\");

  // Prepare command arguments
  const cmdArgs = ["show", kind, "--id", id, "--socket", socketPath];

  if (options?.scenario) {
    cmdArgs.push("--scenario", options.scenario);
  }

  // Write config to a temp file
  let configFile: string | undefined;
  if (configJson) {
    configFile = getTempFilePath(`canvas-config-${id}.json`);
    await Bun.write(configFile, configJson);
  }

  if (env?.inWindowsTerminal) {
    // We're in Windows Terminal - use wt.exe to split pane
    return spawnWindowsTerminalPane(bunPath, cliPath, cmdArgs, configFile, id);
  } else {
    // Not in Windows Terminal - spawn a new terminal window
    return spawnNewTerminalWindow(bunPath, cliPath, cmdArgs, configFile, kind, id);
  }
}

/**
 * Create a launcher script for Windows
 * This avoids all escaping issues when passing commands through wt.exe
 */
async function createLaunchScript(
  id: string,
  bunPath: string,
  cliPath: string,
  cmdArgs: string[],
  configFile?: string
): Promise<string> {
  const scriptPath = getTempFilePath(`canvas-launch-${id}.cmd`);

  let command = `@echo off\nREM Canvas launcher script - ${new Date().toISOString()}\nREM ID: ${id}\n\n`;
  command += `"${bunPath}" "${cliPath}" ${cmdArgs.join(" ")}`;

  if (configFile) {
    command += ` --config-file "${configFile}"`;
  }

  await Bun.write(scriptPath, command);
  return scriptPath;
}

async function spawnWindowsTerminalPane(
  bunPath: string,
  cliPath: string,
  cmdArgs: string[],
  configFile?: string,
  id?: string
): Promise<SpawnResult> {
  return new Promise(async (resolve, reject) => {
    // Create a launcher script to avoid escaping issues
    const scriptId = id || `pane-${Date.now()}`;
    const scriptPath = await createLaunchScript(scriptId, bunPath, cliPath, cmdArgs, configFile);

    // Use wt.exe to create a split pane
    // -w 0 = current window
    // sp = split-pane
    // -H = horizontal split (side by side)
    // --size 0.67 = 67% width for canvas
    // --title = pane title
    const args = [
      "-w", "0",
      "sp",
      "-H",
      "--size", "0.67",
      "--title", "Canvas",
      scriptPath
    ];

    const proc = spawn("wt.exe", args, {
      detached: true,
      stdio: "ignore",
      shell: false,
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn Windows Terminal pane: ${err.message}`));
    });

    // wt.exe returns immediately, so we consider it successful if spawn didn't error
    proc.unref();

    // Small delay to let the pane initialize
    setTimeout(() => {
      resolve({ method: "windows-terminal-split" });
    }, 100);
  });
}

async function spawnNewTerminalWindow(
  bunPath: string,
  cliPath: string,
  cmdArgs: string[],
  configFile?: string,
  kind?: string,
  id?: string
): Promise<SpawnResult> {
  // Create a launcher script to avoid escaping issues
  const scriptId = id || `tab-${Date.now()}`;
  const scriptPath = await createLaunchScript(scriptId, bunPath, cliPath, cmdArgs, configFile);

  return new Promise((resolve, reject) => {
    // Try Windows Terminal first, fall back to cmd
    const wtExists = existsSync("C:\\Program Files\\WindowsApps") ||
                     spawnSync("where", ["wt.exe"], { shell: true }).status === 0;

    if (wtExists) {
      // Spawn in a new Windows Terminal tab
      const args = [
        "new-tab",
        "--title", `Canvas: ${kind || "display"}`,
        scriptPath
      ];

      const proc = spawn("wt.exe", args, {
        detached: true,
        stdio: "ignore",
        shell: false,
      });

      proc.on("error", () => {
        // Fall back to cmd if wt fails
        spawnWithCmd();
      });

      proc.unref();
      setTimeout(() => resolve({ method: "windows-terminal-tab" }), 100);
    } else {
      spawnWithCmd();
    }

    function spawnWithCmd() {
      // Fall back to starting a new cmd window that runs the script
      const proc = spawn("cmd", ["/c", "start", "cmd", "/k", scriptPath], {
        detached: true,
        stdio: "ignore",
        shell: true,
      });

      proc.on("error", (err) => {
        reject(new Error(`Failed to spawn terminal window: ${err.message}`));
      });

      proc.unref();
      setTimeout(() => resolve({ method: "cmd-window" }), 100);
    }
  });
}

// ============================================
// Cross-platform utility functions
// ============================================

/**
 * Check if Windows Terminal is available
 */
export function isWindowsTerminalAvailable(): boolean {
  if (!isWindows) return false;

  try {
    const result = spawnSync("where", ["wt.exe"], { shell: true });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Get info about the current terminal environment
 */
export function getTerminalInfo(): {
  platform: string;
  terminal: string;
  canSplit: boolean;
} {
  const env = detectTerminal();

  if (isWindows) {
    return {
      platform: "windows",
      terminal: env.inWindowsTerminal ? "Windows Terminal" : "cmd/PowerShell",
      canSplit: env.inWindowsTerminal || isWindowsTerminalAvailable(),
    };
  } else {
    return {
      platform: "unix",
      terminal: env.inTmux ? "tmux" : "standard terminal",
      canSplit: env.inTmux,
    };
  }
}
