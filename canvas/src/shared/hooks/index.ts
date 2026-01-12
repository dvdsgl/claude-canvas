// Shared hooks for all canvases

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useInput, useStdout, useApp } from 'ink';
import type { Dimensions, Position, FormState, FormField, SortConfig, FilterConfig } from '../types';

// ============================================
// TERMINAL HOOKS
// ============================================

export function useTerminalSize(): Dimensions {
  const { stdout } = useStdout();
  const [size, setSize] = useState<Dimensions>({
    width: stdout?.columns || 80,
    height: stdout?.rows || 24,
  });

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: stdout?.columns || 80,
        height: stdout?.rows || 24,
      });
    };

    stdout?.on('resize', handleResize);
    return () => {
      stdout?.off('resize', handleResize);
    };
  }, [stdout]);

  return size;
}

export function useExit(onExit?: () => void): void {
  const { exit } = useApp();

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      onExit?.();
      exit();
    }
  });
}

// ============================================
// MOUSE HOOKS
// ============================================

export interface MouseEvent {
  x: number;
  y: number;
  button: 'left' | 'middle' | 'right' | 'none';
  shift: boolean;
  meta: boolean;
  ctrl: boolean;
  type: 'press' | 'release' | 'move';
}

export interface UseMouseOptions {
  onClick?: (event: MouseEvent) => void;
  onMove?: (event: MouseEvent) => void;
  onRelease?: (event: MouseEvent) => void;
  onDrag?: (start: Position, current: Position) => void;
  enabled?: boolean;
}

export function useMouse(options: UseMouseOptions = {}): void {
  const { onClick, onMove, onRelease, onDrag, enabled = true } = options;
  const { stdout, stdin } = useStdout();
  const dragStart = useRef<Position | null>(null);

  useEffect(() => {
    if (!enabled || !stdin || !stdout) return;

    // Enable mouse tracking (SGR extended mode)
    stdout.write('\x1b[?1003h'); // Enable all mouse tracking
    stdout.write('\x1b[?1006h'); // Enable SGR extended mode

    const handleData = (data: Buffer) => {
      const str = data.toString();

      // Parse SGR mouse format: \x1b[<btn;x;y[Mm]
      const match = str.match(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/);
      if (!match) return;

      const [, btnStr, xStr, yStr, action] = match;
      const btnCode = parseInt(btnStr, 10);
      const x = parseInt(xStr, 10);
      const y = parseInt(yStr, 10);

      const shift = (btnCode & 4) !== 0;
      const meta = (btnCode & 8) !== 0;
      const ctrl = (btnCode & 16) !== 0;
      const buttonBase = btnCode & 3;

      const button: MouseEvent['button'] =
        buttonBase === 0 ? 'left' :
        buttonBase === 1 ? 'middle' :
        buttonBase === 2 ? 'right' : 'none';

      const isMotion = (btnCode & 32) !== 0;
      const isRelease = action === 'm';

      const event: MouseEvent = {
        x,
        y,
        button,
        shift,
        meta,
        ctrl,
        type: isRelease ? 'release' : isMotion ? 'move' : 'press',
      };

      if (isRelease) {
        if (dragStart.current && onDrag) {
          onDrag(dragStart.current, { x, y });
        }
        dragStart.current = null;
        onRelease?.(event);
      } else if (isMotion) {
        if (dragStart.current && onDrag) {
          onDrag(dragStart.current, { x, y });
        }
        onMove?.(event);
      } else {
        dragStart.current = { x, y };
        onClick?.(event);
      }
    };

    stdin.on('data', handleData);

    return () => {
      stdin.off('data', handleData);
      stdout.write('\x1b[?1003l'); // Disable mouse tracking
      stdout.write('\x1b[?1006l');
    };
  }, [enabled, stdin, stdout, onClick, onMove, onRelease, onDrag]);
}

export interface GridMouseOptions {
  gridOffset: Position;
  cellWidth: number;
  cellHeight: number;
  onClick?: (row: number, col: number, event: MouseEvent) => void;
  onHover?: (row: number, col: number, event: MouseEvent) => void;
  enabled?: boolean;
}

export function useGridMouse(options: GridMouseOptions): { hoveredCell: Position | null } {
  const { gridOffset, cellWidth, cellHeight, onClick, onHover, enabled = true } = options;
  const [hoveredCell, setHoveredCell] = useState<Position | null>(null);

  const handleClick = useCallback((event: MouseEvent) => {
    const col = Math.floor((event.x - gridOffset.x) / cellWidth);
    const row = Math.floor((event.y - gridOffset.y) / cellHeight);
    if (col >= 0 && row >= 0) {
      onClick?.(row, col, event);
    }
  }, [gridOffset, cellWidth, cellHeight, onClick]);

  const handleMove = useCallback((event: MouseEvent) => {
    const col = Math.floor((event.x - gridOffset.x) / cellWidth);
    const row = Math.floor((event.y - gridOffset.y) / cellHeight);
    if (col >= 0 && row >= 0) {
      setHoveredCell({ x: col, y: row });
      onHover?.(row, col, event);
    } else {
      setHoveredCell(null);
    }
  }, [gridOffset, cellWidth, cellHeight, onHover]);

  useMouse({
    onClick: handleClick,
    onMove: handleMove,
    enabled,
  });

  return { hoveredCell };
}

// ============================================
// KEYBOARD / NAVIGATION HOOKS
// ============================================

export interface UseNavigationOptions {
  itemCount: number;
  columns?: number;
  wrap?: boolean;
  onSelect?: (index: number) => void;
  onActivate?: (index: number) => void;
  initialIndex?: number;
}

export function useNavigation(options: UseNavigationOptions): {
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
} {
  const { itemCount, columns = 1, wrap = true, onSelect, onActivate, initialIndex = 0 } = options;
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  useInput((input, key) => {
    let newIndex = selectedIndex;

    if (key.upArrow) {
      newIndex = selectedIndex - columns;
    } else if (key.downArrow) {
      newIndex = selectedIndex + columns;
    } else if (key.leftArrow) {
      newIndex = selectedIndex - 1;
    } else if (key.rightArrow) {
      newIndex = selectedIndex + 1;
    } else if (key.return) {
      onActivate?.(selectedIndex);
      return;
    } else if (input === ' ') {
      onSelect?.(selectedIndex);
      return;
    }

    if (wrap) {
      newIndex = ((newIndex % itemCount) + itemCount) % itemCount;
    } else {
      newIndex = Math.max(0, Math.min(itemCount - 1, newIndex));
    }

    if (newIndex !== selectedIndex) {
      setSelectedIndex(newIndex);
      onSelect?.(newIndex);
    }
  });

  return { selectedIndex, setSelectedIndex };
}

export interface UseListNavigationOptions<T> {
  items: T[];
  onSelect?: (item: T, index: number) => void;
  onActivate?: (item: T, index: number) => void;
  wrap?: boolean;
}

export function useListNavigation<T>(options: UseListNavigationOptions<T>): {
  selectedIndex: number;
  selectedItem: T | undefined;
  setSelectedIndex: (index: number) => void;
} {
  const { items, onSelect, onActivate, wrap = true } = options;

  const handleSelect = useCallback((index: number) => {
    onSelect?.(items[index], index);
  }, [items, onSelect]);

  const handleActivate = useCallback((index: number) => {
    onActivate?.(items[index], index);
  }, [items, onActivate]);

  const { selectedIndex, setSelectedIndex } = useNavigation({
    itemCount: items.length,
    wrap,
    onSelect: handleSelect,
    onActivate: handleActivate,
  });

  return {
    selectedIndex,
    selectedItem: items[selectedIndex],
    setSelectedIndex,
  };
}

// ============================================
// FOCUS HOOKS
// ============================================

export function useFocus(initialFocused = false): {
  isFocused: boolean;
  focus: () => void;
  blur: () => void;
  toggle: () => void;
} {
  const [isFocused, setIsFocused] = useState(initialFocused);

  return {
    isFocused,
    focus: () => setIsFocused(true),
    blur: () => setIsFocused(false),
    toggle: () => setIsFocused(f => !f),
  };
}

export function useFocusManager(itemCount: number): {
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;
  focusNext: () => void;
  focusPrev: () => void;
  isFocused: (index: number) => boolean;
} {
  const [focusedIndex, setFocusedIndex] = useState(0);

  const focusNext = useCallback(() => {
    setFocusedIndex(i => (i + 1) % itemCount);
  }, [itemCount]);

  const focusPrev = useCallback(() => {
    setFocusedIndex(i => (i - 1 + itemCount) % itemCount);
  }, [itemCount]);

  const isFocused = useCallback((index: number) => focusedIndex === index, [focusedIndex]);

  useInput((_, key) => {
    if (key.tab) {
      if (key.shift) {
        focusPrev();
      } else {
        focusNext();
      }
    }
  });

  return { focusedIndex, setFocusedIndex, focusNext, focusPrev, isFocused };
}

// ============================================
// FORM HOOKS
// ============================================

export function useForm(fields: FormField[]): FormState & {
  setValue: (name: string, value: unknown) => void;
  setError: (name: string, error: string) => void;
  touch: (name: string) => void;
  reset: () => void;
  validate: () => boolean;
  getValues: () => Record<string, unknown>;
} {
  const initialValues = useMemo(() => {
    const values: Record<string, unknown> = {};
    fields.forEach(field => {
      values[field.name] = field.defaultValue ?? '';
    });
    return values;
  }, [fields]);

  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const setValue = useCallback((name: string, value: unknown) => {
    setValues(v => ({ ...v, [name]: value }));
  }, []);

  const setError = useCallback((name: string, error: string) => {
    setErrors(e => ({ ...e, [name]: error }));
  }, []);

  const touch = useCallback((name: string) => {
    setTouched(t => ({ ...t, [name]: true }));
  }, []);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};

    fields.forEach(field => {
      const value = values[field.name];

      if (field.required && (value === '' || value === null || value === undefined)) {
        newErrors[field.name] = `${field.label} is required`;
        return;
      }

      field.validation?.forEach(rule => {
        if (newErrors[field.name]) return;

        switch (rule.type) {
          case 'required':
            if (!value) newErrors[field.name] = rule.message;
            break;
          case 'min':
            if (typeof value === 'number' && value < (rule.value as number)) {
              newErrors[field.name] = rule.message;
            }
            break;
          case 'max':
            if (typeof value === 'number' && value > (rule.value as number)) {
              newErrors[field.name] = rule.message;
            }
            break;
          case 'minLength':
            if (typeof value === 'string' && value.length < (rule.value as number)) {
              newErrors[field.name] = rule.message;
            }
            break;
          case 'maxLength':
            if (typeof value === 'string' && value.length > (rule.value as number)) {
              newErrors[field.name] = rule.message;
            }
            break;
          case 'pattern':
            if (typeof value === 'string' && !(rule.value as RegExp).test(value)) {
              newErrors[field.name] = rule.message;
            }
            break;
          case 'email':
            if (typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              newErrors[field.name] = rule.message;
            }
            break;
          case 'custom':
            if (rule.validator && !rule.validator(value)) {
              newErrors[field.name] = rule.message;
            }
            break;
        }
      });
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [fields, values]);

  const isValid = Object.keys(errors).length === 0;
  const isDirty = Object.keys(values).some(key => values[key] !== initialValues[key]);

  return {
    values,
    errors,
    touched,
    isValid,
    isDirty,
    setValue,
    setError,
    touch,
    reset,
    validate,
    getValues: () => values,
  };
}

// ============================================
// DATA HOOKS
// ============================================

export function useSort<T>(
  data: T[],
  initialSort?: SortConfig
): {
  sortedData: T[];
  sortConfig: SortConfig | undefined;
  setSort: (column: string) => void;
  clearSort: () => void;
} {
  const [sortConfig, setSortConfig] = useState<SortConfig | undefined>(initialSort);

  const sortedData = useMemo(() => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortConfig.column];
      const bVal = (b as Record<string, unknown>)[sortConfig.column];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison = aVal < bVal ? -1 : 1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [data, sortConfig]);

  const setSort = useCallback((column: string) => {
    setSortConfig(prev => {
      if (prev?.column === column) {
        return prev.direction === 'asc'
          ? { column, direction: 'desc' }
          : undefined;
      }
      return { column, direction: 'asc' };
    });
  }, []);

  const clearSort = useCallback(() => {
    setSortConfig(undefined);
  }, []);

  return { sortedData, sortConfig, setSort, clearSort };
}

export function useFilter<T>(
  data: T[],
  initialFilters: FilterConfig[] = []
): {
  filteredData: T[];
  filters: FilterConfig[];
  addFilter: (filter: FilterConfig) => void;
  removeFilter: (column: string) => void;
  clearFilters: () => void;
  setFilters: (filters: FilterConfig[]) => void;
} {
  const [filters, setFilters] = useState<FilterConfig[]>(initialFilters);

  const filteredData = useMemo(() => {
    if (filters.length === 0) return data;

    return data.filter(item => {
      return filters.every(filter => {
        const value = (item as Record<string, unknown>)[filter.column];
        switch (filter.operator) {
          case 'eq': return value === filter.value;
          case 'neq': return value !== filter.value;
          case 'gt': return (value as number) > (filter.value as number);
          case 'gte': return (value as number) >= (filter.value as number);
          case 'lt': return (value as number) < (filter.value as number);
          case 'lte': return (value as number) <= (filter.value as number);
          case 'contains': return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'startsWith': return String(value).toLowerCase().startsWith(String(filter.value).toLowerCase());
          case 'endsWith': return String(value).toLowerCase().endsWith(String(filter.value).toLowerCase());
          default: return true;
        }
      });
    });
  }, [data, filters]);

  const addFilter = useCallback((filter: FilterConfig) => {
    setFilters(prev => [...prev.filter(f => f.column !== filter.column), filter]);
  }, []);

  const removeFilter = useCallback((column: string) => {
    setFilters(prev => prev.filter(f => f.column !== column));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters([]);
  }, []);

  return { filteredData, filters, addFilter, removeFilter, clearFilters, setFilters };
}

export function usePagination<T>(
  data: T[],
  pageSize = 10
): {
  paginatedData: T[];
  page: number;
  totalPages: number;
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setPageSize: (size: number) => void;
} {
  const [page, setPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);

  const totalPages = Math.ceil(data.length / currentPageSize);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * currentPageSize;
    return data.slice(start, start + currentPageSize);
  }, [data, page, currentPageSize]);

  const nextPage = useCallback(() => {
    setPage(p => Math.min(p + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setPage(p => Math.max(p - 1, 1));
  }, []);

  // Reset page if data changes and current page is invalid
  useEffect(() => {
    if (page > totalPages) {
      setPage(Math.max(1, totalPages));
    }
  }, [page, totalPages]);

  return {
    paginatedData,
    page,
    totalPages,
    setPage,
    nextPage,
    prevPage,
    setPageSize: setCurrentPageSize,
  };
}

// ============================================
// SELECTION HOOKS
// ============================================

export function useSelection<T>(items: T[], keyFn: (item: T) => string): {
  selected: Set<string>;
  isSelected: (item: T) => boolean;
  toggle: (item: T) => void;
  select: (item: T) => void;
  deselect: (item: T) => void;
  selectAll: () => void;
  deselectAll: () => void;
  toggleAll: () => void;
  selectedItems: T[];
} {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const isSelected = useCallback((item: T) => selected.has(keyFn(item)), [selected, keyFn]);

  const toggle = useCallback((item: T) => {
    setSelected(prev => {
      const next = new Set(prev);
      const key = keyFn(item);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, [keyFn]);

  const select = useCallback((item: T) => {
    setSelected(prev => new Set([...prev, keyFn(item)]));
  }, [keyFn]);

  const deselect = useCallback((item: T) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.delete(keyFn(item));
      return next;
    });
  }, [keyFn]);

  const selectAll = useCallback(() => {
    setSelected(new Set(items.map(keyFn)));
  }, [items, keyFn]);

  const deselectAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  const toggleAll = useCallback(() => {
    if (selected.size === items.length) {
      deselectAll();
    } else {
      selectAll();
    }
  }, [selected.size, items.length, selectAll, deselectAll]);

  const selectedItems = useMemo(() => {
    return items.filter(item => selected.has(keyFn(item)));
  }, [items, selected, keyFn]);

  return {
    selected,
    isSelected,
    toggle,
    select,
    deselect,
    selectAll,
    deselectAll,
    toggleAll,
    selectedItems,
  };
}

// ============================================
// TIMER / ANIMATION HOOKS
// ============================================

export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

export function useTimeout(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setTimeout(() => savedCallback.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);
}

export function useCountdown(seconds: number, onComplete?: () => void): {
  remaining: number;
  isRunning: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
} {
  const [remaining, setRemaining] = useState(seconds);
  const [isRunning, setIsRunning] = useState(false);

  useInterval(
    () => {
      setRemaining(r => {
        if (r <= 1) {
          setIsRunning(false);
          onComplete?.();
          return 0;
        }
        return r - 1;
      });
    },
    isRunning ? 1000 : null
  );

  const start = useCallback(() => setIsRunning(true), []);
  const stop = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(() => {
    setIsRunning(false);
    setRemaining(seconds);
  }, [seconds]);

  return { remaining, isRunning, start, stop, reset };
}

// ============================================
// CLIPBOARD HOOK
// ============================================

export function useClipboard(): {
  copy: (text: string) => Promise<void>;
  paste: () => Promise<string>;
} {
  const copy = useCallback(async (text: string) => {
    try {
      // Try using pbcopy on macOS
      const proc = Bun.spawn(['pbcopy'], {
        stdin: 'pipe',
      });
      proc.stdin.write(text);
      proc.stdin.end();
      await proc.exited;
    } catch {
      // Fallback: write to OSC 52 escape sequence
      process.stdout.write(`\x1b]52;c;${Buffer.from(text).toString('base64')}\x07`);
    }
  }, []);

  const paste = useCallback(async () => {
    try {
      const proc = Bun.spawn(['pbpaste']);
      const text = await new Response(proc.stdout).text();
      return text;
    } catch {
      return '';
    }
  }, []);

  return { copy, paste };
}

// ============================================
// ASYNC HOOK
// ============================================

export function useAsync<T>(
  asyncFn: () => Promise<T>,
  deps: unknown[] = []
): {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
} {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error>();

  const execute = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await asyncFn();
      setData(result);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, refetch: execute };
}
