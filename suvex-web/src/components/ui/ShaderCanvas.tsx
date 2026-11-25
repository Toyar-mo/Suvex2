import { useEffect, useRef, type HTMLAttributes, type ReactNode } from 'react'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/cn'

/* --------------------------------------------------------------------------
   1. MeshAuroraShader — Zero-dependency WebGL liquid aurora + filmic dither
      Inspired by scrollshaders.com/components
   -------------------------------------------------------------------------- */

const VERT_SRC = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

const FRAG_SRC = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform float u_grain;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = rot * p * 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / max(u_res, vec2(1.0));
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);

  float t = u_time * 0.14;
  vec2 m = (u_mouse - 0.5) * 0.35;

  float q = fbm(p * 1.15 + vec2(t * 0.6, -t * 0.4) + m);
  float r = fbm(p * 1.45 + vec2(q * 1.6 + t * 0.35, -q * 1.2 + t * 0.25));
  float f = fbm(p * 1.1 + vec2(r * 1.35, q * 0.9));

  vec3 col = mix(u_c0, u_c1, smoothstep(0.18, 0.72, f));
  col = mix(col, u_c2, smoothstep(0.35, 0.85, r) * 0.78);
  col = mix(col, u_c3, smoothstep(0.55, 0.96, q * r * 1.45) * 0.62);

  // Soft vignette & subtle diagonal light ray
  float ray = smoothstep(0.2, 0.95, 1.0 - abs(uv.x * 0.75 + uv.y * 0.55 - 0.68));
  col += (u_c2 - u_c0) * ray * 0.08;

  // Fine filmic dither grain (prevents banding)
  float g = (hash(gl_FragCoord.xy + fract(u_time)) - 0.5) * u_grain;
  col = clamp(col + g, 0.0, 1.0);

  gl_FragColor = vec4(col, 1.0);
}
`

export type ShaderPalette = 'indigo' | 'ctf' | 'studio'

const DARK_PALETTES: Record<ShaderPalette, [number[], number[], number[], number[]]> = {
  indigo: [
    [0.055, 0.059, 0.082], // deep obsidian
    [0.145, 0.165, 0.365], // royal indigo
    [0.345, 0.275, 0.685], // editorial violet
    [0.145, 0.565, 0.685], // telemetry cyan
  ],
  ctf: [
    [0.052, 0.062, 0.082],
    [0.105, 0.255, 0.345], // cyber teal-indigo
    [0.325, 0.285, 0.725], // indigo pulse
    [0.125, 0.645, 0.505], // flag emerald
  ],
  studio: [
    [0.055, 0.058, 0.078],
    [0.165, 0.175, 0.295],
    [0.315, 0.295, 0.585],
    [0.445, 0.345, 0.645],
  ],
}

const LIGHT_PALETTES: Record<ShaderPalette, [number[], number[], number[], number[]]> = {
  indigo: [
    [0.980, 0.976, 0.968], // warm porcelain
    [0.935, 0.945, 0.992], // soft indigo mist
    [0.958, 0.935, 0.988], // delicate lavender
    [0.925, 0.968, 0.982], // airy sky
  ],
  ctf: [
    [0.980, 0.976, 0.968],
    [0.925, 0.968, 0.960],
    [0.932, 0.942, 0.992],
    [0.918, 0.976, 0.952],
  ],
  studio: [
    [0.982, 0.978, 0.970],
    [0.952, 0.944, 0.928],
    [0.938, 0.946, 0.990],
    [0.972, 0.948, 0.932],
  ],
}

export function MeshAuroraShader({
  palette = 'indigo',
  speed = 1,
  className,
}: {
  palette?: ShaderPalette
  speed?: number
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { theme } = useTheme()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let gl: WebGLRenderingContext | null = null
    try {
      gl = canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'low-power',
      })
    } catch {
      gl = null
    }
    if (!gl) return

    const compile = (type: number, src: string) => {
      const sh = gl!.createShader(type)
      if (!sh) return null
      gl!.shaderSource(sh, src)
      gl!.compileShader(sh)
      if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) {
        gl!.deleteShader(sh)
        return null
      }
      return sh
    }

    const vs = compile(gl.VERTEX_SHADER, VERT_SRC)
    const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC)
    if (!vs || !fs) return

    const prog = gl.createProgram()
    if (!prog) return
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    )
    const loc = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(prog, 'u_res')
    const uTime = gl.getUniformLocation(prog, 'u_time')
    const uMouse = gl.getUniformLocation(prog, 'u_mouse')
    const uC0 = gl.getUniformLocation(prog, 'u_c0')
    const uC1 = gl.getUniformLocation(prog, 'u_c1')
    const uC2 = gl.getUniformLocation(prog, 'u_c2')
    const uC3 = gl.getUniformLocation(prog, 'u_c3')
    const uGrain = gl.getUniformLocation(prog, 'u_grain')

    const colors = theme === 'dark' ? DARK_PALETTES[palette] : LIGHT_PALETTES[palette]
    gl.uniform3fv(uC0, colors[0])
    gl.uniform3fv(uC1, colors[1])
    gl.uniform3fv(uC2, colors[2])
    gl.uniform3fv(uC3, colors[3])
    gl.uniform1f(uGrain, theme === 'dark' ? 0.028 : 0.016)

    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 }
    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      mouse.tx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
      mouse.ty = Math.min(1, Math.max(0, 1 - (e.clientY - rect.top) / rect.height))
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      gl!.viewport(0, 0, w, h)
      gl!.uniform2f(uRes, w, h)
    }
    resize()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    ro?.observe(canvas)

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    let rafId = 0
    const start = performance.now()
    const render = (now: number) => {
      if (!document.hidden) {
        mouse.x += (mouse.tx - mouse.x) * 0.04
        mouse.y += (mouse.ty - mouse.y) * 0.04
        gl!.uniform2f(uMouse, mouse.x, mouse.y)
        gl!.uniform1f(uTime, ((now - start) / 1000) * speed)
        gl!.drawArrays(gl!.TRIANGLES, 0, 6)
      }
      if (!reducedMotion) {
        rafId = window.requestAnimationFrame(render)
      }
    }
    rafId = window.requestAnimationFrame(render)

    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('pointermove', onPointerMove)
      ro?.disconnect()
      gl?.deleteProgram(prog)
      gl?.deleteShader(vs)
      gl?.deleteShader(fs)
      gl?.deleteBuffer(buf)
    }
  }, [palette, speed, theme])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(
        'pointer-events-none h-full w-full block',
        theme === 'dark'
          ? 'bg-[radial-gradient(circle_at_25%_20%,rgba(99,102,241,0.22),transparent_55%),radial-gradient(circle_at_80%_75%,rgba(56,189,248,0.14),transparent_50%)]'
          : 'bg-[radial-gradient(circle_at_25%_20%,rgba(99,102,241,0.10),transparent_55%),radial-gradient(circle_at_80%_75%,rgba(139,92,246,0.08),transparent_50%)]',
        className,
      )}
    />
  )
}

/* --------------------------------------------------------------------------
   2. DotWarpCanvas — Interactive halftone / dot-ripple ambient canvas
   -------------------------------------------------------------------------- */

export function DotWarpCanvas({
  gap = 26,
  className,
}: {
  gap?: number
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { theme } = useTheme()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let ctx: CanvasRenderingContext2D | null = null
    try {
      ctx = canvas.getContext('2d')
    } catch {
      ctx = null
    }
    if (!ctx) return

    const pointer = { x: -9999, y: -9999, active: false }
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
      pointer.active =
        pointer.x >= -80 &&
        pointer.x <= rect.width + 80 &&
        pointer.y >= -80 &&
        pointer.y <= rect.height + 80
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    let width = 0
    let height = 0
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    ro?.observe(canvas)

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    let rafId = 0
    const draw = (now: number) => {
      if (!document.hidden && width > 0 && height > 0) {
        ctx!.clearRect(0, 0, width, height)
        const baseColor = theme === 'dark' ? '148, 163, 184' : '100, 116, 139'
        const accentColor = theme === 'dark' ? '129, 140, 248' : '79, 70, 229'
        const t = now * 0.0014
        const radius = 150

        for (let y = gap / 2; y < height; y += gap) {
          for (let x = gap / 2; x < width; x += gap) {
            let dx = 0
            let dy = 0
            let boost = 0
            if (pointer.active && !reducedMotion) {
              const vx = x - pointer.x
              const vy = y - pointer.y
              const dist = Math.hypot(vx, vy)
              if (dist < radius && dist > 0.01) {
                const f = 1 - dist / radius
                const wave = Math.sin(dist * 0.055 - t * 3.2) * 0.5 + 0.5
                const push = f * f * 7
                dx = (vx / dist) * push
                dy = (vy / dist) * push
                boost = f * (0.55 + 0.45 * wave)
              }
            }
            const r = 1.05 + boost * 1.45
            ctx!.beginPath()
            ctx!.arc(x + dx, y + dy, r, 0, Math.PI * 2)
            if (boost > 0.08) {
              ctx!.fillStyle = `rgba(${accentColor}, ${(0.22 + boost * 0.52).toFixed(3)})`
            } else {
              ctx!.fillStyle = `rgba(${baseColor}, ${theme === 'dark' ? '0.14' : '0.16'})`
            }
            ctx!.fill()
          }
        }
      }
      if (!reducedMotion) {
        rafId = window.requestAnimationFrame(draw)
      }
    }
    rafId = window.requestAnimationFrame(draw)

    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('pointermove', onMove)
      ro?.disconnect()
    }
  }, [gap, theme])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn('pointer-events-none block h-full w-full', className)}
    />
  )
}

/* --------------------------------------------------------------------------
   3. SpotlightCard — Cursor-reactive shader sheen & luminous 1px border
   -------------------------------------------------------------------------- */

export interface SpotlightCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  intensity?: 'subtle' | 'normal' | 'vivid'
}

export function SpotlightCard({
  children,
  intensity = 'normal',
  className,
  onPointerMove,
  ...rest
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (el) {
      const rect = el.getBoundingClientRect()
      el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`)
      el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`)
    }
    onPointerMove?.(e)
  }

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      data-spot-intensity={intensity}
      className={cn(
        'spotlight-card rounded-editorial border border-line bg-surface shadow-editorial transition-colors duration-200 hover:border-line-strong',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
