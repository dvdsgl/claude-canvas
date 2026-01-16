// Config validation utilities for Canvas API
// Provides runtime validation of config objects before spawning canvases

import type { MeetingPickerConfig, DocumentConfig, CalendarEvent } from "../scenarios/types";
import type { FlightConfig, Flight, Airport, Seatmap } from "../canvases/flight/types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Create a validation result
 */
function createResult(errors: string[] = []): ValidationResult {
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a value is a non-empty string
 */
function isNonEmptyString(value: unknown, field: string): string | null {
  if (typeof value !== "string") {
    return `${field} must be a string`;
  }
  if (value.trim().length === 0) {
    return `${field} must not be empty`;
  }
  return null;
}

/**
 * Check if a value is a valid ISO datetime string
 */
function isValidISODateTime(value: unknown, field: string): string | null {
  if (typeof value !== "string") {
    return `${field} must be a string`;
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return `${field} must be a valid ISO datetime string`;
  }
  return null;
}

/**
 * Check if a value is a positive number
 */
function isPositiveNumber(value: unknown, field: string): string | null {
  if (typeof value !== "number") {
    return `${field} must be a number`;
  }
  if (value <= 0) {
    return `${field} must be positive`;
  }
  return null;
}

/**
 * Check if a value is a non-negative number
 */
function isNonNegativeNumber(value: unknown, field: string): string | null {
  if (typeof value !== "number") {
    return `${field} must be a number`;
  }
  if (value < 0) {
    return `${field} must be non-negative`;
  }
  return null;
}

/**
 * Validate a calendar event
 */
function validateCalendarEvent(event: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `events[${index}]`;

  if (!event || typeof event !== "object") {
    errors.push(`${prefix} must be an object`);
    return errors;
  }

  const e = event as Record<string, unknown>;

  const idError = isNonEmptyString(e.id, `${prefix}.id`);
  if (idError) errors.push(idError);

  const titleError = isNonEmptyString(e.title, `${prefix}.title`);
  if (titleError) errors.push(titleError);

  const startError = isValidISODateTime(e.startTime, `${prefix}.startTime`);
  if (startError) errors.push(startError);

  const endError = isValidISODateTime(e.endTime, `${prefix}.endTime`);
  if (endError) errors.push(endError);

  return errors;
}

/**
 * Validate an airport object
 */
function validateAirport(airport: unknown, field: string): string[] {
  const errors: string[] = [];

  if (!airport || typeof airport !== "object") {
    errors.push(`${field} must be an object`);
    return errors;
  }

  const a = airport as Record<string, unknown>;

  const codeError = isNonEmptyString(a.code, `${field}.code`);
  if (codeError) errors.push(codeError);

  const nameError = isNonEmptyString(a.name, `${field}.name`);
  if (nameError) errors.push(nameError);

  const cityError = isNonEmptyString(a.city, `${field}.city`);
  if (cityError) errors.push(cityError);

  const tzError = isNonEmptyString(a.timezone, `${field}.timezone`);
  if (tzError) errors.push(tzError);

  return errors;
}

/**
 * Validate a seatmap object
 */
function validateSeatmap(seatmap: unknown, field: string): string[] {
  const errors: string[] = [];

  if (!seatmap || typeof seatmap !== "object") {
    errors.push(`${field} must be an object`);
    return errors;
  }

  const s = seatmap as Record<string, unknown>;

  const rowsError = isPositiveNumber(s.rows, `${field}.rows`);
  if (rowsError) errors.push(rowsError);

  if (!Array.isArray(s.seatsPerRow)) {
    errors.push(`${field}.seatsPerRow must be an array`);
  } else if (s.seatsPerRow.length === 0) {
    errors.push(`${field}.seatsPerRow must not be empty`);
  }

  if (!Array.isArray(s.aisleAfter)) {
    errors.push(`${field}.aisleAfter must be an array`);
  }

  if (!Array.isArray(s.unavailable)) {
    errors.push(`${field}.unavailable must be an array`);
  }

  if (!Array.isArray(s.premium)) {
    errors.push(`${field}.premium must be an array`);
  }

  if (!Array.isArray(s.occupied)) {
    errors.push(`${field}.occupied must be an array`);
  }

  return errors;
}

/**
 * Validate a flight object
 */
function validateFlight(flight: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `flights[${index}]`;

  if (!flight || typeof flight !== "object") {
    errors.push(`${prefix} must be an object`);
    return errors;
  }

  const f = flight as Record<string, unknown>;

  const idError = isNonEmptyString(f.id, `${prefix}.id`);
  if (idError) errors.push(idError);

  const airlineError = isNonEmptyString(f.airline, `${prefix}.airline`);
  if (airlineError) errors.push(airlineError);

  const flightNumError = isNonEmptyString(f.flightNumber, `${prefix}.flightNumber`);
  if (flightNumError) errors.push(flightNumError);

  errors.push(...validateAirport(f.origin, `${prefix}.origin`));
  errors.push(...validateAirport(f.destination, `${prefix}.destination`));

  const depError = isValidISODateTime(f.departureTime, `${prefix}.departureTime`);
  if (depError) errors.push(depError);

  const arrError = isValidISODateTime(f.arrivalTime, `${prefix}.arrivalTime`);
  if (arrError) errors.push(arrError);

  const durationError = isPositiveNumber(f.duration, `${prefix}.duration`);
  if (durationError) errors.push(durationError);

  const priceError = isNonNegativeNumber(f.price, `${prefix}.price`);
  if (priceError) errors.push(priceError);

  const currencyError = isNonEmptyString(f.currency, `${prefix}.currency`);
  if (currencyError) errors.push(currencyError);

  const validCabins = ["economy", "premium", "business", "first"];
  if (!validCabins.includes(f.cabinClass as string)) {
    errors.push(`${prefix}.cabinClass must be one of: ${validCabins.join(", ")}`);
  }

  const stopsError = isNonNegativeNumber(f.stops, `${prefix}.stops`);
  if (stopsError) errors.push(stopsError);

  // Validate optional seatmap if present
  if (f.seatmap !== undefined) {
    errors.push(...validateSeatmap(f.seatmap, `${prefix}.seatmap`));
  }

  return errors;
}

/**
 * Validate a meeting picker configuration
 */
export function validateMeetingPickerConfig(config: unknown): ValidationResult {
  const errors: string[] = [];

  if (!config || typeof config !== "object") {
    return createResult(["Config must be an object"]);
  }

  const c = config as Record<string, unknown>;

  // Validate calendars (required)
  if (!Array.isArray(c.calendars)) {
    errors.push("calendars must be an array");
  } else if (c.calendars.length === 0) {
    errors.push("calendars must not be empty");
  } else {
    for (let i = 0; i < c.calendars.length; i++) {
      const calendar = c.calendars[i] as Record<string, unknown>;
      if (!calendar || typeof calendar !== "object") {
        errors.push(`calendars[${i}] must be an object`);
        continue;
      }
      const nameError = isNonEmptyString(calendar.name, `calendars[${i}].name`);
      if (nameError) errors.push(nameError);

      const colorError = isNonEmptyString(calendar.color, `calendars[${i}].color`);
      if (colorError) errors.push(colorError);

      if (Array.isArray(calendar.events)) {
        for (let j = 0; j < calendar.events.length; j++) {
          errors.push(...validateCalendarEvent(calendar.events[j], j));
        }
      }
    }
  }

  // Validate slot granularity
  const validGranularity = [15, 30, 60];
  if (!validGranularity.includes(c.slotGranularity as number)) {
    errors.push(`slotGranularity must be one of: ${validGranularity.join(", ")}`);
  }

  // Validate duration constraints
  const minDurError = isPositiveNumber(c.minDuration, "minDuration");
  if (minDurError) errors.push(minDurError);

  const maxDurError = isPositiveNumber(c.maxDuration, "maxDuration");
  if (maxDurError) errors.push(maxDurError);

  if (
    typeof c.minDuration === "number" &&
    typeof c.maxDuration === "number" &&
    c.minDuration > c.maxDuration
  ) {
    errors.push("minDuration must not exceed maxDuration");
  }

  return createResult(errors);
}

/**
 * Validate a document configuration
 */
export function validateDocumentConfig(config: unknown): ValidationResult {
  const errors: string[] = [];

  if (!config || typeof config !== "object") {
    return createResult(["Config must be an object"]);
  }

  const c = config as Record<string, unknown>;

  // Content is required
  if (typeof c.content !== "string") {
    errors.push("content must be a string");
  }

  // Validate optional diffs
  if (c.diffs !== undefined && !Array.isArray(c.diffs)) {
    errors.push("diffs must be an array");
  } else if (Array.isArray(c.diffs)) {
    for (let i = 0; i < c.diffs.length; i++) {
      const diff = c.diffs[i] as Record<string, unknown>;
      if (!diff || typeof diff !== "object") {
        errors.push(`diffs[${i}] must be an object`);
        continue;
      }

      const startError = isNonNegativeNumber(diff.startOffset, `diffs[${i}].startOffset`);
      if (startError) errors.push(startError);

      const endError = isNonNegativeNumber(diff.endOffset, `diffs[${i}].endOffset`);
      if (endError) errors.push(endError);

      if (!["add", "delete"].includes(diff.type as string)) {
        errors.push(`diffs[${i}].type must be "add" or "delete"`);
      }
    }
  }

  return createResult(errors);
}

/**
 * Validate a flight booking configuration
 */
export function validateFlightConfig(config: unknown): ValidationResult {
  const errors: string[] = [];

  if (!config || typeof config !== "object") {
    return createResult(["Config must be an object"]);
  }

  const c = config as Record<string, unknown>;

  // Flights is required
  if (!Array.isArray(c.flights)) {
    errors.push("flights must be an array");
  } else if (c.flights.length === 0) {
    errors.push("flights must not be empty");
  } else {
    for (let i = 0; i < c.flights.length; i++) {
      errors.push(...validateFlight(c.flights[i], i));
    }
  }

  return createResult(errors);
}

/**
 * Validate a base calendar configuration (display scenario)
 */
export function validateBaseCalendarConfig(config: unknown): ValidationResult {
  const errors: string[] = [];

  if (!config || typeof config !== "object") {
    return createResult(["Config must be an object"]);
  }

  const c = config as Record<string, unknown>;

  // Validate optional events
  if (c.events !== undefined && !Array.isArray(c.events)) {
    errors.push("events must be an array");
  } else if (Array.isArray(c.events)) {
    for (let i = 0; i < c.events.length; i++) {
      errors.push(...validateCalendarEvent(c.events[i], i));
    }
  }

  // Validate optional hour range
  if (c.startHour !== undefined) {
    if (typeof c.startHour !== "number" || c.startHour < 0 || c.startHour > 23) {
      errors.push("startHour must be a number between 0 and 23");
    }
  }

  if (c.endHour !== undefined) {
    if (typeof c.endHour !== "number" || c.endHour < 0 || c.endHour > 24) {
      errors.push("endHour must be a number between 0 and 24");
    }
  }

  if (
    typeof c.startHour === "number" &&
    typeof c.endHour === "number" &&
    c.startHour >= c.endHour
  ) {
    errors.push("startHour must be less than endHour");
  }

  return createResult(errors);
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(result: ValidationResult): string {
  if (result.valid) {
    return "Config is valid";
  }
  return `Invalid config:\n${result.errors.map(e => `  - ${e}`).join("\n")}`;
}
