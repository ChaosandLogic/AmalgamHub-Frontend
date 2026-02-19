'use client'

import { useEffect } from 'react'

export default function DarkModeInit() {
  useEffect(() => {
    // Sync dark mode state (already set by blocking script in layout.tsx)
    // This ensures the state is correct if localStorage changes
    const savedDarkMode = localStorage.getItem('darkMode')
    const isDark = savedDarkMode === 'enabled'
    
    // Only update if there's a mismatch (shouldn't happen, but safety check)
    const htmlHasDark = document.documentElement.classList.contains('dark-mode')
    const bodyHasDark = document.body.classList.contains('dark-mode')
    
    if (isDark && (!htmlHasDark || !bodyHasDark)) {
      document.documentElement.classList.add('dark-mode')
      document.body.classList.add('dark-mode')
    } else if (!isDark && (htmlHasDark || bodyHasDark)) {
      document.documentElement.classList.remove('dark-mode')
      document.body.classList.remove('dark-mode')
    }
  }, [])

  return null
}




