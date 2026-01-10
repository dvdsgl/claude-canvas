// Mouse tracking hook for Ink components
// Uses SGR extended mouse mode for accurate position tracking

import { useState, useEffect, useCallback, useRef } from "react";
import { useStdin } from "ink";

// SGR extended mouse mode escape sequences
const MOUSE_ENABLE = "\x1b[?1003h\x1b[?1006h"; // Track all movements + SGR format
const MOUSE_DISABLE = "\x1b[?1003l\x1b[?1006l";

export interface MousePosition {
  x: number; // 1-based column
  y: number; // 1-based row
}

export interface MouseEvent {
  x: number;
  y: number;
  button: number; // 0=left, 1=middle, 2=right
  pressed: boolean; // true on press, false on release
  isMotion: boolean; // true if this is a motion event (mouse move)
  isScroll: boolean; // true if this is a scroll wheel event
  scrollDirection: "up" | "down" | null; // scroll direction if isScroll is true
  modifiers: {
    shift: boolean;
    meta: boolean;
    ctrl: boolean;
  };
}

export interface MouseState {
  position: MousePosition | null;
  isPressed: boolean;
  lastClick: MousePosition | null;
}

export interface UseMouseOptions {
  enabled?: boolean;
  onClick?: (event: MouseEvent) => void;
  onMove?: (event: MouseEvent) => void;
  onRelease?: (event: MouseEvent) => void;
  onScroll?: (event: MouseEvent) => void;
}

// Parse SGR mouse sequence: ESC[<btn;x;y(M|m)
// M = press, m = release
function parseMouseEvent(data: string): MouseEvent | null {
  // SGR format: \x1b[<btn;x;yM or \x1b[<btn;x;ym
  const match = data.match(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/);
  if (!match) return null;

  const [, btnStr, xStr, yStr, action] = match;
  const btn = parseInt(btnStr, 10);
  const x = parseInt(xStr, 10);
  const y = parseInt(yStr, 10);
  const pressed = action === "M";

  // Decode button and modifiers from btn byte
  // Bits 0-1: button (0=left, 1=middle, 2=right, 3=release/no button)
  // Bit 2: shift
  // Bit 3: meta
  // Bit 4: ctrl
  // Bit 5: motion event (32)
  // Bit 6: scroll wheel (64)
  const button = btn & 3;
  const shift = (btn & 4) !== 0;
  const meta = (btn & 8) !== 0;
  const ctrl = (btn & 16) !== 0;
  const isMotion = (btn & 32) !== 0;
  const isScroll = (btn & 64) !== 0;
  // For scroll: bit 0 determines direction (0=up, 1=down)
  const scrollDirection: "up" | "down" | null = isScroll
    ? (btn & 1) === 0
      ? "up"
      : "down"
    : null;

  return {
    x,
    y,
    button: isScroll ? -1 : button === 3 ? 0 : button, // -1 for scroll, 0 for no button held
    pressed,
    isMotion,
    isScroll,
    scrollDirection,
    modifiers: { shift, meta, ctrl },
  };
}

export function useMouse(options: UseMouseOptions = {}): MouseState {
  const { enabled = true, onClick, onMove, onRelease, onScroll } = options;
  const { stdin, setRawMode } = useStdin();
  const [state, setState] = useState<MouseState>({
    position: null,
    isPressed: false,
    lastClick: null,
  });

  // Use refs for callbacks to avoid re-registering handlers
  const onClickRef = useRef(onClick);
  const onMoveRef = useRef(onMove);
  const onReleaseRef = useRef(onRelease);
  const onScrollRef = useRef(onScroll);

  useEffect(() => {
    onClickRef.current = onClick;
    onMoveRef.current = onMove;
    onReleaseRef.current = onRelease;
    onScrollRef.current = onScroll;
  }, [onClick, onMove, onRelease, onScroll]);

  useEffect(() => {
    if (!enabled || !stdin) return;

    // Enable mouse tracking
    process.stdout.write(MOUSE_ENABLE);
    setRawMode(true);

    let buffer = "";

    const handleData = (data: Buffer) => {
      buffer += data.toString();

      // Try to parse mouse events from buffer
      let match;
      while ((match = buffer.match(/\x1b\[<\d+;\d+;\d+[Mm]/))) {
        const event = parseMouseEvent(match[0]);
        if (event) {
          setState((prev) => {
            const newState = {
              position: { x: event.x, y: event.y },
              // Only update isPressed for non-motion events
              isPressed: event.isMotion ? prev.isPressed : event.pressed,
              // Only update lastClick for actual clicks (not motion)
              lastClick: (!event.isMotion && event.pressed)
                ? { x: event.x, y: event.y }
                : prev.lastClick,
            };
            return newState;
          });

          // Call appropriate callback based on event type
          if (event.isScroll) {
            // Scroll wheel event
            onScrollRef.current?.(event);
          } else if (event.isMotion) {
            // Motion event (mouse move)
            onMoveRef.current?.(event);
          } else if (event.pressed) {
            // Button press (actual click)
            onClickRef.current?.(event);
          } else {
            // Button release
            onReleaseRef.current?.(event);
          }
        }

        // Remove processed event from buffer
        buffer = buffer.slice(match.index! + match[0].length);
      }

      // Keep buffer from growing too large (in case of junk data)
      if (buffer.length > 100) {
        buffer = buffer.slice(-50);
      }
    };

    stdin.on("data", handleData);

    return () => {
      stdin.off("data", handleData);
      process.stdout.write(MOUSE_DISABLE);
    };
  }, [enabled, stdin, setRawMode]);

  return state;
}

// Hook to track mouse position relative to a grid
export interface GridPosition {
  col: number; // 0-based column index
  row: number; // 0-based row index
}

export interface UseGridMouseOptions {
  enabled?: boolean;
  gridLeft: number; // Grid left edge (1-based terminal column)
  gridTop: number; // Grid top edge (1-based terminal row)
  cellWidth: number; // Width of each cell in characters
  cellHeight: number; // Height of each cell in rows
  cols: number; // Number of columns
  rows: number; // Number of rows
  onClick?: (position: GridPosition) => void;
}

export function useGridMouse(options: UseGridMouseOptions): {
  hoveredCell: GridPosition | null;
  clickedCell: GridPosition | null;
} {
  const {
    enabled = true,
    gridLeft,
    gridTop,
    cellWidth,
    cellHeight,
    cols,
    rows,
    onClick,
  } = options;

  const [hoveredCell, setHoveredCell] = useState<GridPosition | null>(null);
  const [clickedCell, setClickedCell] = useState<GridPosition | null>(null);

  const terminalToGrid = useCallback(
    (x: number, y: number): GridPosition | null => {
      const relX = x - gridLeft;
      const relY = y - gridTop;

      if (relX < 0 || relY < 0) return null;

      const col = Math.floor(relX / cellWidth);
      const row = Math.floor(relY / cellHeight);

      if (col >= cols || row >= rows) return null;

      return { col, row };
    },
    [gridLeft, gridTop, cellWidth, cellHeight, cols, rows]
  );

  const handleClick = useCallback(
    (event: MouseEvent) => {
      const gridPos = terminalToGrid(event.x, event.y);
      if (gridPos) {
        setClickedCell(gridPos);
        onClick?.(gridPos);
      }
    },
    [terminalToGrid, onClick]
  );

  const handleMove = useCallback(
    (event: MouseEvent) => {
      const gridPos = terminalToGrid(event.x, event.y);
      setHoveredCell(gridPos);
    },
    [terminalToGrid]
  );

  useMouse({
    enabled,
    onClick: handleClick,
    onMove: handleMove,
  });

  return { hoveredCell, clickedCell };
}
