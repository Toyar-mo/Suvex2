import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/cn'

type ToastTone = 'default' | 'success' | 'error'

interface ToastItem {
  id: string
  message: string
  tone: ToastTone
}

interface ToastContextValue {
  push: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const push = useCallback(
    (message: string, tone: ToastTone = 'default') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setItems((prev) => [...prev.slice(-3), { id, message, tone }])
      window.setTimeout(() => dismiss(id), 4200)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex max-w-sm flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-start gap-2.5 rounded-editorial border bg-surface px-3.5 py-2.5 text-sm shadow-elevated transition-all',
              item.tone === 'error'
                ? 'border-red-300 text-red-800 dark:border-red-900 dark:text-red-300'
                : item.tone === 'success'
                  ? 'border-emerald-300 text-emerald-900 dark:border-emerald-900 dark:text-emerald-300'
                  : 'border-line text-ink',
            )}
          >
            {item.tone === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : item.tone === 'error' ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            )}
            <span className="flex-1 leading-snug">{item.message}</span>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="rounded p-0.5 text-ink-muted hover:bg-wash hover:text-ink"
              aria-label="关闭通知"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
