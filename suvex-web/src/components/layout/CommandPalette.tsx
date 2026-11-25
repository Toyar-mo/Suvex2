import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Moon, Plus, Search, Sun } from 'lucide-react'
import { NAV_ITEMS } from '@/navigation'
import { useTheme } from '@/lib/theme'
import { prefetchRoute } from '@/lib/routePreload'
import { cn } from '@/lib/cn'

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement | null>(null)

  const commands = useMemo(() => {
    const base = [
      ...NAV_ITEMS.map((item) => ({
        id: `nav-${item.id}`,
        title: item.label,
        subtitle: item.blurb,
        group: '导航',
        path: item.path,
        icon: item.icon,
        run: () => navigate(item.path),
      })),
      {
        id: 'action-new-scan',
        title: '发起新扫描任务',
        subtitle: '打开扫描向导并配置目标、判据与授权声明',
        group: '快捷动作',
        path: '/scans',
        icon: Plus,
        run: () => navigate('/scans?new=1'),
      },
      {
        id: 'action-new-chat',
        title: '新建对话会话',
        subtitle: '进入对话工作台并开启新的安全协作线程',
        group: '快捷动作',
        path: '/chat',
        icon: Plus,
        run: () => navigate('/chat?new=1'),
      },
      {
        id: 'action-toggle-theme',
        title: theme === 'light' ? '切换至深色工作室模式' : '切换至瓷白浅色模式',
        subtitle: '立即切换 Editorial Studio 视觉主题',
        group: '外观',
        path: '',
        icon: theme === 'light' ? Moon : Sun,
        run: () => toggleTheme(),
      },
    ]

    const q = query.trim().toLowerCase()
    if (!q) return base
    return base.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.subtitle.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q),
    )
  }, [navigate, query, theme, toggleTheme])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const activeCmd = commands[activeIndex]
    if (activeCmd?.path) prefetchRoute(activeCmd.path)
    const activeBtn = listRef.current?.querySelector<HTMLElement>(
      `[data-cmd-index="${activeIndex}"]`,
    )
    activeBtn?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex, commands])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => (commands.length ? (i + 1) % commands.length : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => (commands.length ? (i - 1 + commands.length) % commands.length : 0))
      } else if (e.key === 'Enter' && commands[activeIndex]) {
        e.preventDefault()
        commands[activeIndex].run()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, commands, activeIndex, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]">
      <div
        className="suvex-backdrop-in fixed inset-0 bg-black/35 backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="全局命令面板"
        className="suvex-modal-in relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-dialog"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Search className="h-4 w-4 text-accent" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            placeholder="跳转页面、发起扫描或切换外观..."
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
          />
          <kbd className="rounded border border-line bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {commands.length === 0 ? (
            <div className="py-10 text-center text-xs text-ink-muted">没有匹配的命令</div>
          ) : (
            commands.map((cmd, idx) => {
              const Icon = cmd.icon
              const active = idx === activeIndex
              return (
                <button
                  key={cmd.id}
                  type="button"
                  data-cmd-index={idx}
                  onMouseEnter={() => {
                    setActiveIndex(idx)
                    if (cmd.path) prefetchRoute(cmd.path)
                  }}
                  onClick={() => {
                    cmd.run()
                    onClose()
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 active:scale-[0.99]',
                    active
                      ? 'bg-accent-soft/75 text-ink ring-1 ring-accent/20 dark:bg-subtle dark:ring-line'
                      : 'text-ink-secondary hover:bg-subtle/60',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors',
                      active
                        ? 'border-accent/30 bg-surface text-accent shadow-sm'
                        : 'border-line bg-surface text-ink-secondary',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-ink">{cmd.title}</span>
                      <span className="text-[10px] text-ink-muted">{cmd.group}</span>
                    </div>
                    <p className="truncate text-xs text-ink-muted">{cmd.subtitle}</p>
                  </div>
                  {active && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-accent" />}
                </button>
              )
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line bg-subtle/60 px-4 py-2 font-mono text-[10px] text-ink-muted">
          <span>↑↓ 选择 · ↵ 执行</span>
          <span>⌘K 快速唤起</span>
        </div>
      </div>
    </div>
  )
}
