/**
 * Shared types for the timesheet timeline.
 */

import type { EntryType } from './constants'

export interface RowData {
  id: string
  jobNumber: string
  slots: boolean[]
  slotEntryTypes: ('' | EntryType)[]
  totalHours: number
  overtimeHours: number
}

export interface SelectedSegment {
  dayIndex: number
  rowId: string
  start: number
  end: number
}
