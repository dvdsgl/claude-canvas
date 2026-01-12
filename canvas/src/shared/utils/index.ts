// Shared utility functions

import type { Money, DataPoint, SortConfig, FilterConfig } from '../types';

// ============================================
// FORMATTING UTILITIES
// ============================================

export function formatMoney(money: Money): string {
  const amount = money.amount / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: money.currency,
  }).format(amount);
}

export function formatNumber(num: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatPercent(num: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num / 100);
}

export function formatDate(date: string | Date, format: 'short' | 'medium' | 'long' = 'medium'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const options: Intl.DateTimeFormatOptions =
    format === 'short' ? { month: 'numeric', day: 'numeric' } :
    format === 'long' ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' } :
    { year: 'numeric', month: 'short', day: 'numeric' };
  return d.toLocaleDateString('en-US', options);
}

export function formatTime(date: string | Date, includeSeconds = false): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: true,
  });
}

export function formatDateTime(date: string | Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(d, 'short');
}

// ============================================
// STRING UTILITIES
// ============================================

export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

export function padLeft(str: string, length: number, char = ' '): string {
  return str.padStart(length, char);
}

export function padRight(str: string, length: number, char = ' '): string {
  return str.padEnd(length, char);
}

export function padCenter(str: string, length: number, char = ' '): string {
  const padding = length - str.length;
  if (padding <= 0) return str;
  const left = Math.floor(padding / 2);
  const right = padding - left;
  return char.repeat(left) + str + char.repeat(right);
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function titleCase(str: string): string {
  return str.split(' ').map(capitalize).join(' ');
}

export function kebabCase(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export function camelCase(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+(.)/g, (_, char) => char.toUpperCase());
}

// ============================================
// ARRAY / DATA UTILITIES
// ============================================

export function sortData<T>(data: T[], config: SortConfig): T[] {
  return [...data].sort((a, b) => {
    const aVal = (a as Record<string, unknown>)[config.column];
    const bVal = (b as Record<string, unknown>)[config.column];

    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    const comparison = aVal < bVal ? -1 : 1;
    return config.direction === 'asc' ? comparison : -comparison;
  });
}

export function filterData<T>(data: T[], filters: FilterConfig[]): T[] {
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
}

export function groupBy<T>(data: T[], key: keyof T): Record<string, T[]> {
  return data.reduce((acc, item) => {
    const group = String(item[key]);
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export function sumBy<T>(data: T[], key: keyof T): number {
  return data.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
}

export function averageBy<T>(data: T[], key: keyof T): number {
  if (data.length === 0) return 0;
  return sumBy(data, key) / data.length;
}

export function minBy<T>(data: T[], key: keyof T): T | undefined {
  return data.reduce((min, item) => {
    if (!min) return item;
    return (item[key] as number) < (min[key] as number) ? item : min;
  }, undefined as T | undefined);
}

export function maxBy<T>(data: T[], key: keyof T): T | undefined {
  return data.reduce((max, item) => {
    if (!max) return item;
    return (item[key] as number) > (max[key] as number) ? item : max;
  }, undefined as T | undefined);
}

export function uniqueBy<T>(data: T[], key: keyof T): T[] {
  const seen = new Set();
  return data.filter(item => {
    const val = item[key];
    if (seen.has(val)) return false;
    seen.add(val);
    return true;
  });
}

export function chunk<T>(data: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < data.length; i += size) {
    chunks.push(data.slice(i, i + size));
  }
  return chunks;
}

export function range(start: number, end: number, step = 1): number[] {
  const result: number[] = [];
  for (let i = start; i < end; i += step) {
    result.push(i);
  }
  return result;
}

// ============================================
// DATE UTILITIES
// ============================================

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function startOfWeek(date: Date, weekStartsOn = 0): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  result.setDate(result.getDate() - diff);
  return startOfDay(result);
}

export function endOfWeek(date: Date, weekStartsOn = 0): Date {
  const result = startOfWeek(date, weekStartsOn);
  result.setDate(result.getDate() + 6);
  return endOfDay(result);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// ============================================
// COLOR UTILITIES
// ============================================

export const COLORS = {
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  yellow: '#eab308',
  lime: '#84cc16',
  green: '#22c55e',
  emerald: '#10b981',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  sky: '#0ea5e9',
  blue: '#3b82f6',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  purple: '#a855f7',
  fuchsia: '#d946ef',
  pink: '#ec4899',
  rose: '#f43f5e',
  gray: '#6b7280',
  white: '#ffffff',
  black: '#000000',
};

export const CHART_COLORS = [
  COLORS.blue,
  COLORS.green,
  COLORS.amber,
  COLORS.purple,
  COLORS.pink,
  COLORS.cyan,
  COLORS.orange,
  COLORS.indigo,
  COLORS.teal,
  COLORS.rose,
];

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}

export function rgbToAnsi(r: number, g: number, b: number): string {
  // Convert to 256-color ANSI
  const code = 16 + 36 * Math.round(r / 255 * 5) + 6 * Math.round(g / 255 * 5) + Math.round(b / 255 * 5);
  return `\x1b[38;5;${code}m`;
}

export function hexToAnsi(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '';
  return rgbToAnsi(rgb.r, rgb.g, rgb.b);
}

export function bgHexToAnsi(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '';
  const code = 16 + 36 * Math.round(rgb.r / 255 * 5) + 6 * Math.round(rgb.g / 255 * 5) + Math.round(rgb.b / 255 * 5);
  return `\x1b[48;5;${code}m`;
}

export const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  inverse: '\x1b[7m',
  strikethrough: '\x1b[9m',
  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

// ============================================
// CHART UTILITIES
// ============================================

export function normalizeData(data: DataPoint[], maxValue?: number): DataPoint[] {
  const max = maxValue ?? Math.max(...data.map(d => d.value));
  if (max === 0) return data.map(d => ({ ...d, value: 0 }));
  return data.map(d => ({ ...d, value: d.value / max }));
}

export function createHistogram(values: number[], buckets: number): DataPoint[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const bucketSize = (max - min) / buckets;

  const histogram: DataPoint[] = [];
  for (let i = 0; i < buckets; i++) {
    const start = min + i * bucketSize;
    const end = start + bucketSize;
    const count = values.filter(v => v >= start && (i === buckets - 1 ? v <= end : v < end)).length;
    histogram.push({
      label: `${formatNumber(start, 1)}-${formatNumber(end, 1)}`,
      value: count,
    });
  }
  return histogram;
}

export function sparkline(values: number[], width: number = 10): string {
  if (values.length === 0) return '';
  const chars = '▁▂▃▄▅▆▇█';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // Resample if needed
  const sampled = values.length <= width ? values :
    Array.from({ length: width }, (_, i) =>
      values[Math.floor(i * values.length / width)]
    );

  return sampled.map(v => {
    const normalized = (v - min) / range;
    const charIndex = Math.min(Math.floor(normalized * chars.length), chars.length - 1);
    return chars[charIndex];
  }).join('');
}

export function progressBar(value: number, max: number, width: number = 20): string {
  const percent = Math.min(Math.max(value / max, 0), 1);
  const filled = Math.round(percent * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

export function horizontalBar(value: number, max: number, width: number = 30, char = '█'): string {
  const percent = Math.min(Math.max(value / max, 0), 1);
  const filled = Math.round(percent * width);
  return char.repeat(filled);
}

// ============================================
// ID GENERATION
// ============================================

export function generateId(prefix = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ============================================
// KEYBOARD / INPUT UTILITIES
// ============================================

export function isModifierKey(key: string): boolean {
  return ['shift', 'ctrl', 'alt', 'meta', 'control'].includes(key.toLowerCase());
}

export function parseKeyCombo(combo: string): { key: string; ctrl: boolean; shift: boolean; alt: boolean; meta: boolean } {
  const parts = combo.toLowerCase().split('+').map(p => p.trim());
  return {
    key: parts.filter(p => !isModifierKey(p))[0] || '',
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    meta: parts.includes('meta') || parts.includes('cmd'),
  };
}

// ============================================
// VALIDATION UTILITIES
// ============================================

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidPhone(phone: string): boolean {
  return /^\+?[\d\s-()]{10,}$/.test(phone);
}

export function isValidDate(date: string): boolean {
  const d = new Date(date);
  return !isNaN(d.getTime());
}

// ============================================
// DEBOUNCE / THROTTLE
// ============================================

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastRun = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastRun >= limit) {
      lastRun = now;
      fn(...args);
    }
  };
}

// ============================================
// DEEP CLONE / MERGE
// ============================================

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as T;
  if (Array.isArray(obj)) return obj.map(deepClone) as T;
  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const targetVal = target[key];
      const sourceVal = source[key];
      if (
        targetVal && sourceVal &&
        typeof targetVal === 'object' && typeof sourceVal === 'object' &&
        !Array.isArray(targetVal) && !Array.isArray(sourceVal)
      ) {
        result[key] = deepMerge(targetVal as Record<string, unknown>, sourceVal as Record<string, unknown>) as T[typeof key];
      } else {
        result[key] = sourceVal as T[typeof key];
      }
    }
  }
  return result;
}
