import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, X, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/Button'
import { Input, Select, Textarea } from '../components/ui/Input'
import { APP_ROUTES, AMENITIES_LIST, PROPERTY_TYPES, CANCELLATION_POLICIES, BRASIL_STATES } from '../constants'
import type { PropertyType, CancellationPolicy } from '../types'

export function NewProperty() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [photoInput, setPhotoInput] = useState('')

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
    price_per_night: '',
    min_price: '',
    bedrooms: '1',
    bathrooms: '1',
    max_guests: '4',
    amenities: [] as string[],
    cancellation_policy: 'MODERADO' as CancellationPolicy,
  })

  function upd(k: keyof typeof form, v: unknown) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function toggleAmenity(a: string) {
    setForm(f => ({
      ...f,
      amenities: f.amenities.includes(a)
        ? f.amenities.filter(x => x !== a)
        : [...f.amenities, a],
    }))
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

  function addPhotoUrl() {
    if (!photoInput.trim()) return
    setPhotoUrls(p => [...p, photoInput.trim()])
    setPhotoInput('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!form.name || !form.city || !form.price_per_night) {
      toast('warning', 'Campos obrigatórios', 'Preencha nome, cidade e preço.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('properties').insert({
      owner_id: user.id,
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
      price_per_night: Number(form.price_per_night),
      min_price: form.min_price ? Number(form.min_price) : null,
      bedrooms: Number(form.bedrooms),
      bathrooms: Number(form.bathrooms),
      max_guests: Number(form.max_guests),
      amenities: form.amenities,
      photos: photoUrls,
      cancellation_policy: form.cancellation_policy,
    })
    setSaving(false)
    if (error) { toast('error', 'Erro ao cadastrar', error.message); return }
    toast('success', 'Imóvel cadastrado!', 'Aguardando aprovação da equipe LOCAFLIX.')
    navigate(APP_ROUTES.OWNER_DASHBOARD)
  }

  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
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
                onChange={e => { upd('cep', e.target.value); if (e.target.value.replace(/\D/g,'').length === 8) handleCEP(e.target.value) }}
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
          </section>

          {/* Comodidades */}
          <section className="bg-[#1F1F1F] border border-[#333] rounded-2xl p-6">
            <h2 className="font-display text-lg font-bold text-white mb-4">Comodidades</h2>
            <div className="flex flex-wrap gap-2">
              {AMENITIES_LIST.map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAmenity(a)}
                  className={`text-sm px-3 py-1.5 rounded-xl border transition-all ${
                    form.amenities.includes(a)
                      ? 'bg-[#E50914] border-[#E50914] text-white'
                      : 'border-[#333] text-[#B3B3B3] hover:border-[#555]'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </section>

          {/* Fotos */}
          <section className="bg-[#1F1F1F] border border-[#333] rounded-2xl p-6">
            <h2 className="font-display text-lg font-bold text-white mb-4">Fotos</h2>
            <div className="flex gap-2 mb-4">
              <input
                type="url"
                value={photoInput}
                onChange={e => setPhotoInput(e.target.value)}
                placeholder="URL da foto (https://...)"
                className="flex-1 bg-[#2A2A2A] border border-[#333] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#666] outline-none focus:ring-2 focus:ring-[#E50914]"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPhotoUrl() } }}
              />
              <Button type="button" variant="secondary" onClick={addPhotoUrl} className="flex-shrink-0">
                <Plus size={16} />
              </Button>
            </div>
            {photoUrls.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photoUrls.map((url, i) => (
                  <div key={i} className="relative group aspect-video rounded-xl overflow-hidden bg-[#2A2A2A]">
                    <img src={url} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                    <button
                      type="button"
                      onClick={() => setPhotoUrls(p => p.filter((_, j) => j !== i))}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {photoUrls.length === 0 && (
              <div className="border-2 border-dashed border-[#333] rounded-xl p-8 text-center text-[#666]">
                <Upload size={32} className="mx-auto mb-2" />
                <p className="text-sm">Adicione URLs de fotos do imóvel</p>
              </div>
            )}
          </section>

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
