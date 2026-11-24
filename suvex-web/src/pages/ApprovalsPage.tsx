import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ClipboardCheck, MessagesSquare, RefreshCw, X } from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { formatRelativeTime } from '@/lib/format'
import type { ChatApprovalOut } from '@/types/api'
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

const APPROVAL_BADGE: Record<string, { label: string; cls: string }> = {
  pending: {
    label: '待审批',
    cls: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300',
  },
  approved: {
    label: '已批准',
    cls: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  rejected: {
    label: '已拒绝',
    cls: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300',
  },
}

export function ApprovalsPage() {
  const { push } = useToast()
  const [items, setItems] = useState<ChatApprovalOut[]>([])
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await api.listApprovals(status || undefined, 100)
      setItems(list)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载审批记录失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [push, status])

  useEffect(() => {
    void load()
  }, [load])

  const handleDecide = async (item: ChatApprovalOut, approve: boolean) => {
    setActingId(item.id)
    try {
      await api.approveChatTool(item.sessionId, item.id, approve)
      push(approve ? '已批准该工具执行' : '已拒绝该工具调用', 'success')
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '审批操作失败', 'error')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Human-in-the-Loop Governance"
        title="工具审批记录"
        description="跨会话集中审计与处置高风险工具调用申请：记录操作人、工具名、完整参数与决策时刻。"
        actions={
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-1.5">
        {[
          { id: '', label: '全部记录' },
          { id: 'pending', label: '待审批' },
          { id: 'approved', label: '已批准' },
          { id: 'rejected', label: '已拒绝' },
        ].map((tab) => (
          <button
            key={tab.id || 'all'}
            type="button"
            onClick={() => setStatus(tab.id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              status === tab.id
                ? 'bg-ink text-canvas'
                : 'border border-line bg-surface text-ink-secondary hover:bg-subtle',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<ClipboardCheck className="h-5 w-5" />}
              title="暂无匹配的审批记录"
              description="当会话开启人工审批或智能体触发高风险动作时，申请与处置留痕会集中归档于此。"
            />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {items.map((item) => {
              const b = APPROVAL_BADGE[item.status] || APPROVAL_BADGE.pending
              return (
                <div key={item.id} className="space-y-2.5 px-5 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-ink">
                          {item.toolName}
                        </span>
                        <Badge className={b.cls}>{b.label}</Badge>
                        <span className="truncate text-xs text-ink-secondary">
                          会话：{item.sessionTitle}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-ink-muted">
                        申请于 {formatRelativeTime(item.createdAt)}
                        {item.decidedBy
                          ? ` · 审批人 ${item.decidedBy} (${formatRelativeTime(item.decidedAt)})`
                          : ''}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <Link to={`/chat?session=${encodeURIComponent(item.sessionId)}`}>
                        <Button size="sm" variant="ghost">
                          <MessagesSquare className="h-3.5 w-3.5" />
                          查看会话
                        </Button>
                      </Link>
                      {item.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="danger"
                            loading={actingId === item.id}
                            onClick={() => void handleDecide(item, false)}
                          >
                            <X className="h-3.5 w-3.5" />
                            拒绝
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            loading={actingId === item.id}
                            onClick={() => void handleDecide(item, true)}
                          >
                            <Check className="h-3.5 w-3.5" />
                            批准
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {item.toolArgs && Object.keys(item.toolArgs).length > 0 && (
                    <pre className="max-h-40 overflow-auto rounded-lg border border-line bg-subtle p-3 font-mono text-[11px] text-ink-secondary">
                      {JSON.stringify(item.toolArgs, null, 2)}
                    </pre>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
