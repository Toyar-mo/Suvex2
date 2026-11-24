import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Activity,
  Bot,
  ChevronDown,
  ChevronRight,
  Pause,
  Play,
  Send,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { formatRelativeTime, SCAN_STATUS_META } from '@/lib/format'
import type { ActivityEventOut, AgentOut, ScanOut } from '@/types/api'
import { Badge, Button, EmptyState, Input } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

export function ActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { push } = useToast()

  const [scans, setScans] = useState<ScanOut[]>([])
  const [selectedScanId, setSelectedScanId] = useState<string>(searchParams.get('scan') || '')
  const [agents, setAgents] = useState<AgentOut[]>([])
  const [events, setEvents] = useState<ActivityEventOut[]>([])
  const [connected, setConnected] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [hintText, setHintText] = useState('')

  const endRef = useRef<HTMLDivElement | null>(null)

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
      let lastId: string | null = null

      if (selectedScanId) {
        try {
          const [recent, ags] = await Promise.all([
            api.getRecentEvents(selectedScanId, 200),
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
          void api.getRecentEvents(selectedScanId, 200).then((r) => setEvents(r.events))
        }
      })
    }

    void connect()

    return () => {
      active = false
      es?.close()
    }
  }, [selectedScanId])

  useEffect(() => {
    if (autoScroll) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [events.length, autoScroll])

  const filteredEvents = useMemo(() => {
    if (typeFilter === 'all') return events
    return events.filter(
      (e) =>
        e.type.toLowerCase().includes(typeFilter) ||
        e.agentPhase.toLowerCase().includes(typeFilter),
    )
  }, [events, typeFilter])

  const handleScanChange = (id: string) => {
    setSelectedScanId(id)
    if (id) setSearchParams({ scan: id }, { replace: true })
    else setSearchParams({}, { replace: true })
  }

  const sendHint = useCallback(async () => {
    if (!selectedScanId || !hintText.trim()) return
    try {
      await api.postScanHint(selectedScanId, hintText.trim())
      setHintText('')
      push('线索已实时注入当前扫描', 'success')
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '注入线索失败', 'error')
    }
  }, [hintText, push, selectedScanId])

  const currentScan = scans.find((s) => s.id === selectedScanId)

  return (
    <div className="flex h-full flex-col bg-canvas">
      {/* Top Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent" />
            <h1 className="text-sm font-semibold text-ink">智能体实时活动流</h1>
          </div>

          <select
            value={selectedScanId}
            onChange={(e) => handleScanChange(e.target.value)}
            className="h-8 max-w-xs rounded-lg border border-line bg-subtle px-2.5 text-xs text-ink focus:border-accent focus:outline-none"
          >
            <option value="">全局事件流（全部扫描）</option>
            {scans.map((s) => (
              <option key={s.id} value={s.id}>
                [{SCAN_STATUS_META[s.status]?.label || s.status}] {s.name || s.target || s.id}
              </option>
            ))}
          </select>

          <Badge
            pulse={connected}
            className={
              connected
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300'
            }
          >
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {connected ? 'SSE 已连接' : '连接中 / 等待流'}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-line bg-subtle p-0.5 text-[11px]">
            {[
              { id: 'all', label: '全部' },
              { id: 'tool', label: '工具' },
              { id: 'finding', label: '发现' },
              { id: 'recon', label: '侦察' },
              { id: 'exploit', label: '利用' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTypeFilter(f.id)}
                className={cn(
                  'rounded-md px-2 py-1 font-medium transition-colors',
                  typeFilter === f.id
                    ? 'bg-surface text-ink shadow-editorial'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setAutoScroll((v) => !v)}
            title="自动跟随最新事件"
          >
            {autoScroll ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {autoScroll ? '自动跟随' : '已暂停滚动'}
          </Button>
        </div>
      </div>

      {/* Split Workspace: Agent Roster + Event Timeline */}
      <div className="flex min-h-0 flex-1">
        {/* Agent Roster */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface xl:flex">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-xs font-semibold text-ink">协作智能体</span>
            <span className="font-mono text-[11px] text-ink-muted">{agents.length}</span>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {agents.length === 0 ? (
              <p className="py-8 text-center text-xs text-ink-muted">
                {selectedScanId ? '暂无智能体注册记录' : '选择单次扫描以查看智能体编制'}
              </p>
            ) : (
              agents.map((ag) => (
                <div
                  key={ag.id}
                  className="rounded-lg border border-line bg-subtle/60 p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-mono font-medium text-ink">
                      <Bot className="h-3.5 w-3.5 text-accent" />
                      {ag.id}
                    </span>
                    <Badge>{ag.role}</Badge>
                  </div>
                  <p className="mt-1.5 truncate font-mono text-[11px] text-ink-muted">
                    {ag.target}
                  </p>
                  <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-ink-muted">
                    <span>{ag.eventCount} 事件</span>
                    <span>{formatRelativeTime(ag.lastActiveAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Live Event Feed */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="mx-auto max-w-4xl space-y-2">
              {filteredEvents.length === 0 ? (
                <EmptyState
                  icon={<Activity className="h-5 w-5" />}
                  title="等待实时遥测事件"
                  description="SSE 通道保持常驻监听。一旦智能体执行工具调用、阶段切换或确认漏洞，事件帧会立刻呈现在此。"
                />
              ) : (
                filteredEvents.map((ev) => {
                  const open = expandedId === ev.id
                  const hasDetail = Boolean(ev.detail && Object.keys(ev.detail).length > 0)
                  return (
                    <div
                      key={ev.id}
                      className="rounded-lg border border-line bg-surface shadow-editorial transition-colors hover:border-line-strong"
                    >
                      <button
                        type="button"
                        onClick={() => hasDetail && setExpandedId(open ? null : ev.id)}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left"
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
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-subtle px-1.5 py-0.5 font-mono text-[10px] font-medium text-accent-ink">
                              {ev.agentPhase}
                            </span>
                            <span className="font-mono text-[11px] text-ink-muted">
                              {ev.type}
                            </span>
                            <span className="font-mono text-[11px] text-ink-muted">
                              · {ev.agentId}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-ink">{ev.summary}</p>
                        </div>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-muted">
                          {formatRelativeTime(ev.at)}
                        </span>
                      </button>

                      {open && ev.detail && (
                        <div className="border-t border-line bg-subtle/60 px-4 py-3">
                          <pre className="max-h-72 overflow-auto font-mono text-[11px] text-ink-secondary">
                            {JSON.stringify(ev.detail, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
              <div ref={endRef} />
            </div>
          </div>

          {/* Live Hint Footer for Running Scan */}
          {selectedScanId && currentScan?.status === 'running' && (
            <div className="border-t border-line bg-surface px-5 py-3">
              <div className="mx-auto flex max-w-4xl gap-2">
                <Input
                  value={hintText}
                  onChange={(e) => setHintText(e.target.value)}
                  placeholder="向运行中的扫描实时注入人工线索（例如测试凭据、可疑端点）…"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void sendHint()
                    }
                  }}
                />
                <Button variant="primary" size="md" onClick={() => void sendHint()}>
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
