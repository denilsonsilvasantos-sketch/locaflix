interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Logo({ size = 'md', className = '' }: LogoProps) {
  const h = { sm: 'h-8', md: 'h-12', lg: 'h-14' }[size]
  const t = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' }[size]

  return (
    <span className={`inline-flex items-center ${className}`}>
      <img
        src="/logo.png"
        alt="LOCAFLIX"
        className={`${h} w-auto`}
        onError={e => {
          const img = e.currentTarget as HTMLImageElement
          img.style.display = 'none'
          const fallback = img.nextElementSibling as HTMLElement | null
          if (fallback) fallback.style.display = ''
        }}
      />
      <span
        className={`font-display ${t} font-bold tracking-wider text-[#E50914] drop-shadow-lg`}
        style={{ display: 'none' }}
      >
        LOCAFLIX
      </span>
    </span>
  )
}
