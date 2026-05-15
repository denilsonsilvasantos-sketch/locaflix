import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  Home, Calendar, DollarSign, Star, Plus, Eye, Pencil,
  ToggleLeft, ToggleRight, ShieldCheck, Check, X, AlertCircle,
  ChevronDown, ChevronUp, Trash2, User, LogOut,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Property, Booking, Review, KinshipType, OwnershipType, PricePeriod, PeriodType } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { Card, StatCard } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { KYCDocumentField } from '../components/ui/KYCDocumentField'
import { Logo } from '../components/layout/Logo'
import { formatCurrency, formatShortDate } from '../lib/utils'
import { APP_ROUTES } from '../constants'
import { PERIOD_TYPE_LABELS, PERIOD_DEFAULT_NAMES, PERIOD_TYPES_WITH_DATES } from '../lib/pricing'

const PERIOD_TYPE_OPTIONS = (Object.keys(PERIOD_TYPE_LABELS) as PeriodType[]).map(v => ({
  value: v,
  label: PERIOD_TYPE_LABELS[v],
}))

const KINSHIP_LABELS: Record<KinshipType, string> = {
  PAI: 'Pai', MAE: 'Mãe', ESPOSO: 'Esposo', ESPOSA: 'Esposa',
  FILHO: 'Filho', FILHA: 'Filha', OUTRO: 'Outro (Procuração)',
}

const NAV = [
  { label: 'Imóveis',    icon: <Home size={16} />,       href: '/anfitriao',                  tabKey: 'imoveis' },
  { label: 'Reservas',   icon: <Calendar size={16} />,   href: '/anfitriao?tab=reservas',     tabKey: 'reservas' },
  { label: 'Financeiro', icon: <DollarSign size={16} />, href: '/anfitriao?tab=financeiro',   tabKey: 'financeiro' },
  { label: 'Avaliações', icon: <Star size={16} />,       href: '/anfitriao?tab=avaliacoes',   tabKey: 'avaliacoes' },
  { label: 'Documentos', icon: <ShieldCheck size={16} />,href: '/anfitriao?tab=documentos',   tabKey: 'documentos' },
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
  const { user, profile, refreshProfile, signOut } = useAuth()
  const { toast } = useToast()

  const [properties, setProperties] = useState<Property[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [submittingKyc, setSubmittingKyc] = useState(false)
  const [kycForm, setKycForm] = useState<KycForm>({
    document_url: '', address_proof_url: '', ownership_type: 'PROPRIO',
    actual_owner_name: '', actual_owner_cpf: '', actual_owner_document_url: '',
    kinship_type: '', kinship_document_url: '',
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
        .limit(50),
    ])
    const propList = (props ?? []) as Property[]
    setProperties(propList)
    setBookings((bks ?? []) as Booking[])

    if (propList.length > 0) {
      const { data: revs } = await supabase
        .from('reviews')
        .select('*, reviewer:users(id, name, avatar_url)')
        .in('target_property_id', propList.map(p => p.id))
        .eq('visible', true)
        .order('created_at', { ascending: false })
        .limit(50)
      setReviews((revs ?? []) as Review[])
    }

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

  // Computed metrics
  const activeProperties = properties.filter(p => p.status === 'ATIVO')
  const activeBookings = bookings.filter(b => b.status === 'PAGO' || b.status === 'PARCIAL')
  const now = new Date()
  const monthlyRevenue = bookings
    .flatMap(b => b.installments ?? [])
    .filter(i => {
      if (i.status !== 'PAGO') return false
      const d = new Date(i.paid_at ?? i.due_date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((s, i) => s + i.value, 0)
  const ratedProps = properties.filter(p => p.rating)
  const avgRating = ratedProps.length > 0
    ? (ratedProps.reduce((s, p) => s + (p.rating ?? 0), 0) / ratedProps.length).toFixed(1)
    : '—'
  const totalRevenue = bookings
    .filter(b => b.status === 'PAGO' || b.status === 'CONCLUIDA')
    .reduce((s, b) => s + b.subtotal - b.platform_fee, 0)

  return (
    <div className="min-h-screen bg-[#141414]">

      {/* ── Desktop sidebar ───────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-20 w-56 h-[calc(100vh-5rem)] bg-[#0F0F0F] border-r border-[#1F1F1F] z-30">
        <div className="px-5 py-5 border-b border-[#1F1F1F]">
          <Logo size="sm" />
          <p className="text-[10px] text-[#555] mt-2 truncate">{profile?.name ?? 'Anfitrião'}</p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const active = item.tabKey === tab
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active ? 'bg-[#E50914] text-white' : 'text-[#B3B3B3] hover:text-white hover:bg-[#1F1F1F]'
                }`}
              >
                <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-[#1F1F1F] space-y-0.5">
          <Link
            to={APP_ROUTES.GUEST_DASHBOARD}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#B3B3B3] hover:text-white hover:bg-[#1F1F1F] transition-all"
          >
            <User size={14} className="flex-shrink-0" />
            Minha Conta
          </Link>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#B3B3B3] hover:text-[#E50914] hover:bg-[#1F1F1F] transition-all"
          >
            <LogOut size={14} className="flex-shrink-0" />
            Sair
          </button>
        </div>
      </aside>

      {/* ── Mobile tab bar ────────────────────────────────────── */}
      <div className="lg:hidden border-b border-[#333] bg-[#0F0F0F] sticky top-20 z-30">
        <div className="flex overflow-x-auto scrollbar-hide px-2">
          {NAV.map(item => {
            const active = item.tabKey === tab
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-4 py-3 text-[10px] font-medium border-b-2 transition-colors ${
                  active ? 'border-[#E50914] text-white' : 'border-transparent text-[#B3B3B3] hover:text-white'
                }`}
              >
                <span className="w-4 h-4">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────── */}
      <div className="lg:ml-56 pt-20 lg:pt-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {loading ? (
            <div className="flex justify-center items-center py-32">
              <div className="w-8 h-8 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* ── IMÓVEIS / DASHBOARD ────────────────────────── */}
              {tab === 'imoveis' && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    <div>
                      <h1 className="font-display text-2xl font-bold text-white">Portal do Anfitrião</h1>
                      <p className="text-sm text-[#B3B3B3] mt-1">
                        Bem-vindo, {profile?.name?.split(' ')[0] ?? 'Anfitrião'}
                      </p>
                    </div>
                    <Link to={APP_ROUTES.NEW_PROPERTY}>
                      <Button className="gap-1.5"><Plus size={14} /> Cadastrar Imóvel</Button>
                    </Link>
                  </div>

                  {/* KPIs */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                    <StatCard label="Imóveis ativos" value={activeProperties.length} icon={<Home size={18} />} />
                    <StatCard label="Reservas ativas" value={activeBookings.length} icon={<Calendar size={18} />} />
                    <StatCard label="Receita do mês" value={formatCurrency(monthlyRevenue)} icon={<DollarSign size={18} />} accent />
                    <StatCard
                      label="Avaliação média"
                      value={avgRating}
                      icon={<Star size={18} />}
                    />
                  </div>

                  {/* Reservas recentes */}
                  <section className="mb-10">
                    <h2 className="font-display text-lg font-bold text-white mb-4">Reservas Recentes</h2>
                    {bookings.length === 0 ? (
                      <div className="text-center py-10 text-[#555]">
                        <Calendar size={36} className="mx-auto mb-3" />
                        <p className="text-sm">Nenhuma reserva ainda.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {bookings.slice(0, 5).map(b => (
                          <Card key={b.id} className="p-4">
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="w-9 h-9 rounded-full bg-[#E50914] flex items-center justify-center text-xs font-bold text-white overflow-hidden flex-shrink-0">
                                {b.guest?.avatar_url
                                  ? <img src={b.guest.avatar_url} alt="" className="w-full h-full object-cover" />
                                  : (b.guest?.name?.[0] ?? 'H')
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{b.guest?.name ?? 'Hóspede'}</p>
                                <p className="text-xs text-[#B3B3B3] truncate">
                                  {b.property?.name} · {formatShortDate(b.check_in)} → {formatShortDate(b.check_out)}
                                </p>
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
                  </section>

                  {/* Meus imóveis */}
                  <section>
                    <h2 className="font-display text-lg font-bold text-white mb-4">Meus Imóveis</h2>
                    {properties.length === 0 ? (
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
                  </section>
                </>
              )}

              {/* ── RESERVAS ───────────────────────────────────── */}
              {tab === 'reservas' && (
                <div>
                  <h2 className="font-display text-xl font-bold text-white mb-4">Reservas recebidas</h2>
                  {bookings.length === 0 ? (
                    <div className="text-center py-16 text-[#555]">
                      <Calendar size={48} className="mx-auto mb-4" />
                      <p>Nenhuma reserva ainda.</p>
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
                                  : (b.guest?.name?.[0] ?? 'H')
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

              {/* ── FINANCEIRO ─────────────────────────────────── */}
              {tab === 'financeiro' && (
                <div>
                  <h2 className="font-display text-xl font-bold text-white mb-4">Financeiro</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <StatCard
                      label="Receita bruta"
                      value={formatCurrency(bookings.filter(b => ['PAGO','CONCLUIDA','PARCIAL'].includes(b.status)).reduce((s, b) => s + b.subtotal, 0))}
                      icon={<DollarSign size={18} />}
                      accent
                    />
                    <StatCard
                      label="Taxa plataforma"
                      value={formatCurrency(bookings.reduce((s, b) => s + b.platform_fee, 0))}
                      icon={<DollarSign size={18} />}
                    />
                    <StatCard
                      label="Receita líquida"
                      value={formatCurrency(totalRevenue)}
                      icon={<DollarSign size={18} />}
                      accent
                    />
                  </div>
                  <Card className="p-5">
                    <h3 className="text-sm font-semibold text-white mb-3">Histórico de pagamentos</h3>
                    {bookings.length === 0 ? (
                      <p className="text-sm text-[#666]">Nenhum pagamento registrado.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[480px]">
                          <thead>
                            <tr className="text-[#666] text-xs border-b border-[#333]">
                              <th className="text-left pb-2">Reserva</th>
                              <th className="text-left pb-2">Hóspede</th>
                              <th className="text-right pb-2">Valor líquido</th>
                              <th className="text-right pb-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bookings.slice(0, 20).map(b => (
                              <tr key={b.id} className="border-b border-[#1F1F1F] text-xs">
                                <td className="py-2 text-[#B3B3B3]">{b.booking_number}</td>
                                <td className="py-2 text-white">{b.guest?.name}</td>
                                <td className="py-2 text-right text-[#F5A623] font-bold">{formatCurrency(b.subtotal - b.platform_fee)}</td>
                                <td className="py-2 text-right"><StatusBadge status={b.status} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {/* ── AVALIAÇÕES ─────────────────────────────────── */}
              {tab === 'avaliacoes' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-xl font-bold text-white">Avaliações recebidas</h2>
                    {reviews.length > 0 && (
                      <span className="text-sm text-[#B3B3B3]">
                        {reviews.length} avaliação{reviews.length !== 1 ? 'ões' : ''}
                      </span>
                    )}
                  </div>
                  {reviews.length === 0 ? (
                    <div className="text-center py-16 text-[#555]">
                      <Star size={48} className="mx-auto mb-4" />
                      <p className="text-sm">Nenhuma avaliação ainda.</p>
                      <p className="text-xs mt-1 text-[#444]">Avaliações aparecem aqui após as estadas dos hóspedes.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reviews.map(r => (
                        <Card key={r.id} className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="w-9 h-9 rounded-full bg-[#E50914] flex items-center justify-center text-xs font-bold text-white overflow-hidden flex-shrink-0">
                              {r.reviewer?.avatar_url
                                ? <img src={r.reviewer.avatar_url} alt="" className="w-full h-full object-cover" />
                                : (r.reviewer?.name?.[0] ?? 'H')
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-white">{r.reviewer?.name ?? 'Hóspede'}</p>
                                <div className="flex items-center gap-0.5">
                                  {[1, 2, 3, 4, 5].map(s => (
                                    <Star
                                      key={s}
                                      size={12}
                                      className={s <= r.rating ? 'text-[#F5A623] fill-[#F5A623]' : 'text-[#333]'}
                                    />
                                  ))}
                                  <span className="text-xs text-[#B3B3B3] ml-1">{r.rating}.0</span>
                                </div>
                              </div>
                              {r.comment && (
                                <p className="text-sm text-[#B3B3B3] mt-2 leading-relaxed">{r.comment}</p>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── DOCUMENTOS ─────────────────────────────────── */}
              {tab === 'documentos' && (
                <div className="max-w-lg">
                  <h2 className="font-display text-xl font-bold text-white mb-5">Verificação de identidade</h2>
                  <KYCStatusBanner status={profile?.kyc_status ?? 'INCOMPLETO'} />

                  {profile?.kyc_status !== 'APROVADO' && (
                    <Card className="p-6 mt-4 space-y-7">
                      <KYCDocumentField
                        userId={user!.id}
                        fieldKey="document"
                        label="Documento com foto"
                        hint="RG ou CNH — frente e verso, em um único arquivo"
                        currentUrl={kycForm.document_url}
                        disabled={isPending}
                        onSuccess={url => upd('document_url', url)}
                      />

                      <KYCDocumentField
                        userId={user!.id}
                        fieldKey="address_proof"
                        label="Comprovante de endereço"
                        hint="Conta de luz, água, internet ou extrato bancário — emitido nos últimos 3 meses"
                        currentUrl={kycForm.address_proof_url}
                        disabled={isPending}
                        onSuccess={url => upd('address_proof_url', url)}
                      />

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
                            <p className="text-xs text-[#666] mt-0.5">Marque se o imóvel não está em seu nome</p>
                          </div>
                        </label>
                      </div>

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
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function KYCStatusBanner({ status }: { status: string }) {
  const cfg: Record<string, { icon: React.ReactNode; bg: string; text: string; title: string; msg: string }> = {
    APROVADO:   { icon: <Check size={16} />,        bg: 'bg-[#46D369]/10 border-[#46D369]/30', text: 'text-[#46D369]', title: 'Identidade verificada',    msg: 'Seus documentos foram aprovados.' },
    PENDENTE:   { icon: <PendingClock />,            bg: 'bg-[#F5A623]/10 border-[#F5A623]/30', text: 'text-[#F5A623]', title: 'Documentos em análise',    msg: 'Aguarde a revisão. Você será notificado quando aprovado.' },
    REPROVADO:  { icon: <X size={16} />,            bg: 'bg-[#E50914]/10 border-[#E50914]/30', text: 'text-[#E50914]', title: 'Documentos reprovados',    msg: 'Envie novos documentos para concluir a verificação.' },
    INCOMPLETO: { icon: <AlertCircle size={16} />,  bg: 'bg-[#2A2A2A] border-[#333]',          text: 'text-[#B3B3B3]', title: 'Verificação pendente',     msg: 'Envie seus documentos para ter seu cadastro aprovado.' },
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
  const [showPrices, setShowPrices] = useState(false)

  return (
    <Card className="overflow-hidden">
      <div className="p-4 flex items-center gap-4">
        <img src={property.photos[0] ?? ''} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-[#2A2A2A]" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm line-clamp-1">{property.name}</p>
          <p className="text-xs text-[#B3B3B3]">{property.city}, {property.state}</p>
          <div className="flex items-center gap-2 mt-1">
            <PropertyStatusBadge status={property.status} />
            <span className="text-xs text-[#666]">{formatCurrency(property.price_per_night)}/noite</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowPrices(v => !v)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${showPrices ? 'bg-[#E50914]/20 text-[#E50914]' : 'bg-[#2A2A2A] text-[#B3B3B3] hover:text-white'}`}
            title="Preços por período"
          >
            <DollarSign size={14} />
          </button>
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
      </div>

      {showPrices && (
        <div className="border-t border-[#2A2A2A] bg-[#141414]">
          <PricePeriodsManager propertyId={property.id} defaultPrice={property.price_per_night} />
        </div>
      )}
    </Card>
  )
}

// ── PricePeriodsManager ───────────────────────────────────────

interface NewPeriodForm {
  period_type: PeriodType
  name: string
  price_per_night: string
  start_date: string
  end_date: string
  priority: string
}

function PricePeriodsManager({ propertyId, defaultPrice }: { propertyId: string; defaultPrice: number }) {
  const { toast } = useToast()
  const [periods, setPeriods] = useState<PricePeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<NewPeriodForm>({
    period_type: 'WEEKEND',
    name: PERIOD_DEFAULT_NAMES.WEEKEND,
    price_per_night: '',
    start_date: '',
    end_date: '',
    priority: '0',
  })

  useEffect(() => {
    supabase
      .from('price_periods')
      .select('*')
      .eq('property_id', propertyId)
      .order('priority', { ascending: false })
      .then(({ data }) => {
        setPeriods((data ?? []) as PricePeriod[])
        setLoading(false)
      })
  }, [propertyId])

  function updForm(patch: Partial<NewPeriodForm>) {
    setForm(f => ({ ...f, ...patch }))
  }

  function handleTypeChange(t: PeriodType) {
    updForm({ period_type: t, name: PERIOD_DEFAULT_NAMES[t] })
  }

  async function handleAdd() {
    if (!form.name.trim() || !form.price_per_night) {
      toast('warning', 'Campos obrigatórios', 'Preencha o nome e o preço.')
      return
    }
    const needsDates = PERIOD_TYPES_WITH_DATES.includes(form.period_type)
    if (needsDates && (!form.start_date || !form.end_date)) {
      toast('warning', 'Datas obrigatórias', 'Defina o início e o fim do período.')
      return
    }
    setSaving(true)
    const { data, error } = await supabase
      .from('price_periods')
      .insert({
        property_id: propertyId,
        name: form.name.trim(),
        period_type: form.period_type,
        price_per_night: Number(form.price_per_night),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        priority: Number(form.priority) || 0,
        active: true,
      })
      .select()
      .single()
    setSaving(false)
    if (error) { toast('error', 'Erro', error.message); return }
    setPeriods(p => [data as PricePeriod, ...p].sort((a, b) => b.priority - a.priority))
    setForm({ period_type: 'WEEKEND', name: PERIOD_DEFAULT_NAMES.WEEKEND, price_per_night: '', start_date: '', end_date: '', priority: '0' })
    setShowForm(false)
    toast('success', 'Período adicionado')
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('price_periods').delete().eq('id', id)
    if (error) { toast('error', 'Erro', error.message); return }
    setPeriods(p => p.filter(x => x.id !== id))
    toast('success', 'Período removido')
  }

  async function handleToggle(period: PricePeriod) {
    const { error } = await supabase.from('price_periods').update({ active: !period.active }).eq('id', period.id)
    if (error) { toast('error', 'Erro', error.message); return }
    setPeriods(p => p.map(x => x.id === period.id ? { ...x, active: !x.active } : x))
  }

  const needsDates = PERIOD_TYPES_WITH_DATES.includes(form.period_type)

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[#B3B3B3] uppercase tracking-wide">Preços por período</p>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-xs text-[#E50914] hover:text-red-400 transition-colors font-medium"
        >
          {showForm ? <ChevronUp size={13} /> : <Plus size={13} />}
          {showForm ? 'Cancelar' : 'Adicionar período'}
        </button>
      </div>

      {showForm && (
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-[#666] block mb-1">Tipo</label>
              <select
                value={form.period_type}
                onChange={e => handleTypeChange(e.target.value as PeriodType)}
                className="w-full bg-[#2A2A2A] border border-[#333] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#555]"
              >
                {PERIOD_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value} className="bg-[#2A2A2A]">{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#666] block mb-1">Nome</label>
              <input
                value={form.name}
                onChange={e => updForm({ name: e.target.value })}
                className="w-full bg-[#2A2A2A] border border-[#333] rounded-lg px-3 py-2 text-xs text-white placeholder-[#555] outline-none focus:border-[#555]"
              />
            </div>
          </div>
          <div className={`grid gap-2 ${needsDates ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
            <div>
              <label className="text-xs text-[#666] block mb-1">Preço/noite (R$)</label>
              <input
                type="number" min="1" step="0.01"
                value={form.price_per_night}
                onChange={e => updForm({ price_per_night: e.target.value })}
                placeholder="0,00"
                className="w-full bg-[#2A2A2A] border border-[#333] rounded-lg px-3 py-2 text-xs text-white placeholder-[#555] outline-none focus:border-[#555]"
              />
            </div>
            <div>
              <label className="text-xs text-[#666] block mb-1">Prioridade</label>
              <input
                type="number" min="0"
                value={form.priority}
                onChange={e => updForm({ priority: e.target.value })}
                className="w-full bg-[#2A2A2A] border border-[#333] rounded-lg px-3 py-2 text-xs text-white placeholder-[#555] outline-none focus:border-[#555]"
              />
            </div>
            {needsDates && (
              <>
                <div>
                  <label className="text-xs text-[#666] block mb-1">Início</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={e => updForm({ start_date: e.target.value })}
                    className="w-full bg-[#2A2A2A] border border-[#333] rounded-lg px-2 py-2 text-xs text-white outline-none focus:border-[#555]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#666] block mb-1">Fim</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={e => updForm({ end_date: e.target.value })}
                    className="w-full bg-[#2A2A2A] border border-[#333] rounded-lg px-2 py-2 text-xs text-white outline-none focus:border-[#555]"
                  />
                </div>
              </>
            )}
          </div>
          <Button onClick={handleAdd} loading={saving} size="sm" className="w-full">
            Salvar período
          </Button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-4">
          <div className="w-5 h-5 border-2 border-[#E50914] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : periods.length === 0 ? (
        <p className="text-xs text-[#555] text-center py-3">
          Nenhum período configurado — será usado o preço base ({formatCurrency(defaultPrice)}/noite) para todas as diárias.
        </p>
      ) : (
        <div className="space-y-2">
          {periods.map(p => (
            <div
              key={p.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-opacity ${p.active ? 'border-[#2A2A2A] bg-[#1A1A1A]' : 'border-[#1F1F1F] bg-[#111] opacity-50'}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-white truncate">{p.name}</p>
                  <span className="text-[10px] text-[#555] shrink-0">prio {p.priority}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-[#666]">{PERIOD_TYPE_LABELS[p.period_type]}</span>
                  {p.start_date && p.end_date && (
                    <span className="text-[10px] text-[#555]">· {p.start_date} → {p.end_date}</span>
                  )}
                </div>
              </div>
              <span className="text-sm font-bold text-[#F5A623] shrink-0">{formatCurrency(p.price_per_night)}</span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleToggle(p)}
                  className="w-7 h-7 rounded-lg bg-[#2A2A2A] flex items-center justify-center text-[#666] hover:text-white transition-colors"
                  title={p.active ? 'Desativar' : 'Ativar'}
                >
                  {p.active ? <ToggleRight size={13} className="text-[#46D369]" /> : <ToggleLeft size={13} />}
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="w-7 h-7 rounded-lg bg-[#2A2A2A] flex items-center justify-center text-[#666] hover:text-[#E50914] transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
