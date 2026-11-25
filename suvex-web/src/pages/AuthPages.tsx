import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Moon, Shield, Sun } from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { checkPasswordStrength } from '@/lib/format'
import { BrandMark } from '@/components/layout/AppShell'
import { Button, Input } from '@/components/ui/primitives'
import { DotWarpCanvas, MeshAuroraShader, SpotlightCard } from '@/components/ui/ShaderCanvas'
import { SuvexAppIcon } from '@/components/ui/AppIcons'
import { ScrollReveal } from '@/components/ui/MotionPrimitives'
import { cn } from '@/lib/cn'

function AuthCanvas({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-canvas px-4 py-8 text-ink">
      {/* Live WebGL Mesh Aurora + Cursor-Reactive Dot Matrix Backdrop */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <MeshAuroraShader palette="indigo" speed={0.85} className="opacity-100 dark:opacity-90" />
        <div className="absolute inset-0 opacity-80 dark:opacity-75">
          <DotWarpCanvas gap={30} />
        </div>
        <div className="fluted-glass absolute inset-0 opacity-35 dark:opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-canvas/10 via-transparent to-canvas/55 dark:from-canvas/30 dark:via-transparent dark:to-canvas/75" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between">
        <Link to="/">
          <BrandMark />
        </Link>
        <button
          type="button"
          onClick={(e) => toggleTheme(e)}
          className="rounded-lg border border-line bg-surface/80 p-2 text-ink-secondary backdrop-blur transition-all hover:border-line-strong hover:text-ink active:scale-90"
          aria-label="切换主题"
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
      </div>

      <main className="relative z-10 mx-auto my-10 w-full max-w-[432px]">
        <ScrollReveal>
          <SpotlightCard
            intensity="vivid"
            className="border-line-strong/80 bg-surface/92 p-7 shadow-dialog ring-1 ring-inset ring-white/85 backdrop-blur-xl dark:border-line-strong/70 dark:bg-surface/85 dark:ring-white/5"
          >
            <div className="mb-6">
              <div className="mb-4 inline-flex">
                <SuvexAppIcon size={48} animated />
              </div>
              <h1 className="text-xl font-semibold tracking-[-0.025em] text-ink">{title}</h1>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">{subtitle}</p>
            </div>
            {children}
          </SpotlightCard>
        </ScrollReveal>
      </main>

      <p className="relative z-10 text-center font-mono text-[11px] text-ink-muted">
        Suvex 2.1 · Autonomous Security Workbench · HttpOnly Session + SameSite=Strict
      </p>
    </div>
  )
}

export function LoginPage() {
  const { loading, initialized, user, setAuthenticatedUser } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && !initialized) return <Navigate to="/setup" replace />
  if (!loading && user) return <Navigate to="/overview" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await api.login(username.trim() || 'admin', password)
      setAuthenticatedUser(res.user)
      navigate('/overview', { replace: true })
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '登录失败，请检查账号或口令。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCanvas
      title="登录 Suvex 2"
      subtitle="使用管理员或操作员凭据进入安全智能体工作台。"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-secondary">用户名</label>
          <Input
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-secondary">口令</label>
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="输入登录口令"
            required
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </div>
        )}

        <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full">
          登录进入
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </AuthCanvas>
  )
}

export function SetupPage() {
  const { loading, initialized, user, setAuthenticatedUser } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && initialized && user) return <Navigate to="/overview" replace />
  if (!loading && initialized && !user) return <Navigate to="/login" replace />

  const strength = checkPasswordStrength(password)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!strength.ok) {
      setError('口令需满足全部四项强度要求。')
      return
    }
    if (password !== confirm) {
      setError('两次输入的口令不一致。')
      return
    }
    setSubmitting(true)
    try {
      const res = await api.setupAdmin(username.trim() || 'admin', password)
      setAuthenticatedUser(res.user)
      navigate('/overview', { replace: true })
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '初始化失败，请重试。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCanvas
      title="初始化 Suvex 2 实例"
      subtitle="首次启动需要创建唯一管理员账号。初始化完成后该入口会自动永久关闭。"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-secondary">管理员用户名</label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-secondary">设置强口令</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 12 位，含大小写字母与数字"
            required
          />
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
            {[
              { ok: strength.length, text: '至少 12 个字符' },
              { ok: strength.upper, text: '包含大写字母' },
              { ok: strength.lower, text: '包含小写字母' },
              { ok: strength.digit, text: '包含数字' },
            ].map((rule) => (
              <div
                key={rule.text}
                className={cn(
                  'flex items-center gap-1.5',
                  rule.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-ink-muted',
                )}
              >
                <Check className="h-3 w-3" />
                <span>{rule.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-secondary">确认口令</label>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="再次输入口令"
            required
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={submitting}
          disabled={!strength.ok || password !== confirm}
          className="w-full"
        >
          <Shield className="h-4 w-4" />
          创建管理员并进入工作台
        </Button>
      </form>
    </AuthCanvas>
  )
}
