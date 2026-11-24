import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Layers,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { formatRelativeTime, SCAN_STATUS_META } from '@/lib/format'
import type { AssetListOut, AssetOut, CoverageOut } from '@/types/api'
import {
  Badge,
  Button,
  Card,
  Drawer,
  EmptyState,
  Input,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

export function AssetsPage() {
  const { push } = useToast()
  const [data, setData] = useState<AssetListOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'high' | 'unverified'>('all')

  const [selectedAsset, setSelectedAsset] = useState<AssetOut | null>(null)
  const [coverage, setCoverage] = useState<CoverageOut | null>(null)
  const [loadingCov, setLoadingCov] = useState(false)

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
    setCoverage(null)
    setLoadingCov(true)
    try {
      const cov = await api.getAssetCoverage(asset.target)
      setCoverage(cov)
    } catch (err) {
      push(err instanceof ApiClientError ? err.message : '加载资产覆盖度失败', 'error')
    } finally {
      setLoadingCov(false)
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
        eyebrow="Asset Inventory & Coverage"
        title="资产总览"
        description="按目标视角审视测试可信度：识别存在未处置高危的资产，以及那些从未真正跑完或连续失败的盲区。"
        actions={
          <>
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
              description="发起任意目标的扫描任务后，系统会自动按归一化目标汇总资产覆盖度与历史状态。"
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

      {/* Coverage Drawer */}
      <Drawer
        open={Boolean(selectedAsset)}
        onClose={() => setSelectedAsset(null)}
        title="资产覆盖度审计"
        subtitle={selectedAsset?.target}
        widthClass="max-w-2xl"
      >
        {loadingCov ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
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
    </div>
  )
}
