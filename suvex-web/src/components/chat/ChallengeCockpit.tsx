import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

function eventTypeStyle(type: string): {
  label: string
  cls: string
  icon: 'tool' | 'think' | 'flag' | 'info'
} {
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
  if (t.includes('flag') || t.includes('submit') || t.includes('solved') || t === 'verified' || t === 'poc_generated') {
    return {
      label: t === 'verified' ? '已确证' : 'Flag 进展',
      cls: 'border-emerald-300/60 bg-emerald-50/70 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
      icon: 'flag',
    }
  }
  if (t.includes('error') || t.includes('fail') || t.includes('abandon') || t === 'blocked') {
    return {
      label: t === 'blocked' ? '受阻重试' : '异常',
      cls: 'border-red-300/60 bg-red-50/70 text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300',
      icon: 'info',
    }
  }
  return {
    label: t === 'discovery' ? '新发现' : type || '状态',
    cls: 'border-line bg-subtle text-ink-secondary',
    icon: 'info',
  }
}

function cleanEventSummary(ev: ActivityEventOut): string {
  let raw = (ev.summary || ev.type || '').trim()
  raw = raw.replace(/[\s…]*[（(]已截断[，,]?\s*原长\s*\d+\s*字符[）)]\s*$/, '').trim()
  const tool = typeof ev.detail?.tool === 'string' ? ev.detail.tool.trim() : ''
  if (ev.type === 'tool_call' && tool && raw.startsWith(tool + ' ')) {
    return `$ ${raw.slice(tool.length + 1).trim()}`
  }
  if (ev.type === 'reasoning' && /^ACTION:\s*\{/i.test(raw)) {
    return '准备调用工具执行下一步动作…'
  }
  return raw
}

function SolveEventRow({ ev }: { ev: ActivityEventOut }) {
  const [open, setOpen] = useState(false)
  const meta = eventTypeStyle(ev.type)
  const detail = ev.detail || {}
  const hasDetail = Object.keys(detail).length > 0
  const command = typeof detail.command === 'string' ? detail.command : ''
  const output = typeof detail.output === 'string' ? detail.output : ''
  const reasoningText = typeof detail.text === 'string' ? detail.text : ''

  return (
    <div className="rounded-lg border border-line-subtle bg-surface/85 text-xs transition-colors hover:border-line">
      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-1.5 text-left',
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

        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink">
          {cleanEventSummary(ev)}
        </span>

        <span className="shrink-0 font-mono text-[10px] text-ink-muted">
          {formatRelativeTime(ev.at)}
        </span>
      </button>

      {open && hasDetail && (
        <div className="space-y-2 border-t border-line-subtle bg-subtle/60 px-3 py-2.5">
          {command && (
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-line bg-canvas p-2 font-mono text-[11px] text-ink">
              {command}
            </pre>
          )}
          {output && (
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-line bg-canvas p-2 font-mono text-[11px] text-ink-secondary">
              {output}
            </pre>
          )}
          {!command && !output && reasoningText && (
            <div className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-canvas p-2.5 font-mono text-[11px] leading-relaxed text-ink-secondary">
              {reasoningText}
            </div>
          )}
          {!command && !output && !reasoningText && (
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-line bg-canvas p-2 font-mono text-[11px] text-ink-secondary">
              {JSON.stringify(detail, null, 2)}
            </pre>
          )}
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
  const [panelOpen, setPanelOpen] = useState(!hasChatMessages)
  const [activeTab, setActiveTab] = useState<'trace' | 'brief'>('trace')
  const [busyAction, setBusyAction] = useState(false)
  const [flagDraft, setFlagDraft] = useState(challengeRef.candidateFlag || '')
  const [submittingFlag, setSubmittingFlag] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [writeup, setWriteup] = useState<KernelWriteupOut | null>(null)
  const traceEndRef = useRef<HTMLDivElement | null>(null)

  // Auto-open when switching to an empty challenge session; stay compact when viewing long chat history
  useEffect(() => {
    setPanelOpen(!hasChatMessages)
  }, [challengeRef.id, hasChatMessages])

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

  useEffect(() => {
    void loadChallenge()
    if (!isSolving) return
    const timer = window.setInterval(() => void loadChallenge(), 5000)
    return () => window.clearInterval(timer)
  }, [loadChallenge, isSolving])

  // Load recent events + subscribe SSE stream using named `activity` & `resync` events
  useEffect(() => {
    if (!effectiveScanId) {
      setEvents([])
      setStreamConnected(false)
      return
    }
    let alive = true
    let es: EventSource | null = null

    const connect = async () => {
      setLoadingEvents(true)
      let lastId: string | null = null
      try {
        const res = await api.getRecentEvents(effectiveScanId, 200)
        if (!alive) return
        setEvents(res.events || [])
        lastId = res.events?.at(-1)?.id || null
      } catch {
        if (!alive) return
        setEvents([])
      } finally {
        if (alive) setLoadingEvents(false)
      }

      if (!alive) return
      es = api.createActivityStream(effectiveScanId, lastId)
      es.onopen = () => {
        if (alive) setStreamConnected(true)
      }
      es.onerror = () => {
        if (alive) setStreamConnected(false)
      }
      es.addEventListener('activity', (rawEv) => {
        const parsed = api.parseActivityEvent((rawEv as MessageEvent).data)
        if (!parsed || !alive) return
        setEvents((prev) =>
          prev.some((e) => e.id === parsed.id) ? prev : [...prev.slice(-299), parsed],
        )
      })
      es.addEventListener('resync', () => {
        if (!alive) return
        void api.getRecentEvents(effectiveScanId, 200).then((r) => {
          if (alive) setEvents(r.events || [])
        })
      })
    }

    void connect()
    return () => {
      alive = false
      es?.close()
    }
  }, [effectiveScanId])

  useEffect(() => {
    if (panelOpen && activeTab === 'trace') {
      traceEndRef.current?.scrollIntoView({ behavior: 'auto' })
    }
  }, [events.length, panelOpen, activeTab])

  const statusMeta = CTF_STATUS_META[effectiveStatus] || CTF_STATUS_META.unsolved
  const readyTargetUrls = useMemo(() => {
    const env = challenge?.environment
    if (!env || env.status !== 'ready') return []
    const list = [...(env.accessUrls || [])]
    if (env.accessUrl && !list.includes(env.accessUrl)) list.unshift(env.accessUrl)
    return list
  }, [challenge?.environment])

  const latestEvent = events.at(-1) || null

  const handleStartSolve = async () => {
    setBusyAction(true)
    try {
      const res = await api.solveChallenge(challengeRef.id)
      push(res.message || '已投入自动解题队列', 'success')
      setPanelOpen(true)
      setActiveTab('trace')
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
    if (ch?.environment?.status === 'ready') {
      if (ch.environment.accessUrl) urls.push(ch.environment.accessUrl)
      for (const u of ch.environment.accessUrls || []) {
        if (u && !urls.includes(u)) urls.push(u)
      }
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
    if (!latest || latest.environment?.status !== 'ready') {
      try {
        latest = await api.getKernelChallenge(challengeRef.id)
        setChallenge(latest)
      } catch {
        // fallback
      }
    }
    setPanelOpen(false)
    onQuickPrompt(buildInteractivePrompt(latest))
  }

  const confirmedFlag = challenge?.confirmedFlag || challengeRef.confirmedFlag
  const candidateFlag = challenge?.candidateFlag || challengeRef.candidateFlag

  return (
    <div className="shrink-0 border-b border-line bg-surface/90 backdrop-blur">
      {/* Always-visible Sticky Cockpit Bar */}
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-subtle px-2 py-1 text-xs font-medium text-ink transition-colors hover:border-accent/50"
            title={panelOpen ? '收起题目驾驶舱与自动解题流' : '展开题目驾驶舱与自动解题流'}
          >
            {panelOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-ink-muted" />
            )}
            <Flag className="h-3 w-3 text-accent" />
            <span className="truncate max-w-[160px]">{challenge?.title || challengeRef.title}</span>
          </button>

          <Badge pulse={isSolving} className={statusMeta.badge}>
            {statusMeta.label}
          </Badge>

          {readyTargetUrls.length > 0 && (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(readyTargetUrls[0])
                setCopiedUrl(readyTargetUrls[0])
                window.setTimeout(() => setCopiedUrl(null), 1500)
              }}
              className="inline-flex max-w-[260px] items-center gap-1.5 rounded-md border border-indigo-300/50 bg-accent-soft/40 px-2 py-0.5 font-mono text-[11px] text-ink transition-colors hover:border-accent"
              title={`点击复制靶机地址：${readyTargetUrls[0]}`}
            >
              <Globe className="h-3 w-3 shrink-0 text-accent" />
              <span className="truncate">{readyTargetUrls[0]}</span>
              {copiedUrl === readyTargetUrls[0] ? (
                <Check className="h-3 w-3 shrink-0 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3 shrink-0 text-ink-muted" />
              )}
            </button>
          )}

          {(effectiveScanId || events.length > 0) && (
            <button
              type="button"
              onClick={() => {
                setPanelOpen(true)
                setActiveTab('trace')
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-line-subtle bg-subtle/80 px-2 py-0.5 text-[11px] text-ink-secondary transition-colors hover:border-accent/50 hover:text-ink"
              title="查看后台自动解题实时轨迹"
            >
              <Activity
                className={cn(
                  'h-3 w-3 shrink-0',
                  isSolving ? 'animate-pulse text-emerald-500' : 'text-ink-muted',
                )}
              />
              <span className="font-mono tabular-nums">{events.length} 事件</span>
              {latestEvent && !panelOpen && (
                <span className="hidden max-w-[200px] truncate font-mono text-[10px] text-ink-muted md:inline">
                  · {cleanEventSummary(latestEvent)}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void Promise.all([loadChallenge(), onRefreshSession()])}
            title="刷新题目与靶机状态"
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
              <Button size="sm" variant="ghost" title="在智能体活动流全屏查看">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Expandable Docked Cockpit Panel */}
      {panelOpen && (
        <div className="border-t border-line-subtle bg-subtle/40">
          <div className="mx-auto max-w-4xl space-y-3 px-4 py-3.5 sm:px-6">
            {/* Error Banner */}
            {(challenge?.lastError || challenge?.environment?.lastError) && (
              <div className="flex items-start gap-2 rounded-xl border border-red-300/60 bg-red-50/70 px-3 py-2 text-xs text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{challenge?.lastError || challenge?.environment?.lastError}</span>
              </div>
            )}

            {/* Flag Bar */}
            {confirmedFlag ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-300/60 bg-emerald-50/70 px-3 py-2 text-xs dark:border-emerald-800 dark:bg-emerald-950/40">
                <div className="flex items-center gap-2 font-mono text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span className="font-semibold">已确认 Flag：</span>
                  <span className="break-all">{confirmedFlag}</span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    void navigator.clipboard?.writeText(confirmedFlag)
                    push('已复制 Flag', 'success')
                  }}
                >
                  <Copy className="h-3 w-3" />
                  复制
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={flagDraft}
                  onChange={(e) => setFlagDraft(e.target.value)}
                  placeholder={candidateFlag ? `候选 Flag: ${candidateFlag}` : '输入或粘贴 Flag 提交验真…'}
                  className="h-8 flex-1 font-mono text-xs"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  loading={submittingFlag}
                  disabled={!flagDraft.trim()}
                  onClick={() => void handleSubmitFlag()}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  提交 Flag
                </Button>
              </div>
            )}

            {/* Tabs: Auto-Solve Live Trace vs Challenge Brief */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex rounded-lg border border-line bg-surface p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveTab('trace')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors',
                    activeTab === 'trace'
                      ? 'bg-subtle text-ink shadow-editorial'
                      : 'text-ink-muted hover:text-ink',
                  )}
                >
                  <Activity className="h-3 w-3 text-accent" />
                  后台自动解题流 ({events.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('brief')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors',
                    activeTab === 'brief'
                      ? 'bg-subtle text-ink shadow-editorial'
                      : 'text-ink-muted hover:text-ink',
                  )}
                >
                  <FileText className="h-3 w-3" />
                  题面与附件
                </button>
              </div>

              <div className="flex items-center gap-2 text-[11px]">
                {isSolving && (
                  <span className="inline-flex items-center gap-1.5 text-accent">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {streamConnected ? 'SSE 实时推送中' : '连接实时流…'}
                  </span>
                )}
                {!hasChatMessages && (
                  <Button size="sm" variant="secondary" onClick={() => void handleQuickLaunch()}>
                    <Send className="h-3 w-3" />
                    一键带题面开始对话解题
                  </Button>
                )}
              </div>
            </div>

            {activeTab === 'trace' ? (
              <div className="max-h-[34vh] space-y-1.5 overflow-y-auto rounded-xl border border-line bg-canvas/70 p-2.5">
                {loadingEvents && events.length === 0 ? (
                  <div className="flex items-center gap-2 py-4 text-xs text-ink-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    正在拉取自动解题过程记录…
                  </div>
                ) : events.length === 0 ? (
                  <div className="py-5 text-center text-xs text-ink-muted">
                    {isSolving
                      ? '任务已受理，正在等待 Worker 启动靶机并推送首条执行事件…'
                      : '暂无后台自动解题记录，可点击右上角「启动自动解题」或直接在下方对话交互。'}
                  </div>
                ) : (
                  <>
                    {events.map((ev) => (
                      <SolveEventRow key={ev.id} ev={ev} />
                    ))}
                    <div ref={traceEndRef} />
                  </>
                )}
              </div>
            ) : (
              <div className="max-h-[34vh] space-y-2.5 overflow-y-auto rounded-xl border border-line bg-surface p-3.5 text-xs">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-secondary">
                  <Badge>{challengeRef.platformName || 'CTF2'}</Badge>
                  {challenge?.category && <Badge className="font-mono">{challenge.category}</Badge>}
                  {(challenge?.score ?? challengeRef.score) != null && (
                    <span className="font-mono font-semibold">{challenge?.score ?? challengeRef.score} pts</span>
                  )}
                  {challenge?.remoteId && (
                    <span className="font-mono text-[10px] text-ink-muted">
                      remoteId: {challenge.remoteId}
                    </span>
                  )}
                </div>
                {challenge?.description ? (
                  <MarkdownView content={challenge.description} />
                ) : (
                  <p className="text-ink-muted">暂无题面描述。</p>
                )}
                {challenge?.attachments && challenge.attachments.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-line-subtle pt-2.5">
                    <Paperclip className="h-3.5 w-3.5 text-ink-muted" />
                    <span className="text-ink-secondary">题目附件：</span>
                    {challenge.attachments.map((att, idx) => (
                      <span
                        key={idx}
                        className="rounded-md border border-line bg-subtle px-2 py-0.5 font-mono text-[11px] text-ink"
                      >
                        {att.name || att.url || `附件 ${idx + 1}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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
