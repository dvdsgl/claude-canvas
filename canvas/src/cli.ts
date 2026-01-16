#!/usr/bin/env bun
import { program } from "commander";
import type { Socket } from "bun";
import { detectTerminal, spawnCanvas, getTerminalInfo } from "./terminal";
import { isWindows, getSocketPath, getPortFilePath } from "./ipc/types";
import { existsSync } from "node:fs";
import * as session from "./session";
import type { CanvasWindow } from "./window-manager";

// Type for IPC socket
type IPCSocket = Socket<undefined>;

// Set window title via ANSI escape codes
function setWindowTitle(title: string) {
  process.stdout.write(`\x1b]0;${title}\x07`);
}

program
  .name("claude-canvas")
  .description("Interactive terminal canvases for Claude")
  .version("1.0.0");

program
  .command("show [kind]")
  .description("Show a canvas in the current terminal")
  .option("--id <id>", "Canvas ID")
  .option("--config <json>", "Canvas configuration (JSON)")
  .option("--config-file <path>", "Path to config file (JSON)")
  .option("--socket <path>", "Socket path for IPC (Unix) or socket identifier (Windows)")
  .option("--scenario <name>", "Scenario name (e.g., display, meeting-picker)")
  .action(async (kind = "demo", options) => {
    const id = options.id || `${kind}-1`;

    // Load config from file or inline JSON
    let config: unknown;
    if (options.configFile) {
      try {
        const file = Bun.file(options.configFile);
        const content = await file.text();
        config = JSON.parse(content);
      } catch (e) {
        console.error(`Failed to load config file: ${options.configFile}`);
        process.exit(1);
      }
    } else if (options.config) {
      try {
        config = JSON.parse(options.config);
      } catch (e) {
        console.error(`Invalid JSON in --config option: ${(e as Error).message}`);
        process.exit(1);
      }
    }

    const socketPath = options.socket;
    const scenario = options.scenario || "display";

    // Set window title
    setWindowTitle(`canvas: ${kind}`);

    // Dynamically import and render the canvas
    const { renderCanvas } = await import("./canvases");
    await renderCanvas(kind, id, config, { socketPath, scenario });
  });

program
  .command("spawn [kind]")
  .description("Spawn a canvas in a new terminal window/pane")
  .option("--id <id>", "Canvas ID")
  .option("--config <json>", "Canvas configuration (JSON)")
  .option("--config-file <path>", "Path to config file (JSON)")
  .option("--socket <path>", "Socket path for IPC")
  .option("--scenario <name>", "Scenario name (e.g., display, meeting-picker)")
  .action(async (kind = "demo", options) => {
    const id = options.id || `${kind}-1`;

    // Load config from file or inline JSON
    let configJson: string | undefined;
    if (options.configFile) {
      try {
        const file = Bun.file(options.configFile);
        configJson = await file.text();
      } catch (e) {
        console.error(`Failed to load config file: ${options.configFile}`);
        process.exit(1);
      }
    } else if (options.config) {
      configJson = options.config;
    }

    const result = await spawnCanvas(kind, id, configJson, {
      socketPath: options.socket,
      scenario: options.scenario,
    });
    console.log(`Spawned ${kind} canvas '${id}' via ${result.method}`);
  });

program
  .command("env")
  .description("Show detected terminal environment")
  .action(() => {
    const env = detectTerminal();
    const info = getTerminalInfo();

    console.log("Terminal Environment:");
    console.log(`  Platform: ${info.platform}`);
    console.log(`  Terminal: ${info.terminal}`);
    console.log(`  Can split panes: ${info.canSplit}`);

    if (isWindows) {
      console.log(`  In Windows Terminal: ${env.inWindowsTerminal}`);
      console.log(`  WT_SESSION: ${process.env.WT_SESSION || "(not set)"}`);
    } else {
      console.log(`  In tmux: ${env.inTmux}`);
      console.log(`  TMUX: ${process.env.TMUX || "(not set)"}`);
    }

    console.log(`\nSummary: ${env.summary}`);
  });

program
  .command("update <id>")
  .description("Send updated config to a running canvas via IPC")
  .option("--config <json>", "New canvas configuration (JSON)")
  .action(async (id: string, options) => {
    const socketPath = getSocketPath(id);
    let config = {};
    if (options.config) {
      try {
        config = JSON.parse(options.config);
      } catch (e) {
        console.error(`Invalid JSON in --config option: ${(e as Error).message}`);
        process.exit(1);
      }
    }

    try {
      await connectAndSend(id, socketPath, { type: "update", config });
      console.log(`Sent update to canvas '${id}'`);
    } catch (err) {
      console.error(`Failed to connect to canvas '${id}':`, err);
    }
  });

program
  .command("selection <id>")
  .description("Get the current selection from a running document canvas")
  .action(async (id: string) => {
    const socketPath = getSocketPath(id);

    try {
      const result = await sendAndReceive(id, socketPath, { type: "getSelection" });
      if (result && result.type === "selection") {
        console.log(JSON.stringify(result.data));
      } else {
        console.log(JSON.stringify(null));
      }
    } catch (err) {
      console.error(`Failed to get selection from canvas '${id}':`, err);
      process.exit(1);
    }
  });

program
  .command("content <id>")
  .description("Get the current content from a running document canvas")
  .action(async (id: string) => {
    const socketPath = getSocketPath(id);

    try {
      const result = await sendAndReceive(id, socketPath, { type: "getContent" });
      if (result && result.type === "content") {
        console.log(JSON.stringify(result.data));
      } else {
        console.log(JSON.stringify(null));
      }
    } catch (err) {
      console.error(`Failed to get content from canvas '${id}':`, err);
      process.exit(1);
    }
  });

// ============================================
// Cross-platform IPC helpers
// ============================================

async function getConnection(id: string, socketPath: string): Promise<{
  type: "unix" | "tcp";
  socketPath?: string;
  host?: string;
  port?: number;
}> {
  if (isWindows) {
    // On Windows, read port from port file
    const portFile = getPortFilePath(id);
    const file = Bun.file(portFile);

    if (!(await file.exists())) {
      throw new Error(`Port file not found: ${portFile}`);
    }

    const port = parseInt((await file.text()).trim(), 10);
    if (isNaN(port)) {
      throw new Error(`Invalid port in port file: ${portFile}`);
    }

    return { type: "tcp", host: "127.0.0.1", port };
  } else {
    return { type: "unix", socketPath };
  }
}

async function connectAndSend(id: string, socketPath: string, message: unknown): Promise<void> {
  const conn = await getConnection(id, socketPath);

  if (conn.type === "tcp") {
    const socket = await Bun.connect({
      hostname: conn.host!,
      port: conn.port!,
      socket: {
        data() {},
        open(socket) {
          const msg = JSON.stringify(message);
          socket.write(msg + "\n");
          socket.end();
        },
        close() {},
        error(socket, error) {
          console.error("Socket error:", error);
        },
      },
    });
  } else {
    const socket = await Bun.connect({
      unix: conn.socketPath!,
      socket: {
        data() {},
        open(socket) {
          const msg = JSON.stringify(message);
          socket.write(msg + "\n");
          socket.end();
        },
        close() {},
        error(socket, error) {
          console.error("Socket error:", error);
        },
      },
    });
  }
}

async function sendAndReceive(id: string, socketPath: string, message: unknown): Promise<unknown> {
  const conn = await getConnection(id, socketPath);

  return new Promise((resolve, reject) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error("Timeout waiting for response"));
      }
    }, 2000);

    const socketHandlers = {
      data(socket: IPCSocket, data: Buffer) {
        if (resolved) return;
        clearTimeout(timeout);
        resolved = true;
        try {
          const response = JSON.parse(data.toString().trim());
          resolve(response);
        } catch (err) {
          // Invalid JSON response from canvas - treat as no response
          resolve(null);
        }
        socket.end();
      },
      open(socket: IPCSocket) {
        const msg = JSON.stringify(message);
        socket.write(msg + "\n");
      },
      close() {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(null);
        }
      },
      error(socket: IPCSocket, error: Error) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(error);
        }
      },
    };

    // Connect based on connection type
    const connectPromise = conn.type === "tcp"
      ? Bun.connect({
          hostname: conn.host!,
          port: conn.port!,
          socket: socketHandlers,
        })
      : Bun.connect({
          unix: conn.socketPath!,
          socket: socketHandlers,
        });

    connectPromise.catch((err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });
  });
}

// ============================================
// Session Management Commands
// ============================================

const sessionCmd = program
  .command("session")
  .description("Manage canvas virtual desktop sessions");

sessionCmd
  .command("start")
  .description("Start a new canvas session with dedicated virtual desktop")
  .option("-n, --name <name>", "Desktop name", "Canvas Session")
  .option("-w, --windows <count>", "Number of windows to create", "2")
  .action(async (options) => {
    try {
      // Check dependencies first
      const deps = await session.checkDependencies();
      if (!deps.ready) {
        console.error(`Error: ${deps.error}`);
        if (!deps.moduleInstalled) {
          console.log("\nTo install the VirtualDesktop module:");
          console.log("  Install-Module VirtualDesktop -Scope CurrentUser");
        }
        process.exit(1);
      }

      console.log("Starting canvas session...");
      const state = await session.startSession({
        name: options.name,
        windowCount: parseInt(options.windows, 10),
      });

      console.log(`\nSession started successfully!`);
      console.log(`  Desktop: ${state.desktopName} (index ${state.desktopIndex})`);
      console.log(`  Windows: ${state.windows.length}`);
      console.log(`\nWindow IDs:`);
      for (const win of state.windows) {
        console.log(`  - ${win.id}`);
      }
      console.log(`\nUse 'canvas session status' to view session info`);
      console.log(`Use 'canvas assign <window-id> <canvas-kind>' to assign canvases`);
    } catch (err) {
      console.error(`Failed to start session: ${err}`);
      process.exit(1);
    }
  });

sessionCmd
  .command("stop")
  .description("Stop the current canvas session")
  .option("--keep-desktop", "Keep the virtual desktop after stopping")
  .action(async (options) => {
    try {
      await session.stopSession({
        removeDesktop: !options.keepDesktop,
      });
    } catch (err) {
      console.error(`Failed to stop session: ${err}`);
      process.exit(1);
    }
  });

sessionCmd
  .command("status")
  .description("Show current session status")
  .action(async () => {
    try {
      const info = await session.getSessionInfo();

      if (!info.isRunning) {
        console.log("No active canvas session");
        console.log("\nStart one with: canvas session start");
        return;
      }

      console.log("Canvas Session Status");
      console.log("=====================");
      console.log(`  Desktop: ${info.desktopName} (index ${info.desktopIndex})`);
      console.log(`  Main desktop: ${info.mainDesktopIndex}`);
      console.log(`  Windows: ${info.windowCount}`);
      console.log(`  Active canvases: ${info.activeCanvases}`);
      console.log(`  Created: ${info.createdAt}`);

      // List windows
      const windows = await session.listWindows();
      if (windows.length > 0) {
        console.log("\nWindows:");
        for (const win of windows) {
          const canvas = win.canvasKind ? `${win.canvasKind} (${win.canvasId})` : "(empty)";
          console.log(`  ${win.id}: ${canvas}`);
        }
      }
    } catch (err) {
      console.error(`Failed to get session status: ${err}`);
      process.exit(1);
    }
  });

sessionCmd
  .command("reconnect")
  .description("Reconnect to an existing session after restart")
  .action(async () => {
    try {
      const state = await session.reconnectSession();
      if (!state) {
        console.log("No session to reconnect to");
        return;
      }

      console.log("Reconnected to session:");
      console.log(`  Desktop: ${state.desktopName}`);
      console.log(`  Windows: ${state.windows.length}`);
    } catch (err) {
      console.error(`Failed to reconnect: ${err}`);
      process.exit(1);
    }
  });

// ============================================
// Window Management Commands
// ============================================

const windowCmd = program
  .command("window")
  .description("Manage canvas windows");

windowCmd
  .command("list")
  .description("List all windows in the current session")
  .action(async () => {
    try {
      const windows = await session.listWindows();

      if (windows.length === 0) {
        console.log("No windows in session");
        return;
      }

      console.log("Windows:");
      for (const win of windows) {
        const canvas = win.canvasKind ? `${win.canvasKind}` : "(empty)";
        console.log(`  ${win.id}: ${canvas}`);
        console.log(`    Handle: ${win.windowHandle}`);
        if (win.canvasId) {
          console.log(`    Canvas ID: ${win.canvasId}`);
        }
      }
    } catch (err) {
      console.error(`Failed to list windows: ${err}`);
      process.exit(1);
    }
  });

windowCmd
  .command("add [kind]")
  .description("Add a new window to the session")
  .option("--config <json>", "Canvas configuration (JSON)")
  .option("--config-file <path>", "Path to config file (JSON)")
  .action(async (kind, options) => {
    try {
      let config: unknown;
      if (options.configFile) {
        try {
          const file = Bun.file(options.configFile);
          config = JSON.parse(await file.text());
        } catch (e) {
          console.error(`Failed to load or parse config file: ${(e as Error).message}`);
          process.exit(1);
        }
      } else if (options.config) {
        try {
          config = JSON.parse(options.config);
        } catch (e) {
          console.error(`Invalid JSON in --config option: ${(e as Error).message}`);
          process.exit(1);
        }
      }

      const window = await session.addWindow(kind, config);
      console.log(`Added window: ${window.id}`);
      if (window.canvasKind) {
        console.log(`  Canvas: ${window.canvasKind}`);
      }
    } catch (err) {
      console.error(`Failed to add window: ${err}`);
      process.exit(1);
    }
  });

windowCmd
  .command("close <window-id>")
  .description("Close a window")
  .action(async (windowId) => {
    try {
      await session.closeWindow(windowId);
      console.log(`Closed window: ${windowId}`);
    } catch (err) {
      console.error(`Failed to close window: ${err}`);
      process.exit(1);
    }
  });

windowCmd
  .command("focus <window-id>")
  .description("Focus a specific window")
  .action(async (windowId) => {
    try {
      await session.focusWindow(windowId);
      console.log(`Focused window: ${windowId}`);
    } catch (err) {
      console.error(`Failed to focus window: ${err}`);
      process.exit(1);
    }
  });

// ============================================
// Canvas Assignment Commands
// ============================================

program
  .command("assign <window-id> <canvas-kind>")
  .description("Assign a canvas to a window")
  .option("--config <json>", "Canvas configuration (JSON)")
  .option("--config-file <path>", "Path to config file (JSON)")
  .action(async (windowId, canvasKind, options) => {
    try {
      let config: unknown;
      if (options.configFile) {
        try {
          const file = Bun.file(options.configFile);
          config = JSON.parse(await file.text());
        } catch (e) {
          console.error(`Failed to load or parse config file: ${(e as Error).message}`);
          process.exit(1);
        }
      } else if (options.config) {
        try {
          config = JSON.parse(options.config);
        } catch (e) {
          console.error(`Invalid JSON in --config option: ${(e as Error).message}`);
          process.exit(1);
        }
      }

      const window = await session.assignCanvas(windowId, canvasKind, config);
      console.log(`Assigned ${canvasKind} canvas to window ${windowId}`);
      console.log(`  Canvas ID: ${window.canvasId}`);
    } catch (err) {
      console.error(`Failed to assign canvas: ${err}`);
      process.exit(1);
    }
  });

program
  .command("swap <window-id-1> <window-id-2>")
  .description("Swap canvases between two windows")
  .action(async (windowId1, windowId2) => {
    try {
      await session.swapCanvases(windowId1, windowId2);
      console.log(`Swapped canvases between ${windowId1} and ${windowId2}`);
    } catch (err) {
      console.error(`Failed to swap canvases: ${err}`);
      process.exit(1);
    }
  });

// ============================================
// Desktop Navigation Commands
// ============================================

program
  .command("focus-desktop")
  .description("Switch to the canvas desktop")
  .action(async () => {
    try {
      await session.switchToCanvasDesktop();
      console.log("Switched to canvas desktop");
    } catch (err) {
      console.error(`Failed to switch desktop: ${err}`);
      process.exit(1);
    }
  });

program
  .command("home")
  .description("Switch back to the main desktop")
  .action(async () => {
    try {
      await session.switchToMainDesktop();
      console.log("Switched to main desktop");
    } catch (err) {
      console.error(`Failed to switch desktop: ${err}`);
      process.exit(1);
    }
  });

// ============================================
// Grid Management Commands
// ============================================

const gridCmd = program
  .command("grid")
  .description("Manage grid-based window layout");

gridCmd
  .command("configure")
  .description("Configure grid dimensions and margins")
  .option("-r, --rows <count>", "Number of rows", "3")
  .option("-c, --columns <count>", "Number of columns", "3")
  .option("-g, --gap <pixels>", "Gap between cells", "4")
  .option("--gap-h <pixels>", "Horizontal gap (overrides --gap)")
  .option("--gap-v <pixels>", "Vertical gap (overrides --gap)")
  .option("-m, --monitor <index>", "Monitor index", "0")
  .option("--margin-top <pixels>", "Top margin")
  .option("--margin-bottom <pixels>", "Bottom margin")
  .option("--margin-left <pixels>", "Left margin")
  .option("--margin-right <pixels>", "Right margin")
  .option("--margin <pixels>", "All margins")
  .action(async (options) => {
    try {
      const gap = parseInt(options.gap, 10);
      const margin = options.margin ? parseInt(options.margin, 10) : 0;

      const gridState = await session.configureGrid({
        rows: parseInt(options.rows, 10),
        columns: parseInt(options.columns, 10),
        cellGapHorizontal: options.gapH ? parseInt(options.gapH, 10) : gap,
        cellGapVertical: options.gapV ? parseInt(options.gapV, 10) : gap,
        monitorIndex: parseInt(options.monitor, 10),
        marginTop: options.marginTop ? parseInt(options.marginTop, 10) : margin,
        marginBottom: options.marginBottom ? parseInt(options.marginBottom, 10) : margin,
        marginLeft: options.marginLeft ? parseInt(options.marginLeft, 10) : margin,
        marginRight: options.marginRight ? parseInt(options.marginRight, 10) : margin,
      });

      console.log("Grid configured:");
      console.log(`  Rows: ${gridState.config.rows}`);
      console.log(`  Columns: ${gridState.config.columns}`);
      console.log(`  Monitor: ${gridState.config.monitorIndex}`);
      console.log(`  Gaps: ${gridState.config.cellGapHorizontal}x${gridState.config.cellGapVertical}px`);
    } catch (err) {
      console.error(`Failed to configure grid: ${err}`);
      process.exit(1);
    }
  });

gridCmd
  .command("assign <window-id> <cell-spec>")
  .description("Assign a window to grid cell(s)")
  .addHelpText("after", `
Cell spec formats:
  A1        Single cell (Excel-style)
  A1:B2     Range of cells (Excel-style)
  0,0       Single cell (row,column)
  0,0:2x3   Span starting at (0,0), 2 rows x 3 columns
`)
  .option("--no-position", "Don't immediately position the window")
  .action(async (windowId, cellSpec, options) => {
    try {
      const window = await session.assignWindowToCell(windowId, cellSpec, options.position);
      const specLabel = session.formatCellSpecExcel(window.gridAssignment!);
      console.log(`Assigned ${windowId} to cell ${specLabel}`);
      if (options.position && window.position) {
        console.log(`  Position: (${window.position.x}, ${window.position.y})`);
        console.log(`  Size: ${window.position.width}x${window.position.height}`);
      }
    } catch (err) {
      console.error(`Failed to assign window: ${err}`);
      process.exit(1);
    }
  });

gridCmd
  .command("show")
  .description("Display grid layout visualization")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    try {
      if (options.json) {
        const layout = await session.getGridLayout();
        if (!layout) {
          console.log("{}");
          return;
        }
        console.log(JSON.stringify(layout, null, 2));
      } else {
        const viz = await session.visualizeGrid();
        console.log(viz);
      }
    } catch (err) {
      console.error(`Failed to show grid: ${err}`);
      process.exit(1);
    }
  });

gridCmd
  .command("move <window-id> <cell-spec>")
  .description("Move a window to a different cell")
  .option("--no-position", "Don't immediately position the window")
  .action(async (windowId, cellSpec, options) => {
    try {
      await session.moveWindowInGrid(windowId, cellSpec, options.position);
      console.log(`Moved ${windowId} to ${cellSpec}`);
    } catch (err) {
      console.error(`Failed to move window: ${err}`);
      process.exit(1);
    }
  });

gridCmd
  .command("swap <window-id-1> <window-id-2>")
  .description("Swap grid positions of two windows")
  .option("--no-position", "Don't immediately reposition windows")
  .action(async (windowId1, windowId2, options) => {
    try {
      await session.swapGridPositions(windowId1, windowId2, options.position);
      console.log(`Swapped positions of ${windowId1} and ${windowId2}`);
    } catch (err) {
      console.error(`Failed to swap positions: ${err}`);
      process.exit(1);
    }
  });

gridCmd
  .command("apply")
  .description("Reposition all windows according to grid assignments")
  .action(async () => {
    try {
      const result = await session.applyGridPositions();
      console.log(`Positioned ${result.positioned.length} windows`);
      if (result.failed.length > 0) {
        console.log(`Failed to position: ${result.failed.join(", ")}`);
      }
    } catch (err) {
      console.error(`Failed to apply positions: ${err}`);
      process.exit(1);
    }
  });

gridCmd
  .command("info")
  .description("Show grid and monitor information")
  .action(async () => {
    try {
      const config = await session.getGridConfig();
      if (!config) {
        console.log("No grid configured");
        console.log("\nConfigure one with: canvas grid configure");
        return;
      }

      console.log("Grid Configuration:");
      console.log(`  Dimensions: ${config.rows} rows x ${config.columns} columns`);
      console.log(`  Gaps: ${config.cellGapHorizontal}x${config.cellGapVertical}px`);
      console.log(`  Margins: T${config.marginTop} B${config.marginBottom} L${config.marginLeft} R${config.marginRight}`);

      const monitor = await session.getMonitorInfo();
      if (monitor) {
        console.log(`\nMonitor ${config.monitorIndex}:`);
        console.log(`  Work area: ${monitor.workAreaWidth}x${monitor.workAreaHeight}`);
        console.log(`  Position: (${monitor.workAreaX}, ${monitor.workAreaY})`);
        console.log(`  Primary: ${monitor.isPrimary ? "yes" : "no"}`);
      }

      const available = await session.getAvailableCells();
      console.log(`\nAvailable cells: ${available.length}`);
      if (available.length > 0 && available.length <= 9) {
        const cellNames = available.map(c => {
          // Import cell notation function inline since we can't add imports mid-file
          const colStr = String.fromCharCode(65 + c.column);
          const rowStr = (c.row + 1).toString();
          return colStr + rowStr;
        });
        console.log(`  ${cellNames.join(", ")}`);
      }
    } catch (err) {
      console.error(`Failed to get grid info: ${err}`);
      process.exit(1);
    }
  });

gridCmd
  .command("remove <window-id>")
  .description("Remove a window from the grid (keeps window open)")
  .action(async (windowId) => {
    try {
      await session.removeWindowFromGrid(windowId);
      console.log(`Removed ${windowId} from grid`);
    } catch (err) {
      console.error(`Failed to remove from grid: ${err}`);
      process.exit(1);
    }
  });

gridCmd
  .command("monitors")
  .description("List all available monitors")
  .action(async () => {
    try {
      const monitors = await session.getAllMonitors();
      console.log("Available Monitors:");
      for (const m of monitors) {
        console.log(`\n  Monitor ${m.index}:`);
        console.log(`    Device: ${m.name}`);
        console.log(`    Resolution: ${m.width}x${m.height}`);
        console.log(`    Work area: ${m.workAreaWidth}x${m.workAreaHeight} at (${m.workAreaX}, ${m.workAreaY})`);
        console.log(`    Primary: ${m.isPrimary ? "yes" : "no"}`);
      }
    } catch (err) {
      console.error(`Failed to list monitors: ${err}`);
      process.exit(1);
    }
  });

// ============================================
// Dependency Check Command
// ============================================

program
  .command("check-deps")
  .description("Check if all dependencies are installed")
  .action(async () => {
    console.log("Checking dependencies...\n");

    const deps = await session.checkDependencies();

    console.log(`Platform: ${deps.platform}`);
    console.log(`VirtualDesktop module: ${deps.moduleInstalled ? "installed" : "not installed"}`);
    console.log(`Ready: ${deps.ready ? "yes" : "no"}`);

    if (deps.error) {
      console.log(`\nIssue: ${deps.error}`);
    }

    if (!deps.moduleInstalled && deps.platform === "win32") {
      console.log("\nTo install the VirtualDesktop PowerShell module:");
      console.log("  Install-Module VirtualDesktop -Scope CurrentUser");
    }
  });

program.parse();
