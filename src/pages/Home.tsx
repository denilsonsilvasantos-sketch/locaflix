import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Home as HouseIcon, Info, SlidersHorizontal, X, Star, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PROPERTY_TYPES, AMENITIES_LIST } from '../constants'
import { MOCK_PROPERTIES } from '../constants/mocks'
import type { Property, SearchFilters, PropertyType } from '../types'
import { PropertyRow, PropertyGrid } from '../components/property/PropertyGrid'
import { SearchBar } from '../components/property/SearchBar'
import { Button } from '../components/ui/Button'
import { formatCurrency } from '../lib/utils'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { APP_ROUTES } from '../constants'

export function Home() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [heroIdx, setHeroIdx] = useState(0)
  const [filters, setFilters] = useState<SearchFilters>({})
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    loadProperties()
  }, [])

  // Auto-carousel every 6s
  useEffect(() => {
    const heroes = properties.filter(p => p.plan === 'DESTAQUE').slice(0, 5)
    if (heroes.length <= 1) return
    const id = setInterval(() => setHeroIdx(i => (i + 1) % heroes.length), 6000)
    return () => clearInterval(id)
  }, [properties])

  useEffect(() => {
    const estado = searchParams.get('estado')
    const cidade = searchParams.get('cidade')
    const bairro = searchParams.get('bairro')
    // legacy 'local' param still supported
    const local = searchParams.get('local')
    const guests = searchParams.get('hospedes')
    const checkIn = searchParams.get('entrada')
    const checkOut = searchParams.get('saida')
    const tipo = searchParams.get('tipo')
    const locationStr = [cidade, bairro, estado].filter(Boolean).join(' ') || local || undefined
    if (estado || cidade || bairro || local || guests || checkIn || checkOut || tipo) {
      setFilters({
        state: estado ?? undefined,
        city: locationStr,
        guests: guests ? Number(guests) : undefined,
        check_in: checkIn ?? undefined,
        check_out: checkOut ?? undefined,
        type: tipo as PropertyType ?? undefined,
      })
    } else {
      setFilters({})
    }
  }, [searchParams])

  async function loadProperties() {
    setLoading(true)
    const { data, error } = await supabase
      .from('properties')
      .select('*, owner:users(id, name, avatar_url)')
      .eq('status', 'ATIVO')
      .order('plan', { ascending: false })
      .order('rating', { ascending: false })
      .limit(60)

    if (error || !data) {
      setProperties(MOCK_PROPERTIES)
    } else {
      setProperties(data.length > 0 ? (data as Property[]) : MOCK_PROPERTIES)
    }
    setLoading(false)
  }

  const filteredProperties = properties.filter(p => {
    if (filters.city && !`${p.city} ${p.state} ${p.neighborhood ?? ''}`.toLowerCase().includes(filters.city.toLowerCase())) return false
    if (filters.type && p.type !== filters.type) return false
    if (filters.guests && p.max_guests < filters.guests) return false
    if (filters.min_price && p.price_per_night < filters.min_price) return false
    if (filters.max_price && p.price_per_night > filters.max_price) return false
    if (filters.amenities?.length) {
      if (!filters.amenities.every(a => p.amenities.includes(a))) return false
    }
    return true
  })

  const heroProperties = properties.filter(p => p.plan === 'DESTAQUE').slice(0, 5)
  const currentHero = heroProperties[heroIdx] ?? properties[0]

  // Netflix-style category rows
  const rows = [
    { id: 'destaque', label: 'Em Destaque', items: properties.filter(p => p.plan === 'DESTAQUE') },
    { id: 'praia', label: 'Na Beira da Praia', items: properties.filter(p => /florianóp|búzios|porto|fortaleza|natal|maceió|ipojuca|ilhéus/i.test(p.city)) },
    { id: 'campo', label: 'No Campo e Serra', items: properties.filter(p => /gramado|campos do jordão|bonito|chapada|pirenópolis/i.test(p.city)) },
    { id: 'melhor', label: 'Mais Bem Avaliados', items: [...properties].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 12) },
    { id: 'luxo', label: 'Luxo & Exclusividade', items: properties.filter(p => p.price_per_night >= 800) },
    { id: 'economico', label: 'Ótimo Custo-Benefício', items: properties.filter(p => p.price_per_night < 300) },
  ]

  const isSearching = Object.keys(filters).length > 0

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* HERO */}
      {!isSearching && heroProperties.length > 0 && currentHero && (
        <section className="relative h-[85vh] min-h-[500px]">
          {/* Background — overflow-hidden only on this inner wrapper so dropdowns não ficam cortados */}
          <div className="absolute inset-0 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={heroIdx}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0"
              >
                <img
                  src={currentHero.photos[0] ?? 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1600'}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/60 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-[#141414]/30" />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Content */}
          <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-24">
            <motion.div
              key={`hero-content-${heroIdx}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="max-w-xl"
            >
              {currentHero.plan === 'DESTAQUE' && (
                <span className="inline-flex items-center gap-1.5 bg-[#F5A623] text-black text-xs font-bold px-2.5 py-1 rounded-md mb-3">
                  ★ DESTAQUE
                </span>
              )}
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-white leading-tight">
                {currentHero.name}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1">
                  <Star size={14} className="fill-[#F5A623] text-[#F5A623]" />
                  <span className="text-sm font-semibold text-[#F5A623]">{currentHero.rating?.toFixed(1)}</span>
                  <span className="text-sm text-[#B3B3B3]">({currentHero.reviews_count} avaliações)</span>
                </div>
                <span className="text-[#666]">·</span>
                <div className="flex items-center gap-1 text-[#B3B3B3] text-sm">
                  <MapPin size={13} />
                  {currentHero.city}, {currentHero.state}
                </div>
              </div>
              <p className="mt-3 text-[#B3B3B3] text-sm line-clamp-2 max-w-md">
                {currentHero.description}
              </p>
              <div className="flex items-center gap-3 mt-5">
                <Button
                  size="lg"
                  onClick={() => navigate(APP_ROUTES.PROPERTY(currentHero.id))}
                  className="gap-2"
                >
                  <HouseIcon size={18} />
                  Ver imóvel
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => navigate(APP_ROUTES.PROPERTY(currentHero.id))}
                  className="gap-2"
                >
                  <Info size={18} />
                  Detalhes
                </Button>
                {filters.check_in && (
                  <div className="ml-2">
                    <p className="text-xs text-[#B3B3B3]">a partir de</p>
                    <p className="text-xl font-bold text-white">
                      {formatCurrency(currentHero.price_per_night)}
                      <span className="text-xs text-[#B3B3B3] font-normal">/noite</span>
                    </p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Hero navigation */}
            {heroProperties.length > 1 && (
              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2">
                <button
                  onClick={() => setHeroIdx(i => (i - 1 + heroProperties.length) % heroProperties.length)}
                  className="w-10 h-10 bg-black/40 border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="flex flex-col gap-1.5 items-center py-1">
                  {heroProperties.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setHeroIdx(i)}
                      className={`w-1.5 rounded-full transition-all ${i === heroIdx ? 'h-5 bg-[#E50914]' : 'h-1.5 bg-white/40 hover:bg-white/70'}`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setHeroIdx(i => (i + 1) % heroProperties.length)}
                  className="w-10 h-10 bg-black/40 border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Search bar — fora do overflow-hidden para os painéis aparecerem */}
      {!isSearching && heroProperties.length > 0 && (
        <div className="relative z-20 -mt-16 px-4 sm:px-6 lg:px-8 pb-4">
          <div className="max-w-5xl mx-auto">
            <SearchBar />
          </div>
        </div>
      )}

      {/* Search hero when searching */}
      {isSearching && (
        <div className="pt-24 pb-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
          <SearchBar defaultValues={{
          estado: searchParams.get('estado') ?? undefined,
          cidade: searchParams.get('cidade') ?? undefined,
          bairro: searchParams.get('bairro') ?? undefined,
          checkIn: filters.check_in,
          checkOut: filters.check_out,
          adults: filters.guests,
        }} />
        </div>
      )}

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">

        {/* Filter bar */}
        <div className="flex items-center justify-between py-6 gap-4 flex-wrap">
          {isSearching ? (
            <div className="flex items-center gap-3">
              <h2 className="font-display text-xl font-bold text-white">
                {filteredProperties.length} imóveis encontrados
              </h2>
              <button
                onClick={() => { setFilters({}); navigate(APP_ROUTES.HOME) }}
                className="flex items-center gap-1.5 text-xs text-[#B3B3B3] hover:text-white bg-[#2A2A2A] px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <X size={12} /> Limpar filtros
              </button>
            </div>
          ) : (
            <div />
          )}
          <button
            onClick={() => setFiltersOpen(v => !v)}
            className="flex items-center gap-2 text-sm text-[#B3B3B3] hover:text-white bg-[#1F1F1F] border border-[#333] px-4 py-2 rounded-lg transition-colors"
          >
            <SlidersHorizontal size={15} />
            Filtros
          </button>
        </div>

        {/* Filters panel */}
        <AnimatePresence>
          {filtersOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-8"
            >
              <div className="bg-[#1F1F1F] border border-[#333] rounded-xl p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Type */}
                  <div>
                    <label className="text-xs font-semibold text-[#B3B3B3] uppercase mb-2 block">Tipo</label>
                    <div className="flex flex-wrap gap-1.5">
                      {PROPERTY_TYPES.map(t => (
                        <button
                          key={t.value}
                          onClick={() => setFilters(f => ({ ...f, type: f.type === t.value ? undefined : t.value as PropertyType }))}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${filters.type === t.value ? 'bg-[#E50914] border-[#E50914] text-white' : 'border-[#333] text-[#B3B3B3] hover:border-[#555]'}`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Price */}
                  <div>
                    <label className="text-xs font-semibold text-[#B3B3B3] uppercase mb-2 block">Preço / noite</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Min"
                        value={filters.min_price ?? ''}
                        onChange={e => setFilters(f => ({ ...f, min_price: e.target.value ? Number(e.target.value) : undefined }))}
                        className="w-full bg-[#2A2A2A] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-[#666] outline-none focus:ring-1 focus:ring-[#E50914]"
                      />
                      <span className="text-[#666]">–</span>
                      <input
                        type="number"
                        placeholder="Max"
                        value={filters.max_price ?? ''}
                        onChange={e => setFilters(f => ({ ...f, max_price: e.target.value ? Number(e.target.value) : undefined }))}
                        className="w-full bg-[#2A2A2A] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-[#666] outline-none focus:ring-1 focus:ring-[#E50914]"
                      />
                    </div>
                  </div>

                  {/* Bedrooms */}
                  <div>
                    <label className="text-xs font-semibold text-[#B3B3B3] uppercase mb-2 block">Quartos (mín)</label>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          onClick={() => setFilters(f => ({ ...f, bedrooms: f.bedrooms === n ? undefined : n }))}
                          className={`w-9 h-9 rounded-lg text-sm border transition-colors ${filters.bedrooms === n ? 'bg-[#E50914] border-[#E50914] text-white' : 'border-[#333] text-[#B3B3B3] hover:border-[#555]'}`}
                        >
                          {n}+
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Amenities */}
                  <div>
                    <label className="text-xs font-semibold text-[#B3B3B3] uppercase mb-2 block">Comodidades</label>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {AMENITIES_LIST.slice(0, 10).map(a => (
                        <button
                          key={a}
                          onClick={() => setFilters(f => {
                            const existing = f.amenities ?? []
                            return {
                              ...f,
                              amenities: existing.includes(a)
                                ? existing.filter(x => x !== a)
                                : [...existing, a],
                            }
                          })}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${(filters.amenities ?? []).includes(a) ? 'bg-[#E50914] border-[#E50914] text-white' : 'border-[#333] text-[#B3B3B3] hover:border-[#555]'}`}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content: search results or Netflix rows */}
        {isSearching ? (
          <PropertyGrid
            properties={filteredProperties}
            loading={loading}
            emptyMessage="Nenhum imóvel encontrado para essa busca."
            checkIn={filters.check_in}
            checkOut={filters.check_out}
            guests={filters.guests}
          />
        ) : (
          <div className="flex flex-col gap-12">
            {rows.map(row => (
              <PropertyRow
                key={row.id}
                title={row.label}
                properties={row.items}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
