/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Geist Variable"',
          '"Noto Sans SC Variable"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        subtle: 'var(--bg-subtle)',
        wash: 'var(--bg-wash)',
        ink: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        line: {
          DEFAULT: 'var(--border-default)',
          strong: 'var(--border-strong)',
          subtle: 'var(--border-subtle)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
          ink: 'var(--accent-ink)',
        },
      },
      boxShadow: {
        editorial: 'var(--shadow-card)',
        elevated: 'var(--shadow-elevated)',
        dialog: 'var(--shadow-dialog)',
      },
      borderRadius: {
        editorial: '10px',
      },
    },
  },
  plugins: [],
}
