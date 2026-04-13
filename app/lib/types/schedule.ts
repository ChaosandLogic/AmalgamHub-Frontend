/**
 * Type definitions for schedule-related components
 */

export interface Resource {
  id: string
  name: string
  type: string
  color?: string
  department?: string
  job_role?: string
}

export interface Project {
  id: string
  name: string
  /** Job / project code; API may send a number (e.g. FileMaker). */
  code?: string | number
  color?: string
  project_manager?: string
  account_manager?: string
  /** Company / client label (snake_case from API or camelCase in forms). */
  client_name?: string
  clientName?: string
}

export interface Booking {
  id: string
  resource_id: string
  project_id?: string
  title: string
  description?: string
  start_date: string
  end_date: string
  start_time?: string
  end_time?: string
  hours?: number
  allocation_percentage?: number
  color?: string
  priority?: string
  project_manager_id?: string
  tentative?: boolean | number
}

export interface ResourceScheduleProps {
  monthStart: Date
  resources: Resource[]
  projects: Project[]
  /** If provided, used for role checks; otherwise component fetches current user itself. */
  currentUser?: { role: string } | null
  colorMode?: 'priority' | 'pm'
}

