import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  Flag,
  Globe,
  Loader2,
  Paperclip,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Terminal,
  Wrench,
} from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { CTF_STATUS_META, formatRelativeTime } from '@/lib/format'
import type {
  ActivityEventOut,
  ChatChallengeRef,
  KernelChallengeOut,
  KernelWriteupOut,
} from '@/types/api'
import { Badge, Button, Input, Modal } from '@/components/ui/primitives'
import { MarkdownView } from '@/components/ui/MarkdownView'
import { cn } from '@/lib/cn'

export interface ChallengeCockpitProps {
  challengeRef: ChatChallengeRef
  hasChatMessages: boolean
  onQuickPrompt: (prompt: string) => void
  onRefreshSession: () => Promise<void>
}

function eventTypeStyle(type: string): { label: string; cls: string; icon: 'tool' | 'think' | 'flag' | 'info' } {
  const t = type.toLowerCase()
  if (t.includes('tool') || t.includes('cmd') || t.includes('shell')) {
    return {
      label: '工具执行',
      cls: 'border-indigo-300/60 bg-indigo-50/70 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
      icon: 'tool',
    }
  }
  if (t.includes('reason') || t.includes('think') || t.includes('plan')) {
    return {
      label: '推理思考',
      cls: 'border-violet-300/60 bg-violet-50/70 text-violet-700 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-300',
      icon: 'think',
    }
  }
  if (t.includes('flag') || t.includes('submit') || t.includes('solved')) {
    return {
      label: 'Flag 进展',
      cls: 'border-emerald-300/60 bg-emerald-50/70 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
      icon: 'flag',
    }
  }
  if (t.includes('error') || t.includes('fail') || t.includes('abandon')) {
    return {
      label: '异常',
      cls: 'border-red-300/60 bg-red-50/70 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300',
      icon: 'info',
    }
  }
  return {
    label: type || '状态',
    cls: 'border-line bg-subtle text-ink-secondary',
    icon: 'info',
  }
}

function SolveEventRow({ ev }: { ev: ActivityEventOut }) {
  const [open, setOpen] = useState(false)
  const meta = eventTypeStyle(ev.type)
  const hasDetail = ev.detail && Object.keys(ev.detail).length > 0

  return (
    <div className="rounded-lg border border-line-subtle bg-surface/80 text-xs transition-colors hover:border-line">
      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left',
          !hasDetail && 'cursor-default',
        )}
      >
        {hasDetail ? (
          open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
          )
        ) : (
          <span className="h-3.5 w-3.5 shrink-0" />
        )}

        {meta.icon === 'tool' ? (
          <Terminal className="h-3.5 w-3.5 shrink-0 text-accent" />
        ) : meta.icon === 'think' ? (
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-400" />
        ) : meta.icon === 'flag' ? (
          <Flag className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        ) : (
          <Wrench className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
        )}

        <Badge className={cn('shrink-0 text-[10px]', meta.cls)}>{meta.label}</Badge>

        <span className="min-w-0 flex-1 truncate text-ink">
          {ev.summary || ev.type}
        </span>

        <span className="shrink-0 font-mono text-[10px] text-ink-muted">
          {formatRelativeTime(ev.at)}
        </span>
      </button>

      {open && hasDetail && (
        <div className="border-t border-line-subtle bg-subtle/60 px-3 py-2.5">
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-line bg-canvas p-2.5 font-mono text-[11px] leading-relaxed text-ink-secondary">
            {JSON.stringify(ev.detail, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export function ChallengeCockpit({
  challengeRef,
  hasChatMessages,
  onQuickPrompt,
  onRefreshSession,
}: ChallengeCockpitProps) {
  const { push } = useToast()
  const [challenge, setChallenge] = useState<KernelChallengeOut | null>(null)
  const [events, setEvents] = useState<ActivityEventOut[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [streamConnected, setStreamConnected] = useState(false)
  const [descOpen, setDescOpen] = useState(true)
  const [traceOpen, setTraceOpen] = useState(true)
  const [busyAction, setBusyAction] = useState(false)
  const [flagDraft, setFlagDraft] = useState(challengeRef.candidateFlag || '')
  const [submittingFlag, setSubmittingFlag] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [writeup, setWriteup] = useState<KernelWriteupOut | null>(null)

  const loadChallenge = useCallback(async () => {
    try {
      const full = await api.getKernelChallenge(challengeRef.id)
      setChallenge(full)
      if (full.candidateFlag && !flagDraft) {
        setFlagDraft(full.candidateFlag)
      }
    } catch {
      // Fallback to challengeRef
    }
  }, [challengeRef.id, flagDraft])

  const effectiveStatus = challenge?.status || challengeRef.status
  const effectiveScanId = challenge?.scanId || challengeRef.scanId
  const isSolving =
    effectiveStatus === 'solving' ||
    effectiveStatus === 'environment_ready' ||
    effectiveStatus === 'submitting'

  // Load full challenge detail and poll while solving
  useEffect(() => {
    void loadChallenge()
    if (!isSolving) return
    const timer = window.setInterval(() => void loadChallenge(), 5000)
    return () => window.clearInterval(timer)
  }, [loadChallenge, isSolving])

  // Load recent events + subscribe SSE stream for effectiveScanId
  useEffect(() => {
    if (!effectiveScanId) {
      setEvents([])
      setStreamConnected(false)
      return
    }
    let alive = true
    setLoadingEvents(true)
    api
      .getRecentEvents(effectiveScanId, 200)
      .then((res) => {
        if (!alive) return
        setEvents(res.events || [])
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoadingEvents(false)
      })

    const es = api.createActivityStream(effectiveScanId)
    es.onopen = () => {
      if (alive) setStreamConnected(true)
    }
    es.onerror = () => {
      if (alive) setStreamConnected(false)
    }
    es.onmessage = (msg) => {
      const parsed = api.parseActivityEvent(msg.data)
      if (!parsed || !alive) return
      setEvents((prev) => (prev.some((e) => e.id === parsed.id) ? prev : [...prev, parsed]))
    }

    return () => {
      alive = false
      es.close()
    }
  }, [effectiveScanId])

  const statusMeta = CTF_STATUS_META[effectiveStatus] || CTF_STATUS_META.unsolved
  const targetUrls = useMemo(() => {
    const env = challenge?.environment
    if (!env) return []
    const list = [...(env.accessUrls || [])]
    if (env.accessUrl && !list.includes(env.accessUrl)) list.unshift(env.accessUrl)
    return list
  }, [challenge?.environment])

  const handleStartSolve = async () => {
    setBusyAction(true)
    try {
      const res = await api.solveChallenge(challengeRef.id)
      push(res.message || '已投入自动解题队列', 'success')
      await Promise.all([loadChallenge(), onRefreshSession()])
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '启动解题失败', 'error')
    } finally {
      setBusyAction(false)
    }
  }

  const handleStopSolve = async () => {
    setBusyAction(true)
    try {
      await api.cancelChallenge(challengeRef.id)
      push('已请求停止当前自动解题任务', 'default')
      await Promise.all([loadChallenge(), onRefreshSession()])
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '停止失败', 'error')
    } finally {
      setBusyAction(false)
    }
  }

  const handleSubmitFlag = async () => {
    const val = flagDraft.trim()
    if (!val) return
    setSubmittingFlag(true)
    try {
      const res = await api.submitFlag(challengeRef.id, val)
      push(res.message || `提交结果：${res.status}`, res.status === 'correct' ? 'success' : 'default')
      await Promise.all([loadChallenge(), onRefreshSession()])
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '提交 Flag 失败', 'error')
    } finally {
      setSubmittingFlag(false)
    }
  }

  const handleOpenWriteup = async () => {
    try {
      const w = await api.getChallengeWriteup(challengeRef.id)
      setWriteup(w)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '暂无可用题解', 'error')
    }
  }

  const buildInteractivePrompt = (latest?: KernelChallengeOut | null) => {
    const ch = latest ?? challenge
    const urls: string[] = []
    if (ch?.environment?.accessUrl) urls.push(ch.environment.accessUrl)
    for (const u of ch?.environment?.accessUrls || []) {
      if (u && !urls.includes(u)) urls.push(u)
    }
    const parts = [
      `请帮我分析并解出这道 CTF 题目「${ch?.title || challengeRef.title}」：`,
      `- 分类：${ch?.category || '未知'}`,
      ch?.remoteId ? `- 远端题目 ID：${ch.remoteId}` : '',
      ch?.score != null ? `- 分值：${ch.score} pts` : '',
      urls.length > 0
        ? `- 当前动态靶机入口：${urls.join(', ')}`
        : '- 当前尚无运行中的动态靶机，请先调用已挂载的 ctf2-suvex MCP 工具启动靶机后再测试。',
      ch?.description ? `\n题面信息：\n${ch.description}` : '',
      '\n请直接基于上述真实靶机入口（或通过 ctf2-suvex MCP 获取最新入口）进行分析，不要猜测域名或扫描内网，拿到 Flag 后提交并整理关键利用步骤。',
    ]
    return parts.filter(Boolean).join('\n')
  }

  const handleQuickLaunch = async () => {
    let latest = challenge
    if (!latest || !latest.environment?.accessUrl) {
      try {
        latest = await api.getKernelChallenge(challengeRef.id)
        setChallenge(latest)
      } catch {
        // use existing state
      }
    }
    onQuickPrompt(buildInteractivePrompt(latest))
  }

  const confirmedFlag = challenge?.confirmedFlag || challengeRef.confirmedFlag
  const candidateFlag = challenge?.candidateFlag || challengeRef.candidateFlag

  return (
    <div className="space-y-4">
      {/* Main Challenge Cockpit Card */}
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-editorial">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-indigo-300/60 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                <Flag className="h-3 w-3" />
                {challengeRef.platformName || 'CTF2'}
              </Badge>
              {challenge?.category && (
                <Badge className="font-mono text-[10px]">{challenge.category}</Badge>
              )}
              <Badge pulse={isSolving} className={statusMeta.badge}>
                {statusMeta.label}
              </Badge>
              {(challenge?.score ?? challengeRef.score) != null && (
                <span className="font-mono text-xs font-semibold text-ink-secondary">
                  {challenge?.score ?? challengeRef.score} pts
                </span>
              )}
            </div>
            <h2 className="mt-2 text-base font-semibold text-ink">
              {challenge?.title || challengeRef.title}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void Promise.all([loadChallenge(), onRefreshSession()])}
              title="刷新题目与解题状态"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            {isSolving ? (
              <Button size="sm" variant="danger" loading={busyAction} onClick={() => void handleStopSolve()}>
                <Square className="h-3 w-3" />
                停止自动解题
              </Button>
            ) : (
              <Button size="sm" variant="primary" loading={busyAction} onClick={() => void handleStartSolve()}>
                <Play className="h-3 w-3" />
                启动自动解题
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => void handleOpenWriteup()}>
              <FileText className="h-3.5 w-3.5" />
              题解
            </Button>
            {effectiveScanId && (
              <Link to={`/activity?scan=${encodeURIComponent(effectiveScanId)}`}>
                <Button size="sm" variant="ghost" title="在活动流全屏查看">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Target Environment URLs */}
        {targetUrls.length > 0 && (
          <div className="mt-3.5 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-300/40 bg-accent-soft/40 px-3.5 py-2.5 text-xs">
            <Globe className="h-3.5 w-3.5 shrink-0 text-accent" />
            <span className="font-medium text-ink">靶机入口</span>
            {targetUrls.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(u)
                  setCopiedUrl(u)
                  window.setTimeout(() => setCopiedUrl(null), 1500)
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-[11px] text-ink hover:border-accent"
                title="点击复制靶机地址"
              >
                <span>{u}</span>
                {copiedUrl === u ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3 text-ink-muted" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Error Banner */}
        {(challenge?.lastError || challenge?.environment?.lastError) && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-300/60 bg-red-50/70 px-3.5 py-2.5 text-xs text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{challenge?.lastError || challenge?.environment?.lastError}</span>
          </div>
        )}

        {/* Confirmed or Candidate Flag Bar */}
        {confirmedFlag ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-300/60 bg-emerald-50/70 px-3.5 py-2.5 text-xs dark:border-emerald-800 dark:bg-emerald-950/40">
            <div className="flex items-center gap-2 font-mono text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span className="font-sans font-medium">已确证 Flag：</span>
              <span>{confirmedFlag}</span>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-subtle/60 px-3 py-2">
            <Flag className="h-3.5 w-3.5 shrink-0 text-accent" />
            <Input
              value={flagDraft}
              onChange={(e) => setFlagDraft(e.target.value)}
              placeholder={candidateFlag || '输入或确认候选 Flag 提交到平台…'}
              className="h-8 flex-1 font-mono text-xs"
            />
            <Button
              size="sm"
              variant="primary"
              loading={submittingFlag}
              disabled={!flagDraft.trim()}
              onClick={() => void handleSubmitFlag()}
            >
              提交 Flag
            </Button>
          </div>
        )}

        {/* Description & Attachments */}
        {(challenge?.description || (challenge?.attachments && challenge.attachments.length > 0)) && (
          <div className="mt-3.5 border-t border-line-subtle pt-3">
            <button
              type="button"
              onClick={() => setDescOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-ink"
            >
              {descOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <span>题面说明与附件</span>
              {challenge?.attachments && challenge.attachments.length > 0 && (
                <Badge className="ml-1 text-[10px]">
                  <Paperclip className="h-2.5 w-2.5" />
                  {challenge.attachments.length} 个附件
                  {challenge.attachmentsReady ? ' · 已落盘' : ''}
                </Badge>
              )}
            </button>

            {descOpen && (
              <div className="mt-2.5 space-y-2.5">
                {challenge?.description && (
                  <div className="rounded-xl border border-line-subtle bg-subtle/40 px-4 py-3 text-sm">
                    <MarkdownView content={challenge.description} />
                  </div>
                )}
                {challenge?.attachments && challenge.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {challenge.attachments.map((att, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-subtle px-2.5 py-1 font-mono text-[11px] text-ink-secondary"
                      >
                        <Paperclip className="h-3 w-3 text-accent" />
                        {att.name || `attachment-${idx + 1}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live Autonomous Solve Event Timeline */}
      {(effectiveScanId || isSolving) && (
        <div className="rounded-2xl border border-line bg-subtle/45 px-4 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setTraceOpen((v) => !v)}
              className="flex items-center gap-2 text-xs font-medium text-ink"
            >
              {traceOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-ink-muted" />
              )}
              <Activity className={cn('h-3.5 w-3.5', isSolving ? 'text-accent' : 'text-emerald-500')} />
              <span>后台自动解题过程流</span>
              <span className="font-mono text-[11px] text-ink-muted">
                ({events.length} 条事件)
              </span>
            </button>

            <div className="flex items-center gap-2 text-[11px]">
              {isSolving && (
                <span className="inline-flex items-center gap-1.5 text-accent">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {streamConnected ? 'SSE 实时推送中' : '排队 / 连接事件流…'}
                </span>
              )}
            </div>
          </div>

          {traceOpen && (
            <div className="mt-3 space-y-1.5">
              {loadingEvents && events.length === 0 ? (
                <div className="flex items-center gap-2 py-4 text-xs text-ink-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  正在拉取自动解题过程记录…
                </div>
              ) : events.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line bg-surface/60 px-4 py-4 text-xs text-ink-muted">
                  {isSolving
                    ? '任务已受理，正在排队分配 Worker 与启动靶机环境；首条执行事件到达后将实时显示在这里。你也可以直接在下方对话栏与智能体协同交互。'
                    : '暂无自动解题过程记录。'}
                </div>
              ) : (
                <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
                  {events.map((ev) => (
                    <SolveEventRow key={ev.id} ev={ev} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick Interactive Chat Launcher when no chat messages yet */}
      {!hasChatMessages && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-line bg-surface/60 px-4 py-3 text-xs">
          <span className="text-ink-secondary">
            可在下方直接与对话智能体协同分析本题（支持调用沙箱与 <code className="font-mono">ctf2-suvex</code> MCP 工具）。
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void handleQuickLaunch()}
          >
            <Send className="h-3 w-3" />
            一键带题面开始对话解题
          </Button>
        </div>
      )}

      {/* Writeup Modal */}
      <Modal
        open={Boolean(writeup)}
        onClose={() => setWriteup(null)}
        title={writeup ? `题解 · ${writeup.title}` : '题解'}
        subtitle={writeup ? `${writeup.category} · ${writeup.turns} 回合` : undefined}
        maxWidth="max-w-3xl"
      >
        {writeup && <MarkdownView content={writeup.markdown} />}
      </Modal>
    </div>
  )
}
