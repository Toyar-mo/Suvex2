import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, FolderOpen, MessagesSquare, RefreshCw, Search, Trash2 } from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { formatBytes, formatRelativeTime } from '@/lib/format'
import type { ChatFileItemOut } from '@/types/api'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Skeleton } from '@/components/ui/primitives'

export function FilesPage() {
  const { push } = useToast()
  const [items, setItems] = useState<ChatFileItemOut[]>([])
  const [loading, setLoading] = useState(true)
  const [nameQuery, setNameQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listChatFiles({ name: nameQuery.trim() || undefined })
      setItems(res.items)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载文件列表失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [nameQuery, push])

  useEffect(() => {
    void load()
  }, [load])

  const handleDelete = async (item: ChatFileItemOut) => {
    try {
      await api.deleteChatFile(item.sessionId, item.path)
      push(`已删除 ${item.name}`, 'default')
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '删除文件失败', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Workspace Artifacts"
        title="文件管理"
        description="横向索引所有对话工作区中产出的 PoC 脚本、流量分析报告与取证文件，随时下载或跳转到原会话。"
        actions={
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </Button>
        }
      />

      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-muted" />
          <Input
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder="按文件名模糊检索..."
            className="h-9 pl-8 text-xs"
          />
        </div>
        <span className="font-mono text-xs text-ink-muted">共 {items.length} 个文件</span>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<FolderOpen className="h-5 w-5" />}
              title="暂无工作区文件"
              description="在对话工作台上传附件或由智能体保存分析产物后，所有文件会自动索引到这里。"
            />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {items.map((item) => (
              <div
                key={`${item.sessionId}:${item.path}`}
                className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-mono text-sm font-medium text-ink">
                      {item.name}
                    </span>
                    <Badge>{item.source}</Badge>
                    <span className="font-mono text-[11px] tabular-nums text-ink-muted">
                      {formatBytes(item.sizeBytes)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    路径 <code className="font-mono">{item.path}</code> · 会话「{item.sessionTitle}」·{' '}
                    {formatRelativeTime(new Date(item.modifiedAt * 1000).toISOString())}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <Link to={`/chat?session=${encodeURIComponent(item.sessionId)}`}>
                    <Button size="sm" variant="ghost">
                      <MessagesSquare className="h-3.5 w-3.5" />
                      原会话
                    </Button>
                  </Link>
                  <a
                    href={api.getChatFileDownloadUrl(item.sessionId, item.path)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button size="sm" variant="secondary">
                      <Download className="h-3.5 w-3.5" />
                      下载
                    </Button>
                  </a>
                  <Button size="sm" variant="ghost" onClick={() => void handleDelete(item)}>
                    <Trash2 className="h-3.5 w-3.5 text-ink-muted hover:text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
