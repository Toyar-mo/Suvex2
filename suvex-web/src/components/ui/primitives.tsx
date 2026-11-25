import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { Check, ChevronDown, Loader2, X } from 'lucide-react'
import { NAV_ITEMS, isNavActive } from '@/navigation'
import { DotWarpCanvas, MeshAuroraShader } from '@/components/ui/ShaderCanvas'
import { MODULE_THEMES, ModuleTactileIcon } from '@/components/ui/AppIcons'
import { ScrollReveal } from '@/components/ui/MotionPrimitives'
import { cn } from '@/lib/cn'

/* Button */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' && 'h-8 px-2.5 text-xs',
        size === 'md' && 'h-9 px-3.5 text-sm',
        size === 'lg' && 'h-10 px-4 text-sm',
        variant === 'primary' &&
          'bg-ink text-canvas shadow-sm hover:opacity-90',
        variant === 'accent' &&
          'bg-accent text-white shadow-sm hover:opacity-95',
        variant === 'secondary' &&
          'border border-line bg-surface text-ink shadow-editorial hover:border-line-strong hover:bg-subtle',
        variant === 'ghost' &&
          'text-ink-secondary hover:bg-wash hover:text-ink',
        variant === 'danger' &&
          'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950',
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  )
}

/* Card (Cursor-reactive subtle spotlight across all workspace pages) */
export function Card({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`)
    el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`)
  }
  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      data-spot-intensity="subtle"
      className={cn(
        'spotlight-card rounded-editorial border border-line bg-surface shadow-editorial transition-colors duration-200 hover:border-accent/30 dark:hover:border-line-strong/80',
        className,
      )}
    >
      {children}
    </div>
  )
}

/* Badge */
export function Badge({
  className,
  pulse,
  children,
}: {
  className?: string
  pulse?: boolean
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight',
        className || 'border-line bg-subtle text-ink-secondary',
      )}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  )
}

/* Input & Textarea */
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:opacity-60',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:opacity-60',
        className,
      )}
      {...props}
    />
  )
}

/* Unified Editorial Select (Portal-backed, zero OS-native visual mismatch) */
export interface SelectOption {
  value: string
  label: string
  description?: string
  badge?: string
  disabled?: boolean
}

export interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  icon?: ReactNode
  size?: 'sm' | 'md'
  variant?: 'surface' | 'subtle'
  align?: 'left' | 'right'
  className?: string
  menuClassName?: string
  title?: string
  disabled?: boolean
}

export function Select({
  value,
  onChange,
  options,
  placeholder = '请选择',
  icon,
  size = 'md',
  variant = 'surface',
  align = 'left',
  className,
  menuClassName,
  title,
  disabled = false,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number; minWidth: number; maxHeight: number }>({
    top: 0,
    left: 0,
    minWidth: 160,
    maxHeight: 280,
  })

  const selected = options.find((opt) => opt.value === value) || null

  const updatePosition = () => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const gap = 6
    const estimatedHeight = Math.min(300, Math.max(88, options.length * 36 + 12))
    const spaceBelow = window.innerHeight - rect.bottom - 12
    const spaceAbove = rect.top - 12
    const openUpward = spaceBelow < Math.min(estimatedHeight, 180) && spaceAbove > spaceBelow
    const maxHeight = Math.max(120, Math.min(300, openUpward ? spaceAbove - gap : spaceBelow - gap))
    const minWidth = Math.max(rect.width, 168)
    let left = align === 'right' ? rect.right - minWidth : rect.left
    left = Math.max(8, Math.min(left, window.innerWidth - minWidth - 8))
    const top = openUpward
      ? Math.max(8, rect.top - gap - Math.min(estimatedHeight, maxHeight))
      : rect.bottom + gap
    setPos({ top, left, minWidth, maxHeight })
  }

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    const idx = options.findIndex((o) => o.value === value && !o.disabled)
    setActiveIndex(idx >= 0 ? idx : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options.length, align])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((prev) => {
          for (let step = 1; step <= options.length; step++) {
            const next = (prev + step) % options.length
            if (!options[next]?.disabled) return next
          }
          return prev
        })
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((prev) => {
          for (let step = 1; step <= options.length; step++) {
            const next = (prev - step + options.length) % options.length
            if (!options[next]?.disabled) return next
          }
          return prev
        })
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0 && options[activeIndex] && !options[activeIndex].disabled) {
          e.preventDefault()
          onChange(options[activeIndex].value)
          setOpen(false)
        }
      }
    }
    const onReposition = () => updatePosition()
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIndex, options, onChange])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        title={title}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center justify-between gap-2 rounded-lg border text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 disabled:pointer-events-none disabled:opacity-55',
          size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-xs',
          variant === 'subtle'
            ? 'border-line bg-subtle text-ink hover:border-line-strong'
            : 'border-line bg-surface text-ink shadow-editorial hover:border-line-strong',
          open && 'border-accent ring-2 ring-accent/15',
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {icon && <span className="shrink-0">{icon}</span>}
          <span className={cn('truncate', !selected && 'text-ink-muted')}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-ink-muted transition-transform duration-150',
            open && 'rotate-180 text-ink',
          )}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              minWidth: pos.minWidth,
              maxWidth: 'min(340px, calc(100vw - 16px))',
              maxHeight: pos.maxHeight,
            }}
            className={cn(
              'suvex-popover-in z-[80] overflow-y-auto rounded-xl border border-line bg-surface p-1 text-xs shadow-dialog backdrop-blur',
              menuClassName,
            )}
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-center text-[11px] text-ink-muted">暂无可选项</div>
            ) : (
              options.map((opt, idx) => {
                const isSelected = opt.value === value
                const isActive = idx === activeIndex
                return (
                  <button
                    key={`${opt.value}-${idx}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => {
                      if (opt.disabled) return
                      onChange(opt.value)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                      opt.disabled && 'cursor-not-allowed opacity-45',
                      isSelected
                        ? 'bg-accent-soft text-accent-ink font-medium'
                        : isActive
                          ? 'bg-wash text-ink'
                          : 'text-ink-secondary hover:bg-wash/70 hover:text-ink',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{opt.label}</span>
                        {opt.badge && (
                          <span className="shrink-0 rounded bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.description && (
                        <p className="mt-0.5 truncate text-[10px] font-normal text-ink-muted">
                          {opt.description}
                        </p>
                      )}
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
                  </button>
                )
              })
            )}
          </div>,
          document.body,
        )}
    </>
  )
}

/* Editorial Page Header (auto-attaches WebGL MeshAuroraShader + Soft-3D Module Icon) */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  const { pathname } = useLocation()
  const navItem = NAV_ITEMS.find((item) => isNavActive(item, pathname))
  const modTheme = (navItem && MODULE_THEMES[navItem.id]) || MODULE_THEMES.overview

  return (
    <ScrollReveal>
      <header className="relative mb-7 overflow-hidden rounded-2xl border border-line bg-surface px-6 py-5 shadow-elevated ring-1 ring-inset ring-white/80 dark:ring-white/5">
        {/* Ambient WebGL Mesh Aurora + Fluted Glass Backdrop */}
        <div className="pointer-events-none absolute inset-0 z-0 opacity-90 dark:opacity-75">
          <MeshAuroraShader palette={modTheme.shader} speed={0.7} />
          <div className="fluted-glass absolute inset-0 opacity-35 dark:opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-r from-surface/78 via-surface/48 to-surface/12 dark:from-surface/92 dark:via-surface/76 dark:to-surface/55" />
        </div>

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            {navItem && (
              <ModuleTactileIcon moduleId={navItem.id} icon={navItem.icon} size="md" className="mt-0.5" />
            )}
            <div className="min-w-0">
              {eyebrow && (
                <p className="mb-1 font-mono text-[11px] font-medium uppercase tracking-[0.13em] text-accent">
                  {eyebrow}
                </p>
              )}
              <h1 className="text-2xl font-semibold tracking-[-0.025em] text-ink">
                <span className="kinetic-gradient-text">{title}</span>
              </h1>
              {description && (
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-secondary sm:text-sm">
                  {description}
                </p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          )}
        </div>
      </header>
    </ScrollReveal>
  )
}

/* Empty State (with interactive DotWarp ambient backdrop) */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line-strong/85 bg-surface/85 px-6 py-14 text-center dark:bg-surface/60">
      <div className="pointer-events-none absolute inset-0 z-0 opacity-75 dark:opacity-55">
        <DotWarpCanvas gap={26} />
      </div>
      <div className="relative z-10 flex flex-col items-center">
        {icon && (
          <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-accent shadow-editorial">
            {icon}
          </div>
        )}
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {description && (
          <p className="mt-1.5 max-w-md text-xs leading-relaxed text-ink-secondary">{description}</p>
        )}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  )
}

/* Slide-Over Drawer / Modal */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  widthClass = 'max-w-xl',
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  widthClass?: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="suvex-backdrop-in fixed inset-0 bg-black/35 backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'suvex-drawer-in relative z-10 flex h-full w-full flex-col border-l border-line bg-canvas shadow-dialog',
          widthClass,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line bg-surface px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-[-0.015em] text-ink">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 truncate text-xs text-ink-secondary">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-wash hover:text-ink active:scale-90"
            aria-label="关闭抽屉"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  maxWidth?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="suvex-backdrop-in fixed inset-0 bg-black/38 backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'suvex-modal-in relative z-10 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-dialog',
          maxWidth,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold tracking-[-0.015em] text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-ink-secondary">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-wash hover:text-ink active:scale-90"
            aria-label="关闭弹窗"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}

/* Loading Skeleton */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-wash/80', className)} />
}
