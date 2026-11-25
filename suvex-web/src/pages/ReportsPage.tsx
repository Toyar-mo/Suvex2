import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Download, Eye, FileText, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { formatRelativeTime, SEVERITY_META } from '@/lib/format'
import type { ReportDocumentOut, ReportOut, ScanOut, Severity } from '@/types/api'
import {
  Badge,
  Button,
  Card,
  Drawer,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
} from '@/components/ui/primitives'

export function ReportsPage() {
  const { push } = useToast()
  const [reports, setReports] = useState<ReportOut[]>([])
  const [scans, setScans] = useState<ScanOut[]>([])
  const [loading, setLoading] = useState(true)

  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [scopeKind, setScopeKind] = useState<'scan' | 'target'>('scan')
  const [scanId, setScanId] = useState('')
  const [target, setTarget] = useState('')
  const [format, setFormat] = useState<'markdown' | 'pdf'>('markdown')
  const [includePoc, setIncludePoc] = useState(true)
  const [includeReasoning, setIncludeReasoning] = useState(true)
  const [onlyConfirmed, setOnlyConfirmed] = useState(false)
  const [includeRemediation, setIncludeRemediation] = useState(true)
  const [creating, setCreating] = useState(false)

  const [previewDoc, setPreviewDoc] = useState<ReportDocumentOut | null>(null)
  const [previewReport, setPreviewReport] = useState<ReportOut | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, sc] = await Promise.all([
        api.listReports(),
        api.listScans({ sort: 'recent', dir: 'desc' }).catch(() => []),
      ])
      setReports(list)
      setScans(sc)
      if (!scanId && sc[0]) setScanId(sc[0].id)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载报告列表失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [push, scanId])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    try {
      await api.createReport({
        title: title.trim(),
        scope:
          scopeKind === 'scan'
            ? { kind: 'scan', scanId }
            : { kind: 'target', target: target.trim() },
        options: { includePoc, includeReasoning, onlyConfirmed, includeRemediation },
        format,
      })
      push('安全评估报告已生成', 'success')
      setCreateOpen(false)
      setTitle('')
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '生成报告失败', 'error')
    } finally {
      setCreating(false)
    }
  }

  const handlePreview = async (rep: ReportOut) => {
    setPreviewReport(rep)
    setPreviewDoc(null)
    try {
      const doc = await api.getReportDocument(rep.id)
      setPreviewDoc(doc)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载报告正文失败', 'error')
    }
  }

  const handleDelete = async (rep: ReportOut) => {
    try {
      await api.deleteReport(rep.id)
      push('报告已删除', 'default')
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '删除失败', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Deliverable Reports"
        title="交付报告中心"
        description="按单次扫描或目标资产组装可直接交付的安全评估报告，自定义是否纳入 PoC、推理链与修复建议。"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </Button>
            <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              生成新报告
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
        ) : reports.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title="尚未生成任何交付报告"
              description="选择一次已完成的扫描任务或目标资产，即可一键生成带编号与证据引用的 Markdown / PDF 报告。"
              action={
                <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  生成第一份报告
                </Button>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {reports.map((rep) => (
              <div
                key={rep.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-ink-muted">{rep.code}</span>
                    <span className="truncate text-sm font-semibold text-ink">{rep.title}</span>
                    <Badge className="font-mono uppercase">{rep.format}</Badge>
                  </div>
                  <p className="mt-1 font-mono text-xs text-ink-muted">
                    收录 {rep.findingCount} 条漏洞（排除 {rep.excludedCount} 条）·{' '}
                    {formatRelativeTime(rep.createdAt)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {(['critical', 'high', 'medium'] as Severity[]).map((sev) =>
                    rep.severityCounts?.[sev] ? (
                      <Badge key={sev} className={SEVERITY_META[sev].badge}>
                        {SEVERITY_META[sev].label} {rep.severityCounts[sev]}
                      </Badge>
                    ) : null,
                  )}
                  <Button size="sm" variant="secondary" onClick={() => void handlePreview(rep)}>
                    <Eye className="h-3.5 w-3.5" />
                    预览
                  </Button>
                  <a href={api.getReportDownloadUrl(rep.id)} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="secondary">
                      <Download className="h-3.5 w-3.5" />
                      下载
                    </Button>
                  </a>
                  <Button size="sm" variant="ghost" onClick={() => void handleDelete(rep)}>
                    <Trash2 className="h-3.5 w-3.5 text-ink-muted hover:text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Generate Report Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="生成安全交付报告"
        subtitle="所有结论保留原始证据引用与严重度分级定义"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-secondary">报告标题</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：生产 API 渗透评估报告（2026-11）"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">范围口径</label>
              <Select
                value={scopeKind}
                onChange={(v) => setScopeKind(v as 'scan' | 'target')}
                className="w-full"
                options={[
                  { value: 'scan', label: '按单次扫描' },
                  { value: 'target', label: '按目标资产汇总' },
                ]}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">导出格式</label>
              <Select
                value={format}
                onChange={(v) => setFormat(v as 'markdown' | 'pdf')}
                className="w-full"
                options={[
                  { value: 'markdown', label: 'Markdown (.md)' },
                  { value: 'pdf', label: 'PDF (.pdf)' },
                ]}
              />
            </div>
          </div>

          {scopeKind === 'scan' ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">选择扫描</label>
              <Select
                value={scanId}
                onChange={setScanId}
                className="w-full"
                placeholder="请选择扫描任务"
                options={scans.map((s) => ({
                  value: s.id,
                  label: s.name || s.target || s.id,
                }))}
              />
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">目标地址</label>
              <Input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="https://target.example.com"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-subtle p-3 text-xs">
            {[
              { label: '附带 PoC 验证脚本', val: includePoc, set: setIncludePoc },
              { label: '附带智能体推理过程', val: includeReasoning, set: setIncludeReasoning },
              { label: '仅包含已确认漏洞', val: onlyConfirmed, set: setOnlyConfirmed },
              { label: '附带修复建议', val: includeRemediation, set: setIncludeRemediation },
            ].map((opt) => (
              <label key={opt.label} className="flex cursor-pointer items-center gap-2 text-ink">
                <input
                  type="checkbox"
                  checked={opt.val}
                  onChange={(e) => opt.set(e.target.checked)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button type="submit" variant="primary" loading={creating}>
              立即生成
            </Button>
          </div>
        </form>
      </Modal>

      {/* Report Preview Drawer */}
      <Drawer
        open={Boolean(previewReport)}
        onClose={() => setPreviewReport(null)}
        title={previewReport?.title || '报告预览'}
        subtitle={previewReport?.code}
        widthClass="max-w-3xl"
      >
        {previewDoc ? (
          <div className="space-y-5">
            <Card className="p-4">
              <p className="text-[11px] uppercase tracking-wider text-ink-muted">总体结论</p>
              <p className="mt-1 text-sm font-medium text-ink">{previewDoc.verdict}</p>
            </Card>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-ink">
                收录漏洞明细（{previewDoc.entries.length}）
              </h3>
              {previewDoc.entries.length === 0 ? (
                <p className="text-xs text-ink-muted">本报告范围内无符合条件的漏洞条目。</p>
              ) : (
                previewDoc.entries.map((entry, idx) => (
                  <Card key={idx} className="p-4 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink">
                        {String(entry.title || `条目 #${idx + 1}`)}
                      </span>
                      <Badge>{String(entry.severity || 'info')}</Badge>
                    </div>
                    {Boolean(entry.target) && (
                      <p className="mt-1 font-mono text-[11px] text-ink-muted">
                        {String(entry.target)}
                      </p>
                    )}
                    {Boolean(entry.description) && (
                      <p className="mt-2 leading-relaxed text-ink-secondary">
                        {String(entry.description)}
                      </p>
                    )}
                  </Card>
                ))
              )}
            </div>
          </div>
        ) : (
          <Skeleton className="h-40 w-full" />
        )}
      </Drawer>
    </div>
  )
}
