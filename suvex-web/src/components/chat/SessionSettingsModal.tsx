import { useEffect, useState, type FormEvent } from 'react'
import {
  BookOpen,
  CheckCircle2,
  Folder,
  Loader2,
  Plug,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import type {
  ChatMcpStatusOut,
  ChatSessionOut,
  KernelSkillOut,
  McpServerOut,
} from '@/types/api'
import { Button, Input, Modal } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

export interface SessionSettingsModalProps {
  session: ChatSessionOut | null
  existingProjects: string[]
  onClose: () => void
  onSaved: () => Promise<void>
}

export function SessionSettingsModal({
  session,
  existingProjects,
  onClose,
  onSaved,
}: SessionSettingsModalProps) {
  const { push } = useToast()

  const [title, setTitle] = useState('')
  const [project, setProject] = useState('')
  const [requireApproval, setRequireApproval] = useState(false)
  const [selectedMcps, setSelectedMcps] = useState<string[]>([])
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])

  const [allMcps, setAllMcps] = useState<McpServerOut[]>([])
  const [allSkills, setAllSkills] = useState<KernelSkillOut[]>([])
  const [mcpStatus, setMcpStatus] = useState<ChatMcpStatusOut | null>(null)
  const [checkingMcp, setCheckingMcp] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!session) return
    setTitle(session.title || '')
    setProject(session.project || '')
    setRequireApproval(Boolean(session.requireApproval))
    setSelectedMcps(session.mcpServerNames ? [...session.mcpServerNames] : [])
    setSelectedSkills(session.skillNames ? [...session.skillNames] : [])
    setMcpStatus(null)

    api
      .getMcpServers()
      .then((res) => setAllMcps(res.servers))
      .catch(() => {})
    api
      .listSkills()
      .then((res) => setAllSkills(res.categories.flatMap((c) => c.skills)))
      .catch(() => {})
  }, [session])

  const handleCheckMcp = async () => {
    if (!session) return
    setCheckingMcp(true)
    try {
      const res = await api.getChatMcpStatus(session.id)
      setMcpStatus(res)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '检测 MCP 连通状态失败', 'error')
    } finally {
      setCheckingMcp(false)
    }
  }

  const toggleItem = (list: string[], value: string, setter: (v: string[]) => void) => {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value])
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!session) return
    setSaving(true)
    try {
      const cleanedTitle = title.trim()
      if (cleanedTitle && cleanedTitle !== session.title) {
        await api.renameChatSession(session.id, cleanedTitle)
      }
      await api.updateChatSettings(session.id, {
        project: project.trim() || null,
        requireApproval,
        mcpServerNames: selectedMcps,
        skillNames: selectedSkills,
      })
      push('会话设置已保存', 'success')
      await onSaved()
      onClose()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '保存会话设置失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={Boolean(session)}
      onClose={onClose}
      title="会话管理与运行配置"
      subtitle="独立控制当前会话的标题、项目归属、人工审批闸门、MCP 工具挂载与技能注入"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-secondary">会话标题</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入会话标题"
            required
          />
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
            <Folder className="h-3.5 w-3.5 text-accent" />
            归属项目 / 分组（留空则移出项目）
          </label>
          <Input
            value={project}
            onChange={(e) => setProject(e.target.value)}
            placeholder="例如：CTF2 夺旗、内网渗透、羊城杯"
          />
          {existingProjects.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {existingProjects.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProject(p)}
                  className={cn(
                    'rounded-md border px-2 py-0.5 text-[11px] transition-colors',
                    project.trim() === p
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-line bg-subtle text-ink-secondary hover:text-ink',
                  )}
                >
                  {p}
                </button>
              ))}
              {project && (
                <button
                  type="button"
                  onClick={() => setProject('')}
                  className="rounded-md px-2 py-0.5 text-[11px] text-ink-muted hover:text-ink"
                >
                  清除分组
                </button>
              )}
            </div>
          )}
        </div>

        {/* Approval Switch */}
        <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-line bg-subtle/60 p-3.5">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-medium text-ink">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
              高危/副作用工具执行前需要人工审批
            </p>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              开启后，智能体调用扫描发起、技能改写等有外部副作用的工具时会暂停并等待确认。
            </p>
          </div>
          <input
            type="checkbox"
            checked={requireApproval}
            onChange={(e) => setRequireApproval(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-indigo-500"
          />
        </label>

        {/* Per-session MCP Servers */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
              <Plug className="h-3.5 w-3.5 text-accent" />
              本会话挂载的 MCP 服务（{selectedMcps.length}/{allMcps.length}）
            </label>
            {allMcps.length > 0 && (
              <button
                type="button"
                onClick={() => void handleCheckMcp()}
                disabled={checkingMcp}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline disabled:opacity-50"
              >
                {checkingMcp && <Loader2 className="h-3 w-3 animate-spin" />}
                实测当前会话 MCP 状态
              </button>
            )}
          </div>
          {allMcps.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-2 text-[11px] text-ink-muted">
              平台尚未配置外部 MCP 服务，可在「工具与 MCP」页添加或一键挂载 ctf2-suvex。
            </p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {allMcps.map((srv) => {
                const checked = selectedMcps.includes(srv.name)
                const live = mcpStatus?.servers.find((x) => x.name === srv.name)
                return (
                  <label
                    key={srv.name}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition-colors',
                      checked
                        ? 'border-accent/60 bg-accent-soft/50 text-ink'
                        : 'border-line bg-surface text-ink-secondary hover:bg-subtle',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleItem(selectedMcps, srv.name, setSelectedMcps)}
                      />
                      <span className="truncate font-mono font-medium">{srv.name}</span>
                    </span>
                    {live ? (
                      live.connected ? (
                        <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-emerald-500">
                          <CheckCircle2 className="h-3 w-3" />
                          {live.toolCount}
                        </span>
                      ) : (
                        <span
                          className="inline-flex shrink-0 items-center text-[10px] text-red-500"
                          title={live.reason || '未连通'}
                        >
                          <XCircle className="h-3 w-3" />
                        </span>
                      )
                    ) : (
                      <span className="shrink-0 font-mono text-[10px] uppercase text-ink-muted">
                        {srv.type}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {/* Per-session Skills */}
        {allSkills.length > 0 && (
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
              <BookOpen className="h-3.5 w-3.5 text-accent" />
              预注入技能包（已选 {selectedSkills.length} 篇）
            </label>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-line bg-subtle/40 p-2.5">
              {allSkills.map((sk) => {
                const active = selectedSkills.includes(sk.name)
                return (
                  <button
                    key={sk.name}
                    type="button"
                    onClick={() => toggleItem(selectedSkills, sk.name, setSelectedSkills)}
                    className={cn(
                      'rounded-md border px-2 py-1 font-mono text-[11px] transition-colors',
                      active
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line bg-surface text-ink-secondary hover:text-ink',
                    )}
                    title={sk.description}
                  >
                    {sk.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            保存设置
          </Button>
        </div>
      </form>
    </Modal>
  )
}
