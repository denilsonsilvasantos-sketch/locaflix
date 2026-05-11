import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MapPin, Calendar, Users, ChevronDown, ChevronLeft, ChevronRight, X, Check } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
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
type DestinoStep = 'estado' | 'cidade' | 'bairro'

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
    <div className="flex items-center justify-between py-3.5 border-b border-[#2A2A2A] last:border-0">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-[#666]">{sub}</p>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-9 h-9 rounded-full border border-[#444] flex items-center justify-center text-white text-lg hover:border-[#E50914] hover:text-[#E50914] transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
        >
          −
        </button>
        <span className="w-5 text-center text-base font-semibold text-white tabular-nums">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-9 h-9 rounded-full border border-[#444] flex items-center justify-center text-white text-lg hover:border-[#E50914] hover:text-[#E50914] transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
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

// ── Bottom Sheet (mobile only) ────────────────────────────────────────────────
function BottomSheet({
  open, onClose, title, children,
}: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] md:hidden">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-[#1A1A1A] rounded-t-3xl" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-[#444] rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2A2A2A]">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#2A2A2A] flex items-center justify-center text-[#B3B3B3] hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 pb-8">{children}</div>
      </div>
    </div>
  )
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
  const [destinoStep, setDestinoStep] = useState<DestinoStep>('estado')
  const [locationMap, setLocationMap] = useState<Record<string, StateData>>({})

  const containerRef = useRef<HTMLDivElement>(null)
  useOutsideClick(containerRef, () => setPanel(null))

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('properties').select('state, city, neighborhood').eq('status', 'ATIVO')
      const source = (data && data.length > 0)
        ? data as { state: string; city: string; neighborhood: string | null }[]
        : MOCK_PROPERTIES.map(p => ({ state: p.state, city: p.city, neighborhood: p.neighborhood ?? null }))
      setLocationMap(buildLocationMap(source))
    }
    load()
  }, [])

  const doSearch = useCallback((
    _estado: string, _cidade: string, _bairro: string,
    _checkIn: string, _checkOut: string, _guests: GuestsState,
  ) => {
    const params = new URLSearchParams()
    if (_estado) params.set('estado', _estado)
    if (_cidade) params.set('cidade', _cidade)
    if (_bairro) params.set('bairro', _bairro)
    if (_checkIn) params.set('entrada', _checkIn)
    if (_checkOut) params.set('saida', _checkOut)
    const total = _guests.adults + _guests.children
    if (total > 0) params.set('hospedes', String(total))
    if (_guests.babies > 0) params.set('bebes', String(_guests.babies))
    if (_guests.pets > 0) params.set('pets', String(_guests.pets))
    navigate(`${APP_ROUTES.HOME}?${params.toString()}`)
  }, [navigate])

  // Auto-search when location or dates change
  useEffect(() => {
    if (estado || cidade || bairro || checkIn || checkOut) {
      doSearch(estado, cidade, bairro, checkIn, checkOut, guests)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, cidade, bairro, checkIn, checkOut])

  function togglePanel(p: Panel) {
    if (p === 'destino') setDestinoStep('estado')
    setPanel(prev => (prev === p ? null : p))
  }

  function clearDestino(e: React.MouseEvent) {
    e.stopPropagation()
    setEstado(''); setCidade(''); setBairro('')
    doSearch('', '', '', checkIn, checkOut, guests)
  }

  function clearDatas(e: React.MouseEvent) {
    e.stopPropagation()
    setCheckIn(''); setCheckOut('')
    doSearch(estado, cidade, bairro, '', '', guests)
  }

  // Mobile destino step handlers — use custom lists, no native <select>
  function pickEstado(uf: string) {
    setEstado(uf); setCidade(''); setBairro('')
    const hasCities = Object.keys(locationMap[uf]?.cities ?? {}).length > 0
    if (hasCities) {
      setDestinoStep('cidade')
    } else {
      setPanel(null)
    }
  }

  function pickCidade(city: string) {
    setCidade(city); setBairro('')
    const hasNeighborhoods = (locationMap[estado]?.cities[city]?.neighborhoods ?? []).length > 0
    if (hasNeighborhoods) {
      setDestinoStep('bairro')
    } else {
      setPanel(null)
    }
  }

  function pickBairro(b: string) {
    setBairro(b)
    setPanel(null)
  }

  const dateLabel = (() => {
    if (checkIn && checkOut) {
      const from = format(new Date(checkIn + 'T00:00:00'), 'dd MMM', { locale: ptBR })
      const to   = format(new Date(checkOut + 'T00:00:00'), 'dd MMM', { locale: ptBR })
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

  const selectedStateName = estado
    ? (locationMap[estado]?.name ?? BRASIL_STATES.find(s => s.uf === estado)?.name ?? estado)
    : null
  const destinoLabel = [selectedStateName, cidade, bairro].filter(Boolean).join(', ') || null

  const availableStates       = Object.entries(locationMap).sort((a, b) => b[1].count - a[1].count)
  const availableCities       = estado && locationMap[estado] ? Object.entries(locationMap[estado].cities).sort((a, b) => b[1].count - a[1].count) : []
  const availableNeighborhoods = estado && cidade && locationMap[estado]?.cities[cidade] ? locationMap[estado].cities[cidade].neighborhoods.sort() : []

  // ── Desktop: destino content (native selects — fine with mouse) ───────────
  const destinoDesktop = (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-[#B3B3B3] uppercase tracking-wide mb-2">Estado</p>
        {availableStates.length === 0 ? <p className="text-xs text-[#555]">Carregando...</p> : (
          <div className="relative">
            <select value={estado} onChange={e => { setEstado(e.target.value); setCidade(''); setBairro('') }}
              className="w-full bg-[#2A2A2A] border border-[#333] rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#E50914] appearance-none cursor-pointer">
              <option value="">Selecione um estado</option>
              {availableStates.map(([uf, data]) => (
                <option key={uf} value={uf}>{data.name} ({data.count} {data.count === 1 ? 'imóvel' : 'imóveis'})</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] pointer-events-none" />
          </div>
        )}
      </div>

      {estado && availableCities.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#B3B3B3] uppercase tracking-wide mb-2">Cidade</p>
          <div className="relative">
            <select value={cidade} onChange={e => { setCidade(e.target.value); setBairro('') }}
              className="w-full bg-[#2A2A2A] border border-[#333] rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#E50914] appearance-none cursor-pointer">
              <option value="">Selecione uma cidade</option>
              {availableCities.map(([city, data]) => (
                <option key={city} value={city}>{city} ({data.count} {data.count === 1 ? 'imóvel' : 'imóveis'})</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] pointer-events-none" />
          </div>
        </div>
      )}

      {estado && cidade && availableNeighborhoods.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#B3B3B3] uppercase tracking-wide mb-2">
            Bairro <span className="text-[#555] normal-case font-normal">(opcional)</span>
          </p>
          <div className="relative">
            <select value={bairro} onChange={e => setBairro(e.target.value)}
              className="w-full bg-[#2A2A2A] border border-[#333] rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#E50914] appearance-none cursor-pointer">
              <option value="">Qualquer bairro</option>
              {availableNeighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] pointer-events-none" />
          </div>
        </div>
      )}

      <button type="button" onClick={() => setPanel(null)}
        className="w-full py-3 bg-[#E50914] hover:bg-[#F40612] text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
        <Check size={16} /> Confirmar destino
      </button>
    </div>
  )

  // ── Mobile: destino content (custom lists — no native picker) ─────────────
  const destinoMobile = (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-xs text-[#666]">
        <button
          type="button"
          onClick={() => setDestinoStep('estado')}
          className={destinoStep === 'estado' ? 'text-white font-semibold' : 'hover:text-[#B3B3B3]'}
        >
          Estado
        </button>
        {destinoStep !== 'estado' && (
          <>
            <ChevronRight size={12} />
            <button
              type="button"
              onClick={() => setDestinoStep('cidade')}
              className={destinoStep === 'cidade' ? 'text-white font-semibold' : 'hover:text-[#B3B3B3]'}
            >
              {selectedStateName ?? 'Cidade'}
            </button>
          </>
        )}
        {destinoStep === 'bairro' && (
          <>
            <ChevronRight size={12} />
            <span className="text-white font-semibold">{cidade}</span>
          </>
        )}
      </div>

      {/* Step: Estado */}
      {destinoStep === 'estado' && (
        <div className="space-y-1">
          {availableStates.length === 0 && <p className="text-sm text-[#555] py-4 text-center">Carregando...</p>}
          {availableStates.map(([uf, data]) => (
            <button
              key={uf}
              type="button"
              onClick={() => pickEstado(uf)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-colors ${estado === uf ? 'bg-[#E50914]/20 text-[#E50914]' : 'hover:bg-[#2A2A2A] text-white'}`}
            >
              <span className="text-sm font-medium">{data.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#666]">{data.count} {data.count === 1 ? 'imóvel' : 'imóveis'}</span>
                {estado === uf ? <Check size={14} className="text-[#E50914]" /> : <ChevronRight size={14} className="text-[#444]" />}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step: Cidade */}
      {destinoStep === 'cidade' && (
        <div className="space-y-1">
          <button type="button" onClick={() => setDestinoStep('estado')}
            className="flex items-center gap-2 text-xs text-[#666] hover:text-white mb-3 transition-colors">
            <ChevronLeft size={14} /> Voltar para estados
          </button>
          {availableCities.map(([city, data]) => (
            <button
              key={city}
              type="button"
              onClick={() => pickCidade(city)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-colors ${cidade === city ? 'bg-[#E50914]/20 text-[#E50914]' : 'hover:bg-[#2A2A2A] text-white'}`}
            >
              <span className="text-sm font-medium">{city}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#666]">{data.count} {data.count === 1 ? 'imóvel' : 'imóveis'}</span>
                {cidade === city ? <Check size={14} className="text-[#E50914]" /> : <ChevronRight size={14} className="text-[#444]" />}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step: Bairro */}
      {destinoStep === 'bairro' && (
        <div className="space-y-1">
          <button type="button" onClick={() => setDestinoStep('cidade')}
            className="flex items-center gap-2 text-xs text-[#666] hover:text-white mb-3 transition-colors">
            <ChevronLeft size={14} /> Voltar para cidades
          </button>
          <button
            type="button"
            onClick={() => pickBairro('')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-colors ${!bairro ? 'bg-[#E50914]/20 text-[#E50914]' : 'hover:bg-[#2A2A2A] text-white'}`}
          >
            <span className="text-sm font-medium">Qualquer bairro</span>
            {!bairro && <Check size={14} className="text-[#E50914]" />}
          </button>
          {availableNeighborhoods.map(n => (
            <button
              key={n}
              type="button"
              onClick={() => pickBairro(n)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-colors ${bairro === n ? 'bg-[#E50914]/20 text-[#E50914]' : 'hover:bg-[#2A2A2A] text-white'}`}
            >
              <span className="text-sm font-medium">{n}</span>
              {bairro === n && <Check size={14} className="text-[#E50914]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  // ── Hóspedes content (shared) ─────────────────────────────────────────────
  const hospedesContent = (
    <div>
      <Counter label="Adultos"  sub="13 anos ou mais"      value={guests.adults}   min={1} onChange={v => setGuests(g => ({ ...g, adults: v }))} />
      <Counter label="Crianças" sub="2 a 12 anos"          value={guests.children}         onChange={v => setGuests(g => ({ ...g, children: v }))} />
      <Counter label="Bebês"    sub="Menos de 2 anos"      value={guests.babies}           onChange={v => setGuests(g => ({ ...g, babies: v }))} />
      <Counter label="Pets"     sub="Animais de estimação" value={guests.pets}             onChange={v => setGuests(g => ({ ...g, pets: v }))} />
      <button type="button"
        onClick={() => { setPanel(null); doSearch(estado, cidade, bairro, checkIn, checkOut, guests) }}
        className="w-full mt-5 py-3 bg-[#E50914] hover:bg-[#F40612] text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
        <Check size={16} /> Confirmar hóspedes
      </button>
    </div>
  )

  // ── Compact mode ──────────────────────────────────────────────────────────
  if (compact) {
    return (
      <button onClick={() => togglePanel('destino')}
        className="flex items-center gap-2 bg-[#1F1F1F] border border-[#333] rounded-full px-4 py-2 w-full">
        <Search size={16} className="text-[#666]" />
        <span className="text-sm text-white flex-1 truncate text-left">
          {destinoLabel ?? 'Para onde você vai?'}
        </span>
      </button>
    )
  }

  return (
    <>
      <div ref={containerRef} className="relative w-full">
        {/* ── Barra principal ────────────────────────────────────────────── */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-2 flex flex-col md:flex-row gap-2">

          {/* Destino */}
          <button type="button" onClick={() => togglePanel('destino')}
            className={`flex items-center gap-3 flex-1 bg-[#1F1F1F]/80 rounded-xl px-4 py-3 text-left transition-all ${panel === 'destino' ? 'ring-2 ring-[#E50914]' : 'hover:bg-[#2A2A2A]/80'}`}>
            <MapPin size={18} className="text-[#E50914] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-[#B3B3B3] uppercase tracking-wide">Destino</p>
              <p className="text-sm truncate mt-0.5 font-medium" style={{ color: destinoLabel ? 'white' : '#666' }}>
                {destinoLabel ?? 'Estado, cidade ou bairro'}
              </p>
            </div>
            {destinoLabel && (
              <button type="button" onClick={clearDestino} className="text-[#555] hover:text-white transition-colors flex-shrink-0">
                <X size={14} />
              </button>
            )}
          </button>

          {/* Datas */}
          <button type="button" onClick={() => togglePanel('datas')}
            className={`flex items-center gap-3 md:w-52 bg-[#1F1F1F]/80 rounded-xl px-4 py-3 text-left transition-all ${panel === 'datas' ? 'ring-2 ring-[#E50914]' : 'hover:bg-[#2A2A2A]/80'}`}>
            <Calendar size={18} className="text-[#E50914] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-[#B3B3B3] uppercase tracking-wide">Datas</p>
              <p className="text-sm truncate mt-0.5 font-medium" style={{ color: dateLabel ? 'white' : '#666' }}>
                {dateLabel ?? 'Check-in → Check-out'}
              </p>
            </div>
            {dateLabel && (
              <button type="button" onClick={clearDatas} className="text-[#555] hover:text-white transition-colors flex-shrink-0">
                <X size={14} />
              </button>
            )}
          </button>

          {/* Hóspedes */}
          <button type="button" onClick={() => togglePanel('hospedes')}
            className={`flex items-center gap-3 md:w-44 bg-[#1F1F1F]/80 rounded-xl px-4 py-3 text-left transition-all ${panel === 'hospedes' ? 'ring-2 ring-[#E50914]' : 'hover:bg-[#2A2A2A]/80'}`}>
            <Users size={18} className="text-[#E50914] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-[#B3B3B3] uppercase tracking-wide">Hóspedes</p>
              <p className="text-sm truncate mt-0.5 font-medium" style={{ color: guestsLabel ? 'white' : '#666' }}>
                {guestsLabel ?? 'Adicionar hóspedes'}
              </p>
            </div>
            <ChevronDown size={14} className={`text-[#666] flex-shrink-0 transition-transform ${panel === 'hospedes' ? 'rotate-180' : ''}`} />
          </button>

          {/* Buscar (desktop) */}
          <button type="button" onClick={() => doSearch(estado, cidade, bairro, checkIn, checkOut, guests)}
            className="hidden md:flex items-center gap-2 bg-[#E50914] hover:bg-[#F40612] text-white font-semibold px-6 rounded-xl transition-colors flex-shrink-0">
            <Search size={18} /> Buscar
          </button>
        </div>

        {/* ── Desktop dropdowns ──────────────────────────────────────────── */}
        {panel === 'destino' && (
          <div className="hidden md:block absolute top-full left-0 mt-2 z-50 w-96 bg-[#1A1A1A] border border-[#333] rounded-2xl shadow-2xl p-5">
            {destinoDesktop}
          </div>
        )}
        {panel === 'datas' && (
          <div className="hidden md:block absolute top-full left-0 mt-2 z-50 w-full max-w-2xl">
            <DateRangePicker from={checkIn} to={checkOut}
              onChange={(f, t) => { setCheckIn(f); setCheckOut(t) }}
              onClose={() => setPanel(null)} />
          </div>
        )}
        {panel === 'hospedes' && (
          <div className="hidden md:block absolute top-full right-0 mt-2 z-50 w-80 bg-[#1A1A1A] border border-[#333] rounded-2xl shadow-2xl p-5">
            {hospedesContent}
          </div>
        )}
      </div>

      {/* ── Mobile bottom sheets ────────────────────────────────────────────── */}
      <BottomSheet open={panel === 'destino'} onClose={() => setPanel(null)} title="Para onde você vai?">
        {destinoMobile}
      </BottomSheet>

      <BottomSheet open={panel === 'datas'} onClose={() => setPanel(null)} title="Escolha as datas">
        <DateRangePicker from={checkIn} to={checkOut}
          onChange={(f, t) => { setCheckIn(f); setCheckOut(t) }}
          onClose={() => setPanel(null)} />
      </BottomSheet>

      <BottomSheet open={panel === 'hospedes'} onClose={() => setPanel(null)} title="Hóspedes">
        {hospedesContent}
      </BottomSheet>
    </>
  )
}
