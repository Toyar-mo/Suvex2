import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  BookOpen,
  Edit3,
  Eye,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import type { KernelSkillsOut, SkillDetailOut } from '@/types/api'
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
import { cn } from '@/lib/cn'

export function SkillsPage() {
  const { push } = useToast()
  const [catalog, setCatalog] = useState<KernelSkillsOut | null>(null)
  const [usageMap, setUsageMap] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [detail, setDetail] = useState<SkillDetailOut | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [draftDesc, setDraftDesc] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [saving, setSaving] = useState(false)

  // Create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('web')
  const [newDesc, setNewDesc] = useState('')
  const [newBody, setNewBody] = useState('# 技能速查\n\n- 适用场景：\n- 关键步骤：\n')

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const [sk, usg] = await Promise.all([
        api.listSkills(),
        api.getSkillsUsage().catch(() => null),
      ])
      setCatalog(sk)
      if (usg) {
        setUsageMap(new Map(usg.items.map((i) => [i.name, i.loads])))
      }
      if (!selectedName) {
        const first = sk.categories[0]?.skills[0]?.name
        if (first) setSelectedName(first)
      }
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载技能库失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [push, selectedName])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (!selectedName) {
      setDetail(null)
      return
    }
    setLoadingDetail(true)
    setEditMode(false)
    api
      .getSkill(selectedName)
      .then((d) => {
        setDetail(d)
        setDraftDesc(d.description)
        setDraftBody(d.body)
      })
      .catch((err) => {
        push(err instanceof ApiClientError ? err.message : '读取技能正文失败', 'error')
      })
      .finally(() => setLoadingDetail(false))
  }, [push, selectedName])

  const filteredCategories = useMemo(() => {
    if (!catalog) return []
    const q = searchQuery.trim().toLowerCase()
    return catalog.categories
      .map((cat) => ({
        ...cat,
        skills: q
          ? cat.skills.filter(
              (s) =>
                s.name.toLowerCase().includes(q) ||
                s.description.toLowerCase().includes(q) ||
                cat.category.toLowerCase().includes(q),
            )
          : cat.skills,
      }))
      .filter((c) => c.skills.length > 0)
  }, [catalog, searchQuery])

  const handleSaveEdit = async () => {
    if (!detail) return
    setSaving(true)
    try {
      const updated = await api.updateSkill(detail.name, {
        description: draftDesc.trim(),
        body: draftBody,
      })
      setDetail(updated)
      setEditMode(false)
      push('技能正文已保存', 'success')
      await loadList()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '保存技能失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    try {
      const created = await api.createSkill({
        name: newName.trim(),
        category: newCategory.trim() || 'custom',
        description: newDesc.trim(),
        body: newBody,
      })
      push(`已创建技能 ${created.name}`, 'success')
      setCreateOpen(false)
      setNewName('')
      setNewDesc('')
      await loadList()
      setSelectedName(created.name)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '创建技能失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (name: string) => {
    try {
      await api.deleteSkill(name)
      push(`已删除自定义技能 ${name}`, 'default')
      setSelectedName(null)
      await loadList()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '删除失败', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Knowledge Playbooks"
        title="技能库"
        description="检阅与编辑注入智能体上下文的速查技能卡，结合真实加载次数识别高价值知识与沉睡文本。"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => void loadList()}>
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </Button>
            <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              新建技能
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Skill Catalog */}
        <Card className="flex max-h-[72vh] flex-col overflow-hidden lg:col-span-4">
          <div className="border-b border-line p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-muted" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`搜索 ${catalog?.total ?? 0} 篇技能...`}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-3">
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : filteredCategories.length === 0 ? (
              <p className="py-10 text-center text-xs text-ink-muted">无匹配技能</p>
            ) : (
              filteredCategories.map((cat) => (
                <div key={cat.category}>
                  <p className="mb-1.5 px-2 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                    {cat.category} ({cat.skills.length})
                  </p>
                  <div className="space-y-0.5">
                    {cat.skills.map((sk) => {
                      const loads = usageMap.get(sk.name) || 0
                      const active = sk.name === selectedName
                      return (
                        <button
                          key={sk.name}
                          type="button"
                          onClick={() => setSelectedName(sk.name)}
                          className={cn(
                            'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors',
                            active
                              ? 'bg-subtle font-medium text-ink ring-1 ring-line'
                              : 'text-ink-secondary hover:bg-subtle/60 hover:text-ink',
                          )}
                        >
                          <span className="truncate font-mono">{sk.name}</span>
                          {loads > 0 && (
                            <Badge className="shrink-0 font-mono text-[10px]">{loads}次</Badge>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Right Reader / Editor */}
        <Card className="flex min-h-[72vh] flex-col overflow-hidden lg:col-span-8">
          {loadingDetail ? (
            <div className="p-6">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : !detail ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <EmptyState
                icon={<BookOpen className="h-5 w-5" />}
                title="选择左侧技能以阅读或编辑"
                description="技能正文会直接影响智能体的推理与排障策略。"
              />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-subtle/50 px-5 py-3.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-mono text-sm font-semibold text-ink">{detail.name}</h2>
                    <Badge>{detail.category}</Badge>
                    <Badge>{detail.source === 'builtin' ? '内置' : '自定义'}</Badge>
                    <span className="font-mono text-[11px] text-ink-muted">
                      {detail.lineCount} 行 · 加载 {usageMap.get(detail.name) || 0} 次
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-secondary">{detail.description}</p>
                </div>

                <div className="flex items-center gap-1.5">
                  {editMode ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setEditMode(false)}>
                        <Eye className="h-3.5 w-3.5" />
                        预览
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        loading={saving}
                        onClick={() => void handleSaveEdit()}
                      >
                        <Save className="h-3.5 w-3.5" />
                        保存
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setEditMode(true)}>
                      <Edit3 className="h-3.5 w-3.5" />
                      编辑正文
                    </Button>
                  )}
                  {detail.source !== 'builtin' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleDelete(detail.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-ink-muted hover:text-red-600" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {editMode ? (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-ink-secondary">
                        简短描述
                      </label>
                      <Input
                        value={draftDesc}
                        onChange={(e) => setDraftDesc(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-ink-secondary">
                        Markdown 正文
                      </label>
                      <Textarea
                        rows={20}
                        value={draftBody}
                        onChange={(e) => setDraftBody(e.target.value)}
                        className="font-mono text-xs leading-relaxed"
                      />
                    </div>
                  </div>
                ) : (
                  <MarkdownView content={detail.body} />
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="新建自定义技能">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">技能标识名</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="jwt-none-audit"
                className="font-mono"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">分类</label>
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="web / ctf / ir"
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-secondary">触发描述</label>
            <Input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="何时应拉取本技能…"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-secondary">正文内容</label>
            <Textarea
              rows={8}
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              className="font-mono text-xs"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              创建技能
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
