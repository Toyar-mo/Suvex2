import { useId } from 'react'
import { cn } from '@/lib/cn'

/* --------------------------------------------------------------------------
   Tactile Soft-3D Playful App Icons
   Inspired by chunkithwang/design-playful-app-icons
   Metaphor: Autonomous Security Sentinel (Layered Squircle + Prism Shield + Beacon)
   Crisp legibility verified from 24px -> 32px -> 64px -> 128px
   -------------------------------------------------------------------------- */

export function SuvexAppIcon({
  size = 32,
  className,
  animated = false,
}: {
  size?: number
  className?: string
  animated?: boolean
}) {
  const uid = useId().replace(/:/g, '')
  const bgId = `svx-bg-${uid}`
  const rimId = `svx-rim-${uid}`
  const prismId = `svx-prism-${uid}`
  const coreId = `svx-core-${uid}`
  const glowId = `svx-glow-${uid}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        'shrink-0 select-none drop-shadow-[0_4px_12px_rgba(79,70,229,0.28)] transition-transform duration-300 ease-out',
        animated && 'hover:-translate-y-0.5 hover:scale-[1.04]',
        className,
      )}
      aria-label="Suvex 2"
    >
      <defs>
        <linearGradient id={bgId} x1="8" y1="4" x2="56" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#312E81" />
          <stop offset="48%" stopColor="#1E1B4B" />
          <stop offset="100%" stopColor="#0F101A" />
        </linearGradient>
        <linearGradient id={rimId} x1="12" y1="2" x2="52" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#C7D2FE" stopOpacity="0.68" />
          <stop offset="42%" stopColor="#818CF8" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id={prismId} x1="18" y1="14" x2="46" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#EEF2FF" />
          <stop offset="52%" stopColor="#A5B4FC" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <radialGradient id={coreId} cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#818CF8" stopOpacity="0.88" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.95" />
        </radialGradient>
        <radialGradient id={glowId} cx="50%" cy="22%" r="60%">
          <stop offset="0%" stopColor="#818CF8" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#818CF8" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft-3D Squircle Chassis */}
      <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#${bgId})`} />
      {/* Ambient Inner Dome Glow */}
      <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#${glowId})`} />
      {/* Top Specular Bevel */}
      <path
        d="M18 3.5H46C53.5 3.5 59.5 9.2 60.4 16.5C57.5 11.2 51.8 7.5 45.2 7.5H18.8C12.2 7.5 6.5 11.2 3.6 16.5C4.5 9.2 10.5 3.5 18 3.5Z"
        fill="white"
        fillOpacity="0.16"
      />
      {/* Specular Rim Stroke */}
      <rect x="2.75" y="2.75" width="58.5" height="58.5" rx="15.25" stroke={`url(#${rimId})`} strokeWidth="1.5" />

      {/* Subtle Orbital Radar Ring */}
      <circle cx="32" cy="33" r="19" stroke="#818CF8" strokeOpacity="0.22" strokeWidth="1.25" strokeDasharray="4 4" />

      {/* Soft-3D Geometric Sentinel S-Prism */}
      <path
        d="M23.5 22.5C23.5 19.4624 25.9624 17 29 17H39.5C41.7091 17 43.5 18.7909 43.5 21C43.5 23.2091 41.7091 25 39.5 25H30.5V29.5H36.5C40.9183 29.5 44.5 33.0817 44.5 37.5V40C44.5 44.4183 40.9183 48 36.5 48H24.5C22.2909 48 20.5 46.2091 20.5 44C20.5 41.7909 22.2909 40 24.5 40H35.5V36H29C25.9624 36 23.5 33.5376 23.5 30.5V22.5Z"
        fill={`url(#${prismId})`}
      />

      {/* Specular Top Edge on Prism */}
      <path
        d="M29 18.2H39.5C41.05 18.2 42.3 19.45 42.3 21C42.3 21.4 42.2 21.75 42.05 22.05C41.55 20.75 40.3 19.8 38.8 19.8H29.2C26.9 19.8 25 21.4 24.7 23.6V22.5C24.7 20.1 26.6 18.2 29 18.2Z"
        fill="white"
        fillOpacity="0.65"
      />

      {/* Luminous Autonomous Beacon Orb */}
      <circle cx="47.5" cy="17" r="6" fill="#38BDF8" fillOpacity="0.26" />
      <circle cx="47.5" cy="17" r="3.4" fill={`url(#${coreId})`} />
      <circle cx="46.6" cy="16.1" r="1.05" fill="white" />
    </svg>
  )
}

export type TactileIconVariant = 'overview' | 'ctf' | 'chat' | 'activity' | 'security' | 'mcp'

const TACTILE_THEMES: Record<
  TactileIconVariant,
  {
    bg: [string, string]
    rim: string
    glow: string
  }
> = {
  overview: {
    bg: ['#4F46E5', '#1E1B4B'],
    rim: 'rgba(199, 210, 254, 0.55)',
    glow: 'rgba(99, 102, 241, 0.35)',
  },
  ctf: {
    bg: ['#0EA5E9', '#312E81'],
    rim: 'rgba(186, 230, 253, 0.6)',
    glow: 'rgba(14, 165, 233, 0.35)',
  },
  chat: {
    bg: ['#7C3AED', '#2E1065'],
    rim: 'rgba(221, 214, 254, 0.55)',
    glow: 'rgba(124, 58, 237, 0.35)',
  },
  activity: {
    bg: ['#10B981', '#064E3B'],
    rim: 'rgba(167, 243, 208, 0.55)',
    glow: 'rgba(16, 185, 129, 0.32)',
  },
  security: {
    bg: ['#F59E0B', '#78350F'],
    rim: 'rgba(253, 230, 138, 0.55)',
    glow: 'rgba(245, 158, 11, 0.32)',
  },
  mcp: {
    bg: ['#EC4899', '#4C1D95'],
    rim: 'rgba(251, 207, 232, 0.55)',
    glow: 'rgba(236, 72, 153, 0.32)',
  },
}

export function TactileAppIcon({
  variant,
  size = 40,
  className,
}: {
  variant: TactileIconVariant
  size?: number
  className?: string
}) {
  const uid = useId().replace(/:/g, '')
  const t = TACTILE_THEMES[variant]
  const gradId = `ti-g-${uid}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: `drop-shadow(0 6px 14px ${t.glow})` }}
      className={cn('shrink-0 select-none transition-transform duration-300 ease-out hover:-translate-y-0.5', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="6" y1="4" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={t.bg[0]} />
          <stop offset="100%" stopColor={t.bg[1]} />
        </linearGradient>
      </defs>

      {/* Soft-3D Squircle */}
      <rect x="2" y="2" width="44" height="44" rx="13" fill={`url(#${gradId})`} />
      {/* Top Gloss Lip */}
      <path
        d="M14 3.4H34C39.8 3.4 44.3 7.8 44.6 13.5C42.3 9.5 38.2 6.8 33.4 6.8H14.6C9.8 6.8 5.7 9.5 3.4 13.5C3.7 7.8 8.2 3.4 14 3.4Z"
        fill="white"
        fillOpacity="0.24"
      />
      <rect x="2.75" y="2.75" width="42.5" height="42.5" rx="12.25" stroke={t.rim} strokeWidth="1.2" />

      {/* Distinct Bold Geometric Silhouette per Domain */}
      {variant === 'overview' && (
        <>
          <circle cx="24" cy="24" r="11" stroke="white" strokeOpacity="0.35" strokeWidth="1.6" />
          <circle cx="24" cy="24" r="6" stroke="white" strokeOpacity="0.65" strokeWidth="1.6" />
          <path d="M24 24L32.5 16.5" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="24" cy="24" r="2.8" fill="white" />
          <circle cx="32.5" cy="16.5" r="2.2" fill="#38BDF8" />
        </>
      )}
      {variant === 'ctf' && (
        <>
          <path d="M16 35V14.5" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
          <path
            d="M17.5 15C21.5 13 25.5 17 31.5 15.2C32.4 14.9 33.2 15.6 33.2 16.5V25.5C33.2 26.2 32.8 26.7 32.1 26.9C26.2 28.8 22 24.8 17.5 26.8V15Z"
            fill="white"
            fillOpacity="0.94"
          />
          <circle cx="31.5" cy="33" r="3" fill="#34D399" />
        </>
      )}
      {variant === 'chat' && (
        <>
          <rect x="12" y="14" width="24" height="17" rx="6" fill="white" fillOpacity="0.95" />
          <path d="M18 30.5L15 35.5L22.5 31" fill="white" fillOpacity="0.95" />
          <circle cx="19" cy="22.5" r="2" fill="#4C1D95" />
          <circle cx="24" cy="22.5" r="2" fill="#7C3AED" />
          <circle cx="29" cy="22.5" r="2" fill="#38BDF8" />
        </>
      )}
      {variant === 'activity' && (
        <>
          <path
            d="M11 25H16.5L20 16L25 32L29.2 21.5L32 25H37"
            stroke="white"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="37" cy="25" r="2.4" fill="#A7F3D0" />
        </>
      )}
      {variant === 'security' && (
        <>
          <path
            d="M24 12L34.5 16.2V23.8C34.5 30.2 30 35 24 37C18 35 13.5 30.2 13.5 23.8V16.2L24 12Z"
            fill="white"
            fillOpacity="0.94"
          />
          <path
            d="M20.2 24.2L22.9 26.9L28.4 21.2"
            stroke="#92400E"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {variant === 'mcp' && (
        <>
          <circle cx="17" cy="24" r="4.5" fill="white" fillOpacity="0.95" />
          <circle cx="31.5" cy="17" r="3.5" fill="white" fillOpacity="0.88" />
          <circle cx="31.5" cy="31" r="3.5" fill="white" fillOpacity="0.88" />
          <path
            d="M21 22L28.5 18.4M21 26L28.5 29.6"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  )
}
