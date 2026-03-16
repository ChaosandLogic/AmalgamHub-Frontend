'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { GanttChart } from 'lucide-react'
import Notifications from './Notifications'
import { useUser } from '../lib/hooks/useUser'
import { apiPost } from '../lib/api/client'
import styles from './Header.module.css'

export default function Header() {
  const { user, loading } = useUser()
  const router = useRouter()
  const pathname = usePathname()

  async function handleLogout() {
    try {
      await apiPost('/api/logout')
    } catch {}
    if (user?.id) {
      try {
        localStorage.removeItem(`timesheet_autosave_${user.id}`)
      } catch {}
    }
    router.push('/login')
  }

  const LogoIcon = () => (
    <div className={styles.logoIcon}>
      <GanttChart size={28} strokeWidth={2.5} className={styles.logoIconInner} />
      {/* Overlay small resource/people icon */}
      <div className={styles.logoBadge}>
        <div className={styles.logoBadgeDot} />
      </div>
    </div>
  )

  const isActive = (href: string) => {
    if (!pathname) return false
    if (href === '/') {
      return pathname === '/'
    }
    // For exact matches or paths that start with the href followed by / or end of string
    return pathname === href || pathname.startsWith(href + '/')
  }


  if (loading) {
    return (
      <div className={styles.header}>
        <div className={styles.leftSection}>
          <Link href="/schedule" className={styles.logo}>
            <LogoIcon />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.header}>
      <div className={styles.leftSection}>
<Link href="/schedule" className={styles.logo}>
            <LogoIcon />
          </Link>
        {user && (
          <nav className={styles.nav}>
            <Link 
              href="/timesheet" 
              className={`${styles.navLink} ${isActive('/timesheet') ? styles.navLinkActive : ''}`}
            >
              Timesheet
            </Link>
            <Link 
              href="/schedule" 
              className={`${styles.navLink} ${isActive('/schedule') ? styles.navLinkActive : ''}`}
            >
              Schedule
            </Link>
            <Link 
              href="/tasks" 
              className={`${styles.navLink} ${isActive('/tasks') ? styles.navLinkActive : ''}`}
            >
              Tasks
            </Link>
            {(user.role === 'admin' || user.role === 'booker') && (
              <>
                <Link 
                  href="/gantt" 
                  className={`${styles.navLink} ${isActive('/gantt') ? styles.navLinkActive : ''}`}
                >
                  Gantt
                </Link>
                <Link 
                  href="/resources" 
                  className={`${styles.navLink} ${isActive('/resources') ? styles.navLinkActive : ''}`}
                >
                  Resources
                </Link>
                <Link 
                  href="/projects" 
                  className={`${styles.navLink} ${isActive('/projects') ? styles.navLinkActive : ''}`}
                >
                  Projects
                </Link>
              </>
            )}
            <Link 
              href="/chat" 
              className={`${styles.navLink} ${isActive('/chat') ? styles.navLinkActive : ''}`}
            >
              Chat
            </Link>
            {process.env.NEXT_PUBLIC_WIKI_URL && (
              <>
              <a 
                href={process.env.NEXT_PUBLIC_WIKI_URL} 
                target="_blank" 
                rel="noopener noreferrer" 
                className={styles.navLink}
              >
                Wiki
              </a>
              <span className={styles.navDivider} aria-hidden />
              </>
            )}
            <Link 
              href="/settings" 
              className={`${styles.navLink} ${isActive('/settings') ? styles.navLinkActive : ''}`}
            >
              Settings
            </Link>
            {user?.role === 'admin' && (
              <Link 
                href="/admin" 
                className={`${styles.navLink} ${isActive('/admin') ? styles.navLinkActive : ''}`}
              >
                Users
              </Link>
            )}
          </nav>
        )}
      </div>
      <div className={styles.rightSection}>
        {user && (
          <>
            <Notifications />
            <span className={styles.welcomeText}>
              Welcome, <strong className={styles.welcomeName}>{user.name}</strong>
            </span>
          </>
        )}
        <button 
          onClick={handleLogout} 
          className={styles.logoutButton}
          aria-label="Log out"
        >
          Logout
        </button>
      </div>
    </div>
  )
}


