import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star, MapPin, Users, BedDouble, Bath, ChevronLeft, ChevronRight, Heart, Share2, Check, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import type { Property } from '../types'
import { MOCK_PROPERTIES } from '../constants/mocks'
import { APP_ROUTES } from '../constants'
import { formatCurrency, calculateMaxInstallments } from '../lib/utils'
import { Button } from '../components/ui/Button'
import { DateRangePicker } from '../components/ui/DateRangePicker'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'

export function PropertyDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { toast } = useToast()

  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [imgIdx, setImgIdx] = useState(0)
  const [checkIn, setCheckIn] = useState(() => searchParams.get('entrada') ?? '')
  const [checkOut, setCheckOut] = useState(() => searchParams.get('saida') ?? '')
  const [guests, setGuests] = useState(() => Number(searchParams.get('hospedes') ?? 2))
  const [isFavorited, setIsFavorited] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    loadProperty(id)
  }, [id])

  async function loadProperty(propertyId: string) {
    const { data } = await supabase
      .from('properties')
      .select('*, owner:users(id, name, avatar_url, created_at)')
      .eq('id', propertyId)
      .single()

    if (data) {
      setProperty(data as Property)
    } else {
      const mock = MOCK_PROPERTIES.find(p => p.id === propertyId)
      setProperty(mock ?? null)
    }
    setLoading(false)
  }

  function calcNights() {
    if (!checkIn || !checkOut) return 0
    const d1 = new Date(checkIn).getTime()
    const d2 = new Date(checkOut).getTime()
    return Math.max(0, Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)))
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
    if (isFavorited) {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('property_id', id)
    } else {
      await supabase.from('favorites').insert({ user_id: user.id, property_id: id })
    }
    setIsFavorited(v => !v)
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

  const photos = property.photos.length > 0
    ? property.photos
    : ['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200']

  return (
    <div className="min-h-screen bg-[#141414] pt-24">
      {/* Gallery */}
      <div className="relative h-[50vh] sm:h-[60vh] bg-[#0A0A0A] overflow-hidden group">
        <img
          src={photos[imgIdx]}
          alt={property.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] to-transparent" />

        {/* Photo nav */}
        {photos.length > 1 && (
          <>
            <button
              onClick={() => setImgIdx(i => (i - 1 + photos.length) % photos.length)}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setImgIdx(i => (i + 1) % photos.length)}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight size={20} />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${i === imgIdx ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Thumbnails strip */}
        {photos.length > 1 && (
          <div className="absolute bottom-4 right-4 flex gap-2">
            {photos.slice(0, 5).map((src, i) => (
              <button
                key={i}
                onClick={() => setImgIdx(i)}
                className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${i === imgIdx ? 'border-white' : 'border-transparent opacity-60'}`}
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                  <button className="w-10 h-10 rounded-xl bg-[#1F1F1F] border border-[#333] flex items-center justify-center hover:bg-[#2A2A2A] transition-colors">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {property.amenities.map(a => (
                  <div key={a} className="flex items-center gap-2 text-sm text-[#B3B3B3]">
                    <Check size={14} className="text-[#46D369] flex-shrink-0" />
                    {a}
                  </div>
                ))}
                {property.amenities.length === 0 && (
                  <p className="text-sm text-[#666] col-span-full">Detalhes em breve.</p>
                )}
              </div>
            </section>

            {/* Cancellation policy */}
            <section>
              <h2 className="font-display text-xl font-bold text-white mb-3">Política de cancelamento</h2>
              <CancellationInfo policy={property.cancellation_policy} />
            </section>

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
                    Membro desde {new Date(property.owner.created_at ?? property.created_at).getFullYear()}
                  </p>
                </div>
              </section>
            )}
          </div>

          {/* Booking card (right column) */}
          <div className="lg:col-span-1">
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
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-white">{formatCurrency(property.price_per_night)}</span>
                      <span className="text-sm text-[#B3B3B3]">/ noite</span>
                    </div>
                    <p className="text-xs text-[#555] mt-1">Selecione as datas para ver o parcelamento</p>
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

                {/* Price breakdown */}
                {nights > 0 && (
                  <div className="mt-5 pt-5 border-t border-[#333] space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#B3B3B3]">{formatCurrency(property.price_per_night)} × {nights} noites</span>
                      <span className="text-white">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#B3B3B3]">Taxa de serviço (5%)</span>
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
    FLEXIVEL: {
      label: 'Flexível',
      color: 'text-[#46D369]',
      details: 'Cancelamento gratuito até 24h antes do check-in. Após esse prazo, não há reembolso.',
    },
    MODERADO: {
      label: 'Moderado',
      color: 'text-[#F5A623]',
      details: 'Cancelamento gratuito até 5 dias antes. Reembolso de 50% entre 2 e 5 dias. Sem reembolso a menos de 2 dias.',
    },
    FIRME: {
      label: 'Firme',
      color: 'text-[#E50914]',
      details: 'Cancelamento gratuito até 14 dias antes. Reembolso de 50% entre 7 e 14 dias. Sem reembolso a menos de 7 dias.',
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
