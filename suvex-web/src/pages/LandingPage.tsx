import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Cpu,
  Flag,
  Layers,
  Moon,
  Radio,
  ShieldCheck,
  Sparkles,
  Sun,
  Terminal,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useTheme } from '@/lib/theme'
import { prefetchRoute } from '@/lib/routePreload'
import { BrandMark } from '@/components/layout/AppShell'
import { Badge, Button } from '@/components/ui/primitives'
import {
  DotWarpCanvas,
  MeshAuroraShader,
  SpotlightCard,
  type ShaderPalette,
} from '@/components/ui/ShaderCanvas'
import { SuvexAppIcon, TactileAppIcon, type TactileIconVariant } from '@/components/ui/AppIcons'
import { KineticNumber, ScrollProgressRail, ScrollReveal } from '@/components/ui/MotionPrimitives'
import { cn } from '@/lib/cn'

/* --------------------------------------------------------------------------
   Scrollytelling Workflow Chapters (Scrolltide-style Pinned Narrative)
   -------------------------------------------------------------------------- */

interface StoryStage {
  step: string
  phase: string
  title: string
  subtitle: string
  icon: TactileIconVariant
  palette: ShaderPalette
  badge: string
  terminalLines: Array<{ tone: 'cmd' | 'ok' | 'info' | 'flag'; text: string }>
  metrics: Array<{ label: string; value: string }>
}

const STORY_STAGES: StoryStage[] = [
  {
    step: '01',
    phase: 'PHASE · RECON',
    title: '自主规划与攻击面测绘',
    subtitle:
      '输入 URL、代码仓库、裸 TCP 端口或 CTF 题目附件。智能体自动识别目标形态，挂载对应技能手册与远程 HTTP MCP，并在隔离沙箱内完成服务指纹、路由与入口资产测绘。',
    icon: 'overview',
    palette: 'indigo',
    badge: '105 篇内置技能自动路由',
    terminalLines: [
      { tone: 'cmd', text: '$ httpx -u https://target.local -sc -title -td -json' },
      { tone: 'info', text: '→ 识别 PHP 7.3 + Nginx + ImageMagick 6.9 / disable_functions 限制' },
      { tone: 'ok', text: '✓ 已同步 6 个题场 258 道赛题与 29 份附件至沙箱 /work/attachments' },
    ],
    metrics: [
      { label: '目标类型', value: '5 种全覆盖' },
      { label: '事件推送', value: '< 50ms' },
    ],
  },
  {
    step: '02',
    phase: 'PHASE · EXPLOIT',
    title: '隔离沙箱执行与实时协同',
    subtitle:
      '所有命令与脚本在独立 Docker 沙箱内运行，每一次工具调用、终端流与推理链实时推送到 EventBus。支持中途插话纠偏、高危动作人工审批以及跨页面断线无缝续接。',
    icon: 'ctf',
    palette: 'ctf',
    badge: '运行中可随时插话纠偏',
    terminalLines: [
      { tone: 'cmd', text: '$ mcp__ctf2-suvex__ctf2_start_environment --challenge Wallbreaker_Easy' },
      { tone: 'info', text: '→ 动态靶机已就绪：http://552d604458e11a.http-ctf2.dasctf.com:80' },
      { tone: 'cmd', text: '$ python3 /work/persist/exploit_imagick.py --delegate-rce' },
      { tone: 'ok', text: '✓ RCE 原语验证成功 · 已自动落盘 /work/persist/exploit_imagick.py' },
    ],
    metrics: [
      { label: '网络隔离', value: '独立容器网桥' },
      { label: '续接机制', value: 'Durable Turn' },
    ],
  },
  {
    step: '03',
    phase: 'PHASE · VERIFY',
    title: '双轴证据分级，拒绝幻觉猜测',
    subtitle:
      '将「证据强度（PoC 确证 / 启发式线索）」与「处置状态（待研判 → 已确认 → 已修复）」严格解耦。CTF 模式下支持 Safe 模式人工复核提交，保护不可再生提交额度。',
    icon: 'security',
    palette: 'studio',
    badge: 'PoC 复现通过方可标记确证',
    terminalLines: [
      { tone: 'cmd', text: '$ /readflag && verify_poc --strict' },
      { tone: 'flag', text: 'FLAG CAPTURED: CTF2{86c8eb62-8c65-4169-b7b6-46afb018ac87}' },
      { tone: 'ok', text: '✓ 证据链完整（请求 / 响应 / 截图 / 复现脚本）· 平台验真通过' },
    ],
    metrics: [
      { label: '证据模型', value: '双轴解耦' },
      { label: '提交守护', value: 'Safe / Auto' },
    ],
  },
  {
    step: '04',
    phase: 'PHASE · DELIVER',
    title: '一键交付报告、Writeup 与审计账本',
    subtitle:
      '任务结束后自动汇总漏洞修复建议、SARIF 扫描产物或结构化 CTF Writeup；完整对话与工具轨迹支持一键导出 JSONL 备审账本，让每一条结论经得起复盘。',
    icon: 'activity',
    palette: 'indigo',
    badge: '完整 JSONL + Writeup 留痕',
    terminalLines: [
      { tone: 'cmd', text: '$ suvex export --format writeup,sarif,jsonl' },
      { tone: 'ok', text: '✓ 已生成 reports/wallbreaker-writeup.md（含复现脚本与修复方案）' },
      { tone: 'ok', text: '✓ 已导出 session-audit.jsonl（146 条事件全量签名留痕）' },
    ],
    metrics: [
      { label: '交付格式', value: 'MD / SARIF / JSONL' },
      { label: '可追溯性', value: '100% 原始现场' },
    ],
  },
]

/* --------------------------------------------------------------------------
   Tactile App Icon Dock Data (design-playful-app-icons Showcase)
   -------------------------------------------------------------------------- */

interface ModuleShowcase {
  id: TactileIconVariant
  name: string
  en: string
  path: string
  tagline: string
  highlights: string[]
}

const MODULE_DOCK: ModuleShowcase[] = [
  {
    id: 'overview',
    name: '全局态势总览',
    en: 'Operations Briefing',
    path: '/overview',
    tagline: 'EventBus 实时时间轴、综合风险指数、质量评分卡与 Token 趋势一目了然。',
    highlights: ['实时推送时间轴', '风险态势分布', '7/30 天 Token 趋势'],
  },
  {
    id: 'chat',
    name: '对话工作台',
    en: 'Agent Studio',
    path: '/chat',
    tagline: '逐 token 流式思考、执行轨迹折叠、会话分组多选、分支 Fork 与断线自动续接。',
    highlights: ['CTF 题目吸顶驾驶舱', '工作区产物直下', '批量置顶/分组/归档'],
  },
  {
    id: 'ctf',
    name: 'CTF 夺旗工作台',
    en: 'Autonomous CTF Kernel',
    path: '/ctf',
    tagline: '原生挂载 CTF2 远程 HTTP MCP，按方向归类、多模型赛跑自动托管与一键交 Flag。',
    highlights: ['远程 HTTP MCP 拉题', '高分优先排优', '自动 Writeup 交付'],
  },
  {
    id: 'activity',
    name: '智能体活动流',
    en: 'Live Telemetry',
    path: '/activity',
    tagline: '事件流与 5 阶段泳道双视图，结构化展示每条命令、推理全文与实时人工线索注入。',
    highlights: ['结构化命令/输出卡片', '关键词检索与多展开', '运行中实时注入线索'],
  },
  {
    id: 'security',
    name: '漏洞与应急响应',
    en: 'Findings & IR',
    path: '/findings',
    tagline: '证据强度与处置状态双轴管理，支持本地日志取证包上传与完整复盘工单产出。',
    highlights: ['PoC 确证闭环', '本地证据包复盘', '定时复查调度'],
  },
  {
    id: 'mcp',
    name: '工具与 MCP 编排',
    en: 'Tools & MCP Bridge',
    path: '/tools',
    tagline: '统一管理 stdio 与远程 HTTP MCP Server、沙箱命令行配方探测与自定义 Agent 角色画像。',
    highlights: ['24+ CTF2 MCP 工具', '沙箱二进制探针', '角色工具白名单'],
  },
]

export function LandingPage() {
  const { theme, toggleTheme } = useTheme()
  const [entryPath, setEntryPath] = useState('/login')
  const [entryLabel, setEntryLabel] = useState('进入工作台')
  const [apiVersion, setApiVersion] = useState<string | null>(null)
  const [heroPalette, setHeroPalette] = useState<ShaderPalette>('indigo')
  const [activeStage, setActiveStage] = useState(0)
  const [activeModule, setActiveModule] = useState<TactileIconVariant>('overview')

  // Scroll-linked spatial transforms (Scrolltide-style kinetic hero & 3D ledger tilt)
  const ledgerRef = useRef<HTMLDivElement | null>(null)
  const heroCopyRef = useRef<HTMLDivElement | null>(null)
  const stageRefs = useRef<Array<HTMLDivElement | null>>([])

  useEffect(() => {
    api
      .getAuthState()
      .then((s) => {
        if (!s.initialized) {
          setEntryPath('/setup')
          setEntryLabel('初始化管理员')
        } else if (s.authenticated) {
          setEntryPath('/overview')
          setEntryLabel('返回工作台')
        } else {
          setEntryPath('/login')
          setEntryLabel('登录工作台')
        }
      })
      .catch(() => {
        setEntryPath('/login')
      })

    api
      .getHealth()
      .then((h) => setApiVersion(h.version))
      .catch(() => {})
  }, [])

  // Smooth scroll-linked hero parallax + 3D perspective flatten on ledger card
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }
    let raf = 0
    const update = () => {
      raf = 0
      const y = window.scrollY
      if (heroCopyRef.current) {
        const shift = Math.min(48, y * 0.12)
        const fade = Math.max(0.25, 1 - y / 700)
        heroCopyRef.current.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0)`
        heroCopyRef.current.style.opacity = String(fade)
      }
      if (ledgerRef.current) {
        const rect = ledgerRef.current.getBoundingClientRect()
        const vh = window.innerHeight || 800
        const progress = Math.min(1, Math.max(0, 1 - (rect.top - vh * 0.22) / (vh * 0.65)))
        const tiltX = (1 - progress) * 7.5
        const scale = 0.965 + progress * 0.035
        ledgerRef.current.style.transform = `perspective(1200px) rotateX(${tiltX.toFixed(2)}deg) scale(${scale.toFixed(4)})`
      }
    }
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  // Scrollytelling active chapter observer
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-stage-index'))
            if (!Number.isNaN(idx)) setActiveStage(idx)
          }
        }
      },
      { rootMargin: '-32% 0px -42% 0px', threshold: 0.1 },
    )
    for (const el of stageRefs.current) {
      if (el) obs.observe(el)
    }
    return () => obs.disconnect()
  }, [])

  const currentStage = STORY_STAGES[activeStage] || STORY_STAGES[0]
  const currentModule = MODULE_DOCK.find((m) => m.id === activeModule) || MODULE_DOCK[0]

  return (
    <div className="min-h-screen bg-canvas text-ink selection:bg-accent-soft selection:text-accent-ink">
      <ScrollProgressRail />

      {/* Top Editorial Floating Glass Header */}
      <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-7">
            <BrandMark />
            <nav className="hidden items-center gap-5 text-xs font-medium text-ink-secondary md:flex">
              <a href="#workflow" className="transition-colors hover:text-ink">
                工作流演练
              </a>
              <a href="#modules" className="transition-colors hover:text-ink">
                立体模块坞
              </a>
              <a href="#architecture" className="transition-colors hover:text-ink">
                核心架构
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            {apiVersion && (
              <span className="hidden items-center gap-1.5 rounded-full border border-line bg-surface/80 px-2.5 py-1 font-mono text-[11px] text-ink-secondary backdrop-blur sm:inline-flex">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                API v{apiVersion}
              </span>
            )}
            <button
              type="button"
              onClick={(e) => toggleTheme(e)}
              className="rounded-lg border border-line bg-surface/80 p-2 text-ink-secondary backdrop-blur transition-all hover:border-line-strong hover:text-ink active:scale-90"
              aria-label="切换明暗主题"
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <Link to={entryPath} onMouseEnter={() => prefetchRoute(entryPath)}>
              <Button variant="primary" size="md">
                {entryLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ====================================================================
          HERO: WebGL MeshAuroraShader + DotWarpCanvas + Scroll-Linked 3D Ledger
         ==================================================================== */}
      <section className="relative overflow-hidden border-b border-line">
        {/* Live WebGL Shader & Interactive Dot-Ripple Canvas */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <MeshAuroraShader palette={heroPalette} speed={0.85} className="opacity-100" />
          <div className="absolute inset-0 opacity-80 dark:opacity-70">
            <DotWarpCanvas gap={28} />
          </div>
          <div className="fluted-glass absolute inset-0 opacity-45 dark:opacity-35" />
          <div className="absolute inset-0 bg-gradient-to-b from-canvas/10 via-transparent to-canvas dark:from-canvas/35 dark:via-canvas/20 dark:to-canvas" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-16 sm:pt-24">
          {/* Top Row: Eyebrow + Interactive Shader Mood Switcher */}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <Badge className="border-line-strong/80 bg-surface/85 px-3 py-1 text-xs text-ink-secondary shadow-editorial backdrop-blur">
              <Sparkles className="h-3 w-3 text-accent" />
              Suvex 第二代 · Editorial Studio × WebGL Shader × 立体图标体系
            </Badge>

            <div className="flex items-center gap-1 rounded-full border border-line bg-surface/85 p-1 text-[11px] shadow-editorial backdrop-blur">
              <span className="px-2 font-mono text-[10px] text-ink-muted">Shader 光场</span>
              {(
                [
                  { id: 'indigo', label: '极光靛' },
                  { id: 'ctf', label: '青蓝脉冲' },
                  { id: 'studio', label: theme === 'light' ? '晨曦暖玉' : '暖曜石' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setHeroPalette(p.id)}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 font-medium transition-all',
                    heroPalette === p.id
                      ? 'bg-ink text-canvas shadow-sm'
                      : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Kinetic Hero Headline (Scroll-Linked Parallax) */}
          <div ref={heroCopyRef} className="max-w-4xl will-change-transform">
            <div className="mb-5 flex items-center gap-4">
              <SuvexAppIcon size={58} animated />
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                  <Radio className="h-3 w-3 animate-pulse" />
                  Autonomous Security Agent Platform
                </div>
                <p className="text-xs text-ink-secondary">
                  异步 EventBus · 远程 HTTP MCP · 隔离沙箱 · 过程全量留痕
                </p>
              </div>
            </div>

            <h1 className="text-4xl font-semibold leading-[1.1] tracking-[-0.038em] text-ink sm:text-6xl">
              自治安全测试，
              <br />
              <span className="kinetic-gradient-text">让每一条结论都有过程可追。</span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-secondary sm:text-lg">
              给它一个目标 —— Web 应用、代码仓库、裸 TCP 服务或 CTF 题目附件。
              Suvex 自主规划、在隔离沙箱中调用工具并验证复现，只交付真正经过确证的漏洞报告与题解。
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link to={entryPath}>
                <Button variant="primary" size="lg" className="h-11 px-6 shadow-elevated">
                  {entryLabel}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#workflow">
                <Button
                  variant="secondary"
                  size="lg"
                  className="h-11 bg-surface/80 px-5 backdrop-blur"
                >
                  沉浸式演练流程
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </a>
              <a href="#modules">
                <Button variant="ghost" size="lg" className="h-11 px-4">
                  探索立体模块坞
                </Button>
              </a>
            </div>
          </div>

          {/* Scroll-Driven 3D Perspective Telemetry Preview Sheet */}
          <div
            ref={ledgerRef}
            className="mt-14 origin-top will-change-transform transition-transform duration-75"
          >
            <SpotlightCard
              intensity="vivid"
              className="overflow-hidden border-line-strong/85 bg-surface/94 shadow-dialog ring-1 ring-inset ring-white/80 backdrop-blur-xl dark:bg-surface/90 dark:ring-white/5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-subtle/85 px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/85" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/85" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/85" />
                  <span className="ml-2 font-mono text-xs text-ink-muted">
                    suvex2 · autonomous execution ledger
                  </span>
                </div>
                <Badge
                  pulse
                  className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"
                >
                  EventBus 实时事件流就绪
                </Badge>
              </div>

              <div className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
                <div className="p-6">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-accent">
                    01 / 过程可见
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-ink">SSE 实时推理与工具流</h3>
                  <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                    每一次工具调用、推理思考与证据落袋都以流式帧实时推送到前端，支持断点补发与运行中插话纠偏。
                  </p>
                  <div className="mt-4 space-y-1.5 rounded-xl border border-slate-800/90 bg-[#0f121d] p-3 font-mono text-[11px] text-slate-300 shadow-inner dark:border-line dark:bg-canvas/90">
                    <div className="flex items-center justify-between">
                      <span className="text-indigo-400">phase:recon</span>
                      <span className="text-slate-500">0.4s</span>
                    </div>
                    <div className="truncate text-slate-100">$ httpx -sc -title -td</div>
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>PoC 复现通过 · 已入库</span>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-accent">
                    02 / 证据分级
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-ink">双轴研判，拒绝猜测</h3>
                  <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                    将「证据强度（PoC 确证 / 启发式线索）」与「处置状态（待研判 → 已确认 → 已修复）」严格解耦。
                  </p>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between rounded-xl border border-line bg-canvas/85 px-3 py-2 text-xs">
                      <span className="font-medium text-ink">SQL 注入 · /api/orders</span>
                      <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
                        严重 · PoC 确证
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-line bg-canvas/85 px-3 py-2 text-xs">
                      <span className="font-medium text-ink">越权导出 · /export</span>
                      <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:border-orange-900 dark:bg-orange-950/60 dark:text-orange-300">
                        高危 · 已确认
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-accent">
                    03 / 双入口同核
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-ink">渗透评估 & CTF 夺旗</h3>
                  <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                    同一套自治内核支持 `findVulns`、`captureFlag`、`verifyFix` 三档成功判据，自动产出报告或题解。
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
                    <div className="rounded-xl border border-line bg-canvas/85 p-3">
                      <ShieldCheck className="h-4 w-4 text-accent" />
                      <div className="mt-1.5 font-medium text-ink">渗透评估</div>
                      <div className="text-[11px] text-ink-muted">PoC · SARIF · SLA</div>
                    </div>
                    <div className="rounded-xl border border-line bg-canvas/85 p-3">
                      <Flag className="h-4 w-4 text-emerald-500" />
                      <div className="mt-1.5 font-medium text-ink">CTF 夺旗</div>
                      <div className="text-[11px] text-ink-muted">MCP · Flag · 题解</div>
                    </div>
                  </div>
                </div>
              </div>
            </SpotlightCard>
          </div>

          {/* Kinetic Telemetry Metrics Strip */}
          <ScrollReveal delayMs={80}>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { value: 20, suffix: '+', label: '工作台核心模块' },
                { value: 105, suffix: '', label: '内置安全技能手册' },
                { value: 24, suffix: '+', label: 'CTF2 远程 MCP 工具' },
                { value: 50, prefix: '< ', suffix: 'ms', label: 'EventBus 实时延迟' },
              ].map((stat) => (
                <SpotlightCard
                  key={stat.label}
                  intensity="subtle"
                  className="bg-surface/80 px-4 py-3.5 text-center backdrop-blur"
                >
                  <div className="font-mono text-2xl font-semibold text-ink">
                    {stat.prefix || ''}
                    <KineticNumber value={stat.value} />
                    {stat.suffix}
                  </div>
                  <div className="mt-1 text-[11px] text-ink-muted">{stat.label}</div>
                </SpotlightCard>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ====================================================================
          SECTION 2: Scrolltide-Style Sticky Scrollytelling Workflow
         ==================================================================== */}
      <section id="workflow" className="border-b border-line bg-subtle/70 py-24 dark:bg-subtle/40">
        <div className="mx-auto max-w-6xl px-6">
          <ScrollReveal>
            <div className="mb-14 max-w-2xl">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-accent">
                Scrollytelling · Autonomous Loop
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-ink sm:text-4xl">
                四阶段自治闭环，随滚动透视每一步现场
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                向下滚动或点击右侧章节，左侧实时遥测视窗会同步切换阶段状态、终端轨迹与确证产物。
              </p>
            </div>
          </ScrollReveal>

          <div className="grid items-start gap-10 lg:grid-cols-12">
            {/* Sticky Live Stage Viewport */}
            <div className="lg:sticky lg:top-24 lg:col-span-6">
              <SpotlightCard
                intensity="vivid"
                className="relative overflow-hidden border-line-strong/85 bg-surface shadow-dialog ring-1 ring-inset ring-white/80 dark:ring-white/5"
              >
                <div className="pointer-events-none absolute inset-0 z-0 opacity-85 dark:opacity-65">
                  <MeshAuroraShader palette={currentStage.palette} speed={0.8} />
                  <div className="fluted-glass absolute inset-0 opacity-25" />
                  <div className="absolute inset-0 bg-gradient-to-b from-surface/40 via-surface/82 to-surface dark:from-surface/65 dark:via-surface/88 dark:to-surface" />
                </div>

                <div className="relative z-10 p-6">
                  {/* Stage Progress Stepper */}
                  <div className="flex items-center justify-between gap-2 border-b border-line/90 pb-4">
                    <div className="flex items-center gap-3">
                      <TactileAppIcon variant={currentStage.icon} size={44} />
                      <div>
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                          {currentStage.phase}
                        </p>
                        <h3 className="text-base font-semibold text-ink">{currentStage.title}</h3>
                      </div>
                    </div>
                    <Badge className="shrink-0 border-accent/25 bg-surface/90 font-mono text-[10px] text-accent-ink shadow-sm dark:border-line dark:bg-subtle dark:text-ink-secondary">
                      {currentStage.step} / 04
                    </Badge>
                  </div>

                  {/* Step Indicator Dots */}
                  <div className="mt-4 flex gap-1.5">
                    {STORY_STAGES.map((st, idx) => (
                      <button
                        key={st.step}
                        type="button"
                        onClick={() => setActiveStage(idx)}
                        className={cn(
                          'h-1.5 flex-1 rounded-full transition-all duration-300',
                          idx === activeStage
                            ? 'bg-accent'
                            : idx < activeStage
                              ? 'bg-accent/40'
                              : 'bg-line-strong/70 dark:bg-line',
                        )}
                        aria-label={`切换到步骤 ${st.step}`}
                      />
                    ))}
                  </div>

                  {/* Simulated Live Telemetry Console (High-contrast Studio Terminal in both themes) */}
                  <div className="mt-5 overflow-hidden rounded-xl border border-slate-800/90 bg-[#0f121d] text-slate-200 shadow-elevated dark:border-line dark:bg-canvas/95">
                    <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-3.5 py-2 font-mono text-[10px] text-slate-400">
                      <span className="inline-flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-red-400/80" />
                          <span className="h-2 w-2 rounded-full bg-amber-400/80" />
                          <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
                        </span>
                        <Terminal className="h-3 w-3 text-indigo-400" />
                        sandbox://suvex-runtime/{currentStage.step}
                      </span>
                      <span className="text-emerald-400">
                        {currentStage.badge}
                      </span>
                    </div>
                    <div className="space-y-2 p-4 font-mono text-[11.5px] leading-relaxed">
                      {currentStage.terminalLines.map((line, i) => (
                        <div
                          key={`${currentStage.step}-${i}`}
                          className={cn(
                            'break-all rounded-md px-2.5 py-1.5 transition-all',
                            line.tone === 'cmd' && 'bg-white/[0.06] text-slate-100',
                            line.tone === 'info' && 'text-slate-300',
                            line.tone === 'ok' && 'text-emerald-400',
                            line.tone === 'flag' &&
                              'border border-emerald-400/45 bg-emerald-500/15 font-semibold text-emerald-300',
                          )}
                        >
                          {line.text}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Stage Mini Metrics */}
                  <div className="mt-4 grid grid-cols-2 gap-2.5">
                    {currentStage.metrics.map((m) => (
                      <div
                        key={m.label}
                        className="rounded-xl border border-line bg-subtle/75 px-3.5 py-2.5 dark:border-line-subtle dark:bg-subtle/60"
                      >
                        <div className="text-[10px] text-ink-muted">{m.label}</div>
                        <div className="mt-0.5 font-mono text-xs font-semibold text-ink">
                          {m.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </SpotlightCard>
            </div>

            {/* Right Column: Scrollable Narrative Chapters */}
            <div className="space-y-5 lg:col-span-6">
              {STORY_STAGES.map((stage, idx) => {
                const isActive = idx === activeStage
                return (
                  <div
                    key={stage.step}
                    ref={(el) => {
                      stageRefs.current[idx] = el
                    }}
                    data-stage-index={idx}
                    onClick={() => setActiveStage(idx)}
                    className={cn(
                      'cursor-pointer rounded-2xl border p-6 transition-all duration-300',
                      isActive
                        ? 'border-accent/65 bg-surface shadow-elevated ring-2 ring-accent/15 dark:border-accent/70 dark:ring-1 dark:ring-accent/25'
                        : 'border-line bg-surface/90 shadow-editorial hover:border-accent/40 hover:bg-surface dark:bg-surface/55 dark:opacity-75 dark:hover:border-line-strong dark:hover:opacity-100',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-accent">
                        STEP {stage.step} · {stage.phase}
                      </span>
                      {isActive && (
                        <Badge pulse className="border-accent/40 bg-accent-soft text-accent-ink">
                          当前演示
                        </Badge>
                      )}
                    </div>
                    <h3 className="mt-2.5 text-lg font-semibold tracking-[-0.02em] text-ink">
                      {stage.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                      {stage.subtitle}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECTION 3: Playful Soft-3D Tactile App Icon Dock
         ==================================================================== */}
      <section id="modules" className="border-b border-line py-24">
        <div className="mx-auto max-w-6xl px-6">
          <ScrollReveal>
            <div className="mx-auto max-w-2xl text-center">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-accent">
                Tactile App Icons · Modular Workbench
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-ink sm:text-4xl">
                软 3D 立体图标坞，一键直达六大核心工作面
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                遵循高识别度软 3D 拟物圆角图标规范，点击或悬浮任意模块图标预览核心能力与直达入口。
              </p>
            </div>
          </ScrollReveal>

          {/* Interactive Icon Dock */}
          <ScrollReveal delayMs={80}>
            <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-3 rounded-2xl border border-line bg-surface/95 p-4 shadow-elevated ring-1 ring-inset ring-white/80 backdrop-blur dark:bg-surface/85 dark:ring-white/5">
              {MODULE_DOCK.map((mod) => {
                const selected = mod.id === activeModule
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onMouseEnter={() => setActiveModule(mod.id)}
                    onClick={() => setActiveModule(mod.id)}
                    className={cn(
                      'group flex flex-col items-center gap-2 rounded-xl px-3.5 py-3 transition-all duration-200',
                      selected
                        ? '-translate-y-1 bg-accent-soft/75 shadow-editorial ring-1 ring-accent/40 dark:bg-subtle'
                        : 'hover:-translate-y-1 hover:bg-subtle/75',
                    )}
                  >
                    <TactileAppIcon
                      variant={mod.id}
                      size={48}
                      className={cn(selected && 'scale-105')}
                    />
                    <span
                      className={cn(
                        'text-[11px] font-medium transition-colors',
                        selected ? 'text-ink' : 'text-ink-muted group-hover:text-ink',
                      )}
                    >
                      {mod.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </ScrollReveal>

          {/* Selected Module Spotlight Showcase */}
          <ScrollReveal delayMs={140}>
            <SpotlightCard
              intensity="vivid"
              className="mx-auto mt-6 max-w-3xl border-line-strong/70 bg-surface p-6 shadow-elevated"
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <TactileAppIcon variant={currentModule.id} size={52} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-ink">{currentModule.name}</h3>
                      <span className="font-mono text-[11px] text-ink-muted">
                        {currentModule.en}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                      {currentModule.tagline}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {currentModule.highlights.map((h) => (
                        <Badge key={h} className="border-line bg-subtle text-[11px] text-ink">
                          <CheckCircle2 className="h-3 w-3 text-accent" />
                          {h}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <Link to={entryPath === '/overview' ? currentModule.path : entryPath} className="shrink-0">
                  <Button variant="primary" size="sm" className="whitespace-nowrap">
                    前往体验
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </SpotlightCard>
          </ScrollReveal>
        </div>
      </section>

      {/* ====================================================================
          SECTION 4: Architecture Bento Grid (SpotlightCards + ScrollReveal)
         ==================================================================== */}
      <section id="architecture" className="mx-auto max-w-6xl px-6 py-24">
        <ScrollReveal>
          <div className="mb-10 max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-accent">
              Architecture
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-ink sm:text-3xl">
              以工程克制重塑安全智能体工作台
            </h2>
          </div>
        </ScrollReveal>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Activity,
              title: '执行全程留痕',
              desc: '每一次工具参数、输出与模型推理持久化落库，任何结论都可回溯至原始现场。',
            },
            {
              icon: Terminal,
              title: '对话即工作台',
              desc: '逐 token 流式响应、运行中插话纠偏、高危动作人工审批，像结对专家一样协同。',
            },
            {
              icon: ShieldCheck,
              title: '逐字授权边界',
              desc: '所有主动发包扫描均强制记录授权声明、来源与时间戳，默认独立沙箱网络隔离。',
            },
            {
              icon: Layers,
              title: '独立部署隔离',
              desc: 'Suvex 2 独立前端工程、独立后端 API 与独立数据库实例，清晰演进互不干扰。',
            },
          ].map((item, idx) => {
            const Icon = item.icon
            return (
              <ScrollReveal key={item.title} delayMs={idx * 65}>
                <SpotlightCard className="h-full p-5 transition-transform duration-200 hover:-translate-y-0.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-subtle text-accent shadow-editorial">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-ink">{item.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">{item.desc}</p>
                </SpotlightCard>
              </ScrollReveal>
            )
          })}
        </div>

        {/* Closing Shader CTA Banner */}
        <ScrollReveal delayMs={100}>
          <div className="relative mt-16 overflow-hidden rounded-2xl border border-line-strong/85 bg-surface p-8 shadow-dialog ring-1 ring-inset ring-white/80 dark:ring-white/5 sm:p-10">
            <div className="pointer-events-none absolute inset-0 z-0 opacity-95 dark:opacity-85">
              <MeshAuroraShader palette="ctf" speed={0.7} />
              <div className="fluted-glass absolute inset-0 opacity-30" />
              <div className="absolute inset-0 bg-gradient-to-r from-surface/72 via-surface/46 to-surface/14 dark:from-surface/90 dark:via-surface/75 dark:to-surface/60" />
            </div>
            <div className="relative z-10 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <SuvexAppIcon size={56} animated />
                <div>
                  <div className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-accent">
                    <Cpu className="h-3.5 w-3.5" />
                    Ready for Autonomous Operations
                  </div>
                  <h3 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-ink sm:text-2xl">
                    准备好启动下一次安全评估或 CTF 夺旗了吗？
                  </h3>
                </div>
              </div>
              <Link to={entryPath} className="shrink-0">
                <Button variant="primary" size="lg" className="h-11 px-6 shadow-elevated">
                  {entryLabel}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </section>

      <footer className="border-t border-line py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-xs text-ink-muted sm:flex-row">
          <span>Suvex 2.1 · Autonomous Security Testing Platform</span>
          <span className="font-mono">Apache-2.0 · Editorial Studio × WebGL Shaders</span>
        </div>
      </footer>
    </div>
  )
}
