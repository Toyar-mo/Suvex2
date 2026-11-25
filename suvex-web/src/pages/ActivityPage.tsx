import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Columns3,
  Compass,
  Copy,
  ExternalLink,
  Flag,
  Flame,
  List,
  Pause,
  Play,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Terminal,
  Wifi,
  WifiOff,
  Wrench,
  X,
  XCircle,
} from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { formatDuration, formatRelativeTime, SCAN_STATUS_META } from '@/lib/format'
import type { ActivityEventOut, AgentOut, ScanOut } from '@/types/api'
import { Badge, Button, EmptyState, Select } from '@/components/ui/primitives'
import { MeshAuroraShader } from '@/components/ui/ShaderCanvas'
import { TactileAppIcon } from '@/components/ui/AppIcons'
import { cn } from '@/lib/cn'

/* --------------------------------------------------------------------------
   Helpers: Semantic Metadata, Clean Agent Formatting, Truncation Extraction
   -------------------------------------------------------------------------- */

const PHASE_LABELS: Record<string, { label: string; cls: string }> = {
  recon: {
    label: '侦察',
    cls: 'border-sky-300/60 bg-sky-50/70 text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/50 dark:text-sky-300',
  },
  scan: {
    label: '探测',
    cls: 'border-cyan-300/60 bg-cyan-50/70 text-cyan-700 dark:border-cyan-800/70 dark:bg-cyan-950/50 dark:text-cyan-300',
  },
  exploit: {
    label: '利用',
    cls: 'border-indigo-300/60 bg-indigo-50/70 text-indigo-700 dark:border-indigo-800/70 dark:bg-indigo-950/50 dark:text-indigo-300',
  },
  verify: {
    label: '验证',
    cls: 'border-emerald-300/60 bg-emerald-50/70 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-300',
  },
  report: {
    label: '报告',
    cls: 'border-violet-300/60 bg-violet-50/70 text-violet-700 dark:border-violet-800/70 dark:bg-violet-950/50 dark:text-violet-300',
  },
}

const ROLE_LABELS: Record<string, string> = {
  recon: '侦察',
  scanner: '扫描',
  exploiter: '利用',
  verifier: '验证',
  reporter: '报告',
}

const AGENT_STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
  running: { label: '运行中', dot: 'bg-emerald-500 animate-pulse', text: 'text-emerald-600 dark:text-emerald-400' },
  idle: { label: '待命', dot: 'bg-zinc-400', text: 'text-ink-muted' },
  blocked: { label: '受阻', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  done: { label: '已完成', dot: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-400' },
  failed: { label: '失败', dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
}

const SWIMLANES = [
  { id: 'recon', label: '侦察测绘', match: ['recon', 'discover', 'crawl'] },
  { id: 'scan', label: '漏洞探测', match: ['scan', 'probe', 'audit'] },
  { id: 'exploit', label: '利用验证', match: ['exploit', 'attack', 'poc'] },
  { id: 'verify', label: '确证复核', match: ['verify', 'retest', 'confirm'] },
  { id: 'report', label: '总结交付', match: ['report', 'writeup', 'summary'] },
]

function laneForEvent(ev: ActivityEventOut): string {
  const p = ev.agentPhase.toLowerCase()
  for (const lane of SWIMLANES) {
    if (lane.match.some((k) => p.includes(k))) return lane.id
  }
  return 'scan'
}

function formatAgentDisplay(agentId: string): { title: string; shortTag: string } {
  const clean = (agentId || '').trim()
  const parts = clean.split(':')
  const suffix = parts.length > 1 ? parts.slice(1).join(':') : clean
  if (suffix === 'ctf2-solver') {
    return { title: 'CTF2 解题智能体', shortTag: 'ctf2-solver' }
  }
  if (suffix.startsWith('agent-')) {
    return { title: `协作节点 ${suffix.slice(6)}`, shortTag: suffix }
  }
  if (suffix.length > 26) {
    return { title: `${suffix.slice(0, 14)}…${suffix.slice(-8)}`, shortTag: suffix }
  }
  return { title: suffix || '智能体', shortTag: suffix || clean }
}

interface EventVisual {
  label: string
  category: 'tool' | 'reasoning' | 'finding' | 'alert' | 'other'
  accentBar: string
  badgeCls: string
  icon: 'tool' | 'reasoning' | 'discovery' | 'poc' | 'verified' | 'blocked' | 'failed' | 'completed'
}

function getEventVisual(type: string): EventVisual {
  switch (type.toLowerCase()) {
    case 'tool_call':
      return {
        label: '工具执行',
        category: 'tool',
        accentBar: 'border-l-indigo-500/70',
        badgeCls:
          'border-indigo-300/60 bg-indigo-50/70 text-indigo-700 dark:border-indigo-800/70 dark:bg-indigo-950/60 dark:text-indigo-300',
        icon: 'tool',
      }
    case 'reasoning':
      return {
        label: '推理思考',
        category: 'reasoning',
        accentBar: 'border-l-violet-500/70',
        badgeCls:
          'border-violet-300/60 bg-violet-50/70 text-violet-700 dark:border-violet-800/70 dark:bg-violet-950/60 dark:text-violet-300',
        icon: 'reasoning',
      }
    case 'discovery':
      return {
        label: '新发现',
        category: 'finding',
        accentBar: 'border-l-sky-500/70',
        badgeCls:
          'border-sky-300/60 bg-sky-50/70 text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/60 dark:text-sky-300',
        icon: 'discovery',
      }
    case 'poc_generated':
      return {
        label: '候选产物',
        category: 'finding',
        accentBar: 'border-l-amber-500/80',
        badgeCls:
          'border-amber-300/70 bg-amber-50/70 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-300',
        icon: 'poc',
      }
    case 'verified':
      return {
        label: '已确证',
        category: 'finding',
        accentBar: 'border-l-emerald-500',
        badgeCls:
          'border-emerald-300/70 bg-emerald-50/70 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-300',
        icon: 'verified',
      }
    case 'blocked':
      return {
        label: '受阻重试',
        category: 'alert',
        accentBar: 'border-l-amber-500/80',
        badgeCls:
          'border-amber-300/70 bg-amber-50/70 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-300',
        icon: 'blocked',
      }
    case 'failed':
      return {
        label: '执行异常',
        category: 'alert',
        accentBar: 'border-l-red-500/80',
        badgeCls:
          'border-red-300/70 bg-red-50/70 text-red-700 dark:border-red-900/70 dark:bg-red-950/60 dark:text-red-300',
        icon: 'failed',
      }
    case 'completed':
      return {
        label: '任务完成',
        category: 'finding',
        accentBar: 'border-l-emerald-500',
        badgeCls:
          'border-emerald-300/70 bg-emerald-50/70 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-300',
        icon: 'completed',
      }
    default:
      return {
        label: type || '事件',
        category: 'other',
        accentBar: 'border-l-zinc-400/60',
        badgeCls: 'border-line bg-subtle text-ink-secondary',
        icon: 'discovery',
      }
  }
}

function EventIcon({ kind, className }: { kind: EventVisual['icon']; className?: string }) {
  const cls = cn('h-3.5 w-3.5 shrink-0', className)
  switch (kind) {
    case 'tool':
      return <Terminal className={cn(cls, 'text-indigo-500 dark:text-indigo-400')} />
    case 'reasoning':
      return <Sparkles className={cn(cls, 'text-violet-500 dark:text-violet-400')} />
    case 'discovery':
      return <Compass className={cn(cls, 'text-sky-500 dark:text-sky-400')} />
    case 'poc':
      return <Flame className={cn(cls, 'text-amber-500 dark:text-amber-400')} />
    case 'verified':
    case 'completed':
      return <CheckCircle2 className={cn(cls, 'text-emerald-500 dark:text-emerald-400')} />
    case 'blocked':
      return <ShieldAlert className={cn(cls, 'text-amber-500 dark:text-amber-400')} />
    case 'failed':
      return <XCircle className={cn(cls, 'text-red-500 dark:text-red-400')} />
    default:
      return <Wrench className={cn(cls, 'text-ink-muted')} />
  }
}

function cleanSummary(ev: ActivityEventOut): {
  toolName: string | null
  body: string
  truncatedHint: string | null
} {
  let raw = (ev.summary || '').trim()
  let truncatedHint: string | null = null
  const truncMatch = raw.match(/[\s…]*[（(]已截断[，,]?\s*原长\s*(\d+)\s*字符[）)]\s*$/)
  if (truncMatch) {
    truncatedHint = `${Number(truncMatch[1]).toLocaleString('zh-CN')} 字符`
    raw = raw.slice(0, truncMatch.index).trim().replace(/…+$/, '…')
  }

  const detail = ev.detail || {}
  if (ev.type === 'tool_call') {
    const toolName =
      typeof detail.tool === 'string' && detail.tool.trim() ? detail.tool.trim() : null
    if (toolName && raw.startsWith(toolName + ' ')) {
      raw = raw.slice(toolName.length + 1).trim()
    }
    return { toolName, body: raw || '(无命令参数)', truncatedHint }
  }

  if (ev.type === 'reasoning' && /^ACTION:\s*\{/i.test(raw)) {
    return {
      toolName: null,
      body: '准备调用工具执行下一步动作（点击展开查看完整上下文）',
      truncatedHint,
    }
  }

  return { toolName: null, body: raw, truncatedHint }
}

function CopyMiniButton({ text, label = '复制' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        void navigator.clipboard?.writeText(text)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1400)
      }}
      className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-0.5 text-[10px] font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      <span>{copied ? '已复制' : label}</span>
    </button>
  )
}

/* --------------------------------------------------------------------------
   Structured Detail Renderer (replaces raw JSON dump)
   -------------------------------------------------------------------------- */

function EventDetailBody({ ev }: { ev: ActivityEventOut }) {
  const [showRaw, setShowRaw] = useState(false)
  const detail = ev.detail || {}
  const kind = String(detail.kind || ev.type || '').toLowerCase()

  const flagVal = typeof detail.flag === 'string' && detail.flag.trim() ? detail.flag.trim() : null

  if (kind === 'tool_call') {
    const tool = typeof detail.tool === 'string' ? detail.tool : ''
    const command = typeof detail.command === 'string' ? detail.command : ''
    const output = typeof detail.output === 'string' ? detail.output : ''
    const exitCode = typeof detail.exitCode === 'number' ? detail.exitCode : null
    const durationMs = typeof detail.durationMs === 'number' ? detail.durationMs : null

    return (
      <div className="space-y-3 border-t border-line-subtle bg-subtle/60 px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex flex-wrap items-center gap-2 font-mono">
            {tool && (
              <span className="rounded-md border border-line bg-surface px-2 py-0.5 font-medium text-ink">
                {tool}
              </span>
            )}
            {exitCode != null && (
              <Badge
                className={
                  exitCode === 0
                    ? 'border-emerald-300/60 bg-emerald-50/70 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'border-red-300/60 bg-red-50/70 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300'
                }
              >
                exit {exitCode}
              </Badge>
            )}
            {durationMs != null && (
              <span className="text-ink-muted">{(durationMs / 1000).toFixed(2)}s</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            className="text-[10px] text-ink-muted hover:text-ink"
          >
            {showRaw ? '隐藏原始 JSON' : '查看原始 JSON'}
          </button>
        </div>

        {command && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                Command
              </span>
              <CopyMiniButton text={command} label="复制命令" />
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-line bg-canvas px-3 py-2.5 font-mono text-[11px] leading-relaxed text-ink">
              {command}
            </pre>
          </div>
        )}

        {output && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                Output ({output.split('\n').length} 行)
              </span>
              <CopyMiniButton text={output} label="复制输出" />
            </div>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-line bg-canvas px-3 py-2.5 font-mono text-[11px] leading-relaxed text-ink-secondary">
              {output}
            </pre>
          </div>
        )}

        {!command && !output && !showRaw && (
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-line bg-canvas p-3 font-mono text-[11px] text-ink-secondary">
            {JSON.stringify(detail, null, 2)}
          </pre>
        )}

        {showRaw && (
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-line bg-canvas p-3 font-mono text-[11px] text-ink-muted">
            {JSON.stringify(detail, null, 2)}
          </pre>
        )}
      </div>
    )
  }

  if (kind === 'reasoning') {
    const text = typeof detail.text === 'string' ? detail.text : ev.summary
    return (
      <div className="space-y-2.5 border-t border-line-subtle bg-subtle/60 px-4 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-violet-600 dark:text-violet-300">
            <Sparkles className="h-3.5 w-3.5" />
            完整推理思考内容（{text.length.toLocaleString('zh-CN')} 字符）
          </span>
          <CopyMiniButton text={text} label="复制全文" />
        </div>
        <div className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-canvas px-3.5 py-3 font-mono text-xs leading-relaxed text-ink-secondary">
          {text}
        </div>
      </div>
    )
  }

  const reason = typeof detail.reason === 'string' ? detail.reason : null
  const evidence = typeof detail.evidence === 'string' ? detail.evidence : null
  const remaining =
    typeof detail.remainingWrongSubmissions === 'number'
      ? detail.remainingWrongSubmissions
      : null

  return (
    <div className="space-y-2.5 border-t border-line-subtle bg-subtle/60 px-4 py-3.5 text-xs">
      {flagVal && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-300/60 bg-emerald-50/70 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/50">
          <div className="flex items-center gap-2 font-mono text-emerald-800 dark:text-emerald-200">
            <Flag className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <span className="break-all font-semibold">{flagVal}</span>
          </div>
          <CopyMiniButton text={flagVal} label="复制 Flag" />
        </div>
      )}

      {reason && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300/50 bg-amber-50/50 px-3 py-2 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-pre-wrap break-words">{reason}</span>
        </div>
      )}

      {evidence && (
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
            Evidence
          </p>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-line bg-canvas p-3 font-mono text-[11px] leading-relaxed text-ink-secondary">
            {evidence}
          </pre>
        </div>
      )}

      <div className="flex items-center justify-between">
        {remaining != null ? (
          <span className="font-mono text-[11px] text-ink-muted">
            剩余错误提交配额：{remaining} 次
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="text-[10px] text-ink-muted hover:text-ink"
        >
          {showRaw ? '隐藏原始载荷' : '查看原始载荷'}
        </button>
      </div>

      {(showRaw || (!flagVal && !reason && !evidence)) && (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-line bg-canvas p-3 font-mono text-[11px] text-ink-secondary">
          {JSON.stringify(detail, null, 2)}
        </pre>
      )}
    </div>
  )
}

/* --------------------------------------------------------------------------
   Main ActivityPage
   -------------------------------------------------------------------------- */

export function ActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { push } = useToast()

  const [scans, setScans] = useState<ScanOut[]>([])
  const [selectedScanId, setSelectedScanId] = useState<string>(searchParams.get('scan') || '')
  const [agents, setAgents] = useState<AgentOut[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const [events, setEvents] = useState<ActivityEventOut[]>([])
  const [connected, setConnected] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [showJumpLatest, setShowJumpLatest] = useState(false)
  const [viewMode, setViewMode] = useState<'stream' | 'lanes'>('stream')
  const [typeFilter, setTypeFilter] = useState<'all' | 'tool' | 'reasoning' | 'finding' | 'alert'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [hintText, setHintText] = useState('')
  const [sendingHint, setSendingHint] = useState(false)

  const streamScrollRef = useRef<HTMLDivElement | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const isProgrammaticScrollRef = useRef(false)
  const initialScrolledScanRef = useRef<string>('')

  useEffect(() => {
    api
      .listScans({ sort: 'recent', dir: 'desc' })
      .then((list) => {
        setScans(list)
        if (!selectedScanId) {
          const running = list.find((s) => s.status === 'running') || list[0]
          if (running) setSelectedScanId(running.id)
        }
      })
      .catch(() => {})
  }, [selectedScanId])

  useEffect(() => {
    let es: EventSource | null = null
    let active = true

    const connect = async () => {
      setConnected(false)
      setSelectedAgentId('')
      setExpandedIds(new Set())
      let lastId: string | null = null

      if (selectedScanId) {
        try {
          const [recent, ags] = await Promise.all([
            api.getRecentEvents(selectedScanId, 300),
            api.getScanAgents(selectedScanId).catch(() => []),
          ])
          if (!active) return
          setEvents(recent.events)
          setAgents(ags)
          lastId = recent.events.at(-1)?.id || null
        } catch {
          if (!active) return
          setEvents([])
          setAgents([])
        }
      } else {
        setEvents([])
        setAgents([])
      }

      if (!active) return
      es = api.createActivityStream(selectedScanId || null, lastId)

      es.onopen = () => {
        if (active) setConnected(true)
      }
      es.onerror = () => {
        if (active) setConnected(false)
      }
      es.addEventListener('activity', (ev) => {
        const parsed = api.parseActivityEvent((ev as MessageEvent).data)
        if (!parsed || !active) return
        setEvents((prev) => {
          if (prev.some((e) => e.id === parsed.id)) return prev
          return [...prev.slice(-499), parsed]
        })
      })
      es.addEventListener('resync', () => {
        if (selectedScanId && active) {
          void api.getRecentEvents(selectedScanId, 300).then((r) => setEvents(r.events))
        }
      })
    }

    void connect()

    return () => {
      active = false
      es?.close()
    }
  }, [selectedScanId])

  const scrollToLatest = useCallback((smooth: boolean) => {
    const el = streamScrollRef.current
    if (!el) return
    isProgrammaticScrollRef.current = true
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    })
    window.setTimeout(
      () => {
        isProgrammaticScrollRef.current = false
      },
      smooth ? 450 : 60,
    )
  }, [])

  useEffect(() => {
    if (!autoScroll || viewMode !== 'stream' || events.length === 0) return
    const isInitialForScan = initialScrolledScanRef.current !== selectedScanId
    if (isInitialForScan) {
      initialScrolledScanRef.current = selectedScanId
      scrollToLatest(false)
    } else {
      scrollToLatest(true)
    }
  }, [events.length, autoScroll, viewMode, selectedScanId, scrollToLatest])

  const handleStreamScroll = () => {
    const el = streamScrollRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    const farFromBottom = dist > 160
    setShowJumpLatest(farFromBottom)
    if (!isProgrammaticScrollRef.current && farFromBottom && autoScroll) {
      setAutoScroll(false)
    }
  }

  const eventStats = useMemo(() => {
    const counts = { all: events.length, tool: 0, reasoning: 0, finding: 0, alert: 0 }
    for (const ev of events) {
      const cat = getEventVisual(ev.type).category
      if (cat === 'tool') counts.tool += 1
      else if (cat === 'reasoning') counts.reasoning += 1
      else if (cat === 'finding') counts.finding += 1
      else if (cat === 'alert') counts.alert += 1
    }
    return counts
  }, [events])

  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return events.filter((ev) => {
      if (selectedAgentId && ev.agentId !== selectedAgentId) return false
      if (typeFilter !== 'all' && getEventVisual(ev.type).category !== typeFilter) return false
      if (q) {
        const hay = `${ev.summary} ${ev.type} ${ev.agentPhase} ${JSON.stringify(ev.detail || '')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [events, selectedAgentId, typeFilter, searchQuery])

  const eventsByLane = useMemo(() => {
    const map: Record<string, ActivityEventOut[]> = {}
    for (const lane of SWIMLANES) map[lane.id] = []
    for (const ev of filteredEvents) {
      map[laneForEvent(ev)].push(ev)
    }
    return map
  }, [filteredEvents])

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allExpanded =
    filteredEvents.length > 0 && filteredEvents.every((ev) => expandedIds.has(ev.id))

  const handleToggleExpandAll = () => {
    if (allExpanded) {
      setExpandedIds(new Set())
    } else {
      setExpandedIds(
        new Set(
          filteredEvents
            .filter((ev) => ev.detail && Object.keys(ev.detail).length > 0)
            .map((ev) => ev.id),
        ),
      )
    }
  }

  const handleScanChange = (id: string) => {
    setSelectedScanId(id)
    if (id) setSearchParams({ scan: id }, { replace: true })
    else setSearchParams({}, { replace: true })
  }

  const sendHint = useCallback(async () => {
    if (!selectedScanId || !hintText.trim() || sendingHint) return
    setSendingHint(true)
    try {
      await api.postScanHint(selectedScanId, hintText.trim())
      setHintText('')
      push('线索已实时注入当前扫描，智能体将在下一步读取', 'success')
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '注入线索失败', 'error')
    } finally {
      setSendingHint(false)
    }
  }, [hintText, push, selectedScanId, sendingHint])

  const currentScan = scans.find((s) => s.id === selectedScanId)
  const isCtfScan = Boolean(
    currentScan &&
      (currentScan.name?.startsWith('[CTF2]') || currentScan.target?.startsWith('ctf2:')),
  )

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-canvas">
      {/* Top Telemetry Bar (with ambient WebGL shader ribbon + soft-3D icon) */}
      <div className="relative shrink-0 overflow-hidden border-b border-line bg-surface/95 px-5 py-3 backdrop-blur">
        <div className="pointer-events-none absolute inset-0 z-0 opacity-80 dark:opacity-45">
          <MeshAuroraShader palette="ctf" speed={0.65} />
          <div className="absolute inset-0 bg-gradient-to-r from-surface/74 via-surface/55 to-surface/68 dark:from-surface/92 dark:via-surface/82 dark:to-surface/90" />
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2.5">
            <TactileAppIcon variant="activity" size={32} />
            <h1 className="whitespace-nowrap text-sm font-semibold text-ink">
              <span className="kinetic-gradient-text">智能体实时活动流</span>
            </h1>
          </div>

          <Select
            size="sm"
            variant="subtle"
            value={selectedScanId}
            onChange={handleScanChange}
            className="min-w-[210px] max-w-xs"
            menuClassName="w-80"
            options={[
              { value: '', label: '全局事件流（全部扫描）' },
              ...scans.map((s) => ({
                value: s.id,
                label: s.name || s.target || s.id,
                description: s.target,
                badge: SCAN_STATUS_META[s.status]?.label || s.status,
              })),
            ]}
          />

          <Badge
            pulse={connected}
            className={
              connected
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300'
            }
          >
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {connected ? 'EventBus 实时流' : '重连中'}
          </Badge>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Stream vs Swimlanes Toggle */}
          <div className="flex rounded-lg border border-line bg-subtle p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setViewMode('stream')}
              className={cn(
                'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 font-medium transition-colors',
                viewMode === 'stream'
                  ? 'bg-surface text-ink shadow-editorial'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              <List className="h-3 w-3" />
              事件流
            </button>
            <button
              type="button"
              onClick={() => setViewMode('lanes')}
              className={cn(
                'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 font-medium transition-colors',
                viewMode === 'lanes'
                  ? 'bg-surface text-ink shadow-editorial'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              <Columns3 className="h-3 w-3" />
              阶段泳道
            </button>
          </div>

          {viewMode === 'stream' && (
            <Button
              size="sm"
              variant={autoScroll ? 'secondary' : 'ghost'}
              onClick={() => {
                const next = !autoScroll
                setAutoScroll(next)
                if (next) endRef.current?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="whitespace-nowrap"
              title="切换自动跟随最新事件"
            >
              {autoScroll ? <Pause className="h-3.5 w-3.5 text-accent" /> : <Play className="h-3.5 w-3.5" />}
              {autoScroll ? '自动跟随' : '已暂停'}
            </Button>
          )}
        </div>
        </div>
      </div>

      {/* Split Workspace */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Sidebar: Agent Roster + Live Telemetry Overview */}
        <aside className="hidden w-72 shrink-0 flex-col border-r border-line bg-surface/80 xl:flex">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-xs font-semibold text-ink">协作智能体</span>
            <div className="flex items-center gap-1.5">
              {selectedAgentId && (
                <button
                  type="button"
                  onClick={() => setSelectedAgentId('')}
                  className="text-[10px] text-accent hover:underline"
                >
                  显示全部
                </button>
              )}
              <Badge className="font-mono text-[10px]">{agents.length}</Badge>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-3.5">
            {/* Agent Cards */}
            {agents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-subtle/40 px-3 py-6 text-center text-xs text-ink-muted">
                {selectedScanId ? '暂无智能体注册记录' : '选择单次扫描以查看智能体编制'}
              </div>
            ) : (
              <div className="space-y-2">
                {agents.map((ag) => {
                  const disp = formatAgentDisplay(ag.id)
                  const st = AGENT_STATUS_META[ag.status] || AGENT_STATUS_META.idle
                  const roleLabel = ROLE_LABELS[ag.role] || ag.role
                  const isSelected = selectedAgentId === ag.id
                  const liveCount = events.filter((e) => e.agentId === ag.id).length
                  return (
                    <button
                      key={ag.id}
                      type="button"
                      onClick={() => setSelectedAgentId(isSelected ? '' : ag.id)}
                      className={cn(
                        'w-full rounded-xl border p-3 text-left text-xs transition-all',
                        isSelected
                          ? 'border-accent bg-accent-soft/50 ring-1 ring-accent/30'
                          : 'border-line bg-subtle/60 hover:border-line-strong hover:bg-subtle',
                      )}
                      title={ag.id}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-surface border border-line text-accent">
                            <Bot className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-ink">{disp.title}</p>
                            <p className="truncate font-mono text-[10px] text-ink-muted">
                              {disp.shortTag}
                            </p>
                          </div>
                        </div>
                        <Badge className="shrink-0 text-[10px]">{roleLabel}</Badge>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between border-t border-line-subtle pt-2 text-[11px]">
                        <span className={cn('inline-flex items-center gap-1.5 font-medium', st.text)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', st.dot)} />
                          {st.label}
                        </span>
                        <span className="font-mono text-[10px] tabular-nums text-ink-muted">
                          {Math.max(ag.eventCount, liveCount)} 事件 · {formatRelativeTime(ag.lastActiveAt)}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Telemetry Breakdown Card */}
            {selectedScanId && (
              <div className="rounded-xl border border-line bg-subtle/50 p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  遥测分布
                </p>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'tool', label: '工具调用', count: eventStats.tool, tone: 'text-indigo-500 dark:text-indigo-400' },
                      { id: 'reasoning', label: '推理思考', count: eventStats.reasoning, tone: 'text-violet-500 dark:text-violet-400' },
                      { id: 'finding', label: '发现 / 验证', count: eventStats.finding, tone: 'text-emerald-500 dark:text-emerald-400' },
                      { id: 'alert', label: '阻断 / 异常', count: eventStats.alert, tone: 'text-amber-500 dark:text-amber-400' },
                    ] as const
                  ).map((tile) => (
                    <button
                      key={tile.id}
                      type="button"
                      onClick={() => setTypeFilter(typeFilter === tile.id ? 'all' : tile.id)}
                      className={cn(
                        'rounded-lg border px-2.5 py-2 text-left transition-colors',
                        typeFilter === tile.id
                          ? 'border-accent bg-accent-soft/50'
                          : 'border-line-subtle bg-surface/80 hover:border-line-strong',
                      )}
                    >
                      <div className={cn('font-mono text-base font-semibold tabular-nums', tile.tone)}>
                        {tile.count}
                      </div>
                      <div className="mt-0.5 text-[10px] text-ink-muted">{tile.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Current Scan Context & Quick Links */}
            {currentScan && (
              <div className="rounded-xl border border-line bg-subtle/50 p-3.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                    当前任务
                  </span>
                  <Badge
                    pulse={currentScan.status === 'running'}
                    className={SCAN_STATUS_META[currentScan.status]?.badge}
                  >
                    {SCAN_STATUS_META[currentScan.status]?.label || currentScan.status}
                  </Badge>
                </div>
                <p className="mt-2 truncate font-medium text-ink" title={currentScan.name || currentScan.target}>
                  {currentScan.name || currentScan.target}
                </p>
                <p className="mt-0.5 truncate font-mono text-[10px] text-ink-muted">
                  耗时 {formatDuration(currentScan.durationSec)} · 发现{' '}
                  {Object.values(currentScan.findings || {}).reduce((acc, n) => acc + (n || 0), 0)}{' '}
                  项
                </p>
                {currentScan.flag && (
                  <div className="mt-2 flex items-center justify-between gap-1.5 rounded-lg border border-emerald-300/60 bg-emerald-50/70 px-2 py-1 font-mono text-[10px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                    <span className="truncate">{currentScan.flag}</span>
                    <CopyMiniButton text={currentScan.flag} label="复制" />
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line-subtle pt-2.5">
                  <Link
                    to={`/scans/${encodeURIComponent(currentScan.id)}`}
                    className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[11px] text-ink-secondary transition-colors hover:border-accent/50 hover:text-ink"
                  >
                    <ExternalLink className="h-3 w-3" />
                    任务详情
                  </Link>
                  {isCtfScan && (
                    <Link
                      to="/ctf"
                      className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[11px] text-ink-secondary transition-colors hover:border-accent/50 hover:text-ink"
                    >
                      <Flag className="h-3 w-3 text-accent" />
                      CTF 题板
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Column */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/* Sub-Toolbar: Search + Semantic Type Filters + Expand All */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-b border-line bg-surface/70 px-5 py-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="relative w-56 sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="筛选命令、推理或关键词…"
                  className="h-7 w-full rounded-lg border border-line bg-canvas pl-8 pr-7 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-line bg-subtle p-0.5 text-[11px]">
                {(
                  [
                    { id: 'all', label: '全部', count: eventStats.all },
                    { id: 'tool', label: '工具', count: eventStats.tool },
                    { id: 'reasoning', label: '推理', count: eventStats.reasoning },
                    { id: 'finding', label: '发现', count: eventStats.finding },
                    { id: 'alert', label: '异常', count: eventStats.alert },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTypeFilter(f.id)}
                    className={cn(
                      'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 font-medium transition-colors',
                      typeFilter === f.id
                        ? 'bg-surface text-ink shadow-editorial'
                        : 'text-ink-muted hover:text-ink',
                    )}
                  >
                    <span>{f.label}</span>
                    <span className="font-mono text-[10px] tabular-nums opacity-70">{f.count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-ink-muted">
              <span className="font-mono tabular-nums">
                {filteredEvents.length} / {events.length} 条
              </span>
              {viewMode === 'stream' && filteredEvents.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleExpandAll}
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 font-medium text-ink-secondary transition-colors hover:border-line-strong hover:text-ink"
                >
                  {allExpanded ? (
                    <>
                      <ChevronsDownUp className="h-3 w-3" />
                      全部收起
                    </>
                  ) : (
                    <>
                      <ChevronsUpDown className="h-3 w-3" />
                      全部展开
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* View Body: Stream or 5-Column Phase Swimlanes */}
          {viewMode === 'lanes' ? (
            <div className="min-h-0 flex-1 overflow-x-auto p-5">
              <div className="grid h-full min-w-[960px] grid-cols-5 gap-3.5">
                {SWIMLANES.map((lane) => {
                  const laneItems = eventsByLane[lane.id] || []
                  return (
                    <div
                      key={lane.id}
                      className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-subtle/50"
                    >
                      <div className="flex shrink-0 items-center justify-between border-b border-line bg-surface px-3.5 py-2.5">
                        <span className="text-xs font-semibold text-ink">{lane.label}</span>
                        <Badge className="font-mono text-[10px]">{laneItems.length}</Badge>
                      </div>
                      <div className="flex-1 space-y-2 overflow-y-auto p-2.5">
                        {laneItems.length === 0 ? (
                          <p className="py-10 text-center text-[11px] text-ink-muted">暂无事件</p>
                        ) : (
                          laneItems.map((ev) => {
                            const vis = getEventVisual(ev.type)
                            const parsed = cleanSummary(ev)
                            const open = expandedIds.has(ev.id)
                            const hasDetail = Boolean(ev.detail && Object.keys(ev.detail).length > 0)
                            return (
                              <div
                                key={ev.id}
                                className={cn(
                                  'overflow-hidden rounded-lg border border-line border-l-2 bg-surface shadow-editorial transition-colors hover:border-line-strong',
                                  vis.accentBar,
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => hasDetail && toggleExpand(ev.id)}
                                  className="w-full p-2.5 text-left text-xs"
                                >
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-ink-secondary">
                                      <EventIcon kind={vis.icon} className="h-3 w-3" />
                                      {vis.label}
                                    </span>
                                    <span className="font-mono text-[10px] text-ink-muted">
                                      {formatRelativeTime(ev.at)}
                                    </span>
                                  </div>
                                  <p className="mt-1.5 line-clamp-3 font-mono text-[11px] leading-relaxed text-ink">
                                    {parsed.toolName ? `$ ${parsed.body}` : parsed.body}
                                  </p>
                                </button>
                                {open && hasDetail && <EventDetailBody ev={ev} />}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div
              ref={streamScrollRef}
              onScroll={handleStreamScroll}
              className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6"
            >
              <div className="mx-auto max-w-4xl space-y-2.5 pb-4">
                {filteredEvents.length === 0 ? (
                  events.length > 0 ? (
                    <EmptyState
                      icon={<Search className="h-5 w-5" />}
                      title="当前筛选条件下暂无匹配事件"
                      description="可清空关键词或切回「全部」查看全部实时遥测记录。"
                      action={
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setTypeFilter('all')
                            setSearchQuery('')
                            setSelectedAgentId('')
                          }}
                        >
                          重置筛选
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={<Activity className="h-5 w-5" />}
                      title="等待实时遥测事件"
                      description="异步 EventBus SSE 通道已就绪。智能体执行工具、阶段切换或确认漏洞后将实时推送至此。"
                    />
                  )
                ) : (
                  filteredEvents.map((ev) => {
                    const open = expandedIds.has(ev.id)
                    const hasDetail = Boolean(ev.detail && Object.keys(ev.detail).length > 0)
                    const vis = getEventVisual(ev.type)
                    const phaseMeta = PHASE_LABELS[ev.agentPhase.toLowerCase()] || {
                      label: ev.agentPhase,
                      cls: 'border-line bg-subtle text-ink-secondary',
                    }
                    const agentDisp = formatAgentDisplay(ev.agentId)
                    const parsed = cleanSummary(ev)
                    const isTool = ev.type === 'tool_call'

                    return (
                      <div
                        key={ev.id}
                        className={cn(
                          'overflow-hidden rounded-xl border border-line border-l-[3px] bg-surface shadow-editorial transition-colors hover:border-line-strong',
                          vis.accentBar,
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => hasDetail && toggleExpand(ev.id)}
                          className={cn(
                            'flex w-full items-start gap-3 px-4 py-3 text-left',
                            !hasDetail && 'cursor-default',
                          )}
                        >
                          <div className="mt-0.5 text-ink-muted">
                            {hasDetail ? (
                              open ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )
                            ) : (
                              <span className="inline-block h-3.5 w-3.5 text-center font-mono text-[10px]">
                                ·
                              </span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <EventIcon kind={vis.icon} />
                              <Badge className={cn('text-[10px]', vis.badgeCls)}>{vis.label}</Badge>
                              <Badge className={cn('text-[10px]', phaseMeta.cls)}>
                                {phaseMeta.label}
                              </Badge>
                              {parsed.toolName && (
                                <span className="rounded-md border border-line-subtle bg-subtle px-1.5 py-0.5 font-mono text-[10px] font-medium text-ink">
                                  {parsed.toolName}
                                </span>
                              )}
                              {agents.length > 1 && (
                                <span
                                  className="truncate font-mono text-[10px] text-ink-muted"
                                  title={ev.agentId}
                                >
                                  · {agentDisp.title}
                                </span>
                              )}
                            </div>

                            <p
                              className={cn(
                                'mt-1.5 line-clamp-2 break-words text-xs leading-relaxed',
                                isTool
                                  ? 'font-mono text-[11.5px] text-ink'
                                  : 'text-ink-secondary',
                              )}
                            >
                              {isTool ? `$ ${parsed.body}` : parsed.body}
                            </p>
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="font-mono text-[11px] tabular-nums text-ink-muted">
                              {formatRelativeTime(ev.at)}
                            </span>
                            {parsed.truncatedHint && (
                              <span className="rounded bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
                                {parsed.truncatedHint}
                              </span>
                            )}
                          </div>
                        </button>

                        {open && hasDetail && <EventDetailBody ev={ev} />}
                      </div>
                    )
                  })
                )}
                <div ref={endRef} />
              </div>
            </div>
          )}

          {/* Floating Jump-to-Latest Pill */}
          {viewMode === 'stream' && showJumpLatest && (
            <button
              type="button"
              onClick={() => {
                setAutoScroll(true)
                endRef.current?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="absolute bottom-20 right-6 z-20 inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface/95 px-3 py-1.5 text-xs font-medium text-ink shadow-elevated backdrop-blur transition-colors hover:border-accent hover:text-accent"
            >
              <ArrowDown className="h-3.5 w-3.5" />
              回到最新
            </button>
          )}

          {/* Bottom Live Hint Injection Bar */}
          {selectedScanId && currentScan?.status === 'running' && (
            <div className="shrink-0 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:px-6">
              <div className="mx-auto flex max-w-4xl items-center gap-2 rounded-xl border border-line bg-canvas p-1.5 shadow-editorial transition-all focus-within:border-accent/70 focus-within:ring-2 focus-within:ring-accent/15">
                <input
                  value={hintText}
                  onChange={(e) => setHintText(e.target.value)}
                  placeholder="向运行中的智能体实时注入人工线索（例如目标路径、测试凭据、利用思路）…"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void sendHint()
                    }
                  }}
                  className="min-w-0 flex-1 bg-transparent px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none"
                />
                <Button
                  variant="primary"
                  size="sm"
                  loading={sendingHint}
                  disabled={!hintText.trim()}
                  onClick={() => void sendHint()}
                  className="shrink-0 whitespace-nowrap px-3.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  注入线索
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
