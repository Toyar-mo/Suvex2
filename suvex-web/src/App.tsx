import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AuthProvider, useAuth } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'
import { ToastProvider } from '@/lib/toast'
import { AppShell } from '@/components/layout/AppShell'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage, SetupPage } from '@/pages/AuthPages'

const OverviewPage = lazy(() =>
  import('@/pages/OverviewPage').then((m) => ({ default: m.OverviewPage })),
)
const ChatPage = lazy(() => import('@/pages/ChatPage').then((m) => ({ default: m.ChatPage })))
const ScansPage = lazy(() => import('@/pages/ScansPage').then((m) => ({ default: m.ScansPage })))
const ActivityPage = lazy(() =>
  import('@/pages/ActivityPage').then((m) => ({ default: m.ActivityPage })),
)
const FindingsPage = lazy(() =>
  import('@/pages/FindingsPage').then((m) => ({ default: m.FindingsPage })),
)
const CtfPage = lazy(() => import('@/pages/CtfPage').then((m) => ({ default: m.CtfPage })))
const ModelsPage = lazy(() =>
  import('@/pages/ModelsPage').then((m) => ({ default: m.ModelsPage })),
)
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const AssetsPage = lazy(() =>
  import('@/pages/AssetsPage').then((m) => ({ default: m.AssetsPage })),
)
const ReportsPage = lazy(() =>
  import('@/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })),
)
const CredentialsPage = lazy(() =>
  import('@/pages/CredentialsPage').then((m) => ({ default: m.CredentialsPage })),
)
const FilesPage = lazy(() => import('@/pages/FilesPage').then((m) => ({ default: m.FilesPage })))
const IntranetPage = lazy(() =>
  import('@/pages/IntranetPage').then((m) => ({ default: m.IntranetPage })),
)
const SchedulesPage = lazy(() =>
  import('@/pages/SchedulesPage').then((m) => ({ default: m.SchedulesPage })),
)
const IrPage = lazy(() => import('@/pages/IrPage').then((m) => ({ default: m.IrPage })))
const ToolsPage = lazy(() => import('@/pages/ToolsPage').then((m) => ({ default: m.ToolsPage })))
const SkillsPage = lazy(() =>
  import('@/pages/SkillsPage').then((m) => ({ default: m.SkillsPage })),
)
const AgentsPage = lazy(() =>
  import('@/pages/AgentsPage').then((m) => ({ default: m.AgentsPage })),
)
const ApprovalsPage = lazy(() =>
  import('@/pages/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage })),
)
const MissionsPage = lazy(() =>
  import('@/pages/MissionsPage').then((m) => ({ default: m.MissionsPage })),
)

function RouteFallback() {
  return (
    <div className="flex min-h-[42vh] items-center justify-center text-xs text-ink-muted">
      <Loader2 className="mr-2 h-4 w-4 animate-spin text-accent" />
      正在加载工作面…
    </div>
  )
}

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
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupPage />} />

        <Route element={<ProtectedShell />}>
          {/* 运行与交互 */}
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/scans" element={<ScansPage />} />
          <Route path="/missions" element={<MissionsPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/intranet" element={<IntranetPage />} />

          {/* 资产与产出 */}
          <Route path="/findings" element={<FindingsPage />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/credentials" element={<CredentialsPage />} />
          <Route path="/files" element={<FilesPage />} />

          {/* 自动化与专项 */}
          <Route path="/ctf" element={<CtfPage />} />
          <Route path="/kernel" element={<Navigate to="/ctf" replace />} />
          <Route path="/ir" element={<IrPage />} />
          <Route path="/schedules" element={<SchedulesPage />} />

          {/* 能力与治理 */}
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/models" element={<ModelsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
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
