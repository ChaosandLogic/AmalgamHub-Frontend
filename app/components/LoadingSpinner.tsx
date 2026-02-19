import styles from './LoadingSpinner.module.css'

export default function LoadingSpinner({ 
  size = 24, 
  color = 'var(--accent-primary)' 
}: { 
  size?: number
  color?: string 
}) {
  return (
    <div
      className={styles.spinner}
      style={{
        width: size,
        height: size,
        border: `3px solid ${color}20`,
        borderTop: `3px solid ${color}`
      }}
    />
  )
}
