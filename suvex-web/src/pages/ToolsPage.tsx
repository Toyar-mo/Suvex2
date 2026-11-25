import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  CheckCircle2,
  Code2,
  KeyRound,
  Pencil,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
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
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

type ToolsTab = 'builtin' | 'mcp' | 'recipes'
type McpModalMode = 'form' | 'json'

function parseKeyValueLines(raw: string, separator: ':' | '='): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf(separator)
    if (idx <= 0) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    if (key) out[key] = value
  }
  return out
}

function parseMcpJsonImport(rawJson: string, bearerToken: string): McpServerIn[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    throw new Error('JSON 格式不合法，请检查括号与引号。')
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('请粘贴包含 mcpServers 的 JSON 对象。')
  }
  const obj = parsed as Record<string, unknown>
  const mapSource =
    obj.mcpServers && typeof obj.mcpServers === 'object' && !Array.isArray(obj.mcpServers)
      ? (obj.mcpServers as Record<string, unknown>)
      : obj

  const entries: McpServerIn[] = []
  const cleanedBearer = bearerToken.trim()

  for (const [key, val] of Object.entries(mapSource)) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue
    const cfg = val as Record<string, unknown>
    const rawType = String(cfg.type || (cfg.url ? 'http' : 'stdio')).toLowerCase()
    const type: 'http' | 'stdio' = rawType === 'http' || rawType === 'streamable-http' ? 'http' : 'stdio'
    const url = typeof cfg.url === 'string' ? cfg.url.trim() : ''
    const command = typeof cfg.command === 'string' ? cfg.command.trim() : ''
    const args = Array.isArray(cfg.args) ? cfg.args.map((a) => String(a)) : []
    const headers: Record<string, string> = {}
    if (cfg.headers && typeof cfg.headers === 'object' && !Array.isArray(cfg.headers)) {
      for (const [hk, hv] of Object.entries(cfg.headers as Record<string, unknown>)) {
        if (hk.trim()) headers[hk.trim()] = String(hv ?? '')
      }
    }
    if (type === 'http' && cleanedBearer && !headers.Authorization && !headers.authorization) {
      headers.Authorization = cleanedBearer.toLowerCase().startsWith('bearer ')
        ? cleanedBearer
        : `Bearer ${cleanedBearer}`
    }
    const env: Record<string, string> = {}
    if (cfg.env && typeof cfg.env === 'object' && !Array.isArray(cfg.env)) {
      for (const [ek, ev] of Object.entries(cfg.env as Record<string, unknown>)) {
        if (ek.trim()) env[ek.trim()] = String(ev ?? '')
      }
    }
    entries.push({
      name: key.trim(),
      type,
      command: type === 'stdio' ? command : '',
      args: type === 'stdio' ? args : [],
      env,
      url: type === 'http' ? url : '',
      headers,
      preserveEnv: false,
      preserveHeaders: false,
      notes: typeof cfg.notes === 'string' ? cfg.notes : '',
      allowedTools: Array.isArray(cfg.allowedTools)
        ? cfg.allowedTools.map((t) => String(t))
        : null,
      callTimeout: typeof cfg.callTimeout === 'number' ? cfg.callTimeout : null,
    })
  }

  if (entries.length === 0) {
    throw new Error('未在 JSON 中找到有效的 MCP 服务配置（期望 {"mcpServers": {"name": {...}}}）。')
  }
  return entries
}

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
  const [mountingCtf2, setMountingCtf2] = useState(false)

  // Add / Edit MCP modal
  const [mcpOpen, setMcpOpen] = useState(false)
  const [mcpModalMode, setMcpModalMode] = useState<McpModalMode>('form')
  const [editingServer, setEditingServer] = useState<McpServerOut | null>(null)
  const [mcpName, setMcpName] = useState('')
  const [mcpType, setMcpType] = useState<'http' | 'stdio'>('http')
  const [mcpUrl, setMcpUrl] = useState('')
  const [mcpHeadersRaw, setMcpHeadersRaw] = useState('')
  const [mcpCmd, setMcpCmd] = useState('')
  const [mcpArgs, setMcpArgs] = useState('')
  const [mcpEnvRaw, setMcpEnvRaw] = useState('')
  const [mcpTimeout, setMcpTimeout] = useState('')
  const [mcpNotes, setMcpNotes] = useState('')
  const [mcpJsonRaw, setMcpJsonRaw] = useState('')
  const [mcpJsonBearer, setMcpJsonBearer] = useState('')
  const [savingMcp, setSavingMcp] = useState(false)
  const [testingDraft, setTestingDraft] = useState(false)

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

  const openAddMcpModal = (mode: McpModalMode = 'form') => {
    setEditingServer(null)
    setMcpModalMode(mode)
    setMcpName('')
    setMcpType('http')
    setMcpUrl('')
    setMcpHeadersRaw('')
    setMcpCmd('')
    setMcpArgs('')
    setMcpEnvRaw('')
    setMcpTimeout('')
    setMcpNotes('')
    setMcpJsonRaw('')
    setMcpJsonBearer('')
    setMcpOpen(true)
  }

  const openEditMcpModal = (s: McpServerOut) => {
    setEditingServer(s)
    setMcpModalMode('form')
    setMcpName(s.name)
    setMcpType(s.type === 'http' ? 'http' : 'stdio')
    setMcpUrl(s.url || '')
    setMcpHeadersRaw('')
    setMcpCmd(s.command || '')
    setMcpArgs((s.args || []).join(' '))
    setMcpEnvRaw('')
    setMcpTimeout(s.callTimeout ? String(s.callTimeout) : '')
    setMcpNotes(s.notes || '')
    setMcpOpen(true)
  }

  const buildFormEntry = (): McpServerIn => {
    const parsedHeaders = parseKeyValueLines(mcpHeadersRaw, ':')
    const parsedEnv = parseKeyValueLines(mcpEnvRaw, '=')
    const hasNewHeaders = Object.keys(parsedHeaders).length > 0
    const hasNewEnv = Object.keys(parsedEnv).length > 0
    const timeoutVal = mcpTimeout.trim() ? Number(mcpTimeout.trim()) : null
    return {
      name: mcpName.trim(),
      type: mcpType,
      command: mcpType === 'stdio' ? mcpCmd.trim() : '',
      args: mcpType === 'stdio' && mcpArgs.trim() ? mcpArgs.trim().split(/\s+/) : [],
      env: parsedEnv,
      url: mcpType === 'http' ? mcpUrl.trim() : '',
      headers: parsedHeaders,
      preserveEnv: Boolean(editingServer?.hasEnv && !hasNewEnv),
      preserveHeaders: Boolean(editingServer?.hasHeaders && !hasNewHeaders),
      notes: mcpNotes.trim(),
      allowedTools: editingServer?.allowedTools ?? null,
      callTimeout: timeoutVal && timeoutVal > 0 ? timeoutVal : null,
    }
  }

  const handleTestDraft = async () => {
    setTestingDraft(true)
    try {
      const target =
        mcpModalMode === 'json'
          ? parseMcpJsonImport(mcpJsonRaw, mcpJsonBearer)[0]
          : buildFormEntry()
      const res = await api.testMcpServer(target)
      if (res.ok) {
        push(`试连成功（${res.elapsedMs}ms），发现 ${res.tools.length} 个工具`, 'success')
      } else {
        push(`试连失败：${res.reason}`, 'error')
      }
    } catch (err) {
      push(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : '试连失败',
        'error',
      )
    } finally {
      setTestingDraft(false)
    }
  }

  const handleSaveMcpModal = async (e: FormEvent) => {
    e.preventDefault()
    setSavingMcp(true)
    try {
      let incoming: McpServerIn[]
      if (mcpModalMode === 'json') {
        incoming = parseMcpJsonImport(mcpJsonRaw, mcpJsonBearer)
      } else {
        if (!mcpName.trim()) {
          setSavingMcp(false)
          return
        }
        incoming = [buildFormEntry()]
      }

      const incomingNames = new Set(incoming.map((item) => item.name))
      const baseList = mcpServers
        .filter((s) => {
          if (editingServer && s.name === editingServer.name) return false
          return !incomingNames.has(s.name)
        })
        .map(toMcpIn)

      const res = await api.saveMcpServers([...baseList, ...incoming])
      setMcpServers(res.servers)
      setMcpOpen(false)
      push(
        incoming.length > 1
          ? `已导入并保存 ${incoming.length} 条 MCP 连接`
          : `MCP 服务 ${incoming[0].name} 已保存`,
        'success',
      )
    } catch (err) {
      push(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : '保存 MCP 服务失败',
        'error',
      )
    } finally {
      setSavingMcp(false)
    }
  }

  const handleMountCtf2Mcp = async () => {
    setMountingCtf2(true)
    try {
      const res = await api.mountCtf2Mcp()
      push(res.message, res.test.ok ? 'success' : 'error')
      const fresh = await api.getMcpServers().catch(() => ({ servers: mcpServers }))
      setMcpServers(fresh.servers)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '挂载 CTF2 MCP 失败', 'error')
    } finally {
      setMountingCtf2(false)
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
        description="三层能力清晰解耦：内置动作开关、外部 HTTP/stdio MCP 服务（支持自定义 Header 与 JSON 导入）、以及沙箱镜像内置命令配方探测。"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => void loadAll()}>
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </Button>
            {tab === 'mcp' && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={mountingCtf2}
                  onClick={() => void handleMountCtf2Mcp()}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  一键挂载 CTF2 MCP
                </Button>
                <Button variant="secondary" size="sm" onClick={() => openAddMcpModal('json')}>
                  <Code2 className="h-3.5 w-3.5" />
                  JSON 导入
                </Button>
                <Button variant="primary" size="sm" onClick={() => openAddMcpModal('form')}>
                  <Plus className="h-3.5 w-3.5" />
                  添加 MCP 连接
                </Button>
              </>
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
            description="可直接从已绑定的 CTF2 账号一键挂载官方远程 HTTP MCP（ctf2-suvex），或粘贴标准 mcpServers JSON / 手动添加带 Authorization 请求头的远程 MCP 服务。"
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  loading={mountingCtf2}
                  onClick={() => void handleMountCtf2Mcp()}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  一键挂载 ctf2-suvex MCP
                </Button>
                <Button variant="secondary" size="sm" onClick={() => openAddMcpModal('json')}>
                  <Code2 className="h-3.5 w-3.5" />
                  粘贴 JSON 导入
                </Button>
              </div>
            }
          />
        ) : (
          <div className="space-y-3">
            {mcpServers.map((s) => (
              <Card key={s.name} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-ink">{s.name}</span>
                    <Badge className="font-mono uppercase">{s.type}</Badge>
                    {s.hasHeaders && (
                      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
                        <KeyRound className="mr-1 h-2.5 w-2.5" />
                        已配置请求头
                      </Badge>
                    )}
                    {s.hasEnv && (
                      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
                        已配置环境变量
                      </Badge>
                    )}
                    {s.callTimeout && (
                      <Badge className="font-mono">{s.callTimeout}s</Badge>
                    )}
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
                  <Button size="sm" variant="ghost" onClick={() => openEditMcpModal(s)} title="编辑连接">
                    <Pencil className="h-3.5 w-3.5 text-ink-muted" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void handleDeleteMcp(s.name)} title="删除连接">
                    <Trash2 className="h-3.5 w-3.5 text-ink-muted hover:text-red-600" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        <div>
          <div className="relative mb-4 max-w-sm">
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

      <Modal
        open={mcpOpen}
        onClose={() => setMcpOpen(false)}
        title={editingServer ? `编辑 MCP 服务 · ${editingServer.name}` : '添加外部 MCP 服务'}
        subtitle="支持远程 Streamable-HTTP MCP（含 Authorization Bearer 请求头）与本地 stdio 进程"
        maxWidth="max-w-xl"
      >
        {!editingServer && (
          <div className="mb-4 flex items-center gap-1.5 rounded-lg border border-line bg-subtle p-1 text-xs">
            <button
              type="button"
              onClick={() => setMcpModalMode('form')}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 font-medium transition-colors',
                mcpModalMode === 'form'
                  ? 'bg-surface text-ink shadow-xs'
                  : 'text-ink-secondary hover:text-ink',
              )}
            >
              表单配置
            </button>
            <button
              type="button"
              onClick={() => setMcpModalMode('json')}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 font-medium transition-colors',
                mcpModalMode === 'json'
                  ? 'bg-surface text-ink shadow-xs'
                  : 'text-ink-secondary hover:text-ink',
              )}
            >
              JSON 粘贴导入
            </button>
          </div>
        )}

        <form onSubmit={handleSaveMcpModal} className="space-y-4">
          {mcpModalMode === 'json' && !editingServer ? (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-secondary">
                  mcpServers JSON 配置
                </label>
                <Textarea
                  rows={8}
                  value={mcpJsonRaw}
                  onChange={(e) => setMcpJsonRaw(e.target.value)}
                  className="font-mono text-xs"
                  placeholder={`{\n  "mcpServers": {\n    "ctf2-suvex": {\n      "type": "http",\n      "url": "https://ctf2.dasctf.com/api/ai/v1/mcp"\n    }\n  }\n}`}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-secondary">
                  Bearer Token（可选，自动注入 Authorization 请求头）
                </label>
                <Input
                  type="password"
                  value={mcpJsonBearer}
                  onChange={(e) => setMcpJsonBearer(e.target.value)}
                  placeholder="粘贴 $CTF2_AGENT_TOKEN（如 JSON 里未写 headers）"
                  className="font-mono text-xs"
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink-secondary">连接名称</label>
                  <Input
                    value={mcpName}
                    onChange={(e) => setMcpName(e.target.value)}
                    placeholder="ctf2-suvex"
                    className="font-mono"
                    disabled={Boolean(editingServer)}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink-secondary">传输方式</label>
                  <Select
                    value={mcpType}
                    onChange={(v) => setMcpType(v as 'http' | 'stdio')}
                    className="w-full"
                    options={[
                      { value: 'http', label: 'HTTP / Streamable', description: '远程 HTTP MCP 服务' },
                      { value: 'stdio', label: '本地 stdio 进程', description: '本地命令行子进程' },
                    ]}
                  />
                </div>
              </div>

              {mcpType === 'http' ? (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-ink-secondary">服务 URL</label>
                    <Input
                      value={mcpUrl}
                      onChange={(e) => setMcpUrl(e.target.value)}
                      placeholder="https://ctf2.dasctf.com/api/ai/v1/mcp"
                      className="font-mono text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-ink-secondary">
                      HTTP 请求头（每行一条 `Header: Value`）
                    </label>
                    <Textarea
                      rows={3}
                      value={mcpHeadersRaw}
                      onChange={(e) => setMcpHeadersRaw(e.target.value)}
                      placeholder="Authorization: Bearer your_agent_token_here"
                      className="font-mono text-xs"
                    />
                    {editingServer?.hasHeaders && (
                      <p className="mt-1 text-[11px] text-ink-muted">
                        当前已保存加密请求头：留空保存将保留原请求头，输入新内容将覆盖。
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
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
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-ink-secondary">
                      环境变量（每行一条 `KEY=VALUE`，可选）
                    </label>
                    <Textarea
                      rows={3}
                      value={mcpEnvRaw}
                      onChange={(e) => setMcpEnvRaw(e.target.value)}
                      placeholder="API_TOKEN=..."
                      className="font-mono text-xs"
                    />
                    {editingServer?.hasEnv && (
                      <p className="mt-1 text-[11px] text-ink-muted">
                        当前已保存环境变量：留空保存将保留原值，输入新内容将覆盖。
                      </p>
                    )}
                  </div>
                </>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-ink-secondary">说明（可选）</label>
                  <Input
                    value={mcpNotes}
                    onChange={(e) => setMcpNotes(e.target.value)}
                    placeholder="用途说明，将提供给智能体参考"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink-secondary">超时（秒）</label>
                  <Input
                    type="number"
                    min={5}
                    max={1800}
                    value={mcpTimeout}
                    onChange={(e) => setMcpTimeout(e.target.value)}
                    placeholder="60"
                    className="font-mono"
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={testingDraft}
              onClick={() => void handleTestDraft()}
            >
              <Zap className="h-3.5 w-3.5" />
              先试连
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => setMcpOpen(false)}>
                取消
              </Button>
              <Button type="submit" variant="primary" loading={savingMcp}>
                保存连接
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
