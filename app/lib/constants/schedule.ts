/**
 * Schedule-related constants
 */

export const DAY_COLUMN_WIDTH = 40
export const ROW_HEIGHT = 60 // Increased by 50% from 40px
export const MONTHS_TO_DISPLAY = 6 // 6 months ahead
export const EDGE_THRESHOLD = 10 // pixels from edge to show resize cursor

/**
 * Email addresses whose corresponding resource should be hidden from the
 * Resource Schedule view (e.g. system / service accounts that aren't real
 * bookable people). Match is case-insensitive.
 */
export const EXCLUDED_SCHEDULE_EMAILS: readonly string[] = [
  'admin@amalgamhub.com',
]

