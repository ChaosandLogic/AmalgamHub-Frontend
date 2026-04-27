'use client'

import { useMemo } from 'react'
import { EDGE_THRESHOLD } from '../../lib/constants/schedule'
import { clamp, getDisplaySegments, slotLabelFullDay } from '../lib/timesheetUtils'
import { ENTRY_TYPE_COLORS, SLOT_WIDTH_PX, type EntryType } from '../lib/constants'
import type { RowData } from '../lib/types'

/** Pixels reserved for the middle drag (move) zone; keeps resize strips from meeting on narrow entries. */
const MIN_MOVE_ZONE_PX = 8

/**
 * Max pixels from each end that count as resize, capped so a usable move region remains
 * (matches schedule intent: fixed px edges only when the bar is wide enough).
 */
function segmentEdgeHandleWidth(widthPx: number): number {
  if (widthPx <= 0) return 0
  const forMoveAndEdges = widthPx - MIN_MOVE_ZONE_PX
  if (forMoveAndEdges > 0) {
    return Math.min(EDGE_THRESHOLD, Math.floor(forMoveAndEdges / 2))
  }
  // Bar shorter than the reserved move zone: use thin edges so most of the bar still moves
  return Math.max(0, Math.min(EDGE_THRESHOLD, Math.floor((widthPx - 1) / 3)))
}

export interface RowTrackProps {
  row: RowData
  dayIndex: number
  totalSlots: number
  overlaps: boolean[]
  onMouseDownCell: (
    slotIndex: number,
    e: React.MouseEvent,
    options?: { fromSegmentBody?: boolean }
  ) => void
  onMouseDownHandle: (slotIndex: number, edge: 'left' | 'right') => void
  trackDomId?: string
  trackRef?: React.RefObject<HTMLDivElement | null>
  selectedSegment: { dayIndex: number; rowId: string; start: number; end: number } | null
  setSelectedSegment: (v: { dayIndex: number; rowId: string; start: number; end: number } | null) => void
  deleteSegment: (dayIndex: number, rowId: string, start: number, end: number) => void
  entryTypePopup: { dayIndex: number; rowId: string; start: number; end: number } | null
  setEntryTypePopup: (v: { dayIndex: number; rowId: string; start: number; end: number } | null) => void
  setSegmentEntryType: (dayIndex: number, rowId: string, start: number, end: number, type: EntryType) => void
  overtimeEnabled: boolean
}

function renderSegments(
  row: RowData,
  dayIndex: number,
  totalSlots: number,
  onMouseDownHandle: RowTrackProps['onMouseDownHandle'],
  overlaps: boolean[],
  onMouseDownCell: RowTrackProps['onMouseDownCell'],
  selectedSegment: RowTrackProps['selectedSegment'],
  setSelectedSegment: RowTrackProps['setSelectedSegment'],
  _deleteSegment: RowTrackProps['deleteSegment'],
  setEntryTypePopup: RowTrackProps['setEntryTypePopup'],
  _setSegmentEntryType: RowTrackProps['setSegmentEntryType'],
  overtimeEnabled: boolean
) {
  const segs = getDisplaySegments(row.slots, row.slotEntryTypes, overtimeEnabled)
  if (segs.length === 0) return null
  return (
    <>
      {segs.map((seg: { start: number; end: number }, idx: number) => {
        const leftPercent = (seg.start / totalSlots) * 100
        const widthPercent = ((seg.end - seg.start + 1) / totalSlots) * 100
        let hasOverlap = false
        for (let i = seg.start; i <= seg.end; i++)
          if (row.slots[i] && overlaps?.[i]) {
            hasOverlap = true
            break
          }

        const segmentType: EntryType =
          (row.slotEntryTypes?.[seg.start] as EntryType) || 'standard'
        const colors = ENTRY_TYPE_COLORS[segmentType]

        const isSelected =
          selectedSegment &&
          selectedSegment.dayIndex === dayIndex &&
          selectedSegment.rowId === row.id &&
          selectedSegment.start === seg.start &&
          selectedSegment.end === seg.end

        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              left: `${leftPercent}%`,
              width: `${widthPercent}%`,
              top: 0,
              bottom: 0,
              background: hasOverlap ? 'var(--danger-200)' : colors.bg,
              border: `2px solid ${hasOverlap ? colors.overlapBorder : isSelected ? 'var(--warning)' : colors.border}`,
              borderRadius: 6,
              pointerEvents: 'auto',
              boxShadow: isSelected ? '0 0 0 2px var(--warning)' : '0 1px 2px rgba(0,0,0,0.06)',
              zIndex: isSelected ? 3 : 2,
              cursor: 'move',
              overflow: 'hidden',
            }}
            onClick={(e) => {
              e.stopPropagation()
              setSelectedSegment({
                dayIndex,
                rowId: row.id,
                start: seg.start,
                end: seg.end,
              })
            }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              if (overtimeEnabled) {
                setEntryTypePopup({
                  dayIndex,
                  rowId: row.id,
                  start: seg.start,
                  end: seg.end,
                })
              }
            }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const w = rect.width
              const edge = segmentEdgeHandleWidth(w)
              const mouseX = e.clientX - rect.left
              if (w <= 0) return
              if (edge > 0 && mouseX <= edge) {
                e.currentTarget.style.cursor = 'ew-resize'
              } else if (edge > 0 && mouseX >= w - edge) {
                e.currentTarget.style.cursor = 'ew-resize'
              } else {
                e.currentTarget.style.cursor = 'move'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.cursor = 'move'
            }}
            onMouseDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const relativeX = e.clientX - rect.left
              const totalWidth = rect.width
              const handleWidth = segmentEdgeHandleWidth(totalWidth)

              if (handleWidth > 0 && relativeX <= handleWidth) {
                e.preventDefault()
                e.stopPropagation()
                onMouseDownHandle(seg.start, 'left')
              } else if (handleWidth > 0 && relativeX >= totalWidth - handleWidth) {
                e.preventDefault()
                e.stopPropagation()
                onMouseDownHandle(seg.end, 'right')
              } else {
                e.preventDefault()
                e.stopPropagation()
                const trackEl = e.currentTarget.parentElement
                if (!trackEl) return
                const tRect = trackEl.getBoundingClientRect()
                if (tRect.width <= 0) return
                const x = clamp(e.clientX - tRect.left, 0, tRect.width)
                const rawSlot = Math.floor(x / (tRect.width / totalSlots))
                const clickSlot = clamp(rawSlot, seg.start, seg.end)
                onMouseDownCell(clickSlot, e, { fromSegmentBody: true })
              }
            }}
          />
        )
      })}
    </>
  )
}

export default function RowTrack({
  row,
  dayIndex,
  totalSlots,
  overlaps,
  onMouseDownCell,
  onMouseDownHandle,
  trackDomId,
  trackRef,
  selectedSegment,
  setSelectedSegment,
  deleteSegment,
  entryTypePopup,
  setEntryTypePopup,
  setSegmentEntryType,
  overtimeEnabled,
}: RowTrackProps) {
  const hours = useMemo(
    () => Array.from({ length: totalSlots }, (_, i) => i),
    [totalSlots]
  )
  const slotBg = (i: number) => {
    if (!row.slots[i]) return 'transparent'
    if (overlaps[i]) return 'var(--danger-200)'
    const t = (row.slotEntryTypes?.[i] || 'standard') as EntryType
    return ENTRY_TYPE_COLORS[t]?.bg ?? 'var(--primary-100)'
  }
  return (
    <div
      ref={trackRef}
      id={trackDomId}
      style={{
        position: 'relative',
        height: 36,
        background: 'var(--track)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: `repeat(${totalSlots}, 1fr)`,
        minWidth: totalSlots * SLOT_WIDTH_PX,
        width: totalSlots * SLOT_WIDTH_PX,
        boxSizing: 'border-box',
        isolation: 'isolate',
      }}
    >
      {hours.map((i) => (
        <div
          key={i}
          onMouseDown={(e) => onMouseDownCell(i, e)}
          style={{
            cursor: 'crosshair',
            borderLeft:
              i % 4 === 0
                ? '1px solid var(--border-strong)'
                : '1px dashed var(--border-strong)',
            background: slotBg(i),
          }}
          title={slotLabelFullDay(i)}
        />
      ))}
      {renderSegments(
        row,
        dayIndex,
        totalSlots,
        onMouseDownHandle,
        overlaps,
        onMouseDownCell,
        selectedSegment,
        setSelectedSegment,
        deleteSegment,
        setEntryTypePopup,
        setSegmentEntryType,
        overtimeEnabled
      )}
    </div>
  )
}
