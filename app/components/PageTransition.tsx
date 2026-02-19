'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import styles from './PageTransition.module.css'

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [displayChildren, setDisplayChildren] = useState(children)
  const [transitionStage, setTransitionStage] = useState('fadeIn')

  useEffect(() => {
    setTransitionStage('fadeOut')
  }, [pathname])

  useEffect(() => {
    if (transitionStage === 'fadeOut') {
      const timer = setTimeout(() => {
        setDisplayChildren(children)
        setTransitionStage('fadeIn')
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [transitionStage, children])

  return (
    <div className={`${styles.container} ${transitionStage === 'fadeIn' ? styles.fadeIn : styles.fadeOut}`}>
      {displayChildren}
    </div>
  )
}

