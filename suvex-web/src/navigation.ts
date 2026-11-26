import {
  Activity,
  AlarmClock,
  BookOpen,
  Bot,
  ClipboardCheck,
  Cpu,
  FileText,
  Flag,
  FolderOpen,
  GitBranch,
  KeyRound,
  Layers,
  MessagesSquare,
  Network,
  Radar,
  ScanSearch,
  ScrollText,
  Settings2,
  ShieldAlert,
  Siren,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export type NavGroupId = 'run' | 'output' | 'automation' | 'config'

export interface NavItem {
  id: string
  path: string
  group: NavGroupId
  label: string
  shortLabel?: string
  icon: LucideIcon
  blurb: string
  fillsViewport?: boolean
}

export const NAV_GROUPS: Array<{ id: NavGroupId; label: string }> = [
  { id: 'run', label: '运行与交互' },
  { id: 'output', label: '资产与产出' },
  { id: 'automation', label: '自动化与专项' },
  { id: 'config', label: '能力与治理' },
]

export const NAV_ITEMS: NavItem[] = [
  /* 运行与交互 */
  {
    id: 'overview',
    path: '/overview',
    group: 'run',
    label: '总览',
    icon: Radar,
    blurb: '全局安全态势：运行中任务、实时事件流与待处理风险。',
  },
  {
    id: 'chat',
    path: '/chat',
    group: 'run',
    label: '对话工作台',
    shortLabel: '对话',
    icon: MessagesSquare,
    blurb: '直接与安全智能体协作：推理过程、工具调用、人工审批与文件工作区。',
    fillsViewport: true,
  },
  {
    id: 'scans',
    path: '/scans',
    group: 'run',
    label: '扫描任务',
    shortLabel: '扫描',
    icon: ScanSearch,
    blurb: '发起授权渗透评估、CTF 夺旗或修复复测，追踪全生命周期。',
  },
  {
    id: 'missions',
    path: '/missions',
    group: 'run',
    label: '作战编排图',
    shortLabel: '作战',
    icon: GitBranch,
    blurb: '多智能体协同作战图：目标分解、行动意图调度与子智能体并行执行验收。',
  },
  {
    id: 'activity',
    path: '/activity',
    group: 'run',
    label: '智能体活动',
    shortLabel: '活动',
    icon: Activity,
    blurb: '基于 SSE 的毫秒级智能体推理与工具执行实时遥测流。',
    fillsViewport: true,
  },
  {
    id: 'intranet',
    path: '/intranet',
    group: 'run',
    label: '内网会话',
    shortLabel: '内网',
    icon: Network,
    blurb: '人工登记的内网立足点台账（Webshell / 反弹 / SSH），仅登记不自动连接。',
  },

  /* 资产与产出 */
  {
    id: 'findings',
    path: '/findings',
    group: 'output',
    label: '漏洞发现',
    shortLabel: '漏洞',
    icon: ShieldAlert,
    blurb: '按证据等级与处置状态研判漏洞、检阅 PoC 与修复建议。',
  },
  {
    id: 'assets',
    path: '/assets',
    group: 'output',
    label: '资产总览',
    shortLabel: '资产',
    icon: Layers,
    blurb: '目标台账与测试覆盖度：哪些目标测透了，哪些从未真正完成检测。',
  },
  {
    id: 'reports',
    path: '/reports',
    group: 'output',
    label: '交付报告',
    shortLabel: '报告',
    icon: FileText,
    blurb: '按扫描或目标组装可交付的安全报告，支持 Markdown / PDF 导出。',
  },
  {
    id: 'credentials',
    path: '/credentials',
    group: 'output',
    label: '凭据库',
    shortLabel: '凭据',
    icon: KeyRound,
    blurb: '扫描获取或登记的凭据台账：服务端加密、按需明文揭示与复用评估。',
  },
  {
    id: 'files',
    path: '/files',
    group: 'output',
    label: '文件管理',
    shortLabel: '文件',
    icon: FolderOpen,
    blurb: '跨对话检索智能体产出的脚本、取证包与报告，随时下载或清理。',
  },

  /* 自动化与专项 */
  {
    id: 'ctf',
    path: '/ctf',
    group: 'automation',
    label: 'CTF 夺旗',
    shortLabel: 'CTF',
    icon: Flag,
    blurb: '赛事同步、题板调度、独立沙箱自动解题、Flag 校验与题解交付。',
  },
  {
    id: 'ir',
    path: '/ir',
    group: 'automation',
    label: '应急响应',
    shortLabel: '应急',
    icon: Siren,
    blurb: '上传日志与取证证据包，由智能体自动还原入侵时间线并生成处置工单。',
  },
  {
    id: 'schedules',
    path: '/schedules',
    group: 'automation',
    label: '定时复查',
    shortLabel: '复查',
    icon: AlarmClock,
    blurb: '配置周期性自动复查计划，追踪下次执行时刻与连续失败告警。',
  },

  /* 能力与治理 */
  {
    id: 'tools',
    path: '/tools',
    group: 'config',
    label: '工具与 MCP',
    shortLabel: '工具',
    icon: Wrench,
    blurb: '三层能力边界：内置工具开关、外部 MCP 服务连接试连、沙箱命令配方探测。',
  },
  {
    id: 'skills',
    path: '/skills',
    group: 'config',
    label: '技能库',
    shortLabel: '技能',
    icon: BookOpen,
    blurb: '查看、编写与维护智能体速查技能正文，统计真实加载使用热度。',
  },
  {
    id: 'agents',
    path: '/agents',
    group: 'config',
    label: 'Agent 角色',
    shortLabel: 'Agent',
    icon: Bot,
    blurb: '管理内置与自定义智能体角色画像，配置工具、技能与 MCP 绑定。',
  },
  {
    id: 'approvals',
    path: '/approvals',
    group: 'config',
    label: '审批记录',
    shortLabel: '审批',
    icon: ClipboardCheck,
    blurb: '跨会话审计工具调用的待批、批准与拒绝留痕，支持集中快捷处置。',
  },
  {
    id: 'audit',
    path: '/audit',
    group: 'config',
    label: '审计日志',
    shortLabel: '审计',
    icon: ScrollText,
    blurb: '只追加安全操作留痕：扫描、Flag 提交、策略修改与合规取证导出。',
  },
  {
    id: 'models',
    path: '/models',
    group: 'config',
    label: '模型接入',
    shortLabel: '模型',
    icon: Cpu,
    blurb: '配置云端/本地大模型接入点、验证连通性与默认路由。',
  },
  {
    id: 'settings',
    path: '/settings',
    group: 'config',
    label: '系统设置',
    shortLabel: '设置',
    icon: Settings2,
    blurb: '沙箱资源、API 令牌、账号安全与实例深度健康自检。',
  },
]

export const DEFAULT_WORKSPACE_PATH = '/overview'

export function isNavActive(item: NavItem, pathname: string) {
  return pathname === item.path || pathname.startsWith(`${item.path}/`)
}
