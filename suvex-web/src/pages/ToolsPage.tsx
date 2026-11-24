import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  CheckCircle2,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Terminal,
  Trash2,
  Wrench,
  XCircle,
  Zap,
} from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import type {
  KernelRecipesOut,
  KernelToolsOut,
  McpServerIn,
  McpServerOut,
} from '@/types/api'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

type ToolsTab = 'builtin' | 'mcp' | 'recipes'

export function ToolsPage() {
  const { push } = useToast()
  const [tab, setTab] = useState<ToolsTab>('builtin')
  const [toolsData, setToolsData] = useState<KernelToolsOut | null>(null)
  const [mcpServers, setMcpServers] = useState<McpServerOut[]>([])
  const [recipesData, setRecipesData] = useState<KernelRecipesOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingTools, setSavingTools] = useState(false)
  const [probing, setProbing] = useState(false)
  const [recipeQuery, setRecipeQuery] = useState('')
  const [testingMcp, setTestingMcp] = useState<string | null>(null)

  // Add MCP modal
  const [mcpOpen, setMcpOpen] = useState(false)
  const [mcpName, setMcpName] = useState('')
  const [mcpType, setMcpType] = useState<'http' | 'stdio'>('http')
  const [mcpUrl, setMcpUrl] = useState('')
  const [mcpCmd, setMcpCmd] = useState('')
  const [mcpArgs, setMcpArgs] = useState('')
  const [mcpNotes, setMcpNotes] = useState('')
  const [savingMcp, setSavingMcp] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [t, m, r] = await Promise.all([
        api.getKernelTools().catch(() => null),
        api.getMcpServers().catch(() => ({ servers: [] })),
        api.getKernelRecipes().catch(() => null),
      ])
      setToolsData(t)
      setMcpServers(m.servers)
      setRecipesData(r)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载工具能力目录失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [push])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const handleToggleTool = async (name: string, currentlyEnabled: boolean) => {
    if (!toolsData) return
    const nextDisabled = currentlyEnabled
      ? Array.from(new Set([...toolsData.disabled, name]))
      : toolsData.disabled.filter((x) => x !== name)

    setSavingTools(true)
    try {
      const updated = await api.saveKernelDisabledTools(nextDisabled)
      setToolsData(updated)
      push(currentlyEnabled ? `已关闭工具 ${name}` : `已启用工具 ${name}`, 'success')
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '更新工具开关失败', 'error')
    } finally {
      setSavingTools(false)
    }
  }

  const toMcpIn = (s: McpServerOut): McpServerIn => ({
    name: s.name,
    type: s.type,
    command: s.command,
    args: s.args,
    env: {},
    url: s.url,
    headers: {},
    preserveEnv: s.hasEnv,
    preserveHeaders: s.hasHeaders,
    notes: s.notes,
    allowedTools: s.allowedTools,
    callTimeout: s.callTimeout,
  })

  const handleAddMcp = async (e: FormEvent) => {
    e.preventDefault()
    if (!mcpName.trim()) return
    const entry: McpServerIn = {
      name: mcpName.trim(),
      type: mcpType,
      command: mcpType === 'stdio' ? mcpCmd.trim() : '',
      args: mcpType === 'stdio' && mcpArgs.trim() ? mcpArgs.trim().split(/\s+/) : [],
      env: {},
      url: mcpType === 'http' ? mcpUrl.trim() : '',
      headers: {},
      preserveEnv: false,
      preserveHeaders: false,
      notes: mcpNotes.trim(),
      allowedTools: null,
      callTimeout: null,
    }
    setSavingMcp(true)
    try {
      const nextList = [...mcpServers.map(toMcpIn), entry]
      const res = await api.saveMcpServers(nextList)
      setMcpServers(res.servers)
      setMcpOpen(false)
      setMcpName('')
      setMcpUrl('')
      setMcpCmd('')
      setMcpArgs('')
      setMcpNotes('')
      push('MCP 服务已保存', 'success')
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '保存 MCP 服务失败', 'error')
    } finally {
      setSavingMcp(false)
    }
  }

  const handleDeleteMcp = async (name: string) => {
    try {
      const nextList = mcpServers.filter((s) => s.name !== name).map(toMcpIn)
      const res = await api.saveMcpServers(nextList)
      setMcpServers(res.servers)
      push(`已移除 MCP 服务 ${name}`, 'default')
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '删除失败', 'error')
    }
  }

  const handleTestMcp = async (s: McpServerOut) => {
    setTestingMcp(s.name)
    try {
      const res = await api.testMcpServer(toMcpIn(s))
      if (res.ok) {
        push(
          `MCP ${s.name} 连通（${res.elapsedMs}ms），发现 ${res.tools.length} 个工具`,
          'success',
        )
      } else {
        push(`MCP ${s.name} 试连失败：${res.reason}`, 'error')
      }
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '试连失败', 'error')
    } finally {
      setTestingMcp(null)
    }
  }

  const handleProbeRecipes = async () => {
    setProbing(true)
    try {
      const res = await api.probeKernelRecipes()
      const found = res.results.filter((x) => x.found).length
      push(`沙箱探测完成：${found}/${res.results.length} 个命令工具就绪`, 'success')
      const fresh = await api.getKernelRecipes()
      setRecipesData(fresh)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '探测沙箱工具失败', 'error')
    } finally {
      setProbing(false)
    }
  }

  const filteredRecipes = useMemo(() => {
    const list = recipesData?.recipes || []
    const q = recipeQuery.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        r.group.toLowerCase().includes(q),
    )
  }, [recipeQuery, recipesData])

  return (
    <div>
      <PageHeader
        eyebrow="Three-Layer Capabilities"
        title="工具与 MCP 管理"
        description="三层能力清晰解耦：内置动作开关、外部 MCP 服务试连、以及沙箱镜像内置命令配方探测。"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => void loadAll()}>
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </Button>
            {tab === 'mcp' && (
              <Button variant="primary" size="sm" onClick={() => setMcpOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                添加 MCP 连接
              </Button>
            )}
            {tab === 'recipes' && (
              <Button variant="primary" size="sm" loading={probing} onClick={() => void handleProbeRecipes()}>
                <Zap className="h-3.5 w-3.5" />
                实测沙箱二进制
              </Button>
            )}
          </>
        }
      />

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-line pb-3">
        {[
          { id: 'builtin' as const, label: `内置工具 (${toolsData?.tools.length ?? 0})`, icon: Wrench },
          { id: 'mcp' as const, label: `MCP 外部连接 (${mcpServers.length})`, icon: Plug },
          { id: 'recipes' as const, label: `沙箱命令配方 (${recipesData?.total ?? 0})`, icon: Terminal },
        ].map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors',
                tab === t.id
                  ? 'bg-ink text-canvas'
                  : 'border border-line bg-surface text-ink-secondary hover:bg-subtle',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : tab === 'builtin' ? (
        <div className="grid gap-4 md:grid-cols-2">
          {(toolsData?.tools || []).map((tool) => (
            <Card key={tool.name} className="flex flex-col justify-between p-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-sm font-semibold text-ink">{tool.name}</span>
                      <Badge>{tool.group}</Badge>
                      {tool.core && <Badge>核心</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-ink-secondary">{tool.summary}</p>
                  </div>

                  <Button
                    size="sm"
                    variant={tool.enabled ? 'secondary' : 'primary'}
                    disabled={savingTools}
                    onClick={() => void handleToggleTool(tool.name, tool.enabled)}
                  >
                    {tool.enabled ? '已启用' : '已关闭'}
                  </Button>
                </div>

                {tool.defaultLimitation && (
                  <p className="mt-2 rounded bg-subtle px-2.5 py-1.5 text-[11px] text-ink-muted">
                    注意：{tool.defaultLimitation}
                  </p>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-[11px]">
                <span className="font-mono text-ink-muted">累计调用 {tool.calls} 次</span>
                {tool.ready ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    运行时就绪
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                    <XCircle className="h-3.5 w-3.5" />
                    {tool.reason || '依赖未就绪'}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : tab === 'mcp' ? (
        mcpServers.length === 0 ? (
          <EmptyState
            icon={<Plug className="h-5 w-5" />}
            title="尚未配置外部 MCP 服务"
            description="可挂载 HTTP 或 stdio MCP 工具服务器，扩展智能体的外部威胁情报、代码分析或资产查询能力。"
            action={
              <Button variant="primary" size="sm" onClick={() => setMcpOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                添加 MCP 连接
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {mcpServers.map((s) => (
              <Card key={s.name} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-ink">{s.name}</span>
                    <Badge className="font-mono uppercase">{s.type}</Badge>
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-ink-muted">
                    {s.type === 'http' ? s.url : `${s.command} ${s.args.join(' ')}`}
                  </p>
                  {s.notes && <p className="mt-0.5 text-xs text-ink-secondary">{s.notes}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={testingMcp === s.name}
                    onClick={() => void handleTestMcp(s)}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    试连
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void handleDeleteMcp(s.name)}>
                    <Trash2 className="h-3.5 w-3.5 text-ink-muted hover:text-red-600" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        <div>
          <div className="mb-4 relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-muted" />
            <Input
              value={recipeQuery}
              onChange={(e) => setRecipeQuery(e.target.value)}
              placeholder="按工具名、分组或用途筛选配方..."
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredRecipes.map((r) => (
              <Card key={r.name} className="p-4 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-ink">{r.name}</span>
                  <Badge>{r.group}</Badge>
                </div>
                <p className="mt-1.5 text-ink-secondary">{r.summary}</p>
                <p className="mt-2 truncate font-mono text-[11px] text-ink-muted">
                  $ {r.command} {r.args.join(' ')}
                </p>
                <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2 text-[11px]">
                  <span className="font-mono text-ink-muted">调用 {r.calls}</span>
                  {r.probe ? (
                    r.probe.found ? (
                      <span className="text-emerald-700 dark:text-emerald-400">
                        已就绪 {r.probe.version ? `(${r.probe.version.slice(0, 18)})` : ''}
                      </span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">镜像缺失</span>
                    )
                  ) : (
                    <span className="text-ink-muted">未探测</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Modal open={mcpOpen} onClose={() => setMcpOpen(false)} title="添加外部 MCP 服务">
        <form onSubmit={handleAddMcp} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">连接名称</label>
              <Input
                value={mcpName}
                onChange={(e) => setMcpName(e.target.value)}
                placeholder="threat-intel"
                className="font-mono"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">传输方式</label>
              <select
                value={mcpType}
                onChange={(e) => setMcpType(e.target.value as 'http' | 'stdio')}
                className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-xs text-ink"
              >
                <option value="http">HTTP / Streamable</option>
                <option value="stdio">本地 stdio 进程</option>
              </select>
            </div>
          </div>

          {mcpType === 'http' ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">服务 URL</label>
              <Input
                value={mcpUrl}
                onChange={(e) => setMcpUrl(e.target.value)}
                placeholder="http://127.0.0.1:9000/mcp"
                className="font-mono"
                required
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-secondary">命令</label>
                <Input
                  value={mcpCmd}
                  onChange={(e) => setMcpCmd(e.target.value)}
                  placeholder="npx"
                  className="font-mono"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-secondary">参数（空格分隔）</label>
                <Input
                  value={mcpArgs}
                  onChange={(e) => setMcpArgs(e.target.value)}
                  placeholder="-y @org/mcp-server"
                  className="font-mono"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-secondary">说明（可选）</label>
            <Input value={mcpNotes} onChange={(e) => setMcpNotes(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setMcpOpen(false)}>
              取消
            </Button>
            <Button type="submit" variant="primary" loading={savingMcp}>
              保存连接
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
