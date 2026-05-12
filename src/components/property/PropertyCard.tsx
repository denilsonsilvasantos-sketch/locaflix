import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, Star, MapPin, Users, BedDouble } from 'lucide-react'
import type { Property } from '../../types'
import { formatCurrency, cn, calculateMaxInstallments, calculatePlatformFee } from '../../lib/utils'
import { APP_ROUTES } from '../../constants'

interface PropertyCardProps {
  property: Property
  onFavoriteToggle?: (id: string) => void
  isFavorited?: boolean
  checkIn?: string
  checkOut?: string
  guests?: number
}

export function PropertyCard({ property, onFavoriteToggle, isFavorited = false, checkIn, checkOut, guests }: PropertyCardProps) {
  const [imgIdx, setImgIdx] = useState(0)
  const photos = property.photos.length > 0
    ? property.photos
    : ['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800']

  const hasDates = Boolean(checkIn && checkOut)

  const nights = hasDates
    ? Math.floor((new Date(checkOut! + 'T00:00:00').getTime() - new Date(checkIn! + 'T00:00:00').getTime()) / 86400000)
    : 0

  const total = hasDates && nights > 0
    ? (() => {
        const subtotal = property.price_per_night * nights
        return subtotal + calculatePlatformFee(subtotal)
      })()
    : 0

  const maxInstallments = hasDates && checkIn ? calculateMaxInstallments(checkIn) : 0
  const installmentValue = maxInstallments > 0 && total > 0 ? total / maxInstallments : 0

  const propertyUrl = (() => {
    const params = new URLSearchParams()
    if (checkIn) params.set('entrada', checkIn)
    if (checkOut) params.set('saida', checkOut)
    if (guests) params.set('hospedes', String(guests))
    const qs = params.toString()
    return APP_ROUTES.PROPERTY(property.id) + (qs ? `?${qs}` : '')
  })()

  function handleFav(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onFavoriteToggle?.(property.id)
  }

  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="group relative"
    >
      <Link to={propertyUrl} className="block">
        {/* Image */}
        <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#2A2A2A]">
          <img
            src={photos[imgIdx]}
            alt={property.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800' }}
          />

          {/* Lighter gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-2">
            {property.plan === 'DESTAQUE' && (
              <span className="bg-[#F5A623] text-black text-xs font-bold px-2 py-0.5 rounded-md">
                DESTAQUE
              </span>
            )}
          </div>

          {/* Favorite */}
          <button
            onClick={handleFav}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors"
          >
            <Heart
              size={16}
              className={cn(
                'transition-colors',
                isFavorited ? 'fill-[#E50914] text-[#E50914]' : 'text-white',
              )}
            />
          </button>

          {/* Photo dots */}
          {photos.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {photos.slice(0, 5).map((_, i) => (
                <button
                  key={i}
                  onClick={e => { e.preventDefault(); setImgIdx(i) }}
                  className={cn(
                    'w-1.5 h-1.5 rounded-full transition-all',
                    i === imgIdx ? 'bg-white w-3' : 'bg-white/50',
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mt-3 px-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-white leading-tight line-clamp-1 flex-1">
              {property.name}
            </h3>
            {property.rating && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Star size={12} className="fill-[#F5A623] text-[#F5A623]" />
                <span className="text-xs font-semibold text-white">{property.rating.toFixed(1)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 mt-1">
            <MapPin size={11} className="text-[#666]" />
            <span className="text-xs text-[#B3B3B3]">
              {property.neighborhood ? `${property.neighborhood}, ` : ''}{property.city} · {property.state}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1.5 text-xs text-[#666]">
            <span className="flex items-center gap-1">
              <BedDouble size={11} />
              {property.bedrooms} {property.bedrooms === 1 ? 'quarto' : 'quartos'}
            </span>
            <span className="flex items-center gap-1">
              <Users size={11} />
              até {property.max_guests}
            </span>
          </div>

          <div className="mt-2">
            {hasDates && nights > 0 ? (
              <div>
                <p className="text-[11px] text-[#B3B3B3]">sua assinatura mensal será de:</p>
                <p className="text-base font-bold text-white">
                  até {maxInstallments}x de {formatCurrency(installmentValue)}
                </p>
              </div>
            ) : (
              <p className="text-xs text-[#555] italic">Selecione as datas para ver o preço</p>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
