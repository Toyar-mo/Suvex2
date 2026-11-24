import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from '@/App'
import { AuthProvider } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'
import { ToastProvider } from '@/lib/toast'
import { checkPasswordStrength, formatDuration } from '@/lib/format'
import { NAV_GROUPS, NAV_ITEMS } from '@/navigation'

describe('Suvex 2 Editorial Studio Core', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('registers all 19 workspace modules across 4 navigation groups', () => {
    expect(NAV_GROUPS).toHaveLength(4)
    expect(NAV_ITEMS).toHaveLength(19)
    const paths = new Set(NAV_ITEMS.map((n) => n.path))
    expect(paths.size).toBe(19)
    expect(paths.has('/assets')).toBe(true)
    expect(paths.has('/schedules')).toBe(true)
    expect(paths.has('/ir')).toBe(true)
    expect(paths.has('/tools')).toBe(true)
    expect(paths.has('/skills')).toBe(true)
    expect(paths.has('/approvals')).toBe(true)
  })

  it('validates password strength rules matching backend contract', () => {
    expect(checkPasswordStrength('short1A').ok).toBe(false)
    expect(checkPasswordStrength('alllowercase1234').ok).toBe(false)
    expect(checkPasswordStrength('Suvex2StrongPass99').ok).toBe(true)
  })

  it('formats durations cleanly', () => {
    expect(formatDuration(null)).toBe('进行中')
    expect(formatDuration(42)).toBe('42s')
    expect(formatDuration(125)).toBe('2m 5s')
  })

  it('renders Landing Page and adapts CTA based on auth/state', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith('/auth/state')) {
        return new Response(JSON.stringify({ initialized: false, authenticated: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.endsWith('/health')) {
        return new Response(JSON.stringify({ status: 'ok', version: '2.0.0' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    })

    render(
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <MemoryRouter initialEntries={['/']}>
              <AppRoutes />
            </MemoryRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>,
    )

    expect(screen.getByText(/自治安全测试/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getAllByText('初始化管理员').length).toBeGreaterThan(0)
    })
  })
})
