---
name: canvas
description: |
  **The primary skill for terminal TUI components.** Covers spawning, controlling, and interacting with terminal canvases.
  Use when displaying calendars, documents, flights, kanban boards, dashboards, invoices, budgets, hotels, itineraries, smart home controls, agent dashboards, workouts, playlists, gantt charts, git diffs, org charts, or sales pipelines.
---

# Canvas TUI Toolkit

**Start here when using terminal canvases.** This skill covers the overall workflow, canvas types, and IPC communication.

## Example Prompts

Try asking Claude things like:

**Business:**
- "Show me a kanban board for this sprint"
- "Display my sales pipeline"
- "Create a dashboard with these KPIs"
- "Generate an invoice for this project"
- "Show a gantt chart for project timeline"
- "Display the org chart"

**Travel:**
- "Find hotels in Paris for next week"
- "Plan an itinerary for my Tokyo trip"
- "Find flights from SFO to Denver"

**Personal:**
- "Show my monthly budget"
- "Display smart home dashboard"
- "Create a workout plan"
- "Show my playlist"

**Calendar & Documents:**
- "Schedule a meeting with the team"
- "Help me edit this document"

**Development:**
- "Show git diff for my changes"

**AI:**
- "Show agent dashboard"

## Overview

Canvas provides interactive terminal displays (TUIs) that Claude can spawn and control. Each canvas type supports different interaction modes.

## Available Canvas Types

### Business Canvases

| Canvas | Purpose | Key Features |
|--------|---------|--------------|
| `kanban` | Task management board | Columns, cards, drag-drop, WIP limits, labels, priorities |
| `pipeline` | CRM sales pipeline | Stages, deals, probability tracking, weighted values |
| `dashboard` | Multi-widget dashboard | Stats, charts (bar/line/pie), gauges, tables, lists |
| `invoice` | Invoice generator | Line items, tax, totals, status tracking |
| `gantt` | Project timeline | Tasks, milestones, day/week/month views, progress |
| `org-chart` | Organization hierarchy | Tree navigation, expand/collapse, employee details |

### Travel Canvases

| Canvas | Purpose | Key Features |
|--------|---------|--------------|
| `hotel` | Hotel search & booking | Hotel list, room selection, amenities, compare mode |
| `itinerary` | Trip planning | Day-by-day activities, drag reorder, cost tracking |
| `flight` | Flight booking | Flight comparison, seat selection |

### Personal Canvases

| Canvas | Purpose | Key Features |
|--------|---------|--------------|
| `budget` | Budget tracking | Categories, spending vs budget, pie charts, transactions |
| `smart-home` | IoT dashboard | Room-based, device controls, status indicators |
| `workout` | Exercise tracking | Exercises, sets/reps, rest timer, progress |

### Creative Canvases

| Canvas | Purpose | Key Features |
|--------|---------|--------------|
| `playlist` | Music playlist | Track list, now playing, drag reorder, shuffle |

### Development Canvases

| Canvas | Purpose | Key Features |
|--------|---------|--------------|
| `git-diff` | Diff viewer | Unified/split view, file list, line navigation |

### AI Canvases

| Canvas | Purpose | Key Features |
|--------|---------|--------------|
| `agent-dashboard` | Agent monitoring | Status, progress, logs, token usage, context viz |

### Original Canvases

| Canvas | Purpose | Scenarios |
|--------|---------|-----------|
| `calendar` | Display calendars, pick meeting times | `display`, `meeting-picker` |
| `document` | View/edit markdown documents | `display`, `edit`, `email-preview` |

## Quick Start

```bash
cd ${CLAUDE_PLUGIN_ROOT}

# Run canvas in current terminal
bun run src/cli.ts show kanban --config '{"columns": [{"id": "todo", "title": "To Do", "cards": []}]}'

# Spawn canvas in new tmux split
bun run src/cli.ts spawn dashboard --config '{"widgets": [...]}'
```

## Canvas Configuration Examples

### Kanban Board
```bash
bun run src/cli.ts show kanban --config '{
  "columns": [
    {"id": "todo", "title": "To Do", "wipLimit": 5, "cards": [
      {"id": "1", "title": "Task 1", "priority": "high", "labels": ["bug"]}
    ]},
    {"id": "doing", "title": "In Progress", "cards": []},
    {"id": "done", "title": "Done", "cards": []}
  ]
}'
```

### Sales Pipeline
```bash
bun run src/cli.ts show pipeline --config '{
  "stages": [
    {"id": "lead", "name": "Lead", "probability": 10, "deals": [
      {"id": "1", "title": "Acme Corp", "value": {"amount": 50000, "currency": "USD"}, "probability": 10}
    ]},
    {"id": "qualified", "name": "Qualified", "probability": 25, "deals": []},
    {"id": "proposal", "name": "Proposal", "probability": 50, "deals": []},
    {"id": "closed", "name": "Closed Won", "probability": 100, "deals": []}
  ]
}'
```

### Dashboard
```bash
bun run src/cli.ts show dashboard --config '{
  "title": "Sales Dashboard",
  "widgets": [
    {"id": "1", "type": "stat", "title": "Revenue", "data": {"value": 125000, "trend": 12}},
    {"id": "2", "type": "chart-bar", "title": "Monthly Sales", "data": [
      {"label": "Jan", "value": 10000},
      {"label": "Feb", "value": 15000}
    ]},
    {"id": "3", "type": "gauge", "title": "Goal Progress", "data": {"value": 75, "max": 100}}
  ]
}'
```

### Invoice
```bash
bun run src/cli.ts show invoice --config '{
  "invoice": {
    "number": "INV-001",
    "status": "draft",
    "from": {"name": "My Company", "address": "123 Main St"},
    "to": {"name": "Client Corp", "address": "456 Oak Ave"},
    "items": [
      {"id": "1", "description": "Consulting", "quantity": 10, "unitPrice": {"amount": 15000, "currency": "USD"}}
    ],
    "taxRate": 0.1
  }
}'
```

### Budget Tracker
```bash
bun run src/cli.ts show budget --config '{
  "budget": {
    "id": "1",
    "name": "Monthly Budget",
    "period": "monthly",
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "categories": [
      {"id": "1", "name": "Housing", "budgeted": {"amount": 200000, "currency": "USD"}, "spent": {"amount": 150000, "currency": "USD"}, "color": "blue"},
      {"id": "2", "name": "Food", "budgeted": {"amount": 50000, "currency": "USD"}, "spent": {"amount": 45000, "currency": "USD"}, "color": "green"}
    ]
  }
}'
```

### Hotel Search
```bash
bun run src/cli.ts show hotel --config '{
  "checkIn": "2024-03-15",
  "checkOut": "2024-03-20",
  "guests": 2,
  "rooms": 1,
  "hotels": [
    {
      "id": "1",
      "name": "Grand Hotel",
      "rating": 4.5,
      "stars": 5,
      "location": {"city": "Paris", "country": "France"},
      "amenities": ["wifi", "pool", "spa"],
      "roomTypes": [
        {"id": "r1", "name": "Deluxe Room", "pricePerNight": {"amount": 25000, "currency": "USD"}, "maxGuests": 2}
      ]
    }
  ]
}'
```

### Smart Home
```bash
bun run src/cli.ts show smart-home --config '{
  "rooms": ["Living Room", "Bedroom", "Kitchen"],
  "devices": [
    {"id": "1", "name": "Main Light", "type": "light", "room": "Living Room", "status": "online", "capabilities": ["on-off", "brightness"]},
    {"id": "2", "name": "Thermostat", "type": "thermostat", "room": "Living Room", "status": "online", "capabilities": ["temperature"]}
  ]
}'
```

### Agent Dashboard
```bash
bun run src/cli.ts show agent-dashboard --config '{
  "agents": [
    {
      "id": "1",
      "name": "Research Agent",
      "status": "running",
      "progress": 65,
      "currentTask": "Analyzing documents",
      "logs": [
        {"timestamp": "2024-01-15T10:30:00Z", "level": "info", "message": "Started task"}
      ],
      "context": {"tokensUsed": 50000, "maxTokens": 100000}
    }
  ]
}'
```

### Gantt Chart
```bash
bun run src/cli.ts show gantt --config '{
  "project": {
    "id": "1",
    "name": "Product Launch",
    "startDate": "2024-01-01",
    "status": "active",
    "owner": {"id": "1", "name": "PM"},
    "team": [],
    "tasks": [
      {"id": "t1", "title": "Design", "status": "completed", "progress": 100, "dueDate": "2024-01-15"},
      {"id": "t2", "title": "Development", "status": "in-progress", "progress": 50, "dueDate": "2024-02-01"}
    ],
    "milestones": [
      {"id": "m1", "title": "Beta Release", "dueDate": "2024-02-15", "status": "pending"}
    ]
  }
}'
```

### Git Diff
```bash
bun run src/cli.ts show git-diff --config '{
  "files": [
    {
      "path": "src/index.ts",
      "status": "modified",
      "additions": 10,
      "deletions": 5,
      "hunks": [
        {
          "oldStart": 1,
          "oldLines": 5,
          "newStart": 1,
          "newLines": 10,
          "lines": [
            {"type": "context", "content": "import React from \"react\";"},
            {"type": "deletion", "content": "const old = true;"},
            {"type": "addition", "content": "const new = false;"}
          ]
        }
      ]
    }
  ]
}'
```

### Org Chart
```bash
bun run src/cli.ts show org-chart --config '{
  "root": {
    "id": "ceo",
    "person": {"id": "1", "name": "Jane Smith", "email": "jane@company.com"},
    "title": "CEO",
    "children": [
      {
        "id": "cto",
        "person": {"id": "2", "name": "Bob Johnson"},
        "title": "CTO",
        "children": []
      },
      {
        "id": "cfo",
        "person": {"id": "3", "name": "Alice Williams"},
        "title": "CFO",
        "children": []
      }
    ]
  }
}'
```

## Keyboard Shortcuts

Common shortcuts across all canvases:

| Key | Action |
|-----|--------|
| `↑↓` | Navigate items |
| `←→` | Navigate sections/columns |
| `Enter` | Select/confirm |
| `Space` | Toggle/drag |
| `Tab` | Switch focus |
| `ESC` | Back/cancel/exit |

## Spawning Canvases

**Always use `spawn` for interactive scenarios** - this opens the canvas in a tmux split pane while keeping the conversation terminal available.

```bash
bun run src/cli.ts spawn [kind] --config '[json]'
```

**Parameters:**
- `kind`: Canvas type (kanban, dashboard, pipeline, etc.)
- `--config`: JSON configuration for the canvas
- `--id`: Optional canvas instance ID for IPC
- `--scenario`: Interaction mode (for calendar/document)

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

## Requirements

- **tmux**: Canvas spawning requires a tmux session
- **Terminal with mouse support**: For click-based interactions
- **Bun**: Runtime for executing canvas commands
