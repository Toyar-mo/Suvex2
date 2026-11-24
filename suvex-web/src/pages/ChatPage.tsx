import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Archive,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cpu,
  Download,
  FolderOpen,
  GitBranch,
  GitFork,
  ListTodo,
  Loader2,
  MessagesSquare,
  Paperclip,
  Pin,
  Play,
  Plus,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Square,
  Trash2,
  Workflow,
  Wrench,
  X,
} from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { formatBytes, formatRelativeTime } from '@/lib/format'
import type {
  AgentProfileOut,
  ChatAttachmentOut,
  ChatContextOut,
  ChatFileOut,
  ChatMessageOut,
  ChatSessionDetailOut,
  ChatSessionOut,
  ChatSessionTreeOut,
  ChatTodoOut,
  ChatTurnRunOut,
  ProviderOut,
} from '@/types/api'
import { Badge, Button, Drawer, EmptyState } from '@/components/ui/primitives'
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

function classifyAttackStage(toolName: string): { stage: string; color: string } {
  const n = toolName.toLowerCase()
  if (/recon|scan|nmap|httpx|list|read|search|browse|fetch/.test(n)) {
    return { stage: '侦察与测绘', color: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300' }
  }
  if (/poc|exploit|shell|exec|sql|inject|submit/.test(n)) {
    return { stage: '利用与验证', color: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/50 dark:text-orange-300' }
  }
  if (/report|write|save|skill|todo/.test(n)) {
    return { stage: '归档与交付', color: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300' }
  }
  return { stage: '分析推理', color: 'border-line bg-subtle text-ink-secondary' }
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
  const [todos, setTodos] = useState<ChatTodoOut[]>([])
  const [turns, setTurns] = useState<ChatTurnRunOut[]>([])
  const [providers, setProviders] = useState<ProviderOut[]>([])
  const [profiles, setProfiles] = useState<AgentProfileOut[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<string>('')
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')

  // Side drawers: Session Tree / Workspace Files & Attack Chain
  const [treeOpen, setTreeOpen] = useState(false)
  const [treeData, setTreeData] = useState<ChatSessionTreeOut | null>(null)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [workspaceTab, setWorkspaceTab] = useState<'files' | 'chain'>('files')
  const [sessionFiles, setSessionFiles] = useState<ChatFileOut[]>([])

  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<ChatAttachmentOut[]>([])
  const [uploading, setUploading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [streamPhase, setStreamPhase] = useState<string | null>(null)
  const [streamText, setStreamText] = useState('')
  const [streamReasoning, setStreamReasoning] = useState('')
  const [liveToolOut, setLiveToolOut] = useState('')
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [resuming, setResuming] = useState(false)

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

  const loadDetail = useCallback(
    async (id: string) => {
      setLoadingDetail(true)
      try {
        const [d, ctx, tds, trns, fls] = await Promise.all([
          api.getChatSession(id, 180),
          api.getChatContext(id).catch(() => null),
          api.getChatTodos(id).catch(() => []),
          api.getChatTurns(id).catch(() => []),
          api.listSessionFiles(id).catch(() => []),
        ])
        setDetail(d)
        setContextInfo(ctx)
        setTodos(tds)
        setTurns(trns)
        setSessionFiles(fls)
        if (d.providerId) setSelectedProviderId(d.providerId)
        setSelectedProfileId(d.agentProfileId || '')
      } catch (err) {
        push(err instanceof ApiClientError ? err.message : '加载会话失败', 'error')
      } finally {
        setLoadingDetail(false)
      }
    },
    [push],
  )

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
    api
      .listAgentProfiles()
      .then((list) => setProfiles(list.filter((p) => p.enabled)))
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

  // Auto-reattach live polling if user opens/refreshes a running session
  useEffect(() => {
    if (!activeId || !detail?.running || streaming) return
    let alive = true
    let cursor = 0
    setStreamPhase('已自动续接后台运行中的智能体轮次…')

    const poll = async () => {
      while (alive) {
        try {
          const snap = await api.pollChatLive(activeId, cursor)
          if (!alive) break
          cursor = snap.next
          for (const frame of snap.frames) {
            if (frame.event === 'delta' && typeof frame.data.text === 'string') {
              setStreamText((prev) => prev + String(frame.data.text))
            } else if (frame.event === 'reasoning' && typeof frame.data.text === 'string') {
              setStreamReasoning((prev) => prev + String(frame.data.text))
            } else if (frame.event === 'phase') {
              setStreamPhase(`后台运行中 · ${String(frame.data.phase || '')}`)
            } else if (frame.event === 'message') {
              setStreamText('')
              setStreamReasoning('')
              const m = frame.data as unknown as ChatMessageOut
              setDetail((prev) => {
                if (!prev || prev.messages.some((x) => x.id === m.id)) return prev
                return { ...prev, messages: [...prev.messages, m] }
              })
            }
          }
          if (snap.ended) {
            setStreamPhase(null)
            await loadDetail(activeId)
            await loadSessions()
            break
          }
        } catch {
          break
        }
      }
    }
    void poll()
    return () => {
      alive = false
    }
  }, [activeId, detail?.running, streaming, loadDetail, loadSessions])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [detail?.messages.length, streamText, streamReasoning, liveToolOut])

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const base = showArchived ? sessions : sessions.filter((s) => !s.archived)
    if (!q) return base
    return base.filter((s) => s.title.toLowerCase().includes(q))
  }, [sessions, searchQuery, showArchived])

  const resumableTurn = useMemo(() => {
    return turns.find((t) => t.resumable && t.status === 'interrupted') || null
  }, [turns])

  const attackChainSteps = useMemo(() => {
    if (!detail) return []
    return detail.messages
      .filter((m) => m.role === 'tool' || m.toolName)
      .map((m, idx) => ({
        index: idx + 1,
        id: m.id,
        toolName: m.toolName || 'tool',
        failed: Boolean(m.toolFailed),
        durationMs: m.durationMs,
        createdAt: m.createdAt,
        summary: m.content.slice(0, 140),
        ...classifyAttackStage(m.toolName || ''),
      }))
  }, [detail])

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

  const handleProfileChange = async (profileId: string) => {
    setSelectedProfileId(profileId)
    if (!activeId) return
    try {
      await api.updateChatSettings(activeId, { agentProfileId: profileId || null })
      push(profileId ? '已绑定 Agent 角色画像（工具与技能边界生效）' : '已切换为平台默认角色', 'success')
      await loadDetail(activeId)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '切换角色失败', 'error')
    }
  }

  const handleFork = async (messageSeq?: number) => {
    if (!activeId) return
    try {
      const forked = await api.forkChatSession(activeId, { messageSeq })
      push(`已分叉出新分支：${forked.title}`, 'success')
      await loadSessions()
      handleSelectSession(forked.id)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '分叉会话失败', 'error')
    }
  }

  const handleOpenTree = async () => {
    if (!activeId) return
    setTreeOpen(true)
    try {
      const t = await api.getChatSessionTree(activeId)
      setTreeData(t)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载分支树失败', 'error')
    }
  }

  const handleResumeTurn = async (runId: string) => {
    if (!activeId) return
    setResuming(true)
    try {
      await api.resumeChatTurn(activeId, runId)
      push('已接手并恢复中断的对话轮次', 'success')
      await loadDetail(activeId)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '恢复轮次失败', 'error')
    } finally {
      setResuming(false)
    }
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

    if (streaming || detail?.running) {
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
          onAwaiting: () => setStreamPhase('等待人工审批工具调用'),
          onError: (message) => push(message, 'error'),
          onDone: () => setStreamPhase(null),
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
                      {s.forkedFromSessionId && (
                        <GitFork className="h-3 w-3 shrink-0 text-ink-muted" />
                      )}
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
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line bg-surface px-5 py-3">
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
                {contextInfo.percent >= 50 && (
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

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Agent Profile Binding Selector */}
            {profiles.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg border border-line bg-subtle px-2 py-1 text-xs">
                <Bot className="h-3.5 w-3.5 text-accent" />
                <select
                  value={selectedProfileId}
                  onChange={(e) => void handleProfileChange(e.target.value)}
                  className="max-w-[140px] bg-transparent text-xs text-ink focus:outline-none"
                  title="绑定 Agent 角色画像（控制工具白名单与技能注入）"
                >
                  <option value="">默认通用角色</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Model Selector */}
            {providers.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg border border-line bg-subtle px-2 py-1 text-xs">
                <Cpu className="h-3.5 w-3.5 text-ink-muted" />
                <select
                  value={selectedProviderId}
                  onChange={(e) => setSelectedProviderId(e.target.value)}
                  className="max-w-[150px] bg-transparent text-xs text-ink focus:outline-none"
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {activeId && (
              <>
                <Button size="sm" variant="ghost" onClick={() => void handleFork()} title="从当前位置分叉新分支">
                  <GitFork className="h-3.5 w-3.5" />
                  分叉
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void handleOpenTree()} title="查看会话分支树">
                  <GitBranch className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant={workspaceOpen ? 'primary' : 'secondary'}
                  onClick={() => setWorkspaceOpen((v) => !v)}
                  title="打开工作区文件与攻击链图"
                >
                  <Workflow className="h-3.5 w-3.5" />
                  工作区 ({sessionFiles.length})
                </Button>
                <a href={api.getChatExportUrl(activeId)} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="ghost" title="导出 JSONL 审计日志">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </a>
              </>
            )}
          </div>
        </div>

        {/* Live Plan / Todo Strip */}
        {todos.length > 0 && (
          <div className="border-b border-line bg-subtle/70 px-5 py-2">
            <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 font-medium text-ink">
                <ListTodo className="h-3.5 w-3.5 text-accent" />
                执行计划 ({todos.filter((t) => t.status === 'done').length}/{todos.length})
              </span>
              {todos.map((t) => (
                <span
                  key={t.seq}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
                    t.status === 'done'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 line-through dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : t.status === 'in_progress'
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300'
                        : 'border-line bg-surface text-ink-secondary',
                  )}
                >
                  {t.status === 'done' && <CheckCircle2 className="h-3 w-3" />}
                  {t.text}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Resumable Interrupted Turn Banner */}
        {resumableTurn && !streaming && !detail?.running && (
          <div className="border-b border-amber-200 bg-amber-50/80 px-5 py-2.5 dark:border-amber-900/60 dark:bg-amber-950/40">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 text-xs">
              <span className="text-amber-900 dark:text-amber-200">
                检测到上一轮执行在半路中断（已完成 {resumableTurn.roundIndex} 回合、调用{' '}
                {resumableTurn.toolsUsed} 次工具），可一键续跑接手。
              </span>
              <Button
                size="sm"
                variant="primary"
                loading={resuming}
                onClick={() => void handleResumeTurn(resumableTurn.id)}
              >
                <Play className="h-3 w-3" />
                恢复续跑
              </Button>
            </div>
          </div>
        )}

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
                description="上方可直接绑定自定义 Agent 角色画像约束工具边界，支持分支 Fork、实时计划条、附件分析与攻击链可视化。"
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
                    <div key={msg.id} className="group flex items-start justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void handleFork(msg.seq)}
                        className="mt-2 hidden rounded p-1 text-ink-muted hover:bg-wash hover:text-ink group-hover:block"
                        title="从此消息分叉新分支"
                      >
                        <GitFork className="h-3.5 w-3.5" />
                      </button>
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
                  <div
                    key={msg.id}
                    className="group rounded-editorial border border-line bg-surface p-5 shadow-editorial"
                  >
                    <div className="mb-2 flex items-center justify-between text-[11px] text-ink-muted">
                      <span className="font-mono font-medium text-ink-secondary">Suvex Agent</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleFork(msg.seq)}
                          className="hidden items-center gap-1 rounded px-1.5 py-0.5 text-[10px] hover:bg-wash hover:text-ink group-hover:inline-flex"
                        >
                          <GitFork className="h-3 w-3" />
                          在此分叉
                        </button>
                        <span className="font-mono">{formatRelativeTime(msg.createdAt)}</span>
                      </div>
                    </div>
                    {msg.reasoning && <ReasoningAccordion text={msg.reasoning} />}
                    {msg.content && <MarkdownView content={msg.content} />}
                  </div>
                )
              })
            )}

            {/* Live Streaming / Reattached Turn Card */}
            {(streaming || streamPhase) && (
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
                  streaming || detail?.running
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
                {streaming || detail?.running ? '插话' : '发送'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Session Tree Drawer */}
      <Drawer
        open={treeOpen}
        onClose={() => setTreeOpen(false)}
        title="会话分支树"
        subtitle="同一对话历史下的所有探索分支，点击即可切换"
      >
        {!treeData || treeData.nodes.length === 0 ? (
          <p className="text-xs text-ink-muted">当前会话尚无分支。</p>
        ) : (
          <div className="space-y-2.5">
            {treeData.nodes.map((node) => (
              <div
                key={node.id}
                onClick={() => {
                  handleSelectSession(node.id)
                  setTreeOpen(false)
                }}
                className={cn(
                  'cursor-pointer rounded-editorial border p-3.5 transition-colors',
                  node.current
                    ? 'border-accent bg-accent-soft/50'
                    : 'border-line bg-surface hover:border-line-strong',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ink">{node.title || node.id}</span>
                  {node.current && <Badge>当前分支</Badge>}
                </div>
                <p className="mt-1 font-mono text-[10px] text-ink-muted">
                  {node.messageCount} 条消息 ·{' '}
                  {node.forkedFromSeq != null ? `分叉自 #${node.forkedFromSeq}` : '主干根节点'}
                </p>
                {node.branchSummary && (
                  <p className="mt-1.5 text-xs text-ink-secondary">{node.branchSummary}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Drawer>

      {/* Workspace Files & Attack Chain Drawer */}
      <Drawer
        open={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
        title="会话工作区与攻击链"
        subtitle="检视沙箱产物文件与本会话自动提取的攻击链路"
      >
        <div className="mb-4 flex gap-1.5 border-b border-line pb-3">
          <button
            type="button"
            onClick={() => setWorkspaceTab('files')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium',
              workspaceTab === 'files'
                ? 'bg-ink text-canvas'
                : 'border border-line bg-surface text-ink-secondary',
            )}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            工作区文件 ({sessionFiles.length})
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceTab('chain')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium',
              workspaceTab === 'chain'
                ? 'bg-ink text-canvas'
                : 'border border-line bg-surface text-ink-secondary',
            )}
          >
            <Workflow className="h-3.5 w-3.5" />
            攻击链路径 ({attackChainSteps.length})
          </button>
        </div>

        {workspaceTab === 'files' ? (
          sessionFiles.length === 0 ? (
            <EmptyState
              icon={<FolderOpen className="h-4 w-4" />}
              title="工作区暂无文件"
              description="智能体写入 `/work/persist` 的脚本、取证包和报告都会实时列在这里。"
            />
          ) : (
            <div className="space-y-2">
              {sessionFiles.map((f) => (
                <div
                  key={f.path}
                  className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono font-medium text-ink">{f.name}</p>
                    <p className="font-mono text-[10px] text-ink-muted">
                      {f.path} · {formatBytes(f.sizeBytes)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {activeId && (
                      <>
                        <a
                          href={api.getChatFileDownloadUrl(activeId, f.path)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Button size="sm" variant="ghost">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await api.deleteChatFile(activeId, f.path)
                            setSessionFiles((prev) => prev.filter((x) => x.path !== f.path))
                            push(`已删除 ${f.name}`, 'default')
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-ink-muted hover:text-red-600" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : attackChainSteps.length === 0 ? (
          <EmptyState
            icon={<Workflow className="h-4 w-4" />}
            title="暂无攻击链步骤"
            description="当智能体在会话中调用侦察、利用与验证工具后，会自动构建阶段化的攻击链路图。"
          />
        ) : (
          <div className="relative space-y-3 pl-5 before:absolute before:bottom-3 before:left-2 before:top-3 before:w-px before:bg-line-strong">
            {attackChainSteps.map((step) => (
              <div
                key={step.id}
                className="relative rounded-lg border border-line bg-surface p-3.5 text-xs shadow-editorial"
              >
                <span
                  className={cn(
                    'absolute -left-[17px] top-4 h-2.5 w-2.5 rounded-full border-2 border-canvas',
                    step.failed ? 'bg-red-500' : 'bg-accent',
                  )}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-ink-muted">#{step.index}</span>
                    <Badge className={step.color}>{step.stage}</Badge>
                    <span className="font-mono font-semibold text-ink">{step.toolName}</span>
                  </div>
                  {step.durationMs != null && (
                    <span className="font-mono text-[10px] text-ink-muted">
                      {(step.durationMs / 1000).toFixed(2)}s
                    </span>
                  )}
                </div>
                {step.summary && (
                  <p className="mt-1.5 line-clamp-2 font-mono text-[11px] text-ink-secondary">
                    {step.summary}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  )
}
