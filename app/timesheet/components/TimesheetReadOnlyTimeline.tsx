'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { parseLocalDateString, startOfWeek } from '../../lib/utils/dateUtils'
import {
  DAYS,
  FULL_DAY_SLOTS,
  LEGACY_OFFSET,
  LEGACY_SLOTS,
  SLOT_WIDTH_PX,
  DEFAULT_SCROLL_START_SLOT,
} from '../lib/constants'
import {
  computeOverlaps,
  computeWeeklySummary,
  hydrateSlotsFromSavedRow,
  hydrateSlotEntryTypesFromSavedRow,
} from '../lib/timesheetUtils'
import { fullJobCode } from '../lib/jobPrefixUtils'
import type { RowData } from '../lib/types'
import DayTabs from './DayTabs'
import RowTrack from './RowTrack'
import TimelineHeaderStrip from './TimelineHeaderStrip'
import WeeklySummary from './WeeklySummary'

const DAY_ENTRY_CARD_PADDING = Math.round(12 * 1.25)
const DAY_ENTRY_CARD_INNER_GAP = Math.round(2)
const DAY_ENTRY_GRID_GAP = 4
/** Breathing room below the last entry row inside the day card */
const DAY_ENTRY_ROWS_BOTTOM_PAD = 24

function normalizeRowFromTimesheetApi(raw: any, rowIdx: number): RowData {
  let slots: boolean[]
  if (Array.isArray(raw.slots) && raw.slots.length >= FULL_DAY_SLOTS) {
    slots = raw.slots.slice(0, FULL_DAY_SLOTS).map(Boolean)
  } else if (Array.isArray(raw.slots) && raw.slots.length === LEGACY_SLOTS) {
    slots = Array(FULL_DAY_SLOTS).fill(false)
    for (let i = 0; i < LEGACY_SLOTS; i++) slots[LEGACY_OFFSET + i] = Boolean(raw.slots[i])
  } else if (Array.isArray(raw.slots) && raw.slots.length > 0) {
    slots = Array(FULL_DAY_SLOTS).fill(false)
    for (let i = 0; i < Math.min(raw.slots.length, FULL_DAY_SLOTS); i++) slots[i] = Boolean(raw.slots[i])
  } else {
    slots = hydrateSlotsFromSavedRow(raw, FULL_DAY_SLOTS)
  }

  const slotEntryTypes = hydrateSlotEntryTypesFromSavedRow({ ...raw }, slots, FULL_DAY_SLOTS)

  const slotHours = slots.filter(Boolean).length * 0.25
  const totalHours =
    typeof raw.totalHours === 'number'
      ? raw.totalHours
      : parseFloat(String(raw.totalHours ?? '')) || slotHours

  const overtimeHours =
    typeof raw.overtimeHours === 'number'
      ? raw.overtimeHours
      : parseFloat(String(raw.overtimeHours ?? '')) || 0

  return {
    id: String(raw.id ?? `row-${rowIdx}`),
    jobPrefix: raw.jobPrefix != null ? String(raw.jobPrefix) : '',
    jobNumber: raw.jobNumber != null ? String(raw.jobNumber) : '',
    slots,
    slotEntryTypes,
    totalHours,
    overtimeHours,
  }
}

function normalizeDays(rawDays: unknown): RowData[][] {
  const out: RowData[][] = []
  const src = Array.isArray(rawDays) ? rawDays : []
  for (let d = 0; d < 7; d++) {
    const dayArr = Array.isArray(src[d]) ? src[d] : []
    const rows = dayArr
      .map((raw: any, idx: number) => normalizeRowFromTimesheetApi(raw, idx))
      .filter((r: RowData) => fullJobCode(r) || r.slots.some(Boolean))
    out.push(rows.length > 0 ? rows : [])
  }
  return out
}

function normalizeDayNotes(raw: unknown): string[] {
  const notes: string[] = Array(7).fill('')
  if (!Array.isArray(raw)) return notes
  for (let i = 0; i < 7; i++) {
    const v = raw[i]
    notes[i] = typeof v === 'string' ? v : ''
  }
  return notes
}

export interface TimesheetReadOnlyTimelineProps {
  /** Seven arrays of job rows (Mon–Sun). */
  days: unknown
  dayNotes?: unknown
  /** Week start date string YYYY-MM-DD */
  weekStartDate: string
  overtimeEnabled?: boolean
}

export default function TimesheetReadOnlyTimeline({
  days,
  dayNotes,
  weekStartDate,
  overtimeEnabled = true,
}: TimesheetReadOnlyTimelineProps) {
  const totalSlots = FULL_DAY_SLOTS
  const timelineScrollRef = useRef<HTMLDivElement>(null)
  const [activeDay, setActiveDay] = useState(0)

  const weekStart = useMemo(() => {
    try {
      return startOfWeek(parseLocalDateString(weekStartDate))
    } catch {
      return startOfWeek(new Date())
    }
  }, [weekStartDate])

  const rowsByDay = useMemo(() => normalizeDays(days), [days])
  const notes = useMemo(() => normalizeDayNotes(dayNotes), [dayNotes])

  const summary = useMemo(
    () => computeWeeklySummary(rowsByDay, overtimeEnabled),
    [rowsByDay, overtimeEnabled]
  )

  const overlaps = useMemo(
    () => computeOverlaps(rowsByDay[activeDay] || [], totalSlots),
    [rowsByDay, activeDay, totalSlots]
  )

  useEffect(() => {
    const t = setTimeout(() => {
      const el = timelineScrollRef.current
      if (el) el.scrollLeft = DEFAULT_SCROLL_START_SLOT * SLOT_WIDTH_PX
    }, 0)
    return () => clearTimeout(t)
  }, [activeDay])

  const noopSeg = () => {}

  const activeRows = rowsByDay[activeDay] ?? []
  const entryRowCount = activeRows.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', minWidth: 0 }}>
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          flexWrap: 'wrap',
        }}
      >
        <DayTabs weekStart={weekStart} activeDay={activeDay} onSelect={setActiveDay} />
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          Week commencing {weekStart.toLocaleDateString('en-GB')} • read-only
        </span>
      </div>

      <section
        style={{
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: DAY_ENTRY_CARD_PADDING,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          width: '100%',
          minWidth: 0,
          overflowX: 'hidden',
        }}
      >
        <h3 style={{ margin: `0 0 ${DAY_ENTRY_CARD_INNER_GAP}px 0` }}>{DAYS[activeDay]}</h3>
        {(entryRowCount) === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 14 }}>No entries for this day.</div>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: DAY_ENTRY_GRID_GAP,
              marginTop: DAY_ENTRY_CARD_INNER_GAP,
              gridTemplateColumns: 'minmax(120px, 200px) 1fr auto',
              gridTemplateRows: `26px repeat(${entryRowCount}, 36px) ${DAY_ENTRY_ROWS_BOTTOM_PAD}px`,
              alignItems: 'stretch',
              width: '100%',
              minWidth: 0,
            }}
          >
            <div style={{ gridColumn: 1, gridRow: 1 }} />
            {activeRows.map((row, rowIdx) => (
              <div
                key={row.id}
                style={{
                  gridColumn: 1,
                  gridRow: rowIdx + 2,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 13,
                  fontWeight: 500,
                  wordBreak: 'break-word',
                  paddingRight: 8,
                }}
              >
                {fullJobCode(row) || '—'}
              </div>
            ))}
            <div
              ref={timelineScrollRef}
              style={{
                gridColumn: 2,
                gridRow: '1 / -1',
                overflowX: 'auto',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  width: totalSlots * SLOT_WIDTH_PX,
                  display: 'flex',
                  flexDirection: 'column',
                  // Must match grid gap so job no. / hours columns align with RowTrack rows
                  gap: DAY_ENTRY_GRID_GAP,
                  alignItems: 'stretch',
                }}
              >
                <div
                  style={{
                    height: 26,
                    minHeight: 26,
                    flexShrink: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                  }}
                >
                  <TimelineHeaderStrip totalSlots={totalSlots} />
                </div>
                {activeRows.map((row) => (
                  <RowTrack
                    key={row.id}
                    row={row}
                    dayIndex={activeDay}
                    totalSlots={totalSlots}
                    overlaps={overlaps}
                    onMouseDownCell={noopSeg}
                    onMouseDownHandle={noopSeg}
                    selectedSegment={null}
                    setSelectedSegment={() => {}}
                    deleteSegment={() => {}}
                    entryTypePopup={null}
                    setEntryTypePopup={() => {}}
                    setSegmentEntryType={() => {}}
                    overtimeEnabled={overtimeEnabled}
                    readOnly
                  />
                ))}
                <div
                  aria-hidden
                  style={{
                    height: DAY_ENTRY_ROWS_BOTTOM_PAD,
                    minHeight: DAY_ENTRY_ROWS_BOTTOM_PAD,
                    flexShrink: 0,
                  }}
                />
              </div>
            </div>
            <div style={{ gridColumn: 3, gridRow: 1 }} />
            {activeRows.map((row, rowIdx) => (
              <div
                key={`h-${row.id}`}
                style={{
                  gridColumn: 3,
                  gridRow: rowIdx + 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  fontSize: 12,
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: 40,
                }}
              >
                {row.totalHours.toFixed(2)}
              </div>
            ))}
          </div>
        )}
      </section>

      {(notes[activeDay] || '').trim() ? (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 16,
            background: 'var(--surface)',
            fontSize: 13,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          <strong>Notes for {DAYS[activeDay]}:</strong> {notes[activeDay].trim()}
        </div>
      ) : null}

      <WeeklySummary summary={summary} />
    </div>
  )
}
