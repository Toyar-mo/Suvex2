import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'

export type ThemeMode = 'light' | 'dark'

interface ThemeContextValue {
  theme: ThemeMode
  setTheme: (t: ThemeMode) => void
  toggleTheme: (e?: ReactMouseEvent | { clientX?: number; clientY?: number }) => void
}

const STORAGE_KEY = 'suvex2-theme'

const ThemeContext = createContext<ThemeContextValue | null>(null)

type DocWithViewTransition = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void> }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'dark' || saved === 'light') return saved
    } catch {
      // ignore
    }
    return 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // ignore
    }
  }, [theme])

  const setTheme = useCallback((t: ThemeMode) => setThemeState(t), [])

  const toggleTheme = useCallback(
    (e?: ReactMouseEvent | { clientX?: number; clientY?: number }) => {
      const next: ThemeMode = theme === 'light' ? 'dark' : 'light'
      const reducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

      const doc = document as DocWithViewTransition
      if (!reducedMotion && typeof doc.startViewTransition === 'function') {
        const x = typeof e?.clientX === 'number' ? e.clientX : window.innerWidth / 2
        const y = typeof e?.clientY === 'number' ? e.clientY : 48
        const maxRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y),
        )
        const transition = doc.startViewTransition(() => {
          document.documentElement.setAttribute('data-theme', next)
          setThemeState(next)
        })
        void transition.ready
          .then(() => {
            document.documentElement.animate(
              {
                clipPath: [
                  `circle(0px at ${x}px ${y}px)`,
                  `circle(${maxRadius}px at ${x}px ${y}px)`,
                ],
              },
              {
                duration: 460,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                pseudoElement: '::view-transition-new(root)',
              },
            )
          })
          .catch(() => {})
        return
      }

      // Graceful smooth color crossfade fallback
      document.documentElement.classList.add('theme-transitioning')
      setThemeState(next)
      window.setTimeout(() => {
        document.documentElement.classList.remove('theme-transitioning')
      }, 260)
    },
    [theme],
  )

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
