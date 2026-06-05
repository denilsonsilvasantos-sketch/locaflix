import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import { X, Plus, Upload, Trash2, Image, Link, DollarSign, AlertTriangle, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/Button'
import { Input, Select, Textarea } from '../components/ui/Input'
import { APP_ROUTES, PROPERTY_TYPES, CANCELLATION_POLICIES, BRASIL_STATES } from '../constants'
import type { PropertyType, CancellationPolicy, PeriodType, AmenityCatalog } from '../types'
import { PERIOD_TYPE_LABELS, PERIOD_DEFAULT_NAMES, PERIOD_TYPES_WITH_DATES } from '../lib/pricing'

const PERIOD_TYPE_OPTIONS = (Object.keys(PERIOD_TYPE_LABELS) as PeriodType[]).map(v => ({
  value: v,
  label: PERIOD_TYPE_LABELS[v],
}))

interface PeriodDraft {
  id: string
  period_type: PeriodType
  name: string
  price_per_night: string
  start_date: string
  end_date: string
  priority: string
}

const MAX_ROOMS = 50
const MAX_PHOTOS_PER_ROOM = 20

interface PhotoDraft {
  id: string
  url: string
  caption: string
  uploading: boolean
}

interface RoomDraft {
  id: string
  name: string
  description: string
  photos: PhotoDraft[]
}

function uid() {
  return Math.random().toString(36).slice(2)
}

export function NewProperty() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [ownerUsers, setOwnerUsers] = useState<{ id: string; name: string | null }[]>([])
  const [selectedOwnerId, setSelectedOwnerId] = useState('')
  const [rooms, setRooms] = useState<RoomDraft[]>([])
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null)
  const [periods, setPeriods] = useState<PeriodDraft[]>([])
  const [catalog, setCatalog] = useState<AmenityCatalog[]>([])
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<Set<string>>(new Set())
  const [customAmenities, setCustomAmenities] = useState<{ id: string; category: string; name: string }[]>([])
  const [customForm, setCustomForm] = useState({ category: 'Cozinha', name: '' })

  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'CASA' as PropertyType,
    city: '',
    state: 'SP',
    neighborhood: '',
    address: '',
    number: '',
    complement: '',
    cep: '',
    latitude: '',
    longitude: '',
    price_per_night: '',
    min_price: '',
    cleaning_fee_enabled: false,
    cleaning_fee: '',
    bedrooms: '1',
    bathrooms: '1',
    max_guests: '4',
    cancellation_policy: 'MODERADO' as CancellationPolicy,
  })

  useEffect(() => {
    supabase
      .from('amenities_catalog')
      .select('*')
      .order('category')
      .order('display_order')
      .then(({ data }) => { if (data) setCatalog(data as AmenityCatalog[]) })
  }, [])

  useEffect(() => {
    if (profile?.role !== 'ADMIN') return
    supabase.from('users').select('id, name').eq('role', 'OWNER').order('name')
      .then(({ data }) => { if (data) setOwnerUsers(data as { id: string; name: string | null }[]) })
  }, [profile?.role])

  function upd(k: keyof typeof form, v: unknown) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function toggleAmenity(id: string, name: string) {
    setSelectedAmenityIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        // Unchecking "Piscina" removes all pool subtypes too
        if (name === 'Piscina') {
          catalog.filter(c => c.name !== 'Piscina' && c.name.startsWith('Piscina')).forEach(c => next.delete(c.id))
        }
      } else {
        next.add(id)
      }
      return next
    })
  }

  function addCustomAmenity() {
    const name = customForm.name.trim()
    if (!name) return
    setCustomAmenities(prev => [...prev, { id: uid(), category: customForm.category, name }])
    setCustomForm(f => ({ ...f, name: '' }))
  }

  function removeCustomAmenity(customId: string) {
    setCustomAmenities(prev => prev.filter(a => a.id !== customId))
  }

  async function handleCEP(cep: string) {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setForm(f => ({
          ...f,
          address: data.logradouro ?? f.address,
          neighborhood: data.bairro ?? f.neighborhood,
          city: data.localidade ?? f.city,
          state: data.uf ?? f.state,
        }))
      }
    } catch { /* ignore */ }
  }

  function addRoom() {
    if (rooms.length >= MAX_ROOMS) {
      toast('warning', 'Limite atingido', `Máximo de ${MAX_ROOMS} cômodos por imóvel.`)
      return
    }
    setRooms(r => [...r, { id: uid(), name: '', description: '', photos: [] }])
  }

  function removeRoom(roomId: string) {
    setRooms(r => r.filter(rm => rm.id !== roomId))
  }

  function updateRoom(roomId: string, patch: Partial<Pick<RoomDraft, 'name' | 'description'>>) {
    setRooms(r => r.map(rm => rm.id === roomId ? { ...rm, ...patch } : rm))
  }

  function addPhotoToRoom(roomId: string, url: string, caption: string) {
    setRooms(r => r.map(rm => {
      if (rm.id !== roomId || rm.photos.length >= MAX_PHOTOS_PER_ROOM) return rm
      return { ...rm, photos: [...rm.photos, { id: uid(), url, caption, uploading: false }] }
    }))
  }

  function removePhoto(roomId: string, photoId: string) {
    setRooms(r => r.map(rm =>
      rm.id === roomId ? { ...rm, photos: rm.photos.filter(p => p.id !== photoId) } : rm
    ))
  }

  async function uploadFiles(roomId: string, files: File[]) {
    const validFiles = files.filter(f => {
      if (!f.type.startsWith('image/')) { toast('error', 'Arquivo inválido', `${f.name}: apenas imagens.`); return false }
      if (f.size > 10 * 1024 * 1024) { toast('error', 'Muito grande', `${f.name}: máx. 10 MB.`); return false }
      return true
    })
    if (validFiles.length === 0) return

    const room = rooms.find(rm => rm.id === roomId)
    if (!room) return
    const remaining = MAX_PHOTOS_PER_ROOM - room.photos.length
    if (remaining <= 0) return
    const filesToUpload = validFiles.slice(0, remaining)
    if (validFiles.length > remaining) toast('warning', 'Limite', `Apenas ${remaining} foto${remaining !== 1 ? 's' : ''} podem ser adicionadas.`)

    const newPhotos: PhotoDraft[] = filesToUpload.map(() => ({ id: uid(), url: '', caption: '', uploading: true }))
    setRooms(r => r.map(rm => rm.id === roomId ? { ...rm, photos: [...rm.photos, ...newPhotos] } : rm))

    await Promise.all(filesToUpload.map(async (file, i) => {
      const photoId = newPhotos[i].id
      const ext = file.name.split('.').pop() ?? 'jpg'
      const filePath = `${user!.id}/${Date.now()}-${uid()}.${ext}`
      try {
        const session = await supabase.auth.getSession()
        const authToken = session.data.session?.access_token ?? ''
        const signRes = await fetch(`/api/upload/property-photo-sign?path=${encodeURIComponent(filePath)}`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
        })
        if (!signRes.ok) throw new Error('Falha ao obter URL de upload')
        const { token: uploadToken } = await signRes.json() as { token: string }
        const { error } = await supabase.storage.from('property-photos').uploadToSignedUrl(filePath, uploadToken, file)
        if (error) throw error
        const { data } = supabase.storage.from('property-photos').getPublicUrl(filePath)
        setRooms(r => r.map(rm =>
          rm.id === roomId
            ? { ...rm, photos: rm.photos.map(p => p.id === photoId ? { ...p, url: data.publicUrl, uploading: false } : p) }
            : rm
        ))
      } catch (err) {
        setRooms(r => r.map(rm => rm.id === roomId ? { ...rm, photos: rm.photos.filter(p => p.id !== photoId) } : rm))
        toast('error', 'Erro no upload', err instanceof Error ? err.message : 'Tente novamente')
      }
    }))
  }

  function addPeriod() {
    setPeriods(p => [...p, {
      id: uid(),
      period_type: 'WEEKEND',
      name: PERIOD_DEFAULT_NAMES.WEEKEND,
      price_per_night: '',
      start_date: '',
      end_date: '',
      priority: String(p.length),
    }])
  }

  function removePeriod(periodId: string) {
    setPeriods(p => p.filter(x => x.id !== periodId))
  }

  function updatePeriod(periodId: string, patch: Partial<Omit<PeriodDraft, 'id'>>) {
    setPeriods(p => p.map(x => x.id === periodId ? { ...x, ...patch } : x))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!form.name || !form.city || !form.price_per_night) {
      toast('warning', 'Campos obrigatórios', 'Preencha nome, cidade e preço.')
      return
    }
    if (profile?.role === 'ADMIN' && !selectedOwnerId) {
      toast('warning', 'Selecione o proprietário', 'Escolha a qual usuário este imóvel pertence.')
      return
    }
    setSaving(true)

    const amenityNames = Array.from(selectedAmenityIds)
      .map(id => catalog.find(c => c.id === id)?.name ?? '')
      .filter(Boolean)
    const customNames = customAmenities.map(a => `CUSTOM::${a.category}::${a.name}`)

    const { data: prop, error: propErr } = await supabase.from('properties').insert({
      owner_id: profile?.role === 'ADMIN' ? selectedOwnerId : user.id,
      name: form.name,
      description: form.description || null,
      type: form.type,
      status: 'PENDENTE',
      city: form.city,
      state: form.state,
      neighborhood: form.neighborhood || null,
      address: form.address || null,
      number: form.number || null,
      complement: form.complement || null,
      cep: form.cep || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      price_per_night: Number(form.price_per_night),
      min_price: form.min_price ? Number(form.min_price) : null,
      cleaning_fee: form.cleaning_fee_enabled && form.cleaning_fee ? Number(form.cleaning_fee) : null,
      bedrooms: Number(form.bedrooms),
      bathrooms: Number(form.bathrooms),
      max_guests: Number(form.max_guests),
      amenities: [...amenityNames, ...customNames],
      photos: [] as string[],
      cancellation_policy: form.cancellation_policy,
    }).select('id').single()

    if (propErr || !prop) {
      setSaving(false)
      toast('error', 'Erro ao cadastrar', propErr?.message ?? 'Tente novamente.')
      return
    }

    const propertyId = prop.id

    if (selectedAmenityIds.size > 0) {
      await supabase.from('property_amenities').insert(
        Array.from(selectedAmenityIds).map(amenityId => ({
          property_id: propertyId,
          amenity_id: amenityId,
        }))
      )
    }

    const validRooms = rooms.filter(rm => rm.name.trim())

    for (let i = 0; i < validRooms.length; i++) {
      const room = validRooms[i]
      const { data: roomRow, error: roomErr } = await supabase
        .from('property_rooms')
        .insert({
          property_id: propertyId,
          name: room.name.trim(),
          description: room.description.trim() || null,
          display_order: i,
        })
        .select('id')
        .single()

      if (roomErr || !roomRow) continue

      const validPhotos = room.photos.filter(p => p.url && !p.uploading)
      if (validPhotos.length === 0) continue

      await supabase.from('property_photos').insert(
        validPhotos.map((p, j) => ({
          property_id: propertyId,
          room_id: roomRow.id,
          url: p.url,
          caption: p.caption.trim() || null,
          display_order: j,
        }))
      )
    }

    const validPeriods = periods.filter(p => p.name.trim() && p.price_per_night)
    if (validPeriods.length > 0) {
      await supabase.from('price_periods').insert(
        validPeriods.map((p, i) => ({
          property_id: propertyId,
          name: p.name.trim(),
          period_type: p.period_type,
          price_per_night: Number(p.price_per_night),
          start_date: p.start_date || null,
          end_date: p.end_date || null,
          priority: Number(p.priority) || i,
          active: true,
        }))
      )
    }

    // Build properties.photos array: cover first, then the rest
    const allPhotoUrls = validRooms.flatMap(r => r.photos.filter(p => p.url && !p.uploading).map(p => p.url))
    const photosArray = coverPhotoUrl
      ? [coverPhotoUrl, ...allPhotoUrls.filter(u => u !== coverPhotoUrl)]
      : allPhotoUrls
    if (photosArray.length > 0) {
      await supabase.from('properties').update({ photos: photosArray }).eq('id', propertyId)
    }

    setSaving(false)
    toast('success', 'Imóvel cadastrado!', 'Aguardando aprovação da equipe LOCAFLIX.')
    navigate(APP_ROUTES.OWNER_DASHBOARD)
  }

  const hasPixKey = !!profile?.pix_key

  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {!hasPixKey && (
          <div className="flex items-start gap-3 p-4 rounded-xl border bg-[#F5A623]/10 border-[#F5A623]/30 mb-5">
            <AlertTriangle size={16} className="text-[#F5A623] flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#F5A623]">Chave Pix necessária</p>
              <p className="text-xs text-[#B3B3B3] mt-0.5">
                Antes de cadastrar um imóvel, cadastre sua chave Pix para receber os repasses.
              </p>
            </div>
            <RouterLink
              to="/anfitriao?tab=financeiro"
              className="flex-shrink-0 text-xs font-semibold text-[#F5A623] border border-[#F5A623]/40 px-3 py-1.5 rounded-lg hover:bg-[#F5A623]/10 transition-colors whitespace-nowrap"
            >
              Cadastrar chave Pix
            </RouterLink>
          </div>
        )}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl font-bold text-white">Cadastrar imóvel</h1>
          <button
            onClick={() => navigate(APP_ROUTES.OWNER_DASHBOARD)}
            className="text-[#B3B3B3] hover:text-white transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações básicas */}
          <section className="bg-[#1F1F1F] border border-[#333] rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-white">Informações básicas</h2>

            {/* Admin-only: owner selector */}
            {profile?.role === 'ADMIN' && (
              <div>
                <label className="block text-xs font-medium text-[#B3B3B3] mb-1.5">Proprietário do imóvel <span className="text-[#E50914]">*</span></label>
                <select
                  value={selectedOwnerId}
                  onChange={e => setSelectedOwnerId(e.target.value)}
                  required
                  className="w-full bg-[#2A2A2A] border border-[#333] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-[#E50914] appearance-none cursor-pointer"
                >
                  <option value="" disabled>Selecione o anfitrião</option>
                  {ownerUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name ?? u.id}</option>
                  ))}
                </select>
                {ownerUsers.length === 0 && (
                  <p className="text-xs text-[#666] mt-1">Nenhum usuário com role OWNER encontrado.</p>
                )}
              </div>
            )}

            <Input label="Nome do imóvel" value={form.name} onChange={e => upd('name', e.target.value)} required placeholder="Ex: Casa de Praia em Florianópolis" />
            <Textarea label="Descrição" value={form.description} onChange={e => upd('description', e.target.value)} placeholder="Descreva seu imóvel, diferenciais, o que está incluso..." />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Tipo"
                value={form.type}
                onChange={e => upd('type', e.target.value as PropertyType)}
                options={PROPERTY_TYPES.map(t => ({ value: t.value, label: t.label }))}
              />
              <Select
                label="Política de cancelamento"
                value={form.cancellation_policy}
                onChange={e => upd('cancellation_policy', e.target.value as CancellationPolicy)}
                options={CANCELLATION_POLICIES.map(p => ({ value: p.value, label: p.label }))}
              />
            </div>
          </section>

          {/* Localização */}
          <section className="bg-[#1F1F1F] border border-[#333] rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-white">Localização</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="CEP"
                value={form.cep}
                onChange={e => { upd('cep', e.target.value); if (e.target.value.replace(/\D/g, '').length === 8) handleCEP(e.target.value) }}
                placeholder="00000-000"
              />
              <Input label="Número" value={form.number} onChange={e => upd('number', e.target.value)} />
            </div>
            <Input label="Endereço" value={form.address} onChange={e => upd('address', e.target.value)} placeholder="Rua / Avenida" required />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Bairro" value={form.neighborhood} onChange={e => upd('neighborhood', e.target.value)} />
              <Input label="Complemento" value={form.complement} onChange={e => upd('complement', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Cidade" value={form.city} onChange={e => upd('city', e.target.value)} required />
              <Select
                label="Estado"
                value={form.state}
                onChange={e => upd('state', e.target.value)}
                options={BRASIL_STATES.map(s => ({ value: s.uf, label: `${s.uf} — ${s.name}` }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Latitude"
                type="number"
                step="0.00000001"
                value={form.latitude}
                onChange={e => upd('latitude', e.target.value)}
                placeholder="-23.5505"
                hint="Clique com botão direito no Google Maps e copie as coordenadas"
              />
              <Input
                label="Longitude"
                type="number"
                step="0.00000001"
                value={form.longitude}
                onChange={e => upd('longitude', e.target.value)}
                placeholder="-46.6333"
              />
            </div>
          </section>

          {/* Capacidade e Preço */}
          <section className="bg-[#1F1F1F] border border-[#333] rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-white">Capacidade e Preço</h2>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Quartos" type="number" min="1" value={form.bedrooms} onChange={e => upd('bedrooms', e.target.value)} required />
              <Input label="Banheiros" type="number" min="1" value={form.bathrooms} onChange={e => upd('bathrooms', e.target.value)} required />
              <Input label="Máx. hóspedes" type="number" min="1" value={form.max_guests} onChange={e => upd('max_guests', e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Preço por noite (R$)"
                type="number"
                min="1"
                step="0.01"
                value={form.price_per_night}
                onChange={e => upd('price_per_night', e.target.value)}
                placeholder="0,00"
                required
                hint="Preço base (dias de semana)"
              />
              <Input
                label="Preço mínimo (R$)"
                type="number"
                min="1"
                step="0.01"
                value={form.min_price}
                onChange={e => upd('min_price', e.target.value)}
                placeholder="0,00"
                hint="Para promoções"
              />
            </div>
            {/* Taxa de limpeza */}
            <div className="flex items-start gap-3 pt-2">
              <input
                id="cleaning_fee_enabled"
                type="checkbox"
                checked={form.cleaning_fee_enabled}
                onChange={e => upd('cleaning_fee_enabled', e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#E50914] flex-shrink-0 cursor-pointer"
              />
              <label htmlFor="cleaning_fee_enabled" className="cursor-pointer">
                <p className="text-sm font-medium text-white">Cobrar taxa de limpeza</p>
                <p className="text-xs text-[#666] mt-0.5">Valor fixo cobrado uma vez, independente do número de diárias</p>
              </label>
            </div>
            {form.cleaning_fee_enabled && (
              <Input
                label="Taxa de limpeza (R$)"
                type="number"
                min="1"
                step="0.01"
                value={form.cleaning_fee}
                onChange={e => upd('cleaning_fee', e.target.value)}
                placeholder="0,00"
                hint="Cobrado uma vez por reserva"
              />
            )}
          </section>

          {/* Comodidades */}
          <section className="bg-[#1F1F1F] border border-[#333] rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-white">Comodidades</h2>
                <p className="text-xs text-[#666] mt-0.5">{selectedAmenityIds.size} selecionada{selectedAmenityIds.size !== 1 ? 's' : ''}</p>
              </div>
            </div>

            {catalog.length === 0 ? (
              <p className="text-xs text-[#555]">Carregando comodidades...</p>
            ) : (() => {
              // Group by category preserving insertion order
              const byCategory: Record<string, AmenityCatalog[]> = {}
              for (const item of catalog) {
                if (!byCategory[item.category]) byCategory[item.category] = []
                byCategory[item.category].push(item)
              }
              const poolMainId = catalog.find(c => c.name === 'Piscina')?.id
              const poolSubtypes = new Set(
                catalog.filter(c => c.name !== 'Piscina' && c.name.startsWith('Piscina')).map(c => c.id)
              )
              const poolMainSelected = poolMainId ? selectedAmenityIds.has(poolMainId) : false

              return Object.entries(byCategory).map(([category, items]) => (
                <div key={category} className="space-y-2">
                  <h3 className="text-[10px] font-bold text-[#555] uppercase tracking-widest">{category}</h3>
                  <div className="flex flex-wrap gap-2">
                    {items.map(item => {
                      const isSubtype = poolSubtypes.has(item.id)
                      if (isSubtype && !poolMainSelected) return null
                      const isSelected = selectedAmenityIds.has(item.id)
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleAmenity(item.id, item.name)}
                          className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                            isSubtype ? 'ml-3 border-dashed' : ''
                          } ${
                            isSelected
                              ? 'bg-[#E50914] border-[#E50914] text-white'
                              : 'border-[#333] text-[#B3B3B3] hover:border-[#555]'
                          }`}
                        >
                          {item.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            })()}
          </section>

          {/* Comodidades personalizadas */}
          <section className="bg-[#1F1F1F] border border-[#333] rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold text-white">Comodidades personalizadas</h2>
              <p className="text-xs text-[#666] mt-0.5">Adicione itens que não estão na lista acima (ex: Liquidificador, Mesa de sinuca)</p>
            </div>

            <div className="flex gap-2">
              <select
                value={customForm.category}
                onChange={e => setCustomForm(f => ({ ...f, category: e.target.value }))}
                className="bg-[#2A2A2A] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#555] flex-shrink-0"
              >
                {['Cozinha','Quarto','Banheiro','Área de lazer','Trabalho','Segurança','Acessibilidade','Outros'].map(c => (
                  <option key={c} value={c} className="bg-[#2A2A2A]">{c}</option>
                ))}
              </select>
              <input
                value={customForm.name}
                onChange={e => setCustomForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomAmenity() } }}
                placeholder="Nome da comodidade"
                className="flex-1 bg-[#2A2A2A] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-[#555] outline-none focus:border-[#555]"
              />
              <button
                type="button"
                onClick={addCustomAmenity}
                disabled={!customForm.name.trim()}
                className="px-3 py-2 bg-[#E50914] hover:bg-[#F40612] disabled:opacity-40 rounded-lg text-sm text-white font-medium transition-colors flex-shrink-0"
              >
                <Plus size={16} />
              </button>
            </div>

            {customAmenities.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {customAmenities.map(a => (
                  <div key={a.id} className="flex items-center gap-1.5 bg-[#2A2A2A] border border-[#333] rounded-xl px-3 py-1.5">
                    <span className="text-[10px] text-[#555] font-medium">{a.category}</span>
                    <span className="text-xs text-white">{a.name}</span>
                    <button type="button" onClick={() => removeCustomAmenity(a.id)} className="text-[#555] hover:text-[#E50914] transition-colors ml-1">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Fotos por cômodo */}
          <section className="bg-[#1F1F1F] border border-[#333] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-white">Fotos por cômodo</h2>
                <p className="text-xs text-[#666] mt-0.5">Organize as fotos por ambiente: sala, quarto, cozinha…</p>
              </div>
              <span className="text-xs text-[#555]">{rooms.length}/{MAX_ROOMS}</span>
            </div>

            {rooms.length === 0 && (
              <div className="border-2 border-dashed border-[#333] rounded-xl p-8 text-center">
                <Image size={32} className="mx-auto mb-2 text-[#444]" />
                <p className="text-sm text-[#666]">Nenhum cômodo adicionado</p>
                <p className="text-xs text-[#444] mt-1">Adicione cômodos para organizar suas fotos por ambiente</p>
              </div>
            )}

            <div className="space-y-4">
              {rooms.map((room, idx) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  index={idx}
                  onNameChange={v => updateRoom(room.id, { name: v })}
                  onDescChange={v => updateRoom(room.id, { description: v })}
                  onRemoveRoom={() => removeRoom(room.id)}
                  onAddPhotoUrl={(url, cap) => addPhotoToRoom(room.id, url, cap)}
                  onUploadFiles={files => uploadFiles(room.id, files)}
                  onRemovePhoto={photoId => removePhoto(room.id, photoId)}
                  coverPhotoUrl={coverPhotoUrl}
                  onSetCover={url => setCoverPhotoUrl(url)}
                />
              ))}
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={addRoom}
              disabled={rooms.length >= MAX_ROOMS}
              className="w-full"
            >
              <Plus size={16} />
              Adicionar cômodo
            </Button>
          </section>

          {/* Preços por período */}
          <section className="bg-[#1F1F1F] border border-[#333] rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold text-white">Preços por período</h2>
              <p className="text-xs text-[#666] mt-0.5">Defina preços diferentes para fins de semana, feriados, alta temporada, etc.</p>
            </div>

            {periods.length === 0 && (
              <div className="border-2 border-dashed border-[#333] rounded-xl p-6 text-center">
                <DollarSign size={28} className="mx-auto mb-2 text-[#444]" />
                <p className="text-sm text-[#666]">Sem períodos configurados</p>
                <p className="text-xs text-[#444] mt-1">Apenas o preço base será cobrado para todas as diárias</p>
              </div>
            )}

            <div className="space-y-3">
              {periods.map((period, idx) => {
                const needsDates = PERIOD_TYPES_WITH_DATES.includes(period.period_type)
                return (
                  <div key={period.id} className="border border-[#2A2A2A] rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#555] w-5 text-center shrink-0">{idx + 1}</span>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          value={period.period_type}
                          onChange={e => {
                            const t = e.target.value as PeriodType
                            updatePeriod(period.id, { period_type: t, name: PERIOD_DEFAULT_NAMES[t] })
                          }}
                          className="bg-[#2A2A2A] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#555]"
                        >
                          {PERIOD_TYPE_OPTIONS.map(o => (
                            <option key={o.value} value={o.value} className="bg-[#2A2A2A]">{o.label}</option>
                          ))}
                        </select>
                        <input
                          value={period.name}
                          onChange={e => updatePeriod(period.id, { name: e.target.value })}
                          placeholder="Nome do período"
                          className="bg-[#2A2A2A] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-[#555] outline-none focus:border-[#555]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removePeriod(period.id)}
                        className="text-[#555] hover:text-[#E50914] transition-colors shrink-0"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-7">
                      <div>
                        <label className="text-xs text-[#666] block mb-1">Preço/noite (R$)</label>
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          value={period.price_per_night}
                          onChange={e => updatePeriod(period.id, { price_per_night: e.target.value })}
                          placeholder="0,00"
                          className="w-full bg-[#2A2A2A] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-[#555] outline-none focus:border-[#555]"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[#666] block mb-1">Prioridade</label>
                        <input
                          type="number"
                          min="0"
                          value={period.priority}
                          onChange={e => updatePeriod(period.id, { priority: e.target.value })}
                          placeholder="0"
                          className="w-full bg-[#2A2A2A] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-[#555] outline-none focus:border-[#555]"
                        />
                      </div>
                      {needsDates && (
                        <>
                          <div className="col-span-2 sm:col-span-1 grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-[#666] block mb-1">Início</label>
                              <input
                                type="date"
                                value={period.start_date}
                                onChange={e => updatePeriod(period.id, { start_date: e.target.value })}
                                className="w-full bg-[#2A2A2A] border border-[#333] rounded-lg px-2 py-2 text-xs text-white outline-none focus:border-[#555]"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-[#666] block mb-1">Fim</label>
                              <input
                                type="date"
                                value={period.end_date}
                                onChange={e => updatePeriod(period.id, { end_date: e.target.value })}
                                className="w-full bg-[#2A2A2A] border border-[#333] rounded-lg px-2 py-2 text-xs text-white outline-none focus:border-[#555]"
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <Button type="button" variant="secondary" onClick={addPeriod} className="w-full">
              <Plus size={16} />
              Adicionar período
            </Button>
          </section>

          <div className="bg-[#1F1F1F] border border-[#333] rounded-2xl px-4 py-3 flex items-start gap-3">
            <span className="text-[#F5A623] text-sm mt-0.5">ℹ</span>
            <p className="text-xs text-[#B3B3B3] leading-relaxed">
              <strong className="text-white">Disponibilidade:</strong> após cadastrar o imóvel, acesse a edição para bloquear datas indisponíveis no calendário de disponibilidade.
            </p>
          </div>

          <div className="flex gap-4 pt-2">
            <Button type="button" variant="secondary" onClick={() => navigate(APP_ROUTES.OWNER_DASHBOARD)} fullWidth>
              Cancelar
            </Button>
            <Button type="submit" loading={saving} fullWidth>
              Cadastrar imóvel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── RoomCard ──────────────────────────────────────────────────

interface RoomCardProps {
  room: RoomDraft
  index: number
  onNameChange: (v: string) => void
  onDescChange: (v: string) => void
  onRemoveRoom: () => void
  onAddPhotoUrl: (url: string, caption: string) => void
  onUploadFiles: (files: File[]) => void
  onRemovePhoto: (photoId: string) => void
  coverPhotoUrl?: string | null
  onSetCover?: (url: string) => void
}

function RoomCard({
  room, index, onNameChange, onDescChange, onRemoveRoom,
  onAddPhotoUrl, onUploadFiles, onRemovePhoto, coverPhotoUrl, onSetCover,
}: RoomCardProps) {
  const [mode, setMode] = useState<'url' | 'upload'>('upload')
  const [photoUrl, setPhotoUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleAddUrl() {
    const url = photoUrl.trim()
    if (!url) return
    onAddPhotoUrl(url, caption.trim())
    setPhotoUrl('')
    setCaption('')
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) { onUploadFiles(files); e.target.value = '' }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files.length > 0) onUploadFiles(files)
  }

  const canAddMore = room.photos.length < MAX_PHOTOS_PER_ROOM

  return (
    <div className="border border-[#2A2A2A] rounded-xl overflow-hidden">
      {/* Room header */}
      <div className="bg-[#252525] px-4 py-3 flex items-center gap-3">
        <span className="text-xs font-bold text-[#555] w-5 text-center shrink-0">{index + 1}</span>
        <input
          value={room.name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="Nome do cômodo (ex: Sala de Estar)"
          className="flex-1 bg-transparent text-sm text-white placeholder-[#555] outline-none"
        />
        <span className="text-xs text-[#444] shrink-0">{room.photos.length}/{MAX_PHOTOS_PER_ROOM}</span>
        <button
          type="button"
          onClick={onRemoveRoom}
          className="text-[#555] hover:text-[#E50914] transition-colors shrink-0"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Description */}
        <input
          value={room.description}
          onChange={e => onDescChange(e.target.value)}
          placeholder="Descrição opcional"
          className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-xs text-[#B3B3B3] placeholder-[#444] outline-none focus:border-[#444] transition-colors"
        />

        {/* Photo grid */}
        {room.photos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {room.photos.map(photo => (
              <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden bg-[#2A2A2A]">
                {photo.uploading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-[#E50914] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <img
                    src={photo.url}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
                  />
                )}
                {photo.url === coverPhotoUrl && (
                  <div className="absolute top-1 left-1 bg-[#F5A623] text-black text-[8px] font-bold px-1 py-0.5 rounded">CAPA</div>
                )}
                {photo.caption && (
                  <div className="absolute bottom-0 inset-x-0 bg-black/70 px-1.5 py-0.5">
                    <p className="text-[9px] text-white truncate">{photo.caption}</p>
                  </div>
                )}
                {!photo.uploading && onSetCover && (
                  <button
                    type="button"
                    onClick={() => onSetCover(photo.url)}
                    title="Definir como foto de capa"
                    className={`absolute bottom-1 left-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${photo.url === coverPhotoUrl ? 'text-[#F5A623]' : 'text-white'}`}
                  >
                    <Star size={9} className={photo.url === coverPhotoUrl ? 'fill-[#F5A623]' : ''} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemovePhoto(photo.id)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add photo form */}
        {canAddMore && (
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-3 space-y-2">
            {/* Mode toggle */}
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setMode('upload')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mode === 'upload' ? 'bg-[#333] text-white' : 'text-[#666] hover:text-[#B3B3B3]'
                }`}
              >
                <Upload size={11} />
                Upload
              </button>
              <button
                type="button"
                onClick={() => setMode('url')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mode === 'url' ? 'bg-[#333] text-white' : 'text-[#666] hover:text-[#B3B3B3]'
                }`}
              >
                <Link size={11} />
                URL
              </button>
            </div>

            {mode === 'url' ? (
              <>
                <input
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  placeholder="Legenda opcional"
                  className="w-full bg-[#0A0A0A] border border-[#333] rounded-lg px-3 py-2 text-xs text-white placeholder-[#555] outline-none focus:border-[#444] transition-colors"
                />
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={photoUrl}
                    onChange={e => setPhotoUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 bg-[#0A0A0A] border border-[#333] rounded-lg px-3 py-2 text-xs text-white placeholder-[#555] outline-none focus:border-[#444] transition-colors"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddUrl() } }}
                  />
                  <button
                    type="button"
                    onClick={handleAddUrl}
                    disabled={!photoUrl.trim()}
                    className="shrink-0 flex items-center gap-1 px-3 py-2 bg-[#333] hover:bg-[#444] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded-lg transition-colors"
                  >
                    <Plus size={13} />
                    Adicionar
                  </button>
                </div>
              </>
            ) : (
              <>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`w-full flex flex-col items-center justify-center gap-1.5 px-3 py-5 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                    dragging
                      ? 'border-[#E50914] bg-[#E50914]/10 text-[#E50914]'
                      : 'border-[#333] hover:border-[#555] text-[#666] hover:text-[#B3B3B3]'
                  }`}
                >
                  <Upload size={18} />
                  <span className="text-xs">Arraste fotos aqui ou clique para selecionar</span>
                  <span className="text-[10px] text-[#444]">Múltiplos arquivos · JPG, PNG, WebP · máx. 10 MB cada</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
