import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Box,
  Cpu,
  Flag,
  GitBranch,
  MessagesSquare,
  Plus,
  Radio,
  RefreshCw,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
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
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-ink">实时智能体活动流</h2>
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
            ) : liveActivity.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Activity className="h-4 w-4" />}
                  title="当前暂无智能体活动事件"
                  description="发起一次扫描或在对话工作台指派任务后，智能体的每一步推理与工具调用都会通过异步 EventBus 实时推送到这里。"
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
              liveActivity.slice(0, 8).map((ev) => (
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
