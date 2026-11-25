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
        canvas: 'rgb(var(--bg-canvas-rgb) / <alpha-value>)',
        surface: 'rgb(var(--bg-surface-rgb) / <alpha-value>)',
        subtle: 'rgb(var(--bg-subtle-rgb) / <alpha-value>)',
        wash: 'rgb(var(--bg-wash-rgb) / <alpha-value>)',
        ink: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        line: {
          DEFAULT: 'rgb(var(--border-default-rgb) / <alpha-value>)',
          strong: 'rgb(var(--border-strong-rgb) / <alpha-value>)',
          subtle: 'rgb(var(--border-subtle-rgb) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
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
