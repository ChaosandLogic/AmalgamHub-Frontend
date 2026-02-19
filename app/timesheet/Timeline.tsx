'use client'
import { useEffect, useMemo, useRef } from 'react'
import { useToast } from '../components/Toast'
import { getLocalDateString } from '../lib/utils/dateUtils'
import {
  DAYS,
  FULL_DAY_SLOTS,
  SLOT_WIDTH_PX,
  DEFAULT_SCROLL_START_SLOT,
  type EntryType,
} from './constants'
import {
  formatDateInput,
  computeWeeklySummary,
  computeOverlaps,
  lastUsedJobsFromSummary,
} from './timesheetUtils'
import ConfirmDialog from '../components/ConfirmDialog'
import DashboardCards from './components/DashboardCards'
import DayTabs from './components/DayTabs'
import EntryTypeDialog from './components/EntryTypeDialog'
import OverlapWarningDialog from './components/OverlapWarningDialog'
import RowTrack from './components/RowTrack'
import SearchableProjectDropdown from './components/SearchableProjectDropdown'
import TimelineHeaderStrip from './components/TimelineHeaderStrip'
import WeeklySummary from './components/WeeklySummary'
import {
  useTimelineSettings,
  useTimesheetData,
  useTimelineInteractions,
  useTimer,
} from './hooks'

type TimelineProps = { userName?: string }

// Re-export for consumers that import from Timeline
export type { EntryType } from './constants'

export default function Timeline({ userName }: TimelineProps) {
  const toast = useToast()
  const totalSlots = FULL_DAY_SLOTS
  const timelineScrollRef = useRef<HTMLDivElement>(null)
  const headerTimelineRef = useRef<HTMLDivElement>(null)
  const firstRowTrackRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<any>(null)

  const settings = useTimelineSettings()
  const {
    weekStart,
    setWeekStart,
    activeDay,
    setActiveDay,
    overtimeEnabled,
    setOvertimeEnabled,
    weekendOvertimeEnabled,
    setWeekendOvertimeEnabled,
    settingsLoaded,
    currentUserId,
    userResourceId,
    projects,
    todaysBookings,
    submittedTimesheets,
    setSubmittedTimesheets,
    submittedTimesheetsLoaded,
  } = settings

  const data = useTimesheetData({
    weekStart,
    userName: userName || '',
    overtimeEnabled,
    totalSlots,
    submittedTimesheets,
    submittedTimesheetsLoaded,
    setActiveDay,
    currentUserId,
  })
  const {
    rowsByDay,
    setRowsByDay,
    dayNotes,
    setDayNotes,
    submittedWeek,
    setSubmittedWeek,
    createEmptyRow,
    updateRow,
    addRow,
    removeRow,
    serialize,
    justSubmittedRef,
    nextRowId,
  } = data

  const interactions = useTimelineInteractions({
    rowsByDay,
    updateRow,
    totalSlots,
    overtimeEnabled,
    weekStart,
    serialize,
    currentUserId,
    setSubmittedWeek,
    setSubmittedTimesheets,
    justSubmittedRef,
    toast,
    getLocalDateString,
    setWeekStart,
  })
  const {
    selectedSegment,
    setSelectedSegment,
    entryTypePopup,
    setEntryTypePopup,
    entryTypeConfirm,
    setEntryTypeConfirm,
    showConfirmDialog,
    showOverlapWarning,
    overlapDetails,
    isDraggingRef,
    autoSave,
    trackId,
    onMouseDownCell,
    onMouseDownHandle,
    onMouseUp,
    deleteSegment,
    setSegmentEntryType,
    showSubmitConfirmation,
    confirmSubmit,
    cancelSubmit,
    dismissOverlapWarning,
    proceedDespiteOverlaps,
    navigateToWeek,
  } = interactions

  const timer = useTimer({
    rowsByDay,
    updateRow,
    createEmptyRow,
    setRowsByDay,
    activeDay,
    currentUserId,
    totalSlots,
    overtimeEnabled,
    nextRowId,
    autoSave,
    setActiveDay,
  })
  const {
    timerRunning,
    timerStartTime,
    timerJobNumber,
    setTimerJobNumber,
    timerElapsed,
    startTimer,
    stopTimer,
    formatTimerDuration,
  } = timer

  // Default scroll: 6am at start of visible window when timeline is shown or day changes
  useEffect(() => {
    if (!settingsLoaded) return
    const t = setTimeout(() => {
      const el = timelineScrollRef.current
      if (el) el.scrollLeft = DEFAULT_SCROLL_START_SLOT * SLOT_WIDTH_PX
    }, 0)
    return () => clearTimeout(t)
  }, [activeDay, settingsLoaded])

  // Scrollable full-day timeline: header and tracks use same min width, no sync needed

  const summary = useMemo(() => computeWeeklySummary(rowsByDay, overtimeEnabled), [rowsByDay, overtimeEnabled])
  const recentJobs = useMemo<{ jobNumber: string; title: string }[]>(
    () => lastUsedJobsFromSummary(summary, projects || []),
    [summary, projects]
  )
  const overlaps = useMemo(() => computeOverlaps(rowsByDay[activeDay] || [], totalSlots), [rowsByDay, activeDay, totalSlots])

  function scheduleAutoSave() {
    if (isDraggingRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => autoSave(), 800)
  }

  useEffect(() => {
    scheduleAutoSave()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsByDay, weekStart])

  // Clear all overtime hours when overtime is disabled
  useEffect(() => {
    if (!overtimeEnabled) {
      setRowsByDay(prev => prev.map(dayRows => 
        dayRows.map(row => ({ ...row, overtimeHours: 0 }))
      ))
    }
  }, [overtimeEnabled])

  // Auto-calculate weekend overtime per job - only when setting toggles
  const previousWeekendOvertimeEnabled = useRef(weekendOvertimeEnabled)
  
  useEffect(() => {
    // Only apply weekend overtime logic when the setting is explicitly toggled, not on every row change
    const settingChanged = previousWeekendOvertimeEnabled.current !== weekendOvertimeEnabled
    previousWeekendOvertimeEnabled.current = weekendOvertimeEnabled
    
    if (!settingChanged) return // Don't auto-apply on every row change
    
    if (weekendOvertimeEnabled && overtimeEnabled) {
      for (const dayIndex of [5, 6]) {
        const dayRows = rowsByDay[dayIndex] || []
        dayRows.forEach((row) => {
          if (row.totalHours > 0 && row.slots?.length) {
            updateRow(dayIndex, row.id, (r: any) => {
              const slotEntryTypes: ('' | EntryType)[] = [...(r.slotEntryTypes || [])]
              while (slotEntryTypes.length < r.slots.length) slotEntryTypes.push('')
              slotEntryTypes.length = r.slots.length
              for (let i = 0; i < r.slots.length; i++) {
                if (r.slots[i]) slotEntryTypes[i] = 'overtime'
              }
              const overtimeCount = slotEntryTypes.filter((t: string) => t === 'overtime' || t === 'extra-overtime').length
              return { ...r, slotEntryTypes, overtimeHours: overtimeCount / 4 }
            })
          }
        })
      }
    } else if (!weekendOvertimeEnabled) {
      for (const dayIndex of [5, 6]) {
        const dayRows = rowsByDay[dayIndex] || []
        dayRows.forEach((row) => {
          if ((row.overtimeHours > 0 || row.slotEntryTypes?.some((t: string) => t === 'overtime' || t === 'extra-overtime')) && row.slots?.length) {
            updateRow(dayIndex, row.id, (r: any) => {
              const slotEntryTypes: ('' | EntryType)[] = [...(r.slotEntryTypes || [])]
              while (slotEntryTypes.length < r.slots.length) slotEntryTypes.push('')
              slotEntryTypes.length = r.slots.length
              for (let i = 0; i < r.slots.length; i++) {
                if (r.slots[i] && (slotEntryTypes[i] === 'overtime' || slotEntryTypes[i] === 'extra-overtime')) slotEntryTypes[i] = 'standard'
              }
              const overtimeCount = slotEntryTypes.filter((t: string) => t === 'overtime' || t === 'extra-overtime').length
              return { ...r, slotEntryTypes, overtimeHours: overtimeCount / 4 }
            })
          }
        })
      }
    }
  }, [weekendOvertimeEnabled, overtimeEnabled])

  if (!settingsLoaded) {
    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ textAlign: 'center' }}>Loading timesheet...</div>
      </div>
    )
  }

  return (
    <div 
      style={{ padding: 0, display: 'flex', flexDirection: 'column', width: '100%', overflowX: 'hidden' }}
      onClick={(e) => {
        // Deselect segment when clicking outside
        if (e.target === e.currentTarget) {
          setSelectedSegment(null)
        }
      }}
    >
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <DayTabs weekStart={weekStart} activeDay={activeDay} onSelect={setActiveDay} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
              Week commencing:
            </label>
            <input
              type="date"
              value={formatDateInput(weekStart)}
              onChange={e => setWeekStart(new Date((e.target as HTMLInputElement).value))}
              style={{ 
                fontSize: '13px', 
                padding: '6px 8px', 
                border: '1px solid var(--border)', 
                borderRadius: '6px',
                background: 'var(--surface)'
              }}
            />
            {submittedWeek === getLocalDateString(weekStart) && (
              <div 
                onClick={() => {
                  // Show available weeks to navigate to
                  const availableWeeks = Object.keys(submittedTimesheets).sort().reverse()
                  if (availableWeeks.length > 1) {
                    const weekOptions = availableWeeks.map(week => 
                      `${new Date(week).toLocaleDateString()} (${submittedTimesheets[week].summary?.totalHours?.toFixed(1) || '0'}h)`
                    ).join('\n')
                    toast.info(`Available submitted weeks:\n${weekOptions}\n\nNavigating to the most recent week.`)
                    if (availableWeeks.length > 0) {
                      navigateToWeek(availableWeeks[0])
                    }
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  background: 'var(--success)',
                  color: 'white',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                title="Click to view other submitted weeks"
              >
                ✓ Submitted
              </div>
            )}
          </div>
          <button 
            onClick={showSubmitConfirmation}
            style={{
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Submit
          </button>
        </div>
      </div>
      <div style={{ marginTop: 0, padding: 16, display: 'grid', gap: 16, gridTemplateRows: 'auto auto auto', overflow: 'visible', width: '100%', minWidth: 0 }}>
        <DashboardCards summary={summary} todaysBookings={todaysBookings} projects={projects} recentJobs={recentJobs} />
        
        {/* Live Timer (hidden for now) */}
        {false && (
        <div style={{
          border: timerRunning ? '2px solid var(--success)' : '1px solid var(--border)',
          borderRadius: 12,
          padding: 16,
          background: timerRunning ? 'var(--success-light)' : 'var(--surface)',
          display: 'grid',
          gap: 12,
          boxShadow: timerRunning ? '0 4px 6px rgba(16, 185, 129, 0.1)' : '0 1px 2px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: timerRunning ? '#065f46' : '#374151' }}>
                ⏱️ Live Time Tracker
              </span>
              {timerRunning && (
                <div style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: 'var(--success)',
                  fontFamily: 'monospace',
                  letterSpacing: '0.05em'
                }}>
                  {formatTimerDuration(timerElapsed)}
                </div>
              )}
            </div>
            {!timerRunning ? (
              <button
                onClick={startTimer}
                disabled={!timerJobNumber}
                style={{
                  background: timerJobNumber ? 'var(--success)' : 'var(--text-tertiary)',
                  color: 'white',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: timerJobNumber ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s'
                }}
              >
                ▶ Start Timer
              </button>
            ) : (
              <button
                onClick={stopTimer}
                style={{
                  background: 'var(--error)',
                  color: 'white',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  animation: 'pulse 2s infinite'
                }}
              >
                ⏹ Stop Timer
              </button>
            )}
          </div>
          
          {!timerRunning && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <SearchableProjectDropdown
                value={timerJobNumber}
                onChange={setTimerJobNumber}
                projects={projects}
                placeholder="Search projects..."
              />
              <small style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                for {DAYS[activeDay]}
              </small>
            </div>
          )}
          
          {timerRunning && (
            <div style={{ fontSize: 13, color: 'var(--success-dark)' }}>
              Tracking: <strong>{timerJobNumber}</strong> • {DAYS[activeDay]}
            </div>
          )}
        </div>
        )}

        <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', width: '100%', minWidth: 0, overflowX: 'hidden', overflowY: 'visible' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0 }}>{DAYS[activeDay]}</h3>
              {selectedSegment && (
                <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                  Selected segment • Press Delete/Backspace to remove
                </small>
              )}
              {overtimeEnabled && !selectedSegment && (
                <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                  Double-click an entry to set type: Standard, Overtime, or Extra overtime
                </small>
              )}
            </div>
            <button onClick={() => addRow(activeDay)} style={{ background: 'var(--primary)', borderColor: 'var(--primary)' }}>Add job</button>
          </div>
          <div
            style={{
              display: 'grid',
              gap: 4,
              marginTop: 8,
              gridTemplateColumns: 'minmax(100px, 180px) 1fr auto auto',
              gridTemplateRows: `20px repeat(${rowsByDay[activeDay]?.length ?? 0}, 36px)`,
              alignItems: 'stretch',
              width: '100%',
              minWidth: 0
            }}
          >
            {/* Column 1: Job (fixed – always visible) */}
            <div style={{ gridColumn: 1, gridRow: 1 }} />
            {rowsByDay[activeDay]?.map((row: any, rowIdx: number) => (
              <div key={row.id} style={{ gridColumn: 1, gridRow: rowIdx + 2, display: 'flex', alignItems: 'stretch', minHeight: 0 }}>
                <SearchableProjectDropdown
                  value={row.jobNumber}
                  onChange={(num: string) => updateRow(activeDay, row.id, (r: any) => ({ ...r, jobNumber: num }))}
                  projects={projects}
                  placeholder="Search projects..."
                  style={{ fontSize: '12px', minHeight: 36, height: 36 }}
                  recentJobs={recentJobs}
                />
              </div>
            ))}
            {/* Column 2: Scrollable timeline only */}
            <div
              ref={timelineScrollRef}
              style={{
                gridColumn: 2,
                gridRow: '1 / -1',
                overflowX: 'auto',
                minWidth: 0
              }}
            >
              <div style={{ width: totalSlots * SLOT_WIDTH_PX, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <TimelineHeaderStrip ref={headerTimelineRef} totalSlots={totalSlots} />
                {rowsByDay[activeDay]?.map((row: any, rowIdx: number) => (
                  <RowTrack
                    key={row.id}
                    row={row}
                    dayIndex={activeDay}
                    totalSlots={totalSlots}
                    overlaps={overlaps}
                    onMouseDownCell={(slot: number, e: any) => onMouseDownCell(activeDay, row, slot, e)}
                    onMouseDownHandle={(slot: number, handle: 'left' | 'right') => onMouseDownHandle(activeDay, row, slot, handle)}
                    trackDomId={trackId(activeDay, row.id)}
                    trackRef={rowIdx === 0 ? firstRowTrackRef : undefined}
                    selectedSegment={selectedSegment}
                    setSelectedSegment={setSelectedSegment}
                    deleteSegment={deleteSegment}
                    entryTypePopup={entryTypePopup}
                    setEntryTypePopup={setEntryTypePopup}
                    setSegmentEntryType={setSegmentEntryType}
                    overtimeEnabled={overtimeEnabled}
                  />
                ))}
              </div>
            </div>
            {/* Column 3: Hours (fixed) */}
            <div style={{ gridColumn: 3, gridRow: 1 }} />
            {rowsByDay[activeDay]?.map((row: any, rowIdx: number) => (
              <div
                key={row.id}
                style={{
                  gridColumn: 3,
                  gridRow: rowIdx + 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end'
                }}
              >
                <div title={row.totalHours.toFixed(2)} style={{ fontVariantNumeric: 'tabular-nums', fontSize: '12px', minWidth: '35px', textAlign: 'right' }}>
                  {row.totalHours.toFixed(2)}
                </div>
              </div>
            ))}
            {/* Column 4: Delete (fixed) */}
            <div style={{ gridColumn: 4, gridRow: 1 }} />
            {rowsByDay[activeDay]?.map((row: any, rowIdx: number) => (
              <div
                key={row.id}
                style={{ gridColumn: 4, gridRow: rowIdx + 2, display: 'flex', alignItems: 'center' }}
              >
                <button
                  onClick={() => removeRow(activeDay, row.id)}
                  aria-label="Remove row"
                  title="Remove"
                  style={{
                    fontSize: '12px',
                    padding: '4px 6px',
                    minWidth: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          
          {/* Overtime is now tracked per job - see the O/T input box at the end of each row */}
        </section>

        {/* Per-day Notes – now shown directly under the timeline/job entry card */}
        <div style={{
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 16,
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginTop: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14 }}>Notes for {DAYS[activeDay]}</h3>
              <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                Add any comments or context for this day (e.g. exceptions, approvals, special cases).
              </small>
            </div>
          </div>
          <textarea
            value={dayNotes[activeDay] || ''}
            onChange={e => {
              const next = [...dayNotes]
              next[activeDay] = e.target.value
              setDayNotes(next)
              scheduleAutoSave()
            }}
            style={{
              width: '100%',
              minHeight: 80,
              resize: 'vertical',
              padding: 8,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-primary)',
              fontSize: 13,
              fontFamily: 'inherit',
              color: 'var(--text-primary)'
            }}
            placeholder="Add notes for this day…"
          />
        </div>

        <WeeklySummary summary={summary} />
      </div>
      
      <OverlapWarningDialog
        isOpen={showOverlapWarning}
        overlapDetails={overlapDetails}
        onDismiss={dismissOverlapWarning}
        onProceedAnyway={proceedDespiteOverlaps}
      />

      <EntryTypeDialog
        segment={entryTypePopup}
        onSelectType={(type) => {
          if (type === 'standard') {
            if (entryTypePopup)
              setSegmentEntryType(
                entryTypePopup.dayIndex,
                entryTypePopup.rowId,
                entryTypePopup.start,
                entryTypePopup.end,
                type
              )
            setEntryTypePopup(null)
          } else {
            setEntryTypeConfirm(type)
          }
        }}
        onDelete={() => {
          if (entryTypePopup) {
            deleteSegment(
              entryTypePopup.dayIndex,
              entryTypePopup.rowId,
              entryTypePopup.start,
              entryTypePopup.end
            )
            setEntryTypePopup(null)
            setEntryTypeConfirm(null)
          }
        }}
        onCancel={() => {
          setEntryTypePopup(null)
          setEntryTypeConfirm(null)
        }}
      />

      <ConfirmDialog
        isOpen={!!(entryTypePopup && entryTypeConfirm && (entryTypeConfirm === 'overtime' || entryTypeConfirm === 'extra-overtime'))}
        title="Confirm entry type"
        message={`Mark this time block as ${entryTypeConfirm === 'overtime' ? 'Overtime' : 'Extra overtime'}?`}
        confirmText="Confirm"
        cancelText="Cancel"
        type="warning"
        onConfirm={() => {
          if (entryTypePopup && entryTypeConfirm) {
            setSegmentEntryType(
              entryTypePopup.dayIndex,
              entryTypePopup.rowId,
              entryTypePopup.start,
              entryTypePopup.end,
              entryTypeConfirm
            )
            setEntryTypePopup(null)
            setEntryTypeConfirm(null)
          }
        }}
        onCancel={() => setEntryTypeConfirm(null)}
      />

      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="Submit Timesheet"
        message={
          <>
            Are you sure you want to submit this timesheet for the week commencing{' '}
            <strong>{weekStart.toLocaleDateString()}</strong>?
            <br />
            <br />
            <span style={{ fontWeight: 600 }}>Summary</span>
            <br />
            <span>Total Hours: <strong>{(summary?.totalHours ?? 0).toFixed(2)}</strong></span>
            <br />
            {summary?.overtimeEnabled && (
              <>
                <span>Standard Hours: <strong>{(summary?.standardHours ?? 0).toFixed(2)}</strong></span>
                <br />
                <span>Overtime Hours: <strong>{(summary?.overtimeHours ?? 0).toFixed(2)}</strong></span>
                <br />
              </>
            )}
            <span>Jobs: <strong>{summary?.byJob?.size ?? 0}</strong></span>
          </>
        }
        confirmText="Submit Timesheet"
        cancelText="Cancel"
        type="info"
        onConfirm={confirmSubmit}
        onCancel={cancelSubmit}
      />
    </div>
  )
}
