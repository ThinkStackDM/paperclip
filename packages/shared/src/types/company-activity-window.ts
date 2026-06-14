/**
 * Company activity windows ("sprints").
 *
 * A company can be configured to only start agent runs during a fixed daily
 * window in a given IANA timezone. Outside the window, queued runs are held
 * (deferred, never failed) until the window opens again. `null` window means
 * the company is always active.
 */

export interface CompanyActivityWindow {
  /** IANA timezone the window hours are interpreted in, e.g. "Europe/Dublin". */
  timezone: string;
  /** Local hour (0-23) the window opens (inclusive). */
  startHour: number;
  /**
   * Local hour (0-23) the window closes (exclusive). `endHour === 0` means
   * midnight, so e.g. `{ startHour: 20, endHour: 0 }` covers 20:00-24:00.
   * Windows may wrap past midnight (`startHour > endHour`).
   */
  endHour: number;
  /**
   * When true (the default), agent session params are purged when the window
   * closes so the next sprint starts with a fresh context.
   */
  sessionPurgeOnClose?: boolean;
}

export interface CompanyActivityWindowState {
  /** Whether the window is currently open (runs may start). */
  open: boolean;
  /** Instant of the most recent open/closed boundary at or before `now`. */
  lastChangeAt: Date | null;
  /** Instant of the next open/closed boundary after `now`. */
  nextChangeAt: Date | null;
}

export interface CompanyRunPauseState {
  active: boolean;
  reason: string | null;
  pausedAt: Date | null;
  pausedBy: string | null;
}

/** Agents with this adapter type are exempt from activity-window gating. */
export const ACTIVITY_WINDOW_EXEMPT_ADAPTER_TYPES = ["paperclip_shell_handler"] as const;

/** Per-agent runtimeConfig flag that opts an agent out of activity windows. */
export const IGNORE_ACTIVITY_WINDOW_RUNTIME_CONFIG_KEY = "ignoreActivityWindow";

function readLocalHourMinute(timezone: string, instant: Date): { hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  });
  let hour = 0;
  let minute = 0;
  for (const part of formatter.formatToParts(instant)) {
    if (part.type === "hour") hour = Number(part.value);
    if (part.type === "minute") minute = Number(part.value);
  }
  // Some ICU versions emit hour 24 for midnight even with h23.
  if (hour === 24) hour = 0;
  return { hour, minute };
}

export function isValidActivityWindowTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function parseCompanyActivityWindow(raw: unknown): CompanyActivityWindow | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const candidate = raw as Record<string, unknown>;
  const timezone = typeof candidate.timezone === "string" ? candidate.timezone : null;
  const startHour = typeof candidate.startHour === "number" ? candidate.startHour : null;
  const endHour = typeof candidate.endHour === "number" ? candidate.endHour : null;
  if (
    !timezone ||
    startHour === null ||
    endHour === null ||
    !Number.isInteger(startHour) ||
    !Number.isInteger(endHour) ||
    startHour < 0 ||
    startHour > 23 ||
    endHour < 0 ||
    endHour > 23 ||
    !isValidActivityWindowTimezone(timezone)
  ) {
    return null;
  }
  return {
    timezone,
    startHour,
    endHour,
    sessionPurgeOnClose: candidate.sessionPurgeOnClose !== false,
  };
}

export function parseCompanyRunPauseState(raw: unknown): CompanyRunPauseState {
  const fallback: CompanyRunPauseState = { active: false, reason: null, pausedAt: null, pausedBy: null };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const candidate = raw as Record<string, unknown>;
  if (candidate.active !== true) return fallback;
  const pausedAt = typeof candidate.pausedAt === "string" || candidate.pausedAt instanceof Date
    ? new Date(candidate.pausedAt as string | Date)
    : null;
  return {
    active: true,
    reason: typeof candidate.reason === "string" && candidate.reason.length > 0 ? candidate.reason : null,
    pausedAt: pausedAt && !Number.isNaN(pausedAt.getTime()) ? pausedAt : null,
    pausedBy: typeof candidate.pausedBy === "string" && candidate.pausedBy.length > 0 ? candidate.pausedBy : null,
  };
}

export function isActivityWindowOpen(window: CompanyActivityWindow, now: Date = new Date()): boolean {
  const { hour } = readLocalHourMinute(window.timezone, now);
  const { startHour, endHour } = window;
  if (startHour === endHour) return true; // zero-length window treated as always open
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  // Wraps past midnight, e.g. 20 -> 4 (endHour 0 means midnight: 20 -> 24).
  return hour >= startHour || hour < endHour;
}

/** Step used when scanning for window boundaries; 15 min keeps half-hour TZs correct. */
const BOUNDARY_SCAN_STEP_MS = 15 * 60 * 1000;
const BOUNDARY_SCAN_RANGE_MS = 50 * 60 * 60 * 1000;

function scanBoundary(window: CompanyActivityWindow, from: Date, direction: 1 | -1): Date | null {
  const initialOpen = isActivityWindowOpen(window, from);
  // Align to the next/previous step boundary so returned instants are tidy.
  const aligned = direction === 1
    ? Math.floor(from.getTime() / BOUNDARY_SCAN_STEP_MS) * BOUNDARY_SCAN_STEP_MS
    : Math.ceil(from.getTime() / BOUNDARY_SCAN_STEP_MS) * BOUNDARY_SCAN_STEP_MS;
  for (
    let offset = BOUNDARY_SCAN_STEP_MS;
    offset <= BOUNDARY_SCAN_RANGE_MS;
    offset += BOUNDARY_SCAN_STEP_MS
  ) {
    const candidate = new Date(aligned + direction * offset);
    if (isActivityWindowOpen(window, candidate) !== initialOpen) {
      // Forward: the boundary is the first instant in the new state.
      // Backward: the boundary is the first instant of the *current* state,
      // i.e. one step after the flipped candidate.
      return direction === 1 ? candidate : new Date(candidate.getTime() + BOUNDARY_SCAN_STEP_MS);
    }
  }
  return null;
}

export function getActivityWindowState(
  window: CompanyActivityWindow,
  now: Date = new Date(),
): CompanyActivityWindowState {
  if (window.startHour === window.endHour) {
    return { open: true, lastChangeAt: null, nextChangeAt: null };
  }
  return {
    open: isActivityWindowOpen(window, now),
    lastChangeAt: scanBoundary(window, now, -1),
    nextChangeAt: scanBoundary(window, now, 1),
  };
}

/** Formats the next-open time for UI/skip reasons, e.g. "04:00 (Europe/Dublin)". */
export function formatActivityWindowOpensAt(window: CompanyActivityWindow): string {
  const opensAt = `${String(window.startHour).padStart(2, "0")}:00`;
  return `${opensAt} (${window.timezone})`;
}
