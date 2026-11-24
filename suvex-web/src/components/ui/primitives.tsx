import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { Loader2, X } from 'lucide-react'
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
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-50',
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

/* Card */
export function Card({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-editorial border border-line bg-surface shadow-editorial',
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

/* Editorial Page Header */
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
  return (
    <header className="mb-7 flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-ink">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-ink-secondary">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/* Empty State */
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
    <div className="flex flex-col items-center justify-center rounded-editorial border border-dashed border-line-strong bg-subtle/40 px-6 py-14 text-center">
      {icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink-muted">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-medium text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-md text-xs text-ink-secondary">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
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
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 flex h-full w-full flex-col border-l border-line bg-canvas shadow-dialog',
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
            className="rounded-lg p-1.5 text-ink-muted hover:bg-wash hover:text-ink"
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
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/35 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-dialog',
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
            className="rounded-lg p-1.5 text-ink-muted hover:bg-wash hover:text-ink"
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
