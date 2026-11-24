import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  Cpu,
  Loader2,
  MessagesSquare,
  Paperclip,
  Pin,
  Plus,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Square,
  Wrench,
  X,
} from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { formatBytes, formatRelativeTime } from '@/lib/format'
import type {
  ChatAttachmentOut,
  ChatContextOut,
  ChatMessageOut,
  ChatSessionDetailOut,
  ChatSessionOut,
  ProviderOut,
} from '@/types/api'
import { Badge, Button, EmptyState } from '@/components/ui/primitives'
import { MarkdownView } from '@/components/ui/MarkdownView'
import { cn } from '@/lib/cn'

function ReasoningAccordion({ text, streaming }: { text: string; streaming?: boolean }) {
  const [open, setOpen] = useState(Boolean(streaming))
  return (
    <div className="mb-2.5 rounded-lg border border-line bg-subtle/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] font-medium text-ink-secondary hover:text-ink"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Sparkles className="h-3 w-3 text-accent" />
        <span>{streaming ? '正在推理思考…' : '推理思考过程'}</span>
      </button>
      {open && (
        <div className="border-t border-line px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-secondary whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  )
}

function ToolCallCard({
  msg,
  onApprove,
}: {
  msg: ChatMessageOut
  onApprove?: (messageId: string, approve: boolean) => void
}) {
  const [expanded, setExpanded] = useState(msg.approvalStatus === 'pending')
  const isPending = msg.approvalStatus === 'pending'

  return (
    <div
      className={cn(
        'my-2 rounded-lg border bg-surface text-xs shadow-editorial',
        isPending
          ? 'border-amber-300 dark:border-amber-800'
          : msg.toolFailed
            ? 'border-red-200 dark:border-red-900/70'
            : 'border-line',
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
          )}
          <Wrench className="h-3.5 w-3.5 shrink-0 text-accent" />
          <span className="truncate font-mono font-medium text-ink">
            {msg.toolName || 'tool_call'}
          </span>
          {msg.durationMs != null && (
            <span className="font-mono text-[10px] tabular-nums text-ink-muted">
              {(msg.durationMs / 1000).toFixed(2)}s
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isPending && (
            <Badge className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              待人工审批
            </Badge>
          )}
          {msg.approvalStatus === 'approved' && (
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
              已批准
            </Badge>
          )}
          {msg.approvalStatus === 'rejected' && (
            <Badge className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
              已拒绝
            </Badge>
          )}
          {msg.toolFailed && !msg.approvalStatus && (
            <Badge className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
              执行异常
            </Badge>
          )}
        </div>
      </button>

      {expanded && (
        <div className="space-y-2.5 border-t border-line bg-subtle/50 px-3.5 py-3">
          {msg.toolArgs && Object.keys(msg.toolArgs).length > 0 && (
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                Arguments
              </p>
              <pre className="max-h-48 overflow-auto rounded-md border border-line bg-surface p-2.5 font-mono text-[11px] text-ink">
                {JSON.stringify(msg.toolArgs, null, 2)}
              </pre>
            </div>
          )}
          {msg.content && (
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                Output
              </p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-surface p-2.5 font-mono text-[11px] text-ink-secondary">
                {msg.content}
              </pre>
            </div>
          )}
          {isPending && onApprove && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/40">
              <span className="flex items-center gap-1.5 text-xs text-amber-900 dark:text-amber-200">
                <ShieldAlert className="h-3.5 w-3.5" />
                该工具调用需要人工确认后才可执行
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="danger" onClick={() => onApprove(msg.id, false)}>
                  拒绝
                </Button>
                <Button size="sm" variant="primary" onClick={() => onApprove(msg.id, true)}>
                  <Check className="h-3.5 w-3.5" />
                  批准执行
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { push } = useToast()

  const [sessions, setSessions] = useState<ChatSessionOut[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeId, setActiveId] = useState<string | null>(searchParams.get('session'))
  const [detail, setDetail] = useState<ChatSessionDetailOut | null>(null)
  const [contextInfo, setContextInfo] = useState<ChatContextOut | null>(null)
  const [providers, setProviders] = useState<ProviderOut[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<string>('')

  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<ChatAttachmentOut[]>([])
  const [uploading, setUploading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [streamPhase, setStreamPhase] = useState<string | null>(null)
  const [streamText, setStreamText] = useState('')
  const [streamReasoning, setStreamReasoning] = useState('')
  const [liveToolOut, setLiveToolOut] = useState('')
  const [loadingDetail, setLoadingDetail] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const loadSessions = useCallback(async () => {
    try {
      const list = await api.listChatSessions(showArchived)
      setSessions(list)
      if (!activeId && list.length > 0 && searchParams.get('new') !== '1') {
        setActiveId(list[0].id)
      }
    } catch {
      // handled silently
    }
  }, [activeId, searchParams, showArchived])

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true)
    try {
      const [d, ctx] = await Promise.all([
        api.getChatSession(id, 160),
        api.getChatContext(id).catch(() => null),
      ])
      setDetail(d)
      setContextInfo(ctx)
      if (d.providerId) setSelectedProviderId(d.providerId)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载会话失败', 'error')
    } finally {
      setLoadingDetail(false)
    }
  }, [push])

  useEffect(() => {
    void loadSessions()
    api
      .listProviders()
      .then((list) => {
        setProviders(list)
        const def = list.find((p) => p.isDefault) || list[0]
        if (def) setSelectedProviderId((prev) => prev || def.id)
      })
      .catch(() => {})
  }, [loadSessions])

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      void (async () => {
        try {
          const created = await api.createChatSession({})
          setSessions((prev) => [created, ...prev])
          setActiveId(created.id)
          setSearchParams({ session: created.id }, { replace: true })
        } catch (err) {
          push(err instanceof ApiClientError ? err.message : '创建会话失败', 'error')
        }
      })()
    }
  }, [push, searchParams, setSearchParams])

  useEffect(() => {
    if (activeId) {
      void loadDetail(activeId)
    } else {
      setDetail(null)
    }
  }, [activeId, loadDetail])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [detail?.messages.length, streamText, streamReasoning, liveToolOut])

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const base = showArchived ? sessions : sessions.filter((s) => !s.archived)
    if (!q) return base
    return base.filter((s) => s.title.toLowerCase().includes(q))
  }, [sessions, searchQuery, showArchived])

  const handleNewSession = async () => {
    try {
      const created = await api.createChatSession({})
      setSessions((prev) => [created, ...prev])
      setActiveId(created.id)
      setSearchParams({ session: created.id }, { replace: true })
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '创建会话失败', 'error')
    }
  }

  const handleSelectSession = (id: string) => {
    setActiveId(id)
    setSearchParams({ session: id }, { replace: true })
  }

  const handleTogglePin = async (s: ChatSessionOut) => {
    try {
      const updated = await api.pinChatSession(s.id, !s.pinned)
      setSessions((prev) => prev.map((x) => (x.id === s.id ? updated : x)))
    } catch {
      push('操作失败', 'error')
    }
  }

  const handleArchive = async (s: ChatSessionOut) => {
    try {
      if (s.archived) {
        await api.unarchiveChatSession(s.id)
      } else {
        await api.archiveChatSession(s.id)
        if (activeId === s.id) setActiveId(null)
      }
      await loadSessions()
    } catch {
      push('归档操作失败', 'error')
    }
  }

  const handleUploadFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    let targetSessionId = activeId
    if (!targetSessionId) {
      const created = await api.createChatSession({})
      setSessions((prev) => [created, ...prev])
      setActiveId(created.id)
      targetSessionId = created.id
    }
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const out = await api.uploadChatAttachment(targetSessionId, file)
        setAttachments((prev) => [...prev, out])
      }
      push('附件已上传至会话工作区', 'success')
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '附件上传失败', 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text) return

    let sid = activeId
    if (!sid) {
      try {
        const created = await api.createChatSession({})
        setSessions((prev) => [created, ...prev])
        setActiveId(created.id)
        setSearchParams({ session: created.id }, { replace: true })
        sid = created.id
      } catch (err) {
        push(err instanceof ApiClientError ? err.message : '创建会话失败', 'error')
        return
      }
    }

    // If a turn is currently streaming, send as an interjection
    if (streaming) {
      try {
        const msg = await api.interjectChat(sid, text)
        setDetail((prev) => (prev ? { ...prev, messages: [...prev.messages, msg] } : prev))
        setInput('')
        push('已插入消息，智能体将在下一轮读取', 'success')
      } catch (err) {
        push(err instanceof ApiClientError ? err.message : '插话失败', 'error')
      }
      return
    }

    const attIds = attachments.map((a) => a.id)
    setInput('')
    setAttachments([])
    setStreaming(true)
    setStreamPhase('正在连接模型…')
    setStreamText('')
    setStreamReasoning('')
    setLiveToolOut('')

    const optimisticUser: ChatMessageOut = {
      id: `local-${Date.now()}`,
      seq: (detail?.messages.at(-1)?.seq || 0) + 1,
      role: 'user',
      content: text,
      reasoning: null,
      toolName: null,
      toolArgs: null,
      toolFailed: null,
      durationMs: null,
      createdAt: new Date().toISOString(),
      surface: 'chat',
      approvalStatus: null,
      approvalDecidedBy: null,
      approvalDecidedAt: null,
    }
    setDetail((prev) =>
      prev ? { ...prev, messages: [...prev.messages, optimisticUser] } : prev,
    )

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      await api.streamChatMessage(
        sid,
        {
          content: text,
          providerId: selectedProviderId || undefined,
          attachmentIds: attIds.length ? attIds : undefined,
        },
        {
          onPhase: (p) => {
            if (p.phase === 'thinking') setStreamPhase(`第 ${(p.round || 0) + 1} 轮思考中…`)
            else if (p.phase === 'tool') setStreamPhase(`正在调用工具 ${p.tool || ''}…`)
            else if (p.phase === 'resume') setStreamPhase('正在自动纠偏续跑…')
          },
          onDelta: (chunk) => setStreamText((prev) => prev + chunk),
          onReasoning: (chunk) => setStreamReasoning((prev) => prev + chunk),
          onToolOutput: (p) => {
            const c = p.chunk || p.text || ''
            if (c) setLiveToolOut((prev) => (prev + c).slice(-4000))
          },
          onMessage: (msg) => {
            setStreamText('')
            setStreamReasoning('')
            setLiveToolOut('')
            setDetail((prev) => {
              if (!prev) return prev
              const withoutLocal =
                msg.role === 'user'
                  ? prev.messages.filter((m) => !m.id.startsWith('local-'))
                  : prev.messages
              if (withoutLocal.some((m) => m.id === msg.id)) return prev
              return { ...prev, messages: [...withoutLocal, msg] }
            })
          },
          onAwaiting: () => {
            setStreamPhase('等待人工审批工具调用')
          },
          onError: (message) => {
            push(message, 'error')
          },
          onDone: () => {
            setStreamPhase(null)
          },
        },
        ctrl.signal,
      )
      await Promise.all([loadDetail(sid), loadSessions()])
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        push(err instanceof ApiClientError ? err.message : '对话请求中断', 'error')
      }
      await loadDetail(sid)
    } finally {
      setStreaming(false)
      setStreamPhase(null)
      setStreamText('')
      setStreamReasoning('')
      setLiveToolOut('')
      abortRef.current = null
    }
  }

  const handleStop = async () => {
    if (!activeId) return
    try {
      await api.interruptChat(activeId, 'stop', '用户手动停止')
      abortRef.current?.abort()
      push('已请求中断本轮执行', 'default')
    } catch {
      abortRef.current?.abort()
    }
  }

  const handleApprove = async (messageId: string, approve: boolean) => {
    if (!activeId) return
    try {
      await api.approveChatTool(activeId, messageId, approve)
      push(approve ? '已批准工具执行' : '已拒绝该工具调用', 'success')
      await loadDetail(activeId)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '审批操作失败', 'error')
    }
  }

  const handleCompact = async () => {
    if (!activeId) return
    try {
      await api.compactChatSession(activeId)
      push('上下文已完成摘要压缩', 'success')
      await loadDetail(activeId)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '上下文压缩失败', 'error')
    }
  }

  return (
    <div className="flex h-full bg-canvas">
      {/* Left Session Rail */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
          <h2 className="text-sm font-semibold text-ink">会话线程</h2>
          <Button size="sm" variant="primary" onClick={handleNewSession}>
            <Plus className="h-3.5 w-3.5" />
            新建
          </Button>
        </div>

        <div className="border-b border-line px-3 py-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-muted" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索历史会话..."
              className="h-8 w-full rounded-lg border border-line bg-subtle pl-8 pr-3 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-[11px] text-ink-muted">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-line"
            />
            显示已归档会话
          </label>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-2.5">
          {filteredSessions.length === 0 ? (
            <div className="py-12 text-center text-xs text-ink-muted">暂无会话</div>
          ) : (
            filteredSessions.map((s) => {
              const active = s.id === activeId
              return (
                <div
                  key={s.id}
                  onClick={() => handleSelectSession(s.id)}
                  className={cn(
                    'group flex cursor-pointer items-start justify-between gap-2 rounded-lg px-3 py-2.5 transition-colors',
                    active
                      ? 'bg-subtle text-ink ring-1 ring-line'
                      : 'text-ink-secondary hover:bg-subtle/60 hover:text-ink',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {s.pinned && <Pin className="h-3 w-3 shrink-0 text-accent" />}
                      {s.running && (
                        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" />
                      )}
                      <span className="truncate text-xs font-medium text-ink">
                        {s.title || '未命名会话'}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] text-ink-muted">
                      {s.messageCount} 条 · {formatRelativeTime(s.updatedAt)}
                    </p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleTogglePin(s)
                      }}
                      className="rounded p-1 text-ink-muted hover:bg-wash hover:text-ink"
                      title={s.pinned ? '取消置顶' : '置顶'}
                    >
                      <Pin className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleArchive(s)
                      }}
                      className="rounded p-1 text-ink-muted hover:bg-wash hover:text-ink"
                      title={s.archived ? '取消归档' : '归档'}
                    >
                      <Archive className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </aside>

      {/* Main Conversation Canvas */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Session Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold text-ink">
                {detail?.title || '安全智能体对话工作台'}
              </h1>
              {detail?.challenge && (
                <Badge className="border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300">
                  CTF · {detail.challenge.title}
                </Badge>
              )}
            </div>
            {contextInfo && (
              <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-ink-muted">
                <span>
                  上下文 {contextInfo.percent}% ({contextInfo.usedTokens.toLocaleString()} /{' '}
                  {contextInfo.windowTokens.toLocaleString()})
                </span>
                {contextInfo.percent >= 55 && (
                  <button
                    type="button"
                    onClick={handleCompact}
                    className="text-accent hover:underline"
                  >
                    压缩上下文
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {providers.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg border border-line bg-subtle px-2.5 py-1 text-xs">
                <Cpu className="h-3.5 w-3.5 text-ink-muted" />
                <select
                  value={selectedProviderId}
                  onChange={(e) => setSelectedProviderId(e.target.value)}
                  className="bg-transparent text-xs text-ink focus:outline-none"
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} ({p.model})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Button size="sm" variant="secondary" className="lg:hidden" onClick={handleNewSession}>
              <Plus className="h-3.5 w-3.5" />
              新会话
            </Button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <div className="mx-auto max-w-3xl space-y-5">
            {loadingDetail ? (
              <div className="flex items-center justify-center py-20 text-xs text-ink-muted">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                加载会话记录…
              </div>
            ) : !detail || detail.messages.length === 0 ? (
              <EmptyState
                icon={<MessagesSquare className="h-5 w-5" />}
                title="向 Suvex 2 智能体下达安全任务"
                description="你可以直接让它分析目标 URL、审计上传的代码/流量包、复现漏洞或启动 CTF 沙箱解题。"
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    {[
                      '帮我检查当前平台的沙箱与模型配置状态',
                      '总结最近一次扫描中已确证的高危漏洞',
                      '分析一份 Web 登录接口可能存在的认证绕过面',
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setInput(prompt)}
                        className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink-secondary shadow-editorial hover:border-line-strong hover:text-ink"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                }
              />
            ) : (
              detail.messages.map((msg) => {
                if (msg.role === 'user') {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-ink px-4 py-2.5 text-sm leading-relaxed text-canvas shadow-sm">
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  )
                }

                if (msg.role === 'tool' || msg.toolName) {
                  return <ToolCallCard key={msg.id} msg={msg} onApprove={handleApprove} />
                }

                return (
                  <div key={msg.id} className="rounded-editorial border border-line bg-surface p-5 shadow-editorial">
                    <div className="mb-2 flex items-center justify-between text-[11px] text-ink-muted">
                      <span className="font-mono font-medium text-ink-secondary">Suvex Agent</span>
                      <span className="font-mono">{formatRelativeTime(msg.createdAt)}</span>
                    </div>
                    {msg.reasoning && <ReasoningAccordion text={msg.reasoning} />}
                    {msg.content && <MarkdownView content={msg.content} />}
                  </div>
                )
              })
            )}

            {/* Live Streaming Turn Card */}
            {streaming && (
              <div className="rounded-editorial border border-accent/30 bg-surface p-5 shadow-editorial">
                <div className="mb-3 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-2 font-medium text-accent">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {streamPhase || '正在处理…'}
                  </span>
                  <Button size="sm" variant="danger" onClick={handleStop}>
                    <Square className="h-3 w-3" />
                    停止
                  </Button>
                </div>
                {streamReasoning && <ReasoningAccordion text={streamReasoning} streaming />}
                {liveToolOut && (
                  <pre className="mb-3 max-h-48 overflow-auto rounded-lg border border-line bg-subtle p-3 font-mono text-[11px] text-ink-secondary">
                    {liveToolOut}
                  </pre>
                )}
                {streamText && <MarkdownView content={streamText} />}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Composer Dock */}
        <div className="border-t border-line bg-surface px-5 py-3.5">
          <div className="mx-auto max-w-3xl">
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {attachments.map((att) => (
                  <span
                    key={att.id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-line bg-subtle px-2 py-1 text-xs text-ink-secondary"
                  >
                    <Paperclip className="h-3 w-3" />
                    <span className="max-w-[180px] truncate">{att.name}</span>
                    <span className="font-mono text-[10px] text-ink-muted">
                      {formatBytes(att.sizeBytes)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                      className="text-ink-muted hover:text-ink"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2 rounded-xl border border-line bg-canvas p-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => void handleUploadFile(e.target.files)}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-wash hover:text-ink"
                title="上传附件到工作区"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </button>

              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSend()
                  }
                }}
                placeholder={
                  streaming
                    ? '运行中可输入插话，智能体会在下一轮读取…'
                    : '输入安全指令、目标或问题（Enter 发送，Shift+Enter 换行）'
                }
                className="max-h-36 flex-1 resize-none bg-transparent py-1.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
              />

              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleSend()}
                disabled={!input.trim()}
                className="h-8 px-3"
              >
                <Send className="h-3.5 w-3.5" />
                {streaming ? '插话' : '发送'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
