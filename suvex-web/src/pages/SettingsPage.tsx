import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  CheckCircle2,
  Copy,
  Key,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  XCircle,
} from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { formatRelativeTime } from '@/lib/format'
import type { ApiTokenOut, DeepCheckOut, SandboxOut } from '@/types/api'
import { Badge, Button, Card, Input, PageHeader } from '@/components/ui/primitives'

export function SettingsPage() {
  const { push } = useToast()

  const [sandbox, setSandbox] = useState<SandboxOut | null>(null)
  const [tokens, setTokens] = useState<ApiTokenOut[]>([])
  const [checks, setChecks] = useState<DeepCheckOut[]>([])
  const [checking, setChecking] = useState(false)

  // Token creation
  const [tokenLabel, setTokenLabel] = useState('')
  const [tokenScopes, setTokenScopes] = useState<string[]>(['read'])
  const [createdPlaintext, setCreatedPlaintext] = useState<string | null>(null)
  const [creatingToken, setCreatingToken] = useState(false)

  // Password change
  const [curPw, setCurPw] = useState('')
  const [nextPw, setNextPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [changingPw, setChangingPw] = useState(false)

  const load = useCallback(async () => {
    try {
      const snap = await api.getSettingsSnapshot()
      setSandbox(snap.sandbox)
      setTokens(snap.tokens)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载设置失败', 'error')
    }
  }, [push])

  const runDeepChecks = useCallback(async () => {
    setChecking(true)
    try {
      const res = await api.getDeepHealth()
      setChecks(res)
    } catch {
      setChecks([])
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void load()
    void runDeepChecks()
  }, [load, runDeepChecks])

  const toggleScope = (s: string) => {
    setTokenScopes((prev) =>
      prev.includes(s) ? (prev.length > 1 ? prev.filter((x) => x !== s) : prev) : [...prev, s],
    )
  }

  const handleCreateToken = async (e: FormEvent) => {
    e.preventDefault()
    if (!tokenLabel.trim()) return
    setCreatingToken(true)
    try {
      const res = await api.createApiToken(tokenLabel.trim(), tokenScopes)
      setCreatedPlaintext(res.plaintext)
      setTokenLabel('')
      push('API 令牌已生成，请立即妥善保存明文', 'success')
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '创建令牌失败', 'error')
    } finally {
      setCreatingToken(false)
    }
  }

  const handleDeleteToken = async (id: string) => {
    try {
      await api.deleteApiToken(id)
      push('令牌已吊销', 'default')
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '吊销失败', 'error')
    }
  }

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (nextPw !== confirmPw) {
      push('两次输入的新口令不一致', 'error')
      return
    }
    setChangingPw(true)
    try {
      await api.changePassword(curPw, nextPw, confirmPw)
      push('管理员口令已更新', 'success')
      setCurPw('')
      setNextPw('')
      setConfirmPw('')
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '修改口令失败', 'error')
    } finally {
      setChangingPw(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Platform Configuration"
        title="系统设置与运行健康"
        description="检视沙箱运行参数、管理自动化 API 令牌、更新管理员口令并核验实例深度健康状态。"
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Deep Health & Sandbox */}
        <div className="space-y-6 lg:col-span-6">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold text-ink">实例深度自检</h2>
              </div>
              <Button size="sm" variant="secondary" loading={checking} onClick={() => void runDeepChecks()}>
                <RefreshCw className="h-3.5 w-3.5" />
                重新检测
              </Button>
            </div>
            <div className="mt-4 divide-y divide-line">
              {checks.length === 0 ? (
                <p className="py-4 text-xs text-ink-muted">暂无自检项输出</p>
              ) : (
                checks.map((c) => (
                  <div key={c.name} className="flex items-center justify-between py-2.5 text-xs">
                    <div>
                      <span className="font-mono font-medium text-ink">{c.name}</span>
                      {c.detail && <p className="text-[11px] text-ink-muted">{c.detail}</p>}
                    </div>
                    {c.ok ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        正常
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                        <XCircle className="h-3.5 w-3.5" />
                        异常
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">沙箱执行环境</h2>
            {sandbox ? (
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-line bg-subtle p-3">
                  <dt className="text-ink-muted">执行引擎</dt>
                  <dd className="mt-0.5 font-mono font-medium text-ink">
                    {sandbox.engine} · {sandbox.status}
                  </dd>
                </div>
                <div className="rounded-lg border border-line bg-subtle p-3">
                  <dt className="text-ink-muted">镜像</dt>
                  <dd className="mt-0.5 truncate font-mono font-medium text-ink">{sandbox.image}</dd>
                </div>
                <div className="rounded-lg border border-line bg-subtle p-3">
                  <dt className="text-ink-muted">资源配额</dt>
                  <dd className="mt-0.5 font-mono text-ink">
                    {sandbox.cpuLimit} vCPU · {sandbox.memoryLimitMb} MB
                  </dd>
                </div>
                <div className="rounded-lg border border-line bg-subtle p-3">
                  <dt className="text-ink-muted">并发与超时</dt>
                  <dd className="mt-0.5 font-mono text-ink">
                    并发 {sandbox.maxConcurrentScans} · {sandbox.timeoutMinutes}m
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-xs text-ink-muted">正在加载沙箱状态…</p>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-ink">Suvex 2 全模块能力就绪</h2>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
              全部 19 个工作台模块已完成 Editorial Studio 独立架构重构与全链路接入，可通过左侧分组导航或 <code className="font-mono">⌘K</code> 快速切换。
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                '资产覆盖总览',
                '定时复查计划',
                '应急响应（IR）',
                '交付报告中心',
                '凭据库',
                '文件管理',
                '工具与 MCP 管理',
                '技能库编辑器',
                'Agent 角色',
                '审批审计日志',
                '内网立足点台账',
              ].map((mod) => (
                <Badge
                  key={mod}
                  className="border-emerald-200 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
                >
                  {mod}
                </Badge>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column: API Tokens & Password */}
        <div className="space-y-6 lg:col-span-6">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-ink">CI / 自动化 API 令牌</h2>
            </div>
            <p className="mt-1 text-xs text-ink-secondary">
              用于脚本或流水线通过 <code className="font-mono">Authorization: Bearer svx_…</code> 调用后端。
            </p>

            <form onSubmit={handleCreateToken} className="mt-4 space-y-3">
              <div className="flex gap-2">
                <Input
                  value={tokenLabel}
                  onChange={(e) => setTokenLabel(e.target.value)}
                  placeholder="令牌名称（例如：GitHub CI）"
                  required
                />
                <Button type="submit" variant="primary" loading={creatingToken}>
                  <Plus className="h-3.5 w-3.5" />
                  生成
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-ink-muted">权限范围：</span>
                {(['read', 'scan', 'admin'] as const).map((sc) => (
                  <label key={sc} className="inline-flex cursor-pointer items-center gap-1">
                    <input
                      type="checkbox"
                      checked={tokenScopes.includes(sc)}
                      onChange={() => toggleScope(sc)}
                    />
                    <span className="font-mono">{sc}</span>
                  </label>
                ))}
              </div>
            </form>

            {createdPlaintext && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/60">
                <p className="text-[11px] font-medium text-emerald-900 dark:text-emerald-200">
                  仅展示一次，请立即复制保存：
                </p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <code className="truncate font-mono text-xs text-emerald-950 dark:text-emerald-100">
                    {createdPlaintext}
                  </code>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      void navigator.clipboard.writeText(createdPlaintext)
                      push('已复制令牌明文', 'success')
                    }}
                  >
                    <Copy className="h-3 w-3" />
                    复制
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-4 divide-y divide-line">
              {tokens.length === 0 ? (
                <p className="py-3 text-xs text-ink-muted">暂无已签发令牌</p>
              ) : (
                tokens.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2.5 text-xs">
                    <div>
                      <span className="font-medium text-ink">{t.label}</span>
                      <span className="ml-2 font-mono text-[11px] text-ink-muted">
                        {t.prefix}… · {t.scopes.join(', ')}
                      </span>
                      <p className="text-[10px] text-ink-muted">
                        创建于 {formatRelativeTime(t.createdAt)}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => void handleDeleteToken(t.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-ink-muted hover:text-red-600" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-ink">修改管理员口令</h2>
            </div>
            <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
              <Input
                type="password"
                value={curPw}
                onChange={(e) => setCurPw(e.target.value)}
                placeholder="当前口令"
                required
              />
              <Input
                type="password"
                value={nextPw}
                onChange={(e) => setNextPw(e.target.value)}
                placeholder="新口令（至少 12 位，含大小写与数字）"
                required
              />
              <Input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="确认新口令"
                required
              />
              <Button type="submit" variant="primary" loading={changingPw}>
                更新口令
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
