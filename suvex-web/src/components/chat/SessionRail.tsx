import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Archive,
  ArchiveRestore,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Download,
  Flag,
  Folder,
  GitFork,
  Loader2,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatRelativeTime } from '@/lib/format'
import type { ChatSessionOut } from '@/types/api'
import { Button } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

export interface SessionRailProps {
  sessions: ChatSessionOut[]
  activeId: string | null
  runningIds?: ReadonlySet<string>
  onSelect: (id: string) => void
  onNew: () => void
  onRename: (id: string, title: string) => Promise<void>
  onTogglePin: (session: ChatSessionOut) => Promise<void>
  onRequestArchive: (session: ChatSessionOut) => void
  onUnarchive: (session: ChatSessionOut) => Promise<void>
  onRequestPurge: (session: ChatSessionOut) => void
  onRequestPurgeAllArchived: () => void
  onFork: (session: ChatSessionOut) => Promise<void>
  onOpenSettings: (session: ChatSessionOut) => void
  onBatchPin: (ids: string[], pinned: boolean) => Promise<void>
  onBatchMoveProject: (ids: string[], project: string | null) => Promise<void>
  onRequestBatchArchive: (ids: string[]) => void
  onBatchUnarchive: (ids: string[]) => Promise<void>
  onRequestBatchPurge: (ids: string[]) => void
}

function SessionActionMenu({
  session,
  onStartRename,
  onTogglePin,
  onOpenSettings,
  onFork,
  onRequestArchive,
  onUnarchive,
  onRequestPurge,
}: {
  session: ChatSessionOut
  onStartRename: () => void
  onTogglePin: () => void
  onOpenSettings: () => void
  onFork: () => void
  onRequestArchive: () => void
  onUnarchive: () => void
  onRequestPurge: () => void
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const menuW = 176
    const menuH = session.archived ? 132 : 228
    const openUp = window.innerHeight - rect.bottom < menuH + 12
    const left = Math.max(8, Math.min(rect.right - menuW, window.innerWidth - menuW - 8))
    const top = openUp ? Math.max(8, rect.top - menuH - 4) : rect.bottom + 4
    setPos({ top, left })
  }, [open, session.archived])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const act = (fn: () => void) => {
    setOpen(false)
    fn()
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className={cn(
          'rounded-md p-1 text-ink-muted transition-colors hover:bg-wash hover:text-ink',
          open ? 'bg-wash text-ink opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
        title="会话操作"
        aria-label="会话操作"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: 176 }}
            className="z-[85] rounded-xl border border-line bg-surface p-1 text-xs shadow-dialog backdrop-blur"
          >
            {session.archived ? (
              <>
                <button
                  type="button"
                  onClick={() => act(onUnarchive)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-ink-secondary transition-colors hover:bg-wash hover:text-ink"
                >
                  <ArchiveRestore className="h-3.5 w-3.5 text-emerald-500" />
                  <span>恢复到进行中</span>
                </button>
                <a
                  href={api.getChatExportUrl(session.id)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-ink-secondary transition-colors hover:bg-wash hover:text-ink"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>导出 JSONL</span>
                </a>
                <div className="my-1 border-t border-line-subtle" />
                <button
                  type="button"
                  onClick={() => act(onRequestPurge)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>彻底删除</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => act(onStartRename)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-ink-secondary transition-colors hover:bg-wash hover:text-ink"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>重命名</span>
                </button>
                <button
                  type="button"
                  onClick={() => act(onTogglePin)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-ink-secondary transition-colors hover:bg-wash hover:text-ink"
                >
                  <Pin className="h-3.5 w-3.5" />
                  <span>{session.pinned ? '取消置顶' : '置顶会话'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => act(onOpenSettings)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-ink-secondary transition-colors hover:bg-wash hover:text-ink"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>会话设置</span>
                </button>
                <button
                  type="button"
                  onClick={() => act(onFork)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-ink-secondary transition-colors hover:bg-wash hover:text-ink"
                >
                  <GitFork className="h-3.5 w-3.5" />
                  <span>分叉新分支</span>
                </button>
                <a
                  href={api.getChatExportUrl(session.id)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-ink-secondary transition-colors hover:bg-wash hover:text-ink"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>导出 JSONL</span>
                </a>
                <div className="my-1 border-t border-line-subtle" />
                <button
                  type="button"
                  onClick={() => act(onRequestArchive)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-amber-700 transition-colors hover:bg-amber-500/10 dark:text-amber-400"
                >
                  <Archive className="h-3.5 w-3.5" />
                  <span>归档会话</span>
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}

export function SessionRail({
  sessions,
  activeId,
  runningIds,
  onSelect,
  onNew,
  onRename,
  onTogglePin,
  onRequestArchive,
  onUnarchive,
  onRequestPurge,
  onRequestPurgeAllArchived,
  onFork,
  onOpenSettings,
  onBatchPin,
  onBatchMoveProject,
  onRequestBatchArchive,
  onBatchUnarchive,
  onRequestBatchPurge,
}: SessionRailProps) {
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const [onlyRunning, setOnlyRunning] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState<string>('__all__')
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({})

  // Multi-select batch mode
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [batchProjectOpen, setBatchProjectOpen] = useState(false)
  const [batchProjectDraft, setBatchProjectDraft] = useState('')
  const [batchBusy, setBatchBusy] = useState(false)

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const renameInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (renamingId) {
      window.setTimeout(() => renameInputRef.current?.select(), 10)
    }
  }, [renamingId])

  useEffect(() => {
    const validIds = new Set(
      sessions.filter((s) => (tab === 'archived' ? s.archived : !s.archived)).map((s) => s.id),
    )
    setSelectedIds((prev) => prev.filter((id) => validIds.has(id)))
  }, [sessions, tab])

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds([])
    setBatchProjectOpen(false)
    setBatchProjectDraft('')
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const isSessionRunning = (s: ChatSessionOut) =>
    Boolean(s.running || (runningIds && runningIds.has(s.id)))

  const activeSessions = useMemo(() => sessions.filter((s) => !s.archived), [sessions])
  const archivedSessions = useMemo(() => sessions.filter((s) => s.archived), [sessions])
  const runningCount = useMemo(
    () => activeSessions.filter((s) => Boolean(s.running || runningIds?.has(s.id))).length,
    [activeSessions, runningIds],
  )

  useEffect(() => {
    if (onlyRunning && runningCount === 0) setOnlyRunning(false)
  }, [onlyRunning, runningCount])

  const projectNames = useMemo(() => {
    const set = new Set<string>()
    for (const s of activeSessions) {
      if (s.project?.trim()) set.add(s.project.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  }, [activeSessions])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const base = tab === 'active' ? activeSessions : archivedSessions
    return base.filter((s) => {
      if (tab === 'active' && onlyRunning && !(s.running || runningIds?.has(s.id))) {
        return false
      }
      if (tab === 'active' && projectFilter !== '__all__') {
        if (projectFilter === '__none__') {
          if (s.project?.trim()) return false
        } else if ((s.project || '').trim() !== projectFilter) {
          return false
        }
      }
      if (!q) return true
      return (
        (s.title || '').toLowerCase().includes(q) ||
        (s.project || '').toLowerCase().includes(q)
      )
    })
  }, [tab, activeSessions, archivedSessions, searchQuery, projectFilter, onlyRunning, runningIds])

  const groupedActive = useMemo(() => {
    const pinned: ChatSessionOut[] = []
    const byProject = new Map<string, ChatSessionOut[]>()
    const ungrouped: ChatSessionOut[] = []

    for (const s of filtered) {
      if (s.pinned) {
        pinned.push(s)
      } else if (s.project?.trim() && projectFilter === '__all__') {
        const key = s.project.trim()
        const arr = byProject.get(key) || []
        arr.push(s)
        byProject.set(key, arr)
      } else {
        ungrouped.push(s)
      }
    }
    return {
      pinned,
      projects: Array.from(byProject.entries()).sort(([a], [b]) => a.localeCompare(b, 'zh-CN')),
      ungrouped,
    }
  }, [filtered, projectFilter])

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((s) => selectedIds.includes(s.id))

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(filtered.map((s) => s.id))
    }
  }

  const runBatch = async (fn: () => Promise<void>) => {
    setBatchBusy(true)
    try {
      await fn()
      setSelectedIds([])
      setBatchProjectOpen(false)
      setBatchProjectDraft('')
    } finally {
      setBatchBusy(false)
    }
  }

  const startRename = (s: ChatSessionOut) => {
    setRenamingId(s.id)
    setRenameDraft(s.title || '')
  }

  const commitRename = async (id: string) => {
    const next = renameDraft.trim()
    setRenamingId(null)
    if (!next) return
    await onRename(id, next)
  }

  const renderSessionRow = (s: ChatSessionOut) => {
    const isActive = s.id === activeId
    const isRunning = isSessionRunning(s)
    const isRenaming = renamingId === s.id
    const isChecked = selectedIds.includes(s.id)
    return (
      <div
        key={s.id}
        onClick={() => {
          if (selectMode) {
            toggleSelected(s.id)
          } else if (!isRenaming) {
            onSelect(s.id)
          }
        }}
        onDoubleClick={() => {
          if (!selectMode && !s.archived) startRename(s)
        }}
        className={cn(
          'group relative flex cursor-pointer items-start justify-between gap-1.5 rounded-lg px-2.5 py-2 transition-colors',
          selectMode && isChecked
            ? 'bg-accent-soft text-ink ring-1 ring-accent/40'
            : isActive
              ? isRunning
                ? 'bg-emerald-50/75 text-ink ring-1 ring-emerald-400/50 dark:bg-emerald-950/35 dark:ring-emerald-700/60'
                : 'bg-accent-soft/75 text-ink ring-1 ring-accent/25'
              : isRunning
                ? 'bg-emerald-50/45 text-ink ring-1 ring-emerald-300/45 hover:bg-emerald-50/80 dark:bg-emerald-950/20 dark:ring-emerald-800/50 dark:hover:bg-emerald-950/40'
                : 'text-ink-secondary hover:bg-subtle hover:text-ink',
        )}
      >
        {!selectMode && (isActive || isRunning) && (
          <span
            className={cn(
              'absolute bottom-2 left-0 top-2 w-0.5 rounded-r',
              isRunning ? 'animate-pulse bg-emerald-500' : 'bg-accent',
            )}
          />
        )}

        {selectMode && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              toggleSelected(s.id)
            }}
            className={cn(
              'mt-0.5 shrink-0 transition-colors',
              isChecked ? 'text-accent' : 'text-ink-muted hover:text-ink',
            )}
            aria-label={isChecked ? '取消选择' : '选择会话'}
          >
            {isChecked ? (
              <CheckSquare className="h-3.5 w-3.5" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
          </button>
        )}

        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                ref={renameInputRef}
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void commitRename(s.id)
                  } else if (e.key === 'Escape') {
                    setRenamingId(null)
                  }
                }}
                onBlur={() => void commitRename(s.id)}
                className="h-6 w-full rounded border border-accent bg-canvas px-1.5 text-xs text-ink focus:outline-none"
              />
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  void commitRename(s.id)
                }}
                className="rounded p-0.5 text-emerald-500 hover:bg-wash"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {isRunning && (
                <Loader2
                  className="h-3 w-3 shrink-0 animate-spin text-emerald-600 dark:text-emerald-400"
                  aria-label="运行中"
                />
              )}
              {s.pinned && <Pin className="h-3 w-3 shrink-0 text-accent" />}
              {s.challengeId && (
                <Flag className="h-3 w-3 shrink-0 text-indigo-400" aria-label="CTF 题目会话" />
              )}
              {s.forkedFromSessionId && (
                <GitFork className="h-3 w-3 shrink-0 text-ink-muted" aria-label="分支会话" />
              )}
              <span className="truncate text-xs font-medium text-ink">
                {s.title || '未命名会话'}
              </span>
            </div>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-ink-muted">
            {isRunning && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/80 bg-emerald-50 px-1.5 py-0.2 font-sans text-[10px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                运行中
              </span>
            )}
            <span>{s.messageCount} 条</span>
            <span>·</span>
            <span>{formatRelativeTime(s.updatedAt)}</span>
            {s.requireApproval && (
              <span
                className="inline-flex items-center text-amber-500"
                title="已开启高危操作人工审批"
              >
                <ShieldCheck className="h-2.5 w-2.5" />
              </span>
            )}
            {s.project && (s.pinned || tab === 'archived') && (
              <span className="max-w-[84px] truncate rounded bg-wash/80 px-1 py-0.2 text-[9px] text-ink-secondary">
                {s.project}
              </span>
            )}
          </div>
        </div>

        {!isRenaming && !selectMode && (
          <div className="flex shrink-0 items-center">
            <SessionActionMenu
              session={s}
              onStartRename={() => startRename(s)}
              onTogglePin={() => void onTogglePin(s)}
              onOpenSettings={() => onOpenSettings(s)}
              onFork={() => void onFork(s)}
              onRequestArchive={() => onRequestArchive(s)}
              onUnarchive={() => void onUnarchive(s)}
              onRequestPurge={() => onRequestPurge(s)}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col overflow-hidden border-r border-line bg-surface lg:flex">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-1.5 border-b border-line px-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className="truncate text-xs font-semibold tracking-wide text-ink">会话管理</h2>
          {runningCount > 0 ? (
            <button
              type="button"
              onClick={() => {
                setTab('active')
                setOnlyRunning((v) => !v)
              }}
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                onlyRunning
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-emerald-300/80 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300',
              )}
              title={onlyRunning ? '点击显示全部活跃会话' : '点击仅筛选正在运行的会话'}
            >
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              <span>{runningCount} 运行中</span>
            </button>
          ) : (
            <span className="rounded-full bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
              {activeSessions.length}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px] font-medium transition-colors',
              selectMode
                ? 'border-accent bg-accent-soft text-accent-ink'
                : 'border-line bg-subtle text-ink-secondary hover:border-line-strong hover:text-ink',
            )}
            title={selectMode ? '退出多选模式' : '开启多选批量管理'}
          >
            <CheckSquare className="h-3 w-3" />
            <span>{selectMode ? '完成' : '多选'}</span>
          </button>
          <Button size="sm" variant="primary" onClick={onNew} className="h-7 px-2 text-[11px]">
            <Plus className="h-3.5 w-3.5" />
            新建
          </Button>
        </div>
      </div>

      {/* Search + Active / Archived Segmented Tabs + Select All Bar */}
      <div className="shrink-0 space-y-2 border-b border-line px-3 py-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-muted" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索标题或项目..."
            className="h-8 w-full rounded-lg border border-line bg-subtle pl-8 pr-7 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 rounded p-0.5 text-ink-muted hover:text-ink"
              aria-label="清空搜索"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-subtle p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => {
              setTab('active')
              setOnlyRunning(false)
            }}
            className={cn(
              'rounded-md py-1 font-medium transition-colors',
              tab === 'active'
                ? 'bg-surface text-ink shadow-editorial'
                : 'text-ink-muted hover:text-ink-secondary',
            )}
          >
            活跃会话 ({activeSessions.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('archived')}
            className={cn(
              'rounded-md py-1 font-medium transition-colors',
              tab === 'archived'
                ? 'bg-surface text-ink shadow-editorial'
                : 'text-ink-muted hover:text-ink-secondary',
            )}
          >
            已归档 ({archivedSessions.length})
          </button>
        </div>

        {tab === 'active' && projectNames.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            <button
              type="button"
              onClick={() => setProjectFilter('__all__')}
              className={cn(
                'rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors',
                projectFilter === '__all__'
                  ? 'bg-accent-soft text-accent-ink'
                  : 'bg-subtle text-ink-muted hover:text-ink',
              )}
            >
              全部
            </button>
            {projectNames.map((proj) => (
              <button
                key={proj}
                type="button"
                onClick={() => setProjectFilter(projectFilter === proj ? '__all__' : proj)}
                className={cn(
                  'max-w-[110px] truncate rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors',
                  projectFilter === proj
                    ? 'bg-accent-soft text-accent-ink'
                    : 'bg-subtle text-ink-muted hover:text-ink',
                )}
              >
                {proj}
              </button>
            ))}
          </div>
        )}

        {selectMode && (
          <div className="flex items-center justify-between rounded-lg border border-accent/30 bg-accent-soft/50 px-2.5 py-1.5 text-[11px]">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-1.5 font-medium text-ink hover:text-accent"
            >
              {allFilteredSelected ? (
                <CheckSquare className="h-3.5 w-3.5 text-accent" />
              ) : (
                <Square className="h-3.5 w-3.5 text-ink-muted" />
              )}
              <span>{allFilteredSelected ? '取消全选' : `全选 (${filtered.length})`}</span>
            </button>
            <span className="font-mono text-[10px] text-accent-ink">
              已选 {selectedIds.length} 条
            </span>
          </div>
        )}
      </div>

      {/* Scrollable Session List */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-ink-muted">
            {tab === 'archived' ? '暂无已归档会话' : searchQuery ? '未匹配到相关会话' : '暂无会话'}
          </div>
        ) : tab === 'archived' ? (
          <div className="space-y-1">{filtered.map(renderSessionRow)}</div>
        ) : (
          <>
            {groupedActive.pinned.length > 0 && (
              <div>
                <p className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wider text-ink-muted">
                  置顶 ({groupedActive.pinned.length})
                </p>
                <div className="space-y-1">{groupedActive.pinned.map(renderSessionRow)}</div>
              </div>
            )}

            {groupedActive.projects.map(([proj, items]) => {
              const isCollapsed = Boolean(collapsedProjects[proj])
              return (
                <div key={proj}>
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedProjects((prev) => ({ ...prev, [proj]: !prev[proj] }))
                    }
                    className="mb-1 flex w-full items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3 w-3 text-ink-muted" />
                    ) : (
                      <ChevronDown className="h-3 w-3 text-ink-muted" />
                    )}
                    <Folder className="h-3 w-3 text-accent" />
                    <span className="truncate">{proj}</span>
                    <span className="ml-auto font-mono text-[10px] text-ink-muted">
                      {items.length}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-1 pl-1">{items.map(renderSessionRow)}</div>
                  )}
                </div>
              )
            })}

            {groupedActive.ungrouped.length > 0 && (
              <div>
                {(groupedActive.pinned.length > 0 || groupedActive.projects.length > 0) && (
                  <p className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wider text-ink-muted">
                    最近会话 ({groupedActive.ungrouped.length})
                  </p>
                )}
                <div className="space-y-1">{groupedActive.ungrouped.map(renderSessionRow)}</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Multi-Select Batch Action Dock or Archived Footer */}
      {selectMode && selectedIds.length > 0 ? (
        <div className="shrink-0 space-y-2 border-t border-line bg-subtle/90 p-2.5 text-[11px]">
          {batchProjectOpen && tab === 'active' && (
            <div className="space-y-1.5 rounded-lg border border-line bg-surface p-2">
              <div className="flex items-center gap-1">
                <input
                  value={batchProjectDraft}
                  onChange={(e) => setBatchProjectDraft(e.target.value)}
                  placeholder="输入项目名（留空移出）"
                  className="h-7 flex-1 rounded border border-line bg-canvas px-2 text-[11px] text-ink focus:border-accent focus:outline-none"
                />
                <Button
                  size="sm"
                  variant="primary"
                  loading={batchBusy}
                  onClick={() =>
                    void runBatch(() =>
                      onBatchMoveProject(selectedIds, batchProjectDraft.trim() || null),
                    )
                  }
                  className="h-7 px-2 text-[11px]"
                >
                  确定
                </Button>
              </div>
              {projectNames.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {projectNames.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setBatchProjectDraft(p)}
                      className="rounded bg-subtle px-1.5 py-0.5 text-[10px] text-ink-secondary hover:bg-wash hover:text-ink"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'active' ? (
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                disabled={batchBusy}
                onClick={() => {
                  const allPinned = selectedIds.every(
                    (id) => sessions.find((s) => s.id === id)?.pinned,
                  )
                  void runBatch(() => onBatchPin(selectedIds, !allPinned))
                }}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-line bg-surface py-1.5 font-medium text-ink-secondary transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
              >
                <Pin className="h-3 w-3" />
                <span>置顶</span>
              </button>
              <button
                type="button"
                disabled={batchBusy}
                onClick={() => setBatchProjectOpen((v) => !v)}
                className={cn(
                  'inline-flex items-center justify-center gap-1 rounded-lg border py-1.5 font-medium transition-colors disabled:opacity-50',
                  batchProjectOpen
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface text-ink-secondary hover:border-line-strong hover:text-ink',
                )}
              >
                <Folder className="h-3 w-3" />
                <span>分组</span>
              </button>
              <button
                type="button"
                disabled={batchBusy}
                onClick={() => onRequestBatchArchive(selectedIds)}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-amber-300/60 bg-amber-50/70 py-1.5 font-medium text-amber-800 transition-colors hover:bg-amber-100/70 disabled:opacity-50 dark:border-amber-800/70 dark:bg-amber-950/50 dark:text-amber-300"
              >
                <Archive className="h-3 w-3" />
                <span>归档</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={batchBusy}
                onClick={() => void runBatch(() => onBatchUnarchive(selectedIds))}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-300/60 bg-emerald-50/70 py-1.5 font-medium text-emerald-800 transition-colors hover:bg-emerald-100/70 disabled:opacity-50 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-300"
              >
                <ArchiveRestore className="h-3 w-3" />
                <span>批量恢复</span>
              </button>
              <button
                type="button"
                disabled={batchBusy}
                onClick={() => onRequestBatchPurge(selectedIds)}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-300/60 bg-red-50/70 py-1.5 font-medium text-red-700 transition-colors hover:bg-red-100/70 disabled:opacity-50 dark:border-red-800/70 dark:bg-red-950/50 dark:text-red-300"
              >
                <Trash2 className="h-3 w-3" />
                <span>彻底删除</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        tab === 'archived' &&
        archivedSessions.length > 0 && (
          <div className="flex shrink-0 items-center justify-between border-t border-line bg-subtle/60 px-3 py-2 text-[11px]">
            <span className="text-ink-muted">共 {archivedSessions.length} 条归档</span>
            <button
              type="button"
              onClick={onRequestPurgeAllArchived}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
              清空归档
            </button>
          </div>
        )
      )}
    </aside>
  )
}
