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
          height: 20,
          display: 'grid',
          gridTemplateColumns: `repeat(${totalSlots}, 1fr)`,
          minWidth: totalSlots * SLOT_WIDTH_PX,
          width: totalSlots * SLOT_WIDTH_PX,
          position: 'relative',
          boxSizing: 'border-box',
          border: '1px solid transparent',
          borderRadius: 8,
        }}
      >
        {Array.from({ length: totalSlots }, (_, slotIndex) => {
          if (slotIndex % 4 === 0) {
            const hour24 = slotIndex / 4
            const disp = hour24 % 12 || 12
            const mer = hour24 >= 12 ? 'PM' : 'AM'
            return (
              <div
                key={slotIndex}
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                  paddingLeft: '2px',
                  alignSelf: 'start',
                  position: 'relative',
                }}
              >
                {disp}
                {mer}
              </div>
            )
          }
          return (
            <div
              key={slotIndex}
              style={{
                borderLeft: '1px dashed var(--border)',
                alignSelf: 'end',
                height: 6,
              }}
            />
          )
        })}
      </div>
    )
  }
)

export default TimelineHeaderStrip
