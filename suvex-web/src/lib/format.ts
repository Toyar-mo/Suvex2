import type { FindingStatus, ScanGoal, ScanStatus, Severity, SkillId, TargetKind, Verification } from '@/types/api'

export const SCAN_AUTH_STATEMENT = '我有权对此目标进行安全测试'

export const SEVERITY_META: Record<
  Severity,
  { label: string; badge: string; dot: string; rank: number }
> = {
  critical: {
    label: '严重',
    badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900/60',
    dot: 'bg-red-600',
    rank: 5,
  },
  high: {
    label: '高危',
    badge: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900/60',
    dot: 'bg-orange-500',
    rank: 4,
  },
  medium: {
    label: '中危',
    badge: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60',
    dot: 'bg-amber-500',
    rank: 3,
  },
  low: {
    label: '低危',
    badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/60',
    dot: 'bg-blue-500',
    rank: 2,
  },
  info: {
    label: '信息',
    badge: 'bg-stone-100 text-stone-600 border-stone-200 dark:bg-zinc-800/70 dark:text-zinc-300 dark:border-zinc-700',
    dot: 'bg-stone-400',
    rank: 1,
  },
}

export const SCAN_STATUS_META: Record<
  ScanStatus,
  { label: string; badge: string; pulse?: boolean }
> = {
  queued: {
    label: '排队中',
    badge: 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
  },
  running: {
    label: '运行中',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/70',
    pulse: true,
  },
  completed: {
    label: '已完成',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/60',
  },
  failed: {
    label: '失败',
    badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900/60',
  },
  aborted: {
    label: '已终止',
    badge: 'bg-stone-100 text-stone-500 border-stone-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800',
  },
}

export const FINDING_STATUS_META: Record<FindingStatus, { label: string; badge: string }> = {
  new: {
    label: '待研判',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-900',
  },
  confirmed: {
    label: '已确认',
    badge: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900',
  },
  fixed: {
    label: '已修复',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900',
  },
  closed: {
    label: '已关闭',
    badge: 'bg-stone-100 text-stone-600 border-stone-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
  },
  false_positive: {
    label: '误报',
    badge: 'bg-stone-100 text-stone-500 border-stone-200 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-800',
  },
}

export const VERIFICATION_META: Record<Verification, { label: string; tone: string }> = {
  verified: {
    label: 'PoC 确证',
    tone: 'text-emerald-700 dark:text-emerald-400',
  },
  partial: {
    label: '启发式线索',
    tone: 'text-amber-700 dark:text-amber-400',
  },
  none: {
    label: '未复现',
    tone: 'text-ink-muted',
  },
}

export const TARGET_KINDS: Array<{
  id: TargetKind
  label: string
  placeholder: string
  hint: string
  defaultSkills: SkillId[]
  skills: SkillId[]
}> = [
  {
    id: 'url',
    label: 'Web 应用 / URL',
    placeholder: 'https://target.example.com',
    hint: '已部署的网站或 Web API',
    defaultSkills: ['web', 'api'],
    skills: ['web', 'api', 'secrets', 'cloud'],
  },
  {
    id: 'repo',
    label: 'Git 代码仓库',
    placeholder: 'https://github.com/org/repo',
    hint: '远程代码库白盒审计',
    defaultSkills: ['web', 'dependencies', 'secrets'],
    skills: ['web', 'api', 'dependencies', 'secrets', 'container', 'cloud'],
  },
  {
    id: 'path',
    label: '本地目录路径',
    placeholder: '/workspace/app',
    hint: '宿主机/容器内代码目录',
    defaultSkills: ['web', 'secrets'],
    skills: ['web', 'api', 'dependencies', 'secrets', 'container', 'protocol'],
  },
  {
    id: 'service',
    label: '裸 TCP 服务',
    placeholder: '192.168.1.10:9999',
    hint: 'Pwn / 二进制网络协议 / Crypto 预言机',
    defaultSkills: ['protocol'],
    skills: ['protocol', 'container'],
  },
  {
    id: 'artifact',
    label: '纯附件题目',
    placeholder: '（可选填说明，无需地址）',
    hint: '仅上传 ELF / Pcap / 密文包即可启动',
    defaultSkills: ['protocol', 'secrets'],
    skills: ['protocol', 'web', 'secrets', 'dependencies'],
  },
]

export const SKILL_LABELS: Record<SkillId, string> = {
  web: 'Web 漏洞',
  api: 'API 接口',
  container: '容器安全',
  cloud: '云配置',
  dependencies: '依赖审计',
  secrets: '凭据泄露',
  protocol: '协议与二进制',
}

export const GOAL_META: Record<ScanGoal, { label: string; desc: string }> = {
  findVulns: { label: '渗透评估', desc: '发现并验证可复现漏洞，交付处置报告' },
  captureFlag: { label: 'CTF 夺旗', desc: '以获取 Flag 为唯一判据，自动整理题解' },
  verifyFix: { label: '修复复测', desc: '验证已知历史问题是否彻底修复' },
}

export const CTF_STATUS_META: Record<string, { label: string; badge: string }> = {
  unsolved: {
    label: '未解出',
    badge: 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
  },
  queued: {
    label: '排队中',
    badge: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900',
  },
  solving: {
    label: '解题中',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-900',
  },
  environment_ready: {
    label: '解题中 · 靶机就绪',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-900',
  },
  submitting: {
    label: '提交中',
    badge: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900',
  },
  candidate_ready: {
    label: '待交 Flag',
    badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900',
  },
  candidate: {
    label: '待交 Flag',
    badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900',
  },
  solved: {
    label: '已解出',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900',
  },
  failed: {
    label: '未成功',
    badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900',
  },
}

export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return iso
  const diff = Math.floor((Date.now() - t) / 1000)
  if (diff < 10) return '刚刚'
  if (diff < 60) return `${diff} 秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 86400 * 14) return `${Math.floor(diff / 86400)} 天前`
  return formatShortDate(iso)
}

export function formatShortDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatDuration(sec?: number | null): string {
  if (sec == null) return '进行中'
  if (sec < 60) return `${Math.round(sec)}s`
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString('zh-CN')
}

export function checkPasswordStrength(pw: string) {
  return {
    length: pw.length >= 12,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /\d/.test(pw),
    get ok() {
      return this.length && this.upper && this.lower && this.digit
    },
  }
}
