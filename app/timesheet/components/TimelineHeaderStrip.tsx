'use client'

import { forwardRef } from 'react'
import { SLOT_WIDTH_PX } from '../lib/constants'

export interface TimelineHeaderStripProps {
  totalSlots: number
}

const TimelineHeaderStrip = forwardRef<HTMLDivElement, TimelineHeaderStripProps>(
  function TimelineHeaderStrip({ totalSlots }, ref) {
    return (
      <div
        ref={ref}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${totalSlots}, 1fr)`,
          minWidth: totalSlots * SLOT_WIDTH_PX,
          width: totalSlots * SLOT_WIDTH_PX,
          height: '100%',
          minHeight: 0,
          position: 'relative',
          boxSizing: 'border-box',
          border: '1px solid transparent',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {Array.from({ length: totalSlots }, (_, slotIndex) => {
          const isHour = slotIndex % 4 === 0
          if (!isHour) {
            return <div key={slotIndex} style={{ minWidth: 0 }} />
          }
          const hour24 = slotIndex / 4
          const disp = hour24 % 12 || 12
          const mer = hour24 >= 12 ? 'PM' : 'AM'
          return (
            <div
              key={slotIndex}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                minWidth: 0,
                overflow: 'visible',
              }}
            >
              <span
                style={{
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2,
                  paddingLeft: 2,
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                }}
              >
                {disp}
                {mer}
              </span>
              <div
                style={{
                  width: 0,
                  height: 5,
                  marginTop: 1,
                  borderLeft: '1px solid var(--border-strong)',
                  flexShrink: 0,
                }}
              />
            </div>
          )
        })}
      </div>
    )
  }
)

export default TimelineHeaderStrip
