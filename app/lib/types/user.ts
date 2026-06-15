/**
 * Current user shape returned by GET /api/user. Used by useUser and components that need role/id.
 */

export type UserRole = 'user' | 'admin' | 'booker'

export interface CurrentUser {
  id: string
  name: string
  email: string
  role: UserRole | string
  /** Email listed in backend PAYROLL_ACCOUNTS / PAYROLL_ACCOUNT / Payroll_Account */
  payrollAccess?: boolean
  /** DB admin or payroll env email */
  effectiveAdmin?: boolean
  /** Admin, booker, or payroll env email (schedule / Gantt / resources tier) */
  bookerOrAdminAccess?: boolean
  created_at?: string
  createdAt?: string
}
