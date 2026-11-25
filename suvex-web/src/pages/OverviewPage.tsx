import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Box,
  CheckCircle2,
  Compass,
  Cpu,
  Flag,
  Flame,
  GitBranch,
  MessagesSquare,
  Plus,
  Radio,
  RefreshCw,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wrench,
  XCircle,
} from 'lucide-react'
import { api } from '@/lib/api'
import {
  formatCompactNumber,
  formatDuration,
  formatRelativeTime,
  SCAN_STATUS_META,
  SEVERITY_META,
} from '@/lib/format'
import type {
  OverviewOut,
  ProjectedActivity,
  QualityOut,
  ScanOut,
  ScanStatsOut,
  Severity,
  SystemTelemetryOut,
  TokenUsageTrendOut,
} from '@/types/api'
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info']

const OVERVIEW_PHASE_LABEL: Record<string, string> = {
  recon: '侦察',
  scan: '探测',
  exploit: '利用',
  verify: '验证',
  report: '报告',
}

interface FeedVisual {
  label: string
  group: 'tool' | 'finding' | 'alert' | 'other'
  nodeCls: string
  badgeCls: string
  icon: 'tool' | 'reasoning' | 'discovery' | 'poc' | 'verified' | 'blocked' | 'failed'
}

function feedVisualFor(type: string): FeedVisual {
  switch (type.toLowerCase()) {
    case 'tool_call':
      return {
        label: '工具执行',
        group: 'tool',
        nodeCls: 'border-indigo-400/40 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400',
        badgeCls:
          'border-indigo-300/60 bg-indigo-50/70 text-indigo-700 dark:border-indigo-800/70 dark:bg-indigo-950/60 dark:text-indigo-300',
        icon: 'tool',
      }
    case 'reasoning':
      return {
        label: '推理思考',
        group: 'other',
        nodeCls: 'border-violet-400/40 bg-violet-500/10 text-violet-500 dark:text-violet-400',
        badgeCls:
          'border-violet-300/60 bg-violet-50/70 text-violet-700 dark:border-violet-800/70 dark:bg-violet-950/60 dark:text-violet-300',
        icon: 'reasoning',
      }
    case 'discovery':
      return {
        label: '新发现',
        group: 'finding',
        nodeCls: 'border-sky-400/40 bg-sky-500/10 text-sky-500 dark:text-sky-400',
        badgeCls:
          'border-sky-300/60 bg-sky-50/70 text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/60 dark:text-sky-300',
        icon: 'discovery',
      }
    case 'poc_generated':
      return {
        label: '候选产物',
        group: 'finding',
        nodeCls: 'border-amber-400/40 bg-amber-500/10 text-amber-500 dark:text-amber-400',
        badgeCls:
          'border-amber-300/70 bg-amber-50/70 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-300',
        icon: 'poc',
      }
    case 'verified':
    case 'completed':
      return {
        label: type.toLowerCase() === 'verified' ? '已确证' : '任务完成',
        group: 'finding',
        nodeCls: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400',
        badgeCls:
          'border-emerald-300/70 bg-emerald-50/70 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-300',
        icon: 'verified',
      }
    case 'blocked':
      return {
        label: '受阻重试',
        group: 'alert',
        nodeCls: 'border-amber-400/40 bg-amber-500/10 text-amber-500 dark:text-amber-400',
        badgeCls:
          'border-amber-300/70 bg-amber-50/70 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-300',
        icon: 'blocked',
      }
    case 'failed':
      return {
        label: '执行异常',
        group: 'alert',
        nodeCls: 'border-red-400/40 bg-red-500/10 text-red-500 dark:text-red-400',
        badgeCls:
          'border-red-300/70 bg-red-50/70 text-red-700 dark:border-red-900/70 dark:bg-red-950/60 dark:text-red-300',
        icon: 'failed',
      }
    default:
      return {
        label: type || '事件',
        group: 'other',
        nodeCls: 'border-line bg-subtle text-ink-muted',
        badgeCls: 'border-line bg-subtle text-ink-secondary',
        icon: 'discovery',
      }
  }
}

function FeedNodeIcon({ kind }: { kind: FeedVisual['icon'] }) {
  const cls = 'h-3.5 w-3.5'
  switch (kind) {
    case 'tool':
      return <Terminal className={cls} />
    case 'reasoning':
      return <Sparkles className={cls} />
    case 'discovery':
      return <Compass className={cls} />
    case 'poc':
      return <Flame className={cls} />
    case 'verified':
      return <CheckCircle2 className={cls} />
    case 'blocked':
      return <ShieldAlert className={cls} />
    case 'failed':
      return <XCircle className={cls} />
    default:
      return <Wrench className={cls} />
  }
}

function formatOverviewAgent(agentId: string): string {
  const suffix = agentId.includes(':') ? agentId.split(':').slice(1).join(':') : agentId
  if (suffix === 'ctf2-solver') return 'CTF2 解题智能体'
  if (suffix.startsWith('agent-')) return `协作节点 ${suffix.slice(6)}`
  return suffix.length > 22 ? `${suffix.slice(0, 12)}…${suffix.slice(-6)}` : suffix || '智能体'
}

function parseProjectedRow(ev: ProjectedActivity): {
  toolName: string | null
  text: string
  extraSubject: string | null
} {
  let text = (ev.summary || '').trim()
  text = text.replace(/[\s…]*[（(]已截断[，,]?\s*原长\s*\d+\s*字符[）)]\s*$/, '').trim()
  text = text.replace(/[\s…]*[（(]已截断[，,]?\s*…*$/, '…').trim()

  let toolName: string | null = null
  if (ev.type.toLowerCase() === 'tool_call') {
    const m = text.match(/^([a-zA-Z0-9_.-]{2,40})\s+([\s\S]+)$/)
    if (m) {
      toolName = m[1]
      text = m[2].trim()
    }
  }

  const subj = (ev.subject || '').trim()
  const extraSubject =
    subj &&
    !text.includes(subj.slice(0, Math.min(24, subj.length))) &&
    subj !== toolName
      ? subj
      : null

  return { toolName, text: text || ev.type, extraSubject }
}

function TokenTrendChart({
  trend,
  days,
  onDaysChange,
}: {
  trend: TokenUsageTrendOut | null
  days: number
  onDaysChange: (d: number) => void
}) {
  const series = trend?.series || []
  const maxVal = Math.max(1, ...series.map((s) => s.total))

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-ink">模型 Token 用量趋势</h2>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-line bg-subtle p-0.5 text-[11px]">
          {[7, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onDaysChange(d)}
              className={cn(
                'rounded-md px-2 py-0.5 font-mono transition-colors',
                days === d ? 'bg-surface font-medium text-ink shadow-editorial' : 'text-ink-muted',
              )}
            >
              {d}天
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-4 text-xs">
        <span className="font-mono text-xl font-semibold tabular-nums text-ink">
          {trend ? formatCompactNumber(trend.totals.total) : '0'}
        </span>
        <span className="font-mono text-[11px] text-ink-muted">
          Prompt {trend ? formatCompactNumber(trend.totals.prompt) : 0} · Completion{' '}
          {trend ? formatCompactNumber(trend.totals.completion) : 0} · {trend?.totals.calls ?? 0} 次调用
        </span>
      </div>

      <div className="mt-4 flex h-28 items-end gap-1">
        {series.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center text-xs text-ink-muted">
            暂无用量序列
          </div>
        ) : (
          series.map((pt) => {
            const h = pt.total > 0 ? Math.max(8, Math.round((pt.total / maxVal) * 100)) : 3
            return (
              <div
                key={pt.date}
                className="group relative flex h-full flex-1 flex-col justify-end"
                title={`${pt.date}: ${pt.total.toLocaleString()} tokens (${pt.calls} calls)`}
              >
                <div
                  className={cn(
                    'w-full rounded-t transition-all',
                    pt.total > 0
                      ? 'bg-accent/80 group-hover:bg-accent'
                      : 'bg-line/70 group-hover:bg-line-strong',
                  )}
                  style={{ height: `${h}%` }}
                />
              </div>
            )
          })
        )}
      </div>
      {series.length > 0 && (
        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-ink-muted">
          <span>{series[0]?.date.slice(5)}</span>
          <span>{series[Math.floor(series.length / 2)]?.date.slice(5)}</span>
          <span>{series[series.length - 1]?.date.slice(5)}</span>
        </div>
      )}
    </Card>
  )
}

export function OverviewPage() {
  const [overview, setOverview] = useState<OverviewOut | null>(null)
  const [quality, setQuality] = useState<QualityOut | null>(null)
  const [telemetry, setTelemetry] = useState<SystemTelemetryOut | null>(null)
  const [tokenDays, setTokenDays] = useState(7)
  const [tokenTrend, setTokenTrend] = useState<TokenUsageTrendOut | null>(null)
  const [scans, setScans] = useState<ScanOut[]>([])
  const [queue, setQueue] = useState<ScanStatsOut | null>(null)
  const [liveActivity, setLiveActivity] = useState<ProjectedActivity[]>([])
  const [feedFilter, setFeedFilter] = useState<'all' | 'tool' | 'finding' | 'alert'>('all')
  const [sseLive, setSseLive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const [ov, sc, q, qual, tel] = await Promise.all([
        api.getOverview(),
        api.listScans({ sort: 'recent', dir: 'desc' }),
        api.getScanQueue().catch(() => null),
        api.getOverviewQuality().catch(() => null),
        api.getSystemTelemetry().catch(() => null),
      ])
      setOverview(ov)
      setLiveActivity(ov.activity)
      setScans(sc.slice(0, 6))
      setQueue(q)
      setQuality(qual)
      setTelemetry(tel)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(true), 20000)
    return () => window.clearInterval(timer)
  }, [load])

  useEffect(() => {
    api
      .getOverviewTokenUsage(tokenDays)
      .then(setTokenTrend)
      .catch(() => {})
  }, [tokenDays])

  // Real-time SSE live activity subscription via Suvex 2.1 Async EventBus
  useEffect(() => {
    const es = api.createActivityStream(null)
    es.onopen = () => setSseLive(true)
    es.onerror = () => setSseLive(false)
    es.addEventListener('activity', (ev) => {
      const parsed = api.parseActivityEvent((ev as MessageEvent).data)
      if (!parsed) return
      const projected: ProjectedActivity = {
        id: parsed.id,
        scanId: parsed.scanId,
        agentId: parsed.agentId,
        agentPhase: parsed.agentPhase,
        type: parsed.type,
        summary: parsed.summary,
        subject: null,
        at: parsed.at,
      }
      setLiveActivity((prev) => {
        if (prev.some((x) => x.id === projected.id)) return prev
        return [projected, ...prev].slice(0, 12)
      })
    })
    return () => es.close()
  }, [])

  const scanNameMap = useMemo(
    () => new Map(scans.map((s) => [s.id, s.name || s.target || s.id])),
    [scans],
  )

  const filteredFeed = useMemo(() => {
    if (feedFilter === 'all') return liveActivity
    return liveActivity.filter((ev) => feedVisualFor(ev.type).group === feedFilter)
  }, [liveActivity, feedFilter])

  const metrics = overview?.metrics
  const breakdownMap = new Map(
    (overview?.severityBreakdown || []).map((b) => [b.severity, b.count]),
  )
  const totalSeverity = Array.from(breakdownMap.values()).reduce((a, b) => a + b, 0)
  const verifiedPct =
    quality && quality.findings.total > 0
      ? Math.round((quality.findings.verified / quality.findings.total) * 100)
      : null
  const fpPct =
    quality?.findings.falsePositiveRate != null
      ? Math.round(quality.findings.falsePositiveRate * 100)
      : null

  return (
    <div>
      <PageHeader
        eyebrow="Operations Briefing · Suvex 2.1"
        title="全局态势总览"
        description="基于异步事件总线（EventBus）实时推送智能体行为流，汇聚风险态势、质量评分卡与系统遥测。"
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
            <Link to="/missions">
              <Button variant="secondary" size="sm">
                <GitBranch className="h-3.5 w-3.5" />
                作战图
              </Button>
            </Link>
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

      {/* Live System Telemetry Strip */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-editorial border border-line bg-surface px-4 py-3 shadow-editorial">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Badge
            pulse={sseLive}
            className={
              sseLive
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'border-line bg-subtle text-ink-secondary'
            }
          >
            <Radio className="h-3 w-3" />
            {sseLive ? 'EventBus 实时推送' : '连接事件总线…'}
          </Badge>

          <span className="tabular-nums text-ink-secondary">
            运行中扫描 <strong className="text-ink">{metrics?.activeScans || 0}</strong>
            {queue ? ` / 并发 ${queue.limit}（排队 ${queue.queued}）` : ''}
          </span>

          {telemetry && (
            <>
              <span className="text-ink-muted">·</span>
              <span className="inline-flex items-center gap-1 tabular-nums text-ink-secondary">
                <Box className="h-3.5 w-3.5 text-ink-muted" />
                沙箱容器 <strong className="text-ink">{telemetry.sandboxes.sandboxCount}</strong>
              </span>
              <span className="text-ink-muted">·</span>
              <span className="tabular-nums text-ink-secondary">
                模型就绪{' '}
                <strong className="text-ink">
                  {telemetry.providers.verified}/{telemetry.providers.total}
                </strong>
              </span>
              <span className="text-ink-muted">·</span>
              <span className="font-mono text-[11px] text-ink-muted">
                订阅者 {telemetry.eventBus.activeSubscribers} · 运行{' '}
                {formatDuration(telemetry.uptimeSeconds)}
              </span>
            </>
          )}
        </div>

        <Link
          to="/activity"
          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          进入全屏活动流
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Section 1: Process First — Live Activity + Risk & Attention */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="flex flex-col overflow-hidden lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Activity className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-sm font-semibold text-ink">实时智能体活动流</h2>
              {sseLive && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/60 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:border-emerald-800/70 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  实时
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 rounded-lg border border-line bg-subtle p-0.5 text-[11px]">
                {(
                  [
                    { id: 'all', label: '全部' },
                    { id: 'tool', label: '工具' },
                    { id: 'finding', label: '发现' },
                    { id: 'alert', label: '异常' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFeedFilter(tab.id)}
                    className={cn(
                      'rounded-md px-2 py-0.5 font-medium transition-colors',
                      feedFilter === tab.id
                        ? 'bg-surface text-ink shadow-editorial'
                        : 'text-ink-muted hover:text-ink',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <Link
                to="/activity"
                className="inline-flex items-center gap-0.5 text-xs font-medium text-ink-muted transition-colors hover:text-accent"
              >
                全部
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="max-h-[540px] flex-1 overflow-y-auto px-5 py-3">
            {loading ? (
              <div className="space-y-3 py-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : filteredFeed.length === 0 ? (
              <div className="py-6">
                <EmptyState
                  icon={<Activity className="h-4 w-4" />}
                  title={
                    liveActivity.length > 0
                      ? '当前分类暂无事件'
                      : '当前暂无智能体活动事件'
                  }
                  description={
                    liveActivity.length > 0
                      ? '可切换回「全部」查看全部实时执行轨迹。'
                      : '发起一次扫描或在对话工作台指派任务后，智能体的每一步推理与工具调用都会通过异步 EventBus 实时推送到这里。'
                  }
                  action={
                    liveActivity.length > 0 ? (
                      <Button variant="secondary" size="sm" onClick={() => setFeedFilter('all')}>
                        查看全部事件
                      </Button>
                    ) : (
                      <Link to="/scans?new=1">
                        <Button variant="primary" size="sm">
                          发起第一次扫描
                        </Button>
                      </Link>
                    )
                  }
                />
              </div>
            ) : (
              <div className="relative space-y-2.5">
                {filteredFeed.slice(0, 10).map((ev, idx, arr) => {
                  const vis = feedVisualFor(ev.type)
                  const phaseLabel =
                    OVERVIEW_PHASE_LABEL[ev.agentPhase.toLowerCase()] || ev.agentPhase
                  const scanTitle = scanNameMap.get(ev.scanId)
                  const agentLabel = formatOverviewAgent(ev.agentId)
                  const parsed = parseProjectedRow(ev)
                  const isTool = ev.type.toLowerCase() === 'tool_call'
                  const isLast = idx === arr.length - 1

                  return (
                    <Link
                      key={ev.id}
                      to={`/activity?scan=${encodeURIComponent(ev.scanId)}`}
                      className="group relative flex items-start gap-3 rounded-xl border border-transparent p-2.5 transition-all hover:border-line hover:bg-subtle/70"
                    >
                      {/* Vertical Timeline Rail + Node */}
                      <div className="relative flex shrink-0 flex-col items-center">
                        <div
                          className={cn(
                            'z-10 flex h-7 w-7 items-center justify-center rounded-lg border',
                            vis.nodeCls,
                          )}
                        >
                          <FeedNodeIcon kind={vis.icon} />
                        </div>
                        {!isLast && (
                          <span className="mt-1 h-full min-h-[24px] w-px bg-line-subtle" />
                        )}
                      </div>

                      {/* Event Body */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <Badge className={cn('text-[10px]', vis.badgeCls)}>
                              {vis.label}
                            </Badge>
                            <span className="rounded-md border border-line-subtle bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-ink-secondary">
                              {phaseLabel}
                            </span>
                            {parsed.toolName && (
                              <span className="rounded-md bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-ink">
                                {parsed.toolName}
                              </span>
                            )}
                            <span
                              className="truncate text-[11px] text-ink-muted"
                              title={scanTitle || ev.agentId}
                            >
                              {scanTitle || agentLabel}
                            </span>
                          </div>

                          <div className="flex shrink-0 items-center gap-1 font-mono text-[11px] tabular-nums text-ink-muted">
                            <span>{formatRelativeTime(ev.at)}</span>
                            <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                          </div>
                        </div>

                        {parsed.extraSubject && (
                          <p className="mt-1 truncate text-[11px] font-medium text-accent">
                            {parsed.extraSubject}
                          </p>
                        )}

                        {isTool ? (
                          <div className="mt-1.5 rounded-lg border border-line-subtle bg-canvas/80 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-ink-secondary">
                            <p className="line-clamp-2 break-all">
                              <span className="mr-1.5 select-none text-accent">$</span>
                              {parsed.text}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink">
                            {parsed.text}
                          </p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
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

      {/* Section 2: Token Trend + Quality Scorecard */}
      <section className="mt-7 grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <TokenTrendChart trend={tokenTrend} days={tokenDays} onDaysChange={setTokenDays} />
        </div>

        <Card className="p-5 lg:col-span-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-ink">智能体质量评分卡</h2>
            </div>
            <span className="font-mono text-[11px] text-ink-muted">
              覆盖面 {quality?.coverage.surfaces ?? 0}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-line bg-subtle p-3">
              <p className="text-ink-muted">PoC 确证率</p>
              <p className="mt-1 font-mono text-xl font-semibold text-ink">
                {verifiedPct != null ? `${verifiedPct}%` : '—'}
              </p>
              <p className="mt-0.5 text-[10px] text-ink-muted">
                确证 {quality?.findings.verified ?? 0} / 总计 {quality?.findings.total ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-line bg-subtle p-3">
              <p className="text-ink-muted">误报率</p>
              <p className="mt-1 font-mono text-xl font-semibold text-ink">
                {fpPct != null ? `${fpPct}%` : '—'}
              </p>
              <p className="mt-0.5 text-[10px] text-ink-muted">
                已排除误报 {quality?.findings.falsePositive ?? 0} 条
              </p>
            </div>
            <div className="rounded-lg border border-line bg-subtle p-3">
              <p className="text-ink-muted">扫描完结率</p>
              <p className="mt-1 font-mono text-xl font-semibold text-ink">
                {quality && quality.scans.total > 0
                  ? `${Math.round((quality.scans.completed / quality.scans.total) * 100)}%`
                  : '—'}
              </p>
              <p className="mt-0.5 text-[10px] text-ink-muted">
                完成 {quality?.scans.completed ?? 0} · 失败 {quality?.scans.failed ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-line bg-subtle p-3">
              <p className="text-ink-muted">CTF 解题率</p>
              <p className="mt-1 font-mono text-xl font-semibold text-ink">
                {quality?.challenges.solveRate != null
                  ? `${Math.round(quality.challenges.solveRate * 100)}%`
                  : '—'}
              </p>
              <p className="mt-0.5 text-[10px] text-ink-muted">
                已解 {quality?.challenges.solved ?? 0} / {quality?.challenges.total ?? 0} 题
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* Section 3: Accumulated KPI Strip */}
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
            value:
              metrics?.avgScanDurationSec != null ? formatDuration(metrics.avgScanDurationSec) : '—',
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

      {/* Section 4: Recent Scans + Platform Resources */}
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
