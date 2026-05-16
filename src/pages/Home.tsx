import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Home as HouseIcon, Info, LayoutList, Map, SlidersHorizontal, X, Star, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PROPERTY_TYPES } from '../constants'
import type { Property, SearchFilters, PropertyType, AmenityCatalog } from '../types'
import { PropertyRow, PropertyGrid } from '../components/property/PropertyGrid'
import { SearchBar } from '../components/property/SearchBar'
import { Button } from '../components/ui/Button'
import { formatCurrency } from '../lib/utils'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { APP_ROUTES } from '../constants'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'

export function Home() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [heroIdx, setHeroIdx] = useState(0)
  const [filters, setFilters] = useState<SearchFilters>({})
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set())
  const [catalog, setCatalog] = useState<AmenityCatalog[]>([])
  const [amenitiesExpanded, setAmenitiesExpanded] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    loadProperties()
  }, [])

  useEffect(() => {
    supabase
      .from('amenities_catalog')
      .select('*')
      .order('category')
      .order('display_order')
      .then(({ data }) => { if (data) setCatalog(data as AmenityCatalog[]) })
  }, [])

  useEffect(() => {
    if (user) loadFavorites()
    else setFavoritedIds(new Set())
  }, [user?.id])

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
    if (estado || cidade || bairro || local || guests || checkIn || checkOut || tipo) {
      setFilters({
        state: estado ?? undefined,
        city: cidade ?? local ?? undefined,
        neighborhood: bairro ?? undefined,
        guests: guests ? Number(guests) : undefined,
        check_in: checkIn ?? undefined,
        check_out: checkOut ?? undefined,
        type: tipo as PropertyType ?? undefined,
      })
    } else {
      setFilters({})
    }
  }, [searchParams])

  async function loadFavorites() {
    const { data } = await supabase
      .from('favorites')
      .select('property_id')
      .eq('user_id', user!.id)
    if (data) setFavoritedIds(new Set(data.map(f => f.property_id)))
  }

  async function toggleFavorite(propertyId: string) {
    if (!user) { navigate(APP_ROUTES.LOGIN); return }
    const isMock = propertyId.startsWith('mock-')
    if (isMock) {
      toast('info', 'Imóvel de demonstração', 'Faça login e explore imóveis reais para salvar favoritos.')
      return
    }
    if (favoritedIds.has(propertyId)) {
      const { error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('property_id', propertyId)
      console.log('[favorites] DELETE', { user_id: user.id, property_id: propertyId, error })
      if (error) { toast('error', 'Erro ao remover', error.message); return }
      setFavoritedIds(prev => { const s = new Set(prev); s.delete(propertyId); return s })
    } else {
      const result = await supabase.from('favorites').insert({ user_id: user.id, property_id: propertyId })
      console.log('[favorites] INSERT', { user_id: user.id, property_id: propertyId, error: result.error, data: result.data })
      if (result.error) { toast('error', 'Erro ao favoritar', result.error.message); return }
      setFavoritedIds(prev => new Set([...prev, propertyId]))
    }
  }

  async function loadProperties() {
    setLoading(true)
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('status', 'ATIVO')
      .order('plan', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500)

    console.log('[loadProperties]', { count: data?.length, error })

    setProperties(error ? [] : (data as Property[]) ?? [])
    setLoading(false)
  }

  function toggleAmenityFilter(amenityId: string) {
    setFilters(f => {
      const existing = f.amenity_ids ?? []
      return {
        ...f,
        amenity_ids: existing.includes(amenityId)
          ? existing.filter(id => id !== amenityId)
          : [...existing, amenityId],
      }
    })
  }

  function toggleCategory(category: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const filteredProperties = properties.filter(p => {
    if (filters.state && p.state.toLowerCase() !== filters.state.toLowerCase()) return false
    if (filters.city && !p.city.toLowerCase().includes(filters.city.toLowerCase())) return false
    if (filters.neighborhood && !(p.neighborhood ?? '').toLowerCase().includes(filters.neighborhood.toLowerCase())) return false
    if (filters.type && p.type !== filters.type) return false
    if (filters.guests && filters.guests > 1 && (p.max_guests ?? Infinity) < filters.guests) return false
    if (filters.min_price && p.price_per_night < filters.min_price) return false
    if (filters.max_price && p.price_per_night > filters.max_price) return false
    if (filters.amenities?.length) {
      if (!filters.amenities.every(a => p.amenities.includes(a))) return false
    }
    if (filters.amenity_ids?.length && catalog.length > 0) {
      const selectedNames = filters.amenity_ids
        .map(id => catalog.find(c => c.id === id)?.name)
        .filter(Boolean) as string[]
      if (!selectedNames.every(name => (p.amenities ?? []).includes(name))) return false
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

  const isSearching = Object.keys(filters).some(k => {
    const v = filters[k as keyof SearchFilters]
    if (Array.isArray(v)) return v.length > 0
    return v !== undefined
  })

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* HERO */}
      {!isSearching && heroProperties.length > 0 && currentHero && (
        <section className="relative h-[70vh] sm:h-[85vh] min-h-[500px]">
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

          </div>

          {/* Hero navigation — bottom-center */}
          {heroProperties.length > 1 && (
            <div className="absolute bottom-5 left-0 right-0 flex justify-center items-center gap-3 z-10">
              <button
                onClick={() => setHeroIdx(i => (i - 1 + heroProperties.length) % heroProperties.length)}
                className="w-7 h-7 bg-black/40 border border-white/10 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-black/60 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <div className="flex items-center gap-1.5">
                {heroProperties.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setHeroIdx(i)}
                    className={`h-1.5 rounded-full transition-all ${i === heroIdx ? 'w-5 bg-[#E50914]' : 'w-1.5 bg-white/40 hover:bg-white/70'}`}
                  />
                ))}
              </div>
              <button
                onClick={() => setHeroIdx(i => (i + 1) % heroProperties.length)}
                className="w-7 h-7 bg-black/40 border border-white/10 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-black/60 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </section>
      )}

      {/* SearchBar único — sempre montado, nunca desmonta */}
      <div id="search-bar" className={`relative z-20 px-4 sm:px-6 lg:px-8 ${
        isSearching
          ? 'pt-20 sm:pt-24 pb-6 max-w-5xl mx-auto'
          : heroProperties.length > 0 ? '-mt-16 pb-4 max-w-5xl mx-auto' : 'pt-8 pb-4 max-w-5xl mx-auto'
      }`}>
        <SearchBar
          key="main-searchbar"
          defaultValues={{
            estado: searchParams.get('estado') ?? undefined,
            cidade: searchParams.get('cidade') ?? undefined,
            bairro: searchParams.get('bairro') ?? undefined,
            checkIn: searchParams.get('entrada') ?? undefined,
            checkOut: searchParams.get('saida') ?? undefined,
            adults: searchParams.get('hospedes') ? Number(searchParams.get('hospedes')) : undefined,
          }}
        />
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">

        {/* Filter bar */}
        <div className="flex items-center justify-between py-4 sm:py-6 gap-3 flex-wrap">
          {isSearching ? (
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-base sm:text-xl font-bold text-white">
                {filteredProperties.length} {filteredProperties.length === 1 ? 'imóvel encontrado' : 'imóveis encontrados'}
              </h2>
              <button
                onClick={() => { setFilters({}); setAmenitiesExpanded(false); navigate(APP_ROUTES.HOME) }}
                className="flex items-center gap-1.5 text-xs text-[#B3B3B3] hover:text-white bg-[#2A2A2A] px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <X size={12} /> Limpar
              </button>
            </div>
          ) : (
            <div />
          )}
          <button
            onClick={() => setFiltersOpen(v => !v)}
            className="flex items-center gap-2 text-sm text-[#B3B3B3] hover:text-white bg-[#1F1F1F] border border-[#333] px-3 sm:px-4 py-2 rounded-lg transition-colors ml-auto"
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
              <div className="bg-[#1F1F1F] border border-[#333] rounded-xl p-4 sm:p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                </div>

                {/* Amenities — quick badges + expandable categories */}
                <div className="pt-4 border-t border-[#2A2A2A]">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-semibold text-[#B3B3B3] uppercase">Comodidades</label>
                    {(filters.amenity_ids?.length ?? 0) > 0 && (
                      <button
                        onClick={() => setFilters(f => ({ ...f, amenity_ids: [] }))}
                        className="text-[10px] text-[#E50914] hover:underline"
                      >
                        Limpar ({filters.amenity_ids?.length})
                      </button>
                    )}
                  </div>

                  {/* Quick badges — top 8 from catalog */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {catalog.slice(0, 8).map(item => {
                      const isActive = (filters.amenity_ids ?? []).includes(item.id)
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleAmenityFilter(item.id)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${isActive ? 'bg-[#E50914] border-[#E50914] text-white' : 'border-[#333] text-[#B3B3B3] hover:border-[#555]'}`}
                        >
                          {item.name}
                        </button>
                      )
                    })}
                    {catalog.length > 8 && (
                      <button
                        onClick={() => setAmenitiesExpanded(v => !v)}
                        className="flex items-center gap-1 text-xs text-[#B3B3B3] hover:text-white border border-[#333] hover:border-[#555] px-2.5 py-1 rounded-lg transition-colors"
                      >
                        {amenitiesExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        {amenitiesExpanded ? 'Ver menos' : `Ver todas (${catalog.length})`}
                      </button>
                    )}
                  </div>

                  {/* Expanded: all categories with collapsible sections */}
                  {amenitiesExpanded && catalog.length > 0 && (() => {
                    const byCategory: Record<string, AmenityCatalog[]> = {}
                    for (const item of catalog) {
                      if (!byCategory[item.category]) byCategory[item.category] = []
                      byCategory[item.category].push(item)
                    }
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-1">
                        {Object.entries(byCategory).map(([category, items]) => {
                          const isOpen = expandedCategories.has(category)
                          const activeInCat = items.filter(i => (filters.amenity_ids ?? []).includes(i.id)).length
                          return (
                            <div key={category} className="bg-[#2A2A2A] rounded-lg overflow-hidden">
                              <button
                                onClick={() => toggleCategory(category)}
                                className="w-full flex items-center justify-between px-3 py-2 text-left"
                              >
                                <span className="text-[10px] font-bold text-[#888] uppercase truncate">{category}</span>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {activeInCat > 0 && <span className="text-[10px] font-bold text-[#E50914]">{activeInCat}</span>}
                                  {isOpen ? <ChevronUp size={10} className="text-[#555]" /> : <ChevronDown size={10} className="text-[#555]" />}
                                </div>
                              </button>
                              {isOpen && (
                                <div className="px-3 pb-3 flex flex-wrap gap-1.5">
                                  {items.map(item => {
                                    const isActive = (filters.amenity_ids ?? []).includes(item.id)
                                    return (
                                      <button
                                        key={item.id}
                                        onClick={() => toggleAmenityFilter(item.id)}
                                        className={`text-[10px] px-2 py-1 rounded border transition-colors ${isActive ? 'bg-[#E50914] border-[#E50914] text-white' : 'border-[#444] text-[#999] hover:border-[#666]'}`}
                                      >
                                        {item.name}
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* View toggle */}
        <div className="flex items-center gap-2 mb-4 px-4">
          <div className="flex gap-1 bg-[#1A1A1A] border border-[#222] p-1 rounded-lg">
            <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#E50914] text-white">
              <LayoutList size={12} /> Lista
            </span>
            <Link
              to="/mapa"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-[#555] hover:text-white transition-colors"
            >
              <Map size={12} /> Mapa
            </Link>
          </div>
        </div>

        {/* Content: search results or Netflix rows */}
        {isSearching ? (
          <PropertyGrid
            properties={filteredProperties}
            loading={loading}
            emptyMessage="Nenhum imóvel encontrado para essa busca."
            favoritedIds={favoritedIds}
            onFavoriteToggle={toggleFavorite}
            checkIn={filters.check_in}
            checkOut={filters.check_out}
            guests={filters.guests}
          />
        ) : (
          <div className="flex flex-col gap-12">
            {!loading && properties.length === 0 ? (
              <div className="text-center py-20 text-[#666]">
                <p className="text-lg">Nenhum imóvel disponível no momento.</p>
                <p className="text-sm mt-2 text-[#444]">Volte em breve para ver novidades.</p>
              </div>
            ) : (
              rows.map(row => (
                <PropertyRow
                  key={row.id}
                  title={row.label}
                  properties={row.items}
                  favoritedIds={favoritedIds}
                  onFavoriteToggle={toggleFavorite}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
