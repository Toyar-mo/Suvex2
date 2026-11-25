import { useEffect, useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
  X,
} from 'lucide-react'
import { NAV_GROUPS, NAV_ITEMS, isNavActive } from '@/navigation'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/cn'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { ModuleTactileIcon, SuvexAppIcon } from '@/components/ui/AppIcons'
import { ScrollProgressRail } from '@/components/ui/MotionPrimitives'

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <SuvexAppIcon size={30} animated />
      {!compact && (
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold tracking-[-0.02em] text-ink">Suvex</span>
          <span className="rounded-md border border-accent/25 bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent-ink">
            2.1
          </span>
        </div>
      )}
    </div>
  )
}

export function AppShell({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)

  const currentNav = NAV_ITEMS.find((item) => isNavActive(item, pathname))
  const fillsViewport = Boolean(currentNav?.fillsViewport)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const sidebarContent = (isMobile = false) => {
    const isCompact = !isMobile && collapsed
    return (
      <div className="flex h-full flex-col bg-subtle">
        <div
          className={cn(
            'flex h-14 items-center border-b border-line px-3.5',
            isCompact ? 'justify-center' : 'justify-between',
          )}
        >
          <Link to="/overview" className="focus:outline-none">
            <BrandMark compact={isCompact} />
          </Link>
          {isMobile ? (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg p-1.5 text-ink-muted hover:bg-wash hover:text-ink"
              aria-label="关闭导航"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            !isCompact && (
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="rounded-md p-1 text-ink-muted hover:bg-wash hover:text-ink"
                title="收起侧栏"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )
          )}
        </div>

        {/* Command Bar Trigger */}
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className={cn(
              'flex w-full items-center rounded-lg border border-line bg-surface text-xs text-ink-muted shadow-editorial transition-colors hover:border-line-strong hover:text-ink',
              isCompact ? 'justify-center p-2' : 'justify-between px-2.5 py-1.5',
            )}
            title="搜索或快速跳转 (⌘K)"
          >
            <span className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5" />
              {!isCompact && <span>快速跳转...</span>}
            </span>
            {!isCompact && (
              <kbd className="rounded border border-line bg-subtle px-1 py-0.5 font-mono text-[10px]">
                ⌘K
              </kbd>
            )}
          </button>
        </div>

        {/* Nav Groups */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => {
            const items = NAV_ITEMS.filter((i) => i.group === group.id)
            return (
              <div key={group.id}>
                {!isCompact && (
                  <p className="mb-1.5 px-2 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-muted">
                    {group.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const active = isNavActive(item, pathname)
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.id}
                        to={item.path}
                        title={isCompact ? item.label : undefined}
                        className={cn(
                          'group relative flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-all duration-150',
                          isCompact ? 'justify-center p-2' : 'px-2.5 py-1.5',
                          active
                            ? 'bg-surface text-ink shadow-editorial ring-1 ring-accent/25 dark:ring-line'
                            : 'text-ink-secondary hover:translate-x-[1px] hover:bg-wash/75 hover:text-ink',
                        )}
                      >
                        {active && !isCompact && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-full bg-accent" />
                        )}
                        {active ? (
                          <ModuleTactileIcon moduleId={item.id} icon={Icon} size="xs" />
                        ) : (
                          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-ink-muted transition-colors group-hover:bg-surface group-hover:text-ink">
                            <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                          </span>
                        )}
                        {!isCompact && <span className="truncate">{item.label}</span>}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        {/* Footer Controls */}
        <div className="border-t border-line p-3">
          {isCompact ? (
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="rounded-lg p-2 text-ink-muted hover:bg-wash hover:text-ink"
                title="展开侧栏"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-lg p-2 text-ink-muted hover:bg-wash hover:text-ink"
                title="切换明暗主题"
              >
                {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-line bg-surface px-2.5 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-ink">
                    {user?.username || 'admin'}
                  </p>
                  <p className="truncate text-[10px] text-ink-muted">
                    {user?.role === 'admin' ? '管理员会话' : '操作员'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="rounded-md p-1.5 text-ink-muted hover:bg-wash hover:text-ink"
                    title={theme === 'light' ? '切换深色模式' : '切换浅色模式'}
                  >
                    {theme === 'light' ? (
                      <Moon className="h-3.5 w-3.5" />
                    ) : (
                      <Sun className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-md p-1.5 text-ink-muted hover:bg-wash hover:text-red-600"
                    title="退出登录"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex bg-canvas text-ink',
        fillsViewport ? 'h-screen overflow-hidden' : 'min-h-screen',
      )}
    >
      {!fillsViewport && <ScrollProgressRail />}
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 border-r border-line transition-[width] duration-200 md:block',
          collapsed ? 'w-16' : 'w-[236px]',
        )}
      >
        {sidebarContent(false)}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/35" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 h-full w-64 border-r border-line shadow-dialog">
            {sidebarContent(true)}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col',
          fillsViewport && 'h-full min-h-0 overflow-hidden',
        )}
      >
        {/* Mobile Topbar */}
        <header className="sticky top-0 z-30 flex h-13 shrink-0 items-center justify-between border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur md:hidden">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-1.5 text-ink-secondary hover:bg-wash"
              aria-label="打开菜单"
            >
              <Menu className="h-4 w-4" />
            </button>
            <BrandMark />
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="rounded-lg p-1.5 text-ink-secondary hover:bg-wash"
              aria-label="快速跳转"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg p-1.5 text-ink-secondary hover:bg-wash"
              aria-label="切换主题"
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <main
          className={cn(
            'min-w-0 flex-1',
            fillsViewport
              ? 'flex min-h-0 flex-col overflow-hidden'
              : 'mx-auto w-full max-w-[1260px] px-5 py-7 sm:px-8 sm:py-9',
          )}
        >
          {fillsViewport ? (
            children ?? <Outlet />
          ) : (
            <div key={pathname} className="page-enter">
              {children ?? <Outlet />}
            </div>
          )}
        </main>
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  )
}
