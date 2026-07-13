'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useUser } from '../lib/hooks/useUser'
import { apiGet } from '../lib/api/client'
import { getLocalDateString } from '../lib/utils/dateUtils'
import type { GlobalSettings } from '../lib/types/timesheet'
import {
  dismissReminderForToday,
  isPastReminderTrigger,
  isReminderDismissedToday,
  shouldShowTimesheetReminder,
  type ReminderStatusResponse,
} from '../timesheet/lib/timesheetReminderUtils'
import TimesheetReminderDialog from './TimesheetReminderDialog'

const AUTH_EXEMPT_PREFIXES = ['/login', '/register', '/forgot-password', '/reset-password']

export default function TimesheetReminderGate() {
  const { user, loading } = useUser()
  const pathname = usePathname()
  const router = useRouter()
  const [settings, setSettings] = useState<GlobalSettings | null>(null)
  const [reminderStatus, setReminderStatus] = useState<ReminderStatusResponse | null>(null)
  const [checked, setChecked] = useState(false)
  const [visible, setVisible] = useState(false)

  const todayKey = useMemo(() => getLocalDateString(new Date()), [])

  const isAuthPage = AUTH_EXEMPT_PREFIXES.some((p) => pathname?.startsWith(p))

  useEffect(() => {
    if (loading || !user?.id || isAuthPage) {
      setChecked(true)
      setVisible(false)
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const [settingsRes, statusRes] = await Promise.all([
          apiGet<{ settings: GlobalSettings }>('/api/global-settings'),
          apiGet<ReminderStatusResponse>('/api/timesheets/reminder-status'),
        ])
        if (cancelled) return

        const globalSettings = settingsRes.settings
        setSettings(globalSettings)
        setReminderStatus(statusRes)

        const dismissed = isReminderDismissedToday(user.id, todayKey)
        const pastTrigger = isPastReminderTrigger(new Date(), {
          timezone: globalSettings.timezone,
          timesheet_reminder_weekday_time: globalSettings.timesheet_reminder_weekday_time,
          timesheet_reminder_monday_time: globalSettings.timesheet_reminder_monday_time,
        })

        const show = shouldShowTimesheetReminder({
          timesheetsEnabled: globalSettings.timesheets_enabled !== false,
          reminderEnabled: !!globalSettings.timesheet_reminder_enabled,
          dismissedToday: dismissed,
          pastTrigger,
          status: statusRes,
        })

        setVisible(show)
      } catch {
        if (!cancelled) setVisible(false)
      } finally {
        if (!cancelled) setChecked(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [loading, user?.id, isAuthPage, todayKey])

  function handleDismiss() {
    if (user?.id) {
      dismissReminderForToday(user.id, todayKey)
    }
    setVisible(false)
  }

  function handleGoToTimesheet() {
    handleDismiss()
    router.push('/timesheet')
  }

  if (!checked) return null

  return (
    <TimesheetReminderDialog
      isOpen={visible}
      onDismiss={handleDismiss}
      onGoToTimesheet={handleGoToTimesheet}
    />
  )
}
