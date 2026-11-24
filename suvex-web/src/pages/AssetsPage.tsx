import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Layers,
  Network,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { formatRelativeTime, SCAN_STATUS_META } from '@/lib/format'
import type {
  AssetListOut,
  AssetOut,
  CoverageOut,
  HoneypotScoreOut,
  SurfaceMapOut,
} from '@/types/api'
import {
  Badge,
  Button,
  Card,
  Drawer,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

function SurfaceTopologyGraph({ surface }: { surface: SurfaceMapOut }) {
  const nodes = surface.nodes.slice(0, 14)
  if (nodes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line p-6 text-center text-xs text-ink-muted">
        暂无攻击面拓扑节点（扫描完成后会自动聚合目标的端口、端点、组件与关系边）。
      </p>
    )
  }

  const width = 560
  const height = 280
  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(cx, cy) - 56

  const coords = new Map<string, { x: number; y: number }>()
  nodes.forEach((n, idx) => {
    const angle = (2 * Math.PI * idx) / nodes.length - Math.PI / 2
    coords.set(n.factKey, {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    })
  })

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-editorial border border-line bg-subtle/40 p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="mx-auto h-64 w-full max-w-[560px]">
          {/* Target Root Hub */}
          <circle cx={cx} cy={cy} r={22} className="fill-ink" />
          <text
            x={cx}
            y={cy + 3}
            textAnchor="middle"
            className="fill-canvas font-mono text-[9px] font-semibold"
          >
            TARGET
          </text>

          {/* Hub-to-node spokes */}
          {nodes.map((n) => {
            const pt = coords.get(n.factKey)!
            return (
              <line
                key={`spoke-${n.factKey}`}
                x1={cx}
                y1={cy}
                x2={pt.x}
                y2={pt.y}
                className="stroke-line-strong"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
            )
          })}

          {/* Semantic edges */}
          {surface.edges.map((e, i) => {
            const fromKey = e.from || e.from_ || ''
            const p1 = coords.get(fromKey)
            const p2 = coords.get(e.to)
            if (!p1 || !p2) return null
            return (
              <line
                key={`edge-${i}`}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                className="stroke-accent"
                strokeWidth={1.5}
                strokeOpacity={0.65}
              />
            )
          })}

          {/* Nodes */}
          {nodes.map((n) => {
            const pt = coords.get(n.factKey)!
            const short = n.factKey.length > 14 ? `${n.factKey.slice(0, 13)}…` : n.factKey
            return (
              <g key={n.factKey}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={10}
                  className="fill-surface stroke-accent"
                  strokeWidth={1.8}
                />
                <text
                  x={pt.x}
                  y={pt.y + 22}
                  textAnchor="middle"
                  className="fill-ink-secondary font-mono text-[9px]"
                >
                  {short}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {nodes.map((n) => (
          <div
            key={n.factKey}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono font-medium text-ink">{n.factKey}</span>
              <Badge className="text-[10px]">{n.category}</Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] text-ink-secondary">{n.summary}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AssetsPage() {
  const { push } = useToast()
  const [data, setData] = useState<AssetListOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'high' | 'unverified'>('all')

  const [selectedAsset, setSelectedAsset] = useState<AssetOut | null>(null)
  const [drawerTab, setDrawerTab] = useState<'coverage' | 'surface'>('coverage')
  const [coverage, setCoverage] = useState<CoverageOut | null>(null)
  const [surface, setSurface] = useState<SurfaceMapOut | null>(null)
  const [loadingCov, setLoadingCov] = useState(false)

  // Honeypot risk check modal
  const [hpOpen, setHpOpen] = useState(false)
  const [hpTitle, setHpTitle] = useState('')
  const [hpBanner, setHpBanner] = useState('')
  const [hpBody, setHpBody] = useState('')
  const [hpResult, setHpResult] = useState<HoneypotScoreOut | null>(null)
  const [scoringHp, setScoringHp] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listAssets(200)
      setData(res)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载资产总览失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [push])

  useEffect(() => {
    void load()
  }, [load])

  const openCoverage = async (asset: AssetOut) => {
    setSelectedAsset(asset)
    setDrawerTab('coverage')
    setCoverage(null)
    setSurface(null)
    setLoadingCov(true)
    try {
      const [cov, surf] = await Promise.all([
        api.getAssetCoverage(asset.target),
        api.getAssetSurface(asset.target).catch(() => null),
      ])
      setCoverage(cov)
      setSurface(surf)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载资产覆盖度失败', 'error')
    } finally {
      setLoadingCov(false)
    }
  }

  const handleScoreHoneypot = async (e: FormEvent) => {
    e.preventDefault()
    setScoringHp(true)
    try {
      const res = await api.scoreHoneypot({
        banner: hpBanner,
        title: hpTitle,
        headers: {},
        body: hpBody,
      })
      setHpResult(res)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '蜜罐特征评估失败', 'error')
    } finally {
      setScoringHp(false)
    }
  }

  const filtered = useMemo(() => {
    const list = data?.items || []
    const q = query.trim().toLowerCase()
    return list.filter((a) => {
      if (q && !a.target.toLowerCase().includes(q)) return false
      if (filterMode === 'high' && a.openCritical + a.openHigh === 0) return false
      if (filterMode === 'unverified' && a.lastCompletedAt != null) return false
      return true
    })
  }, [data, filterMode, query])

  const summary = data?.summary

  return (
    <div>
      <PageHeader
        eyebrow="Asset Inventory & Surface Topology"
        title="资产总览"
        description="按目标视角审视测试覆盖度与攻击面拓扑图，并内置蜜罐指纹研判工具。"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setHpOpen(true)}>
              <Bug className="h-3.5 w-3.5" />
              蜜罐研判
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </Button>
            <Link to="/scans?new=1">
              <Button variant="primary" size="sm">
                <Plus className="h-3.5 w-3.5" />
                扫描新资产
              </Button>
            </Link>
          </>
        }
      />

      {/* Summary Strip */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: '已纳管目标', value: summary?.targetCount ?? 0, sub: '去重后的唯一资产' },
          {
            label: '含未处置高危',
            value: summary?.targetsWithOpenHigh ?? 0,
            sub: `未关闭漏洞总计 ${summary?.openFindingCount ?? 0}`,
          },
          {
            label: '从未完成检测',
            value: summary?.neverCompleted ?? 0,
            sub: '存在“看似零漏洞”盲区风险',
          },
          {
            label: '累计发现漏洞',
            value: summary?.findingCount ?? 0,
            sub: `覆盖 ${summary?.targetCount ?? 0} 个目标`,
          },
        ].map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <p className="text-xs text-ink-secondary">{kpi.label}</p>
            <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-ink">
              {kpi.value}
            </p>
            <p className="mt-1 text-[11px] text-ink-muted">{kpi.sub}</p>
          </Card>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'all' as const, label: '全部资产' },
            { id: 'high' as const, label: '含未处置高危' },
            { id: 'unverified' as const, label: '从未完成检测' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                filterMode === tab.id
                  ? 'bg-ink text-canvas'
                  : 'border border-line bg-surface text-ink-secondary hover:bg-subtle',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索资产目标..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Asset List */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Layers className="h-5 w-5" />}
              title="暂无匹配的资产记录"
              description="发起任意目标的扫描任务后，系统会自动按归一化目标汇总资产覆盖度与攻击面拓扑。"
            />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {filtered.map((asset) => {
              const st = asset.lastScanStatus
                ? SCAN_STATUS_META[asset.lastScanStatus as keyof typeof SCAN_STATUS_META]
                : null
              const unreliable = !asset.lastCompletedAt || asset.consecutiveFailures >= 2
              return (
                <div
                  key={asset.target}
                  onClick={() => void openCoverage(asset)}
                  className="flex cursor-pointer flex-col gap-3 px-5 py-4 transition-colors hover:bg-subtle/60 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-mono text-sm font-semibold text-ink">
                        {asset.target}
                      </span>
                      {st && <Badge className={st.badge}>{st.label}</Badge>}
                      {unreliable && (
                        <Badge className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
                          <AlertTriangle className="h-3 w-3" />
                          {asset.consecutiveFailures >= 2
                            ? `连续失败 ${asset.consecutiveFailures} 次`
                            : '从未完成检测'}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-ink-muted">
                      累计扫描 {asset.scanCount} 次 · 最近扫描 {formatRelativeTime(asset.lastScanAt)} ·
                      最近成功 {formatRelativeTime(asset.lastCompletedAt)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3 font-mono text-xs tabular-nums">
                    {asset.openCritical > 0 && (
                      <Badge className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
                        严重 {asset.openCritical}
                      </Badge>
                    )}
                    {asset.openHigh > 0 && (
                      <Badge className="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/60 dark:text-orange-300">
                        高危 {asset.openHigh}
                      </Badge>
                    )}
                    <span className="text-ink-secondary">
                      待处置 {asset.openFindingCount} / 总计 {asset.findingCount}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Coverage & Surface Map Drawer */}
      <Drawer
        open={Boolean(selectedAsset)}
        onClose={() => setSelectedAsset(null)}
        title="资产覆盖度与攻击面拓扑"
        subtitle={selectedAsset?.target}
        widthClass="max-w-2xl"
      >
        <div className="mb-5 flex gap-1.5 border-b border-line pb-3">
          <button
            type="button"
            onClick={() => setDrawerTab('coverage')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium',
              drawerTab === 'coverage'
                ? 'bg-ink text-canvas'
                : 'border border-line bg-surface text-ink-secondary',
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            覆盖度审计
          </button>
          <button
            type="button"
            onClick={() => setDrawerTab('surface')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium',
              drawerTab === 'surface'
                ? 'bg-ink text-canvas'
                : 'border border-line bg-surface text-ink-secondary',
            )}
          >
            <Network className="h-3.5 w-3.5" />
            攻击面拓扑 ({surface?.nodes.length ?? 0})
          </button>
        </div>

        {loadingCov ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : drawerTab === 'surface' && surface ? (
          <SurfaceTopologyGraph surface={surface} />
        ) : (
          coverage && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4">
                  <p className="text-xs text-ink-muted">已测试验证面</p>
                  <p className="mt-1 font-mono text-2xl font-semibold text-ink">
                    {coverage.stats.tested}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-ink-muted">已明确排除项</p>
                  <p className="mt-1 font-mono text-2xl font-semibold text-ink">
                    {coverage.stats.ruledOut}
                  </p>
                </Card>
              </div>

              {coverage.gaps.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold text-ink">攻击面覆盖清单</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {coverage.gaps.map((g) => (
                      <div
                        key={g.key}
                        className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 text-xs"
                      >
                        <span className="text-ink">{g.label}</span>
                        {g.recorded ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            已覆盖
                          </span>
                        ) : (
                          <span className="text-ink-muted">未记录</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="mb-2 text-xs font-semibold text-ink">
                  已核实事实（{coverage.tested.length}）
                </h3>
                {coverage.tested.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-line p-4 text-center text-xs text-ink-muted">
                    暂无结构化覆盖度记录
                  </p>
                ) : (
                  <div className="space-y-2">
                    {coverage.tested.map((item) => (
                      <Card key={item.factKey} className="p-3.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-medium text-ink">{item.factKey}</span>
                          <Badge>{item.confidence}</Badge>
                        </div>
                        <p className="mt-1 text-ink-secondary">{item.summary}</p>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {selectedAsset && (
                <div className="flex justify-end border-t border-line pt-4">
                  <Link to={`/findings?q=${encodeURIComponent(selectedAsset.target)}`}>
                    <Button size="sm" variant="secondary">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      查看关联漏洞
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )
        )}
      </Drawer>

      {/* Honeypot Risk Modal */}
      <Modal
        open={hpOpen}
        onClose={() => setHpOpen(false)}
        title="蜜罐指纹研判工具"
        subtitle="输入可疑服务的 Banner、页面标题或响应体，匹配内置蜜罐签名库评估诱捕风险"
      >
        <form onSubmit={handleScoreHoneypot} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-secondary">页面标题 (Title)</label>
            <Input value={hpTitle} onChange={(e) => setHpTitle(e.target.value)} placeholder="例如：Cowrie / Kippo / HFish Login" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-secondary">服务 Banner</label>
            <Input value={hpBanner} onChange={(e) => setHpBanner(e.target.value)} placeholder="SSH-2.0-OpenSSH_6.0p1 Debian-4+deb7u2" className="font-mono" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-secondary">响应体片段</label>
            <Textarea rows={3} value={hpBody} onChange={(e) => setHpBody(e.target.value)} placeholder="粘贴 HTTP HTML 或 TCP 响应片段…" />
          </div>
          <Button type="submit" variant="primary" size="sm" loading={scoringHp}>
            立即评分
          </Button>

          {hpResult && (
            <Card className="mt-3 p-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink">研判结论：{hpResult.verdict}</span>
                <Badge className="font-mono">风险分 {hpResult.score.toFixed(2)}</Badge>
              </div>
              {hpResult.note && <p className="mt-1 text-ink-secondary">{hpResult.note}</p>}
              {hpResult.matches.length > 0 && (
                <div className="mt-2 space-y-1">
                  {hpResult.matches.map((m, i) => (
                    <div key={i} className="rounded bg-subtle px-2.5 py-1 font-mono text-[11px]">
                      [{m.category}] {m.matched} (conf {m.confidence})
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </form>
      </Modal>
    </div>
  )
}
