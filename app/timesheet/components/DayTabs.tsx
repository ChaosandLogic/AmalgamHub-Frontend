'use client'

import { startOfWeek } from '../../lib/utils/dateUtils'
import { DAYS } from '../constants'
import { addDays } from '../timesheetUtils'

interface DayTabsProps {
  weekStart: Date
  activeDay: number
  onSelect: (dayIndex: number) => void
}

export default function DayTabs({ weekStart, activeDay, onSelect }: DayTabsProps) {
  const abbr = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {DAYS.map((name, i) => {
        const isActive = i === activeDay
        const dt = addDays(startOfWeek(weekStart), i)
        const dayNum = dt.getDate()
        return (
          <button
            key={name}
            onClick={() => onSelect(i)}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: isActive ? '1px solid var(--primary)' : '1px solid var(--border)',
              background: isActive ? 'var(--primary)' : 'var(--surface)',
              color: isActive ? 'white' : 'var(--text)',
              fontSize: '12px',
              fontWeight: isActive ? '600' : '500',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              minWidth: '100px',
            }}
          >
            <div style={{ fontSize: '11px', opacity: 0.8 }}>{abbr[i]}</div>
            <div style={{ fontSize: '13px', fontWeight: '600' }}>{dayNum}</div>
          </button>
        )
      })}
    </div>
  )
}
