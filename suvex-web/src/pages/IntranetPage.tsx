import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Network, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { formatRelativeTime } from '@/lib/format'
import type { IntranetKind, IntranetSessionOut, IntranetStatus } from '@/types/api'
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

const STATUS_BADGE: Record<IntranetStatus, { label: string; cls: string }> = {
  alive: {
    label: '存活',
    cls: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  dead: {
    label: '已失效',
    cls: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300',
  },
  unknown: {
    label: '未知',
    cls: 'border-line bg-subtle text-ink-secondary',
  },
}

export function IntranetPage() {
  const { push } = useToast()
  const [items, setItems] = useState<IntranetSessionOut[]>([])
  const [loading, setLoading] = useState(true)

  const [createOpen, setCreateOpen] = useState(false)
  const [kind, setKind] = useState<IntranetKind>('ssh')
  const [host, setHost] = useState('')
  const [username, setUsername] = useState('')
  const [secret, setSecret] = useState('')
  const [status, setStatus] = useState<IntranetStatus>('alive')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await api.listIntranetSessions()
      setItems(list)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载内网会话台账失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [push])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!host.trim() || !secret.trim()) return
    setSaving(true)
    try {
      await api.createIntranetSession({
        kind,
        host: host.trim(),
        username: username.trim(),
        secret: secret.trim(),
        status,
        notes: notes.trim(),
      })
      push('立足点记录已登记', 'success')
      setCreateOpen(false)
      setHost('')
      setUsername('')
      setSecret('')
      setNotes('')
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '登记失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (s: IntranetSessionOut, next: IntranetStatus) => {
    try {
      await api.updateIntranetSession(s.id, { status: next })
      push('状态已更新', 'success')
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '更新状态失败', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.deleteIntranetSession(id)
      push('记录已移除', 'default')
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '删除失败', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Foothold Ledger"
        title="内网会话台账"
        description="人工登记授权演练中的立足点（Webshell / 反弹 Shell / SSH），仅作台账留痕，平台不会主动发起连接。"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </Button>
            <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              登记立足点
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
              icon={<Network className="h-5 w-5" />}
              title="暂无内网会话记录"
              description="授权红队演练中获得的 SSH、Webshell 或反弹通道可在此统一登记状态与备注。"
              action={
                <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                  登记第一条记录
                </Button>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {items.map((item) => {
              const sb = STATUS_BADGE[item.status] || STATUS_BADGE.unknown
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="font-mono uppercase">{item.kind}</Badge>
                      <span className="truncate font-mono text-sm font-semibold text-ink">
                        {item.username ? `${item.username}@` : ''}
                        {item.host}
                      </span>
                      <Badge className={sb.cls}>{sb.label}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">
                      {item.notes || '无备注'} · 更新于 {formatRelativeTime(item.updatedAt)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {(['alive', 'dead', 'unknown'] as IntranetStatus[]).map((st) => (
                      <Button
                        key={st}
                        size="sm"
                        variant={item.status === st ? 'primary' : 'secondary'}
                        disabled={item.status === st}
                        onClick={() => void handleStatusChange(item, st)}
                      >
                        {STATUS_BADGE[st].label}
                      </Button>
                    ))}
                    <Button size="sm" variant="ghost" onClick={() => void handleDelete(item.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-ink-muted hover:text-red-600" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="登记内网立足点">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">通道类型</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as IntranetKind)}
                className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-xs text-ink"
              >
                <option value="ssh">SSH</option>
                <option value="webshell">Webshell</option>
                <option value="reverse">反弹 Shell</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">初始状态</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as IntranetStatus)}
                className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-xs text-ink"
              >
                <option value="alive">存活</option>
                <option value="unknown">未知</option>
                <option value="dead">已失效</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">主机 / URL</label>
              <Input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="10.0.1.24:22"
                className="font-mono"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">账号</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="www-data" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-secondary">连接凭据 / 密钥</label>
            <Input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="加密保存，不回传明文"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-secondary">环境备注</label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="所处网段、权限级别、注意事项…"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              确认登记
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
