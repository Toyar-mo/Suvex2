import { useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/cn'

function extractText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (node && typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: ReactNode } }).props
    return extractText(props?.children)
  }
  return ''
}

function CodeBlock({
  language,
  children,
}: {
  language: string
  children: ReactNode
}) {
  const [copied, setCopied] = useState(false)
  const rawText = extractText(children).replace(/\n$/, '')

  const handleCopy = () => {
    void navigator.clipboard?.writeText(rawText)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-line bg-subtle">
      <div className="flex items-center justify-between border-b border-line-subtle bg-wash/40 px-3 py-1.5 text-[11px]">
        <span className="font-mono font-medium uppercase tracking-wider text-ink-muted">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-ink-muted transition-colors hover:bg-wash hover:text-ink"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">已复制</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>复制</span>
            </>
          )}
        </button>
      </div>
      <pre className="!my-0 !rounded-none !border-0 !bg-transparent p-3.5 overflow-x-auto font-mono text-[12.5px] leading-relaxed text-ink">
        <code>{children}</code>
      </pre>
    </div>
  )
}

export function MarkdownView({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  return (
    <div className={cn('editorial-prose', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            // ReactMarkdown wraps fenced blocks in <pre><code className="language-xxx">...</code></pre>
            const child = Array.isArray(children) ? children[0] : children
            if (child && typeof child === 'object' && 'props' in child) {
              const codeProps = (child as { props?: { className?: string; children?: ReactNode } })
                .props
              const match = /language-([\w+-]+)/.exec(codeProps?.className || '')
              return (
                <CodeBlock language={match?.[1] || ''}>{codeProps?.children ?? children}</CodeBlock>
              )
            }
            return <CodeBlock language="">{children}</CodeBlock>
          },
          code({ className: codeClass, children, ...props }) {
            return (
              <code
                className={cn(
                  'break-all font-mono text-[0.84em] rounded px-1.5 py-0.5 bg-wash/70 text-ink border border-line-subtle',
                  codeClass,
                )}
                {...props}
              >
                {children}
              </code>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
