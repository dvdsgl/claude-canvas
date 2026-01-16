// Shared types for calendar components

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  color?: string;
  allDay?: boolean;
}

export interface TimeSlot {
  day: Date;
  hour: number;
  minute: number; // 0 or 30 for half-hour slots
}

export interface TimeRange {
  startTime: Date;
  endTime: Date;
}

// Color palette with contrasting text colors
export const INK_COLORS = ["yellow", "green", "blue", "magenta", "red", "cyan"];

export const TEXT_COLORS: Record<string, string> = {
  yellow: "black",
  cyan: "black",
  green: "white",
  blue: "white",
  magenta: "white",
  red: "white",
};

// Event colors as a record for color picker
export const EVENT_COLORS: Record<string, string> = {
  yellow: "yellow",
  green: "green",
  blue: "blue",
  magenta: "magenta",
  red: "red",
  cyan: "cyan",
};

// Calendar configuration for edit mode
export interface EditCalendarConfig {
  events?: CalendarEvent[];
  storageFile?: string;
  startHour?: number;
  endHour?: number;
}

// Utility functions

export function getWeekDays(baseDate: Date): Date[] {
  const days: Date[] = [];
  const dayOfWeek = baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));

  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    days.push(day);
  }
  return days;
}

export function formatDayName(date: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[date.getDay()];
}

export function formatDayNumber(date: Date): string {
  return date.getDate().toString();
}

export function formatMonthYear(date: Date): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatHour(hour: number): string {
  if (hour === 0 || hour === 12) return "12";
  return hour < 12 ? `${hour}` : `${hour - 12}`;
}

export function getAmPm(hour: number): string {
  return hour < 12 ? "am" : "pm";
}

export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function isAllDayEvent(event: CalendarEvent): boolean {
  if (event.allDay) return true;
  const start = event.startTime;
  const end = event.endTime;
  return (
    start.getHours() === 0 &&
    start.getMinutes() === 0 &&
    end.getHours() === 0 &&
    end.getMinutes() === 0 &&
    end.getTime() - start.getTime() >= 24 * 60 * 60 * 1000
  );
}

export function timeToDecimal(date: Date): number {
  return date.getHours() + date.getMinutes() / 60;
}

export function slotToTime(day: Date, slotIndex: number, granularity: number): Date {
  const result = new Date(day);
  const totalMinutes = slotIndex * granularity;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  result.setHours(hours, minutes, 0, 0);
  return result;
}
