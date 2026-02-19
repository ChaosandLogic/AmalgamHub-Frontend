'use client'

import { useEffect, useState } from 'react'
import { startOfWeek } from '../../lib/utils/dateUtils'
import { getLocalDateString } from '../../lib/utils/dateUtils'
import { todayIndexForWeek } from '../timesheetUtils'

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
        const res = await fetch('/api/timesheets', { credentials: 'include' })
        if (res.ok) {
          const response = await res.json()
          const data = response.data || response
          const timesheetsByWeek: { [week: string]: any } = {}
          data.timesheets?.forEach((ts: any) => {
            const raw = ts.week_start_date ?? ts.weekStartDate ?? ''
            const weekKey =
              typeof raw === 'string' && raw.length >= 10
                ? raw.slice(0, 10)
                : getLocalDateString(new Date(raw || 0))
            timesheetsByWeek[weekKey] = ts
          })
          setSubmittedTimesheets(timesheetsByWeek)
        }
      } catch (error) {
        console.error('Failed to load submitted timesheets:', error)
      } finally {
        setSubmittedTimesheetsLoaded(true)
      }
    }
    loadData()
  }, [])

  // Load user, global settings, and projects on mount
  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch('/api/user', { credentials: 'include' })
        if (r.ok) {
          const response = await r.json()
          const user = response.data?.user || response.user
          if (user?.id) setCurrentUserId(user.id)
          if (user?.resourceId) setUserResourceId(user.resourceId)
          if (user?.timelineStartHour != null)
            setTimelineStartHour(user.timelineStartHour)
          if (user?.timelineDuration != null)
            setTimelineDuration(user.timelineDuration)
        }

        const s = await fetch('/api/global-settings', { credentials: 'include' })
        if (s.ok) {
          const settingsResponse = await s.json()
          const settings =
            settingsResponse.data?.settings || settingsResponse.settings
          if (settings?.overtime_enabled !== undefined) {
            setOvertimeEnabled(!!settings.overtime_enabled)
          }
          if (settings?.weekend_overtime_enabled !== undefined) {
            setWeekendOvertimeEnabled(!!settings.weekend_overtime_enabled)
          }
        } else {
          console.error('Failed to load global settings, using defaults')
          setOvertimeEnabled(false)
          setWeekendOvertimeEnabled(false)
        }

        const p = await fetch('/api/projects', { credentials: 'include' })
        if (p.ok) {
          const projectsResponse = await p.json()
          const projectsData = projectsResponse.data || projectsResponse
          if (projectsData?.projects && Array.isArray(projectsData.projects)) {
            setProjects(projectsData.projects)
          } else if (Array.isArray(projectsData)) {
            setProjects(projectsData)
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error)
        setOvertimeEnabled(false)
        setWeekendOvertimeEnabled(false)
      } finally {
        setSettingsLoaded(true)
      }
    })()
  }, [])

  // Load today's bookings when userResourceId is set
  useEffect(() => {
    if (!userResourceId) return

    const loadTodaysBookings = async () => {
      try {
        const today = new Date()
        const todayStr = getLocalDateString(today)
        const response = await fetch(
          `/api/bookings?resourceId=${userResourceId}&startDate=${todayStr}&endDate=${todayStr}`,
          { credentials: 'include' }
        )
        if (response.ok) {
          const responseData = await response.json()
          const data = responseData.data || responseData
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
        }
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
