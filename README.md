# Claude Canvas

A TUI toolkit that gives Claude Code its own display. Spawn interactive terminal interfaces for emails, calendars, flight bookings, and more.

**Note:** This is a proof of concept and is unsupported.

![Claude Canvas Screenshot](media/screenshot.png)

## Requirements

### macOS / Linux
- [Bun](https://bun.sh) — used to run skill tools
- [tmux](https://github.com/tmux/tmux) — canvases spawn in split panes

### Windows
- [Bun](https://bun.sh) — used to run skill tools
- [Windows Terminal](https://aka.ms/terminal) — canvases spawn in split panes (recommended)

## Installation

Add this repository as a marketplace in Claude Code:

```
/plugin marketplace add dvdsgl/claude-canvas
```

Then install the canvas plugin:

```
/plugin install canvas@claude-canvas
```

## Windows Setup

Windows support uses Windows Terminal for split panes instead of tmux.

### Install Bun

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

### Install Windows Terminal

Windows Terminal is pre-installed on Windows 11. For Windows 10, install from the [Microsoft Store](https://aka.ms/terminal) or via winget:

```powershell
winget install Microsoft.WindowsTerminal
```

### Running Claude Code in Windows Terminal

For the best experience, run Claude Code from within Windows Terminal. The canvas will automatically detect Windows Terminal and spawn split panes.

If you run Claude Code from a different terminal (cmd.exe, PowerShell outside WT), canvases will open in a new Windows Terminal tab instead.

### Manual Testing

You can test the canvas directly:

```powershell
cd canvas
bun run src/cli.ts env                    # Check terminal detection
bun run src/cli.ts spawn calendar         # Spawn calendar canvas
bun run src/cli.ts spawn calendar --config-file test-calendar.json
```

## Advanced Calendar

The `advanced-calendar` canvas provides a unified calendar experience with display, editing, and meeting picker modes.

### Usage

```powershell
cd canvas
# Regular calendar mode
bun run src/cli.ts spawn advanced-calendar --config-file test-advanced-calendar.json

# Meeting picker mode (multi-calendar overlay)
bun run src/cli.ts spawn advanced-calendar --config-file test-advanced-meeting-picker.json

# Conflict detection test
bun run src/cli.ts spawn advanced-calendar --config-file test-advanced-conflict.json
```

### Features

- **View Modes**: Day (1), Week (2), Month (3)
- **Navigation**: Arrow keys, Shift+arrows (hour jump), j/k (event jump), PageUp/Down (week), Home/End (day bounds)
- **Events**: Create (c), Edit (e), Delete (d) with modal dialogs
- **Conflict Detection**: Tab to cycle through overlapping events
- **Meeting Picker**: Overlay multiple calendars to find free slots
- **Status Line**: Shows cursor position, event details, duration
- **Help**: Press `h` for full keyboard shortcuts

### Configuration

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
    }
  ]
}
```

### Meeting Picker Mode

For scheduling across multiple calendars:

```json
{
  "title": "Find Meeting Time",
  "meetingPickerMode": true,
  "slotGranularity": 30,
  "calendars": [
    {
      "name": "Alice",
      "color": "blue",
      "events": [...]
    },
    {
      "name": "Bob",
      "color": "green",
      "events": [...]
    }
  ]
}
```

Available colors: `blue`, `green`, `magenta`, `yellow`, `cyan`, `red`

### How It Works on Windows

- **IPC**: Uses TCP sockets (localhost) instead of Unix domain sockets
- **Spawning**: Uses `wt.exe` CLI to create split panes or new tabs
- **Launcher Scripts**: Creates temporary `.cmd` files in `%TEMP%` to avoid shell escaping issues

## License

MIT
