# Claude Canvas Ultra

A comprehensive collection of interactive terminal canvases for Claude Code. This plugin extends Claude's capabilities with rich, interactive TUI components for business, travel, personal, creative, development, and AI workflows.

## Available Canvases

### Business Canvases

#### Kanban Board (`kanban`)
Interactive task management board with drag-and-drop cards between columns.

```
claude-canvas show kanban --config '{"columns": [...]}'
```

**Features:**
- Multiple columns with WIP limits
- Card details (priority, labels, assignee, due dates)
- Drag and drop reordering
- Keyboard shortcuts for quick actions

#### Sales Pipeline (`pipeline`)
CRM-style deal management with stages and probability tracking.

```
claude-canvas show pipeline --config '{"stages": [...]}'
```

**Features:**
- Visual funnel representation
- Deal cards with value and probability
- Drag deals between stages (auto-updates probability)
- Weighted pipeline value calculation

#### Dashboard (`dashboard`)
Multi-widget dashboard with charts, stats, and KPIs.

```
claude-canvas show dashboard --config '{"widgets": [...]}'
```

**Widget Types:**
- `stat` - KPI cards with trends and sparklines
- `chart-bar` - Horizontal/vertical bar charts
- `chart-line` - Line/sparkline charts
- `chart-pie` - Pie/donut charts
- `gauge` - Progress gauges
- `progress` - Multiple progress bars
- `table` - Data tables
- `list` - Simple lists

#### Invoice (`invoice`)
Invoice generator and viewer with line items and calculations.

```
claude-canvas show invoice --config '{"invoice": {...}}'
```

**Features:**
- Professional invoice layout
- Line item management
- Auto-calculated totals and tax
- Multiple status states (draft, sent, paid, etc.)

#### Gantt Chart (`gantt`)
Project timeline visualization with tasks and milestones.

```
claude-canvas show gantt --config '{"project": {...}}'
```

**Features:**
- Day/week/month views
- Task bars with progress
- Milestone markers
- Dependency visualization

#### Org Chart (`org-chart`)
Organization hierarchy visualization.

```
claude-canvas show org-chart --config '{"root": {...}}'
```

**Features:**
- Tree structure navigation
- Expand/collapse nodes
- Employee details
- Report counts

### Travel Canvases

#### Hotel Search (`hotel`)
Hotel comparison and booking interface.

```
claude-canvas show hotel --config '{"hotels": [...], "checkIn": "...", "checkOut": "..."}'
```

**Features:**
- Hotel list with ratings and prices
- Room type selection
- Amenity display
- Compare mode (up to 3 hotels)

#### Itinerary (`itinerary`)
Trip planning with day-by-day activities.

```
claude-canvas show itinerary --config '{"itinerary": {...}}'
```

**Features:**
- Day overview grid
- Activity timeline
- Drag to reorder activities
- Cost tracking

### Personal Canvases

#### Budget Tracker (`budget`)
Personal/business budget tracking with categories.

```
claude-canvas show budget --config '{"budget": {...}}'
```

**Features:**
- Category spending vs budget
- Visual progress bars
- Pie chart breakdown
- Transaction list

#### Smart Home (`smart-home`)
IoT device dashboard and control panel.

```
claude-canvas show smart-home --config '{"devices": [...], "rooms": [...]}'
```

**Features:**
- Room-based organization
- Device controls (toggle, brightness, temperature)
- Status indicators
- Automation management

#### Workout (`workout`)
Exercise planning and tracking.

```
claude-canvas show workout --config '{"workout": {...}}'
```

**Features:**
- Exercise list with sets/reps
- Active workout timer
- Rest timer between sets
- Progress tracking

### Creative Canvases

#### Playlist (`playlist`)
Music playlist builder and player.

```
claude-canvas show playlist --config '{"playlist": {...}}'
```

**Features:**
- Track list with duration
- Now playing indicator
- Drag to reorder
- Shuffle mode

### Development Canvases

#### Git Diff (`git-diff`)
Side-by-side diff viewer for git changes.

```
claude-canvas show git-diff --config '{"files": [...]}'
```

**Features:**
- Unified and split view modes
- File list with status indicators
- Line-by-line navigation
- Stage/unstage actions

### AI Canvases

#### Agent Dashboard (`agent-dashboard`)
Monitor and manage AI agents.

```
claude-canvas show agent-dashboard --config '{"agents": [...]}'
```

**Features:**
- Agent status overview
- Progress tracking
- Log viewer with filtering
- Token usage monitoring
- Context window visualization

## Shared Components

The plugin includes a library of reusable components:

### Data Display
- `DataTable` - Sortable, filterable tables
- `BarChart`, `LineChart`, `PieChart` - Charts
- `Gauge`, `Sparkline`, `ProgressBar` - Metrics
- `Heatmap` - Grid visualizations

### Forms
- `TextInput`, `Select`, `MultiSelect` - Input components
- `Checkbox`, `RadioGroup` - Selection components
- `Slider`, `Rating` - Range components
- `DatePicker`, `TimePicker` - Date/time components

### Layout
- `Panel`, `Tabs`, `SplitPane` - Container components
- `Accordion`, `Modal`, `Drawer` - Overlay components
- `List`, `Tree` - Navigation components

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

## Usage with Claude

Claude can spawn these canvases during conversations:

```
User: "Show me my sales pipeline"
Claude: [Spawns pipeline canvas with your deals]

User: "Create a kanban board for this sprint"
Claude: [Spawns kanban canvas with sprint tasks]

User: "Display my budget overview"
Claude: [Spawns budget canvas with your categories]
```

## Requirements

- **tmux** - Required for canvas display
- **Bun** - Runtime for the plugin

## Development

```bash
cd canvas
bun install
bun run src/cli.ts show <canvas-type>
```

## License

MIT
