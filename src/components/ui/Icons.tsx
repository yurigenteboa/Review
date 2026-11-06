// Ícones de traço no estilo SF Symbols. Tamanho e cor vêm de quem usa (currentColor).
interface IconProps {
  size?: number
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export const HomeIcon = ({ size = 24 }: IconProps) => (
  <svg {...base(size)}><path d="M3.5 10.5L12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z" /></svg>
)
export const SearchIcon = ({ size = 24 }: IconProps) => (
  <svg {...base(size)}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
)
export const MapIcon = ({ size = 24 }: IconProps) => (
  <svg {...base(size)}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></svg>
)
export const PersonIcon = ({ size = 24 }: IconProps) => (
  <svg {...base(size)}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.2-4 4.4-6 8-6s6.8 2 8 6" /></svg>
)
export const PlusIcon = ({ size = 24 }: IconProps) => (
  <svg {...base(size)} strokeWidth={2.6}><path d="M12 5v14M5 12h14" /></svg>
)
export const HeartIcon = ({ size = 18, filled = false }: IconProps & { filled?: boolean }) => (
  <svg {...base(size)} strokeWidth={1.8} fill={filled ? 'var(--like)' : 'none'} stroke={filled ? 'var(--like)' : 'currentColor'}>
    <path d="M12 20.5s-7.5-4.6-9.3-9.4C1.4 7.6 3.6 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4c3.6 0 5.8 3.6 4.5 7.1-1.8 4.8-9.3 9.4-9.3 9.4z" />
  </svg>
)
export const CommentIcon = ({ size = 18 }: IconProps) => (
  <svg {...base(size)} strokeWidth={1.8}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z" />
  </svg>
)
export const PeopleIcon = ({ size = 24 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
    <circle cx="17" cy="9" r="2.8" />
    <path d="M16.5 14.6c2.6.2 4.4 2 5 4.9" />
  </svg>
)
export const BellIcon = ({ size = 24 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </svg>
)
export const QrIcon = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="3.5" y="3.5" width="6" height="6" rx="1" />
    <rect x="14.5" y="3.5" width="6" height="6" rx="1" />
    <rect x="3.5" y="14.5" width="6" height="6" rx="1" />
    <path d="M14.5 14.5h2v2h-2zM18.5 18.5h2v2h-2zM14.5 18.5h2M18.5 14.5h2" />
  </svg>
)
