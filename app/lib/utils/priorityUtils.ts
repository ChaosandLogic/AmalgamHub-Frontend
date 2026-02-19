/**
 * Priority utility functions
 */

export interface PriorityColors {
  background: string
  border: string
}

export function getPriorityColor(priority: string): PriorityColors {
  switch (priority) {
    case 'low':
      return { background: 'var(--priority-low-bg)', border: 'var(--priority-low-border)' } // Green
    case 'normal':
      return { background: 'var(--priority-normal-booking-bg)', border: 'var(--priority-normal-booking-border)' } // Light blue-gray (distinct from weekend background)
    case 'high':
      return { background: 'var(--priority-medium-bg)', border: 'var(--priority-medium-border)' } // Orange/Yellow
    case 'urgent':
      return { background: 'var(--priority-high-bg)', border: 'var(--priority-high-border)' } // Red
    default:
      return { background: 'var(--priority-normal-booking-bg)', border: 'var(--priority-normal-booking-border)' } // Default to normal
  }
}

