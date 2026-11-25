/* --------------------------------------------------------------------------
   Route Chunk Preloader — Zero-Flash Lazy Navigation
   Hover/focus on sidebar links or idle time warms chunks before click lands.
   -------------------------------------------------------------------------- */

type LoaderFn = () => Promise<unknown>

export const ROUTE_LOADERS: Record<string, LoaderFn> = {
  '/overview': () => import('@/pages/OverviewPage'),
  '/chat': () => import('@/pages/ChatPage'),
  '/scans': () => import('@/pages/ScansPage'),
  '/missions': () => import('@/pages/MissionsPage'),
  '/activity': () => import('@/pages/ActivityPage'),
  '/intranet': () => import('@/pages/IntranetPage'),
  '/findings': () => import('@/pages/FindingsPage'),
  '/assets': () => import('@/pages/AssetsPage'),
  '/reports': () => import('@/pages/ReportsPage'),
  '/credentials': () => import('@/pages/CredentialsPage'),
  '/files': () => import('@/pages/FilesPage'),
  '/ctf': () => import('@/pages/CtfPage'),
  '/ir': () => import('@/pages/IrPage'),
  '/schedules': () => import('@/pages/SchedulesPage'),
  '/tools': () => import('@/pages/ToolsPage'),
  '/skills': () => import('@/pages/SkillsPage'),
  '/agents': () => import('@/pages/AgentsPage'),
  '/approvals': () => import('@/pages/ApprovalsPage'),
  '/models': () => import('@/pages/ModelsPage'),
  '/settings': () => import('@/pages/SettingsPage'),
}

const prefetched = new Set<string>()

export function prefetchRoute(path: string): void {
  const clean = path.split('?')[0]
  if (prefetched.has(clean)) return
  const loader = ROUTE_LOADERS[clean]
  if (!loader) return
  prefetched.add(clean)
  void loader().catch(() => {
    prefetched.delete(clean)
  })
}

export function prefetchCoreRoutesOnIdle(): void {
  if (typeof window === 'undefined') return
  const core = ['/overview', '/chat', '/ctf', '/activity']
  const run = () => {
    core.forEach((p, idx) => {
      window.setTimeout(() => prefetchRoute(p), idx * 240)
    })
  }
  const ric = (window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
  }).requestIdleCallback
  if (typeof ric === 'function') {
    ric(run, { timeout: 2000 })
  } else {
    globalThis.setTimeout(run, 1200)
  }
}
