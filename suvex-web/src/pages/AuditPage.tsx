import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  User,
} from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { formatRelativeTime } from '@/lib/format'
import type { AuditEntryOut } from '@/types/api'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Skeleton,
} from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

const ACTION_OPTIONS = [
  { value: '', label: '全部操作动作' },
  { value: 'scan.create', label: '发起扫描 (scan.create)' },
  { value: 'scan.rerun', label: '重跑扫描 (scan.rerun)' },
  { value: 'scan.abort', label: '终止扫描 (scan.abort)' },
  { value: 'scan.archive', label: '归档扫描 (scan.archive)' },
  { value: 'scan.purge', label: '永久删除扫描 (scan.purge)' },
  { value: 'finding.status_change', label: '变更漏洞状态 (finding.status_change)' },
  { value: 'finding.assign', label: '指派漏洞负责人 (finding.assign)' },
  { value: 'finding.delete', label: '删除漏洞 (finding.delete)' },
  { value: 'report.download', label: '下载报告 (report.download)' },
  { value: 'report.delete', label: '删除报告 (report.delete)' },
  { value: 'ctf2.account_bind', label: '绑定 CTF2 账号 (ctf2.account_bind)' },
  { value: 'ctf2.account_unbind', label: '解绑 CTF2 账号 (ctf2.account_unbind)' },
  { value: 'ctf2.sync', label: '同步 CTF2 题板 (ctf2.sync)' },
  { value: 'ctf2.solve_start', label: '发起 CTF2 解题 (ctf2.solve_start)' },
  { value: 'ctf2.solve_cancel', label: '取消 CTF2 解题 (ctf2.solve_cancel)' },
  { value: 'ctf2.submit', label: '提交 CTF2 Flag (ctf2.submit)' },
  { value: 'ctf2.settings_update', label: '更新 CTF2 配置 (ctf2.settings_update)' },
  { value: 'kernel.mcp_servers_update', label: '更新 MCP 连接 (kernel.mcp_servers_update)' },
  { value: 'kernel.tools_update', label: '更新工具开关 (kernel.tools_update)' },
  { value: 'kernel.skill_create', label: '新建技能 (kernel.skill_create)' },
  { value: 'kernel.skill_update', label: '更新技能 (kernel.skill_update)' },
  { value: 'kernel.skill_delete', label: '删除技能 (kernel.skill_delete)' },
  { value: 'ir.task_create', label: '发起应急响应复盘 (ir.task_create)' },
  { value: 'user.create', label: '新建用户 (user.create)' },
  { value: 'user.role_change', label: '变更用户角色 (user.role_change)' },
  { value: 'user.delete', label: '删除用户 (user.delete)' },
]

const WINDOW_OPTIONS = [
  { value: 'all', label: '全部时间' },
  { value: '24h', label: '近 24 小时' },
  { value: '7d', label: '近 7 天' },
  { value: '30d', label: '近 30 天' },
  { value: '90d', label: '近 90 天' },
]

function windowToSinceIso(win: string): string | undefined {
  const now = Date.now()
  const map: Record<string, number> = {
    '24h': 24 * 3600 * 1000,
    '7d': 7 * 24 * 3600 * 1000,
    '30d': 30 * 24 * 3600 * 1000,
    '90d': 90 * 24 * 3600 * 1000,
  }
  const delta = map[win]
  if (!delta) return undefined
  return new Date(now - delta).toISOString()
}

function actionBadgeCls(action: string): string {
  if (action.startsWith('ctf2.')) {
    return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/60 dark:text-sky-300'
  }
  if (action.startsWith('scan.')) {
    return 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/70 dark:bg-indigo-950/60 dark:text-indigo-300'
  }
  if (action.startsWith('finding.')) {
    return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/60 dark:text-amber-300'
  }
  if (action.startsWith('kernel.')) {
    return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/70 dark:bg-violet-950/60 dark:text-violet-300'
  }
  if (action.startsWith('user.') || action.endsWith('.purge') || action.endsWith('.delete')) {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/60 dark:text-red-300'
  }
  if (action.startsWith('report.')) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/60 dark:text-emerald-300'
  }
  return 'border-line bg-subtle text-ink-secondary'
}

export function AuditPage() {
  const { push } = useToast()

  const [entries, setEntries] = useState<AuditEntryOut[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [retentionDays, setRetentionDays] = useState(365)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [actionFilter, setActionFilter] = useState('')
  const [actorInput, setActorInput] = useState('')
  const [actorQuery, setActorQuery] = useState('')
  const [timeWindow, setTimeWindow] = useState('all')
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})

  const sinceIso = useMemo(() => windowToSinceIso(timeWindow), [timeWindow])

  const loadPage = useCallback(
    async (cursor?: string | null) => {
      const append = Boolean(cursor)
      if (append) setLoadingMore(true)
      else setLoading(true)
      try {
        const res = await api.listAudit({
          limit: 50,
          cursor: cursor || undefined,
          action: actionFilter || undefined,
          actor: actorQuery || undefined,
          since: sinceIso,
        })
        setEntries((prev) => (append ? [...prev, ...res.entries] : res.entries))
        setNextCursor(res.nextCursor)
        setTotal(res.total)
        setRetentionDays(res.retentionDays)
      } catch (err) {
        push(err instanceof ApiClientError ? err.message : '加载审计日志失败', 'error')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [actionFilter, actorQuery, sinceIso, push],
  )

  useEffect(() => {
    void loadPage(null)
  }, [loadPage])

  const handleSearchActor = (e: FormEvent) => {
    e.preventDefault()
    setActorQuery(actorInput.trim())
  }

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const csvUrl = api.getAuditExportUrl('csv', {
    action: actionFilter || undefined,
    since: sinceIso,
  })
  const jsonlUrl = api.getAuditExportUrl('jsonl', {
    action: actionFilter || undefined,
    since: sinceIso,
  })

  return (
    <div>
      <PageHeader
        eyebrow="Security Governance · Append-Only Trail"
        title="操作审计日志"
        description="所有关键安全操作（扫描、提交 Flag、策略变更、凭据与工具配置）由服务端只追加记录并自动脱敏，支持合规取证导出。"
        actions={
          <>
            <a href={csvUrl} target="_blank" rel="noreferrer">
              <Button variant="secondary" size="sm">
                <Download className="h-3.5 w-3.5" />
                导出 CSV
              </Button>
            </a>
            <a href={jsonlUrl} target="_blank" rel="noreferrer">
              <Button variant="secondary" size="sm">
                <Download className="h-3.5 w-3.5" />
                导出 JSONL
              </Button>
            </a>
            <Button variant="primary" size="sm" onClick={() => void loadPage(null)}>
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </Button>
          </>
        }
      />

      {/* Filter Bar */}
      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <Select
              className="min-w-[220px]"
              value={actionFilter}
              onChange={setActionFilter}
              options={ACTION_OPTIONS}
            />
            <Select
              className="min-w-[130px]"
              value={timeWindow}
              onChange={setTimeWindow}
              options={WINDOW_OPTIONS}
            />
            <form onSubmit={handleSearchActor} className="flex items-center gap-1.5">
              <Input
                value={actorInput}
                onChange={(e) => setActorInput(e.target.value)}
                placeholder="按操作者筛选…"
                className="h-9 w-44 text-xs"
              />
              <Button type="submit" size="sm" variant="secondary">
                <Search className="h-3.5 w-3.5" />
                检索
              </Button>
            </form>
            {(actionFilter || actorQuery || timeWindow !== 'all') && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setActionFilter('')
                  setActorInput('')
                  setActorQuery('')
                  setTimeWindow('all')
                }}
              >
                重置
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>
              全库共 <strong className="font-mono text-ink">{total}</strong> 条 · 保留期{' '}
              <strong className="font-mono text-ink">{retentionDays}</strong> 天
            </span>
          </div>
        </div>
      </Card>

      {/* Audit Entries */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<ScrollText className="h-5 w-5" />}
              title="暂无匹配的审计记录"
              description="当平台执行扫描发起、Flag 提交、策略修改、工具/技能变更等有后果操作时，将自动记录在此。"
            />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {entries.map((entry) => {
              const hasDetail = Boolean(entry.detail && Object.keys(entry.detail).length > 0)
              const expanded = Boolean(expandedIds[entry.id])
              return (
                <div key={entry.id} className="px-5 py-3.5 transition-colors hover:bg-subtle/40">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={cn('text-[11px]', actionBadgeCls(entry.action))}>
                          {entry.actionLabel || entry.action}
                        </Badge>
                        <span className="font-mono text-[10px] text-ink-muted">{entry.action}</span>
                        {entry.target && (
                          <span className="max-w-[260px] truncate rounded bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-ink-secondary">
                            目标：{entry.target}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs font-medium text-ink">{entry.summary}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {entry.actorLabel} ({entry.actorKind})
                        </span>
                        {entry.ip && <span className="font-mono">IP: {entry.ip}</span>}
                        <span className="font-mono" title={entry.at}>
                          {formatRelativeTime(entry.at)} · {new Date(entry.at).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {hasDetail && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleExpand(entry.id)}
                        className="shrink-0 text-[11px]"
                      >
                        {expanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                        详情
                      </Button>
                    )}
                  </div>

                  {hasDetail && expanded && (
                    <pre className="mt-2.5 max-h-60 overflow-auto rounded-lg border border-line bg-subtle/80 p-3 font-mono text-[11px] leading-relaxed text-ink-secondary">
                      {JSON.stringify(entry.detail, null, 2)}
                    </pre>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {nextCursor && (
          <div className="flex justify-center border-t border-line bg-subtle/30 p-3.5">
            <Button
              size="sm"
              variant="secondary"
              loading={loadingMore}
              onClick={() => void loadPage(nextCursor)}
            >
              加载更多历史记录
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
