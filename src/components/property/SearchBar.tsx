import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MapPin, Calendar, Users, ChevronDown, X } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import { Button } from '../ui/Button'
import { DateRangePicker } from '../ui/DateRangePicker'
import { APP_ROUTES, BRASIL_STATES } from '../../constants'
import { MOCK_PROPERTIES } from '../../constants/mocks'

interface GuestsState {
  adults: number
  children: number
  babies: number
  pets: number
}

interface SearchBarProps {
  compact?: boolean
  defaultValues?: {
    estado?: string
    cidade?: string
    bairro?: string
    checkIn?: string
    checkOut?: string
    adults?: number
    children?: number
    babies?: number
    pets?: number
  }
}

type Panel = 'destino' | 'datas' | 'hospedes' | null

interface CityData { count: number; neighborhoods: string[] }
interface StateData { count: number; name: string; cities: Record<string, CityData> }

function useOutsideClick(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, onClose])
}

function Counter({
  label, sub, value, min = 0, max = 20, onChange,
}: { label: string; sub: string; value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#2A2A2A] last:border-0">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-[#666]">{sub}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-8 h-8 rounded-full border border-[#444] flex items-center justify-center text-white hover:border-[#888] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          −
        </button>
        <span className="w-4 text-center text-sm font-semibold text-white">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-8 h-8 rounded-full border border-[#444] flex items-center justify-center text-white hover:border-[#888] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>
    </div>
  )
}

function buildLocationMap(items: { state: string; city: string; neighborhood: string | null }[]): Record<string, StateData> {
  const map: Record<string, StateData> = {}
  for (const p of items) {
    if (!p.state) continue
    if (!map[p.state]) {
      const found = BRASIL_STATES.find(s => s.uf === p.state)
      map[p.state] = { count: 0, name: found?.name ?? p.state, cities: {} }
    }
    map[p.state].count++
    if (p.city) {
      if (!map[p.state].cities[p.city]) {
        map[p.state].cities[p.city] = { count: 0, neighborhoods: [] }
      }
      map[p.state].cities[p.city].count++
      if (p.neighborhood && !map[p.state].cities[p.city].neighborhoods.includes(p.neighborhood)) {
        map[p.state].cities[p.city].neighborhoods.push(p.neighborhood)
      }
    }
  }
  return map
}

export function SearchBar({ compact = false, defaultValues }: SearchBarProps) {
  const navigate = useNavigate()

  const [estado, setEstado] = useState(defaultValues?.estado ?? '')
  const [cidade, setCidade] = useState(defaultValues?.cidade ?? '')
  const [bairro, setBairro] = useState(defaultValues?.bairro ?? '')
  const [checkIn, setCheckIn] = useState(defaultValues?.checkIn ?? '')
  const [checkOut, setCheckOut] = useState(defaultValues?.checkOut ?? '')
  const [guests, setGuests] = useState<GuestsState>({
    adults: defaultValues?.adults ?? 1,
    children: defaultValues?.children ?? 0,
    babies: defaultValues?.babies ?? 0,
    pets: defaultValues?.pets ?? 0,
  })
  const [panel, setPanel] = useState<Panel>(null)
  const [locationMap, setLocationMap] = useState<Record<string, StateData>>({})

  const containerRef = useRef<HTMLDivElement>(null)
  useOutsideClick(containerRef, () => setPanel(null))

  // Load available states/cities/neighborhoods from DB (or mocks as fallback)
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('properties')
        .select('state, city, neighborhood')
        .eq('status', 'ATIVO')
      const source = (data && data.length > 0)
        ? data as { state: string; city: string; neighborhood: string | null }[]
        : MOCK_PROPERTIES.map(p => ({ state: p.state, city: p.city, neighborhood: p.neighborhood ?? null }))
      setLocationMap(buildLocationMap(source))
    }
    load()
  }, [])

  function togglePanel(p: Panel) {
    setPanel(prev => (prev === p ? null : p))
  }

  function buildParams() {
    const params = new URLSearchParams()
    if (estado) params.set('estado', estado)
    if (cidade) params.set('cidade', cidade)
    if (bairro) params.set('bairro', bairro)
    if (checkIn) params.set('entrada', checkIn)
    if (checkOut) params.set('saida', checkOut)
    const totalGuests = guests.adults + guests.children
    if (totalGuests > 0) params.set('hospedes', String(totalGuests))
    if (guests.babies > 0) params.set('bebes', String(guests.babies))
    if (guests.pets > 0) params.set('pets', String(guests.pets))
    return params
  }

  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault()
    setPanel(null)
    navigate(`${APP_ROUTES.HOME}?${buildParams().toString()}`)
  }

  const dateLabel = (() => {
    if (checkIn && checkOut) {
      const from = format(new Date(checkIn + 'T00:00:00'), 'dd MMM', { locale: ptBR })
      const to = format(new Date(checkOut + 'T00:00:00'), 'dd MMM', { locale: ptBR })
      return `${from} → ${to}`
    }
    if (checkIn) return format(new Date(checkIn + 'T00:00:00'), 'dd MMM', { locale: ptBR })
    return null
  })()

  const guestsTotal = guests.adults + guests.children
  const guestsLabel = (() => {
    const parts: string[] = []
    if (guestsTotal > 0) parts.push(`${guestsTotal} hóspede${guestsTotal !== 1 ? 's' : ''}`)
    if (guests.babies > 0) parts.push(`${guests.babies} bebê${guests.babies !== 1 ? 's' : ''}`)
    if (guests.pets > 0) parts.push(`${guests.pets} pet${guests.pets !== 1 ? 's' : ''}`)
    return parts.join(', ') || null
  })()

  const selectedStateName = estado ? (locationMap[estado]?.name ?? BRASIL_STATES.find(s => s.uf === estado)?.name ?? estado) : null
  const destinoLabel = [selectedStateName, cidade, bairro].filter(Boolean).join(', ') || null

  // Derived lists
  const availableStates = Object.entries(locationMap).sort((a, b) => b[1].count - a[1].count)
  const availableCities = estado && locationMap[estado]
    ? Object.entries(locationMap[estado].cities).sort((a, b) => b[1].count - a[1].count)
    : []
  const availableNeighborhoods = estado && cidade && locationMap[estado]?.cities[cidade]
    ? locationMap[estado].cities[cidade].neighborhoods.sort()
    : []

  if (compact) {
    return (
      <form onSubmit={handleSearch} className="flex items-center gap-2 bg-[#1F1F1F] border border-[#333] rounded-full px-4 py-2">
        <Search size={16} className="text-[#666]" />
        <span className="text-sm text-white flex-1 truncate">
          {destinoLabel ?? 'Para onde você vai?'}
        </span>
        <button type="submit" className="bg-[#E50914] text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-[#F40612] transition-colors flex-shrink-0">
          Buscar
        </button>
      </form>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <form
        onSubmit={handleSearch}
        className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-2 flex flex-col md:flex-row gap-2"
      >
        {/* ── Destino ── */}
        <button
          type="button"
          onClick={() => togglePanel('destino')}
          className={`flex items-center gap-3 flex-1 bg-[#1F1F1F]/80 rounded-xl px-4 py-3 text-left transition-all ${panel === 'destino' ? 'ring-2 ring-[#E50914]' : 'hover:bg-[#2A2A2A]/80'}`}
        >
          <MapPin size={18} className="text-[#E50914] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-[#B3B3B3] uppercase tracking-wide">Destino</p>
            <p className="text-sm truncate mt-0.5 font-medium" style={{ color: destinoLabel ? 'white' : '#666' }}>
              {destinoLabel ?? 'Estado, cidade ou bairro'}
            </p>
          </div>
          {destinoLabel && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setEstado(''); setCidade(''); setBairro('') }}
              className="text-[#555] hover:text-white transition-colors flex-shrink-0"
            >
              <X size={14} />
            </button>
          )}
        </button>

        {/* ── Datas ── */}
        <button
          type="button"
          onClick={() => togglePanel('datas')}
          className={`flex items-center gap-3 md:w-52 bg-[#1F1F1F]/80 rounded-xl px-4 py-3 text-left transition-all ${panel === 'datas' ? 'ring-2 ring-[#E50914]' : 'hover:bg-[#2A2A2A]/80'}`}
        >
          <Calendar size={18} className="text-[#E50914] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-[#B3B3B3] uppercase tracking-wide">Datas</p>
            <p className="text-sm truncate mt-0.5 font-medium" style={{ color: dateLabel ? 'white' : '#666' }}>
              {dateLabel ?? 'Check-in → Check-out'}
            </p>
          </div>
          {dateLabel && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setCheckIn(''); setCheckOut('') }}
              className="text-[#555] hover:text-white transition-colors flex-shrink-0"
            >
              <X size={14} />
            </button>
          )}
        </button>

        {/* ── Hóspedes ── */}
        <button
          type="button"
          onClick={() => togglePanel('hospedes')}
          className={`flex items-center gap-3 md:w-44 bg-[#1F1F1F]/80 rounded-xl px-4 py-3 text-left transition-all ${panel === 'hospedes' ? 'ring-2 ring-[#E50914]' : 'hover:bg-[#2A2A2A]/80'}`}
        >
          <Users size={18} className="text-[#E50914] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-[#B3B3B3] uppercase tracking-wide">Hóspedes</p>
            <p className="text-sm truncate mt-0.5 font-medium" style={{ color: guestsLabel ? 'white' : '#666' }}>
              {guestsLabel ?? 'Adicionar hóspedes'}
            </p>
          </div>
          <ChevronDown size={14} className={`text-[#666] flex-shrink-0 transition-transform ${panel === 'hospedes' ? 'rotate-180' : ''}`} />
        </button>

        {/* ── Search button ── */}
        <Button type="submit" size="lg" className="rounded-xl px-8 flex-shrink-0">
          <Search size={18} />
          Buscar
        </Button>
      </form>

      {/* ── Destino panel ── */}
      {panel === 'destino' && (
        <div className="absolute top-full left-0 mt-2 z-50 w-full md:w-96 bg-[#1A1A1A] border border-[#333] rounded-2xl shadow-2xl p-5">

          {/* Estado */}
          <p className="text-xs font-semibold text-[#B3B3B3] uppercase tracking-wide mb-2">Estado</p>
          {availableStates.length === 0 ? (
            <p className="text-xs text-[#555] mb-4">Carregando...</p>
          ) : (
            <div className="relative mb-4">
              <select
                value={estado}
                onChange={e => { setEstado(e.target.value); setCidade(''); setBairro('') }}
                className="w-full bg-[#2A2A2A] border border-[#333] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-[#E50914] appearance-none cursor-pointer"
              >
                <option value="">Selecione um estado</option>
                {availableStates.map(([uf, data]) => (
                  <option key={uf} value={uf}>
                    {data.name} ({data.count} {data.count === 1 ? 'imóvel' : 'imóveis'})
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] pointer-events-none" />
            </div>
          )}

          {/* Cidade */}
          {estado && availableCities.length > 0 && (
            <>
              <p className="text-xs font-semibold text-[#B3B3B3] uppercase tracking-wide mb-2">Cidade</p>
              <div className="relative mb-4">
                <select
                  value={cidade}
                  onChange={e => { setCidade(e.target.value); setBairro('') }}
                  autoFocus
                  className="w-full bg-[#2A2A2A] border border-[#333] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-[#E50914] appearance-none cursor-pointer"
                >
                  <option value="">Selecione uma cidade</option>
                  {availableCities.map(([city, data]) => (
                    <option key={city} value={city}>
                      {city} ({data.count} {data.count === 1 ? 'imóvel' : 'imóveis'})
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] pointer-events-none" />
              </div>
            </>
          )}

          {/* Bairro */}
          {estado && cidade && availableNeighborhoods.length > 0 && (
            <>
              <p className="text-xs font-semibold text-[#B3B3B3] uppercase tracking-wide mb-2">
                Bairro <span className="text-[#555] normal-case font-normal">(opcional)</span>
              </p>
              <div className="relative mb-4">
                <select
                  value={bairro}
                  onChange={e => setBairro(e.target.value)}
                  className="w-full bg-[#2A2A2A] border border-[#333] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-[#E50914] appearance-none cursor-pointer"
                >
                  <option value="">Qualquer bairro</option>
                  {availableNeighborhoods.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] pointer-events-none" />
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => setPanel(null)}
            className="w-full mt-1 py-2 bg-[#E50914] hover:bg-[#F40612] text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Confirmar
          </button>
        </div>
      )}

      {/* ── Datas panel ── */}
      {panel === 'datas' && (
        <div className="absolute top-full left-0 mt-2 z-50 w-full md:max-w-2xl">
          <DateRangePicker
            from={checkIn}
            to={checkOut}
            onChange={(f, t) => { setCheckIn(f); setCheckOut(t) }}
            onClose={() => setPanel(null)}
          />
        </div>
      )}

      {/* ── Hóspedes panel ── */}
      {panel === 'hospedes' && (
        <div className="absolute top-full right-0 mt-2 z-50 w-80 bg-[#1A1A1A] border border-[#333] rounded-2xl shadow-2xl p-5">
          <Counter
            label="Adultos"
            sub="13 anos ou mais"
            value={guests.adults}
            min={1}
            onChange={v => setGuests(g => ({ ...g, adults: v }))}
          />
          <Counter
            label="Crianças"
            sub="2 a 12 anos"
            value={guests.children}
            onChange={v => setGuests(g => ({ ...g, children: v }))}
          />
          <Counter
            label="Bebês"
            sub="Menos de 2 anos"
            value={guests.babies}
            onChange={v => setGuests(g => ({ ...g, babies: v }))}
          />
          <Counter
            label="Pets"
            sub="Animais de estimação"
            value={guests.pets}
            onChange={v => setGuests(g => ({ ...g, pets: v }))}
          />
          <button
            type="button"
            onClick={() => setPanel(null)}
            className="w-full mt-4 py-2 bg-[#E50914] hover:bg-[#F40612] text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Confirmar
          </button>
        </div>
      )}
    </div>
  )
}
