import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  AlarmClock,
  AlertTriangle,
  ExternalLink,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import {
  formatRelativeTime,
  formatShortDate,
  GOAL_META,
  SCAN_AUTH_STATEMENT,
  TARGET_KINDS,
} from '@/lib/format'
import type { ProviderOut, ScanGoal, ScheduleOut, SkillId, TargetKind } from '@/types/api'
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

const INTERVAL_PRESETS = [
  { minutes: 60, label: '每小时' },
  { minutes: 360, label: '每 6 小时' },
  { minutes: 1440, label: '每天' },
  { minutes: 10080, label: '每周' },
]

export function SchedulesPage() {
  const { push } = useToast()
  const [items, setItems] = useState<ScheduleOut[]>([])
  const [dueCount, setDueCount] = useState(0)
  const [providers, setProviders] = useState<ProviderOut[]>([])
  const [loading, setLoading] = useState(true)

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [targetKind, setTargetKind] = useState<TargetKind>('url')
  const [target, setTarget] = useState('')
  const [goal, setGoal] = useState<ScanGoal>('findVulns')
  const [intervalMinutes, setIntervalMinutes] = useState(1440)
  const [providerId, setProviderId] = useState('auto')
  const [brief, setBrief] = useState('')
  const [authChecked, setAuthChecked] = useState(false)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [res, provs] = await Promise.all([
        api.listSchedules(),
        api.listProviders().catch(() => []),
      ])
      setItems(res.items)
      setDueCount(res.dueCount)
      setProviders(provs)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载定时复查计划失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [push])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!authChecked) {
      push('创建周期性扫描计划同样必须确认授权声明', 'error')
      return
    }
    const kindMeta = TARGET_KINDS.find((k) => k.id === targetKind) || TARGET_KINDS[0]
    setCreating(true)
    try {
      await api.createSchedule({
        name: name.trim(),
        target: target.trim(),
        targetKind,
        goal,
        intervalMinutes,
        providerId,
        skills: kindMeta.defaultSkills as SkillId[],
        brief: brief.trim() || null,
        authorizationStatement: SCAN_AUTH_STATEMENT,
      })
      push('定时复查计划已创建并启用', 'success')
      setCreateOpen(false)
      setName('')
      setTarget('')
      setBrief('')
      setAuthChecked(false)
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '创建计划失败', 'error')
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (s: ScheduleOut) => {
    try {
      await api.toggleSchedule(s.id, !s.enabled)
      push(s.enabled ? '已暂停该复查计划' : '已重新启用复查计划', 'success')
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '切换状态失败', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.deleteSchedule(id)
      push('复查计划已删除', 'default')
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '删除失败', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Recurring Verification"
        title="定时复查计划"
        description="让关键资产与修复项按周期自动复查，第一时间暴露已失效或连续报错的巡检任务。"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </Button>
            <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              新建定时计划
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3 text-xs text-ink-secondary">
        <Badge>共 {items.length} 条计划</Badge>
        <Badge>启用中 {items.filter((i) => i.enabled).length}</Badge>
        {dueCount > 0 && (
          <Badge className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
            待触发 {dueCount}
          </Badge>
        )}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<AlarmClock className="h-5 w-5" />}
              title="暂无定时复查计划"
              description="对高频变更的 Web 应用或核心 API 建立周期复查，避免“上次扫描是三个月前”的陈旧盲区。"
              action={
                <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                  新建第一条计划
                </Button>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{item.name}</span>
                    <Badge
                      className={
                        item.enabled
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'border-line bg-subtle text-ink-muted'
                      }
                    >
                      {item.enabled ? '启用中' : '已暂停'}
                    </Badge>
                    <Badge className="font-mono text-[10px]">
                      每 {item.intervalMinutes >= 1440 ? `${Math.round(item.intervalMinutes / 1440)} 天` : `${item.intervalMinutes} 分钟`}
                    </Badge>
                    <Badge>{GOAL_META[item.goal]?.label || item.goal}</Badge>
                    {item.failureCount > 0 && (
                      <Badge className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                        <AlertTriangle className="h-3 w-3" />
                        连续失败 {item.failureCount} 次
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-ink-muted">
                    {item.target} · 下次执行 {formatShortDate(item.nextRunAt)} · 上次{' '}
                    {formatRelativeTime(item.lastRunAt)}
                  </p>
                  {item.lastFailureReason && (
                    <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                      最近报错：{item.lastFailureReason}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {item.lastScanId && (
                    <Link to={`/scans?id=${encodeURIComponent(item.lastScanId)}`}>
                      <Button size="sm" variant="ghost">
                        <ExternalLink className="h-3.5 w-3.5" />
                        上次扫描
                      </Button>
                    </Link>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => void handleToggle(item)}>
                    {item.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {item.enabled ? '暂停' : '启用'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void handleDelete(item.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-ink-muted hover:text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="新建定时复查计划">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">计划名称</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="生产门户每周回归"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">目标形态</label>
              <Select
                value={targetKind}
                onChange={(v) => setTargetKind(v as TargetKind)}
                className="w-full"
                options={TARGET_KINDS.filter((k) => k.id !== 'artifact').map((k) => ({
                  value: k.id,
                  label: k.label,
                }))}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-secondary">目标地址</label>
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="https://portal.example.com"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">成功判据</label>
              <Select
                value={goal}
                onChange={(v) => setGoal(v as ScanGoal)}
                className="w-full"
                options={[
                  { value: 'findVulns', label: '渗透评估' },
                  { value: 'verifyFix', label: '修复复测' },
                ]}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">复查频率</label>
              <Select
                value={String(intervalMinutes)}
                onChange={(v) => setIntervalMinutes(Number(v))}
                className="w-full"
                options={INTERVAL_PRESETS.map((p) => ({
                  value: String(p.minutes),
                  label: p.label,
                }))}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">模型路由</label>
              <Select
                value={providerId}
                onChange={setProviderId}
                className="w-full"
                options={[
                  { value: 'auto', label: '默认模型' },
                  ...providers.map((p) => ({
                    value: p.id,
                    label: p.label,
                    description: p.model,
                  })),
                ]}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-secondary">任务说明（可选）</label>
            <Textarea
              rows={2}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="测试范围或注意事项…"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-line bg-subtle p-3 text-xs">
            <input
              type="checkbox"
              checked={authChecked}
              onChange={(e) => setAuthChecked(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-ink">
              <strong>{SCAN_AUTH_STATEMENT}</strong>（授权持续周期性复查该目标）
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button type="submit" variant="primary" loading={creating} disabled={!authChecked}>
              创建计划
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
