import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowDown,
  Bot,
  Box,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Cpu,
  Download,
  Flag,
  Folder,
  FolderOpen,
  GitBranch,
  GitFork,
  ListTodo,
  Loader2,
  MessagesSquare,
  Minimize2,
  PanelLeft,
  Paperclip,
  Play,
  Send,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Terminal,
  Trash2,
  User,
  Workflow,
  Wrench,
  X,
  XCircle,
} from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { formatBytes, formatCompactNumber, formatRelativeTime } from '@/lib/format'
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
import { Badge, Button, Drawer, EmptyState, Modal, Select } from '@/components/ui/primitives'
import { DotWarpCanvas, MeshAuroraShader, SpotlightCard } from '@/components/ui/ShaderCanvas'
import { SuvexAppIcon, TactileAppIcon } from '@/components/ui/AppIcons'
import { MarkdownView } from '@/components/ui/MarkdownView'
import { ChallengeCockpit } from '@/components/chat/ChallengeCockpit'
import { SandboxPanel } from '@/components/chat/SandboxPanel'
import { SessionRail } from '@/components/chat/SessionRail'
import { SessionSettingsModal } from '@/components/chat/SessionSettingsModal'
import { cn } from '@/lib/cn'

interface SlashCommandItem {
  cmd: string
  label: string
  hint: string
  prompt?: string
  action?: 'compact' | 'reset-sandbox' | 'open-sandbox'
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    cmd: '/ctf',
    label: '拉取并开解 CTF 题目',
    hint: '调用 ctf2-suvex MCP 列出可解赛题并分析解题',
    prompt: '请列出当前 CTF2 练习场里未解出的题目，按难度和分值推荐一道并开始分析解题。',
  },
  {
    cmd: '/scan',
    label: '发起目标安全评估',
    hint: '对授权 URL/仓库/服务执行渗透侦察与 PoC 验证',
    prompt: '请帮我对目标进行全面安全评估（请先确认目标地址、攻击面与可用工具）：',
  },
  {
    cmd: '/sandbox',
    label: '打开沙箱控制与快捷终端',
    hint: '查看容器实时配额、状态并直接执行诊断命令',
    action: 'open-sandbox',
  },
  {
    cmd: '/writeup',
    label: '沉淀结构化题解/报告',
    hint: '汇总已验证漏洞或 CTF 利用链并写入 /work/persist',
    prompt: '请将目前已经确证的漏洞利用链/解题过程整理为结构化 Markdown 报告，并用 write_workspace_file 保存到 /work/persist/report.md。',
  },
  {
    cmd: '/mcp',
    label: '查看已挂载 MCP 工具',
    hint: '列出当前会话可用的远程 HTTP / stdio MCP 能力',
    prompt: '请检查当前会话已挂载的 MCP Server 状态和可用工具列表。',
  },
  {
    cmd: '/compact',
    label: '立即压缩上下文',
    hint: '对当前会话历史生成摘要，释放上下文窗口',
    action: 'compact',
  },
  {
    cmd: '/reset-sandbox',
    label: '重建干净沙箱容器',
    hint: '重置临时容器状态，保留 /work/persist 持久产物',
    action: 'reset-sandbox',
  },
]

/* --------------------------------------------------------------------------
   Helpers: Argument preview, Flag extraction, and Message Grouping
   -------------------------------------------------------------------------- */

function summarizeToolArgs(toolName: string | null, args: Record<string, unknown> | null): string {
  if (!args || Object.keys(args).length === 0) return ''
  const name = (toolName || '').toLowerCase()
  const str = (key: string) => (typeof args[key] === 'string' ? (args[key] as string).trim() : '')

  if (name === 'run_shell' || name === 'exec' || name === 'shell') {
    const cmd = str('command') || str('cmd') || str('script')
    if (cmd) return cmd.split('\n')[0].slice(0, 110)
  }
  if (name === 'call_mcp' || name === 'describe_mcp') {
    const srv = str('server') || str('name')
    const tool = str('tool')
    if (srv || tool) return [srv, tool].filter(Boolean).join(' · ')
  }
  if (name.includes('file') || name.includes('read') || name.includes('write')) {
    const p = str('path') || str('file_path') || str('filename')
    if (p) return p
  }
  if (name.includes('http') || name.includes('fetch') || name.includes('browse')) {
    const method = str('method')
    const url = str('url') || str('target')
    if (url) return method ? `${method.toUpperCase()} ${url}` : url
  }
  for (const key of ['command', 'target', 'url', 'path', 'query', 'tool', 'name', 'flag']) {
    const v = str(key)
    if (v) return v.split('\n')[0].slice(0, 100)
  }
  const firstEntry = Object.entries(args)[0]
  if (firstEntry) {
    const val = typeof firstEntry[1] === 'string' ? firstEntry[1] : JSON.stringify(firstEntry[1])
    return `${firstEntry[0]}=${String(val).slice(0, 80)}`
  }
  return ''
}

function extractFlags(text: string): string[] {
  if (!text) return []
  const matches = text.match(/\b(?:CTF2|DASCTF|flag|FLAG|ctf)\{[^{}\s]{4,120}\}/g)
  if (!matches) return []
  return Array.from(new Set(matches))
}

type TraceItem =
  | { kind: 'tool'; msg: ChatMessageOut }
  | { kind: 'thought'; msg: ChatMessageOut }

type DisplayBlock =
  | { kind: 'user'; msg: ChatMessageOut }
  | { kind: 'assistant'; msg: ChatMessageOut }
  | { kind: 'trace'; id: string; items: TraceItem[] }

function groupConversationMessages(messages: ChatMessageOut[]): DisplayBlock[] {
  const blocks: DisplayBlock[] = []
  let pendingTrace: TraceItem[] = []

  const flushTrace = () => {
    if (pendingTrace.length === 0) return
    blocks.push({
      kind: 'trace',
      id: `trace-${pendingTrace[0].msg.id}`,
      items: pendingTrace,
    })
    pendingTrace = []
  }

  for (const msg of messages) {
    if (msg.role === 'user') {
      flushTrace()
      blocks.push({ kind: 'user', msg })
      continue
    }

    if (msg.role === 'tool' || msg.toolName) {
      pendingTrace.push({ kind: 'tool', msg })
      continue
    }

    const hasContent = Boolean((msg.content || '').trim())
    const hasReasoning = Boolean((msg.reasoning || '').trim())

    // Empty assistant tool-calling stub: skip completely (no empty ghost cards!)
    if (!hasContent && !hasReasoning) {
      continue
    }

    // Assistant turn that only produced internal thinking before a tool call
    if (!hasContent && hasReasoning) {
      pendingTrace.push({ kind: 'thought', msg })
      continue
    }

    flushTrace()
    blocks.push({ kind: 'assistant', msg })
  }

  flushTrace()
  return blocks
}

/* --------------------------------------------------------------------------
   Subcomponents: Reasoning, Execution Trace, User Bubble, Assistant Turn
   -------------------------------------------------------------------------- */

const ReasoningAccordion = memo(function ReasoningAccordion({
  text,
  streaming,
  compact,
}: {
  text: string
  streaming?: boolean
  compact?: boolean
}) {
  const [open, setOpen] = useState(Boolean(streaming))
  const scrollRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (streaming && open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [text, streaming, open])

  return (
    <div
      className={cn(
        'rounded-lg border border-line-subtle bg-subtle/60',
        compact ? 'my-1' : 'mb-3',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] font-medium text-ink-secondary transition-colors hover:text-ink"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Sparkles className={cn('h-3 w-3 text-accent', streaming && 'animate-pulse')} />
        <span>{streaming ? '正在深度推理思考…' : '推理思考过程'}</span>
        <span className="ml-auto font-mono text-[10px] tabular-nums text-ink-muted">
          {text.length} 字
        </span>
      </button>
      {open && (
        <div
          ref={scrollRef}
          className="max-h-64 overflow-y-auto border-t border-line-subtle px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-secondary whitespace-pre-wrap"
        >
          {text}
        </div>
      )}
    </div>
  )
})

const ToolStepRow = memo(function ToolStepRow({
  msg,
  onApprove,
}: {
  msg: ChatMessageOut
  onApprove?: (messageId: string, approve: boolean) => void
}) {
  const isPending = msg.approvalStatus === 'pending'
  const [expanded, setExpanded] = useState(isPending)
  const [copied, setCopied] = useState(false)
  const preview = useMemo(
    () => summarizeToolArgs(msg.toolName, msg.toolArgs),
    [msg.toolName, msg.toolArgs],
  )
  const isShell = (msg.toolName || '').toLowerCase().includes('shell')

  const handleCopyOut = () => {
    void navigator.clipboard?.writeText(msg.content || '')
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div
      className={cn(
        'rounded-lg border transition-colors',
        isPending
          ? 'border-amber-400/60 bg-amber-50/40 dark:border-amber-700/70 dark:bg-amber-950/25'
          : msg.toolFailed
            ? 'border-red-300/60 bg-red-50/30 dark:border-red-900/60 dark:bg-red-950/20'
            : 'border-line-subtle bg-surface/80 hover:border-line',
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
        )}

        <span
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full',
            isPending
              ? 'animate-pulse bg-amber-500'
              : msg.toolFailed
                ? 'bg-red-500'
                : 'bg-emerald-500',
          )}
        />

        {isShell ? (
          <Terminal className="h-3.5 w-3.5 shrink-0 text-accent" />
        ) : (
          <Wrench className="h-3.5 w-3.5 shrink-0 text-accent" />
        )}

        <span className="shrink-0 font-mono font-medium text-ink">
          {msg.toolName || 'tool_call'}
        </span>

        {preview && (
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-muted">
            {isShell ? `$ ${preview}` : preview}
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {msg.durationMs != null && (
            <span className="font-mono text-[10px] tabular-nums text-ink-muted">
              {(msg.durationMs / 1000).toFixed(2)}s
            </span>
          )}
          {isPending && (
            <Badge className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              待审批
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
              异常
            </Badge>
          )}
        </div>
      </button>

      {expanded && (
        <div className="space-y-2.5 border-t border-line-subtle bg-subtle/60 px-3.5 py-3">
          {msg.toolArgs && Object.keys(msg.toolArgs).length > 0 && (
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                Input
              </p>
              <pre className="max-h-44 overflow-auto rounded-lg border border-line bg-canvas p-2.5 font-mono text-[11px] leading-relaxed text-ink">
                {JSON.stringify(msg.toolArgs, null, 2)}
              </pre>
            </div>
          )}
          {msg.content && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                  Output
                </p>
                <button
                  type="button"
                  onClick={handleCopyOut}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-ink-muted hover:bg-wash hover:text-ink"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copied ? '已复制' : '复制输出'}
                </button>
              </div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-line bg-canvas p-2.5 font-mono text-[11px] leading-relaxed text-ink-secondary">
                {msg.content}
              </pre>
            </div>
          )}
          {isPending && onApprove && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300/70 bg-amber-50/70 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/50">
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
})

const ExecutionTraceGroup = memo(function ExecutionTraceGroup({
  items,
  onApprove,
}: {
  items: TraceItem[]
  onApprove?: (messageId: string, approve: boolean) => void
}) {
  const toolItems = items.filter((i) => i.kind === 'tool')
  const hasPending = toolItems.some((i) => i.msg.approvalStatus === 'pending')
  const failedCount = toolItems.filter((i) => i.msg.toolFailed).length
  const totalMs = toolItems.reduce((sum, i) => sum + (i.msg.durationMs || 0), 0)

  // Auto-expand when approval is pending or when there are 1-3 steps; collapse long histories nicely
  const [open, setOpen] = useState(hasPending || toolItems.length <= 3)

  return (
    <div className="rounded-xl border border-line bg-subtle/50 px-3.5 py-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-2 text-left text-xs"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-ink-muted" />
          )}
          {hasPending ? (
            <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
          ) : failedCount > 0 ? (
            <XCircle className="h-3.5 w-3.5 text-amber-500" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          )}
          <span className="font-medium text-ink">
            智能体执行轨迹 · {toolItems.length} 步工具调用
          </span>
          {failedCount > 0 && (
            <Badge className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
              {failedCount} 项异常
            </Badge>
          )}
          {hasPending && (
            <Badge className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              待审批
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-ink-muted">
          {totalMs > 0 && <span>{(totalMs / 1000).toFixed(1)}s</span>}
          <span>{open ? '收起' : '展开详情'}</span>
        </div>
      </button>

      {open && (
        <div className="mt-2.5 space-y-1.5 border-l border-line-strong pl-3 ml-1.5">
          {items.map((item) =>
            item.kind === 'thought' ? (
              <ReasoningAccordion
                key={item.msg.id}
                text={item.msg.reasoning || ''}
                compact
              />
            ) : (
              <ToolStepRow key={item.msg.id} msg={item.msg} onApprove={onApprove} />
            ),
          )}
        </div>
      )}
    </div>
  )
})

const UserMessageBlock = memo(function UserMessageBlock({
  msg,
  onFork,
}: {
  msg: ChatMessageOut
  onFork: (seq: number) => void
}) {
  const lines = (msg.content || '').split('\n')
  const isLong = lines.length > 14 || (msg.content || '').length > 900
  const [expanded, setExpanded] = useState(!isLong)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    void navigator.clipboard?.writeText(msg.content || '')
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="group flex flex-col items-end">
      <div className="mb-1 flex items-center gap-2 px-1 text-[11px] text-ink-muted">
        <div className="hidden items-center gap-1 group-hover:flex">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-wash hover:text-ink"
            title="复制内容"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </button>
          <button
            type="button"
            onClick={() => onFork(msg.seq)}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-wash hover:text-ink"
            title="从此消息分叉新分支"
          >
            <GitFork className="h-3 w-3" />
            <span>分叉</span>
          </button>
        </div>
        <span className="font-mono">{formatRelativeTime(msg.createdAt)}</span>
        <span className="inline-flex items-center gap-1 font-medium text-ink-secondary">
          <User className="h-3 w-3" />
          你
        </span>
      </div>

      <div className="relative max-w-[88%] rounded-2xl rounded-tr-sm border border-line bg-subtle px-4 py-3 text-sm leading-relaxed text-ink shadow-editorial dark:border-indigo-500/20 dark:bg-[#1a1c28]">
        <p
          className={cn(
            'whitespace-pre-wrap break-words',
            !expanded && 'line-clamp-[10]',
          )}
        >
          {msg.content}
        </p>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
          >
            {expanded ? '收起长文本' : `展开全部（${lines.length} 行）`}
          </button>
        )}
      </div>
    </div>
  )
})

const AssistantMessageBlock = memo(function AssistantMessageBlock({
  msg,
  onFork,
}: {
  msg: ChatMessageOut
  onFork: (seq: number) => void
}) {
  const [copied, setCopied] = useState(false)
  const [copiedFlag, setCopiedFlag] = useState<string | null>(null)
  const flags = useMemo(() => extractFlags(msg.content || ''), [msg.content])

  const handleCopy = () => {
    void navigator.clipboard?.writeText(msg.content || '')
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="group rounded-2xl border border-line bg-surface px-5 py-4 shadow-editorial">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-line-subtle pb-2.5 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent-soft font-mono text-[10px] font-bold text-accent">
            S2
          </span>
          <span className="font-medium text-ink">Suvex Agent</span>
          <span className="font-mono text-ink-muted">{formatRelativeTime(msg.createdAt)}</span>
        </div>
        <div className="flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-ink-muted hover:bg-wash hover:text-ink"
            title="复制 Markdown"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">已复制</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>复制</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => onFork(msg.seq)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-ink-muted hover:bg-wash hover:text-ink"
            title="从此处分叉新分支"
          >
            <GitFork className="h-3 w-3" />
            <span>分叉</span>
          </button>
        </div>
      </div>

      {msg.reasoning && <ReasoningAccordion text={msg.reasoning} />}
      {msg.content && <MarkdownView content={msg.content} />}

      {flags.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-50/70 px-3.5 py-2.5 text-xs dark:border-emerald-800/70 dark:bg-emerald-950/35">
          <Flag className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium text-emerald-900 dark:text-emerald-200">检测到 Flag</span>
          {flags.map((fl) => (
            <button
              key={fl}
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(fl)
                setCopiedFlag(fl)
                window.setTimeout(() => setCopiedFlag(null), 1600)
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/80 bg-surface px-2 py-0.5 font-mono text-[11px] text-emerald-800 transition-colors hover:bg-emerald-100/60 dark:border-emerald-700/70 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
              title="点击复制 Flag"
            >
              <span>{fl}</span>
              {copiedFlag === fl ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3 opacity-70" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

/* Live Streaming Output Console — RAF-fed 60fps smooth output, elapsed clock & Studio terminal */
const LiveStreamCard = memo(function LiveStreamCard({
  phase,
  round,
  activeTool,
  toolSeconds,
  elapsedSec,
  reasoning,
  toolOut,
  text,
  stopping,
  onStop,
}: {
  phase: string | null
  round: number | null
  activeTool: string | null
  toolSeconds: number | null
  elapsedSec: number
  reasoning: string
  toolOut: string
  text: string
  stopping?: boolean
  onStop: () => void
}) {
  const termRef = useRef<HTMLPreElement | null>(null)
  const [copiedTerm, setCopiedTerm] = useState(false)

  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight
    }
  }, [toolOut])

  const charCount = text.length + reasoning.length

  return (
    <div className="rounded-2xl border border-accent/40 bg-surface px-5 py-4 shadow-elevated ring-1 ring-accent/10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle pb-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 font-medium text-accent">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {phase || '智能体处理中…'}
          </span>
          {round != null && round > 0 && (
            <span className="rounded-full border border-accent/25 bg-accent-soft px-2 py-0.5 font-mono text-[10px] font-medium text-accent-ink">
              第 {round} 轮
            </span>
          )}
          {activeTool && (
            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-300/60 bg-indigo-50 px-2 py-0.5 font-mono text-[10px] text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
              <Terminal className="h-2.5 w-2.5" />
              {activeTool}
              {toolSeconds != null ? ` · ${toolSeconds}s` : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1 font-mono text-[10px] tabular-nums text-ink-muted">
            <Clock className="h-3 w-3" />
            {elapsedSec.toFixed(1)}s
            {charCount > 0 ? ` · ${charCount} 字` : ''}
          </span>
          <Button size="sm" variant="danger" loading={stopping} disabled={stopping} onClick={onStop}>
            {!stopping && <Square className="h-3 w-3" />}
            {stopping ? '正在停止…' : '停止执行'}
          </Button>
        </div>
      </div>

      {reasoning && <ReasoningAccordion text={reasoning} streaming />}

      {toolOut && (
        <div className="mb-3 overflow-hidden rounded-xl border border-slate-800/90 bg-[#0f121d] text-slate-200 shadow-inner dark:border-line">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-400/80" />
                <span className="h-2 w-2 rounded-full bg-amber-400/80" />
                <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
              </span>
              <Terminal className="h-3 w-3 text-indigo-400" />
              实时终端输出{activeTool ? ` · ${activeTool}` : ''}
            </span>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(toolOut)
                setCopiedTerm(true)
                window.setTimeout(() => setCopiedTerm(false), 1400)
              }}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-white"
            >
              {copiedTerm ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copiedTerm ? '已复制' : '复制'}
            </button>
          </div>
          <pre
            ref={termRef}
            className="max-h-60 overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-[11px] leading-relaxed text-slate-200"
          >
            {toolOut}
          </pre>
        </div>
      )}

      {text && <MarkdownView content={text} streaming />}
    </div>
  )
})

function classifyAttackStage(toolName: string): { stage: string; color: string } {
  const n = toolName.toLowerCase()
  if (/recon|scan|nmap|httpx|list|read|search|browse|fetch/.test(n)) {
    return {
      stage: '侦察与测绘',
      color:
        'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300',
    }
  }
  if (/poc|exploit|shell|exec|sql|inject|submit/.test(n)) {
    return {
      stage: '利用与验证',
      color:
        'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/50 dark:text-orange-300',
    }
  }
  if (/report|write|save|skill|todo/.test(n)) {
    return {
      stage: '归档与交付',
      color:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
    }
  }
  return { stage: '分析推理', color: 'border-line bg-subtle text-ink-secondary' }
}

/* --------------------------------------------------------------------------
   Main ChatPage Component
   -------------------------------------------------------------------------- */

export function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { push } = useToast()

  const [sessions, setSessions] = useState<ChatSessionOut[]>([])
  const [railOpen, setRailOpen] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(searchParams.get('session'))
  const [detail, setDetail] = useState<ChatSessionDetailOut | null>(null)
  const [settingsTarget, setSettingsTarget] = useState<ChatSessionOut | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<ChatSessionOut | null>(null)
  const [purgeTarget, setPurgeTarget] = useState<ChatSessionOut | null>(null)
  const [batchArchiveIds, setBatchArchiveIds] = useState<string[]>([])
  const [batchPurgeIds, setBatchPurgeIds] = useState<string[]>([])
  const [purgeAllOpen, setPurgeAllOpen] = useState(false)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [contextInfo, setContextInfo] = useState<ChatContextOut | null>(null)
  const [todos, setTodos] = useState<ChatTodoOut[]>([])
  const [turns, setTurns] = useState<ChatTurnRunOut[]>([])
  const [providers, setProviders] = useState<ProviderOut[]>([])
  const [profiles, setProfiles] = useState<AgentProfileOut[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<string>('')
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')

  // Side drawers: Session Tree / Workspace Files, Sandbox & Attack Chain
  const [treeOpen, setTreeOpen] = useState(false)
  const [treeData, setTreeData] = useState<ChatSessionTreeOut | null>(null)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [workspaceTab, setWorkspaceTab] = useState<'files' | 'sandbox' | 'chain'>('files')
  const [sessionFiles, setSessionFiles] = useState<ChatFileOut[]>([])

  const [input, setInput] = useState('')
  const [slashIndex, setSlashIndex] = useState(0)
  const [attachments, setAttachments] = useState<ChatAttachmentOut[]>([])
  const [uploading, setUploading] = useState(false)
  const [streamingSessionId, setStreamingSessionId] = useState<string | null>(null)
  const [streamPhase, setStreamPhase] = useState<string | null>(null)
  const [streamRound, setStreamRound] = useState<number | null>(null)
  const [streamTool, setStreamTool] = useState<string | null>(null)
  const [streamToolSec, setStreamToolSec] = useState<number | null>(null)
  const [streamElapsedSec, setStreamElapsedSec] = useState(0)
  const [streamText, setStreamText] = useState('')
  const [streamReasoning, setStreamReasoning] = useState('')
  const [liveToolOut, setLiveToolOut] = useState('')
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [resumingSessionId, setResumingSessionId] = useState<string | null>(null)
  const [stoppingSessionId, setStoppingSessionId] = useState<string | null>(null)
  const [showScrollBottom, setShowScrollBottom] = useState(false)

  // Authoritative current-session refs & request epoch to eliminate cross-session race conditions
  const activeIdRef = useRef<string | null>(activeId)
  activeIdRef.current = activeId
  const detailReqSeqRef = useRef(0)

  const resumingSessionRef = useRef<string | null>(null)
  resumingSessionRef.current = resumingSessionId

  const abortRef = useRef<AbortController | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // RAF-batched streaming accumulator bound to a single sessionId (prevents 200+ renders/sec & cross-session bleed)
  const streamBufRef = useRef<{ sessionId: string | null; text: string; reasoning: string; toolOut: string }>({
    sessionId: null,
    text: '',
    reasoning: '',
    toolOut: '',
  })
  const streamRafRef = useRef<number | null>(null)

  const flushStreamBuf = useCallback(() => {
    streamRafRef.current = null
    if (streamBufRef.current.sessionId !== activeIdRef.current) return
    setStreamText(streamBufRef.current.text)
    setStreamReasoning(streamBufRef.current.reasoning)
    setLiveToolOut(streamBufRef.current.toolOut)
  }, [])

  const scheduleStreamFlush = useCallback(
    (sessionId: string) => {
      if (activeIdRef.current !== sessionId) return
      streamBufRef.current.sessionId = sessionId
      if (streamRafRef.current != null) return
      streamRafRef.current = window.requestAnimationFrame(flushStreamBuf)
    },
    [flushStreamBuf],
  )

  const resetStreamBuffers = useCallback((sessionId: string | null = null) => {
    if (streamRafRef.current != null) {
      window.cancelAnimationFrame(streamRafRef.current)
      streamRafRef.current = null
    }
    streamBufRef.current = { sessionId, text: '', reasoning: '', toolOut: '' }
    setStreamText('')
    setStreamReasoning('')
    setLiveToolOut('')
  }, [])

  const streaming = Boolean(activeId && streamingSessionId === activeId)
  const resuming = Boolean(activeId && resumingSessionId === activeId)
  const stopping = Boolean(activeId && stoppingSessionId === activeId)
  // Strict session-scoped detail: NEVER render or inspect stale detail from a previously selected session
  const currentDetail = detail && detail.id === activeId ? detail : null

  // Smooth live elapsed clock while streaming / reattached (reset on session switch)
  useEffect(() => {
    if (!activeId || (!streaming && !streamPhase)) {
      setStreamElapsedSec(0)
      return
    }
    const startedAt = performance.now()
    setStreamElapsedSec(0)
    const id = window.setInterval(() => {
      setStreamElapsedSec((performance.now() - startedAt) / 1000)
    }, 200)
    return () => window.clearInterval(id)
  }, [activeId, streaming, Boolean(streamPhase)])

  const loadSessions = useCallback(async () => {
    try {
      // 始终加载包含归档的完整清单，让「进行中 / 已归档」双标签计数实时准确
      const list = await api.listChatSessions(true)
      setSessions(list)
      if (!activeIdRef.current && searchParams.get('new') !== '1') {
        const firstActive = list.find((s) => !s.archived) || list[0]
        if (firstActive) {
          activeIdRef.current = firstActive.id
          setActiveId(firstActive.id)
        }
      }
    } catch {
      // handled silently
    }
  }, [searchParams])

  const loadDetail = useCallback(
    async (id: string, opts?: { silent?: boolean }) => {
      const reqSeq = ++detailReqSeqRef.current
      if (!opts?.silent && activeIdRef.current === id) setLoadingDetail(true)
      try {
        const [d, ctx, tds, trns, fls] = await Promise.all([
          api.getChatSession(id, 180),
          api.getChatContext(id).catch(() => null),
          api.getChatTodos(id).catch(() => []),
          api.getChatTurns(id).catch(() => []),
          api.listSessionFiles(id).catch(() => []),
        ])
        // Discard stale responses if user already switched sessions or a newer load started
        if (activeIdRef.current !== id || detailReqSeqRef.current !== reqSeq) return
        setDetail(d)
        setContextInfo(ctx)
        setTodos(tds)
        setTurns(trns)
        setSessionFiles(fls)
        if (d.providerId) setSelectedProviderId(d.providerId)
        setSelectedProfileId(d.agentProfileId || '')
      } catch (err) {
        if (activeIdRef.current !== id || detailReqSeqRef.current !== reqSeq) return
        if (!opts?.silent) {
          push(err instanceof ApiClientError ? err.message : '加载会话失败', 'error')
        }
      } finally {
        if (activeIdRef.current === id && detailReqSeqRef.current === reqSeq && !opts?.silent) {
          setLoadingDetail(false)
        }
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

  // Keep left session rail running indicators fresh every 5s (paused when tab is hidden)
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadSessions()
      }
    }, 5000)
    return () => window.clearInterval(timer)
  }, [loadSessions])

  // Sync external URL ?session=... navigation cleanly into activeId
  useEffect(() => {
    const urlSession = searchParams.get('session')
    if (urlSession && urlSession !== activeIdRef.current) {
      activeIdRef.current = urlSession
      setActiveId(urlSession)
      setShowScrollBottom(false)
    }
  }, [searchParams])

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      void (async () => {
        try {
          const created = await api.createChatSession({})
          setSessions((prev) => [created, ...prev])
          activeIdRef.current = created.id
          setActiveId(created.id)
          setSearchParams({ session: created.id }, { replace: true })
        } catch (err) {
          push(err instanceof ApiClientError ? err.message : '创建会话失败', 'error')
        }
      })()
    }
  }, [push, searchParams, setSearchParams])

  // Synchronously isolate & reset all per-session state whenever activeId changes
  useEffect(() => {
    // Abort any in-flight client stream from the previous session (server turn remains durable!)
    abortRef.current?.abort()
    abortRef.current = null
    setStreamingSessionId(null)
    setStreamPhase(null)
    setStreamRound(null)
    setStreamTool(null)
    setStreamToolSec(null)
    resetStreamBuffers(activeId)
    setContextInfo(null)
    setTodos([])
    setTurns([])
    setSessionFiles([])
    setTreeData(null)
    setAttachments([])
    setShowScrollBottom(false)

    if (activeId) {
      setDetail((prev) => (prev && prev.id === activeId ? prev : null))
      void loadDetail(activeId)
    } else {
      detailReqSeqRef.current += 1
      setDetail(null)
      setLoadingDetail(false)
    }
  }, [activeId, loadDetail, resetStreamBuffers])

  // Auto-grow composer textarea cleanly
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 44), 180)}px`
  }, [input])

  const activeSessionSummary = useMemo(
    () => sessions.find((s) => s.id === activeId) || null,
    [sessions, activeId],
  )

  const isServerRunning = Boolean(
    activeId &&
      (resuming ||
        currentDetail?.running ||
        activeSessionSummary?.running ||
        (currentDetail != null && turns.some((t) => t.status === 'running'))),
  )

  // Auto-clear stopping indicator once session exits running/streaming state
  useEffect(() => {
    if (stopping && !streaming && !isServerRunning && !streamPhase) {
      setStoppingSessionId((cur) => (cur === activeId ? null : cur))
    }
  }, [stopping, streaming, isServerRunning, streamPhase, activeId])
  // Abort active client fetch cleanly on unmount (server turn stays durable & keeps running)
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  // Auto-reattach live SSE stream (with instant-wake poll fallback) whenever returning to a running session
  useEffect(() => {
    if (!activeId || !isServerRunning || streaming) return
    const sid = activeId
    let alive = true
    const ctrl = new AbortController()
    const isStillCurrent = () => alive && activeIdRef.current === sid

    resetStreamBuffers(sid)
    setStreamRound(null)
    setStreamTool(null)
    setStreamToolSec(null)
    setStreamPhase('已自动续接后台运行中的智能体实时流…')

    const applyPhase = (p: { phase?: string; round?: number; tool?: string }) => {
      if (!isStillCurrent()) return
      const kind = String(p.phase || '')
      if (typeof p.round === 'number') setStreamRound(p.round + 1)
      if (kind === 'thinking') {
        setStreamTool(null)
        setStreamToolSec(null)
        setStreamPhase(
          typeof p.round === 'number'
            ? `后台运行中 · 第 ${p.round + 1} 轮思考中…`
            : '后台运行中 · 思考中…',
        )
      } else if (kind === 'tool') {
        const toolName = String(p.tool || '')
        setStreamTool(toolName || null)
        setStreamToolSec(0)
        setStreamPhase(`后台运行中 · 正在调用工具 ${toolName}…`)
      } else if (kind === 'resume') {
        setStreamPhase('后台运行中 · 正在自动纠偏续跑…')
      } else if (kind) {
        setStreamPhase(`后台运行中 · ${kind}`)
      }
    }

    const appendPersistedMessage = (msg: ChatMessageOut) => {
      if (!isStillCurrent()) return
      resetStreamBuffers(sid)
      setStreamTool(null)
      setStreamToolSec(null)
      setDetail((prev) => {
        if (!prev || prev.id !== sid) return prev
        if (msg.id && prev.messages.some((x) => x.id === msg.id)) return prev
        return { ...prev, messages: [...prev.messages, msg] }
      })
    }

    const runAttach = async () => {
      // When triggered by manual resume, give backend ~220ms to run hub.begin() so we don't hit stale ended flag
      if (resumingSessionRef.current === sid) {
        await new Promise((r) => window.setTimeout(r, 220))
        if (!isStillCurrent()) return
      }

      let ended = false
      let sawFrames = false
      try {
        await api.attachChatStream(
          sid,
          {
            onPhase: (p) => {
              if (!isStillCurrent()) return
              sawFrames = true
              applyPhase(p)
            },
            onDelta: (chunk) => {
              if (!isStillCurrent()) return
              sawFrames = true
              streamBufRef.current.text += chunk
              scheduleStreamFlush(sid)
            },
            onReasoning: (chunk) => {
              if (!isStillCurrent()) return
              sawFrames = true
              streamBufRef.current.reasoning += chunk
              scheduleStreamFlush(sid)
            },
            onToolOutput: (p) => {
              if (!isStillCurrent()) return
              sawFrames = true
              const c = p.chunk || p.text || ''
              if (c) {
                streamBufRef.current.toolOut = (streamBufRef.current.toolOut + c).slice(-8000)
                scheduleStreamFlush(sid)
              }
            },
            onToolProgress: (p) => {
              if (!isStillCurrent()) return
              sawFrames = true
              if (p.tool) setStreamTool(p.tool)
              if (typeof p.seconds === 'number') setStreamToolSec(p.seconds)
            },
            onMessage: (m) => {
              if (!isStillCurrent()) return
              sawFrames = true
              appendPersistedMessage(m)
            },
            onAwaiting: () => {
              if (!isStillCurrent()) return
              sawFrames = true
              setStreamPhase('等待人工审批工具调用')
            },
            onError: (message) => {
              if (isStillCurrent()) push(message, 'error')
            },
            onDone: () => {
              ended = true
            },
          },
          ctrl.signal,
        )
      } catch {
        // SSE unavailable or closed; fallback sync below handles completion / continuation
      }

      if (!isStillCurrent()) return

      if (ended && (sawFrames || resumingSessionRef.current !== sid)) {
        resetStreamBuffers(sid)
        setStreamPhase(null)
        setStreamRound(null)
        setStreamTool(null)
        setStreamToolSec(null)
        await Promise.all([loadDetail(sid, { silent: true }), loadSessions()])
        return
      }

      // Fallback loop: if SSE stream ended without a done frame (or before resume hub.begin()),
      // sync DB + instant-wake long-poll until turn completes.
      let cursor = 0
      while (isStillCurrent()) {
        try {
          const snap = await api.pollChatLive(sid, cursor)
          if (!isStillCurrent()) break
          if (snap.frames.length > 0) sawFrames = true
          cursor = snap.next
          for (const frame of snap.frames) {
            const data = (frame.data || {}) as Record<string, unknown>
            if (frame.event === 'delta' && typeof data.text === 'string') {
              streamBufRef.current.text += data.text
              scheduleStreamFlush(sid)
            } else if (frame.event === 'reasoning' && typeof data.text === 'string') {
              streamBufRef.current.reasoning += data.text
              scheduleStreamFlush(sid)
            } else if (frame.event === 'tool_output') {
              const c =
                typeof data.chunk === 'string'
                  ? data.chunk
                  : typeof data.text === 'string'
                    ? data.text
                    : ''
              if (c) {
                streamBufRef.current.toolOut = (streamBufRef.current.toolOut + c).slice(-8000)
                scheduleStreamFlush(sid)
              }
            } else if (frame.event === 'tool_progress') {
              if (typeof data.tool === 'string') setStreamTool(data.tool)
              if (typeof data.seconds === 'number') setStreamToolSec(data.seconds)
            } else if (frame.event === 'phase') {
              applyPhase(data as { phase?: string; round?: number; tool?: string })
            } else if (frame.event === 'message') {
              appendPersistedMessage(data as unknown as ChatMessageOut)
            } else if (frame.event === 'done') {
              ended = true
            }
          }

          if (snap.ended || ended) {
            if (!sawFrames && resumingSessionRef.current === sid) {
              // Resume HTTP request is still starting hub.begin(); wait briefly and re-poll
              cursor = 0
              await new Promise((r) => window.setTimeout(r, 350))
              continue
            }
            if (!isStillCurrent()) break
            resetStreamBuffers(sid)
            setStreamPhase(null)
            await Promise.all([loadDetail(sid, { silent: true }), loadSessions()])
            break
          }

          if (snap.frames.length === 0) {
            const [freshDetail, freshTurns] = await Promise.all([
              api.getChatSession(sid, 180).catch(() => null),
              api.getChatTurns(sid).catch(() => null),
            ])
            if (!isStillCurrent()) break
            if (freshDetail && freshDetail.id === sid) setDetail(freshDetail)
            if (freshTurns) {
              setTurns(freshTurns)
              if (!freshTurns.some((t) => t.status === 'running') && resumingSessionRef.current !== sid) {
                resetStreamBuffers(sid)
                setStreamPhase(null)
                await loadSessions()
                break
              }
            }
          }
        } catch {
          if (!isStillCurrent()) break
          await new Promise((r) => window.setTimeout(r, 1200))
        }
      }
    }

    void runAttach()
    return () => {
      alive = false
      ctrl.abort()
      resetStreamBuffers(null)
      setStreamPhase(null)
      setStreamRound(null)
      setStreamTool(null)
      setStreamToolSec(null)
    }
  }, [
    activeId,
    isServerRunning,
    streaming,
    loadDetail,
    loadSessions,
    push,
    resetStreamBuffers,
    scheduleStreamFlush,
  ])

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollAreaRef.current
    if (!el) return
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    } else {
      el.scrollTop = el.scrollHeight
    }
  }, [])

  useEffect(() => {
    if (!showScrollBottom) {
      scrollToBottom(false)
    }
  }, [currentDetail?.messages.length, streamText, streamReasoning, liveToolOut, showScrollBottom, scrollToBottom])

  const handleScrollArea = () => {
    const el = scrollAreaRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollBottom(distFromBottom > 240)
  }

  const existingProjects = useMemo(() => {
    const set = new Set<string>()
    for (const s of sessions) {
      if (s.project?.trim()) set.add(s.project.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  }, [sessions])

  const displayBlocks = useMemo(
    () => groupConversationMessages(currentDetail?.messages || []),
    [currentDetail?.messages],
  )

  const resumableTurn = useMemo(() => {
    if (!currentDetail) return null
    return turns.find((t) => t.resumable && t.status === 'interrupted') || null
  }, [currentDetail, turns])

  const attackChainSteps = useMemo(() => {
    if (!currentDetail) return []
    return currentDetail.messages
      .filter((m) => m.role === 'tool' || m.toolName)
      .map((m, idx) => ({
        index: idx + 1,
        id: m.id,
        toolName: m.toolName || 'tool',
        failed: Boolean(m.toolFailed),
        durationMs: m.durationMs,
        createdAt: m.createdAt,
        summary: summarizeToolArgs(m.toolName, m.toolArgs) || m.content.slice(0, 140),
        ...classifyAttackStage(m.toolName || ''),
      }))
  }, [currentDetail])

  const activeProviderLabel = useMemo(
    () => providers.find((p) => p.id === selectedProviderId)?.label || '默认模型',
    [providers, selectedProviderId],
  )

  const activeProfileName = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId)?.name || '',
    [profiles, selectedProfileId],
  )

  const handleNewSession = async () => {
    try {
      const created = await api.createChatSession({})
      setSessions((prev) => [created, ...prev])
      activeIdRef.current = created.id
      setActiveId(created.id)
      setSearchParams({ session: created.id }, { replace: true })
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '创建会话失败', 'error')
    }
  }

  const handleSelectSession = (id: string) => {
    if (id === activeIdRef.current) return
    activeIdRef.current = id
    setActiveId(id)
    setShowScrollBottom(false)
    setSearchParams({ session: id }, { replace: true })
  }

  const handleProfileChange = async (profileId: string) => {
    const sid = activeId
    setSelectedProfileId(profileId)
    if (!sid) return
    try {
      await api.updateChatSettings(sid, { agentProfileId: profileId || null })
      push(
        profileId ? '已绑定 Agent 角色画像（工具与技能边界生效）' : '已切换为平台默认角色',
        'success',
      )
      if (activeIdRef.current === sid) await loadDetail(sid)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '切换角色失败', 'error')
    }
  }

  const handleFork = async (messageSeq?: number) => {
    const sid = activeId
    if (!sid) return
    try {
      const forked = await api.forkChatSession(sid, { messageSeq })
      push(`已分叉出新分支：${forked.title}`, 'success')
      await loadSessions()
      handleSelectSession(forked.id)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '分叉会话失败', 'error')
    }
  }

  const handleOpenTree = async () => {
    const sid = activeId
    if (!sid) return
    setTreeData(null)
    setTreeOpen(true)
    try {
      const t = await api.getChatSessionTree(sid)
      if (activeIdRef.current === sid) setTreeData(t)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载分支树失败', 'error')
    }
  }

  const handleResumeTurn = async (runId: string) => {
    const sid = activeId
    if (!sid || resumingSessionRef.current === sid) return
    resumingSessionRef.current = sid
    setResumingSessionId(sid)
    setShowScrollBottom(false)
    setStreamPhase('正在接手并续跑中断的智能体轮次…')
    // Optimistically mark session running so the live SSE reattach effect subscribes to chat_live.hub immediately
    setDetail((prev) => (prev && prev.id === sid ? { ...prev, running: true } : prev))
    try {
      await api.resumeChatTurn(sid, runId)
      push('续跑轮次已完成', 'success')
      await loadSessions()
      if (activeIdRef.current === sid) {
        await loadDetail(sid, { silent: true })
      }
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '恢复轮次失败', 'error')
      if (activeIdRef.current === sid) {
        await loadDetail(sid, { silent: true })
      }
    } finally {
      if (resumingSessionRef.current === sid) resumingSessionRef.current = null
      setResumingSessionId((cur) => (cur === sid ? null : cur))
    }
  }

  const handleProviderChange = async (providerId: string) => {
    const sid = activeId
    setSelectedProviderId(providerId)
    if (!sid) return
    try {
      await api.updateChatSettings(sid, { providerId: providerId || null })
      if (activeIdRef.current === sid) await loadDetail(sid)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '保存会话模型失败', 'error')
    }
  }

  const handleRenameSession = async (id: string, title: string) => {
    try {
      const updated = await api.renameChatSession(id, title)
      setSessions((prev) => prev.map((x) => (x.id === id ? updated : x)))
      if (detail?.id === id) {
        setDetail((prev) => (prev ? { ...prev, title: updated.title } : prev))
      }
      push('会话已重命名', 'success')
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '重命名失败', 'error')
    }
  }

  const handleTogglePin = async (s: ChatSessionOut) => {
    try {
      const updated = await api.pinChatSession(s.id, !s.pinned)
      setSessions((prev) => prev.map((x) => (x.id === s.id ? updated : x)))
      push(updated.pinned ? '已置顶会话' : '已取消置顶', 'success')
    } catch {
      push('操作失败', 'error')
    }
  }

  const handleConfirmArchive = async () => {
    if (!archiveTarget) return
    setConfirmBusy(true)
    try {
      await api.archiveChatSession(archiveTarget.id)
      if (activeId === archiveTarget.id) {
        const nextActive = sessions.find((x) => !x.archived && x.id !== archiveTarget.id)
        const nextId = nextActive ? nextActive.id : null
        activeIdRef.current = nextId
        setActiveId(nextId)
        if (nextActive) setSearchParams({ session: nextActive.id }, { replace: true })
        else setSearchParams({}, { replace: true })
      }
      setArchiveTarget(null)
      push('会话已移入已归档（沙箱与临时附件已清理）', 'default')
      await loadSessions()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '归档失败', 'error')
    } finally {
      setConfirmBusy(false)
    }
  }

  const handleUnarchive = async (s: ChatSessionOut) => {
    try {
      await api.unarchiveChatSession(s.id)
      push('已从归档恢复会话', 'success')
      await loadSessions()
      handleSelectSession(s.id)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '恢复失败', 'error')
    }
  }

  const handleConfirmPurge = async () => {
    if (!purgeTarget) return
    setConfirmBusy(true)
    try {
      await api.purgeChatSession(purgeTarget.id)
      if (activeId === purgeTarget.id) {
        activeIdRef.current = null
        setActiveId(null)
        setDetail(null)
        setSearchParams({}, { replace: true })
      }
      setPurgeTarget(null)
      push('已彻底删除该会话及其全部记录', 'default')
      await loadSessions()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '彻底删除失败', 'error')
    } finally {
      setConfirmBusy(false)
    }
  }

  const handleConfirmPurgeAllArchived = async () => {
    setConfirmBusy(true)
    try {
      const res = await api.purgeArchivedChatSessions()
      if (currentDetail?.archived) {
        activeIdRef.current = null
        setActiveId(null)
        setDetail(null)
        setSearchParams({}, { replace: true })
      }
      setPurgeAllOpen(false)
      push(`已清空 ${res.deleted} 条归档会话（共 ${res.messages} 条消息）`, 'default')
      await loadSessions()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '清空归档失败', 'error')
    } finally {
      setConfirmBusy(false)
    }
  }

  const handleForkSession = async (target: ChatSessionOut) => {
    try {
      const forked = await api.forkChatSession(target.id, {})
      push(`已分叉出新分支：${forked.title}`, 'success')
      await loadSessions()
      handleSelectSession(forked.id)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '分叉会话失败', 'error')
    }
  }

  const handleBatchPin = async (ids: string[], pinned: boolean) => {
    const results = await Promise.allSettled(ids.map((id) => api.pinChatSession(id, pinned)))
    const ok = results.filter((r) => r.status === 'fulfilled').length
    push(pinned ? `已批量置顶 ${ok} 条会话` : `已批量取消置顶 ${ok} 条会话`, 'success')
    await loadSessions()
  }

  const handleBatchMoveProject = async (ids: string[], project: string | null) => {
    const results = await Promise.allSettled(
      ids.map((id) => api.updateChatSettings(id, { project })),
    )
    const ok = results.filter((r) => r.status === 'fulfilled').length
    push(project ? `已将 ${ok} 条会话移入项目「${project}」` : `已将 ${ok} 条会话移出项目分组`, 'success')
    await loadSessions()
    if (activeId && ids.includes(activeId)) await loadDetail(activeId)
  }

  const handleConfirmBatchArchive = async () => {
    if (batchArchiveIds.length === 0) return
    setConfirmBusy(true)
    try {
      const results = await Promise.allSettled(
        batchArchiveIds.map((id) => api.archiveChatSession(id)),
      )
      const ok = results.filter((r) => r.status === 'fulfilled').length
      if (activeId && batchArchiveIds.includes(activeId)) {
        const nextActive = sessions.find((x) => !x.archived && !batchArchiveIds.includes(x.id))
        const nextId = nextActive ? nextActive.id : null
        activeIdRef.current = nextId
        setActiveId(nextId)
        if (nextActive) setSearchParams({ session: nextActive.id }, { replace: true })
        else setSearchParams({}, { replace: true })
      }
      setBatchArchiveIds([])
      push(`已批量归档 ${ok} 条会话`, 'default')
      await loadSessions()
    } finally {
      setConfirmBusy(false)
    }
  }

  const handleBatchUnarchive = async (ids: string[]) => {
    const results = await Promise.allSettled(ids.map((id) => api.unarchiveChatSession(id)))
    const ok = results.filter((r) => r.status === 'fulfilled').length
    push(`已批量恢复 ${ok} 条会话`, 'success')
    await loadSessions()
  }

  const handleConfirmBatchPurge = async () => {
    if (batchPurgeIds.length === 0) return
    setConfirmBusy(true)
    try {
      const results = await Promise.allSettled(
        batchPurgeIds.map((id) => api.purgeChatSession(id)),
      )
      const ok = results.filter((r) => r.status === 'fulfilled').length
      if (activeId && batchPurgeIds.includes(activeId)) {
        activeIdRef.current = null
        setActiveId(null)
        setDetail(null)
        setSearchParams({}, { replace: true })
      }
      setBatchPurgeIds([])
      push(`已彻底删除 ${ok} 条归档会话`, 'default')
      await loadSessions()
    } finally {
      setConfirmBusy(false)
    }
  }

  const handleUploadFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    let targetSessionId = activeId
    if (!targetSessionId) {
      const created = await api.createChatSession({})
      setSessions((prev) => [created, ...prev])
      activeIdRef.current = created.id
      setActiveId(created.id)
      targetSessionId = created.id
    }
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const out = await api.uploadChatAttachment(targetSessionId, file)
        if (activeIdRef.current === targetSessionId) {
          setAttachments((prev) => [...prev, out])
        }
      }
      push('附件已上传至会话工作区', 'success')
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '附件上传失败', 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text) return

    let sid = activeId
    if (!sid) {
      try {
        const created = await api.createChatSession({})
        setSessions((prev) => [created, ...prev])
        activeIdRef.current = created.id
        setActiveId(created.id)
        setSearchParams({ session: created.id }, { replace: true })
        sid = created.id
      } catch (err) {
        push(err instanceof ApiClientError ? err.message : '创建会话失败', 'error')
        return
      }
    }

    if (streaming || isServerRunning) {
      try {
        const msg = await api.interjectChat(sid, text)
        setDetail((prev) =>
          prev && prev.id === sid ? { ...prev, messages: [...prev.messages, msg] } : prev,
        )
        if (activeIdRef.current === sid) setInput('')
        push('已插入消息，智能体将在下一轮读取', 'success')
      } catch (err) {
        push(err instanceof ApiClientError ? err.message : '插话失败', 'error')
      }
      return
    }

    const attIds = attachments.map((a) => a.id)
    setInput('')
    setAttachments([])
    setShowScrollBottom(false)
    setStreamingSessionId(sid)
    setStreamPhase('正在连接模型…')
    setStreamRound(1)
    setStreamTool(null)
    setStreamToolSec(null)
    resetStreamBuffers(sid)

    const optimisticUser: ChatMessageOut = {
      id: `local-${Date.now()}`,
      seq: (currentDetail?.messages.at(-1)?.seq || 0) + 1,
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
      prev && prev.id === sid ? { ...prev, messages: [...prev.messages, optimisticUser] } : prev,
    )

    const ctrl = new AbortController()
    abortRef.current = ctrl
    const isStillCurrent = () => activeIdRef.current === sid && !ctrl.signal.aborted

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
            if (!isStillCurrent()) return
            if (typeof p.round === 'number') setStreamRound(p.round + 1)
            if (p.phase === 'thinking') {
              setStreamTool(null)
              setStreamToolSec(null)
              setStreamPhase(`第 ${(p.round || 0) + 1} 轮思考中…`)
            } else if (p.phase === 'tool') {
              setStreamTool(p.tool || null)
              setStreamToolSec(0)
              setStreamPhase(`正在调用工具 ${p.tool || ''}…`)
            } else if (p.phase === 'resume') {
              setStreamPhase('正在自动纠偏续跑…')
            }
          },
          onDelta: (chunk) => {
            if (!isStillCurrent()) return
            streamBufRef.current.text += chunk
            scheduleStreamFlush(sid)
          },
          onReasoning: (chunk) => {
            if (!isStillCurrent()) return
            streamBufRef.current.reasoning += chunk
            scheduleStreamFlush(sid)
          },
          onToolOutput: (p) => {
            if (!isStillCurrent()) return
            const c = p.chunk || p.text || ''
            if (c) {
              streamBufRef.current.toolOut = (streamBufRef.current.toolOut + c).slice(-8000)
              scheduleStreamFlush(sid)
            }
          },
          onToolProgress: (p) => {
            if (!isStillCurrent()) return
            if (p.tool) setStreamTool(p.tool)
            if (typeof p.seconds === 'number') setStreamToolSec(p.seconds)
          },
          onMessage: (msg) => {
            if (!isStillCurrent()) return
            resetStreamBuffers(sid)
            setStreamTool(null)
            setStreamToolSec(null)
            setDetail((prev) => {
              if (!prev || prev.id !== sid) return prev
              const withoutLocal =
                msg.role === 'user'
                  ? prev.messages.filter((m) => !m.id.startsWith('local-'))
                  : prev.messages
              if (withoutLocal.some((m) => m.id === msg.id)) return prev
              return { ...prev, messages: [...withoutLocal, msg] }
            })
          },
          onAwaiting: () => {
            if (isStillCurrent()) setStreamPhase('等待人工审批工具调用')
          },
          onError: (message) => {
            if (isStillCurrent()) push(message, 'error')
          },
          onDone: () => {
            if (isStillCurrent()) setStreamPhase(null)
          },
        },
        ctrl.signal,
      )
      await loadSessions()
      if (activeIdRef.current === sid) {
        await loadDetail(sid, { silent: true })
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        if (activeIdRef.current === sid) {
          push(err instanceof ApiClientError ? err.message : '对话请求中断', 'error')
          await loadDetail(sid, { silent: true })
        }
      }
    } finally {
      setStreamingSessionId((cur) => (cur === sid ? null : cur))
      if (abortRef.current === ctrl) {
        abortRef.current = null
      }
      if (activeIdRef.current === sid) {
        setStreamPhase(null)
        setStreamRound(null)
        setStreamTool(null)
        setStreamToolSec(null)
        resetStreamBuffers(sid)
      }
    }
  }

  const slashMatches = useMemo(() => {
    if (!input.startsWith('/')) return []
    const q = input.slice(1).trim().toLowerCase()
    if (q.includes(' ')) return []
    return SLASH_COMMANDS.filter(
      (item) =>
        item.cmd.slice(1).startsWith(q) ||
        item.label.toLowerCase().includes(q) ||
        item.hint.toLowerCase().includes(q),
    )
  }, [input])

  const handleApplySlash = async (item: SlashCommandItem) => {
    setInput('')
    setSlashIndex(0)
    if (item.action === 'compact') {
      await handleCompact()
      return
    }
    if (item.action === 'open-sandbox') {
      setWorkspaceTab('sandbox')
      setWorkspaceOpen(true)
      return
    }
    if (item.action === 'reset-sandbox') {
      if (!activeId) {
        push('请先选择或创建一个会话', 'default')
        return
      }
      try {
        await api.resetChatSandbox(activeId)
        push('已重建干净沙箱容器（/work/persist 已保留）', 'success')
      } catch (err) {
        push(err instanceof ApiClientError ? err.message : '重建沙箱失败', 'error')
      }
      return
    }
    if (item.prompt) {
      setInput(item.prompt)
      textareaRef.current?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = e.clipboardData?.files
    if (files && files.length > 0) {
      e.preventDefault()
      void handleUploadFile(files)
    }
  }

  const handleStop = async () => {
    const sid = activeId
    if (!sid || stoppingSessionId === sid) return
    setStoppingSessionId(sid)
    setStreamPhase('正在强制中断模型流并终止运行中的沙箱进程…')
    try {
      await api.interruptChat(sid, 'stop', '用户手动停止')
      push('已发送强制停止信号', 'default')
    } catch {
      abortRef.current?.abort()
    }
    // 后端抢占式取消通常在 <200ms 内发回 done 帧并收尾；兜底 2.5s 后主动同步状态，避免网络抖动卡住按钮
    window.setTimeout(() => {
      setStoppingSessionId((cur) => (cur === sid ? null : cur))
      if (activeIdRef.current === sid) {
        void Promise.all([loadDetail(sid, { silent: true }), loadSessions()])
      }
    }, 2500)
  }

  const handleApprove = async (messageId: string, approve: boolean) => {
    const sid = activeId
    if (!sid) return
    try {
      await api.approveChatTool(sid, messageId, approve)
      push(approve ? '已批准工具执行' : '已拒绝该工具调用', 'success')
      if (activeIdRef.current === sid) await loadDetail(sid)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '审批操作失败', 'error')
    }
  }

  const handleCompact = async () => {
    const sid = activeId
    if (!sid) return
    try {
      await api.compactChatSession(sid)
      push('上下文已完成摘要压缩', 'success')
      if (activeIdRef.current === sid) await loadDetail(sid)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '上下文压缩失败', 'error')
    }
  }

  const runningSessionIds = useMemo(() => {
    const ids = new Set<string>()
    for (const s of sessions) {
      if (s.running) ids.add(s.id)
    }
    if (streamingSessionId) ids.add(streamingSessionId)
    if (resumingSessionId) ids.add(resumingSessionId)
    if (activeId && isServerRunning) ids.add(activeId)
    return ids
  }, [sessions, streamingSessionId, resumingSessionId, activeId, isServerRunning])

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-canvas">
      {/* Left Session Rail (Viewport-Locked, Grouped, Full Session Management) */}
      {railOpen && (
        <SessionRail
          sessions={sessions}
          activeId={activeId}
          runningIds={runningSessionIds}
          onSelect={handleSelectSession}
          onNew={() => void handleNewSession()}
          onRename={handleRenameSession}
          onTogglePin={handleTogglePin}
          onRequestArchive={setArchiveTarget}
          onUnarchive={handleUnarchive}
          onRequestPurge={setPurgeTarget}
          onRequestPurgeAllArchived={() => setPurgeAllOpen(true)}
          onFork={handleForkSession}
          onOpenSettings={setSettingsTarget}
          onBatchPin={handleBatchPin}
          onBatchMoveProject={handleBatchMoveProject}
          onRequestBatchArchive={setBatchArchiveIds}
          onBatchUnarchive={handleBatchUnarchive}
          onRequestBatchPurge={setBatchPurgeIds}
        />
      )}

      {/* Main Conversation Canvas (Pinned Header + Scrollable Stream + Pinned Composer) */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Session Header Bar (with subtle ambient WebGL shader ribbon) */}
        <div className="relative shrink-0 overflow-hidden border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur">
          <div className="pointer-events-none absolute inset-0 z-0 opacity-75 dark:opacity-35">
            <MeshAuroraShader palette={currentDetail?.challenge ? 'ctf' : 'indigo'} speed={0.55} />
            <div className="absolute inset-0 bg-gradient-to-r from-surface/74 via-surface/58 to-surface/72 dark:from-surface/92 dark:via-surface/85 dark:to-surface/90" />
          </div>
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setRailOpen((v) => !v)}
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-subtle text-ink-secondary transition-colors hover:border-line-strong hover:text-ink lg:inline-flex"
              title={railOpen ? '收起会话列表' : '展开会话列表'}
            >
              <PanelLeft className="h-4 w-4" />
            </button>

            <TactileAppIcon variant={currentDetail?.challenge ? 'ctf' : 'chat'} size={30} />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-semibold text-ink">
                  {currentDetail?.title || activeSessionSummary?.title || '安全智能体对话工作台'}
                </h1>
                {currentDetail?.project && (
                  <Badge className="shrink-0">
                    <Folder className="h-2.5 w-2.5 text-accent" />
                    {currentDetail.project}
                  </Badge>
                )}
                {currentDetail?.requireApproval && (
                  <Badge className="shrink-0 border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    <ShieldCheck className="h-2.5 w-2.5" />
                    人工审批
                  </Badge>
                )}
                {currentDetail?.challenge && (
                  <Badge className="shrink-0 border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                    CTF · {currentDetail.challenge.title}
                  </Badge>
                )}
              </div>

              {contextInfo && (
                <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-secondary">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-wash">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          contextInfo.percent >= 80
                            ? 'bg-red-500'
                            : contextInfo.percent >= 50
                              ? 'bg-amber-500'
                              : 'bg-accent',
                        )}
                        style={{ width: `${Math.min(100, Math.max(3, contextInfo.percent))}%` }}
                      />
                    </div>
                    <span className="font-mono text-[10px] tabular-nums text-ink-muted">
                      上下文 {contextInfo.percent}% · {formatCompactNumber(contextInfo.usedTokens)} /{' '}
                      {formatCompactNumber(contextInfo.windowTokens)}
                    </span>
                  </div>
                  {contextInfo.percent >= 40 && (
                    <button
                      type="button"
                      onClick={handleCompact}
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-accent hover:bg-accent-soft"
                    >
                      <Minimize2 className="h-2.5 w-2.5" />
                      压缩
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {profiles.length > 0 && (
              <Select
                size="sm"
                variant="subtle"
                align="right"
                value={selectedProfileId}
                onChange={(v) => void handleProfileChange(v)}
                icon={<Bot className="h-3.5 w-3.5 text-accent" />}
                className="max-w-[164px]"
                menuClassName="w-60"
                title="绑定 Agent 角色画像（控制工具白名单与技能注入）"
                options={[
                  {
                    value: '',
                    label: '默认通用角色',
                    description: '使用平台默认全量工具与技能集',
                  },
                  ...profiles.map((p) => ({
                    value: p.id,
                    label: p.name,
                    description: p.description || undefined,
                  })),
                ]}
              />
            )}

            {providers.length > 0 && (
              <Select
                size="sm"
                variant="subtle"
                align="right"
                value={selectedProviderId}
                onChange={(v) => void handleProviderChange(v)}
                icon={<Cpu className="h-3.5 w-3.5 text-ink-muted" />}
                className="max-w-[164px]"
                menuClassName="w-60"
                title="切换当前会话使用的模型接入点"
                options={providers.map((p) => ({
                  value: p.id,
                  label: p.label,
                  description: p.model,
                  badge: p.isDefault ? '默认' : undefined,
                }))}
              />
            )}

            {activeId && currentDetail && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSettingsTarget(currentDetail)}
                  title="会话设置（重命名 / 项目分组 / 人工审批 / MCP 与技能挂载）"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void handleFork()} title="分叉新分支">
                  <GitFork className="h-3.5 w-3.5" />
                  分叉
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void handleOpenTree()} title="查看分支树">
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
        </div>

        {/* Live Plan / Todo Strip */}
        {todos.length > 0 && (
          <div className="shrink-0 border-b border-line bg-subtle/70 px-5 py-2">
            <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2 text-xs">
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
        {resumableTurn && !streaming && !isServerRunning && (
          <div className="shrink-0 border-b border-amber-200 bg-amber-50/80 px-5 py-2.5 dark:border-amber-900/60 dark:bg-amber-950/40">
            <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 text-xs">
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

        {/* Pinned CTF Challenge Cockpit (keyed by challengeId to prevent cross-session state reuse) */}
        {currentDetail?.challenge && (
          <ChallengeCockpit
            key={currentDetail.challenge.id}
            challengeRef={currentDetail.challenge}
            hasChatMessages={displayBlocks.length > 0}
            onQuickPrompt={(prompt) => void handleSend(prompt)}
            onRefreshSession={() =>
              activeId ? loadDetail(activeId, { silent: true }) : Promise.resolve()
            }
          />
        )}

        {/* Scrollable Message Stream */}
        <div
          ref={scrollAreaRef}
          onScroll={handleScrollArea}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6"
        >
          <div className="mx-auto max-w-4xl space-y-5 pb-4">
            {loadingDetail || (activeId && !currentDetail) ? (
              <div className="flex items-center justify-center py-24 text-xs text-ink-muted">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                加载会话记录…
              </div>
            ) : (
              <>
                {(!currentDetail || displayBlocks.length === 0) && !currentDetail?.challenge ? (
                  <div className="relative overflow-hidden rounded-2xl border border-line bg-surface/80 px-6 py-10 shadow-editorial">
                    <div className="pointer-events-none absolute inset-0 z-0 opacity-70">
                      <DotWarpCanvas gap={26} />
                    </div>
                    <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center text-center">
                      <SuvexAppIcon size={54} animated className="mb-4" />
                      <h2 className="text-lg font-semibold tracking-[-0.02em] text-ink">
                        <span className="kinetic-gradient-text">向 Suvex 2 智能体下达安全任务</span>
                      </h2>
                      <p className="mt-2 max-w-lg text-xs leading-relaxed text-ink-secondary">
                        支持绑定自定义 Agent 角色画像与远程 HTTP MCP（如 ctf2-suvex），具备执行轨迹折叠、代码一键复制、分支 Fork 与攻击链可视化。
                      </p>
                      <div className="mt-6 grid w-full gap-2.5 sm:grid-cols-2">
                        {[
                          {
                            tag: '环境自检',
                            prompt: '帮我检查当前平台的沙箱、模型与已挂载 MCP 工具状态',
                          },
                          {
                            tag: 'CTF 协同',
                            prompt: '列出 CTF2 练习场里可做的 Web/Pwn 题目并开始解题',
                          },
                          {
                            tag: '漏洞复盘',
                            prompt: '总结最近一次扫描中已确证的高危漏洞与修复建议',
                          },
                          {
                            tag: '攻击面审计',
                            prompt: '分析一份 Web 登录接口可能存在的认证绕过攻击面',
                          },
                        ].map((item) => (
                          <SpotlightCard
                            key={item.prompt}
                            intensity="normal"
                            onClick={() => setInput(item.prompt)}
                            className="cursor-pointer bg-surface/90 p-3.5 text-left backdrop-blur transition-transform duration-200 hover:-translate-y-0.5 hover:border-accent/50"
                          >
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium text-accent">
                              <MessagesSquare className="h-3 w-3" />
                              {item.tag}
                            </span>
                            <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                              {item.prompt}
                            </p>
                          </SpotlightCard>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  displayBlocks.map((block) => {
                    if (block.kind === 'user') {
                      return (
                        <UserMessageBlock
                          key={block.msg.id}
                          msg={block.msg}
                          onFork={(seq) => void handleFork(seq)}
                        />
                      )
                    }
                    if (block.kind === 'trace') {
                      return (
                        <ExecutionTraceGroup
                          key={block.id}
                          items={block.items}
                          onApprove={handleApprove}
                        />
                      )
                    }
                    return (
                      <AssistantMessageBlock
                        key={block.msg.id}
                        msg={block.msg}
                        onFork={(seq) => void handleFork(seq)}
                      />
                    )
                  })
                )}
              </>
            )}

            {/* Live Streaming / Reattached Turn Card (strictly bound to activeId) */}
            {activeId && (streaming || streamPhase) && (
              <LiveStreamCard
                key={activeId}
                phase={streamPhase}
                round={streamRound}
                activeTool={streamTool}
                toolSeconds={streamToolSec}
                elapsedSec={streamElapsedSec}
                reasoning={streamReasoning}
                toolOut={liveToolOut}
                text={streamText}
                stopping={stopping}
                onStop={handleStop}
              />
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Scroll-to-Bottom Floating Pill */}
        {showScrollBottom && (
          <button
            type="button"
            onClick={() => {
              setShowScrollBottom(false)
              scrollToBottom(true)
            }}
            className="absolute bottom-32 right-6 z-20 inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface/95 px-3 py-1.5 text-xs font-medium text-ink shadow-elevated backdrop-blur transition-colors hover:border-accent hover:text-accent"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            {streaming || streamPhase ? '跟随最新输出' : '回到底部'}
          </button>
        )}

        {/* Modern Pinned Command Composer */}
        <div className="shrink-0 border-t border-line bg-surface/90 px-4 py-3 backdrop-blur sm:px-6">
          <div className="relative mx-auto max-w-4xl">
            {/* Slash Command Palette */}
            {slashMatches.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 z-30 mb-2 overflow-hidden rounded-xl border border-line-strong bg-surface p-1.5 shadow-dialog">
                <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-ink-muted">
                  <span>快捷斜杠指令 · Slash Commands</span>
                  <span className="font-mono">↑↓ 选择 · Enter 确认</span>
                </div>
                <div className="mt-0.5 space-y-0.5">
                  {slashMatches.map((item, idx) => (
                    <button
                      key={item.cmd}
                      type="button"
                      onMouseEnter={() => setSlashIndex(idx)}
                      onClick={() => void handleApplySlash(item)}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-xs transition-colors',
                        idx === slashIndex
                          ? 'bg-accent-soft text-accent-ink'
                          : 'text-ink-secondary hover:bg-wash/70 hover:text-ink',
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="shrink-0 rounded-md border border-accent/25 bg-surface px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent">
                          {item.cmd}
                        </span>
                        <span className="font-medium text-ink">{item.label}</span>
                      </div>
                      <span className="hidden truncate text-[11px] text-ink-muted sm:inline">
                        {item.hint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {attachments.map((att) => (
                  <span
                    key={att.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-subtle px-2.5 py-1 text-xs text-ink-secondary"
                  >
                    <Paperclip className="h-3 w-3 text-accent" />
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

            <div className="rounded-2xl border border-line bg-canvas p-2.5 shadow-editorial transition-all focus-within:border-accent/70 focus-within:ring-2 focus-within:ring-accent/15">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => void handleUploadFile(e.target.files)}
              />

              <textarea
                ref={textareaRef}
                rows={2}
                value={input}
                onPaste={handlePaste}
                onChange={(e) => {
                  setInput(e.target.value)
                  setSlashIndex(0)
                }}
                onKeyDown={(e) => {
                  if (slashMatches.length > 0) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setSlashIndex((i) => (i + 1) % slashMatches.length)
                      return
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setSlashIndex((i) => (i - 1 + slashMatches.length) % slashMatches.length)
                      return
                    }
                    if (e.key === 'Enter' || e.key === 'Tab') {
                      e.preventDefault()
                      const chosen = slashMatches[slashIndex] || slashMatches[0]
                      if (chosen) void handleApplySlash(chosen)
                      return
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      setInput('')
                      return
                    }
                  }
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSend()
                  }
                }}
                placeholder={
                  streaming || isServerRunning
                    ? '智能体执行中，可直接输入补充线索或指令（将在下一轮读取）…'
                    : '输入安全指令、粘贴题目/截图，或键入 / 唤起快捷指令…'
                }
                className="w-full resize-none bg-transparent px-1.5 py-1 text-sm leading-relaxed text-ink placeholder:text-ink-muted focus:outline-none"
              />

              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle pt-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-secondary transition-colors hover:border-line-strong hover:text-ink"
                    title="上传附件到工作区"
                  >
                    {uploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Paperclip className="h-3.5 w-3.5" />
                    )}
                    <span>上传附件</span>
                  </button>

                  <span className="hidden items-center gap-1 rounded-md bg-subtle px-2 py-1 font-mono text-[10px] text-ink-muted sm:inline-flex">
                    <Cpu className="h-3 w-3" />
                    {activeProviderLabel}
                  </span>

                  {activeProfileName && (
                    <span className="hidden items-center gap-1 rounded-md bg-accent-soft px-2 py-1 text-[10px] font-medium text-accent sm:inline-flex">
                      <Bot className="h-3 w-3" />
                      {activeProfileName}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="hidden text-[11px] text-ink-muted sm:inline">
                    Enter 发送 · Shift+Enter 换行
                  </span>
                  {(streaming || isServerRunning) && !input.trim() ? (
                    <Button
                      variant="danger"
                      size="sm"
                      loading={stopping}
                      disabled={stopping}
                      onClick={handleStop}
                      className="h-8 px-3"
                    >
                      {!stopping && <Square className="h-3 w-3" />}
                      {stopping ? '正在停止…' : '停止'}
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void handleSend()}
                      disabled={!input.trim()}
                      className="h-8 px-3.5"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {streaming || isServerRunning ? '插话' : '发送'}
                    </Button>
                  )}
                </div>
              </div>
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

      {/* Workspace Files, Sandbox & Attack Chain Drawer */}
      <Drawer
        open={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
        title="会话工作区、沙箱与攻击链"
        subtitle="检视 /work/persist 产物文件、直接操控会话沙箱容器与查看攻击链路"
      >
        <div className="mb-4 flex flex-wrap gap-1.5 border-b border-line pb-3">
          <button
            type="button"
            onClick={() => setWorkspaceTab('files')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              workspaceTab === 'files'
                ? 'bg-ink text-canvas'
                : 'border border-line bg-surface text-ink-secondary hover:text-ink',
            )}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            工作区文件 ({sessionFiles.length})
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceTab('sandbox')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              workspaceTab === 'sandbox'
                ? 'bg-ink text-canvas'
                : 'border border-line bg-surface text-ink-secondary hover:text-ink',
            )}
          >
            <Box className="h-3.5 w-3.5" />
            沙箱终端
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceTab('chain')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              workspaceTab === 'chain'
                ? 'bg-ink text-canvas'
                : 'border border-line bg-surface text-ink-secondary hover:text-ink',
            )}
          >
            <Workflow className="h-3.5 w-3.5" />
            攻击链路径 ({attackChainSteps.length})
          </button>
        </div>

        {workspaceTab === 'sandbox' && activeId ? (
          <SandboxPanel
            key={activeId}
            sessionId={activeId}
            onFilesChanged={() => {
              const sid = activeId
              void api
                .listSessionFiles(sid)
                .then((fls) => {
                  if (activeIdRef.current === sid) setSessionFiles(fls)
                })
                .catch(() => {})
            }}
          />
        ) : workspaceTab === 'files' ? (
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

      {/* Session Settings Modal (Project, Approval, MCP, Skills, Title) */}
      <SessionSettingsModal
        session={settingsTarget}
        existingProjects={existingProjects}
        onClose={() => setSettingsTarget(null)}
        onSaved={async () => {
          await loadSessions()
          if (activeId) await loadDetail(activeId)
        }}
      />

      {/* Archive Session Confirm Modal */}
      <Modal
        open={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        title="归档会话"
        subtitle={archiveTarget ? `确认归档「${archiveTarget.title || '未命名会话'}」？` : undefined}
      >
        <div className="space-y-4 text-xs text-ink-secondary">
          <p className="leading-relaxed">
            归档后该会话将移入「已归档」列表，对话消息记录仍会保留且可随时恢复或导出；但该会话关联的沙箱容器、临时附件与工作区产物文件会被立即清理释放。
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setArchiveTarget(null)}>
              取消
            </Button>
            <Button variant="danger" loading={confirmBusy} onClick={() => void handleConfirmArchive()}>
              确认归档
            </Button>
          </div>
        </div>
      </Modal>

      {/* Purge Single Session Confirm Modal */}
      <Modal
        open={Boolean(purgeTarget)}
        onClose={() => setPurgeTarget(null)}
        title="彻底删除会话"
        subtitle={purgeTarget ? `即将永久删除「${purgeTarget.title || '未命名会话'}」` : undefined}
      >
        <div className="space-y-4 text-xs text-ink-secondary">
          <p className="leading-relaxed text-red-600 dark:text-red-400">
            此操作不可撤销：将从数据库物理删除该会话及其全部 {purgeTarget?.messageCount ?? 0} 条消息记录。
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPurgeTarget(null)}>
              取消
            </Button>
            <Button variant="danger" loading={confirmBusy} onClick={() => void handleConfirmPurge()}>
              永久删除
            </Button>
          </div>
        </div>
      </Modal>

      {/* Batch Archive Confirm Modal */}
      <Modal
        open={batchArchiveIds.length > 0}
        onClose={() => setBatchArchiveIds([])}
        title={`批量归档 ${batchArchiveIds.length} 条会话`}
      >
        <div className="space-y-4 text-xs text-ink-secondary">
          <p className="leading-relaxed">
            确认将选中的 {batchArchiveIds.length} 条会话全部移入「已归档」？消息记录会保留且可随时批量恢复，关联沙箱与临时附件将立即释放。
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setBatchArchiveIds([])}>
              取消
            </Button>
            <Button
              variant="danger"
              loading={confirmBusy}
              onClick={() => void handleConfirmBatchArchive()}
            >
              确认批量归档
            </Button>
          </div>
        </div>
      </Modal>

      {/* Batch Purge Confirm Modal */}
      <Modal
        open={batchPurgeIds.length > 0}
        onClose={() => setBatchPurgeIds([])}
        title={`批量彻底删除 ${batchPurgeIds.length} 条归档会话`}
      >
        <div className="space-y-4 text-xs text-ink-secondary">
          <p className="leading-relaxed text-red-600 dark:text-red-400">
            此操作不可撤销：将从数据库永久物理删除选中的 {batchPurgeIds.length} 条归档会话及其全部消息记录。
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setBatchPurgeIds([])}>
              取消
            </Button>
            <Button
              variant="danger"
              loading={confirmBusy}
              onClick={() => void handleConfirmBatchPurge()}
            >
              永久删除 ({batchPurgeIds.length})
            </Button>
          </div>
        </div>
      </Modal>

      {/* Purge All Archived Confirm Modal */}
      <Modal
        open={purgeAllOpen}
        onClose={() => setPurgeAllOpen(false)}
        title="一键清空全部已归档会话"
      >
        <div className="space-y-4 text-xs text-ink-secondary">
          <p className="leading-relaxed text-red-600 dark:text-red-400">
            此操作将永久物理删除全部 {sessions.filter((s) => s.archived).length} 条已归档会话及其所有消息与关联文件，不可恢复。
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPurgeAllOpen(false)}>
              取消
            </Button>
            <Button
              variant="danger"
              loading={confirmBusy}
              onClick={() => void handleConfirmPurgeAllArchived()}
            >
              确认清空归档
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
