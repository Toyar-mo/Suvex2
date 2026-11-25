import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  Box,
  Check,
  Clock,
  Copy,
  Cpu,
  HardDrive,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Terminal,
} from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { formatDuration } from '@/lib/format'
import type { ChatSandboxExecOut, ChatSandboxStatusOut } from '@/types/api'
import { Badge, Button } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

const QUICK_COMMANDS = [
  { label: '持久产物', cmd: 'ls -la /work/persist' },
  { label: '挂载附件', cmd: 'ls -la /work/attachments' },
  { label: '系统与权限', cmd: 'id && uname -a' },
  { label: '安全工具探针', cmd: 'which python3 nmap httpx sqlmap nuclei gdb radare2 2>/dev/null || true' },
]

export function SandboxPanel({
  sessionId,
  onFilesChanged,
}: {
  sessionId: string
  onFilesChanged?: () => void
}) {
  const { push } = useToast()
  const [status, setStatus] = useState<ChatSandboxStatusOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [cmd, setCmd] = useState('')
  const [running, setRunning] = useState(false)
  const [history, setHistory] = useState<Array<{ command: string; res: ChatSandboxExecOut }>>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      const s = await api.getChatSandboxStatus(sessionId)
      setStatus(s)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '获取沙箱状态失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [sessionId, push])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const handleReset = async () => {
    setResetting(true)
    try {
      const s = await api.resetChatSandbox(sessionId)
      setStatus(s)
      push('沙箱容器已重建，/work/persist 产物已保留', 'success')
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '重建沙箱失败', 'error')
    } finally {
      setResetting(false)
    }
  }

  const runCommand = async (commandToRun: string) => {
    const trimmed = commandToRun.trim()
    if (!trimmed || running) return
    setRunning(true)
    try {
      const res = await api.execChatSandbox(sessionId, trimmed, 30)
      setHistory((prev) => [{ command: trimmed, res }, ...prev].slice(0, 12))
      setCmd('')
      await loadStatus()
      onFilesChanged?.()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '沙箱执行命令失败', 'error')
    } finally {
      setRunning(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void runCommand(cmd)
  }

  return (
    <div className="space-y-4">
      {/* Live Container Status Card */}
      <div className="rounded-xl border border-line bg-surface p-4 shadow-editorial">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Box className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-ink">会话专属 Docker 沙箱</span>
                {status && (
                  <Badge
                    pulse={status.active}
                    className={
                      status.active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'border-line bg-subtle text-ink-secondary'
                    }
                  >
                    {status.active ? '运行中' : '惰性待命'}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 font-mono text-[10px] text-ink-muted">
                {status?.containerName || '首次调用工具或执行命令时自动拉起'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              loading={loading}
              onClick={() => void loadStatus()}
              title="刷新沙箱状态"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={resetting}
              onClick={() => void handleReset()}
              title="销毁并重建干净沙箱（保留 /work/persist）"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              重建沙箱
            </Button>
          </div>
        </div>

        {status && (
          <div className="mt-3.5 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg border border-line-subtle bg-subtle/70 px-3 py-2">
              <div className="flex items-center gap-1 text-[10px] text-ink-muted">
                <Cpu className="h-3 w-3" />
                资源配额
              </div>
              <div className="mt-0.5 font-mono font-semibold text-ink">
                {status.cpus} vCPU · {status.memoryMb} MB
              </div>
            </div>
            <div className="rounded-lg border border-line-subtle bg-subtle/70 px-3 py-2">
              <div className="flex items-center gap-1 text-[10px] text-ink-muted">
                <Clock className="h-3 w-3" />
                运行 / 空闲
              </div>
              <div className="mt-0.5 font-mono font-semibold text-ink">
                {status.active
                  ? `${formatDuration(status.uptimeSeconds)} / 闲 ${formatDuration(status.idleSeconds)}`
                  : `闲置回收 ${Math.round(status.idleTimeoutSeconds / 60)}m`}
              </div>
            </div>
            <div className="rounded-lg border border-line-subtle bg-subtle/70 px-3 py-2">
              <div className="flex items-center gap-1 text-[10px] text-ink-muted">
                <Terminal className="h-3 w-3" />
                累计命中
              </div>
              <div className="mt-0.5 font-mono font-semibold text-ink">
                {status.execCount} 次调用
              </div>
            </div>
            <div className="rounded-lg border border-line-subtle bg-subtle/70 px-3 py-2">
              <div className="flex items-center gap-1 text-[10px] text-ink-muted">
                <HardDrive className="h-3 w-3" />
                持久工作区
              </div>
              <div className="mt-0.5 font-mono font-semibold text-ink">
                {status.persistFileCount} 个文件
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Quick Diagnostic Terminal */}
      <div className="rounded-xl border border-line bg-surface p-4 shadow-editorial">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
            <Terminal className="h-3.5 w-3.5 text-accent" />
            快捷诊断终端
          </span>
          <span className="font-mono text-[10px] text-ink-muted">/work · 超时 30s</span>
        </div>

        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {QUICK_COMMANDS.map((q) => (
            <button
              key={q.label}
              type="button"
              disabled={running}
              onClick={() => void runCommand(q.cmd)}
              className="rounded-md border border-line bg-subtle px-2 py-1 text-[11px] text-ink-secondary transition-colors hover:border-accent/40 hover:bg-surface hover:text-ink disabled:opacity-50"
            >
              {q.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-line bg-canvas px-2.5 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
            <span className="select-none font-mono text-xs text-accent">$</span>
            <input
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              placeholder="输入 shell 命令直接探测沙箱环境…"
              className="w-full bg-transparent font-mono text-xs text-ink placeholder:text-ink-muted focus:outline-none"
            />
          </div>
          <Button type="submit" size="sm" variant="primary" disabled={!cmd.trim() || running}>
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3 w-3" />}
            执行
          </Button>
        </form>

        {history.length > 0 && (
          <div className="mt-3.5 space-y-2.5">
            {history.map((item, idx) => (
              <div
                key={`${item.command}-${idx}`}
                className="overflow-hidden rounded-xl border border-slate-800/90 bg-[#0f121d] text-slate-200 dark:border-line"
              >
                <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px]">
                  <span className="truncate text-slate-100">$ {item.command}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5',
                        item.res.exitCode === 0
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-red-500/15 text-red-300',
                      )}
                    >
                      exit {item.res.exitCode}
                    </span>
                    <span className="text-slate-400">{item.res.durationMs}ms</span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(item.res.output || '')
                        setCopiedIdx(idx)
                        window.setTimeout(() => setCopiedIdx(null), 1400)
                      }}
                      className="text-slate-400 hover:text-white"
                      title="复制输出"
                    >
                      {copiedIdx === idx ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
                <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-[11px] leading-relaxed text-slate-300">
                  {item.res.output || '（无输出）'}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
