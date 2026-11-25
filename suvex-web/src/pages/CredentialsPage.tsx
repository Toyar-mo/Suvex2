import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Copy, Eye, EyeOff, KeyRound, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { formatRelativeTime } from '@/lib/format'
import type { CredentialOut, ReusePlanOut } from '@/types/api'
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
} from '@/components/ui/primitives'

export function CredentialsPage() {
  const { push } = useToast()
  const [items, setItems] = useState<CredentialOut[]>([])
  const [loading, setLoading] = useState(true)
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [reuseMap, setReuseMap] = useState<Record<string, ReusePlanOut>>({})

  const [createOpen, setCreateOpen] = useState(false)
  const [kind, setKind] = useState('password')
  const [target, setTarget] = useState('')
  const [username, setUsername] = useState('')
  const [secret, setSecret] = useState('')
  const [source, setSource] = useState('manual')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await api.listCredentials()
      setItems(list)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载凭据库失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [push])

  useEffect(() => {
    void load()
  }, [load])

  const handleReveal = async (id: string) => {
    if (revealed[id]) {
      setRevealed((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      return
    }
    try {
      const res = await api.revealCredential(id)
      setRevealed((prev) => ({ ...prev, [id]: res.secret }))
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '解密揭示失败', 'error')
    }
  }

  const handleReuseScore = async (id: string) => {
    try {
      const plan = await api.getCredentialReusePlan(id)
      setReuseMap((prev) => ({ ...prev, [id]: plan }))
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '评估复用分值失败', 'error')
    }
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!target.trim() || !secret.trim()) return
    setSaving(true)
    try {
      await api.createCredential({
        kind,
        target: target.trim(),
        username: username.trim(),
        secret: secret.trim(),
        source: source.trim(),
        notes: notes.trim(),
      })
      push('凭据已加密入库', 'success')
      setCreateOpen(false)
      setTarget('')
      setUsername('')
      setSecret('')
      setNotes('')
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '保存凭据失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.deleteCredential(id)
      push('凭据已删除', 'default')
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '删除失败', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Encrypted Credential Vault"
        title="凭据库"
        description="列表默认仅返回脱敏元数据，按需显式调用服务端解密揭示，并支持横向复用风险评估。"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </Button>
            <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              登记凭据
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<KeyRound className="h-5 w-5" />}
              title="凭据台账为空"
              description="扫描过程中捕获的弱口令、Token 或手工登记的测试账号均会加密归档于此。"
              action={
                <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                  登记第一条凭据
                </Button>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {items.map((item) => {
              const plain = revealed[item.id]
              const reuse = reuseMap[item.id]
              return (
                <div key={item.id} className="space-y-2.5 px-5 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="font-mono uppercase">{item.kind}</Badge>
                        <span className="truncate font-mono text-sm font-semibold text-ink">
                          {item.username || '(无用户名)'} @ {item.target}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">
                        来源：{item.source || '—'} · 登记于 {formatRelativeTime(item.createdAt)}
                        {item.notes ? ` · ${item.notes}` : ''}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleReveal(item.id)}
                      >
                        {plain ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        {plain ? '隐藏' : '揭示'}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleReuseScore(item.id)}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        复用评分
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void handleDelete(item.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-ink-muted hover:text-red-600" />
                      </Button>
                    </div>
                  </div>

                  {plain && (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 font-mono text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                      <span className="break-all">{plain}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          void navigator.clipboard.writeText(plain)
                          push('凭据已复制', 'success')
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}

                  {reuse && (
                    <div className="rounded-lg border border-line bg-subtle px-3.5 py-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-ink">
                          横向复用评分：<strong className="font-mono">{reuse.score.toFixed(2)}</strong>
                        </span>
                        <span className="font-mono text-[11px] text-ink-muted">
                          同目标 {reuse.sameTarget} · 同主机 {reuse.sameHost} · 同扫描 {reuse.sameScan}
                        </span>
                      </div>
                      {reuse.basis.length > 0 && (
                        <p className="mt-1 text-[11px] text-ink-secondary">
                          {reuse.basis.join('；')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="登记新凭据">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">类型</label>
              <Select
                value={kind}
                onChange={setKind}
                className="w-full"
                options={[
                  { value: 'password', label: 'Password' },
                  { value: 'token', label: 'API Token / JWT' },
                  { value: 'ssh_key', label: 'SSH Key' },
                  { value: 'cookie', label: 'Session Cookie' },
                ]}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">用户名</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-secondary">所属目标</label>
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="https://app.internal"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-secondary">凭据值（加密保存）</label>
            <Input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="输入口令 / Token"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">来源</label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">备注</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="权限范围" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              加密入库
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
