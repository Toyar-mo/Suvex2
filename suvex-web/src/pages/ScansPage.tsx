import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Activity,
  Archive,
  FileText,
  GitCompare,
  Paperclip,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ScanSearch,
  Search,
  Send,
  ShieldCheck,
  Square,
  Trash2,
} from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import {
  formatBytes,
  formatDuration,
  formatRelativeTime,
  GOAL_META,
  SCAN_AUTH_STATEMENT,
  SCAN_STATUS_META,
  SEVERITY_META,
  SKILL_LABELS,
  TARGET_KINDS,
} from '@/lib/format'
import type {
  CompareOut,
  HintOut,
  ProviderOut,
  ScanGoal,
  ScanOut,
  ScanStatsOut,
  Severity,
  SkillId,
  StagedAttachmentsOut,
  TargetKind,
  WriteupOut,
} from '@/types/api'
import {
  Badge,
  Button,
  Card,
  Drawer,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives'
import { MarkdownView } from '@/components/ui/MarkdownView'
import { cn } from '@/lib/cn'

export function ScansPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { push } = useToast()

  const [scans, setScans] = useState<ScanOut[]>([])
  const [queue, setQueue] = useState<ScanStatsOut | null>(null)
  const [providers, setProviders] = useState<ProviderOut[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Compare Modal
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareA, setCompareA] = useState('')
  const [compareB, setCompareB] = useState('')
  const [compareResult, setCompareResult] = useState<CompareOut | null>(null)
  const [comparing, setComparing] = useState(false)

  const [wizardOpen, setWizardOpen] = useState(searchParams.get('new') === '1')
  const [selectedScan, setSelectedScan] = useState<ScanOut | null>(null)
  const [hints, setHints] = useState<HintOut[]>([])
  const [hintText, setHintText] = useState('')
  const [postingHint, setPostingHint] = useState(false)
  const [rerunning, setRerunning] = useState(false)
  const [writeup, setWriteup] = useState<WriteupOut | null>(null)
  const [loadingWriteup, setLoadingWriteup] = useState(false)

  // New Scan Wizard State
  const [targetKind, setTargetKind] = useState<TargetKind>('url')
  const [target, setTarget] = useState('')
  const [name, setName] = useState('')
  const [goal, setGoal] = useState<ScanGoal>('findVulns')
  const [skills, setSkills] = useState<SkillId[]>(['web', 'api'])
  const [providerId, setProviderId] = useState('auto')
  const [brief, setBrief] = useState('')
  const [staged, setStaged] = useState<StagedAttachmentsOut | null>(null)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [creating, setCreating] = useState(false)

  const loadScans = useCallback(async () => {
    try {
      const [list, q] = await Promise.all([
        api.listScans({
          status: statusFilter || undefined,
          q: query.trim() || undefined,
          sort: 'recent',
          dir: 'desc',
        }),
        api.getScanQueue().catch(() => null),
      ])
      setScans(list)
      setQueue(q)

      const urlId = searchParams.get('id')
      if (urlId) {
        const match = list.find((s) => s.id === urlId)
        if (match) setSelectedScan(match)
      }
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载扫描列表失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [push, query, searchParams, statusFilter])

  useEffect(() => {
    void loadScans()
    const timer = window.setInterval(() => void loadScans(), 12000)
    return () => window.clearInterval(timer)
  }, [loadScans])

  useEffect(() => {
    api.listProviders().then(setProviders).catch(() => {})
  }, [])

  useEffect(() => {
    if (searchParams.get('new') === '1') setWizardOpen(true)
  }, [searchParams])

  const openDetail = useCallback(async (scan: ScanOut) => {
    setSelectedScan(scan)
    setWriteup(null)
    setHints([])
    api.getScanHints(scan.id).then(setHints).catch(() => {})
  }, [])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const runCompare = async (aId = compareA, bId = compareB) => {
    if (!aId || !bId || aId === bId) {
      push('请选择两次不同的扫描进行差异对比', 'error')
      return
    }
    setComparing(true)
    try {
      const res = await api.compareScans(aId, bId)
      setCompareResult(res)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '对比扫描失败', 'error')
    } finally {
      setComparing(false)
    }
  }

  const handleOpenCompareFromSelection = () => {
    const a = selectedIds[1] || scans[1]?.id || ''
    const b = selectedIds[0] || scans[0]?.id || ''
    setCompareA(a)
    setCompareB(b)
    setCompareResult(null)
    setCompareOpen(true)
    if (a && b && a !== b) {
      void runCompare(a, b)
    }
  }

  const handleBatchArchive = async () => {
    if (selectedIds.length === 0) return
    try {
      const res = await api.archiveScansBatch(selectedIds, true)
      push(`已归档 ${res.changed} 条扫描`, 'success')
      setSelectedIds([])
      await loadScans()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '批量归档失败', 'error')
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return
    try {
      const res = await api.deleteScans(selectedIds)
      push(`已移入回收站 ${res.changed} 条扫描`, 'default')
      setSelectedIds([])
      await loadScans()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '批量删除失败', 'error')
    }
  }

  const handleBatchRerun = async () => {
    if (selectedIds.length === 0) return
    try {
      const res = await api.rerunScansBatch(selectedIds, {
        confirmed: true,
        statement: SCAN_AUTH_STATEMENT,
        confirmedAt: new Date().toISOString(),
      })
      push(`已批量重跑 ${res.created.length} 条扫描`, 'success')
      setSelectedIds([])
      await loadScans()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '批量重跑失败', 'error')
    }
  }

  const handleKindChange = (kind: TargetKind) => {
    setTargetKind(kind)
    const meta = TARGET_KINDS.find((k) => k.id === kind)
    if (meta) setSkills(meta.defaultSkills)
  }

  const toggleSkill = (sk: SkillId) => {
    setSkills((prev) =>
      prev.includes(sk) ? (prev.length > 1 ? prev.filter((x) => x !== sk) : prev) : [...prev, sk],
    )
  }

  const handleStageFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploadingFiles(true)
    try {
      const res = await api.stageScanAttachments(Array.from(files))
      setStaged(res)
      push(`已暂存 ${res.files.length} 个附件`, 'success')
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '附件暂存失败', 'error')
    } finally {
      setUploadingFiles(false)
    }
  }

  const handleCreateScan = async (e: FormEvent) => {
    e.preventDefault()
    if (!authChecked) {
      push('发起扫描前必须逐字勾选授权声明。', 'error')
      return
    }
    setCreating(true)
    try {
      const created = await api.createScan({
        name: name.trim() || undefined,
        target: target.trim(),
        targetKind,
        skills,
        providerId,
        brief: brief.trim() || null,
        goal,
        attachmentStagingId: staged?.stagingId || null,
        authorization: {
          confirmed: true,
          statement: SCAN_AUTH_STATEMENT,
          confirmedAt: new Date().toISOString(),
        },
      })
      push('扫描任务已提交并进入执行队列', 'success')
      setWizardOpen(false)
      setTarget('')
      setName('')
      setBrief('')
      setStaged(null)
      setAuthChecked(false)
      setSearchParams({}, { replace: true })
      await loadScans()
      void openDetail(created)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '创建扫描失败', 'error')
    } finally {
      setCreating(false)
    }
  }

  const handleAbort = async (scan: ScanOut) => {
    try {
      const updated = await api.abortScan(scan.id)
      setSelectedScan(updated)
      push('已发送终止信号', 'success')
      await loadScans()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '终止失败', 'error')
    }
  }

  const handleRerun = async (scan: ScanOut) => {
    if (rerunning) return
    setRerunning(true)
    try {
      // CTF2 自动解题壳不能走 /scans/{id}/rerun，自动路由回 CTF2 解题队列一键重解
      if (scan.target?.startsWith('ctf2:')) {
        const remoteId = scan.target.slice(5).trim()
        const allChallenges = await api.getKernelChallenges()
        const matched = allChallenges.find(
          (c) => c.scanId === scan.id || (remoteId && c.remoteId === remoteId),
        )
        if (!matched) {
          push('未在 CTF2 题库中找到对应题目，请前往「CTF 夺旗」页同步后再开解', 'error')
          return
        }
        const res = await api.solveChallenge(matched.id)
        push(res.message || `已将「${matched.title}」重新投入 CTF2 自动解题队列`, 'success')
        await loadScans()
        setSelectedScan(null)
        return
      }

      const created = await api.rerunScan(scan.id, {
        confirmed: true,
        statement: SCAN_AUTH_STATEMENT,
        confirmedAt: new Date().toISOString(),
      })
      push('已基于授权声明发起重跑', 'success')
      await loadScans()
      void openDetail(created)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '重跑失败', 'error')
    } finally {
      setRerunning(false)
    }
  }

  const handleDelete = async (scan: ScanOut) => {
    try {
      await api.deleteScans([scan.id])
      setSelectedScan(null)
      push('已移入回收站', 'success')
      await loadScans()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '删除失败', 'error')
    }
  }

  const handlePostHint = async () => {
    if (!selectedScan || !hintText.trim() || postingHint) return
    if (selectedScan.status !== 'running' && selectedScan.status !== 'queued') {
      push('当前任务已结束，无法注入线索；请先点击上方「重跑」重新启动后再注入', 'error')
      return
    }
    setPostingHint(true)
    try {
      const created = await api.postScanHint(selectedScan.id, hintText.trim())
      setHints((prev) => [...prev, created])
      setHintText('')
      push('线索已注入，智能体将在下一回合读取', 'success')
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '发送线索失败', 'error')
    } finally {
      setPostingHint(false)
    }
  }

  const handleLoadWriteup = async () => {
    if (!selectedScan) return
    setLoadingWriteup(true)
    try {
      const w = await api.getScanWriteup(selectedScan.id)
      setWriteup(w)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '该扫描暂无可用报告/题解', 'error')
    } finally {
      setLoadingWriteup(false)
    }
  }

  const activeKindMeta = TARGET_KINDS.find((k) => k.id === targetKind) || TARGET_KINDS[0]

  return (
    <div>
      <PageHeader
        eyebrow="Scan Ledger"
        title="扫描任务"
        description="对目标发起授权安全评估、CTF 夺旗或修复复测，支持双扫描差异对比与批量操作。"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => void loadScans()}>
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={scans.length < 2}
              onClick={handleOpenCompareFromSelection}
            >
              <GitCompare className="h-3.5 w-3.5" />
              双扫描对比
            </Button>
            <Button variant="primary" size="sm" onClick={() => setWizardOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              发起新扫描
            </Button>
          </>
        }
      />

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-editorial border border-accent/30 bg-accent-soft/50 px-4 py-2.5 text-xs">
          <span className="font-medium text-ink">已选择 {selectedIds.length} 条扫描任务</span>
          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.length === 2 && (
              <Button size="sm" variant="accent" onClick={handleOpenCompareFromSelection}>
                <GitCompare className="h-3.5 w-3.5" />
                对比这两次扫描
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => void handleBatchRerun()}>
              <RotateCcw className="h-3.5 w-3.5" />
              批量重跑
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void handleBatchArchive()}>
              <Archive className="h-3.5 w-3.5" />
              批量归档
            </Button>
            <Button size="sm" variant="danger" onClick={() => void handleBatchDelete()}>
              <Trash2 className="h-3.5 w-3.5" />
              移入回收站
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
              取消选择
            </Button>
          </div>
        </div>
      )}

      {/* Queue Bar + Filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: '', label: '全部' },
            { id: 'running', label: '运行中' },
            { id: 'queued', label: '排队中' },
            { id: 'completed', label: '已完成' },
            { id: 'failed', label: '失败' },
          ].map((tab) => (
            <button
              key={tab.id || 'all'}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                statusFilter === tab.id
                  ? 'bg-ink text-canvas'
                  : 'border border-line bg-surface text-ink-secondary hover:bg-subtle hover:text-ink',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {queue && (
            <span className="hidden font-mono text-xs text-ink-muted md:inline">
              并发 {queue.running}/{queue.limit} · 排队 {queue.queued}
            </span>
          )}
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="按名称或目标筛选..."
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Scans List */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : scans.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<ScanSearch className="h-5 w-5" />}
              title="暂无匹配的扫描任务"
              description="点击右上角「发起新扫描」，支持 Web 应用、代码仓库、裸 TCP 服务与纯附件题目。"
              action={
                <Button variant="primary" size="sm" onClick={() => setWizardOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  发起新扫描
                </Button>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {scans.map((scan) => {
              const st = SCAN_STATUS_META[scan.status] || SCAN_STATUS_META.queued
              const checked = selectedIds.includes(scan.id)
              const sevEntries = (['critical', 'high', 'medium', 'low'] as Severity[])
                .map((s) => ({ sev: s, count: scan.findings?.[s] || 0 }))
                .filter((x) => x.count > 0)

              return (
                <div
                  key={scan.id}
                  onClick={() => void openDetail(scan)}
                  className="flex cursor-pointer flex-col gap-3 px-5 py-4 transition-colors hover:bg-subtle/60 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelect(scan.id)}
                      className="mt-1 rounded border-line-strong"
                      aria-label={`选择扫描 ${scan.name || scan.id}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-ink">
                          {scan.name || scan.target || scan.id}
                        </span>
                        <Badge pulse={st.pulse} className={st.badge}>
                          {st.label}
                        </Badge>
                        <Badge className="font-mono text-[10px]">
                          {GOAL_META[scan.goal]?.label || scan.goal}
                        </Badge>
                        {scan.flag && (
                          <Badge className="border-emerald-200 bg-emerald-50 font-mono text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
                            FLAG 已捕获
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 truncate font-mono text-xs text-ink-muted">
                        {scan.target || '纯附件任务'} · {scan.targetKind} ·{' '}
                        {formatRelativeTime(scan.startedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      {sevEntries.map(({ sev, count }) => (
                        <span
                          key={sev}
                          className={cn(
                            'rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums',
                            SEVERITY_META[sev].badge,
                          )}
                        >
                          {SEVERITY_META[sev].label} {count}
                        </span>
                      ))}
                    </div>
                    <span className="font-mono text-xs tabular-nums text-ink-secondary">
                      {formatDuration(scan.durationSec)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Scan Diff Compare Modal */}
      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="双扫描差异对比"
        subtitle="对比基线扫描（A）与较新扫描（B），识别已修复、新引入与持续存在的漏洞"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-secondary">基线扫描 A（较早）</label>
              <Select
                value={compareA}
                onChange={setCompareA}
                className="w-full"
                options={scans.map((s) => ({
                  value: s.id,
                  label: s.name || s.target || s.id,
                }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-secondary">最新扫描 B（较新）</label>
              <Select
                value={compareB}
                onChange={setCompareB}
                className="w-full"
                options={scans.map((s) => ({
                  value: s.id,
                  label: s.name || s.target || s.id,
                }))}
              />
            </div>
          </div>

          <Button size="sm" variant="primary" loading={comparing} onClick={() => void runCompare()}>
            <GitCompare className="h-3.5 w-3.5" />
            计算差异
          </Button>

          {compareResult && (
            <div className="space-y-3 border-t border-line pt-4">
              <div className="rounded-lg border border-line bg-subtle p-3 text-xs">
                <span className="font-semibold text-ink">变化研判：</span>
                <span className="text-ink-secondary">{compareResult.verdict}</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 text-xs">
                <Card className="p-3.5">
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                    已收敛 / 仅 A 存在 ({compareResult.onlyInA.length})
                  </p>
                  <ul className="mt-2 space-y-1 text-ink-secondary">
                    {compareResult.onlyInA.length === 0 ? (
                      <li className="text-ink-muted">无</li>
                    ) : (
                      compareResult.onlyInA.map((x, i) => <li key={i}>• {x}</li>)
                    )}
                  </ul>
                </Card>
                <Card className="p-3.5">
                  <p className="font-semibold text-red-700 dark:text-red-400">
                    新引入 / 仅 B 存在 ({compareResult.onlyInB.length})
                  </p>
                  <ul className="mt-2 space-y-1 text-ink-secondary">
                    {compareResult.onlyInB.length === 0 ? (
                      <li className="text-ink-muted">无</li>
                    ) : (
                      compareResult.onlyInB.map((x, i) => <li key={i}>• {x}</li>)
                    )}
                  </ul>
                </Card>
                <Card className="p-3.5">
                  <p className="font-semibold text-ink">
                    持续存在 ({compareResult.common.length})
                  </p>
                  <ul className="mt-2 space-y-1 text-ink-secondary">
                    {compareResult.common.length === 0 ? (
                      <li className="text-ink-muted">无</li>
                    ) : (
                      compareResult.common.map((x, i) => <li key={i}>• {x}</li>)
                    )}
                  </ul>
                </Card>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* New Scan Wizard Drawer */}
      <Drawer
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false)
          setSearchParams({}, { replace: true })
        }}
        title="发起新扫描任务"
        subtitle="配置目标形态、成功判据、检测范围并签署授权声明"
        widthClass="max-w-2xl"
      >
        <form onSubmit={handleCreateScan} className="space-y-6">
          <div>
            <label className="mb-2 block text-xs font-semibold text-ink">1. 目标形态</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TARGET_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => handleKindChange(k.id)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors',
                    targetKind === k.id
                      ? 'border-accent bg-accent-soft/60 text-ink'
                      : 'border-line bg-surface text-ink-secondary hover:border-line-strong',
                  )}
                >
                  <div className="text-xs font-medium text-ink">{k.label}</div>
                  <div className="mt-0.5 text-[11px] text-ink-muted">{k.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">
                目标地址 {targetKind !== 'artifact' && <span className="text-red-500">*</span>}
              </label>
              <Input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={activeKindMeta.placeholder}
                required={targetKind !== 'artifact'}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">
                任务名称（可选）
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="留空自动使用目标推导"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-ink">2. 成功判据</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {(['findVulns', 'captureFlag', 'verifyFix'] as ScanGoal[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGoal(g)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors',
                    goal === g
                      ? 'border-accent bg-accent-soft/60'
                      : 'border-line bg-surface hover:border-line-strong',
                  )}
                >
                  <div className="text-xs font-medium text-ink">{GOAL_META[g].label}</div>
                  <div className="mt-0.5 text-[11px] text-ink-muted">{GOAL_META[g].desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold text-ink">3. 检测技能</label>
              <div className="flex flex-wrap gap-1.5">
                {activeKindMeta.skills.map((sk) => {
                  const active = skills.includes(sk)
                  return (
                    <button
                      key={sk}
                      type="button"
                      onClick={() => toggleSkill(sk)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs transition-colors',
                        active
                          ? 'border-ink bg-ink text-canvas'
                          : 'border-line bg-surface text-ink-secondary hover:border-line-strong',
                      )}
                    >
                      {SKILL_LABELS[sk]}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-ink">模型接入点</label>
              <Select
                value={providerId}
                onChange={setProviderId}
                className="w-full"
                options={[
                  { value: 'auto', label: '自动选择（按默认模型路由）' },
                  ...providers.map((p) => ({
                    value: p.id,
                    label: p.label,
                    description: p.model,
                    badge: p.isDefault ? '默认' : undefined,
                  })),
                ]}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink">
              4. 任务背景 / 题面 / 账号范围（可选）
            </label>
            <Textarea
              rows={4}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="填写测试账号、注意事项、Flag 格式或需重点核查的业务边界…"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink-secondary hover:border-line-strong hover:text-ink">
                <Paperclip className="h-3.5 w-3.5" />
                <span>{uploadingFiles ? '正在上传暂存…' : '上传题目/测试附件'}</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleStageFiles(e.target.files)}
                />
              </label>
              {staged && (
                <span className="text-xs text-emerald-700 dark:text-emerald-400">
                  已暂存 {staged.files.map((f) => `${f.name} (${formatBytes(f.sizeBytes)})`).join('、')}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-editorial border border-line-strong bg-subtle p-4">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={authChecked}
                onChange={(e) => setAuthChecked(e.target.checked)}
                className="mt-0.5 rounded border-line-strong"
              />
              <span className="text-xs leading-relaxed text-ink">
                <strong className="font-semibold">{SCAN_AUTH_STATEMENT}</strong>
                <span className="mt-0.5 block text-[11px] text-ink-muted">
                  服务端将逐字校验此声明，并连同操作用户、来源 IP 与时间戳一并落库留痕。
                </span>
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button type="button" variant="secondary" onClick={() => setWizardOpen(false)}>
              取消
            </Button>
            <Button type="submit" variant="primary" loading={creating} disabled={!authChecked}>
              <Play className="h-3.5 w-3.5" />
              启动扫描任务
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Scan Detail Drawer */}
      <Drawer
        open={Boolean(selectedScan)}
        onClose={() => setSelectedScan(null)}
        title={selectedScan?.name || selectedScan?.target || '扫描详情'}
        subtitle={selectedScan ? `${selectedScan.id} · ${selectedScan.targetKind}` : undefined}
        widthClass="max-w-2xl"
      >
        {selectedScan && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge
                  pulse={SCAN_STATUS_META[selectedScan.status]?.pulse}
                  className={SCAN_STATUS_META[selectedScan.status]?.badge}
                >
                  {SCAN_STATUS_META[selectedScan.status]?.label || selectedScan.status}
                </Badge>
                <Badge>{GOAL_META[selectedScan.goal]?.label || selectedScan.goal}</Badge>
                <span className="font-mono text-xs text-ink-muted">
                  耗时 {formatDuration(selectedScan.durationSec)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/activity?scan=${encodeURIComponent(selectedScan.id)}`}>
                  <Button size="sm" variant="accent">
                    <Activity className="h-3.5 w-3.5" />
                    实时事件流
                  </Button>
                </Link>
                {selectedScan.status === 'running' || selectedScan.status === 'queued' ? (
                  <Button size="sm" variant="danger" onClick={() => void handleAbort(selectedScan)}>
                    <Square className="h-3 w-3" />
                    终止
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={rerunning}
                    onClick={() => void handleRerun(selectedScan)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    重跑
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => void handleDelete(selectedScan)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {selectedScan.flag && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 font-mono text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
                <span className="font-semibold">Flag: </span>
                {selectedScan.flag}
              </div>
            )}

            {selectedScan.failureReason && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                失败原因：{selectedScan.failureReason}
              </div>
            )}

            <Card className="grid grid-cols-2 gap-4 p-4 text-xs">
              <div>
                <p className="text-ink-muted">目标地址</p>
                <p className="mt-0.5 break-all font-mono text-ink">
                  {selectedScan.target || '纯附件任务'}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">发起时间</p>
                <p className="mt-0.5 font-mono text-ink">
                  {formatRelativeTime(selectedScan.startedAt)}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">技能范围</p>
                <p className="mt-0.5 text-ink">
                  {selectedScan.skills.length > 0
                    ? selectedScan.skills.map((s) => SKILL_LABELS[s] || s).join('、')
                    : selectedScan.target?.startsWith('ctf2:')
                      ? 'CTF2 自治求解'
                      : '自动路由'}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">运行智能体数</p>
                <p className="mt-0.5 font-mono text-ink">{selectedScan.agentCount}</p>
              </div>
            </Card>

            {selectedScan.brief && (
              <div>
                <h3 className="mb-1.5 text-xs font-semibold text-ink">任务背景</h3>
                <div className="rounded-lg border border-line bg-surface p-3.5 text-xs leading-relaxed text-ink-secondary whitespace-pre-wrap">
                  {selectedScan.brief}
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-ink">人工线索注入</h3>
                {selectedScan.status !== 'running' && selectedScan.status !== 'queued' && (
                  <span className="text-[11px] text-ink-muted">
                    任务已结束 · 点上方「重跑」后可注入
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={hintText}
                  onChange={(e) => setHintText(e.target.value)}
                  disabled={selectedScan.status !== 'running' && selectedScan.status !== 'queued'}
                  placeholder={
                    selectedScan.status === 'running' || selectedScan.status === 'queued'
                      ? '补充业务提示或思路，运行中的智能体将在下回合读取…'
                      : '当前任务已结束，请先点击上方「重跑」再注入线索'
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handlePostHint()
                    }
                  }}
                />
                <Button
                  size="md"
                  variant="secondary"
                  loading={postingHint}
                  disabled={
                    !hintText.trim() ||
                    (selectedScan.status !== 'running' && selectedScan.status !== 'queued')
                  }
                  onClick={() => void handlePostHint()}
                >
                  <Send className="h-3.5 w-3.5" />
                  注入
                </Button>
              </div>
              {hints.length > 0 && (
                <div className="mt-2.5 space-y-1.5">
                  {hints.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 text-xs"
                    >
                      <span className="text-ink">{h.text}</span>
                      <Badge className="shrink-0">
                        {h.consumed ? `第 ${h.consumedTurn ?? '?'} 轮已读` : '待读取'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-ink">报告 / 题解产物</h3>
                <div className="flex items-center gap-2">
                  <Link to={`/findings?scanId=${encodeURIComponent(selectedScan.id)}`}>
                    <Button size="sm" variant="ghost">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      关联漏洞
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={loadingWriteup}
                    onClick={() => void handleLoadWriteup()}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    加载报告/题解
                  </Button>
                </div>
              </div>
              {writeup && (
                <Card className="p-5">
                  <MarkdownView content={writeup.markdown} />
                </Card>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
