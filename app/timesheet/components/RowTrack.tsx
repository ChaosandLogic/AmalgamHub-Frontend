'use client'

import { useMemo } from 'react'
import { getSegments, slotLabelFullDay } from '../lib/timesheetUtils'
import { ENTRY_TYPE_COLORS, SLOT_WIDTH_PX, type EntryType } from '../lib/constants'
import type { RowData } from '../lib/types'

export interface RowTrackProps {
  row: RowData
  dayIndex: number
  totalSlots: number
  overlaps: boolean[]
  onMouseDownCell: (slotIndex: number, e: React.MouseEvent) => void
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
  const segs = getSegments(row.slots)
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
            onMouseDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const relativeX = e.clientX - rect.left
              const handleWidth = 12
              const totalWidth = rect.width

              if (relativeX <= handleWidth) {
                e.preventDefault()
                e.stopPropagation()
                onMouseDownHandle(seg.start, 'left')
              } else if (relativeX >= totalWidth - handleWidth) {
                e.preventDefault()
                e.stopPropagation()
                onMouseDownHandle(seg.end, 'right')
              } else {
                e.preventDefault()
                e.stopPropagation()
                const middleSlot = Math.floor(
                  seg.start + (seg.end - seg.start) / 2
                )
                onMouseDownCell(middleSlot, e)
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
                ? '1px solid var(--border)'
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
