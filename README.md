# Claude Canvas

A TUI toolkit that gives Claude Code its own display. Spawn interactive terminal interfaces for emails, calendars, flight bookings, and more.

**Note:** This is a proof of concept and is unsupported.

![Claude Canvas Screenshot](media/screenshot.png)

## Requirements

- [Bun](https://bun.sh) — used to run skill tools
- **Terminal multiplexer** (one of):
  - [tmux](https://github.com/tmux/tmux) — traditional terminal multiplexer
  - [WezTerm](https://wezfurlong.org/wezterm/) — modern GPU-accelerated terminal

## Terminal Configuration

Canvas auto-detects your terminal. Priority:
1. `CANVAS_TERMINAL` env var (explicit override)
2. tmux if running (even inside WezTerm)
3. WezTerm if available

```bash
export CANVAS_TERMINAL=wezterm  # force WezTerm
export CANVAS_TERMINAL=tmux     # force tmux
```

## Installation

Add this repository as a marketplace in Claude Code:

```
/plugin marketplace add dvdsgl/claude-canvas
```

Then install the canvas plugin:

```
/plugin install canvas@claude-canvas
```

## License

MIT
