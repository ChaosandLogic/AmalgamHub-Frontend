/**
 * Resource utility functions
 */
import React from 'react'
import { User, Users, Car, Wrench, Building2, Package } from 'lucide-react'

export function getResourceIcon(type: string, size: number = 16): React.ReactElement {
  const iconProps = { size, strokeWidth: 2 }
  
  switch (type.toLowerCase()) {
    case 'person':
      return <User {...iconProps} />
    case 'team':
      return <Users {...iconProps} />
    case 'vehicle':
      return <Car {...iconProps} />
    case 'equipment':
      return <Wrench {...iconProps} />
    case 'room':
      return <Building2 {...iconProps} />
    default:
      return <Package {...iconProps} />
  }
}

/**
 * Get default background color for a resource type
 * Returns hex color value for use in color inputs and direct styling
 */
export function getResourceDefaultColor(type: string, useCssVar: boolean = false): string {
  // Detect dark mode
  const isDarkMode = typeof window !== 'undefined' && (
    document.documentElement.classList.contains('dark-mode') ||
    document.body.classList.contains('dark-mode') ||
    localStorage.getItem('darkMode') === 'enabled'
  )
  
  // Light mode colors
  const lightColors: { [key: string]: { hex: string; cssVar: string } } = {
    person: { hex: '#1e40af', cssVar: 'var(--resource-person)' },
    team: { hex: '#0284c7', cssVar: 'var(--resource-team)' },
    vehicle: { hex: '#d97706', cssVar: 'var(--resource-vehicle)' },
    equipment: { hex: '#059669', cssVar: 'var(--resource-equipment)' },
    room: { hex: '#7c3aed', cssVar: 'var(--resource-room)' }
  }
  
  // Dark mode colors (softer, muted)
  const darkColors: { [key: string]: { hex: string; cssVar: string } } = {
    person: { hex: '#5a6d7f', cssVar: 'var(--resource-person)' },
    team: { hex: '#657a8a', cssVar: 'var(--resource-team)' },
    vehicle: { hex: '#8f7a5d', cssVar: 'var(--resource-vehicle)' },
    equipment: { hex: '#4d6558', cssVar: 'var(--resource-equipment)' },
    room: { hex: '#7d6a88', cssVar: 'var(--resource-room)' }
  }
  
  const typeLower = type.toLowerCase()
  const colors = isDarkMode ? darkColors : lightColors
  const color = colors[typeLower] || (isDarkMode 
    ? { hex: '#5a6d7f', cssVar: 'var(--accent-primary)' }
    : { hex: '#1e40af', cssVar: 'var(--accent-primary)' }
  )
  
  return useCssVar ? color.cssVar : color.hex
}

