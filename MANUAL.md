# Claude Canvas User Manual

A TUI toolkit that gives Claude Code its own display. Spawn interactive terminal interfaces for emails, calendars, flight bookings, and more.

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Canvas Types](#canvas-types)
4. [Basic Commands](#basic-commands)
5. [Virtual Desktop Sessions](#virtual-desktop-sessions)
6. [Advanced Calendar](#advanced-calendar)
7. [IPC Communication](#ipc-communication)
8. [Troubleshooting](#troubleshooting)

---

## Installation

### Prerequisites

#### All Platforms
- [Bun](https://bun.sh) — JavaScript runtime used to run canvas tools

#### Windows
- [Windows Terminal](https://aka.ms/terminal) — Required for split panes (pre-installed on Windows 11)

#### macOS / Linux
- [tmux](https://github.com/tmux/tmux) — Required for split panes

### Install via Claude Code Plugin

```bash
# Add the marketplace
/plugin marketplace add dvdsgl/claude-canvas

# Install the plugin
/plugin install canvas@claude-canvas
```

### Install Bun

**Windows:**
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

**macOS/Linux:**
```bash
curl -fsSL https://bun.sh/install | bash
```

### Install Windows Terminal (Windows 10)

```powershell
winget install Microsoft.WindowsTerminal
```

---

## Quick Start

### Spawn a Canvas

From the `canvas` directory:

```bash
# Show terminal environment info
bun run src/cli.ts env

# Spawn a demo canvas in a split pane
bun run src/cli.ts spawn demo

# Spawn an advanced calendar
bun run src/cli.ts spawn advanced-calendar --config-file test-advanced-calendar.json
```

### Basic Workflow

1. Run Claude Code from Windows Terminal (for split pane support)
2. Ask Claude to spawn a canvas for your task
3. Interact with the canvas using keyboard shortcuts
4. Canvas sends selections/data back to Claude via IPC

---

## Canvas Types

| Canvas | Description |
|--------|-------------|
| `demo` | Basic demonstration canvas |
| `calendar` | Simple calendar view |
| `advanced-calendar` | Full-featured calendar with editing |
| `document` | Text document editor |

---

## Basic Commands

### Show a Canvas (Current Terminal)

```bash
bun run src/cli.ts show <canvas-type> [options]

Options:
  --id <id>              Canvas ID for IPC
  --config <json>        Inline JSON configuration
  --config-file <path>   Path to JSON config file
  --socket <path>        Socket path for IPC
  --scenario <name>      Scenario name (display, meeting-picker, etc.)
```

### Spawn a Canvas (New Pane/Window)

```bash
bun run src/cli.ts spawn <canvas-type> [options]

# Same options as 'show'
```

### Send Updates to Running Canvas

```bash
bun run src/cli.ts update <id> --config '{"key": "value"}'
```

### Get Canvas Data

```bash
# Get selected text from document canvas
bun run src/cli.ts selection <id>

# Get full content from document canvas
bun run src/cli.ts content <id>
```

### Check Environment

```bash
bun run src/cli.ts env
```

Output:
```
Terminal Environment:
  Platform: windows
  Terminal: Windows Terminal
  Can split panes: true
  In Windows Terminal: true
  WT_SESSION: {guid}

Summary: Windows Terminal
```

---

## Virtual Desktop Sessions

Virtual desktop sessions allow you to manage multiple canvas windows on a dedicated Windows virtual desktop.

### Prerequisites

Install the PSVirtualDesktop PowerShell module:

```powershell
Install-Module VirtualDesktop -Scope CurrentUser
```

### Check Dependencies

```bash
bun run src/cli.ts check-deps
```

### Session Commands

#### Start a Session

```bash
bun run src/cli.ts session start [options]

Options:
  -n, --name <name>      Desktop name (default: "Canvas Session")
  -w, --windows <count>  Number of windows to create (default: 2)
```

Example:
```bash
# Create session with 3 windows
bun run src/cli.ts session start -w 3 -n "My Canvas Workspace"
```

#### Stop a Session

```bash
bun run src/cli.ts session stop [--keep-desktop]
```

#### View Session Status

```bash
bun run src/cli.ts session status
```

Output:
```
Canvas Session Status
=====================
  Desktop: Canvas Session (index 2)
  Main desktop: 0
  Windows: 3
  Active canvases: 2
  Created: 2026-01-14T10:30:00.000Z

Windows:
  win-abc123: calendar (calendar-xyz789)
  win-def456: advanced-calendar (advanced-calendar-uvw012)
  win-ghi789: (empty)
```

#### Reconnect After Restart

```bash
bun run src/cli.ts session reconnect
```

### Window Commands

#### List Windows

```bash
bun run src/cli.ts window list
```

#### Add a Window

```bash
bun run src/cli.ts window add [canvas-type] [options]

Options:
  --config <json>        Inline JSON configuration
  --config-file <path>   Path to JSON config file
```

Examples:
```bash
# Add empty window
bun run src/cli.ts window add

# Add window with calendar
bun run src/cli.ts window add calendar

# Add window with configured calendar
bun run src/cli.ts window add advanced-calendar --config-file my-calendar.json
```

#### Close a Window

```bash
bun run src/cli.ts window close <window-id>
```

#### Focus a Window

```bash
bun run src/cli.ts window focus <window-id>
```

### Canvas Assignment

#### Assign Canvas to Window

```bash
bun run src/cli.ts assign <window-id> <canvas-type> [options]

Options:
  --config <json>        Inline JSON configuration
  --config-file <path>   Path to JSON config file
```

Example:
```bash
bun run src/cli.ts assign win-abc123 advanced-calendar --config-file meeting-picker.json
```

#### Swap Canvases Between Windows

```bash
bun run src/cli.ts swap <window-id-1> <window-id-2>
```

### Desktop Navigation

```bash
# Switch to canvas desktop
bun run src/cli.ts focus-desktop

# Switch back to main desktop
bun run src/cli.ts home
```

---

## Advanced Calendar

The advanced calendar provides a unified experience for viewing, editing, and scheduling.

### Modes

1. **Display Mode** — View and navigate events
2. **Edit Mode** — Create, edit, and delete events
3. **Meeting Picker Mode** — Find free time across multiple calendars

### Keyboard Shortcuts

Press `h` in the calendar to see full help.

#### Navigation

| Key | Action |
|-----|--------|
| `←` `→` `↑` `↓` | Move cursor |
| `Shift+↑` `Shift+↓` | Jump by hour |
| `j` / `k` | Jump to next/previous event |
| `PageUp` / `PageDown` | Previous/next week |
| `Home` / `End` | Start/end of day |
| `t` | Jump to today/now |

#### View Modes

| Key | Action |
|-----|--------|
| `1` | Day view |
| `2` | Week view |
| `3` | Month view |

#### Event Operations

| Key | Action |
|-----|--------|
| `c` | Create new event |
| `e` | Edit selected event |
| `d` | Delete selected event |
| `Tab` | Cycle through overlapping events |

#### General

| Key | Action |
|-----|--------|
| `h` / `?` | Toggle help overlay |
| `Enter` | Confirm selection |
| `Esc` | Cancel / close dialog |
| `q` | Quit |

### Configuration

#### Basic Calendar

```json
{
  "title": "My Calendar",
  "editable": true,
  "defaultView": "week",
  "startHour": 8,
  "endHour": 18,
  "workingHoursStart": 9,
  "workingHoursEnd": 17,
  "events": [
    {
      "id": "evt1",
      "title": "Team Meeting",
      "startTime": "2026-01-13T09:00:00",
      "endTime": "2026-01-13T10:00:00",
      "color": "blue"
    },
    {
      "id": "evt2",
      "title": "Lunch",
      "startTime": "2026-01-13T12:00:00",
      "endTime": "2026-01-13T13:00:00",
      "color": "green"
    }
  ]
}
```

#### Meeting Picker Mode

```json
{
  "title": "Find Meeting Time",
  "meetingPickerMode": true,
  "slotGranularity": 30,
  "calendars": [
    {
      "name": "Alice",
      "color": "blue",
      "events": [
        {
          "id": "a1",
          "title": "Alice's Meeting",
          "startTime": "2026-01-13T09:00:00",
          "endTime": "2026-01-13T10:00:00"
        }
      ]
    },
    {
      "name": "Bob",
      "color": "green",
      "events": [
        {
          "id": "b1",
          "title": "Bob's Call",
          "startTime": "2026-01-13T14:00:00",
          "endTime": "2026-01-13T15:00:00"
        }
      ]
    }
  ]
}
```

### Available Colors

- `blue` — Default, professional
- `green` — Meetings, available
- `magenta` — Important, priority
- `yellow` — Warnings, tentative
- `cyan` — Personal, info
- `red` — Conflicts, blocked

### Status Line

The status line at the bottom shows:
- Current date/time at cursor position
- Selected event title and duration
- Conflict indicator with Tab hint
- View mode indicator

---

## IPC Communication

Canvases communicate with Claude Code via IPC (Inter-Process Communication).

### Protocol

- **Windows:** TCP sockets on localhost
- **Unix/macOS:** Unix domain sockets

### Message Types

#### Canvas → Controller

```typescript
{ type: "ready", scenario: "display" }
{ type: "selected", data: { /* selection data */ } }
{ type: "cancelled", reason: "user closed" }
{ type: "error", message: "Something went wrong" }
{ type: "selection", data: { selectedText, startOffset, endOffset } }
{ type: "content", data: { content, cursorPosition } }
```

#### Controller → Canvas

```typescript
{ type: "update", config: { /* new configuration */ } }
{ type: "close" }
{ type: "ping" }
{ type: "getSelection" }
{ type: "getContent" }
```

### Port Files (Windows)

On Windows, canvas ports are stored in temp files:
```
%TEMP%\canvas-<id>.port
```

---

## Troubleshooting

### Bun Not Found

Ensure Bun is in your PATH:

```powershell
# Windows
$env:Path = "$env:USERPROFILE\.bun\bin;" + $env:Path
```

```bash
# Unix/macOS
export PATH="$HOME/.bun/bin:$PATH"
```

### Windows Terminal Not Detected

Make sure you're running Claude Code from within Windows Terminal, not cmd.exe or PowerShell directly.

Check with:
```bash
bun run src/cli.ts env
```

If `In Windows Terminal: false`, open Windows Terminal and run Claude Code from there.

### VirtualDesktop Module Not Found

Install the PowerShell module:
```powershell
Install-Module VirtualDesktop -Scope CurrentUser -Force
```

If you get permission errors:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Canvas Window Not Appearing

1. Check if Windows Terminal is installed
2. Ensure you have the VirtualDesktop module for session management
3. Check the session status: `bun run src/cli.ts session status`

### Session Reconnect Fails

The session file may be stale. Delete it and start fresh:

```powershell
Remove-Item "$env:TEMP\canvas-session.json" -Force
bun run src/cli.ts session start
```

### Tmux Issues (macOS/Linux)

Ensure you're running inside a tmux session:

```bash
tmux new-session -s claude
# Then run Claude Code
```

---

## File Structure

```
canvas/
├── src/
│   ├── cli.ts              # CLI entry point
│   ├── terminal.ts         # Terminal detection and spawning
│   ├── session.ts          # Virtual desktop session management
│   ├── virtual-desktop.ts  # PSVirtualDesktop wrapper
│   ├── window-manager.ts   # Window tracking and canvas assignment
│   ├── canvases/           # Canvas components (React/Ink)
│   │   ├── index.tsx       # Canvas dispatcher
│   │   ├── advanced-calendar.tsx
│   │   └── ...
│   ├── ipc/                # IPC server/client
│   │   ├── server.ts
│   │   ├── client.ts
│   │   └── types.ts
│   └── api/                # High-level API
├── skills/                 # Skill documentation
├── commands/               # User commands
├── test-*.json            # Test configuration files
└── package.json
```

---

## License

MIT
