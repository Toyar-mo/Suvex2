import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Cpu,
  Flag,
  MessagesSquare,
  Plus,
  RefreshCw,
  ScanSearch,
  ShieldAlert,
} from 'lucide-react'
import { api } from '@/lib/api'
import {
  formatCompactNumber,
  formatDuration,
  formatRelativeTime,
  SCAN_STATUS_META,
  SEVERITY_META,
} from '@/lib/format'
import type { OverviewOut, ScanOut, ScanStatsOut, Severity } from '@/types/api'
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info']

export function OverviewPage() {
  const [overview, setOverview] = useState<OverviewOut | null>(null)
  const [scans, setScans] = useState<ScanOut[]>([])
  const [queue, setQueue] = useState<ScanStatsOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const [ov, sc, q] = await Promise.all([
        api.getOverview(),
        api.listScans({ sort: 'recent', dir: 'desc' }),
        api.getScanQueue().catch(() => null),
      ])
      setOverview(ov)
      setScans(sc.slice(0, 6))
      setQueue(q)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(true), 15000)
    return () => window.clearInterval(timer)
  }, [load])

  const metrics = overview?.metrics
  const breakdownMap = new Map(
    (overview?.severityBreakdown || []).map((b) => [b.severity, b.count]),
  )
  const totalSeverity = Array.from(breakdownMap.values()).reduce((a, b) => a + b, 0)

  return (
    <div>
      <PageHeader
        eyebrow="Operations Briefing"
        title="全局态势总览"
        description="优先呈现正在执行的智能体行为流与待研判风险，随后列出累积统计与运行资源。"
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              loading={refreshing}
              onClick={() => void load(true)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </Button>
            <Link to="/chat?new=1">
              <Button variant="secondary" size="sm">
                <MessagesSquare className="h-3.5 w-3.5" />
                新建对话
              </Button>
            </Link>
            <Link to="/scans?new=1">
              <Button variant="primary" size="sm">
                <Plus className="h-3.5 w-3.5" />
                发起扫描
              </Button>
            </Link>
          </>
        }
      />

      {/* Live Queue & Runner Status Strip */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-editorial border border-line bg-surface px-4 py-3 shadow-editorial">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Badge
            pulse={Boolean(metrics && metrics.activeScans > 0)}
            className={
              metrics && metrics.activeScans > 0
                ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300'
                : 'border-line bg-subtle text-ink-secondary'
            }
          >
            {metrics?.activeScans || 0} 个任务运行中
          </Badge>
          {queue && (
            <>
              <span className="text-ink-muted">·</span>
              <span className="tabular-nums text-ink-secondary">
                并发槽位 <strong className="text-ink">{queue.running}/{queue.limit}</strong>（排队 {queue.queued}）
              </span>
              <span className="text-ink-muted">·</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5',
                  queue.runnerReady
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400',
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    queue.runnerReady ? 'bg-emerald-500' : 'bg-amber-500',
                  )}
                />
                执行器 {queue.runner} {queue.runnerReady ? '就绪' : '未就绪'}
              </span>
            </>
          )}
        </div>
        <Link
          to="/activity"
          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          进入实时事件流
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Section 1: Process First — Live Activity + Risk & Attention */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="flex flex-col overflow-hidden lg:col-span-7">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-ink">最新智能体活动流</h2>
            </div>
            <Link to="/activity" className="text-xs text-ink-muted hover:text-ink">
              查看全部 →
            </Link>
          </div>

          <div className="flex-1 divide-y divide-line">
            {loading ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !overview || overview.activity.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Activity className="h-4 w-4" />}
                  title="当前暂无智能体活动事件"
                  description="发起一次扫描或在对话工作台指派任务后，智能体的每一步推理与工具调用都会实时呈现在这里。"
                  action={
                    <Link to="/scans?new=1">
                      <Button variant="primary" size="sm">
                        发起第一次扫描
                      </Button>
                    </Link>
                  }
                />
              </div>
            ) : (
              overview.activity.slice(0, 8).map((ev) => (
                <Link
                  key={ev.id}
                  to={`/activity?scan=${encodeURIComponent(ev.scanId)}`}
                  className="flex items-start justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-subtle/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-subtle px-1.5 py-0.5 font-mono text-[10px] font-medium text-ink-secondary">
                        {ev.agentPhase}
                      </span>
                      <span className="font-mono text-[11px] text-ink-muted">{ev.agentId}</span>
                      {ev.subject && (
                        <span className="truncate font-mono text-[11px] text-accent">
                          {ev.subject}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink">
                      {ev.summary}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-muted">
                    {formatRelativeTime(ev.at)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </Card>

        {/* Risk & Attention Side Column */}
        <div className="space-y-6 lg:col-span-5">
          <Card className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-muted">
                  Risk Posture
                </p>
                <div className="mt-1 flex items-baseline gap-2.5">
                  <span className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-ink">
                    {metrics ? metrics.riskScore.toFixed(1) : '0.0'}
                  </span>
                  <span className="text-xs text-ink-secondary">
                    综合风险指数 · {metrics?.riskLevel || 'low'}
                  </span>
                </div>
              </div>
              <Link to="/findings" className="text-xs font-medium text-accent hover:underline">
                处置漏洞 →
              </Link>
            </div>

            <div className="mt-5 space-y-2.5">
              {SEVERITIES.map((sev) => {
                const count = breakdownMap.get(sev) || 0
                const pct = totalSeverity > 0 ? Math.round((count / totalSeverity) * 100) : 0
                const meta = SEVERITY_META[sev]
                return (
                  <div key={sev} className="flex items-center gap-3 text-xs">
                    <span className="flex w-12 items-center gap-1.5 text-ink-secondary">
                      <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
                      {meta.label}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle">
                      <div
                        className={cn('h-full rounded-full transition-all', meta.dot)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-mono tabular-nums text-ink">{count}</span>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h2 className="text-sm font-semibold text-ink">需要关注</h2>
              </div>
              <span className="font-mono text-xs text-ink-muted">
                {overview?.attention.length || 0}
              </span>
            </div>
            <div className="divide-y divide-line">
              {!overview || overview.attention.length === 0 ? (
                <p className="px-5 py-6 text-center text-xs text-ink-muted">
                  暂无待处理告警或异常配置
                </p>
              ) : (
                overview.attention.map((item, idx) => (
                  <div key={`${item.kind}-${idx}`} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-ink">{item.title}</span>
                      {item.count > 0 && (
                        <Badge className="font-mono tabular-nums">{item.count}</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-secondary">{item.detail}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Section 2: Accumulated KPI Strip (explicitly below live activity) */}
      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'PoC 确证漏洞',
            value: metrics ? String(metrics.verifiedPocCount) : '0',
            sub: `未解决总计 ${metrics?.unresolvedTotal ?? 0} 条`,
            icon: ShieldAlert,
          },
          {
            label: '本周新增高危',
            value: metrics ? String(metrics.newHighSeverityThisWeek) : '0',
            sub: `误报排除 ${metrics?.falsePositiveCount ?? 0} 条`,
            icon: ScanSearch,
          },
          {
            label: '平均扫描耗时',
            value: metrics?.avgScanDurationSec != null ? formatDuration(metrics.avgScanDurationSec) : '—',
            sub: overview?.hasAnyScan ? '含完整沙箱验证周期' : '尚未完成首次扫描',
            icon: Activity,
          },
          {
            label: 'CTF 模型消耗',
            value: metrics ? formatCompactNumber(metrics.ctf2TotalTokens) : '0',
            sub: `累计 ${metrics?.ctf2LlmCalls ?? 0} 次推理调用`,
            icon: Flag,
          },
        ].map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label} className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-secondary">{kpi.label}</span>
                <Icon className="h-3.5 w-3.5 text-ink-muted" />
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight text-ink">
                {kpi.value}
              </div>
              <p className="mt-1 text-[11px] text-ink-muted">{kpi.sub}</p>
            </Card>
          )
        })}
      </section>

      {/* Section 3: Recent Scans + Platform Resources */}
      <section className="mt-7 grid gap-6 lg:grid-cols-12">
        <Card className="overflow-hidden lg:col-span-8">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-sm font-semibold text-ink">近期扫描任务</h2>
            <Link to="/scans" className="text-xs text-ink-muted hover:text-ink">
              全部任务 →
            </Link>
          </div>
          {scans.length === 0 ? (
            <div className="p-6 text-center text-xs text-ink-muted">
              还没有扫描记录。点击右上角「发起扫描」开始首次评估。
            </div>
          ) : (
            <div className="divide-y divide-line">
              {scans.map((scan) => {
                const st = SCAN_STATUS_META[scan.status] || SCAN_STATUS_META.queued
                const totalF = Object.values(scan.findings || {}).reduce((a, b) => a + (b || 0), 0)
                return (
                  <Link
                    key={scan.id}
                    to={`/scans?id=${encodeURIComponent(scan.id)}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-subtle/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-ink">
                          {scan.name || scan.target || scan.id}
                        </span>
                        <Badge pulse={st.pulse} className={st.badge}>
                          {st.label}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-ink-muted">
                        {scan.target || '纯附件任务'} · {formatRelativeTime(scan.startedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-right font-mono text-xs tabular-nums">
                      <span className="text-ink-secondary">{formatDuration(scan.durationSec)}</span>
                      <span className="text-ink">{totalF} 发现</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden lg:col-span-4">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-ink-muted" />
              <h2 className="text-sm font-semibold text-ink">平台资源</h2>
            </div>
            <Link to="/models" className="text-xs text-accent hover:underline">
              配置模型
            </Link>
          </div>
          <div className="divide-y divide-line">
            {!overview || overview.resources.length === 0 ? (
              <div className="p-5 text-xs text-ink-muted">
                请先在「模型接入」中配置至少一个可用的大模型 Provider。
              </div>
            ) : (
              overview.resources.map((r) => (
                <div key={r.kind} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="text-xs font-medium text-ink">{r.label}</div>
                    <div className="text-[11px] text-ink-muted">{r.detail}</div>
                  </div>
                  <span className="font-mono text-sm font-semibold tabular-nums text-ink">
                    {r.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>
    </div>
  )
}
