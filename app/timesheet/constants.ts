/**
 * Timesheet timeline constants and entry type styling.
 */

/** Full day in 15-min slots: 24 * 4 = 96. */
export const FULL_DAY_SLOTS = 96

/** Slot width in px so ~12 hours (48 slots) fit in the visible scroll area. */
export const SLOT_WIDTH_PX = 20

/** Default scroll: slot index for left edge of visible window (e.g. 28 = 7am). */
export const DEFAULT_SCROLL_START_SLOT = 28

/** Legacy 53-slot data (7am–8pm) maps into full day at this offset (7 * 4 = 28). */
export const LEGACY_OFFSET = 28
export const LEGACY_SLOTS = 53

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

export type EntryType = 'standard' | 'overtime' | 'extra-overtime'

export const ENTRY_TYPE_COLORS: Record<EntryType, { bg: string; border: string; overlapBorder: string }> = {
  standard: { bg: 'var(--primary-200)', border: 'var(--primary)', overlapBorder: 'var(--danger-700)' },
  overtime: { bg: 'var(--warning-light)', border: 'var(--warning)', overlapBorder: 'var(--danger-700)' },
  'extra-overtime': { bg: 'var(--error-light)', border: 'var(--error)', overlapBorder: 'var(--danger-700)' },
}
