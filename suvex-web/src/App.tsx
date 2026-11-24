import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AuthProvider, useAuth } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'
import { ToastProvider } from '@/lib/toast'
import { AppShell } from '@/components/layout/AppShell'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage, SetupPage } from '@/pages/AuthPages'
import { OverviewPage } from '@/pages/OverviewPage'
import { ChatPage } from '@/pages/ChatPage'
import { ScansPage } from '@/pages/ScansPage'
import { ActivityPage } from '@/pages/ActivityPage'
import { FindingsPage } from '@/pages/FindingsPage'
import { CtfPage } from '@/pages/CtfPage'
import { ModelsPage } from '@/pages/ModelsPage'
import { SettingsPage } from '@/pages/SettingsPage'

function ProtectedShell() {
  const { loading, initialized, user } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-xs text-ink-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-accent" />
        正在校验会话状态…
      </div>
    )
  }

  if (!initialized) return <Navigate to="/setup" replace />
  if (!user) return <Navigate to="/login" replace />

  return <AppShell />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<SetupPage />} />

      <Route element={<ProtectedShell />}>
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/scans" element={<ScansPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/findings" element={<FindingsPage />} />
        <Route path="/ctf" element={<CtfPage />} />
        <Route path="/kernel" element={<Navigate to="/ctf" replace />} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
