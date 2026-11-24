import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Bot, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import type { AgentProfileOut } from '@/types/api'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives'

export function AgentsPage() {
  const { push } = useToast()
  const [profiles, setProfiles] = useState<AgentProfileOut[]>([])
  const [loading, setLoading] = useState(true)

  const [createOpen, setCreateOpen] = useState(false)
  const [key, setKey] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [toolsCsv, setToolsCsv] = useState('')
  const [skillsCsv, setSkillsCsv] = useState('')
  const [mcpCsv, setMcpCsv] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await api.listAgentProfiles()
      setProfiles(list)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载 Agent 角色清单失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [push])

  useEffect(() => {
    void load()
  }, [load])

  const parseCsv = (s: string) =>
    s
      .split(/[,，\s]+/)
      .map((x) => x.trim())
      .filter(Boolean)

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!key.trim() || !name.trim()) return
    setSaving(true)
    try {
      await api.createAgentProfile({
        key: key.trim(),
        name: name.trim(),
        description: description.trim(),
        tools: parseCsv(toolsCsv),
        skills: parseCsv(skillsCsv),
        mcpServers: parseCsv(mcpCsv),
      })
      push('自定义 Agent 角色已创建', 'success')
      setCreateOpen(false)
      setKey('')
      setName('')
      setDescription('')
      setToolsCsv('')
      setSkillsCsv('')
      setMcpCsv('')
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '创建角色失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (p: AgentProfileOut) => {
    try {
      await api.updateAgentProfile(p.id, { enabled: !p.enabled })
      push(p.enabled ? `已停用角色 ${p.name}` : `已启用角色 ${p.name}`, 'success')
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '切换状态失败', 'error')
    }
  }

  const handleDelete = async (p: AgentProfileOut) => {
    try {
      await api.deleteAgentProfile(p.id)
      push(`已删除角色 ${p.name}`, 'default')
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '删除失败', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Specialist Roles"
        title="Agent 角色管理"
        description="维护内置只读角色与自定义专家画像，为不同安全场景绑定专属工具、技能卡与 MCP 服务。"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </Button>
            <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              新建角色
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : profiles.length === 0 ? (
        <EmptyState
          icon={<Bot className="h-5 w-5" />}
          title="暂无 Agent 角色定义"
          action={
            <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              创建自定义角色
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {profiles.map((p) => (
            <Card key={p.id} className="flex flex-col justify-between p-5">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink">{p.name}</h3>
                      <Badge className="font-mono text-[10px]">{p.key}</Badge>
                      <Badge>{p.builtin ? '内置' : '自定义'}</Badge>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                      {p.description || '—'}
                    </p>
                  </div>

                  {!p.builtin && (
                    <Button size="sm" variant="ghost" onClick={() => void handleDelete(p)}>
                      <Trash2 className="h-3.5 w-3.5 text-ink-muted hover:text-red-600" />
                    </Button>
                  )}
                </div>

                <div className="mt-3 space-y-1.5 text-[11px] text-ink-muted">
                  <div>工具：{p.tools.length ? p.tools.join(', ') : '继承默认'}</div>
                  <div>技能：{p.skills.length ? p.skills.join(', ') : '继承默认'}</div>
                  <div>MCP：{p.mcpServers.length ? p.mcpServers.join(', ') : '无绑定'}</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <span className="font-mono text-[11px] text-ink-muted">类型：{p.kind}</span>
                <Button
                  size="sm"
                  variant={p.enabled ? 'secondary' : 'primary'}
                  onClick={() => void handleToggle(p)}
                >
                  {p.enabled ? '已启用' : '已停用'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="新建自定义 Agent 角色">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">角色标识 (key)</label>
              <Input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="api-auditor"
                className="font-mono"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">显示名称</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="API 鉴权审计专家"
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-secondary">职责描述</label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="专注 IDOR / JWT / OAuth2 鉴权逻辑审计…"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-secondary">
              绑定工具（逗号分隔，留空继承默认）
            </label>
            <Input
              value={toolsCsv}
              onChange={(e) => setToolsCsv(e.target.value)}
              placeholder="run_shell, browser"
              className="font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">绑定技能</label>
              <Input
                value={skillsCsv}
                onChange={(e) => setSkillsCsv(e.target.value)}
                placeholder="api-auth, sqli"
                className="font-mono"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">绑定 MCP</label>
              <Input
                value={mcpCsv}
                onChange={(e) => setMcpCsv(e.target.value)}
                placeholder="threat-intel"
                className="font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              创建角色
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
