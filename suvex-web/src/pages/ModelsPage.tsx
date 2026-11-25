import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  CheckCircle2,
  Cpu,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import type { ProviderKind, ProviderOut } from '@/types/api'
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

export function ModelsPage() {
  const { push } = useToast()
  const [providers, setProviders] = useState<ProviderOut[]>([])
  const [loading, setLoading] = useState(true)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ProviderOut | null>(null)
  const [label, setLabel] = useState('')
  const [model, setModel] = useState('')
  const [kind, setKind] = useState<ProviderKind>('cloud')
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1')
  const [apiKey, setApiKey] = useState('')
  const [note, setNote] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await api.listProviders()
      setProviders(list)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载模型接入点失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [push])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setLabel('')
    setModel('')
    setKind('cloud')
    setBaseUrl('https://api.openai.com/v1')
    setApiKey('')
    setNote('')
    setIsDefault(providers.length === 0)
    setModalOpen(true)
  }

  const openEdit = (p: ProviderOut) => {
    setEditing(p)
    setLabel(p.label)
    setModel(p.model)
    setKind(p.kind)
    setBaseUrl(p.baseUrl)
    setApiKey('')
    setNote(p.note || '')
    setIsDefault(p.isDefault)
    setModalOpen(true)
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await api.updateProvider(editing.id, {
          label: label.trim(),
          model: model.trim(),
          kind,
          baseUrl: baseUrl.trim(),
          apiKey: apiKey ? apiKey.trim() : '',
          note: note.trim(),
          isDefault,
        })
        push('模型配置已更新', 'success')
      } else {
        await api.createProvider({
          label: label.trim(),
          model: model.trim(),
          kind,
          baseUrl: baseUrl.trim(),
          apiKey: apiKey.trim(),
          note: note.trim(),
          isDefault,
        })
        push('模型接入点已创建，建议立即验证连通性', 'success')
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleVerify = async (p: ProviderOut) => {
    setVerifyingId(p.id)
    try {
      const res = await api.verifyProvider(p.id)
      if (res.status === 'ok') {
        push(`连通性验证通过（${res.durationMs}ms）`, 'success')
      } else {
        push(`验证失败：${res.error || '目标不可达'}`, 'error')
      }
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '验证失败', 'error')
    } finally {
      setVerifyingId(null)
    }
  }

  const handleSetDefault = async (p: ProviderOut) => {
    try {
      await api.setDefaultProvider(p.id)
      push(`已将「${p.label}」设为默认模型`, 'success')
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '设置默认失败', 'error')
    }
  }

  const handleDelete = async (p: ProviderOut) => {
    try {
      await api.deleteProvider(p.id)
      push('模型接入点已删除', 'default')
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '删除失败', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Model Providers"
        title="模型接入与连通性"
        description="配置兼容 OpenAI / Anthropic / 本地推理网关的模型接入点，密钥经服务端加密保存且永不明文回传。"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </Button>
            <Button variant="primary" size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              添加模型接入点
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      ) : providers.length === 0 ? (
        <EmptyState
          icon={<Cpu className="h-5 w-5" />}
          title="尚未配置大模型接入点"
          description="添加并验证至少一个云端或本地模型后，即可启动对话工作台、渗透扫描与 CTF 自动解题。"
          action={
            <Button variant="primary" size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              添加第一个模型
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {providers.map((p) => (
            <Card key={p.id} className="flex flex-col justify-between p-5">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink">{p.label}</h3>
                    {p.isDefault && (
                      <Badge className="border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300">
                        默认
                      </Badge>
                    )}
                    <Badge className="font-mono text-[10px]">
                      {p.kind === 'local' ? '本地网关' : '云端 API'}
                    </Badge>
                  </div>
                  {p.verified ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      已验证
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                      <XCircle className="h-3.5 w-3.5" />
                      待验证
                    </span>
                  )}
                </div>

                <dl className="mt-3 space-y-1.5 font-mono text-xs text-ink-secondary">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Model</dt>
                    <dd className="truncate text-ink">{p.model}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Base URL</dt>
                    <dd className="truncate">{p.baseUrl}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">API Key</dt>
                    <dd>{p.hasKey ? p.apiKeyMask : '未设置'}</dd>
                  </div>
                </dl>

                {p.verifyError && (
                  <p className="mt-2.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                    {p.verifyError}
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3.5">
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={verifyingId === p.id}
                    onClick={() => void handleVerify(p)}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    测活
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                    编辑
                  </Button>
                  {!p.isDefault && (
                    <Button size="sm" variant="ghost" onClick={() => void handleSetDefault(p)}>
                      <Star className="h-3.5 w-3.5" />
                      设为默认
                    </Button>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => void handleDelete(p)}>
                  <Trash2 className="h-3.5 w-3.5 text-ink-muted hover:text-red-600" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? '编辑模型接入点' : '新增模型接入点'}
        subtitle="支持 OpenAI 协议兼容接口（DeepSeek / OpenRouter / Gemini / 本地 vLLM / Ollama）"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">显示名称</label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="例如：DeepSeek Reasoner"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">模型标识</label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="deepseek-reasoner / gpt-4.1"
                className="font-mono"
                required
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">接入类型</label>
              <Select
                value={kind}
                onChange={(v) => setKind(v as ProviderKind)}
                className="w-full"
                options={[
                  { value: 'cloud', label: '云端 API' },
                  { value: 'local', label: '本地部署' },
                ]}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">Base URL</label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.deepseek.com/v1"
                className="font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-secondary">
              API Key {editing?.hasKey && <span className="text-ink-muted">（留空保持原密钥不变）</span>}
            </label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={editing?.hasKey ? editing.apiKeyMask : 'sk-...'}
              required={!editing && kind === 'cloud'}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-secondary">备注（可选）</label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="用途说明" />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-secondary">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-line"
            />
            设为全局默认模型
          </label>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              保存配置
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
