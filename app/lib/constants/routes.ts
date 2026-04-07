/**
 * Application route constants.
 * Centralized so any route change is made in one place.
 */

export const ROUTES = {
  DASHBOARD: '/schedule',
  SCHEDULE: '/schedule',
  TIMESHEET: '/timesheet',
  TASKS: '/tasks',
  RESOURCES: '/resources',
  PROJECTS: '/projects',
  CHAT: '/chat',
  SETTINGS: '/settings',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  ADMIN: '/admin',
  REPORTS: '/reports',
  HISTORY: '/history',
  VIEW: '/view',
  VIEW_CURRENT: '/view-current',
  GANTT: '/gantt',
} as const

export const DEFAULT_DASHBOARD_ROUTE = ROUTES.DASHBOARD
