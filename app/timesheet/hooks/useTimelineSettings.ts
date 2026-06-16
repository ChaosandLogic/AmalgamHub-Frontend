'use client'

import { useEffect, useState } from 'react'
import { useUser } from '../../lib/hooks/useUser'
import { startOfWeek, parseLocalDateString } from '../../lib/utils/dateUtils'
import { getLocalDateString, weekStartKeyFromApi } from '../../lib/utils/dateUtils'
import { todayIndexForWeek } from '../lib/timesheetUtils'
import { apiGet, apiPost } from '../../lib/api/client'

export interface UseTimelineSettingsOptions {
  editUserId?: string | null
  initialWeek?: string | null
}

export function useTimelineSettings(options?: UseTimelineSettingsOptions) {
  const editUserId = options?.editUserId ?? null
  const initialWeek = options?.initialWeek ?? null

  const [weekStart, setWeekStart] = useState(() => {
    if (initialWeek) {
      return startOfWeek(parseLocalDateString(initialWeek))
    }
    return startOfWeek(new Date())
  })
  const [timelineStartHour, setTimelineStartHour] = useState(7)
  const [timelineDuration, setTimelineDuration] = useState(14)
  const [activeDay, setActiveDay] = useState(() =>
    todayIndexForWeek(startOfWeek(new Date()))
  )
  const [overtimeEnabled, setOvertimeEnabled] = useState(false)
  const [weekendOvertimeEnabled, setWeekendOvertimeEnabled] = useState(false)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userResourceId, setUserResourceId] = useState<string | null>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [todaysBookings, setTodaysBookings] = useState<any[]>([])
  const [submittedTimesheets, setSubmittedTimesheets] = useState<{
    [week: string]: any
  }>({})
  const [submittedTimesheetsLoaded, setSubmittedTimesheetsLoaded] =
    useState(false)

  useEffect(() => {
    if (initialWeek) {
      setWeekStart(startOfWeek(parseLocalDateString(initialWeek)))
    }
  }, [initialWeek])

  // Load submitted timesheets for self or edit target
  useEffect(() => {
    const loadData = async () => {
      setSubmittedTimesheetsLoaded(false)
      try {
        const url = editUserId
          ? `/api/timesheets?userId=${encodeURIComponent(editUserId)}`
          : '/api/timesheets'
        const data = await apiGet<{ timesheets: any[] }>(url)
        const timesheetsByWeek: { [week: string]: any } = {}
        data.timesheets?.forEach((ts: any) => {
          const raw = ts.week_start_date ?? ts.weekStartDate ?? ''
          const weekKey = weekStartKeyFromApi(raw)
          if (weekKey) timesheetsByWeek[weekKey] = ts
        })
        setSubmittedTimesheets(timesheetsByWeek)
      } catch (error) {
        console.error('Failed to load submitted timesheets:', error)
      } finally {
        setSubmittedTimesheetsLoaded(true)
      }
    }
    loadData()
  }, [editUserId])

  const { user } = useUser()

  // Target user prefs when editing on behalf
  useEffect(() => {
    if (!editUserId) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiGet<{ user: any }>(`/api/users/${encodeURIComponent(editUserId)}`)
        if (cancelled) return
        const u = data.user
        if (u?.resourceId) setUserResourceId(u.resourceId)
        if (u?.timelineStartHour != null) setTimelineStartHour(u.timelineStartHour)
        if (u?.timelineDuration != null) setTimelineDuration(u.timelineDuration)
      } catch (error) {
        console.error('Failed to load target user for timesheet edit:', error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editUserId])

  // When user is set, sync user-derived state then load global settings and projects
  useEffect(() => {
    if (editUserId) return
    if (!user) return
    setCurrentUserId(user.id)
    const u = user as { resourceId?: string; timelineStartHour?: number; timelineDuration?: number }
    if (u.resourceId) setUserResourceId(u.resourceId)
    if (u.timelineStartHour != null) setTimelineStartHour(u.timelineStartHour)
    if (u.timelineDuration != null) setTimelineDuration(u.timelineDuration)
  }, [user, editUserId])

  // Global settings and projects (same for self and edit-on-behalf)
  useEffect(() => {
    if (editUserId && !user) return
    if (!editUserId && !user) return
    let cancelled = false
    ;(async () => {
      try {
        const settingsData = await apiGet<{ settings: any }>('/api/global-settings')
        if (cancelled) return
        const settings = settingsData.settings
        if (settings?.overtime_enabled !== undefined) setOvertimeEnabled(!!settings.overtime_enabled)
        if (settings?.weekend_overtime_enabled !== undefined) {
          setWeekendOvertimeEnabled(!!settings.weekend_overtime_enabled)
        }
      } catch {
        if (!cancelled) {
          setOvertimeEnabled(false)
          setWeekendOvertimeEnabled(false)
        }
      }
      try {
        const projectsData = await apiGet<{ projects: any[] }>('/api/projects')
        if (!cancelled) setProjects(projectsData.projects || [])
      } catch (error) {
        console.error('Error loading projects:', error)
      } finally {
        if (!cancelled) setSettingsLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, editUserId])

  // Periodically refresh the JWT so active sessions don't silently expire (every 4 hours)
  useEffect(() => {
    if (!user) return
    const REFRESH_INTERVAL = 4 * 60 * 60 * 1000
    const interval = setInterval(() => {
      apiPost('/api/refresh').catch(() => {})
    }, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [user])

  // Load today's bookings when userResourceId is set
  useEffect(() => {
    if (!userResourceId) return

    const loadTodaysBookings = async () => {
      try {
        const today = new Date()
        const todayStr = getLocalDateString(today)
        const data = await apiGet<{ bookings: any[] }>(
          `/api/bookings?resourceId=${userResourceId}&startDate=${todayStr}&endDate=${todayStr}`
        )
        const bookings = (data.bookings || []).filter((booking: any) => {
          const title = booking.title?.toLowerCase() || ''
          return (
            !title.includes('holiday') &&
            !title.includes('sick') &&
            !title.includes('public holiday') &&
            !title.includes('non work') &&
            !title.includes('non-work')
          )
        })
        setTodaysBookings(bookings)
      } catch (error) {
        console.error("Error loading today's bookings:", error)
      }
    }

    loadTodaysBookings()
    const interval = setInterval(loadTodaysBookings, 60000)
    return () => clearInterval(interval)
  }, [userResourceId])

  return {
    weekStart,
    setWeekStart,
    activeDay,
    setActiveDay,
    timelineStartHour,
    setTimelineStartHour,
    timelineDuration,
    setTimelineDuration,
    overtimeEnabled,
    setOvertimeEnabled,
    weekendOvertimeEnabled,
    setWeekendOvertimeEnabled,
    settingsLoaded,
    currentUserId,
    setCurrentUserId,
    userResourceId,
    setUserResourceId,
    projects,
    setProjects,
    todaysBookings,
    setTodaysBookings,
    submittedTimesheets,
    setSubmittedTimesheets,
    submittedTimesheetsLoaded,
    setSubmittedTimesheetsLoaded,
    editUserId,
  }
}
