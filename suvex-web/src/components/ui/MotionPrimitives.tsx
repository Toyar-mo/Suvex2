import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/* --------------------------------------------------------------------------
   Kinetic Scroll & Micro-Motion Primitives
   Inspired by scrolltide.co (restrained for daily security workbench use)
   -------------------------------------------------------------------------- */

export function ScrollProgressRail({ className }: { className?: string }) {
  const barRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const el = barRef.current
      if (!el) return
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      const ratio = max > 24 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      el.style.transform = `scaleX(${ratio})`
      el.style.opacity = ratio > 0.01 ? '1' : '0'
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

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed left-0 right-0 top-0 z-50 h-[2px] overflow-hidden',
        className,
      )}
    >
      <div
        ref={barRef}
        className="h-full w-full origin-left bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-400 transition-opacity duration-200"
        style={{ transform: 'scaleX(0)', opacity: 0 }}
      />
    </div>
  )
}

export function ScrollReveal({
  children,
  delayMs = 0,
  className,
}: {
  children: ReactNode
  delayMs?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return true
    return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  })

  useEffect(() => {
    if (visible) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { rootMargin: '0px 0px -30px 0px', threshold: 0.04 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [visible])

  return (
    <div
      ref={ref}
      style={{
        transitionDelay: visible && delayMs ? `${delayMs}ms` : '0ms',
      }}
      className={cn(
        'transition-[opacity,transform] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]',
        visible ? 'opacity-100' : 'translate-y-2.5 opacity-0',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function KineticNumber({
  value,
  decimals = 0,
  format,
  className,
}: {
  value: number
  decimals?: number
  format?: (n: number) => string
  className?: string
}) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)

  useEffect(() => {
    const from = prevRef.current
    const to = value
    prevRef.current = to
    if (
      from === to ||
      typeof window === 'undefined' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setDisplay(to)
      return
    }
    let raf = 0
    const duration = 520
    const start = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(from + (to - from) * eased)
      if (p < 1) raf = window.requestAnimationFrame(step)
    }
    raf = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(raf)
  }, [value])

  const rendered = format
    ? format(display)
    : decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString('zh-CN')

  return <span className={cn('tabular-nums', className)}>{rendered}</span>
}
