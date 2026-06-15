/**
 * Match backend payroll-dept-prefix: prefix = text before first digit; purely numeric → no prefix.
 */

export function splitJobCode(fullCode: string): { jobPrefix: string; jobNumber: string } {
  const code = String(fullCode ?? '').trim()
  if (!code) return { jobPrefix: '', jobNumber: '' }
  const m = /\d/.exec(code)
  const i = m ? m.index : -1
  if (i === -1) {
    return { jobPrefix: code, jobNumber: '' }
  }
  if (i === 0) {
    return { jobPrefix: '', jobNumber: code }
  }
  return {
    jobPrefix: code.slice(0, i).trim(),
    jobNumber: code.slice(i).trim(),
  }
}

export function fullJobCode(row: {
  jobPrefix?: string
  jobNumber?: string
}): string {
  return `${row.jobPrefix ?? ''}${row.jobNumber ?? ''}`.trim()
}
