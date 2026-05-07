import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { PropertyCard } from './PropertyCard'
import type { Property } from '../../types'

interface PropertyRowProps {
  title: string
  properties: Property[]
  favoritedIds?: Set<string>
  onFavoriteToggle?: (id: string) => void
  checkIn?: string
  checkOut?: string
  guests?: number
}

export function PropertyRow({ title, properties, favoritedIds = new Set(), onFavoriteToggle, checkIn, checkOut, guests }: PropertyRowProps) {
  const rowRef = useRef<HTMLDivElement>(null)

  function scroll(dir: 'left' | 'right') {
    if (!rowRef.current) return
    const amount = rowRef.current.offsetWidth * 0.75
    rowRef.current.scrollBy({ left: dir === 'right' ? amount : -amount, behavior: 'smooth' })
  }

  if (properties.length === 0) return null

  return (
    <section className="relative group/row">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-bold text-white tracking-wide">{title}</h2>
        <button className="text-xs text-[#B3B3B3] hover:text-white transition-colors">
          Ver tudo
        </button>
      </div>

      <div className="relative">
        {/* Left arrow */}
        <button
          onClick={() => scroll('left')}
          className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-[#141414]/90 border border-[#333] rounded-full flex items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-opacity shadow-xl hover:bg-[#2A2A2A]"
        >
          <ChevronLeft size={20} />
        </button>

        {/* Cards row */}
        <div
          ref={rowRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {properties.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="flex-shrink-0 w-64 sm:w-72"
              style={{ scrollSnapAlign: 'start' }}
            >
              <PropertyCard
                property={p}
                isFavorited={favoritedIds.has(p.id)}
                onFavoriteToggle={onFavoriteToggle}
                checkIn={checkIn}
                checkOut={checkOut}
                guests={guests}
              />
            </motion.div>
          ))}
        </div>

        {/* Right arrow */}
        <button
          onClick={() => scroll('right')}
          className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-[#141414]/90 border border-[#333] rounded-full flex items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-opacity shadow-xl hover:bg-[#2A2A2A]"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </section>
  )
}

interface PropertyGridProps {
  properties: Property[]
  favoritedIds?: Set<string>
  onFavoriteToggle?: (id: string) => void
  loading?: boolean
  emptyMessage?: string
  checkIn?: string
  checkOut?: string
  guests?: number
}

export function PropertyGrid({ properties, favoritedIds = new Set(), onFavoriteToggle, loading = false, emptyMessage = 'Nenhum imóvel encontrado.', checkIn, checkOut, guests }: PropertyGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-[4/3] bg-[#2A2A2A] rounded-xl mb-3" />
            <div className="h-4 bg-[#2A2A2A] rounded w-3/4 mb-2" />
            <div className="h-3 bg-[#2A2A2A] rounded w-1/2 mb-2" />
            <div className="h-4 bg-[#2A2A2A] rounded w-1/3" />
          </div>
        ))}
      </div>
    )
  }

  if (properties.length === 0) {
    return (
      <div className="text-center py-20 text-[#666]">
        <p className="text-lg">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {properties.map((p, i) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
        >
          <PropertyCard
            property={p}
            isFavorited={favoritedIds.has(p.id)}
            onFavoriteToggle={onFavoriteToggle}
            checkIn={checkIn}
            checkOut={checkOut}
            guests={guests}
          />
        </motion.div>
      ))}
    </div>
  )
}
