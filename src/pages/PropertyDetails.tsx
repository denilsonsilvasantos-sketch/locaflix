import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Star, MapPin, Users, BedDouble, Bath, ChevronLeft, ChevronRight,
  Heart, Share2, Check, Calendar, X, Grid2x2, MessageSquare,
  AirVent, Wind, Wifi, Tv, Shirt, Zap, Car, Accessibility,
  Utensils, UtensilsCrossed, Refrigerator, Snowflake, Flame, Coffee,
  Thermometer, Lock, Baby, Umbrella, Droplets, Dumbbell, Gamepad2, Trees,
  Mountain, Building2, Sun, DoorOpen, Moon,
  PawPrint, Cigarette, Shield, Camera, Box, Laptop, Monitor,
  Bed, Sparkles, PlusCircle, Waves,
  type LucideProps,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import type { Property, PropertyPhoto, PricePeriod, Review, PropertyAmenity } from '../types'

type ReviewWithProperty = Review & { property?: { id: string; name: string } | null }
import { getMinPrice, PERIOD_TYPE_LABELS } from '../lib/pricing'
import { MOCK_PROPERTIES } from '../constants/mocks'
import { APP_ROUTES } from '../constants'
import { formatCurrency, calculateMaxInstallments } from '../lib/utils'
import { Button } from '../components/ui/Button'
import { DateRangePicker } from '../components/ui/DateRangePicker'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'

// ── Amenity icon map (lucide kebab-case → component) ──────────
const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  'air-vent': AirVent, 'wind': Wind, 'wifi': Wifi, 'tv': Tv,
  'washing-machine': Shirt, 'shirt': Shirt, 'zap': Zap, 'car': Car,
  'arrow-up-square': Box, 'accessibility': Accessibility,
  'utensils': Utensils, 'utensils-crossed': UtensilsCrossed,
  'refrigerator': Refrigerator, 'snowflake': Snowflake,
  'flame': Flame, 'microwave': Zap, 'oven': Flame, 'coffee': Coffee,
  'thermometer': Thermometer, 'lock': Lock, 'users': Users,
  'baby': Baby, 'umbrella': Umbrella, 'droplets': Droplets,
  'dumbbell': Dumbbell, 'gamepad-2': Gamepad2, 'trees': Trees,
  'waves': Waves, 'mountain': Mountain, 'building-2': Building2,
  'sunset': Sun, 'sun': Sun, 'door-open': DoorOpen, 'flower-2': Sparkles,
  'moon': Moon, 'paw-print': PawPrint, 'party-popper': Sparkles,
  'cigarette': Cigarette, 'shield': Shield, 'camera': Camera,
  'box': Box, 'laptop': Laptop, 'monitor': Monitor,
  'bed': Bed, 'towel': Bed, 'sparkles': Sparkles, 'plus-circle': PlusCircle,
}

function AmenityIcon({ name, size = 15, className }: { name: string | null; size?: number; className?: string }) {
  const Icon = (name ? ICON_MAP[name] : null) ?? Check
  return <Icon size={size} className={className} />
}

interface RoomGroup {
  id: string | null
  name: string
  photos: (PropertyPhoto & { roomName: string })[]
}

type FlatPhoto = PropertyPhoto & { roomName: string }

export function PropertyDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { toast } = useToast()

  const [property, setProperty] = useState<Property | null>(null)
  const [reviews, setReviews] = useState<ReviewWithProperty[]>([])
  const [roomGroups, setRoomGroups] = useState<RoomGroup[]>([])
  const [pricePeriods, setPricePeriods] = useState<PricePeriod[]>([])
  const [propertyAmenities, setPropertyAmenities] = useState<PropertyAmenity[]>([])
  const [loading, setLoading] = useState(true)
  const [imgIdx, setImgIdx] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState(0)
  const [checkIn, setCheckIn] = useState(() => searchParams.get('entrada') ?? '')
  const [checkOut, setCheckOut] = useState(() => searchParams.get('saida') ?? '')
  const [guests, setGuests] = useState(() => Number(searchParams.get('hospedes') ?? 2))
  const [isFavorited, setIsFavorited] = useState(false)
  const [hasActiveBooking, setHasActiveBooking] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)

  const loadProperty = useCallback(async (propertyId: string) => {
    // Step 1: fetch property to get owner_id
    const propRes = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single()

    const ownerId = (propRes.data as Property | null)?.owner_id

    // Step 1.5: fetch all property IDs of this owner for cross-property reviews
    let ownerPropertyIds: string[] = [propertyId]
    if (ownerId) {
      const { data: ownerProps } = await supabase
        .from('properties')
        .select('id')
        .eq('owner_id', ownerId)
      if (ownerProps && ownerProps.length > 0) {
        ownerPropertyIds = ownerProps.map((p: { id: string }) => p.id)
      }
    }

    // Step 2: fetch everything else + owner in parallel
    const [revRes, photoRes, periodsRes, amenitiesRes, ownerRes] = await Promise.all([
      supabase
        .from('reviews')
        .select('*, reviewer:users(id, name, avatar_url), property:properties!target_property_id(id, name)')
        .in('target_property_id', ownerPropertyIds)
        .eq('visible', true)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('property_photos')
        .select('*, room:property_rooms(id, name, display_order)')
        .eq('property_id', propertyId)
        .order('display_order', { ascending: true }),
      supabase
        .from('price_periods')
        .select('*')
        .eq('property_id', propertyId)
        .eq('active', true)
        .order('priority', { ascending: false }),
      supabase
        .from('property_amenities')
        .select('property_id, amenity_id, amenity:amenities_catalog(id, category, name, icon, display_order)')
        .eq('property_id', propertyId),
      ownerId
        ? supabase.from('users').select('id, name, avatar_url, created_at').eq('id', ownerId).single()
        : Promise.resolve({ data: null, error: null }),
    ])

    if (propRes.data) {
      setProperty({ ...propRes.data, owner: ownerRes.data ?? undefined } as Property)
    } else {
      const mock = MOCK_PROPERTIES.find(p => p.id === propertyId)
      setProperty(mock ?? null)
    }
    setReviews((revRes.data ?? []) as ReviewWithProperty[])

    const photosData = (photoRes.data ?? []) as (PropertyPhoto & { room: { id: string; name: string; display_order: number } | null })[]
    const groups: RoomGroup[] = []
    for (const photo of photosData) {
      const roomId = photo.room_id ?? null
      const roomName = photo.room?.name ?? 'Geral'
      let group = groups.find(g => g.id === roomId)
      if (!group) {
        group = { id: roomId, name: roomName, photos: [] }
        groups.push(group)
      }
      group.photos.push({ ...photo, roomName })
    }
    setRoomGroups(groups)
    setPricePeriods((periodsRes.data ?? []) as PricePeriod[])
    setPropertyAmenities((amenitiesRes.data ?? []) as PropertyAmenity[])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!id) return
    loadProperty(id)
  }, [id, loadProperty])

  useEffect(() => {
    if (!id || !user) return
    supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('property_id', id)
      .maybeSingle()
      .then(({ data }) => setIsFavorited(!!data))
  }, [id, user?.id])

  useEffect(() => {
    if (!id || !user) return
    supabase
      .from('bookings')
      .select('id')
      .eq('property_id', id)
      .eq('guest_id', user.id)
      .in('status', ['PAGO', 'CONCLUIDA'])
      .limit(1)
      .then(({ data }) => setHasActiveBooking((data?.length ?? 0) > 0))
  }, [id, user?.id])

  function calcNights() {
    if (!checkIn || !checkOut) return 0
    const d1 = new Date(checkIn + 'T00:00:00').getTime()
    const d2 = new Date(checkOut + 'T00:00:00').getTime()
    return Math.max(0, Math.floor((d2 - d1) / 86400000))
  }

  function handleReserve() {
    if (!user) {
      navigate(APP_ROUTES.LOGIN, { state: { from: { pathname: APP_ROUTES.PROPERTY(id!) } } })
      return
    }
    if (!checkIn || !checkOut) {
      toast('warning', 'Selecione as datas', 'Escolha as datas de check-in e check-out.')
      return
    }
    navigate(`${APP_ROUTES.CHECKOUT(id!)}?entrada=${checkIn}&saida=${checkOut}&hospedes=${guests}`)
  }

  async function toggleFavorite() {
    if (!user) { navigate(APP_ROUTES.LOGIN); return }
    const isMock = id?.startsWith('mock-')
    if (isMock) {
      toast('info', 'Imóvel de demonstração', 'Este imóvel não pode ser favoritado.')
      return
    }
    if (isFavorited) {
      const { error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('property_id', id)
      console.log('[favorites] DELETE PropertyDetails', { user_id: user.id, property_id: id, error })
      if (error) { toast('error', 'Erro ao remover', error.message); return }
    } else {
      const result = await supabase.from('favorites').insert({ user_id: user.id, property_id: id })
      console.log('[favorites] INSERT PropertyDetails', { user_id: user.id, property_id: id, error: result.error, data: result.data })
      if (result.error) { toast('error', 'Erro ao favoritar', result.error.message); return }
    }
    setIsFavorited(v => !v)
  }

  async function handleShare() {
    const url = window.location.href
    const title = property?.name ?? 'Imóvel na Locaflix'
    const text = `Confira este imóvel na Locaflix: ${title}`
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
      } catch {
        // user cancelled — no action needed
      }
    } else {
      try {
        await navigator.clipboard.writeText(url)
        toast('success', 'Link copiado!', 'O link do imóvel foi copiado para a área de transferência.')
      } catch {
        toast('error', 'Erro ao copiar', 'Não foi possível copiar o link.')
      }
    }
  }

  const nights = calcNights()
  const subtotal = property ? property.price_per_night * nights : 0
  const fee = subtotal * 0.05

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] pt-24 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-[#141414] pt-24 flex flex-col items-center justify-center gap-4">
        <p className="text-white text-xl">Imóvel não encontrado.</p>
        <Button onClick={() => navigate(APP_ROUTES.HOME)}>Voltar para o início</Button>
      </div>
    )
  }

  // Build flat photo list: prefer property_photos, fallback to legacy photos[]
  const allPhotos: FlatPhoto[] = roomGroups.length > 0
    ? roomGroups.flatMap(g => g.photos)
    : property.photos.map((url, i) => ({
        id: String(i),
        property_id: property.id,
        room_id: null,
        url,
        caption: null,
        display_order: i,
        created_at: '',
        roomName: 'Fotos',
      }))

  const fallbackUrl = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200'
  const displayPhotos = allPhotos.length > 0 ? allPhotos : [{ id: '0', property_id: property.id, room_id: null, url: fallbackUrl, caption: null, display_order: 0, created_at: '', roomName: '' }]

  function openLightbox(idx: number) {
    setLightboxIdx(idx)
    setLightboxOpen(true)
  }

  function lightboxPrev() {
    setLightboxIdx(i => (i - 1 + displayPhotos.length) % displayPhotos.length)
  }

  function lightboxNext() {
    setLightboxIdx(i => (i + 1) % displayPhotos.length)
  }

  return (
    <div className="min-h-screen bg-[#141414] pt-24">
      {/* ── Lightbox ── */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col"
          onKeyDown={e => {
            if (e.key === 'Escape') setLightboxOpen(false)
            if (e.key === 'ArrowLeft') lightboxPrev()
            if (e.key === 'ArrowRight') lightboxNext()
          }}
          tabIndex={0}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 shrink-0">
            <span className="text-white/60 text-sm">{lightboxIdx + 1} / {displayPhotos.length}</span>
            {displayPhotos[lightboxIdx]?.roomName && (
              <span className="text-white/80 text-sm font-medium">{displayPhotos[lightboxIdx].roomName}</span>
            )}
            <button
              onClick={() => setLightboxOpen(false)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Main photo */}
          <div className="flex-1 flex items-center justify-center relative min-h-0 px-12">
            <button
              onClick={lightboxPrev}
              className="absolute left-3 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ChevronLeft size={22} />
            </button>
            <img
              src={displayPhotos[lightboxIdx]?.url}
              alt=""
              className="max-h-full max-w-full object-contain rounded-lg"
            />
            <button
              onClick={lightboxNext}
              className="absolute right-3 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ChevronRight size={22} />
            </button>
          </div>

          {/* Caption */}
          {displayPhotos[lightboxIdx]?.caption && (
            <div className="text-center px-6 py-3 shrink-0">
              <p className="text-white/80 text-sm">{displayPhotos[lightboxIdx].caption}</p>
            </div>
          )}

          {/* Thumbnail strip */}
          <div className="shrink-0 px-4 pb-4 pt-2 overflow-x-auto">
            <div className="flex gap-2 w-max mx-auto">
              {displayPhotos.map((p, i) => (
                <button
                  key={p.id + i}
                  onClick={() => setLightboxIdx(i)}
                  className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${i === lightboxIdx ? 'border-white' : 'border-transparent opacity-50 hover:opacity-80'}`}
                >
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Gallery ── */}
      {/* Mobile: single hero with carousel */}
      <div className="sm:hidden relative h-[55vw] max-h-72 bg-[#0A0A0A] overflow-hidden group">
        <img
          src={displayPhotos[imgIdx]?.url ?? fallbackUrl}
          alt={property.name}
          className="w-full h-full object-cover cursor-pointer"
          onClick={() => openLightbox(imgIdx)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] to-transparent pointer-events-none" />
        {displayPhotos.length > 1 && (
          <>
            <button
              onClick={() => setImgIdx(i => (i - 1 + displayPhotos.length) % displayPhotos.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/60 rounded-full flex items-center justify-center text-white"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setImgIdx(i => (i + 1) % displayPhotos.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/60 rounded-full flex items-center justify-center text-white"
            >
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-md">
              {imgIdx + 1} / {displayPhotos.length}
            </div>
          </>
        )}
      </div>

      {/* Desktop: Airbnb-style grid */}
      <div className="hidden sm:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        {displayPhotos.length === 1 ? (
          <div className="relative h-[460px] rounded-2xl overflow-hidden cursor-pointer" onClick={() => openLightbox(0)}>
            <img src={displayPhotos[0].url} alt={property.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="relative">
            <div className={`grid gap-2 h-[460px] rounded-2xl overflow-hidden ${displayPhotos.length >= 5 ? 'grid-cols-4 grid-rows-2' : displayPhotos.length >= 3 ? 'grid-cols-3 grid-rows-2' : 'grid-cols-2'}`}>
              {/* Large photo */}
              <div
                className={`relative cursor-pointer overflow-hidden ${displayPhotos.length >= 3 ? 'col-span-2 row-span-2' : 'col-span-1'}`}
                onClick={() => openLightbox(0)}
              >
                <img src={displayPhotos[0].url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
              </div>
              {/* Smaller photos */}
              {displayPhotos.slice(1, 5).map((photo, i) => (
                <div
                  key={photo.id + i}
                  className="relative cursor-pointer overflow-hidden"
                  onClick={() => openLightbox(i + 1)}
                >
                  <img src={photo.url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                  {/* Caption overlay */}
                  {photo.caption && (
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
                      <p className="text-white text-xs truncate">{photo.caption}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* "Ver todas" button */}
            {displayPhotos.length > 5 && (
              <button
                onClick={() => openLightbox(0)}
                className="absolute bottom-4 right-4 flex items-center gap-2 bg-white text-black text-sm font-semibold px-4 py-2 rounded-xl hover:bg-white/90 transition-colors shadow-lg"
              >
                <Grid2x2 size={15} />
                Ver todas as {displayPhotos.length} fotos
              </button>
            )}
          </div>
        )}

        {/* Room tabs (if multiple rooms) */}
        {roomGroups.length > 1 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {roomGroups.map(g => (
              <button
                key={g.id ?? 'geral'}
                onClick={() => {
                  const idx = allPhotos.findIndex(p => p.roomName === g.name)
                  if (idx >= 0) openLightbox(idx)
                }}
                className="shrink-0 px-3 py-1.5 text-xs font-medium border border-[#333] rounded-full text-[#B3B3B3] hover:border-[#555] hover:text-white transition-colors"
              >
                {g.name} <span className="text-[#555]">({g.photos.length})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-28 lg:pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-[#B3B3B3] uppercase tracking-wide bg-[#2A2A2A] px-2.5 py-1 rounded-md">
                      {property.type}
                    </span>
                    {property.plan === 'DESTAQUE' && (
                      <span className="text-xs font-bold text-black bg-[#F5A623] px-2.5 py-1 rounded-md">
                        DESTAQUE
                      </span>
                    )}
                  </div>
                  <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">{property.name}</h1>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {property.rating && (
                      <div className="flex items-center gap-1">
                        <Star size={14} className="fill-[#F5A623] text-[#F5A623]" />
                        <span className="text-sm font-semibold text-white">{property.rating.toFixed(1)}</span>
                        <span className="text-sm text-[#B3B3B3]">({property.reviews_count})</span>
                      </div>
                    )}
                    <span className="text-[#444]">·</span>
                    <div className="flex items-center gap-1 text-[#B3B3B3] text-sm">
                      <MapPin size={13} />
                      {property.neighborhood ? `${property.neighborhood}, ` : ''}{property.city}, {property.state}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={toggleFavorite}
                    className="w-10 h-10 rounded-xl bg-[#1F1F1F] border border-[#333] flex items-center justify-center hover:bg-[#2A2A2A] transition-colors"
                  >
                    <Heart size={18} className={isFavorited ? 'fill-[#E50914] text-[#E50914]' : 'text-[#B3B3B3]'} />
                  </button>
                  <button
                    onClick={handleShare}
                    className="w-10 h-10 rounded-xl bg-[#1F1F1F] border border-[#333] flex items-center justify-center hover:bg-[#2A2A2A] transition-colors"
                    title="Compartilhar imóvel"
                  >
                    <Share2 size={18} className="text-[#B3B3B3]" />
                  </button>
                </div>
              </div>

              {/* Quick stats */}
              <div className="flex gap-4 mt-4 flex-wrap">
                <Stat icon={<Users size={15} />} label={`${property.max_guests} hóspedes`} />
                <Stat icon={<BedDouble size={15} />} label={`${property.bedrooms} quarto${property.bedrooms !== 1 ? 's' : ''}`} />
                <Stat icon={<Bath size={15} />} label={`${property.bathrooms} banheiro${property.bathrooms !== 1 ? 's' : ''}`} />
              </div>
            </motion.div>

            {/* Description */}
            <section>
              <h2 className="font-display text-xl font-bold text-white mb-3">Sobre o imóvel</h2>
              <p className="text-[#B3B3B3] leading-relaxed whitespace-pre-line">
                {property.description ?? 'Imóvel disponível para locação por temporada.'}
              </p>
            </section>

            {/* Amenities */}
            <section>
              <h2 className="font-display text-xl font-bold text-white mb-4">Comodidades</h2>
              {propertyAmenities.length > 0 ? (() => {
                // Group catalog amenities by category
                const byCategory: Record<string, PropertyAmenity[]> = {}
                for (const pa of propertyAmenities) {
                  const cat = pa.amenity?.category ?? 'Outros'
                  if (!byCategory[cat]) byCategory[cat] = []
                  byCategory[cat].push(pa)
                }
                // Parse custom amenities (CUSTOM::category::name format)
                const customByCategory: Record<string, string[]> = {}
                for (const n of (property.amenities ?? [])) {
                  if (!n.startsWith('CUSTOM::')) continue
                  const parts = n.split('::')
                  const cat = parts[1] ?? 'Extras'
                  if (!customByCategory[cat]) customByCategory[cat] = []
                  customByCategory[cat].push(parts.slice(2).join('::'))
                }
                const allCategories = Array.from(new Set([...Object.keys(byCategory), ...Object.keys(customByCategory)]))
                return (
                  <div className="space-y-5">
                    {allCategories.map(category => (
                      <div key={category}>
                        <h3 className="text-xs font-bold text-[#555] uppercase tracking-wider mb-3">{category}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {(byCategory[category] ?? []).map(pa => (
                            <div key={pa.amenity_id} className="flex items-center gap-2 text-sm text-[#B3B3B3]">
                              <AmenityIcon name={pa.amenity?.icon ?? null} className="text-[#46D369] flex-shrink-0" />
                              <span className="truncate">{pa.amenity?.name ?? ''}</span>
                            </div>
                          ))}
                          {(customByCategory[category] ?? []).map(name => (
                            <div key={name} className="flex items-center gap-2 text-sm text-[#B3B3B3]">
                              <PlusCircle size={15} className="text-[#46D369] flex-shrink-0" />
                              <span className="truncate">{name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })() : property.amenities.length > 0 ? (
                // Fallback: legacy amenities[]
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {property.amenities.map(a => (
                    <div key={a} className="flex items-center gap-2 text-sm text-[#B3B3B3]">
                      <Check size={14} className="text-[#46D369] flex-shrink-0" />
                      {a}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#666]">Detalhes em breve.</p>
              )}
            </section>

            {/* Cancellation policy */}
            <section>
              <h2 className="font-display text-xl font-bold text-white mb-3">Política de cancelamento</h2>
              <CancellationInfo policy={property.cancellation_policy} />
            </section>

            {/* Reviews */}
            {reviews.length > 0 && (
              <section>
                <div className="flex items-center gap-4 mb-6 flex-wrap">
                  <h2 className="font-display text-xl font-bold text-white">Avaliações do Anfitrião</h2>
                  {reviews.length > 0 && (
                    <div className="flex items-center gap-2">
                      {property.rating && <RatingStars value={property.rating} size={15} />}
                      {property.rating && <span className="text-sm font-bold text-white">{property.rating.toFixed(1)}</span>}
                      <span className="text-sm text-[#B3B3B3]">
                        · {reviews.length} avaliação{reviews.length !== 1 ? 'ões' : ''}
                      </span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {reviews.map(r => <ReviewCard key={r.id} review={r} currentPropertyId={property.id} />)}
                </div>
              </section>
            )}

            {/* Owner */}
            {property.owner && (
              <section className="flex items-start gap-4 p-5 bg-[#1F1F1F] border border-[#333] rounded-xl">
                <div className="w-14 h-14 rounded-full bg-[#E50914] flex items-center justify-center text-xl font-bold text-white flex-shrink-0 overflow-hidden">
                  {property.owner.avatar_url
                    ? <img src={property.owner.avatar_url} alt="" className="w-full h-full object-cover" />
                    : (property.owner.name?.[0] ?? 'A')
                  }
                </div>
                <div>
                  <p className="text-xs text-[#B3B3B3]">Anfitrião</p>
                  <p className="font-semibold text-white">{property.owner.name?.split(' ')[0]}</p>
                  <p className="text-xs text-[#666] mt-0.5">
                    Membro desde {(() => { const y = new Date(property.owner.created_at ?? property.created_at ?? '').getFullYear(); return isNaN(y) ? '—' : y })()}
                  </p>
                </div>
              </section>
            )}
          </div>

          {/* Booking card (right column — hidden on mobile, shown on lg+) */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-24">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-[#1F1F1F] border border-[#333] rounded-2xl p-6 shadow-2xl"
              >
                {/* Price / installment preview */}
                {nights > 0 ? (
                  <div className="mb-5">
                    <p className="text-2xl font-bold text-white">
                      até {calculateMaxInstallments(checkIn)}x de {formatCurrency((subtotal + fee) / calculateMaxInstallments(checkIn))}
                    </p>
                    <p className="text-xs text-[#B3B3B3] mt-0.5">
                      {nights} {nights === 1 ? 'noite' : 'noites'} · total {formatCurrency(subtotal + fee)}
                    </p>
                  </div>
                ) : (
                  <div className="mb-5">
                    {pricePeriods.length > 0 ? (
                      <>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-bold text-white">{formatCurrency(getMinPrice(pricePeriods, property.price_per_night))}</span>
                          <span className="text-sm text-[#B3B3B3]">/ noite</span>
                        </div>
                        <p className="text-xs text-[#555] mt-1">Preço varia por período — selecione as datas</p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-bold text-white">{formatCurrency(property.price_per_night)}</span>
                          <span className="text-sm text-[#B3B3B3]">/ noite</span>
                        </div>
                        <p className="text-xs text-[#555] mt-1">Selecione as datas para ver o parcelamento</p>
                      </>
                    )}
                    {pricePeriods.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {pricePeriods.slice(0, 3).map(p => (
                          <div key={p.id} className="flex items-center justify-between text-xs">
                            <span className="text-[#666]">{p.name}</span>
                            <span className="text-white font-medium">{formatCurrency(p.price_per_night)}</span>
                          </div>
                        ))}
                        {pricePeriods.length > 3 && (
                          <p className="text-xs text-[#555]">+{pricePeriods.length - 3} outros períodos</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Date picker button */}
                <div className="relative mb-3" ref={calendarRef}>
                  <button
                    type="button"
                    onClick={() => setCalendarOpen(v => !v)}
                    className={`w-full flex items-center gap-3 border rounded-xl px-4 py-3 text-left transition-all ${calendarOpen ? 'border-[#E50914] bg-[#E50914]/5' : 'border-[#333] hover:border-[#555]'}`}
                  >
                    <Calendar size={16} className="text-[#E50914] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      {checkIn && checkOut ? (
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="text-[9px] text-[#B3B3B3] uppercase font-semibold">Check-in</p>
                            <p className="text-sm font-semibold text-white">
                              {format(new Date(checkIn + 'T00:00:00'), 'dd MMM', { locale: ptBR })}
                            </p>
                          </div>
                          <div className="h-8 w-px bg-[#333]" />
                          <div>
                            <p className="text-[9px] text-[#B3B3B3] uppercase font-semibold">Check-out</p>
                            <p className="text-sm font-semibold text-white">
                              {format(new Date(checkOut + 'T00:00:00'), 'dd MMM', { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      ) : checkIn ? (
                        <div>
                          <p className="text-[9px] text-[#B3B3B3] uppercase font-semibold">Check-in</p>
                          <p className="text-sm font-semibold text-white">
                            {format(new Date(checkIn + 'T00:00:00'), 'dd MMM', { locale: ptBR })}
                            <span className="text-[#666] font-normal ml-2">→ selecione saída</span>
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-[#666]">Selecionar datas</p>
                      )}
                    </div>
                  </button>
                  {calendarOpen && (
                    <div className="absolute top-full right-0 mt-2 z-50 w-max max-w-[calc(100vw-2rem)]">
                      <DateRangePicker
                        from={checkIn}
                        to={checkOut}
                        onChange={(f, t) => { setCheckIn(f); setCheckOut(t) }}
                        onClose={() => setCalendarOpen(false)}
                      />
                    </div>
                  )}
                </div>

                {/* Guests */}
                <div className="border border-[#333] rounded-xl p-3 mb-5">
                  <p className="text-[10px] font-bold text-[#B3B3B3] uppercase tracking-wide mb-1">Hóspedes</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white">{guests} {guests === 1 ? 'hóspede' : 'hóspedes'}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setGuests(g => Math.max(1, g - 1))}
                        className="w-7 h-7 rounded-full bg-[#2A2A2A] border border-[#444] text-white text-sm flex items-center justify-center hover:bg-[#333] transition-colors"
                      >
                        -
                      </button>
                      <span className="w-4 text-center text-sm text-white">{guests}</span>
                      <button
                        onClick={() => setGuests(g => Math.min(property.max_guests, g + 1))}
                        className="w-7 h-7 rounded-full bg-[#2A2A2A] border border-[#444] text-white text-sm flex items-center justify-center hover:bg-[#333] transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <Button onClick={handleReserve} fullWidth size="lg">
                  {user ? 'Reservar agora' : 'Entrar para reservar'}
                </Button>
                <p className="text-center text-xs text-[#666] mt-2">Sem cobrança ainda</p>

                {hasActiveBooking && (
                  <Link to={APP_ROUTES.MESSAGES} className="mt-3 block">
                    <Button variant="ghost" fullWidth className="gap-2">
                      <MessageSquare size={15} />
                      Falar com anfitrião
                    </Button>
                  </Link>
                )}

                {/* Price breakdown */}
                {nights > 0 && (
                  <div className="mt-5 pt-5 border-t border-[#333] space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#B3B3B3]">{formatCurrency(property.price_per_night)} × {nights} noites</span>
                      <span className="text-white">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#B3B3B3]">Taxa de serviço</span>
                      <span className="text-white">{formatCurrency(fee)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold pt-2 border-t border-[#333]">
                      <span className="text-white">Total</span>
                      <span className="text-[#F5A623] text-base">{formatCurrency(subtotal + fee)}</span>
                    </div>
                    <p className="text-xs text-[#46D369] text-center mt-1">
                      em até {calculateMaxInstallments(checkIn)}x sem juros
                    </p>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile fixed booking bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-[#141414] border-t border-[#333] px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {nights > 0 ? (
            <>
              <p className="text-xs text-[#B3B3B3]">{nights} {nights === 1 ? 'noite' : 'noites'}</p>
              <p className="text-base font-bold text-white">{formatCurrency(subtotal + fee)}</p>
            </>
          ) : (
            <>
              <p className="text-xs text-[#B3B3B3]">a partir de</p>
              <p className="text-base font-bold text-white">
                {formatCurrency(property.price_per_night)}
                <span className="text-xs font-normal text-[#666]"> /noite</span>
              </p>
            </>
          )}
        </div>
        <Button onClick={handleReserve} size="sm" className="flex-shrink-0">
          {user ? 'Reservar agora' : 'Entrar'}
        </Button>
      </div>
    </div>
  )
}

function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-[#B3B3B3]">
      <span className="text-[#666]">{icon}</span>
      {label}
    </div>
  )
}

function CancellationInfo({ policy }: { policy: string }) {
  const info: Record<string, { label: string; color: string; details: string }> = {
    LEVE: {
      label: 'Leve',
      color: 'text-[#46D369]',
      details: 'Cancelamento gratuito até 48h antes do check-in. Após esse prazo, não há reembolso.',
    },
    MODERADO: {
      label: 'Moderada',
      color: 'text-[#F5A623]',
      details: 'Cancelamento gratuito até 15 dias antes do check-in. Sem reembolso após esse prazo.',
    },
    FIRME: {
      label: 'Firme',
      color: 'text-[#E50914]',
      details: 'Cancelamento gratuito até 30 dias antes do check-in. Sem reembolso após esse prazo.',
    },
  }
  const p = info[policy] ?? info.MODERADO
  return (
    <div className="bg-[#1F1F1F] border border-[#333] rounded-xl p-4">
      <p className={`text-sm font-semibold mb-1 ${p.color}`}>{p.label}</p>
      <p className="text-sm text-[#B3B3B3]">{p.details}</p>
    </div>
  )
}

// ── Reviews ──────────────────────────────────────────────────

function RatingStars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          className={i <= Math.round(value)
            ? 'fill-[#F5A623] text-[#F5A623]'
            : 'fill-[#333] text-[#333]'
          }
        />
      ))}
    </div>
  )
}

function formatReviewDate(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Ontem'
  if (diff < 30) return `há ${diff} dias`
  const months = Math.floor(diff / 30)
  if (months === 1) return 'há 1 mês'
  if (months < 12) return `há ${months} meses`
  const years = Math.floor(diff / 365)
  return `há ${years} ano${years > 1 ? 's' : ''}`
}

function ReviewCard({ review, currentPropertyId }: { review: ReviewWithProperty; currentPropertyId: string }) {
  const name = review.reviewer?.name ?? 'Hóspede verificado'
  const initial = name[0].toUpperCase()
  const showProperty = review.property && review.target_property_id !== currentPropertyId
  return (
    <div className="bg-[#1F1F1F] border border-[#2A2A2A] rounded-xl p-4 flex flex-col gap-3">
      {/* Header: avatar + nome + data + estrelas */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E50914] to-[#F5A623] flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden">
          {review.reviewer?.avatar_url
            ? <img src={review.reviewer.avatar_url} alt="" className="w-full h-full object-cover" />
            : initial
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white truncate">{name}</p>
            <RatingStars value={review.rating} size={12} />
          </div>
          <p className="text-xs text-[#555] mt-0.5">{formatReviewDate(review.created_at)}</p>
          {showProperty && (
            <p className="text-[11px] text-[#666] mt-0.5 truncate">Imóvel: {review.property!.name}</p>
          )}
        </div>
      </div>
      {/* Comment */}
      {review.comment && (
        <p className="text-sm text-[#B3B3B3] leading-relaxed">{review.comment}</p>
      )}
    </div>
  )
}
