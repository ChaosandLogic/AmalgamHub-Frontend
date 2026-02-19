/**
 * Application route constants
 * Centralized location for all route paths to enable easy updates
 */

export const DEFAULT_DASHBOARD_ROUTE = '/schedule'

export const ROUTES = {
  DASHBOARD: DEFAULT_DASHBOARD_ROUTE,
  TIMESHEET: '/timesheet',
  SCHEDULE: '/schedule',
  TASKS: '/tasks',
  RESOURCES: '/resources',
  PROJECTS: '/projects',
  CHAT: '/chat',
  SETTINGS: '/settings',
  LOGIN: '/login',
  REGISTER: '/register',
  ADMIN: '/admin',
  REPORTS: '/reports',
} as const


