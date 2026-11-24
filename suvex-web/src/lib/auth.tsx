import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, onUnauthorized } from '@/lib/api'
import type { UserOut } from '@/types/api'

interface AuthContextValue {
  loading: boolean
  initialized: boolean
  user: UserOut | null
  refresh: () => Promise<void>
  setAuthenticatedUser: (user: UserOut) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(true)
  const [user, setUser] = useState<UserOut | null>(null)

  const refresh = useCallback(async () => {
    try {
      const state = await api.getAuthState()
      setInitialized(state.initialized)
      if (state.initialized && state.authenticated) {
        const me = await api.getMe()
        setUser(me)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    return onUnauthorized(() => {
      setUser(null)
    })
  }, [])

  const setAuthenticatedUser = useCallback((u: UserOut) => {
    setInitialized(true)
    setUser(u)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{ loading, initialized, user, refresh, setAuthenticatedUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
