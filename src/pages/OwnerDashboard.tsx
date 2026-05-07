import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Home, Calendar, DollarSign, Star, Plus, Eye, Pencil, ToggleLeft, ToggleRight, ShieldCheck, Check, X, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Property, Booking, KinshipType, OwnershipType } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { DashboardLayout } from '../components/layout/DashboardLayout'
import { Card, StatCard } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { KYCDocumentField } from '../components/ui/KYCDocumentField'
import { formatCurrency, formatShortDate } from '../lib/utils'
import { APP_ROUTES } from '../constants'

const KINSHIP_LABELS: Record<KinshipType, string> = {
  PAI: 'Pai',
  MAE: 'Mãe',
  ESPOSO: 'Esposo',
  ESPOSA: 'Esposa',
  FILHO: 'Filho',
  FILHA: 'Filha',
  OUTRO: 'Outro (Procuração)',
}

const NAV = [
  { label: 'Imóveis', icon: <Home size={16} />, href: '/anfitriao' },
  { label: 'Reservas', icon: <Calendar size={16} />, href: '/anfitriao?tab=reservas' },
  { label: 'Financeiro', icon: <DollarSign size={16} />, href: '/anfitriao?tab=financeiro' },
  { label: 'Avaliações', icon: <Star size={16} />, href: '/anfitriao?tab=avaliacoes' },
  { label: 'Documentos', icon: <ShieldCheck size={16} />, href: '/anfitriao?tab=documentos' },
]

interface KycForm {
  document_url: string
  address_proof_url: string
  ownership_type: OwnershipType
  actual_owner_name: string
  actual_owner_cpf: string
  actual_owner_document_url: string
  kinship_type: KinshipType | ''
  kinship_document_url: string
}

export function OwnerDashboard() {
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'imoveis'
  const { user, profile, refreshProfile } = useAuth()
  const { toast } = useToast()

  const [properties, setProperties] = useState<Property[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [submittingKyc, setSubmittingKyc] = useState(false)
  const [kycForm, setKycForm] = useState<KycForm>({
    document_url: '',
    address_proof_url: '',
    ownership_type: 'PROPRIO',
    actual_owner_name: '',
    actual_owner_cpf: '',
    actual_owner_document_url: '',
    kinship_type: '',
    kinship_document_url: '',
  })

  useEffect(() => {
    if (user) loadData()
  }, [user])

  useEffect(() => {
    if (profile) {
      setKycForm({
        document_url: profile.document_url ?? '',
        address_proof_url: profile.address_proof_url ?? '',
        ownership_type: profile.ownership_type ?? 'PROPRIO',
        actual_owner_name: profile.actual_owner_name ?? '',
        actual_owner_cpf: profile.actual_owner_cpf ?? '',
        actual_owner_document_url: profile.actual_owner_document_url ?? '',
        kinship_type: profile.kinship_type ?? '',
        kinship_document_url: profile.kinship_document_url ?? '',
      })
    }
  }, [profile])

  async function loadData() {
    setLoading(true)
    const [{ data: props }, { data: bks }] = await Promise.all([
      supabase.from('properties').select('*').eq('owner_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('bookings')
        .select('*, property:properties(id,name,photos), guest:users!guest_id(id,name,avatar_url), installments(*)')
        .eq('owner_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(30),
    ])
    setProperties((props ?? []) as Property[])
    setBookings((bks ?? []) as Booking[])
    setLoading(false)
  }

  async function toggleStatus(property: Property) {
    const newStatus = property.status === 'ATIVO' ? 'INATIVO' : 'ATIVO'
    const { error } = await supabase.from('properties').update({ status: newStatus }).eq('id', property.id)
    if (error) { toast('error', 'Erro', error.message); return }
    setProperties(prev => prev.map(p => p.id === property.id ? { ...p, status: newStatus } : p))
    toast('success', `Imóvel ${newStatus === 'ATIVO' ? 'ativado' : 'desativado'}`)
  }

  async function submitKYC() {
    if (!user) return
    setSubmittingKyc(true)
    const payload: Record<string, unknown> = {
      kyc_status: 'PENDENTE',
      document_url: kycForm.document_url || null,
      address_proof_url: kycForm.address_proof_url || null,
      ownership_type: kycForm.ownership_type,
    }
    if (kycForm.ownership_type === 'TERCEIRO') {
      payload.actual_owner_name = kycForm.actual_owner_name || null
      payload.actual_owner_cpf = kycForm.actual_owner_cpf.replace(/\D/g, '') || null
      payload.actual_owner_document_url = kycForm.actual_owner_document_url || null
      payload.kinship_type = kycForm.kinship_type || null
      payload.kinship_document_url = kycForm.kinship_document_url || null
    }
    const { error } = await supabase.from('users').update(payload).eq('id', user.id)
    if (error) { toast('error', 'Erro', error.message); setSubmittingKyc(false); return }
    await refreshProfile()
    toast('success', 'Documentos enviados', 'Sua análise está em andamento.')
    setSubmittingKyc(false)
  }

  const upd = <K extends keyof KycForm>(k: K, v: KycForm[K]) => setKycForm(f => ({ ...f, [k]: v }))

  const isPending = profile?.kyc_status === 'PENDENTE'

  const canSubmit = !isPending &&
    !!kycForm.document_url && !!kycForm.address_proof_url &&
    (kycForm.ownership_type === 'PROPRIO' || (
      !!kycForm.actual_owner_name && !!kycForm.actual_owner_cpf && !!kycForm.actual_owner_document_url
    ))

  const totalRevenue = bookings
    .filter(b => b.status === 'PAGO' || b.status === 'CONCLUIDA')
    .reduce((s, b) => s + b.subtotal - b.platform_fee, 0)
  const activeBookings = bookings.filter(b => b.status === 'PAGO' || b.status === 'PARCIAL')

  return (
    <DashboardLayout title="Anfitrião" navItems={NAV}>
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Imóveis" value={properties.length} icon={<Home size={18} />} />
        <StatCard label="Reservas ativas" value={activeBookings.length} icon={<Calendar size={18} />} />
        <StatCard label="Receita total" value={formatCurrency(totalRevenue)} icon={<DollarSign size={18} />} accent />
        <StatCard
          label="Avaliação média"
          value={properties.length > 0
            ? (properties.reduce((s, p) => s + (p.rating ?? 0), 0) / properties.length).toFixed(1)
            : '—'
          }
          icon={<Star size={18} />}
        />
      </div>

      {/* IMÓVEIS TAB */}
      {(tab === 'imoveis' || !tab) && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold text-white">Meus imóveis</h2>
            <Link to={APP_ROUTES.NEW_PROPERTY}>
              <Button size="sm" className="gap-1.5"><Plus size={14} /> Novo imóvel</Button>
            </Link>
          </div>
          {properties.length === 0 && !loading ? (
            <div className="text-center py-16">
              <Home size={48} className="mx-auto text-[#333] mb-4" />
              <p className="text-[#B3B3B3] mb-4">Você ainda não tem imóveis cadastrados.</p>
              <Link to={APP_ROUTES.NEW_PROPERTY}><Button>Cadastrar imóvel</Button></Link>
            </div>
          ) : (
            <div className="space-y-3">
              {properties.map(p => <PropertyRow key={p.id} property={p} onToggle={toggleStatus} />)}
            </div>
          )}
        </div>
      )}

      {/* RESERVAS TAB */}
      {tab === 'reservas' && (
        <div>
          <h2 className="font-display text-xl font-bold text-white mb-4">Reservas recebidas</h2>
          {bookings.length === 0 ? (
            <div className="text-center py-16">
              <Calendar size={48} className="mx-auto text-[#333] mb-4" />
              <p className="text-[#B3B3B3]">Nenhuma reserva ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map(b => (
                <Card key={b.id} className="p-4">
                  <div className="flex items-start gap-4 flex-wrap">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-[#E50914] flex items-center justify-center text-sm font-bold text-white overflow-hidden flex-shrink-0">
                        {b.guest?.avatar_url
                          ? <img src={b.guest.avatar_url} alt="" className="w-full h-full object-cover" />
                          : b.guest?.name?.[0] ?? 'H'
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-white text-sm">{b.guest?.name ?? 'Hóspede'}</p>
                        <p className="text-xs text-[#B3B3B3]">{b.property?.name}</p>
                        <p className="text-xs text-[#666]">{formatShortDate(b.check_in)} → {formatShortDate(b.check_out)}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-[#F5A623]">{formatCurrency(b.subtotal - b.platform_fee)}</p>
                      <StatusBadge status={b.status} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FINANCEIRO TAB */}
      {tab === 'financeiro' && (
        <div>
          <h2 className="font-display text-xl font-bold text-white mb-4">Financeiro</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard label="Receita bruta" value={formatCurrency(bookings.filter(b => ['PAGO','CONCLUIDA','PARCIAL'].includes(b.status)).reduce((s,b) => s + b.subtotal, 0))} icon={<DollarSign size={18} />} accent />
            <StatCard label="Taxa plataforma" value={formatCurrency(bookings.reduce((s, b) => s + b.platform_fee, 0))} icon={<DollarSign size={18} />} />
            <StatCard label="Receita líquida" value={formatCurrency(totalRevenue)} icon={<DollarSign size={18} />} accent />
          </div>
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Histórico de pagamentos</h3>
            {bookings.length === 0 ? (
              <p className="text-sm text-[#666]">Nenhum pagamento registrado.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[#666] text-xs border-b border-[#333]">
                    <th className="text-left pb-2">Reserva</th>
                    <th className="text-left pb-2">Hóspede</th>
                    <th className="text-right pb-2">Valor líquido</th>
                    <th className="text-right pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.slice(0, 10).map(b => (
                    <tr key={b.id} className="border-b border-[#1F1F1F] text-xs">
                      <td className="py-2 text-[#B3B3B3]">{b.booking_number}</td>
                      <td className="py-2 text-white">{b.guest?.name}</td>
                      <td className="py-2 text-right text-[#F5A623] font-bold">{formatCurrency(b.subtotal - b.platform_fee)}</td>
                      <td className="py-2 text-right"><StatusBadge status={b.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {/* AVALIAÇÕES TAB */}
      {tab === 'avaliacoes' && (
        <div>
          <h2 className="font-display text-xl font-bold text-white mb-4">Avaliações recebidas</h2>
          <p className="text-[#B3B3B3] text-sm">Avaliações serão exibidas aqui quando hóspedes avaliarem seus imóveis.</p>
        </div>
      )}

      {/* DOCUMENTOS TAB */}
      {tab === 'documentos' && (
        <div className="max-w-lg">
          <h2 className="font-display text-xl font-bold text-white mb-5">Verificação de identidade</h2>

          <KYCStatusBanner status={profile?.kyc_status ?? 'INCOMPLETO'} />

          {profile?.kyc_status !== 'APROVADO' && (
            <Card className="p-6 mt-4 space-y-7">

              {/* Documento pessoal */}
              <KYCDocumentField
                userId={user!.id}
                fieldKey="document"
                label="Documento com foto"
                hint="RG ou CNH — frente e verso, em um único arquivo"
                currentUrl={kycForm.document_url}
                disabled={isPending}
                onSuccess={url => upd('document_url', url)}
              />

              {/* Comprovante de endereço */}
              <KYCDocumentField
                userId={user!.id}
                fieldKey="address_proof"
                label="Comprovante de endereço"
                hint="Conta de luz, água, internet ou extrato bancário — emitido nos últimos 3 meses"
                currentUrl={kycForm.address_proof_url}
                disabled={isPending}
                onSuccess={url => upd('address_proof_url', url)}
              />

              {/* Imóvel de terceiros */}
              <div className="pt-1 border-t border-[#2A2A2A]">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={kycForm.ownership_type === 'TERCEIRO'}
                    onChange={e => upd('ownership_type', e.target.checked ? 'TERCEIRO' : 'PROPRIO')}
                    disabled={isPending}
                    className="mt-0.5 w-4 h-4 accent-[#E50914] flex-shrink-0"
                  />
                  <div>
                    <p className="text-sm font-semibold text-white group-hover:text-[#E50914] transition-colors">
                      Imóvel de terceiros
                    </p>
                    <p className="text-xs text-[#666] mt-0.5">
                      Marque se o imóvel não está em seu nome
                    </p>
                  </div>
                </label>
              </div>

              {/* Dados do proprietário real */}
              {kycForm.ownership_type === 'TERCEIRO' && (
                <div className="space-y-5 pl-7 border-l-2 border-[#E50914]/30">
                  <p className="text-xs font-semibold text-[#E50914] uppercase tracking-wide">
                    Dados do proprietário do imóvel
                  </p>

                  <Input
                    label="Nome completo do proprietário"
                    value={kycForm.actual_owner_name}
                    onChange={e => upd('actual_owner_name', e.target.value)}
                    disabled={isPending}
                    required
                  />

                  <Input
                    label="CPF do proprietário"
                    value={kycForm.actual_owner_cpf}
                    onChange={e => upd('actual_owner_cpf', e.target.value.replace(/\D/g, '').slice(0, 11))}
                    placeholder="000.000.000-00"
                    disabled={isPending}
                    required
                  />

                  <KYCDocumentField
                    userId={user!.id}
                    fieldKey="actual_owner_doc"
                    label="Documento do proprietário"
                    hint="RG ou CNH do dono do imóvel"
                    currentUrl={kycForm.actual_owner_document_url}
                    disabled={isPending}
                    onSuccess={url => upd('actual_owner_document_url', url)}
                  />

                  <div>
                    <p className="text-xs font-semibold text-[#B3B3B3] uppercase tracking-wide mb-2">
                      Tipo de vínculo
                    </p>
                    <select
                      value={kycForm.kinship_type}
                      onChange={e => upd('kinship_type', e.target.value as KinshipType)}
                      disabled={isPending}
                      className="w-full bg-[#2A2A2A] border border-[#333] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-[#E50914] appearance-none"
                    >
                      <option value="">Selecione o vínculo</option>
                      {(Object.entries(KINSHIP_LABELS) as [KinshipType, string][]).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>

                  <KYCDocumentField
                    userId={user!.id}
                    fieldKey="kinship_doc"
                    label={kycForm.kinship_type === 'OUTRO' ? 'Procuração' : 'Certidão de parentesco / Procuração'}
                    hint={kycForm.kinship_type === 'OUTRO'
                      ? 'Procuração pública ou particular com firma reconhecida'
                      : 'Certidão de nascimento, casamento ou outro documento comprobatório'
                    }
                    currentUrl={kycForm.kinship_document_url}
                    disabled={isPending}
                    onSuccess={url => upd('kinship_document_url', url)}
                  />
                </div>
              )}

              {/* Submit */}
              {canSubmit && (
                <Button onClick={submitKYC} loading={submittingKyc} fullWidth>
                  Enviar para análise
                </Button>
              )}

              {!canSubmit && !isPending && (
                <p className="text-xs text-[#555] text-center">
                  Preencha todos os campos obrigatórios para enviar.
                </p>
              )}

              {isPending && (
                <p className="text-xs text-[#F5A623] text-center">
                  Aguardando revisão do time LOCAFLIX. Você será notificado.
                </p>
              )}
            </Card>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function KYCStatusBanner({ status }: { status: string }) {
  const cfg: Record<string, { icon: React.ReactNode; bg: string; text: string; title: string; msg: string }> = {
    APROVADO: {
      icon: <Check size={16} />,
      bg: 'bg-[#46D369]/10 border-[#46D369]/30',
      text: 'text-[#46D369]',
      title: 'Identidade verificada',
      msg: 'Seus documentos foram aprovados.',
    },
    PENDENTE: {
      icon: <PendingClock />,
      bg: 'bg-[#F5A623]/10 border-[#F5A623]/30',
      text: 'text-[#F5A623]',
      title: 'Documentos em análise',
      msg: 'Aguarde a revisão. Você será notificado quando aprovado.',
    },
    REPROVADO: {
      icon: <X size={16} />,
      bg: 'bg-[#E50914]/10 border-[#E50914]/30',
      text: 'text-[#E50914]',
      title: 'Documentos reprovados',
      msg: 'Envie novos documentos para concluir a verificação.',
    },
    INCOMPLETO: {
      icon: <AlertCircle size={16} />,
      bg: 'bg-[#2A2A2A] border-[#333]',
      text: 'text-[#B3B3B3]',
      title: 'Verificação pendente',
      msg: 'Envie seus documentos para ter seu cadastro aprovado.',
    },
  }
  const c = cfg[status] ?? cfg.INCOMPLETO
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${c.bg}`}>
      <span className={`flex-shrink-0 mt-0.5 ${c.text}`}>{c.icon}</span>
      <div>
        <p className={`text-sm font-semibold ${c.text}`}>{c.title}</p>
        <p className="text-xs text-[#B3B3B3] mt-0.5">{c.msg}</p>
      </div>
    </div>
  )
}

function PendingClock() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function PropertyRow({ property, onToggle }: { property: Property; onToggle: (p: Property) => void }) {
  return (
    <Card className="p-4 flex items-center gap-4">
      <img src={property.photos[0] ?? ''} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white text-sm line-clamp-1">{property.name}</p>
        <p className="text-xs text-[#B3B3B3]">{property.city}, {property.state}</p>
        <div className="flex items-center gap-2 mt-1">
          <PropertyStatusBadge status={property.status} />
          <span className="text-xs text-[#666]">{formatCurrency(property.price_per_night)}/noite</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link to={APP_ROUTES.PROPERTY(property.id)}>
          <button className="w-8 h-8 rounded-lg bg-[#2A2A2A] flex items-center justify-center text-[#B3B3B3] hover:text-white transition-colors">
            <Eye size={14} />
          </button>
        </Link>
        <button className="w-8 h-8 rounded-lg bg-[#2A2A2A] flex items-center justify-center text-[#B3B3B3] hover:text-white transition-colors">
          <Pencil size={14} />
        </button>
        <button
          onClick={() => onToggle(property)}
          className="w-8 h-8 rounded-lg bg-[#2A2A2A] flex items-center justify-center transition-colors"
          title={property.status === 'ATIVO' ? 'Desativar' : 'Ativar'}
        >
          {property.status === 'ATIVO'
            ? <ToggleRight size={16} className="text-[#46D369]" />
            : <ToggleLeft size={16} className="text-[#666]" />
          }
        </button>
      </div>
    </Card>
  )
}

function PropertyStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ATIVO: 'bg-[#46D369]/20 text-[#46D369]',
    PENDENTE: 'bg-[#F5A623]/20 text-[#F5A623]',
    INATIVO: 'bg-[#333] text-[#666]',
    REPROVADO: 'bg-[#E50914]/20 text-[#E50914]',
  }
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${map[status] ?? map.PENDENTE}`}>{status}</span>
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    AGUARDANDO_PAGAMENTO: 'text-[#F5A623]', PARCIAL: 'text-blue-400',
    PAGO: 'text-[#46D369]', CONCLUIDA: 'text-[#B3B3B3]', CANCELADA: 'text-[#E50914]',
  }
  const labels: Record<string, string> = {
    AGUARDANDO_PAGAMENTO: 'Aguardando', PARCIAL: 'Parcial',
    PAGO: 'Pago', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada',
  }
  return <span className={`text-xs font-medium ${map[status] ?? 'text-[#B3B3B3]'}`}>{labels[status] ?? status}</span>
}
