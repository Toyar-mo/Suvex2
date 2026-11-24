import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  DownloadCloud,
  FileText,
  Flag,
  KeyRound,
  MessagesSquare,
  Play,
  RefreshCw,
  Square,
  Trash2,
  Trophy,
} from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { CTF_STATUS_META, formatCompactNumber } from '@/lib/format'
import type {
  KernelAccountOut,
  KernelChallengeOut,
  KernelCompetitionOut,
  KernelQueueOut,
  KernelUsageSummary,
  KernelWriteupOut,
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
import { MarkdownView } from '@/components/ui/MarkdownView'
import { cn } from '@/lib/cn'

export function CtfPage() {
  const navigate = useNavigate()
  const { push } = useToast()

  const [accounts, setAccounts] = useState<KernelAccountOut[]>([])
  const [competitions, setCompetitions] = useState<KernelCompetitionOut[]>([])
  const [selectedCompId, setSelectedCompId] = useState<string>('')
  const [challenges, setChallenges] = useState<KernelChallengeOut[]>([])
  const [queue, setQueue] = useState<KernelQueueOut | null>(null)
  const [usage, setUsage] = useState<KernelUsageSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Modals
  const [bindOpen, setBindOpen] = useState(false)
  const [bindLabel, setBindLabel] = useState('DASCTF 主账号')
  const [bindToken, setBindToken] = useState('')
  const [binding, setBinding] = useState(false)

  const [pullInput, setPullInput] = useState('')
  const [pulling, setPulling] = useState(false)

  const [flagTarget, setFlagTarget] = useState<KernelChallengeOut | null>(null)
  const [flagInput, setFlagInput] = useState('')
  const [submittingFlag, setSubmittingFlag] = useState(false)

  const [writeup, setWriteup] = useState<KernelWriteupOut | null>(null)

  const loadAll = useCallback(async () => {
    try {
      const [accs, comps, q, usg] = await Promise.all([
        api.getKernelAccounts().catch(() => []),
        api.getKernelCompetitions().catch(() => []),
        api.getKernelQueue().catch(() => null),
        api.getKernelUsage(selectedCompId || undefined).catch(() => null),
      ])
      setAccounts(accs)
      setCompetitions(comps)
      setQueue(q)
      setUsage(usg)

      const compId = selectedCompId || comps[0]?.id || ''
      if (!selectedCompId && compId) setSelectedCompId(compId)

      const chals = await api.getKernelChallenges({
        competitionId: compId || undefined,
      })
      setChallenges(chals)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载 CTF 题板失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [push, selectedCompId])

  useEffect(() => {
    void loadAll()
    const timer = window.setInterval(() => void loadAll(), 15000)
    return () => window.clearInterval(timer)
  }, [loadAll])

  const categories = useMemo(() => {
    return Array.from(new Set(challenges.map((c) => c.category).filter(Boolean))).sort()
  }, [challenges])

  const filtered = useMemo(() => {
    return challenges.filter((c) => {
      if (categoryFilter && c.category !== categoryFilter) return false
      if (statusFilter && c.status !== statusFilter) return false
      return true
    })
  }, [challenges, categoryFilter, statusFilter])

  const handleBindAccount = async (e: FormEvent) => {
    e.preventDefault()
    if (!bindToken.trim()) return
    setBinding(true)
    try {
      await api.bindKernelAccount(bindToken.trim(), bindLabel.trim() || 'CTF 账号')
      push('赛题平台账号已绑定', 'success')
      setBindOpen(false)
      setBindToken('')
      await loadAll()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '绑定账号失败', 'error')
    } finally {
      setBinding(false)
    }
  }

  const handleDeleteAccount = async (id: string) => {
    try {
      await api.deleteKernelAccount(id)
      push('账号绑定已移除', 'default')
      await loadAll()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '解除绑定失败', 'error')
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await api.syncKernel()
      push(res.message || `同步完成：新增 ${res.challengesCreated} 题`, 'success')
      await loadAll()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '同步赛事失败', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const handlePullSingle = async (e: FormEvent) => {
    e.preventDefault()
    if (!pullInput.trim()) return
    setPulling(true)
    try {
      const res = await api.pullChallenge(pullInput.trim())
      push(`已拉取题目：${res.challenge.title}`, 'success')
      setPullInput('')
      await loadAll()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '拉取单题失败', 'error')
    } finally {
      setPulling(false)
    }
  }

  const handleSolve = async (chal: KernelChallengeOut) => {
    try {
      const res = await api.solveChallenge(chal.id)
      push(res.message || `已将「${chal.title}」投入自动解题队列`, 'success')
      await loadAll()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '启动解题失败', 'error')
    }
  }

  const handleCancel = async (chal: KernelChallengeOut) => {
    try {
      await api.cancelChallenge(chal.id)
      push(`已停止「${chal.title}」的解题任务`, 'default')
      await loadAll()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '取消失败', 'error')
    }
  }

  const handleOpenChat = async (chal: KernelChallengeOut) => {
    try {
      const session = await api.createChatForChallenge(chal.id)
      navigate(`/chat?session=${encodeURIComponent(session.id)}`)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '打开解题对话失败', 'error')
    }
  }

  const handleSubmitFlag = async (e: FormEvent) => {
    e.preventDefault()
    if (!flagTarget || !flagInput.trim()) return
    setSubmittingFlag(true)
    try {
      const res = await api.submitFlag(flagTarget.id, flagInput.trim())
      push(res.message || `提交状态：${res.status}`, res.status === 'correct' ? 'success' : 'default')
      setFlagTarget(null)
      setFlagInput('')
      await loadAll()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '提交 Flag 失败', 'error')
    } finally {
      setSubmittingFlag(false)
    }
  }

  const handleOpenWriteup = async (chal: KernelChallengeOut) => {
    try {
      const w = await api.getChallengeWriteup(chal.id)
      setWriteup(w)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '暂无可用题解', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Autonomous CTF Kernel"
        title="CTF 夺旗工作台"
        description="连接竞赛平台拉取赛事与题目，在隔离沙箱中由智能体自动解题、校验 Flag 并生成完整 Writeup。"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setBindOpen(true)}>
              <KeyRound className="h-3.5 w-3.5" />
              绑定平台账号
            </Button>
            <Button variant="primary" size="sm" loading={syncing} onClick={() => void handleSync()}>
              <RefreshCw className="h-3.5 w-3.5" />
              同步赛事题板
            </Button>
          </>
        }
      />

      {/* Top Status Strip: Accounts + Queue + Token Usage */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-ink-secondary">
            <span>已绑定赛题平台</span>
            <KeyRound className="h-3.5 w-3.5 text-ink-muted" />
          </div>
          {accounts.length === 0 ? (
            <p className="mt-2 text-xs text-ink-muted">尚未绑定平台 Access Key</p>
          ) : (
            <div className="mt-2 space-y-1.5">
              {accounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between text-xs">
                  <div className="min-w-0">
                    <span className="font-medium text-ink">{acc.label}</span>
                    <span className="ml-1.5 font-mono text-[10px] text-ink-muted">
                      {acc.tokenMask}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDeleteAccount(acc.id)}
                    className="rounded p-1 text-ink-muted hover:bg-wash hover:text-red-600"
                    title="解绑账号"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-ink-secondary">
            <span>自动解题队列</span>
            <Trophy className="h-3.5 w-3.5 text-ink-muted" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-ink">
            {queue ? `${queue.running} / ${queue.limit}` : '0 / 0'}
          </div>
          <p className="mt-0.5 text-[11px] text-ink-muted">
            排队等待 {queue?.queued ?? 0} 题 · 已解出{' '}
            {challenges.filter((c) => c.status === 'solved').length} / {challenges.length}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-ink-secondary">
            <span>模型推理用量</span>
            <Flag className="h-3.5 w-3.5 text-ink-muted" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-ink">
            {usage ? formatCompactNumber(usage.totalTokens) : '0'}
          </div>
          <p className="mt-0.5 text-[11px] text-ink-muted">
            累计 {usage?.calls ?? 0} 次调用 · 含推理与工具回合
          </p>
        </Card>
      </div>

      {/* Competition Switcher + Single Pull */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {competitions.length > 0 && (
            <select
              value={selectedCompId}
              onChange={(e) => setSelectedCompId(e.target.value)}
              className="h-9 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink focus:border-accent focus:outline-none"
            >
              <option value="">全部赛事 ({challenges.length})</option>
              {competitions.map((comp) => (
                <option key={comp.id} value={comp.id}>
                  {comp.name} ({comp.challengeCount} 题)
                </option>
              ))}
            </select>
          )}

          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setCategoryFilter('')}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-xs font-medium',
                !categoryFilter
                  ? 'bg-ink text-canvas'
                  : 'border border-line bg-surface text-ink-secondary hover:bg-subtle',
              )}
            >
              全部方向
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-xs font-medium',
                  categoryFilter === cat
                    ? 'bg-ink text-canvas'
                    : 'border border-line bg-surface text-ink-secondary hover:bg-subtle',
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-lg border border-line bg-surface px-2.5 text-xs text-ink-secondary focus:border-accent focus:outline-none"
          >
            <option value="">全部状态</option>
            <option value="unsolved">未解出</option>
            <option value="solving">解题中</option>
            <option value="candidate">待交 Flag</option>
            <option value="solved">已解出</option>
          </select>
        </div>

        <form onSubmit={handlePullSingle} className="flex items-center gap-2">
          <Input
            value={pullInput}
            onChange={(e) => setPullInput(e.target.value)}
            placeholder="输入题目链接或 ID 拉取单题…"
            className="h-8 w-56 text-xs"
          />
          <Button type="submit" size="sm" variant="secondary" loading={pulling}>
            <DownloadCloud className="h-3.5 w-3.5" />
            拉题
          </Button>
        </form>
      </div>

      {/* Challenge Board */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Flag className="h-5 w-5" />}
          title="题板为空"
          description="请先绑定 CTF 竞赛平台账号并点击「同步赛事题板」，或直接通过题目链接拉取单题。"
          action={
            <Button variant="primary" size="sm" onClick={() => setBindOpen(true)}>
              绑定平台账号
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((chal) => {
            const st = CTF_STATUS_META[chal.status] || CTF_STATUS_META.unsolved
            const isSolving = chal.status === 'solving' || chal.status === 'queued'
            return (
              <Card key={chal.id} className="flex flex-col justify-between p-5">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge className="font-mono text-[10px]">{chal.category}</Badge>
                      <Badge pulse={chal.status === 'solving'} className={st.badge}>
                        {st.label}
                      </Badge>
                    </div>
                    {chal.score != null && (
                      <span className="font-mono text-xs font-semibold tabular-nums text-ink">
                        {chal.score} pts
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 text-sm font-semibold text-ink">{chal.title}</h3>
                  {chal.description && (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-secondary">
                      {chal.description}
                    </p>
                  )}

                  {(chal.confirmedFlag || chal.candidateFlag) && (
                    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1.5 font-mono text-[11px] text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
                      <span className="truncate block">
                        {chal.confirmedFlag || chal.candidateFlag}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-line pt-3.5">
                  {isSolving ? (
                    <Button size="sm" variant="danger" onClick={() => void handleCancel(chal)}>
                      <Square className="h-3 w-3" />
                      停止
                    </Button>
                  ) : (
                    <Button size="sm" variant="primary" onClick={() => void handleSolve(chal)}>
                      <Play className="h-3 w-3" />
                      自动解题
                    </Button>
                  )}

                  <Button size="sm" variant="secondary" onClick={() => void handleOpenChat(chal)}>
                    <MessagesSquare className="h-3.5 w-3.5" />
                    对话
                  </Button>

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setFlagTarget(chal)
                      setFlagInput(chal.candidateFlag || '')
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    交 Flag
                  </Button>

                  <Button size="sm" variant="ghost" onClick={() => void handleOpenWriteup(chal)}>
                    <FileText className="h-3.5 w-3.5" />
                    题解
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Bind Account Modal */}
      <Modal
        open={bindOpen}
        onClose={() => setBindOpen(false)}
        title="绑定 CTF 平台账号"
        subtitle="Access Key 经服务端加密存储，仅用于同步赛事题板与提交 Flag。"
      >
        <form onSubmit={handleBindAccount} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-secondary">账号备注</label>
            <Input
              value={bindLabel}
              onChange={(e) => setBindLabel(e.target.value)}
              placeholder="例如：DASCTF 战队主号"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-secondary">
              平台 Access Key / Token
            </label>
            <Input
              type="password"
              value={bindToken}
              onChange={(e) => setBindToken(e.target.value)}
              placeholder="粘贴竞赛平台 Token"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setBindOpen(false)}>
              取消
            </Button>
            <Button type="submit" variant="primary" loading={binding}>
              确认绑定
            </Button>
          </div>
        </form>
      </Modal>

      {/* Submit Flag Modal */}
      <Modal
        open={Boolean(flagTarget)}
        onClose={() => setFlagTarget(null)}
        title={`提交 Flag · ${flagTarget?.title || ''}`}
        subtitle={
          flagTarget
            ? `剩余错误提交额度：${flagTarget.remainingWrongSubmissions} / ${flagTarget.maxWrongSubmissions}`
            : undefined
        }
      >
        <form onSubmit={handleSubmitFlag} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-secondary">Flag 内容</label>
            <Input
              value={flagInput}
              onChange={(e) => setFlagInput(e.target.value)}
              placeholder="flag{...}"
              className="font-mono"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setFlagTarget(null)}>
              取消
            </Button>
            <Button type="submit" variant="primary" loading={submittingFlag}>
              校验并提交
            </Button>
          </div>
        </form>
      </Modal>

      {/* Writeup Viewer Modal */}
      <Modal
        open={Boolean(writeup)}
        onClose={() => setWriteup(null)}
        title={writeup ? `题解 · ${writeup.title}` : '题解'}
        subtitle={writeup ? `${writeup.category} · ${writeup.turns} 回合` : undefined}
        maxWidth="max-w-3xl"
      >
        {writeup && <MarkdownView content={writeup.markdown} />}
      </Modal>
    </div>
  )
}
