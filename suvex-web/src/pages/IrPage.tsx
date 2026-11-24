import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  FileText,
  MessagesSquare,
  Paperclip,
  Play,
  Plus,
  RefreshCw,
  Siren,
  Square,
} from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { CTF_STATUS_META, formatBytes } from '@/lib/format'
import type {
  KernelChallengeOut,
  KernelCompetitionOut,
  KernelWorkOrderOut,
  KernelWriteupOut,
  StagedAttachmentsOut,
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
  Textarea,
} from '@/components/ui/primitives'
import { MarkdownView } from '@/components/ui/MarkdownView'

export function IrPage() {
  const navigate = useNavigate()
  const { push } = useToast()

  const [competitions, setCompetitions] = useState<KernelCompetitionOut[]>([])
  const [challenges, setChallenges] = useState<KernelChallengeOut[]>([])
  const [loading, setLoading] = useState(true)

  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [staged, setStaged] = useState<StagedAttachmentsOut | null>(null)
  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)

  const [viewerTitle, setViewerTitle] = useState('')
  const [viewerMarkdown, setViewerMarkdown] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [comps, chals] = await Promise.all([
        api.getKernelCompetitions().catch(() => []),
        api.getKernelChallenges().catch(() => []),
      ])
      setCompetitions(comps)
      setChallenges(chals)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载应急响应任务失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [push])

  useEffect(() => {
    void load()
  }, [load])

  const irTasks = useMemo(() => {
    const localCompIds = new Set(
      competitions
        .filter((c) => c.kind === 'local' || c.kind === 'ir' || c.remoteId === 'local-review')
        .map((c) => c.id),
    )
    return challenges.filter(
      (c) =>
        localCompIds.has(c.competitionId) ||
        c.category.toLowerCase() === 'ir' ||
        c.category.includes('应急'),
    )
  }, [challenges, competitions])

  const handleStage = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const res = await api.stageScanAttachments(Array.from(files))
      setStaged(res)
      push(`已暂存 ${res.files.length} 份取证证据包`, 'success')
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '上传证据包失败', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !brief.trim()) return
    setCreating(true)
    try {
      const res = await api.createIrTask({
        title: title.trim(),
        brief: brief.trim(),
        attachmentStagingId: staged?.stagingId || null,
      })
      push(res.notice || `应急复盘任务「${res.challenge.title}」已创建`, 'success')
      setCreateOpen(false)
      setTitle('')
      setBrief('')
      setStaged(null)
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '创建复盘任务失败', 'error')
    } finally {
      setCreating(false)
    }
  }

  const handleStart = async (task: KernelChallengeOut) => {
    try {
      await api.solveChallenge(task.id)
      push('智能体已进入隔离沙箱开展日志分析与时间线还原', 'success')
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '启动分析失败', 'error')
    }
  }

  const handleStop = async (task: KernelChallengeOut) => {
    try {
      await api.cancelChallenge(task.id)
      push('已停止应急分析任务', 'default')
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '停止失败', 'error')
    }
  }

  const openWriteup = async (task: KernelChallengeOut) => {
    try {
      const w: KernelWriteupOut = await api.getChallengeWriteup(task.id)
      setViewerTitle(`入侵复盘报告 · ${task.title}`)
      setViewerMarkdown(w.markdown)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '暂无已生成的复盘报告', 'error')
    }
  }

  const openWorkOrder = async (task: KernelChallengeOut) => {
    try {
      const wo: KernelWorkOrderOut = await api.getChallengeWorkOrder(task.id)
      setViewerTitle(`应急处置工单 · ${task.title}`)
      setViewerMarkdown(wo.markdown)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '暂无可用处置工单', 'error')
    }
  }

  const openChat = async (task: KernelChallengeOut) => {
    try {
      const session = await api.createChatForChallenge(task.id)
      navigate(`/chat?session=${encodeURIComponent(session.id)}`)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '打开分析对话失败', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Incident Response & Forensics"
        title="应急响应复盘"
        description="上传日志包、流量抓包或磁盘取证证据，无需绑定外部赛题平台，由自治智能体还原入侵时间线并输出处置工单。"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </Button>
            <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              新建应急复盘
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : irTasks.length === 0 ? (
        <EmptyState
          icon={<Siren className="h-5 w-5" />}
          title="当前暂无本地应急响应复盘任务"
          description="点击右上角「新建应急复盘」，上传 Nginx / auth.log / PCAP / 样本证据包，让智能体自动追溯攻击路径。"
          action={
            <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              新建应急复盘
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {irTasks.map((task) => {
            const st = CTF_STATUS_META[task.status] || CTF_STATUS_META.unsolved
            const running = task.status === 'solving' || task.status === 'queued'
            return (
              <Card key={task.id} className="flex flex-col justify-between p-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge className="font-mono">IR</Badge>
                      <Badge pulse={task.status === 'solving'} className={st.badge}>
                        {st.label}
                      </Badge>
                    </div>
                    <span className="font-mono text-[11px] text-ink-muted">
                      {task.attachments.length} 份证据包
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-ink">{task.title}</h3>
                  {task.description && (
                    <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-ink-secondary">
                      {task.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-line pt-3.5">
                  {running ? (
                    <Button size="sm" variant="danger" onClick={() => void handleStop(task)}>
                      <Square className="h-3 w-3" />
                      停止
                    </Button>
                  ) : (
                    <Button size="sm" variant="primary" onClick={() => void handleStart(task)}>
                      <Play className="h-3 w-3" />
                      开始溯源
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => void openChat(task)}>
                    <MessagesSquare className="h-3.5 w-3.5" />
                    交互调查
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void openWorkOrder(task)}>
                    <ClipboardList className="h-3.5 w-3.5" />
                    处置工单
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void openWriteup(task)}>
                    <FileText className="h-3.5 w-3.5" />
                    时间线报告
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="新建本地应急响应复盘任务"
        subtitle="上传日志/证据压缩包并说明告警现象，系统将在独立隔离沙箱中展开调查"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-secondary">事件标题</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：生产 Web 服务器异常外联溯源"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-secondary">
              告警背景与调查目标
            </label>
            <Textarea
              rows={4}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="描述告警时间窗口、涉事主机、需要定位的初始入口、持久化后门与横向移动轨迹…"
              required
            />
          </div>
          <div>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink-secondary hover:border-line-strong hover:text-ink">
              <Paperclip className="h-3.5 w-3.5" />
              <span>{uploading ? '正在暂存证据包…' : '上传日志 / 取证压缩包'}</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => void handleStage(e.target.files)}
              />
            </label>
            {staged && (
              <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
                已暂存：{staged.files.map((f) => `${f.name} (${formatBytes(f.sizeBytes)})`).join('、')}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button type="submit" variant="primary" loading={creating}>
              创建复盘任务
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={viewerMarkdown !== null}
        onClose={() => setViewerMarkdown(null)}
        title={viewerTitle}
        maxWidth="max-w-3xl"
      >
        {viewerMarkdown && <MarkdownView content={viewerMarkdown} />}
      </Modal>
    </div>
  )
}
