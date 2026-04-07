export interface Timesheet {
  id: string
  user_id: string
  userId?: string
  week_start_date: string
  weekStartDate?: string
  data: string | Record<string, unknown>
  summary?: {
    totalHours?: number
    total?: number
    [key: string]: unknown
  }
  totalHours?: number
  submitted_at?: string
  submissionDate?: string
  submission_date?: string
  created_at: string
}

export interface GlobalSettings {
  overtime_enabled: boolean
  weekend_overtime_enabled: boolean
  timesheets_enabled: boolean
  timezone: string
  country_code: string
  department_list: string[]
  job_role_list: string[]
  label_list: string[]
}
