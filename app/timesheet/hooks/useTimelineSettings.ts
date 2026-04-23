'use client'

import { useEffect, useState } from 'react'
import { useUser } from '../../lib/hooks/useUser'
import { startOfWeek } from '../../lib/utils/dateUtils'
import { getLocalDateString, weekStartKeyFromApi } from '../../lib/utils/dateUtils'
import { todayIndexForWeek } from '../lib/timesheetUtils'
import { apiGet, apiPost } from '../../lib/api/client'

export function useTimelineSettings() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
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

  // Load submitted timesheets list on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await apiGet<{ timesheets: any[] }>('/api/timesheets')
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
  }, [])

  const { user } = useUser()

  // When user is set, sync user-derived state then load global settings and projects
  useEffect(() => {
    if (!user) return
    setCurrentUserId(user.id)
    const u = user as { resourceId?: string; timelineStartHour?: number; timelineDuration?: number }
    if (u.resourceId) setUserResourceId(u.resourceId)
    if (u.timelineStartHour != null) setTimelineStartHour(u.timelineStartHour)
    if (u.timelineDuration != null) setTimelineDuration(u.timelineDuration)

    ;(async () => {
      try {
        const settingsData = await apiGet<{ settings: any }>('/api/global-settings')
        const settings = settingsData.settings
        if (settings?.overtime_enabled !== undefined) setOvertimeEnabled(!!settings.overtime_enabled)
        if (settings?.weekend_overtime_enabled !== undefined) setWeekendOvertimeEnabled(!!settings.weekend_overtime_enabled)
      } catch {
        setOvertimeEnabled(false)
        setWeekendOvertimeEnabled(false)
      }
      try {
        const projectsData = await apiGet<{ projects: any[] }>('/api/projects')
        setProjects(projectsData.projects || [])
      } catch (error) {
        console.error('Error loading projects:', error)
      } finally {
        setSettingsLoaded(true)
      }
    })()
  }, [user])

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
  }
}
