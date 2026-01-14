import { spawn, spawnSync } from "child_process";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export type TerminalType = "tmux" | "wezterm" | "none";

export interface TerminalEnvironment {
  type: TerminalType;
  inTmux: boolean;
  inWezTerm: boolean;
  summary: string;
}

/**
 * Detect available terminal multiplexer.
 * Preference can be set via CANVAS_TERMINAL env var ("tmux" | "wezterm").
 *
 * Detection priority:
 * 1. Explicit CANVAS_TERMINAL preference (if available)
 * 2. If inside tmux session (even within WezTerm), use tmux
 *    - Respects user's explicit tmux workflow
 *    - Supports tmux-inside-WezTerm for session persistence
 * 3. If only in WezTerm (no tmux), use WezTerm
 *
 * To force WezTerm when inside tmux: CANVAS_TERMINAL=wezterm
 */
export function detectTerminal(): TerminalEnvironment {
  const inTmux = !!process.env.TMUX;
  const inWezTerm = process.env.WEZTERM_PANE !== undefined || process.env.WEZTERM_EXECUTABLE !== undefined;

  // Check explicit preference
  const preferred = process.env.CANVAS_TERMINAL?.toLowerCase();

  let type: TerminalType;
  if (preferred === "wezterm" && inWezTerm) {
    // User explicitly wants WezTerm (even if inside tmux)
    type = "wezterm";
  } else if (preferred === "tmux" && inTmux) {
    // User explicitly wants tmux
    type = "tmux";
  } else if (inTmux) {
    // Inside tmux session - use tmux (even if also in WezTerm)
    // This respects tmux-inside-WezTerm workflows
    type = "tmux";
  } else if (inWezTerm) {
    // Only in WezTerm (no tmux) - use WezTerm
    type = "wezterm";
  } else {
    type = "none";
  }

  const summary = type === "none" ? "no terminal multiplexer" : type;
  return { type, inTmux, inWezTerm, summary };
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

  if (env.type === "none") {
    throw new Error(
      "Canvas requires a terminal multiplexer. Please run inside tmux or WezTerm.\n" +
      "Set CANVAS_TERMINAL=tmux or CANVAS_TERMINAL=wezterm to prefer one."
    );
  }

  const scriptDir = import.meta.dir.replace("/src", "");
  const runScript = `${scriptDir}/run-canvas.sh`;
  const socketPath = options?.socketPath || `/tmp/canvas-${id}.sock`;

  let command = `${runScript} show ${kind} --id ${id}`;
  if (configJson) {
    const configFile = `/tmp/canvas-config-${id}.json`;
    await Bun.write(configFile, configJson);
    command += ` --config "$(cat ${configFile})"`;
  }
  command += ` --socket ${socketPath}`;
  if (options?.scenario) {
    command += ` --scenario ${options.scenario}`;
  }

  if (env.type === "wezterm") {
    const result = await spawnWezterm(command);
    if (result) return { method: "wezterm" };
    throw new Error("Failed to spawn WezTerm pane");
  } else {
    const result = await spawnTmux(command);
    if (result) return { method: "tmux" };
    throw new Error("Failed to spawn tmux pane");
  }
}

// ============================================================================
// Pane ID Tracking (shared between backends)
// ============================================================================

const CANVAS_PANE_FILE = "/tmp/claude-canvas-pane-id";
const CANVAS_BACKEND_FILE = "/tmp/claude-canvas-backend";

async function getCanvasPaneId(): Promise<{ paneId: string; backend: TerminalType } | null> {
  try {
    const paneFile = Bun.file(CANVAS_PANE_FILE);
    const backendFile = Bun.file(CANVAS_BACKEND_FILE);

    if (await paneFile.exists() && await backendFile.exists()) {
      const paneId = (await paneFile.text()).trim();
      const backend = (await backendFile.text()).trim() as TerminalType;

      if (!paneId || !backend) return null;

      // Verify pane still exists
      const exists = backend === "wezterm"
        ? await verifyWeztermPane(paneId)
        : await verifyTmuxPane(paneId);

      if (exists) {
        return { paneId, backend };
      }

      // Stale reference - clean up
      await Bun.write(CANVAS_PANE_FILE, "");
      await Bun.write(CANVAS_BACKEND_FILE, "");
    }
  } catch {
    // Ignore errors
  }
  return null;
}

async function saveCanvasPaneId(paneId: string, backend: TerminalType): Promise<void> {
  await Bun.write(CANVAS_PANE_FILE, paneId);
  await Bun.write(CANVAS_BACKEND_FILE, backend);
}

async function verifyTmuxPane(paneId: string): Promise<boolean> {
  const result = spawnSync("tmux", ["display-message", "-t", paneId, "-p", "#{pane_id}"]);
  const output = result.stdout?.toString().trim();
  return result.status === 0 && output === paneId;
}

async function createTmuxPane(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const args = ["split-window", "-h", "-p", "67", "-P", "-F", "#{pane_id}", command];
    const proc = spawn("tmux", args);
    let paneId = "";
    proc.stdout?.on("data", (data) => {
      paneId += data.toString();
    });
    proc.on("close", async (code) => {
      if (code === 0 && paneId.trim()) {
        await saveCanvasPaneId(paneId.trim(), "tmux");
      }
      resolve(code === 0);
    });
    proc.on("error", () => resolve(false));
  });
}

async function reuseTmuxPane(paneId: string, command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const killProc = spawn("tmux", ["send-keys", "-t", paneId, "C-c"]);
    killProc.on("close", () => {
      setTimeout(() => {
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
  const existing = await getCanvasPaneId();

  if (existing?.backend === "tmux") {
    const reused = await reuseTmuxPane(existing.paneId, command);
    if (reused) return true;
    await Bun.write(CANVAS_PANE_FILE, "");
  }

  return createTmuxPane(command);
}

// ============================================================================
// WezTerm Backend
// ============================================================================

async function verifyWeztermPane(paneId: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync("wezterm cli list --format json");
    const panes = JSON.parse(stdout);
    return panes.some((p: { pane_id: number }) => p.pane_id.toString() === paneId);
  } catch {
    return false;
  }
}

async function createWeztermPane(command: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync("wezterm cli split-pane --right --percent 67");
    const paneId = stdout.trim();

    if (!paneId) return false;

    await execAsync(`wezterm cli send-text --pane-id ${paneId} --no-paste 'clear && ${command}\n'`);
    await saveCanvasPaneId(paneId, "wezterm");

    return true;
  } catch (error) {
    console.error("Failed to create WezTerm pane:", error);
    return false;
  }
}

async function reuseWeztermPane(paneId: string, command: string): Promise<boolean> {
  try {
    // Send Ctrl+C to interrupt
    await execAsync(`wezterm cli send-text --pane-id ${paneId} --no-paste '\\003'`);
    await new Promise((resolve) => setTimeout(resolve, 150));
    await execAsync(`wezterm cli send-text --pane-id ${paneId} --no-paste 'clear && ${command}\n'`);
    return true;
  } catch (error) {
    console.error("Failed to reuse WezTerm pane:", error);
    return false;
  }
}

async function spawnWezterm(command: string): Promise<boolean> {
  const existing = await getCanvasPaneId();

  if (existing?.backend === "wezterm") {
    const reused = await reuseWeztermPane(existing.paneId, command);
    if (reused) return true;
    await Bun.write(CANVAS_PANE_FILE, "");
  }

  return createWeztermPane(command);
}

export async function activatePane(paneId: string): Promise<void> {
  const env = detectTerminal();
  if (env.type === "wezterm") {
    await execAsync(`wezterm cli activate-pane --pane-id ${paneId}`);
  } else if (env.type === "tmux") {
    spawnSync("tmux", ["select-pane", "-t", paneId]);
  }
}

export async function getPaneOutput(paneId: string): Promise<string> {
  const env = detectTerminal();
  try {
    if (env.type === "wezterm") {
      const { stdout } = await execAsync(`wezterm cli get-text --pane-id ${paneId}`);
      return stdout;
    } else if (env.type === "tmux") {
      const result = spawnSync("tmux", ["capture-pane", "-t", paneId, "-p"]);
      return result.stdout?.toString() || "";
    }
  } catch {
    // Ignore errors
  }
  return "";
}
