---
name: triple-vertical
description: |
  Three-section vertical workspace layout with terminal, Claude Code, and output panels.
  IMPORTANT: Use --layout triple-vertical flag to spawn panes above and below Claude Code.
---

# Triple Vertical Canvas

Spawn a three-section vertical workspace layout with tmux panes **above and below** Claude Code.

## IMPORTANT: Correct Command

**DO NOT use:** `spawn triple-vertical` (this spawns a single canvas to the right)

**USE THIS COMMAND:**
```bash
bun run src/cli.ts spawn workspace --layout triple-vertical
```

The `--layout triple-vertical` flag is what creates panes above and below.

## Layout

This layout spawns **two separate tmux panes** while keeping Claude Code in focus:

```
┌──────────────────────────────────┐
│     Top Pane (tmux split)        │  ← 25% height
│     Terminal / System Monitor    │
├──────────────────────────────────┤
│     Claude Code (original)       │  ← 50% height, stays in focus
│     Your active session          │
├──────────────────────────────────┤
│     Bottom Pane (tmux split)     │  ← 25% height
│     Output / Build Status        │
└──────────────────────────────────┘
```

## Example Prompts

- "Show me a workspace view with terminal, code, and output"
- "Display a three-panel development layout"
- "Spawn a triple vertical layout"
- "Create panes above and below"

## How It Works

The command:
```bash
bun run src/cli.ts spawn workspace --layout triple-vertical
```

1. Creates a pane **above** with Terminal/System Monitor demo
2. Keeps Claude Code in the **middle** (in focus)
3. Creates a pane **below** with Output/Build Status demo

## Controls

- `q` or `Esc`: Close individual panes
- Each pane can be closed independently

## Updating Panels via IPC

Panels can be updated in real-time using the `update` command. When spawning with `--id`, the panels get IDs: `{id}-top` and `{id}-bottom`.

**Spawn with ID:**
```bash
bun run src/cli.ts spawn workspace --layout triple-vertical --id my-workspace
```

**Update top panel:**
```bash
bun run src/cli.ts update my-workspace-top --config "$(cat config.json)"
```

**Update bottom panel:**
```bash
bun run src/cli.ts update my-workspace-bottom --config "$(cat config.json)"
```

**Panel config options:**
```json
{
  "title": "Panel Title",
  "content": "Line 1\nLine 2\nLine 3",
  "borderColor": "green",
  "titleColor": "green"
}
```

**Available colors:** `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, `gray`

**Example - update with build status:**
```bash
cat > /tmp/build-status.json << 'EOF'
{
  "title": "BUILD OUTPUT",
  "content": "[12:36:01] Compiling...\n[12:36:02] 142 modules\n[12:36:03] SUCCESS!",
  "borderColor": "green",
  "titleColor": "green"
}
EOF
bun run src/cli.ts update my-workspace-bottom --config "$(cat /tmp/build-status.json)"
```

## Default Demo Content

**Top pane (Terminal):**
- System monitor with CPU, MEM, DSK usage bars
- Active processes, network throughput, uptime

**Bottom pane (Output):**
- TypeScript compilation status
- Test results, bundle size, linting status

## Requirements

- Must be running inside a **tmux session**
- Bun runtime
