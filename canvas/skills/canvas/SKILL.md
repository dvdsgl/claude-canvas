---
name: canvas
description: |
  **The primary skill for terminal TUI components.** Covers spawning, controlling, and interacting with terminal canvases.
  Use when displaying calendars, documents, or flight bookings.
---

# Canvas TUI Toolkit

**Start here when using terminal canvases.** This skill covers the overall workflow, canvas types, and IPC communication.

## Example Prompts

Try asking Claude things like:

**Calendar:**
- "Schedule a meeting with the team next week"
- "Find a time when Alice and Bob are both free"

**Document:**
- "Draft an email to the sales team about the new feature"
- "Help me edit this document — let me select what to change"

**Flight:**
- "Find flights from SFO to Denver next Friday"
- "Book me a window seat on the morning flight"

## Overview

Canvas provides interactive terminal displays (TUIs) that Claude can spawn and control. Each canvas type supports multiple scenarios for different interaction modes.

## Available Canvas Types

| Canvas | Purpose | Scenarios |
|--------|---------|-----------|
| `calendar` | Display calendars, pick meeting times | `display`, `meeting-picker` |
| `document` | View/edit markdown documents | `display`, `edit`, `email-preview` |
| `flight` | Flight comparison and seat selection | `booking` |
| `triple-vertical` | Three-section vertical workspace layout | `display` |

## Quick Start

```bash
cd ${CLAUDE_PLUGIN_ROOT}

# Run canvas in current terminal
bun run src/cli.ts show calendar

# Spawn canvas in new tmux split
bun run src/cli.ts spawn calendar --scenario meeting-picker --config '{...}'
```

## Spawning Canvases

**Always use `spawn` for interactive scenarios** - this opens the canvas in a tmux split pane while keeping the conversation terminal available.

```bash
bun run src/cli.ts spawn [kind] --scenario [name] --config '[json]'
```

**Parameters:**
- `kind`: Canvas type (calendar, document, flight, triple-vertical)
- `--scenario`: Interaction mode (e.g., display, meeting-picker, edit)
- `--config`: JSON configuration for the canvas
- `--id`: Optional canvas instance ID for IPC
- `--layout`: Layout type - `right` (default, side-by-side) or `triple-vertical` (above/below)

## Triple-Vertical Layout

**IMPORTANT:** To spawn panes above and below Claude Code, use `--layout triple-vertical`:

```bash
bun run src/cli.ts spawn workspace --layout triple-vertical
```

**DO NOT use** `spawn triple-vertical` alone - that spawns a single canvas to the right.

This creates:
- **Top pane** (25%): Terminal/System Monitor
- **Middle** (50%): Claude Code stays in focus
- **Bottom pane** (25%): Output/Build Status

## IPC Communication

Interactive canvases communicate via Unix domain sockets.

**Canvas → Controller:**
```typescript
{ type: "ready", scenario }        // Canvas is ready
{ type: "selected", data }         // User made a selection
{ type: "cancelled", reason? }     // User cancelled
{ type: "error", message }         // Error occurred
```

**Controller → Canvas:**
```typescript
{ type: "update", config }  // Update canvas configuration
{ type: "close" }           // Request canvas to close
{ type: "ping" }            // Health check
```

## Updating Canvases

Send live updates to running canvases using the `update` command:

```bash
bun run src/cli.ts update <canvas-id> --config '<json>'
```

**Example - update a panel:**
```bash
# Write config to avoid shell escaping issues
cat > /tmp/config.json << 'EOF'
{
  "title": "Updated Title",
  "content": "New content here",
  "borderColor": "green"
}
EOF

# Send update
bun run src/cli.ts update my-canvas --config "$(cat /tmp/config.json)"
```

**Triple-vertical layout IDs:**
When spawning with `--id workspace`, the panels are:
- `workspace-top` - Top panel
- `workspace-bottom` - Bottom panel

## High-Level API

For programmatic use, import the API module:

```typescript
import { pickMeetingTime, editDocument, bookFlight } from "${CLAUDE_PLUGIN_ROOT}/src/api";

// Spawn meeting picker and wait for selection
const result = await pickMeetingTime({
  calendars: [...],
  slotGranularity: 30,
});

if (result.success && result.data) {
  console.log(`Selected: ${result.data.startTime}`);
}
```

## Requirements

- **tmux**: Canvas spawning requires a tmux session
- **Terminal with mouse support**: For click-based interactions
- **Bun**: Runtime for executing canvas commands

## Skills Reference

| Skill | Purpose |
|-------|---------|
| `calendar` | Calendar display and meeting picker details |
| `document` | Document rendering and text selection |
| `flight` | Flight comparison and seat map details |
| `triple-vertical` | Three-section vertical workspace layout |
