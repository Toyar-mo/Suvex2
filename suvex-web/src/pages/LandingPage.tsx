import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Flag,
  Layers,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Terminal,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useTheme } from '@/lib/theme'
import { BrandMark } from '@/components/layout/AppShell'
import { Badge, Button, Card } from '@/components/ui/primitives'

export function LandingPage() {
  const { theme, toggleTheme } = useTheme()
  const [entryPath, setEntryPath] = useState('/login')
  const [entryLabel, setEntryLabel] = useState('进入工作台')
  const [apiVersion, setApiVersion] = useState<string | null>(null)

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

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* Top Editorial Header */}
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <BrandMark />
          <div className="flex items-center gap-2.5">
            {apiVersion && (
              <span className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[11px] text-ink-secondary sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                API v{apiVersion}
              </span>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg border border-line bg-surface p-2 text-ink-secondary transition-colors hover:border-line-strong hover:text-ink"
              aria-label="切换明暗主题"
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <Link to={entryPath}>
              <Button variant="primary" size="md">
                {entryLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="editorial-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-20 sm:pt-28">
          <div className="max-w-3xl">
            <Badge className="mb-6 border-line-strong bg-surface px-3 py-1 text-xs text-ink-secondary shadow-editorial">
              <Sparkles className="h-3 w-3 text-accent" />
              Suvex 第二代 · Editorial Studio 全新前端架构
            </Badge>

            <h1 className="text-4xl font-semibold leading-[1.12] tracking-[-0.035em] text-ink sm:text-6xl">
              自治安全测试，
              <br />
              <span className="text-ink-secondary">让每一条结论都有过程可追。</span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-secondary sm:text-lg">
              给它一个目标 —— Web 应用、代码仓库、裸 TCP 服务或 CTF 题目附件。
              Suvex 自主规划、在隔离沙箱中调用工具并验证复现，只交付真正经过确证的漏洞报告与题解。
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link to={entryPath}>
                <Button variant="primary" size="lg" className="h-11 px-5">
                  {entryLabel}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#architecture">
                <Button variant="secondary" size="lg" className="h-11 px-5">
                  了解核心机制
                </Button>
              </a>
            </div>
          </div>

          {/* Editorial Live Telemetry Preview Sheet */}
          <Card className="mt-14 overflow-hidden border-line-strong bg-surface shadow-elevated">
            <div className="flex items-center justify-between border-b border-line bg-subtle px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-stone-300 dark:bg-zinc-700" />
                <span className="h-2.5 w-2.5 rounded-full bg-stone-300 dark:bg-zinc-700" />
                <span className="h-2.5 w-2.5 rounded-full bg-stone-300 dark:bg-zinc-700" />
                <span className="ml-2 font-mono text-xs text-ink-muted">
                  suvex2 · autonomous execution ledger
                </span>
              </div>
              <Badge pulse className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
                实时事件流就绪
              </Badge>
            </div>

            <div className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
              <div className="p-6">
                <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
                  01 / 过程可见
                </p>
                <h3 className="mt-2 text-base font-semibold text-ink">SSE 实时推理与工具流</h3>
                <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                  每一次工具调用、推理思考与证据落袋都以流式帧实时推送到前端，支持断点补发与运行中插话纠偏。
                </p>
                <div className="mt-4 space-y-1.5 rounded-lg border border-line bg-subtle p-3 font-mono text-[11px] text-ink-secondary">
                  <div className="flex items-center justify-between">
                    <span className="text-accent">phase:recon</span>
                    <span className="text-ink-muted">0.4s</span>
                  </div>
                  <div className="truncate text-ink">run_shell → httpx -sc -title -td</div>
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>PoC 复现通过 · 已入库</span>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
                  02 / 证据分级
                </p>
                <h3 className="mt-2 text-base font-semibold text-ink">双轴研判，拒绝猜测</h3>
                <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                  将「证据强度（PoC 确证 / 启发式线索）」与「处置状态（待研判 → 已确认 → 已修复）」严格解耦。
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between rounded-lg border border-line bg-canvas px-3 py-2 text-xs">
                    <span className="font-medium text-ink">SQL 注入 · /api/orders</span>
                    <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
                      严重 · PoC 确证
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-line bg-canvas px-3 py-2 text-xs">
                    <span className="font-medium text-ink">越权导出 · /export</span>
                    <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:border-orange-900 dark:bg-orange-950/60 dark:text-orange-300">
                      高危 · 已确认
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
                  03 / 双入口同核
                </p>
                <h3 className="mt-2 text-base font-semibold text-ink">渗透评估 & CTF 夺旗</h3>
                <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                  同一套自治内核支持 `findVulns`、`captureFlag`、`verifyFix` 三档成功判据，自动产出报告或题解。
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-line bg-subtle p-3">
                    <ShieldCheck className="h-4 w-4 text-accent" />
                    <div className="mt-1.5 font-medium text-ink">渗透评估</div>
                    <div className="text-[11px] text-ink-muted">PoC · SARIF · SLA</div>
                  </div>
                  <div className="rounded-lg border border-line bg-subtle p-3">
                    <Flag className="h-4 w-4 text-accent" />
                    <div className="mt-1.5 font-medium text-ink">CTF 夺旗</div>
                    <div className="text-[11px] text-ink-muted">沙箱 · Flag · 题解</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Core Pillars */}
      <section id="architecture" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10 max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-muted">
            Architecture
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-ink sm:text-3xl">
            以工程克制重塑安全智能体工作台
          </h2>
        </div>

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
          ].map((item) => {
            const Icon = item.icon
            return (
              <Card key={item.title} className="p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-subtle text-ink">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-ink">{item.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">{item.desc}</p>
              </Card>
            )
          })}
        </div>
      </section>

      <footer className="border-t border-line py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-xs text-ink-muted sm:flex-row">
          <span>Suvex 2 · Autonomous Security Testing Platform</span>
          <span className="font-mono">Apache-2.0 · Editorial Studio UI</span>
        </div>
      </footer>
    </div>
  )
}
