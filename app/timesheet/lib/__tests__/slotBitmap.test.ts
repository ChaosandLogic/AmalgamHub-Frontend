import { describe, expect, it } from 'vitest'
import { FULL_DAY_SLOTS, LEGACY_SLOTS } from '../constants'
import { base64ToSlots, slotsToBase64 } from '../slotBitmap'

describe('slotsToBase64 / base64ToSlots', () => {
  it('round-trips a mixed boolean array', () => {
    const slots = Array.from({ length: 96 }, (_, i) => i % 3 === 0)
    const b64 = slotsToBase64(slots, FULL_DAY_SLOTS)
    expect(base64ToSlots(b64, FULL_DAY_SLOTS)).toEqual(slots)
  })

  it('returns all-false for all-false input', () => {
    const slots = Array(FULL_DAY_SLOTS).fill(false)
    const b64 = slotsToBase64(slots, FULL_DAY_SLOTS)
    expect(base64ToSlots(b64, FULL_DAY_SLOTS)).toEqual(slots)
  })

  it('round-trips all-true input', () => {
    const slots = Array(FULL_DAY_SLOTS).fill(true)
    const b64 = slotsToBase64(slots, FULL_DAY_SLOTS)
    expect(base64ToSlots(b64, FULL_DAY_SLOTS)).toEqual(slots)
  })

  it('encodes a single slot at start, middle, and end', () => {
    for (const idx of [0, 47, FULL_DAY_SLOTS - 1]) {
      const slots = Array(FULL_DAY_SLOTS).fill(false)
      slots[idx] = true
      const b64 = slotsToBase64(slots, FULL_DAY_SLOTS)
      const decoded = base64ToSlots(b64, FULL_DAY_SLOTS)
      expect(decoded[idx]).toBe(true)
      expect(decoded.filter(Boolean).length).toBe(1)
    }
  })

  it('returns all-false for invalid or missing base64', () => {
    expect(base64ToSlots(undefined, FULL_DAY_SLOTS)).toEqual(Array(FULL_DAY_SLOTS).fill(false))
    expect(base64ToSlots(null, FULL_DAY_SLOTS)).toEqual(Array(FULL_DAY_SLOTS).fill(false))
    expect(base64ToSlots('', FULL_DAY_SLOTS)).toEqual(Array(FULL_DAY_SLOTS).fill(false))
    expect(base64ToSlots('not-valid-base64!!!', FULL_DAY_SLOTS)).toEqual(
      Array(FULL_DAY_SLOTS).fill(false)
    )
  })

  it('pads with false when slots array is shorter than totalSlots', () => {
    const slots = [true, false, true]
    const b64 = slotsToBase64(slots, 10)
    const decoded = base64ToSlots(b64, 10)
    expect(decoded.slice(0, 3)).toEqual([true, false, true])
    expect(decoded.slice(3)).toEqual(Array(7).fill(false))
  })

  it('supports legacy 53-slot encoding', () => {
    const slots = Array(LEGACY_SLOTS).fill(false)
    slots[0] = true
    slots[52] = true
    const b64 = slotsToBase64(slots, LEGACY_SLOTS)
    const decoded = base64ToSlots(b64, LEGACY_SLOTS)
    expect(decoded[0]).toBe(true)
    expect(decoded[52]).toBe(true)
    expect(decoded.filter(Boolean).length).toBe(2)
  })

  it('supports full-day 96-slot encoding', () => {
    const slots = Array(FULL_DAY_SLOTS).fill(false)
    slots[28] = true
    slots[95] = true
    const b64 = slotsToBase64(slots, FULL_DAY_SLOTS)
    const decoded = base64ToSlots(b64, FULL_DAY_SLOTS)
    expect(decoded[28]).toBe(true)
    expect(decoded[95]).toBe(true)
  })
})
