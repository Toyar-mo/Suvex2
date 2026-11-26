import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  GitBranch,
  Key,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Server,
  Shield,
  Trash2,
  XCircle,
} from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { formatRelativeTime } from '@/lib/format'
import type {
  ApiTokenOut,
  DeepCheckOut,
  FindingSlaOut,
  LlmRetryPolicyOut,
  NetworkRestrictionsOut,
  NoticeRuleOut,
  NotifyChannelOut,
  ProviderOut,
  SandboxOut,
  ScanRetentionOut,
  Severity,
} from '@/types/api'
import { Badge, Button, Card, Input, PageHeader, Select } from '@/components/ui/primitives'

const CHECK_LABELS: Record<string, string> = {
  database: '数据库 (PostgreSQL)',
  migration: '数据库迁移版本',
  providers: '大模型接入通道',
  disk: '磁盘剩余空间',
  docker: 'Docker 沙箱引擎',
}

const QUICK_MODULES: Array<{ label: string; to: string }> = [
  { label: '资产覆盖总览', to: '/assets' },
  { label: '定时复查计划', to: '/schedules' },
  { label: '应急响应（IR）', to: '/ir' },
  { label: '交付报告中心', to: '/reports' },
  { label: '凭据库', to: '/credentials' },
  { label: '文件管理', to: '/files' },
  { label: '工具与 MCP 管理', to: '/tools' },
  { label: '技能库编辑器', to: '/skills' },
  { label: 'Agent 角色', to: '/agents' },
  { label: '审批审计日志', to: '/approvals' },
  { label: '操作审计日志', to: '/audit' },
  { label: '内网立足点台账', to: '/intranet' },
]

const ROUTE_GOALS: Array<{ key: string; label: string; desc: string }> = [
  { key: 'findVulns', label: '漏洞发现 (findVulns)', desc: '常规渗透测试与漏洞挖掘任务' },
  { key: 'captureFlag', label: 'CTF 夺旗 (captureFlag)', desc: '自动解题、逆向分析与 Flag 获取' },
  { key: 'verifyFix', label: '修复复测 (verifyFix)', desc: '针对已修复漏洞的复测验证扫描' },
]

function isCheckHealthy(check: DeepCheckOut): boolean {
  if (typeof check.status === 'string') return check.status === 'ok'
  return Boolean(check.ok)
}

function sandboxStatusMeta(status: string): { label: string; className: string } {
  if (status === 'running') {
    return {
      label: '运行中',
      className:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/60 dark:text-emerald-300',
    }
  }
  if (status === 'ready') {
    return {
      label: '空闲就绪',
      className:
        'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/60 dark:text-sky-300',
    }
  }
  return {
    label: status === 'unavailable' ? 'Docker 不可用' : status,
    className:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/60 dark:text-amber-300',
  }
}

export function SettingsPage() {
  const { push } = useToast()
  const { refresh: refreshAuth } = useAuth()

  const [sandbox, setSandbox] = useState<SandboxOut | null>(null)
  const [providers, setProviders] = useState<ProviderOut[]>([])
  const [tokens, setTokens] = useState<ApiTokenOut[]>([])
  const [checks, setChecks] = useState<DeepCheckOut[]>([])
  const [checking, setChecking] = useState(false)
  const [network, setNetwork] = useState<NetworkRestrictionsOut | null>(null)

  // Model Routes & LLM Retry Policy
  const [modelRoutes, setModelRoutes] = useState<Record<string, string>>({})
  const [savingRoutes, setSavingRoutes] = useState(false)
  const [retryPolicy, setRetryPolicy] = useState<LlmRetryPolicyOut | null>(null)
  const [savingRetry, setSavingRetry] = useState(false)

  // Editable sandbox form
  const [sbImage, setSbImage] = useState('')
  const [sbCpu, setSbCpu] = useState('4')
  const [sbMem, setSbMem] = useState('4096')
  const [sbTimeout, setSbTimeout] = useState('30')
  const [sbConcurrent, setSbConcurrent] = useState('1')
  const [sbMaxTurns, setSbMaxTurns] = useState('300')
  const [sbMode, setSbMode] = useState('standard')
  const [sbNetIsolated, setSbNetIsolated] = useState(false)
  const [sbAllowWrite, setSbAllowWrite] = useState(false)
  const [sbOffensive, setSbOffensive] = useState(false)
  const [savingSandbox, setSavingSandbox] = useState(false)

  // Notices
  const [noticeRule, setNoticeRule] = useState<NoticeRuleOut | null>(null)
  const [channels, setChannels] = useState<NotifyChannelOut[]>([])
  const [savingRule, setSavingRule] = useState(false)
  const [chKind, setChKind] = useState<'webhook' | 'slack' | 'email'>('webhook')
  const [chLabel, setChLabel] = useState('')
  const [chTarget, setChTarget] = useState('')
  const [addingChannel, setAddingChannel] = useState(false)
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null)

  // Retention & SLA
  const [retention, setRetention] = useState<ScanRetentionOut | null>(null)
  const [retArchive, setRetArchive] = useState('30')
  const [retTrash, setRetTrash] = useState('30')
  const [retArtifact, setRetArtifact] = useState('90')
  const [savingRetention, setSavingRetention] = useState(false)

  const [sla, setSla] = useState<FindingSlaOut | null>(null)
  const [slaCrit, setSlaCrit] = useState('3')
  const [slaHigh, setSlaHigh] = useState('7')
  const [slaMed, setSlaMed] = useState('30')
  const [slaLow, setSlaLow] = useState('90')
  const [slaInfo, setSlaInfo] = useState('0')
  const [slaStart, setSlaStart] = useState<'discovered' | 'confirmed'>('discovered')
  const [savingSla, setSavingSla] = useState(false)

  // Token creation
  const [tokenLabel, setTokenLabel] = useState('')
  const [tokenScopes, setTokenScopes] = useState<string[]>(['read'])
  const [createdPlaintext, setCreatedPlaintext] = useState<string | null>(null)
  const [creatingToken, setCreatingToken] = useState(false)

  // Password change
  const [curPw, setCurPw] = useState('')
  const [nextPw, setNextPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [changingPw, setChangingPw] = useState(false)

  const syncSandboxForm = (sb: SandboxOut) => {
    setSandbox(sb)
    setSbImage(sb.image)
    setSbCpu(String(sb.cpuLimit))
    setSbMem(String(sb.memoryLimitMb))
    setSbTimeout(String(sb.timeoutMinutes))
    setSbConcurrent(String(sb.maxConcurrentScans))
    setSbMaxTurns(String(sb.scanMaxTurns))
    setSbMode(sb.scanMode || 'standard')
    setSbNetIsolated(Boolean(sb.networkIsolated))
    setSbAllowWrite(Boolean(sb.allowVolumeWrite))
    setSbOffensive(Boolean(sb.enableOffensivePrompt))
  }

  const load = useCallback(async () => {
    try {
      const [snap, ret, slaCfg, netCfg, routesRes, retryRes] = await Promise.all([
        api.getSettingsSnapshot(),
        api.getScanRetention().catch(() => null),
        api.getFindingSla().catch(() => null),
        api.getNetworkRestrictions().catch(() => null),
        api.getModelRoutes().catch(() => ({ routes: {} })),
        api.getLlmRetry().catch(() => null),
      ])
      syncSandboxForm(snap.sandbox)
      setProviders(snap.accounts || [])
      setTokens(snap.tokens)
      setModelRoutes(routesRes.routes || {})
      if (retryRes) setRetryPolicy(retryRes)
      if (snap.notices) {
        setNoticeRule(snap.notices.rule)
        setChannels(snap.notices.channels)
      }
      if (ret) {
        setRetention(ret)
        setRetArchive(String(ret.archiveAfterDays))
        setRetTrash(String(ret.trashRetentionDays))
        setRetArtifact(String(ret.artifactRetentionDays))
      }
      if (slaCfg) {
        setSla(slaCfg)
        setSlaCrit(String(slaCfg.criticalDays))
        setSlaHigh(String(slaCfg.highDays))
        setSlaMed(String(slaCfg.mediumDays))
        setSlaLow(String(slaCfg.lowDays))
        setSlaInfo(String(slaCfg.infoDays))
        setSlaStart(slaCfg.startFrom)
      }
      if (netCfg) setNetwork(netCfg)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载设置失败', 'error')
    }
  }, [push])

  const runDeepChecks = useCallback(async () => {
    setChecking(true)
    try {
      const res = await api.getDeepHealth()
      setChecks(res)
    } catch {
      setChecks([])
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void load()
    void runDeepChecks()
  }, [load, runDeepChecks])

  const handleSaveSandbox = async (e: FormEvent) => {
    e.preventDefault()
    setSavingSandbox(true)
    try {
      const updated = await api.updateSandbox({
        image: sbImage.trim(),
        cpuLimit: Number(sbCpu) || 4,
        memoryLimitMb: Number(sbMem) || 4096,
        timeoutMinutes: Number(sbTimeout) || 30,
        networkIsolated: sbNetIsolated,
        allowVolumeWrite: sbAllowWrite,
        maxConcurrentScans: Number(sbConcurrent) || 1,
        scanMaxTurns: Number(sbMaxTurns) || 300,
        scanMode: sbMode,
        enableOffensivePrompt: sbOffensive,
      })
      syncSandboxForm(updated)
      push('沙箱与执行参数已保存，无需重启立即生效', 'success')
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '保存沙箱配置失败', 'error')
    } finally {
      setSavingSandbox(false)
    }
  }

  const handleSaveNoticeRule = async (e: FormEvent) => {
    e.preventDefault()
    if (!noticeRule) return
    setSavingRule(true)
    try {
      const updated = await api.updateNoticeRule({
        minSeverity: noticeRule.minSeverity,
        notifyOnScanComplete: noticeRule.notifyOnScanComplete,
        notifyOnCriticalImmediate: noticeRule.notifyOnCriticalImmediate,
      })
      setNoticeRule(updated)
      push('通知触发规则已保存', 'success')
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '保存通知规则失败', 'error')
    } finally {
      setSavingRule(false)
    }
  }

  const handleAddChannel = async (e: FormEvent) => {
    e.preventDefault()
    if (!chLabel.trim() || !chTarget.trim()) return
    setAddingChannel(true)
    try {
      const created = await api.createNoticeChannel({
        kind: chKind,
        label: chLabel.trim(),
        target: chTarget.trim(),
        enabled: true,
      })
      setChannels((prev) => [...prev, created])
      setChLabel('')
      setChTarget('')
      push('通知渠道已添加，可点击「测试」验证连通性', 'success')
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '新增通知渠道失败', 'error')
    } finally {
      setAddingChannel(false)
    }
  }

  const handleToggleChannel = async (ch: NotifyChannelOut) => {
    try {
      const updated = await api.updateNoticeChannel(ch.id, { enabled: !ch.enabled })
      setChannels((prev) => prev.map((item) => (item.id === ch.id ? updated : item)))
      push(updated.enabled ? '渠道已启用' : '渠道已停用', 'default')
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '更新渠道状态失败', 'error')
    }
  }

  const handleTestChannel = async (channelId: string) => {
    setTestingChannelId(channelId)
    try {
      const updated = await api.testNoticeChannel(channelId)
      setChannels((prev) => prev.map((item) => (item.id === channelId ? updated : item)))
      if (updated.verified) {
        push('测试通知发送成功，渠道已通过验证', 'success')
      } else {
        push(updated.verifyError || '测试通知发送失败', 'error')
      }
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '测试发送失败', 'error')
    } finally {
      setTestingChannelId(null)
    }
  }

  const handleDeleteChannel = async (channelId: string) => {
    try {
      await api.deleteNoticeChannel(channelId)
      setChannels((prev) => prev.filter((item) => item.id !== channelId))
      push('通知渠道已删除', 'default')
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '删除渠道失败', 'error')
    }
  }

  const handleSaveRetention = async (e: FormEvent) => {
    e.preventDefault()
    setSavingRetention(true)
    try {
      const updated = await api.updateScanRetention({
        archiveAfterDays: Math.max(0, Number(retArchive) || 0),
        trashRetentionDays: Math.max(0, Number(retTrash) || 0),
        artifactRetentionDays: Math.max(0, Number(retArtifact) || 0),
      })
      setRetention(updated)
      push('保留策略已保存并立即执行一次清理检查', 'success')
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '保存保留策略失败', 'error')
    } finally {
      setSavingRetention(false)
    }
  }

  const handleSaveSla = async (e: FormEvent) => {
    e.preventDefault()
    setSavingSla(true)
    try {
      const updated = await api.updateFindingSla({
        criticalDays: Math.max(0, Number(slaCrit) || 0),
        highDays: Math.max(0, Number(slaHigh) || 0),
        mediumDays: Math.max(0, Number(slaMed) || 0),
        lowDays: Math.max(0, Number(slaLow) || 0),
        infoDays: Math.max(0, Number(slaInfo) || 0),
        startFrom: slaStart,
      })
      setSla(updated)
      push('漏洞 SLA 时限已更新，所有未关闭漏洞已重算到期日', 'success')
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '保存 SLA 失败', 'error')
    } finally {
      setSavingSla(false)
    }
  }

  const handleSaveModelRoutes = async (e: FormEvent) => {
    e.preventDefault()
    setSavingRoutes(true)
    try {
      const cleaned: Record<string, string> = {}
      for (const [k, v] of Object.entries(modelRoutes)) {
        if (v.trim()) cleaned[k] = v.trim()
      }
      const saved = await api.updateModelRoutes(cleaned)
      setModelRoutes(saved.routes || {})
      push('按目标模型路由已保存，新发起扫描将按此策略自动选模', 'success')
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '保存模型路由失败', 'error')
    } finally {
      setSavingRoutes(false)
    }
  }

  const handleSaveLlmRetry = async (e: FormEvent) => {
    e.preventDefault()
    if (!retryPolicy) return
    setSavingRetry(true)
    try {
      const saved = await api.updateLlmRetry({
        connectRetries: Math.max(0, Math.min(10, Number(retryPolicy.connectRetries) || 0)),
        connectIntervalMs: Math.max(0, Math.min(30000, Number(retryPolicy.connectIntervalMs) || 0)),
        emptyRetries: Math.max(0, Math.min(10, Number(retryPolicy.emptyRetries) || 0)),
        emptyIntervalMs: Math.max(0, Math.min(30000, Number(retryPolicy.emptyIntervalMs) || 0)),
        streamRetries: Math.max(0, Math.min(10, Number(retryPolicy.streamRetries) || 0)),
        streamIntervalMs: Math.max(0, Math.min(30000, Number(retryPolicy.streamIntervalMs) || 0)),
        breakerFailures: Math.max(1, Math.min(100, Number(retryPolicy.breakerFailures) || 1)),
        breakerIntervalMs: Math.max(0, Math.min(30000, Number(retryPolicy.breakerIntervalMs) || 0)),
        breakerCooldownS: Math.max(1, Math.min(3600, Number(retryPolicy.breakerCooldownS) || 1)),
      })
      setRetryPolicy(saved)
      push('LLM 重试与熔断策略已保存并生效', 'success')
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '保存重试策略失败', 'error')
    } finally {
      setSavingRetry(false)
    }
  }

  const toggleScope = (s: string) => {
    setTokenScopes((prev) =>
      prev.includes(s) ? (prev.length > 1 ? prev.filter((x) => x !== s) : prev) : [...prev, s],
    )
  }

  const handleCreateToken = async (e: FormEvent) => {
    e.preventDefault()
    if (!tokenLabel.trim()) return
    setCreatingToken(true)
    try {
      const res = await api.createApiToken(tokenLabel.trim(), tokenScopes)
      setCreatedPlaintext(res.plaintext)
      setTokenLabel('')
      push('API 令牌已生成，请立即妥善保存明文', 'success')
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '创建令牌失败', 'error')
    } finally {
      setCreatingToken(false)
    }
  }

  const handleDeleteToken = async (id: string) => {
    try {
      await api.deleteApiToken(id)
      push('令牌已吊销', 'default')
      await load()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '吊销失败', 'error')
    }
  }

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (nextPw !== confirmPw) {
      push('两次输入的新口令不一致', 'error')
      return
    }
    setChangingPw(true)
    try {
      await api.changePassword(curPw, nextPw, confirmPw)
      push('管理员口令已更新，既有会话已失效，请使用新口令重新登录', 'success')
      setCurPw('')
      setNextPw('')
      setConfirmPw('')
      await refreshAuth()
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '修改口令失败', 'error')
    } finally {
      setChangingPw(false)
    }
  }

  const healthyCount = checks.filter(isCheckHealthy).length
  const sbMeta = sandbox ? sandboxStatusMeta(sandbox.status) : null

  return (
    <div>
      <PageHeader
        eyebrow="Platform Configuration"
        title="系统设置与运行健康"
        description="实时核验实例健康状态，热更新沙箱与执行参数、告警通知渠道、数据保留/SLA 策略及 API 令牌。"
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-6">
          {/* Deep Health */}
          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold text-ink">实例深度自检</h2>
                {checks.length > 0 && (
                  <Badge
                    className={
                      healthyCount === checks.length
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                    }
                  >
                    {healthyCount} / {checks.length} 正常
                  </Badge>
                )}
              </div>
              <Button size="sm" variant="secondary" loading={checking} onClick={() => void runDeepChecks()}>
                <RefreshCw className="h-3.5 w-3.5" />
                重新检测
              </Button>
            </div>
            <div className="mt-4 divide-y divide-line">
              {checks.length === 0 ? (
                <p className="py-4 text-xs text-ink-muted">暂无自检项输出</p>
              ) : (
                checks.map((c) => {
                  const ok = isCheckHealthy(c)
                  return (
                    <div key={c.name} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink">{CHECK_LABELS[c.name] || c.name}</span>
                          <span className="font-mono text-[10px] text-ink-muted">{c.name}</span>
                        </div>
                        {c.detail && (
                          <p className="mt-0.5 truncate font-mono text-[11px] text-ink-muted">{c.detail}</p>
                        )}
                      </div>
                      {ok ? (
                        <span className="inline-flex shrink-0 items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          正常
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 font-medium text-red-600 dark:text-red-400">
                          <XCircle className="h-3.5 w-3.5" />
                          异常
                        </span>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </Card>

          {/* Editable Sandbox Config */}
          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold text-ink">沙箱与执行参数</h2>
              </div>
              {sandbox && sbMeta && (
                <Badge className={sbMeta.className}>
                  {sandbox.engine} · {sbMeta.label}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-ink-secondary">
              修改后立即写入数据库并热生效（并发上限 2 秒内调度生效，回合与深度作用于后续新任务），无需重启后端。
            </p>

            {sandbox ? (
              <form onSubmit={handleSaveSandbox} className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="mb-1 block text-[11px] text-ink-muted">沙箱镜像</label>
                  <Input
                    value={sbImage}
                    onChange={(e) => setSbImage(e.target.value)}
                    placeholder="suvex/sandbox:1.4"
                    className="font-mono text-xs"
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="mb-1 block text-[11px] text-ink-muted">CPU (vCPU)</label>
                    <Input
                      type="number"
                      min={1}
                      max={64}
                      value={sbCpu}
                      onChange={(e) => setSbCpu(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-ink-muted">内存 (MB)</label>
                    <Input
                      type="number"
                      min={256}
                      max={65536}
                      step={256}
                      value={sbMem}
                      onChange={(e) => setSbMem(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-ink-muted">超时 (分钟)</label>
                    <Input
                      type="number"
                      min={1}
                      max={720}
                      value={sbTimeout}
                      onChange={(e) => setSbTimeout(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="mb-1 block text-[11px] text-ink-muted">最大并发 (1-8)</label>
                    <Input
                      type="number"
                      min={1}
                      max={8}
                      value={sbConcurrent}
                      onChange={(e) => setSbConcurrent(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-ink-muted">最大回合 (10-2000)</label>
                    <Input
                      type="number"
                      min={10}
                      max={2000}
                      value={sbMaxTurns}
                      onChange={(e) => setSbMaxTurns(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-ink-muted">扫描深度</label>
                    <Select
                      value={sbMode}
                      onChange={setSbMode}
                      options={[
                        { value: 'quick', label: 'quick（快速）' },
                        { value: 'standard', label: 'standard（标准）' },
                        { value: 'deep', label: 'deep（深度）' },
                      ]}
                    />
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-line bg-subtle/70 p-3">
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={sbNetIsolated}
                      onChange={(e) => setSbNetIsolated(e.target.checked)}
                    />
                    <span>
                      <span className="font-medium text-ink">容器断网隔离（networkIsolated）</span>
                      <span className="block text-[11px] text-ink-muted">
                        开启后沙箱禁止出网，仅适合纯本地代码/离线附件审计；外部靶机扫描请保持关闭。
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={sbAllowWrite}
                      onChange={(e) => setSbAllowWrite(e.target.checked)}
                    />
                    <span>
                      <span className="font-medium text-ink">允许挂载卷写入（allowVolumeWrite）</span>
                      <span className="block text-[11px] text-ink-muted">
                        高风险项：仅在确认挂载的目标代码目录可丢弃时开启。
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={sbOffensive}
                      onChange={(e) => setSbOffensive(e.target.checked)}
                    />
                    <span>
                      <span className="font-medium text-ink">启用增强越权与注入手法矩阵</span>
                      <span className="block text-[11px] text-ink-muted">
                        在授权渗透与 CTF 解题提示词中追加高级利用与绕过手法清单。
                      </span>
                    </span>
                  </label>
                </div>

                {network && (
                  <div className="rounded-lg border border-line bg-subtle/40 px-3 py-2 text-[11px] text-ink-muted">
                    <span className="font-medium text-ink">对话沙箱出站守卫：</span>
                    {network.guardEnabled ? '已启用' : '未启用（允许任意授权出站）'}
                    {' · '}
                    内置放行 {network.builtinHosts.length} 域名 / {network.builtinCidrs.length} 网段
                    {network.allowedHosts.length + network.allowedCidrs.length > 0 &&
                      ` · 额外放行 ${network.allowedHosts.length + network.allowedCidrs.length} 项`}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-ink-muted">
                    上次更新：{formatRelativeTime(sandbox.updatedAt)}
                  </span>
                  <Button type="submit" size="sm" variant="primary" loading={savingSandbox}>
                    <Save className="h-3.5 w-3.5" />
                    保存沙箱配置
                  </Button>
                </div>
              </form>
            ) : (
              <p className="mt-3 text-xs text-ink-muted">正在加载沙箱状态…</p>
            )}
          </Card>

          {/* Retention & SLA */}
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-ink">数据保留与漏洞 SLA</h2>
            </div>

            {retention && (
              <form onSubmit={handleSaveRetention} className="mt-4 space-y-2.5 border-b border-line pb-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink">扫描数据保留策略（天，0 = 不自动清理）</span>
                  {retention.lastSweepAt && (
                    <span className="text-[10px] text-ink-muted">
                      上次清理 {formatRelativeTime(retention.lastSweepAt)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="mb-1 block text-[11px] text-ink-muted">自动归档</label>
                    <Input
                      type="number"
                      min={0}
                      max={3650}
                      value={retArchive}
                      onChange={(e) => setRetArchive(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-ink-muted">回收站保留</label>
                    <Input
                      type="number"
                      min={0}
                      max={3650}
                      value={retTrash}
                      onChange={(e) => setRetTrash(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-ink-muted">产物目录保留</label>
                    <Input
                      type="number"
                      min={0}
                      max={3650}
                      value={retArtifact}
                      onChange={(e) => setRetArtifact(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" size="sm" variant="secondary" loading={savingRetention}>
                    保存并立即检查清理
                  </Button>
                </div>
              </form>
            )}

            {sla && (
              <form onSubmit={handleSaveSla} className="mt-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-ink">漏洞修复 SLA 时限（天，0 = 不限）</span>
                  <Select
                    className="w-40"
                    value={slaStart}
                    onChange={(v) => setSlaStart(v as 'discovered' | 'confirmed')}
                    options={[
                      { value: 'discovered', label: '自发现时刻起算' },
                      { value: 'confirmed', label: '自确认时刻起算' },
                    ]}
                  />
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    ['严重', slaCrit, setSlaCrit],
                    ['高危', slaHigh, setSlaHigh],
                    ['中危', slaMed, setSlaMed],
                    ['低危', slaLow, setSlaLow],
                    ['提示', slaInfo, setSlaInfo],
                  ].map(([label, val, setter]) => (
                    <div key={label as string}>
                      <label className="mb-1 block text-[11px] text-ink-muted">{label as string}</label>
                      <Input
                        type="number"
                        min={0}
                        max={3650}
                        value={val as string}
                        onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button type="submit" size="sm" variant="secondary" loading={savingSla}>
                    保存并重算 SLA
                  </Button>
                </div>
              </form>
            )}
          </Card>

          {/* Model Routes by Goal */}
          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold text-ink">按扫描目标模型路由</h2>
              </div>
              <Link to="/models" className="text-xs text-accent hover:underline">
                管理模型通道 →
              </Link>
            </div>
            <p className="mt-1 text-xs text-ink-secondary">
              为不同评估目标指定专用模型通道；未指定时自动回退至平台默认模型。
            </p>
            <form onSubmit={handleSaveModelRoutes} className="mt-4 space-y-3 text-xs">
              {ROUTE_GOALS.map((g) => (
                <div
                  key={g.key}
                  className="flex flex-col gap-1.5 rounded-lg border border-line bg-subtle/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{g.label}</p>
                    <p className="text-[11px] text-ink-muted">{g.desc}</p>
                  </div>
                  <Select
                    className="sm:w-56"
                    value={modelRoutes[g.key] || ''}
                    onChange={(v) => setModelRoutes((prev) => ({ ...prev, [g.key]: v }))}
                    options={[
                      { value: '', label: '跟随平台默认模型' },
                      ...providers.map((p) => ({
                        value: p.id,
                        label: `${p.label} (${p.model})`,
                      })),
                    ]}
                  />
                </div>
              ))}
              <div className="flex justify-end pt-1">
                <Button type="submit" size="sm" variant="secondary" loading={savingRoutes}>
                  <Save className="h-3.5 w-3.5" />
                  保存模型路由
                </Button>
              </div>
            </form>
          </Card>

          {/* LLM Retry & Circuit Breaker */}
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-ink">LLM 重试与熔断策略</h2>
            </div>
            <p className="mt-1 text-xs text-ink-secondary">
              控制建连异常（429/5xx）、空响应与流中断的分层重试次数与退避间隔，以及连续失败熔断冷却时长。
            </p>
            {retryPolicy ? (
              <form onSubmit={handleSaveLlmRetry} className="mt-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[11px] text-ink-muted">建连重试次数 (0-10)</label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={retryPolicy.connectRetries}
                      onChange={(e) =>
                        setRetryPolicy({ ...retryPolicy, connectRetries: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-ink-muted">建连退避基准 (ms)</label>
                    <Input
                      type="number"
                      min={0}
                      max={30000}
                      step={100}
                      value={retryPolicy.connectIntervalMs}
                      onChange={(e) =>
                        setRetryPolicy({ ...retryPolicy, connectIntervalMs: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-ink-muted">空响应重试 (0-10)</label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={retryPolicy.emptyRetries}
                      onChange={(e) =>
                        setRetryPolicy({ ...retryPolicy, emptyRetries: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-ink-muted">空响应间隔 (ms)</label>
                    <Input
                      type="number"
                      min={0}
                      max={30000}
                      step={100}
                      value={retryPolicy.emptyIntervalMs}
                      onChange={(e) =>
                        setRetryPolicy({ ...retryPolicy, emptyIntervalMs: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-ink-muted">流中断重试 (0-10)</label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={retryPolicy.streamRetries}
                      onChange={(e) =>
                        setRetryPolicy({ ...retryPolicy, streamRetries: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-ink-muted">流中断间隔 (ms)</label>
                    <Input
                      type="number"
                      min={0}
                      max={30000}
                      step={100}
                      value={retryPolicy.streamIntervalMs}
                      onChange={(e) =>
                        setRetryPolicy({ ...retryPolicy, streamIntervalMs: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-line bg-subtle/50 p-3">
                  <div>
                    <label className="mb-1 block text-[11px] text-ink-muted">连续失败熔断阈值 (1-100)</label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={retryPolicy.breakerFailures}
                      onChange={(e) =>
                        setRetryPolicy({ ...retryPolicy, breakerFailures: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-ink-muted">熔断冷却时间 (秒, 1-3600)</label>
                    <Input
                      type="number"
                      min={1}
                      max={3600}
                      value={retryPolicy.breakerCooldownS}
                      onChange={(e) =>
                        setRetryPolicy({ ...retryPolicy, breakerCooldownS: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <Button type="submit" size="sm" variant="secondary" loading={savingRetry}>
                    <Save className="h-3.5 w-3.5" />
                    保存重试策略
                  </Button>
                </div>
              </form>
            ) : (
              <p className="mt-3 text-xs text-ink-muted">正在加载重试策略…</p>
            )}
          </Card>

          {/* Clickable Quick Module Directory */}
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-ink">工作台模块直达</h2>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
              以下模块均已接入后端真实数据接口，点击任意标签即可跳转进入，或按 <code className="font-mono">⌘K</code> 快速切换。
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {QUICK_MODULES.map((mod) => (
                <Link
                  key={mod.to}
                  to={mod.to}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50/75 px-2.5 py-1 text-[11px] font-medium text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100/80 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-900/50"
                >
                  {mod.label}
                  <ArrowUpRight className="h-3 w-3 opacity-70" />
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column: Notifications, API Tokens & Password */}
        <div className="space-y-6 lg:col-span-6">
          {/* Notifications */}
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-ink">告警通知规则与渠道</h2>
            </div>
            <p className="mt-1 text-xs text-ink-secondary">
              支持 Webhook、Slack 与 SMTP 邮件真实推送；点击「测试」会实际发起一次探测通知并回写验证状态。
            </p>

            {noticeRule && (
              <form
                onSubmit={handleSaveNoticeRule}
                className="mt-4 space-y-2.5 rounded-lg border border-line bg-subtle/60 p-3 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ink">最低推送级别</span>
                  <Select
                    className="w-40"
                    value={noticeRule.minSeverity}
                    onChange={(v) =>
                      setNoticeRule({ ...noticeRule, minSeverity: v as Severity })
                    }
                    options={[
                      { value: 'critical', label: '严重 (critical)' },
                      { value: 'high', label: '高危 (high)' },
                      { value: 'medium', label: '中危 (medium)' },
                      { value: 'low', label: '低危 (low)' },
                      { value: 'info', label: '提示 (info)' },
                    ]}
                  />
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={noticeRule.notifyOnScanComplete}
                      onChange={(e) =>
                        setNoticeRule({ ...noticeRule, notifyOnScanComplete: e.target.checked })
                      }
                    />
                    <span>扫描完成时通知</span>
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={noticeRule.notifyOnCriticalImmediate}
                      onChange={(e) =>
                        setNoticeRule({
                          ...noticeRule,
                          notifyOnCriticalImmediate: e.target.checked,
                        })
                      }
                    />
                    <span>发现严重漏洞立即推送</span>
                  </label>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" size="sm" variant="secondary" loading={savingRule}>
                    保存规则
                  </Button>
                </div>
              </form>
            )}

            <form onSubmit={handleAddChannel} className="mt-4 space-y-2 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <Select
                  value={chKind}
                  onChange={(v) => setChKind(v as 'webhook' | 'slack' | 'email')}
                  options={[
                    { value: 'webhook', label: 'Webhook' },
                    { value: 'slack', label: 'Slack' },
                    { value: 'email', label: 'Email (SMTP)' },
                  ]}
                />
                <Input
                  className="col-span-2"
                  value={chLabel}
                  onChange={(e) => setChLabel(e.target.value)}
                  placeholder="渠道名称（例如：安全值班群）"
                  required
                />
              </div>
              <div className="flex gap-2">
                <Input
                  value={chTarget}
                  onChange={(e) => setChTarget(e.target.value)}
                  placeholder={
                    chKind === 'email'
                      ? '收件人邮箱（如 secops@example.com）'
                      : 'Webhook / Slack URL（https://…）'
                  }
                  required
                />
                <Button type="submit" variant="primary" loading={addingChannel}>
                  <Plus className="h-3.5 w-3.5" />
                  添加
                </Button>
              </div>
            </form>

            <div className="mt-4 divide-y divide-line">
              {channels.length === 0 ? (
                <p className="py-3 text-xs text-ink-muted">暂未配置通知渠道</p>
              ) : (
                channels.map((ch) => (
                  <div key={ch.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Badge>{ch.kind}</Badge>
                        <span className="truncate font-medium text-ink">{ch.label}</span>
                        {ch.verified ? (
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400">已验证</span>
                        ) : (
                          <span className="text-[10px] text-ink-muted">未验证</span>
                        )}
                        {!ch.enabled && <Badge>已停用</Badge>}
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-ink-muted">{ch.target}</p>
                      {ch.verifyError && (
                        <p className="mt-0.5 text-[10px] text-red-600 dark:text-red-400">{ch.verifyError}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={testingChannelId === ch.id}
                        onClick={() => void handleTestChannel(ch.id)}
                      >
                        <Send className="h-3 w-3" />
                        测试
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void handleToggleChannel(ch)}>
                        {ch.enabled ? '停用' : '启用'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void handleDeleteChannel(ch.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-ink-muted hover:text-red-600" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* API Tokens */}
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-ink">CI / 自动化 API 令牌</h2>
            </div>
            <p className="mt-1 text-xs text-ink-secondary">
              用于脚本或流水线通过 <code className="font-mono">Authorization: Bearer svx_…</code> 调用后端。
            </p>

            <form onSubmit={handleCreateToken} className="mt-4 space-y-3">
              <div className="flex gap-2">
                <Input
                  value={tokenLabel}
                  onChange={(e) => setTokenLabel(e.target.value)}
                  placeholder="令牌名称（例如：GitHub CI）"
                  required
                />
                <Button type="submit" variant="primary" loading={creatingToken}>
                  <Plus className="h-3.5 w-3.5" />
                  生成
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-ink-muted">权限范围：</span>
                {(['read', 'scan', 'admin'] as const).map((sc) => (
                  <label key={sc} className="inline-flex cursor-pointer items-center gap-1">
                    <input
                      type="checkbox"
                      checked={tokenScopes.includes(sc)}
                      onChange={() => toggleScope(sc)}
                    />
                    <span className="font-mono">{sc}</span>
                  </label>
                ))}
              </div>
            </form>

            {createdPlaintext && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/60">
                <p className="text-[11px] font-medium text-emerald-900 dark:text-emerald-200">
                  仅展示一次，请立即复制保存：
                </p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <code className="truncate font-mono text-xs text-emerald-950 dark:text-emerald-100">
                    {createdPlaintext}
                  </code>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      void navigator.clipboard.writeText(createdPlaintext)
                      push('已复制令牌明文', 'success')
                    }}
                  >
                    <Copy className="h-3 w-3" />
                    复制
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-4 divide-y divide-line">
              {tokens.length === 0 ? (
                <p className="py-3 text-xs text-ink-muted">暂无已签发令牌</p>
              ) : (
                tokens.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2.5 text-xs">
                    <div>
                      <span className="font-medium text-ink">{t.label}</span>
                      <span className="ml-2 font-mono text-[11px] text-ink-muted">
                        {t.prefix}… · {t.scopes.join(', ')}
                      </span>
                      <p className="text-[10px] text-ink-muted">
                        创建于 {formatRelativeTime(t.createdAt)}
                        {t.lastUsedAt ? ` · 最近使用 ${formatRelativeTime(t.lastUsedAt)}` : ''}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => void handleDeleteToken(t.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-ink-muted hover:text-red-600" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Password Change */}
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-ink">修改管理员口令</h2>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-muted">
              <Shield className="h-3 w-3 shrink-0" />
              更新口令会立即吊销全部既有登录会话，需用新口令重新登录。
            </p>
            <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
              <Input
                type="password"
                value={curPw}
                onChange={(e) => setCurPw(e.target.value)}
                placeholder="当前口令"
                required
              />
              <Input
                type="password"
                value={nextPw}
                onChange={(e) => setNextPw(e.target.value)}
                placeholder="新口令（至少 12 位，含大小写与数字）"
                required
              />
              <Input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="确认新口令"
                required
              />
              <Button type="submit" variant="primary" loading={changingPw}>
                更新口令
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
