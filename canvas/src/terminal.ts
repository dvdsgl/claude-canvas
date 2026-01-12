import { spawn, spawnSync } from "child_process";

export interface TerminalEnvironment {
  inTmux: boolean;
  summary: string;
}

export function detectTerminal(): TerminalEnvironment {
  const inTmux = !!process.env.TMUX;
  const summary = inTmux ? "tmux" : "no tmux";
  return { inTmux, summary };
}

export interface SpawnResult {
  method: string;
  pid?: number;
}

export interface SpawnOptions {
  socketPath?: string;
  scenario?: string;
  layout?: "right" | "triple-vertical";  // right = side by side, triple-vertical = above/below
}

export async function spawnCanvas(
  kind: string,
  id: string,
  configJson?: string,
  options?: SpawnOptions
): Promise<SpawnResult> {
  const env = detectTerminal();

  if (!env.inTmux) {
    throw new Error("Canvas requires tmux. Please run inside a tmux session.");
  }

  // Handle triple-vertical layout specially
  if (options?.layout === "triple-vertical") {
    return spawnTripleVerticalLayout(id, configJson, options);
  }

  // Get the directory of this script (skill directory)
  const scriptDir = import.meta.dir.replace("/src", "");
  const runScript = `${scriptDir}/run-canvas.sh`;

  // Auto-generate socket path for IPC if not provided
  const socketPath = options?.socketPath || `/tmp/canvas-${id}.sock`;

  // Build the command to run
  let command = `${runScript} show ${kind} --id ${id}`;
  if (configJson) {
    // Write config to a temp file to avoid shell escaping issues
    const configFile = `/tmp/canvas-config-${id}.json`;
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

// Files to track the triple-vertical pane IDs
const TOP_PANE_FILE = "/tmp/claude-canvas-top-pane-id";
const BOTTOM_PANE_FILE = "/tmp/claude-canvas-bottom-pane-id";

async function spawnTripleVerticalLayout(
  id: string,
  configJson?: string,
  options?: SpawnOptions
): Promise<SpawnResult> {
  const scriptDir = import.meta.dir.replace("/src", "");
  const runScript = `${scriptDir}/run-canvas.sh`;

  // Build commands for top and bottom canvases
  const topId = `${id}-top`;
  const bottomId = `${id}-bottom`;

  // Parse config and create separate configs for top and bottom
  let topConfig = {
    title: "Terminal",
    content: [
      "┌─────────────────────────────────────────────┐",
      "│  Terminal Session - System Monitor         │",
      "├─────────────────────────────────────────────┤",
      "│  CPU: ████████░░░░░░░░  52%                │",
      "│  MEM: ██████████████░░  87%                │",
      "│  DSK: ████░░░░░░░░░░░░  28%                │",
      "├─────────────────────────────────────────────┤",
      "│  Active Processes: 127                     │",
      "│  Network: ↑ 2.3 MB/s  ↓ 15.7 MB/s         │",
      "│  Uptime: 14d 7h 23m                        │",
      "└─────────────────────────────────────────────┘",
    ].join("\n"),
  };

  let bottomConfig = {
    title: "Output",
    content: [
      "┌─────────────────────────────────────────────┐",
      "│  Output Panel - Build Status               │",
      "├─────────────────────────────────────────────┤",
      "│  ✓ TypeScript compiled successfully        │",
      "│  ✓ 47 tests passed                         │",
      "│  ✓ Bundle size: 142kb (gzipped: 48kb)     │",
      "│  ✓ No linting errors                       │",
      "├─────────────────────────────────────────────┤",
      "│  Ready for deployment                      │",
      "└─────────────────────────────────────────────┘",
    ].join("\n"),
  };

  // Write configs to temp files
  const topConfigFile = `/tmp/canvas-config-${topId}.json`;
  const bottomConfigFile = `/tmp/canvas-config-${bottomId}.json`;
  await Bun.write(topConfigFile, JSON.stringify(topConfig));
  await Bun.write(bottomConfigFile, JSON.stringify(bottomConfig));

  // Socket paths for IPC communication
  const topSocketPath = `/tmp/canvas-${topId}.sock`;
  const bottomSocketPath = `/tmp/canvas-${bottomId}.sock`;

  const topCommand = `${runScript} show panel --id ${topId} --config "$(cat ${topConfigFile})" --socket ${topSocketPath}`;
  const bottomCommand = `${runScript} show panel --id ${bottomId} --config "$(cat ${bottomConfigFile})" --socket ${bottomSocketPath}`;

  // Spawn top pane (above current)
  const topSuccess = await createPaneAbove(topCommand, TOP_PANE_FILE);
  if (!topSuccess) {
    throw new Error("Failed to spawn top pane");
  }

  // Spawn bottom pane (below current)
  const bottomSuccess = await createPaneBelow(bottomCommand, BOTTOM_PANE_FILE);
  if (!bottomSuccess) {
    throw new Error("Failed to spawn bottom pane");
  }

  return { method: "tmux-triple-vertical" };
}

async function createPaneAbove(command: string, paneFile: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Use split-window -v -b for vertical split above
    // -p 25 gives the pane 25% of the height
    // -d keeps focus on the original pane
    // -b creates pane before (above) the current one
    const args = ["split-window", "-v", "-b", "-d", "-p", "25", "-P", "-F", "#{pane_id}", command];
    const proc = spawn("tmux", args);
    let paneId = "";
    proc.stdout?.on("data", (data) => {
      paneId += data.toString();
    });
    proc.on("close", async (code) => {
      if (code === 0 && paneId.trim()) {
        await Bun.write(paneFile, paneId.trim());
      }
      resolve(code === 0);
    });
    proc.on("error", () => resolve(false));
  });
}

async function createPaneBelow(command: string, paneFile: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Use split-window -v for vertical split below
    // -p 25 gives the pane 25% of the height
    // -d keeps focus on the original pane
    const args = ["split-window", "-v", "-d", "-p", "25", "-P", "-F", "#{pane_id}", command];
    const proc = spawn("tmux", args);
    let paneId = "";
    proc.stdout?.on("data", (data) => {
      paneId += data.toString();
    });
    proc.on("close", async (code) => {
      if (code === 0 && paneId.trim()) {
        await Bun.write(paneFile, paneId.trim());
      }
      resolve(code === 0);
    });
    proc.on("error", () => resolve(false));
  });
}

// File to track the canvas pane ID
const CANVAS_PANE_FILE = "/tmp/claude-canvas-pane-id";

async function getCanvasPaneId(): Promise<string | null> {
  try {
    const file = Bun.file(CANVAS_PANE_FILE);
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
      await Bun.write(CANVAS_PANE_FILE, "");
    }
  } catch {
    // Ignore errors
  }
  return null;
}

async function saveCanvasPaneId(paneId: string): Promise<void> {
  await Bun.write(CANVAS_PANE_FILE, paneId);
}

async function createNewPane(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Use split-window -h for vertical split (side by side)
    // -p 67 gives canvas 2/3 width (1:2 ratio, Claude:Canvas)
    // -P -F prints the new pane ID so we can save it
    // -d keeps focus on the original pane (don't switch to canvas)
    const args = ["split-window", "-h", "-d", "-p", "67", "-P", "-F", "#{pane_id}", command];
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
    await Bun.write(CANVAS_PANE_FILE, "");
  }

  // Create a new split pane
  return createNewPane(command);
}

