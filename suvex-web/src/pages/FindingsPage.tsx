import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Check,
  Copy,
  Download,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Terminal,
} from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import {
  FINDING_STATUS_META,
  formatRelativeTime,
  SEVERITY_META,
  VERIFICATION_META,
} from '@/lib/format'
import type {
  FindingOut,
  FindingStatsOut,
  FindingStatus,
  FindingSummaryOut,
  RemediationOut,
  Severity,
} from '@/types/api'
import {
  Badge,
  Button,
  Card,
  Drawer,
  EmptyState,
  Input,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info']
const STATUSES: FindingStatus[] = ['new', 'confirmed', 'fixed', 'closed', 'false_positive']

export function FindingsPage() {
  const [searchParams] = useSearchParams()
  const { push } = useToast()

  const [items, setItems] = useState<FindingSummaryOut[]>([])
  const [stats, setStats] = useState<FindingStatsOut | null>(null)
  const [loading, setLoading] = useState(true)

  const [severity, setSeverity] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [query, setQuery] = useState('')
  const scanId = searchParams.get('scanId') || undefined

  const [detail, setDetail] = useState<FindingOut | null>(null)
  const [remediation, setRemediation] = useState<RemediationOut | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [statusNote, setStatusNote] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [copiedPoc, setCopiedPoc] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        severity: severity || undefined,
        status: status || undefined,
        q: query.trim() || undefined,
        scanId,
      }
      const [list, st] = await Promise.all([
        api.listFindings(params),
        api.getFindingStats({ scanId }).catch(() => null),
      ])
      setItems(list)
      setStats(st)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载漏洞列表失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [push, query, scanId, severity, status])

  useEffect(() => {
    void load()
  }, [load])

  const openDetail = async (id: string) => {
    setLoadingDetail(true)
    setRemediation(null)
    setStatusNote('')
    try {
      const [f, rem] = await Promise.all([
        api.getFinding(id),
        api.getFindingRemediation(id).catch(() => null),
      ])
      setDetail(f)
      setRemediation(rem)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载漏洞详情失败', 'error')
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleTransition = async (nextStatus: FindingStatus) => {
    if (!detail) return
    setUpdatingStatus(true)
    try {
      await api.updateFindingsStatus([detail.id], nextStatus, statusNote.trim() || undefined)
      push(`状态已更新为「${FINDING_STATUS_META[nextStatus].label}」`, 'success')
      setStatusNote('')
      await Promise.all([load(), openDetail(detail.id)])
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '更新状态失败', 'error')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const copyPoc = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedPoc(true)
      window.setTimeout(() => setCopiedPoc(false), 1800)
    } catch {
      push('复制失败，请手动选中复制', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Vulnerability Triage"
        title="漏洞发现与处置"
        description="证据强度（PoC 确证 / 启发式线索）与人工处置流转严格分离，支持 SARIF 2.1.0 与 JSON 导出。"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </Button>
            <a
              href={api.getFindingsExportUrl('sarif', { scanId, severity: severity || undefined, status: status || undefined })}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="secondary" size="sm">
                <Download className="h-3.5 w-3.5" />
                导出 SARIF
              </Button>
            </a>
            <a
              href={api.getFindingsExportUrl('json', { scanId, severity: severity || undefined, status: status || undefined })}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="secondary" size="sm">
                <Download className="h-3.5 w-3.5" />
                导出 JSON
              </Button>
            </a>
          </>
        }
      />

      {/* Severity Summary Strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {SEVERITIES.map((sev) => {
          const meta = SEVERITY_META[sev]
          const count = stats?.bySeverity?.[sev] ?? 0
          const active = severity === sev
          return (
            <button
              key={sev}
              type="button"
              onClick={() => setSeverity(active ? '' : sev)}
              className={cn(
                'flex items-center justify-between rounded-editorial border bg-surface px-4 py-3 text-left shadow-editorial transition-colors',
                active ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-line-strong',
              )}
            >
              <span className="flex items-center gap-2 text-xs font-medium text-ink-secondary">
                <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
                {meta.label}
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums text-ink">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Filter Bar */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatus('')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium',
              status === ''
                ? 'bg-ink text-canvas'
                : 'border border-line bg-surface text-ink-secondary hover:bg-subtle',
            )}
          >
            全部状态
          </button>
          {STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatus(status === st ? '' : st)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium',
                status === st
                  ? 'bg-ink text-canvas'
                  : 'border border-line bg-surface text-ink-secondary hover:bg-subtle',
              )}
            >
              {FINDING_STATUS_META[st].label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索标题或目标..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Findings Ledger */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<ShieldAlert className="h-5 w-5" />}
              title="暂无匹配的漏洞记录"
              description="当智能体在扫描任务中确认漏洞或发现启发式线索后，会按严重度与验证等级汇总于此。"
            />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {items.map((item) => {
              const sev = SEVERITY_META[item.severity] || SEVERITY_META.info
              const st = FINDING_STATUS_META[item.status] || FINDING_STATUS_META.new
              const ver = VERIFICATION_META[item.verification] || VERIFICATION_META.none
              return (
                <div
                  key={item.id}
                  onClick={() => void openDetail(item.id)}
                  className="flex cursor-pointer flex-col gap-2.5 px-5 py-4 transition-colors hover:bg-subtle/60 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={sev.badge}>{sev.label}</Badge>
                      <span className="truncate text-sm font-semibold text-ink">{item.title}</span>
                      <Badge className={st.badge}>{st.label}</Badge>
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-ink-muted">
                      {item.target} · {item.category} · {formatRelativeTime(item.discoveredAt)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3 text-xs">
                    <span className={cn('inline-flex items-center gap-1 font-medium', ver.tone)}>
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {ver.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Finding Detail Drawer */}
      <Drawer
        open={Boolean(detail) || loadingDetail}
        onClose={() => setDetail(null)}
        title={detail?.title || '加载漏洞详情…'}
        subtitle={detail ? `${detail.id} · ${detail.target}` : undefined}
        widthClass="max-w-2xl"
      >
        {loadingDetail && !detail ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          detail && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={SEVERITY_META[detail.severity]?.badge}>
                  {SEVERITY_META[detail.severity]?.label}
                </Badge>
                <Badge className={FINDING_STATUS_META[detail.status]?.badge}>
                  {FINDING_STATUS_META[detail.status]?.label}
                </Badge>
                <Badge className="font-mono">{detail.category}</Badge>
                <span className={cn('text-xs font-medium', VERIFICATION_META[detail.verification]?.tone)}>
                  {VERIFICATION_META[detail.verification]?.label}
                </span>
              </div>

              {/* Disposition Controls */}
              <Card className="p-4">
                <p className="mb-2 text-xs font-semibold text-ink">处置状态流转</p>
                <Input
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="可选：填写研判备注或修复单号…"
                  className="mb-2.5 h-8 text-xs"
                />
                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map((st) => (
                    <Button
                      key={st}
                      size="sm"
                      variant={detail.status === st ? 'primary' : 'secondary'}
                      loading={updatingStatus}
                      disabled={detail.status === st}
                      onClick={() => void handleTransition(st)}
                    >
                      {FINDING_STATUS_META[st].label}
                    </Button>
                  ))}
                </div>
              </Card>

              <div>
                <h3 className="mb-1.5 text-xs font-semibold text-ink">漏洞描述</h3>
                <p className="text-sm leading-relaxed text-ink-secondary">
                  {detail.detail.description || '—'}
                </p>
              </div>

              {detail.detail.affected.length > 0 && (
                <div>
                  <h3 className="mb-1.5 text-xs font-semibold text-ink">受影响路径 / 组件</h3>
                  <ul className="space-y-1 font-mono text-xs text-ink-secondary">
                    {detail.detail.affected.map((a, idx) => (
                      <li key={idx} className="rounded border border-line bg-surface px-2.5 py-1.5">
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detail.detail.poc && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
                      <Terminal className="h-3.5 w-3.5 text-accent" />
                      验证脚本（PoC · {detail.detail.poc.language}）
                    </h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void copyPoc(detail.detail.poc!.code)}
                    >
                      {copiedPoc ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedPoc ? '已复制' : '复制'}
                    </Button>
                  </div>
                  <pre className="max-h-72 overflow-auto rounded-lg border border-line bg-surface p-3.5 font-mono text-xs text-ink">
                    {detail.detail.poc.code}
                  </pre>
                </div>
              )}

              {detail.detail.evidence && (
                <div>
                  <h3 className="mb-1.5 text-xs font-semibold text-ink">原始证据留痕</h3>
                  <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-surface p-3.5 font-mono text-[11px] text-ink-secondary">
                    {detail.detail.evidence}
                  </pre>
                </div>
              )}

              {detail.detail.reasoning && (
                <div>
                  <h3 className="mb-1.5 text-xs font-semibold text-ink">智能体推理依据</h3>
                  <p className="rounded-lg border border-line bg-surface p-3.5 text-xs leading-relaxed text-ink-secondary whitespace-pre-wrap">
                    {detail.detail.reasoning}
                  </p>
                </div>
              )}

              {(remediation || detail.detail.remediation) && (
                <Card className="p-4">
                  <h3 className="text-xs font-semibold text-ink">
                    修复建议 {remediation?.cwe ? `(${remediation.cwe})` : ''}
                  </h3>
                  {remediation?.steps.length ? (
                    <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-ink-secondary">
                      {remediation.steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                      {detail.detail.remediation}
                    </p>
                  )}
                </Card>
              )}

              {detail.timeline.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold text-ink">处置时间线</h3>
                  <div className="space-y-2 border-l border-line pl-4">
                    {detail.timeline.map((t) => (
                      <div key={t.id} className="text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-ink">{t.summary}</span>
                          <span className="font-mono text-[10px] text-ink-muted">
                            {formatRelativeTime(t.at)}
                          </span>
                        </div>
                        <span className="text-[11px] text-ink-muted">操作者：{t.actor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </Drawer>
    </div>
  )
}
