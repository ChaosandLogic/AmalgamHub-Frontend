import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DayTabs from '../DayTabs'

describe('DayTabs', () => {
  const weekStart = new Date(2025, 3, 21)
  const onSelect = vi.fn()

  it('renders all 7 day labels', () => {
    render(<DayTabs weekStart={weekStart} activeDay={0} onSelect={onSelect} />)
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Tue')).toBeInTheDocument()
    expect(screen.getByText('Wed')).toBeInTheDocument()
    expect(screen.getByText('Thu')).toBeInTheDocument()
    expect(screen.getByText('Fri')).toBeInTheDocument()
    expect(screen.getByText('Sat')).toBeInTheDocument()
    expect(screen.getByText('Sun')).toBeInTheDocument()
  })

  it('highlights the active day', () => {
    render(<DayTabs weekStart={weekStart} activeDay={2} onSelect={onSelect} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons[2].style.background).toContain('var(--primary)')
    expect(buttons[0].style.background).toContain('var(--surface)')
  })

  it('calls onSelect when a tab is clicked', async () => {
    const user = userEvent.setup()
    render(<DayTabs weekStart={weekStart} activeDay={0} onSelect={onSelect} />)
    await user.click(screen.getByText('Wed'))
    expect(onSelect).toHaveBeenCalledWith(2)
  })
})
