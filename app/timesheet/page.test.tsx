import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TimesheetPage from './page'

const mockReplace = vi.fn()
const mockUseUser = vi.fn()
const mockApiGet = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('../lib/hooks/useUser', () => ({
  useUser: () => mockUseUser(),
}))

vi.mock('../lib/api/client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
}))

vi.mock('../components/Header', () => ({
  default: () => <div data-testid="header">Header</div>,
}))

vi.mock('../components/LoadingSpinner', () => ({
  default: () => <div data-testid="loading-spinner">Loading</div>,
}))

vi.mock('./components/Timeline', () => ({
  default: ({ userName }: { userName?: string }) => (
    <div data-testid="timeline">Timeline for {userName ?? 'unknown'}</div>
  ),
}))

describe('TimesheetPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseUser.mockReturnValue({ user: { name: 'Test User' }, loading: false })
    mockApiGet.mockResolvedValue({ settings: { timesheets_enabled: true } })
  })

  it('renders nothing while loading', () => {
    mockUseUser.mockReturnValue({ user: null, loading: true })
    const { container } = render(<TimesheetPage />)
    expect(container.firstChild).toBeNull()
  })

  it('redirects unauthenticated users to login', async () => {
    mockUseUser.mockReturnValue({ user: null, loading: false })
    render(<TimesheetPage />)
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login')
    })
  })

  it('shows disabled message when timesheets are disabled', async () => {
    mockApiGet.mockResolvedValue({ settings: { timesheets_enabled: false } })
    render(<TimesheetPage />)
    expect(await screen.findByText('Timesheets Disabled')).toBeInTheDocument()
    expect(
      screen.getByText(/Timesheets are currently disabled/)
    ).toBeInTheDocument()
    expect(screen.queryByTestId('timeline')).not.toBeInTheDocument()
  })

  it('renders Header and Timeline when timesheets are enabled', async () => {
    render(<TimesheetPage />)
    expect(await screen.findByTestId('timeline')).toBeInTheDocument()
    expect(screen.getByTestId('header')).toBeInTheDocument()
    expect(screen.getByText('Timeline for Test User')).toBeInTheDocument()
  })

  it('defaults to enabled when settings API fails', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'))
    render(<TimesheetPage />)
    expect(await screen.findByTestId('timeline')).toBeInTheDocument()
  })
})
