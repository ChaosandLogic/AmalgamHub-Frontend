/**
 * Slot bitmap encoding for timesheet rows.
 * 53 slots per day (timelineDuration * 4 - 3 with default 14) = 7 bytes.
 * LSB first: bit 0 = slot 0, bit 1 = slot 1, etc.
 */

export const SLOTS_PER_DAY_DEFAULT = 53

/**
 * Pack boolean slots into bytes (LSB first) and return Base64 string.
 * If slots.length < totalSlots, pad with false.
 */
export function slotsToBase64(slots: boolean[], totalSlots: number = SLOTS_PER_DAY_DEFAULT): string {
  const len = Math.min(slots.length, totalSlots)
  const byteCount = Math.ceil(totalSlots / 8)
  const bytes = new Uint8Array(byteCount)
  for (let i = 0; i < totalSlots; i++) {
    if (i < len && slots[i]) {
      const byteIndex = Math.floor(i / 8)
      const bitIndex = i % 8
      bytes[byteIndex] |= 1 << bitIndex
    }
  }
  const binary = String.fromCharCode(...bytes)
  return typeof btoa !== 'undefined'
    ? btoa(binary)
    : Buffer.from(bytes).toString('base64')
}

/**
 * Decode Base64 string to boolean array of length totalSlots.
 * If b64 is missing/invalid, returns array of false.
 */
export function base64ToSlots(b64: string | undefined | null, totalSlots: number = SLOTS_PER_DAY_DEFAULT): boolean[] {
  const out = Array(totalSlots).fill(false)
  if (!b64 || typeof b64 !== 'string') return out
  try {
    const binary = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary')
    for (let i = 0; i < totalSlots && i < binary.length * 8; i++) {
      const byteIndex = Math.floor(i / 8)
      const bitIndex = i % 8
      if (byteIndex < binary.length && (binary.charCodeAt(byteIndex) & (1 << bitIndex))) {
        out[i] = true
      }
    }
  } catch {
    // invalid base64
  }
  return out
}
