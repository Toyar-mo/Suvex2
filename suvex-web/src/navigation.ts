import {
  Activity,
  Cpu,
  Flag,
  MessagesSquare,
  Radar,
  ScanSearch,
  Settings2,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react'

export type NavGroupId = 'workspace' | 'config'

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
  { id: 'workspace', label: '核心工作台' },
  { id: 'config', label: '平台与模型' },
]

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'overview',
    path: '/overview',
    group: 'workspace',
    label: '总览',
    icon: Radar,
    blurb: '全局安全态势：运行中任务、实时事件流与待处理风险。',
  },
  {
    id: 'chat',
    path: '/chat',
    group: 'workspace',
    label: '对话工作台',
    shortLabel: '对话',
    icon: MessagesSquare,
    blurb: '直接与安全智能体协作：推理过程、工具调用、人工审批与文件工作区。',
    fillsViewport: true,
  },
  {
    id: 'scans',
    path: '/scans',
    group: 'workspace',
    label: '扫描任务',
    shortLabel: '扫描',
    icon: ScanSearch,
    blurb: '发起授权渗透评估、CTF 夺旗或修复复测，追踪全生命周期。',
  },
  {
    id: 'activity',
    path: '/activity',
    group: 'workspace',
    label: '智能体活动',
    shortLabel: '活动',
    icon: Activity,
    blurb: '基于 SSE 的毫秒级智能体推理与工具执行实时遥测流。',
    fillsViewport: true,
  },
  {
    id: 'findings',
    path: '/findings',
    group: 'workspace',
    label: '漏洞发现',
    shortLabel: '漏洞',
    icon: ShieldAlert,
    blurb: '按证据等级与处置状态研判漏洞、检阅 PoC 与修复建议。',
  },
  {
    id: 'ctf',
    path: '/ctf',
    group: 'workspace',
    label: 'CTF 夺旗',
    shortLabel: 'CTF',
    icon: Flag,
    blurb: '赛事同步、题板调度、独立沙箱自动解题、Flag 校验与题解交付。',
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
    blurb: '沙箱资源、API 令牌、账号安全与 Suvex 2 演进模块。',
  },
]

export const DEFAULT_WORKSPACE_PATH = '/overview'

export function isNavActive(item: NavItem, pathname: string) {
  return pathname === item.path || pathname.startsWith(`${item.path}/`)
}
