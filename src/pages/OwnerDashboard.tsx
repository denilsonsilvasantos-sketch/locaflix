import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  Home, Calendar, DollarSign, Star, Plus, Eye, Pencil,
  ToggleLeft, ToggleRight, ShieldCheck, Check, X, AlertCircle,
  ChevronUp, Trash2, LogOut, MessageSquare, TrendingUp, Info,
  CalendarRange, RefreshCw, Link2, ChevronLeft, ChevronRight, Lock, Unlock, Copy, CalendarPlus, XCircle,
} from 'lucide-react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import type { Property, Booking, Installment, Review, KinshipType, OwnershipType, PricePeriod, PeriodType, CalendarBlock, ExtensionRequest } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { useUnreadMessages } from '../hooks/useUnreadMessages'
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
  { label: 'Imóveis',    icon: <Home size={16} />,           href: '/anfitriao',                  tabKey: 'imoveis' },
  { label: 'Reservas',   icon: <Calendar size={16} />,       href: '/anfitriao?tab=reservas',     tabKey: 'reservas' },
  { label: 'Calendário', icon: <CalendarRange size={16} />,  href: '/anfitriao?tab=calendario',   tabKey: 'calendario' },
  { label: 'Financeiro', icon: <DollarSign size={16} />,     href: '/anfitriao?tab=financeiro',   tabKey: 'financeiro' },
  { label: 'Avaliações', icon: <Star size={16} />,           href: '/anfitriao?tab=avaliacoes',   tabKey: 'avaliacoes' },
  { label: 'Documentos', icon: <ShieldCheck size={16} />,    href: '/anfitriao?tab=documentos',   tabKey: 'documentos' },
  { label: 'Mensagens',  icon: <MessageSquare size={16} />,  href: '/mensagens',                  tabKey: 'mensagens' },
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
  const { unreadCount } = useUnreadMessages()

  const [properties, setProperties] = useState<Property[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [extensionRequests, setExtensionRequests] = useState<ExtensionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [submittingKyc, setSubmittingKyc] = useState(false)


  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null)
  const [cancellingBooking, setCancellingBooking] = useState(false)
  const [contractBooking, setContractBooking] = useState<Booking | null>(null)
  const [acceptingContract, setAcceptingContract] = useState(false)
  const [bankForm, setBankForm] = useState({
    pix_key: '', bank_name: '', bank_agency: '', bank_account: '', bank_account_type: 'corrente',
  })
  const [savingBank, setSavingBank] = useState(false)

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
      setBankForm({
        pix_key: profile.pix_key ?? '',
        bank_name: profile.bank_name ?? '',
        bank_agency: profile.bank_agency ?? '',
        bank_account: profile.bank_account ?? '',
        bank_account_type: profile.bank_account_type ?? 'corrente',
      })
    }
  }, [profile])

  async function loadData() {
    setLoading(true)
    const [{ data: propData, error: propErr }, { data: bkData, error: bkErr }] = await Promise.all([
      supabase.from('properties').select('*').eq('owner_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('bookings')
        .select('*')
        .eq('owner_id', user!.id)
        .neq('status', 'AGUARDANDO_PAGAMENTO')
        .order('created_at', { ascending: false })
        .limit(50),
    ])
    if (bkErr)   console.error('[OwnerDashboard] bookings:', bkErr)
    if (propErr) console.error('[OwnerDashboard] properties:', propErr)

    const propList = (propData ?? []) as Property[]
    setProperties(propList)
    const propMap = Object.fromEntries(propList.map(p => [p.id, p]))
    const bkList = (bkData ?? []) as (Booking & { property_id: string })[]

    if (bkList.length > 0) {
      const bookingIds = bkList.map(b => b.id)
      const guestIds = [...new Set(bkList.map(b => b.guest_id).filter(Boolean))]
      const [{ data: guestUsers }, { data: installRows }] = await Promise.all([
        supabase.from('users').select('id,name,avatar_url').in('id', guestIds),
        supabase.from('installments').select('*').in('booking_id', bookingIds),
      ])
      const guestMap = Object.fromEntries((guestUsers ?? []).map((u: { id: string; name: string | null; avatar_url: string | null }) => [u.id, u]))
      const installMap: Record<string, Installment[]> = {}
      for (const inst of (installRows ?? []) as Installment[]) {
        if (!installMap[inst.booking_id]) installMap[inst.booking_id] = []
        installMap[inst.booking_id].push(inst)
      }
      setBookings(bkList.map(b => ({
        ...b,
        property: (propMap[b.property_id] ?? null) as Property,
        guest: (guestMap[b.guest_id] ?? null) as Booking['guest'],
        installments: installMap[b.id] ?? [],
      })))
    } else {
      setBookings([])
    }

    if (propList.length > 0) {
      const { data: rawRevs } = await supabase
        .from('reviews')
        .select('*')
        .in('target_property_id', propList.map(p => p.id))
        .eq('visible', true)
        .order('created_at', { ascending: false })
        .limit(50)

      const revList = (rawRevs ?? []) as Review[]
      if (revList.length > 0) {
        const rIds = [...new Set(revList.map(r => r.reviewer_id).filter(Boolean))]
        const { data: rUsers } = await supabase.from('users').select('id, name, avatar_url').in('id', rIds)
        const rMap = Object.fromEntries((rUsers ?? []).map((u: { id: string; name: string | null; avatar_url: string | null }) => [u.id, u]))
        setReviews(revList.map(r => ({ ...r, reviewer: rMap[r.reviewer_id] ?? null })))
      } else {
        setReviews([])
      }
    }

    // Load pending extension requests
    const { data: extData } = await supabase
      .from('extension_requests')
      .select('*, booking:bookings(id,check_in,check_out,booking_number,property:properties(name)), guest:users!guest_id(id,name,avatar_url)')
      .eq('owner_id', user!.id)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })
    setExtensionRequests((extData ?? []) as ExtensionRequest[])

    setLoading(false)
  }

  async function handleExtensionAction(req: ExtensionRequest, action: 'ACCEPTED' | 'REJECTED') {
    const { error } = await supabase
      .from('extension_requests')
      .update({ status: action })
      .eq('id', req.id)
    if (error) { toast('error', 'Erro', error.message); return }
    if (action === 'ACCEPTED') {
      await supabase.from('bookings').update({ check_out: req.new_checkout }).eq('id', req.booking_id)
      toast('success', 'Prorrogação aceita', `Checkout atualizado para ${formatShortDate(req.new_checkout)}`)
    } else {
      toast('info', 'Prorrogação recusada')
    }
    setExtensionRequests(prev => prev.filter(r => r.id !== req.id))
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

  async function confirmAccept() {
    if (!contractBooking) return
    setAcceptingContract(true)
    const { error } = await supabase.from('bookings').update({ owner_confirmed: true }).eq('id', contractBooking.id)
    if (error) { toast('error', 'Erro', error.message); setAcceptingContract(false); return }
    setBookings(prev => prev.map(b => b.id === contractBooking!.id ? { ...b, owner_confirmed: true } : b))
    toast('success', 'Reserva aceita', 'O hóspede será notificado.')
    setContractBooking(null)
    setAcceptingContract(false)
  }

  async function cancelBookingByOwner() {
    if (!cancelBookingId) return
    setCancellingBooking(true)
    const { error } = await supabase.from('bookings')
      .update({ status: 'CANCELADA', cancellation_reason: 'CANCELAMENTO_ANFITRIAO' })
      .eq('id', cancelBookingId)
    if (error) { toast('error', 'Erro', error.message); setCancellingBooking(false); return }
    setBookings(prev => prev.map(b =>
      b.id === cancelBookingId ? { ...b, status: 'CANCELADA', cancellation_reason: 'CANCELAMENTO_ANFITRIAO' } : b
    ))
    toast('success', 'Reserva cancelada', 'O hóspede será notificado.')
    setCancelBookingId(null)
    setCancellingBooking(false)
  }

  async function saveBankData() {
    if (!user) return
    setSavingBank(true)
    const { error } = await supabase.from('users').update({
      pix_key: bankForm.pix_key || null,
      bank_name: bankForm.bank_name || null,
      bank_agency: bankForm.bank_agency || null,
      bank_account: bankForm.bank_account || null,
      bank_account_type: bankForm.bank_account_type || null,
    }).eq('id', user.id)
    if (error) { toast('error', 'Erro', error.message) } else {
      await refreshProfile()
      toast('success', 'Dados salvos', 'Suas informações bancárias foram atualizadas.')
    }
    setSavingBank(false)
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

  const cancelRate = bookings.length > 0
    ? Math.round((bookings.filter(b => b.status === 'CANCELADA').length / bookings.length) * 100)
    : 0

  const completedWithDates = bookings.filter(b =>
    ['PAGO', 'CONCLUIDA'].includes(b.status) && b.check_in && b.check_out
  )
  const avgNights = completedWithDates.length > 0
    ? Math.round(
        completedWithDates.reduce((s, b) => {
          const diff = new Date(b.check_out).getTime() - new Date(b.check_in).getTime()
          return s + diff / 86400000
        }, 0) / completedWithDates.length
      )
    : 0

  const occupationChart = useMemo(() => {
    const n = new Date()
    return Array.from({ length: 3 }, (_, i) => {
      const d = new Date(n.getFullYear(), n.getMonth() - (2 - i), 1)
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleString('pt-BR', { month: 'short' })
      const monthBks = bookings.filter(b =>
        ['PAGO', 'CONCLUIDA', 'PARCIAL'].includes(b.status) &&
        (b.created_at ?? '').startsWith(prefix)
      )
      return {
        month: label,
        reservas: monthBks.length,
        receita: monthBks.reduce((s, b) => s + b.subtotal - b.platform_fee, 0),
      }
    })
  }, [bookings])

  const revenueChart = useMemo(() => {
    const n = new Date()
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(n.getFullYear(), n.getMonth() - (11 - i), 1)
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' })
      const monthBks = bookings.filter(b =>
        ['PAGO', 'CONCLUIDA'].includes(b.status) &&
        (b.check_in ?? '').startsWith(prefix)
      )
      return {
        month: label,
        liquido: Math.round(monthBks.reduce((s, b) => s + b.subtotal - b.platform_fee, 0)),
        reservas: monthBks.length,
        noites: monthBks.reduce((s, b) => s + (b.nights ?? 0), 0),
      }
    })
  }, [bookings])

  const revenueByProperty = useMemo(() => {
    return properties.map(p => {
      const propBks = bookings.filter(b => b.property_id === p.id && ['PAGO','CONCLUIDA'].includes(b.status))
      return {
        name: p.name.length > 20 ? p.name.slice(0, 20) + '…' : p.name,
        liquido: Math.round(propBks.reduce((s, b) => s + b.subtotal - b.platform_fee, 0)),
        reservas: propBks.length,
      }
    }).filter(p => p.reservas > 0).sort((a, b) => b.liquido - a.liquido)
  }, [properties, bookings])

  const occupancyRate = useMemo(() => {
    const n = new Date()
    const daysInMonth = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate()
    const bookedNights = bookings
      .filter(b => ['PAGO','CONCLUIDA'].includes(b.status))
      .reduce((s, b) => {
        const ci = new Date(b.check_in + 'T00:00:00')
        const co = new Date(b.check_out + 'T00:00:00')
        const monthStart = new Date(n.getFullYear(), n.getMonth(), 1)
        const monthEnd = new Date(n.getFullYear(), n.getMonth(), daysInMonth)
        const from = ci < monthStart ? monthStart : ci
        const to = co > monthEnd ? monthEnd : co
        const diff = Math.max(0, (to.getTime() - from.getTime()) / 86400000)
        return s + diff
      }, 0)
    const totalCapacity = properties.length * daysInMonth
    return totalCapacity > 0 ? Math.round((bookedNights / totalCapacity) * 100) : 0
  }, [bookings, properties])

  const avgTicket = useMemo(() => {
    const paid = bookings.filter(b => ['PAGO','CONCLUIDA'].includes(b.status))
    return paid.length > 0 ? paid.reduce((s, b) => s + b.total_price, 0) / paid.length : 0
  }, [bookings])

  return (
    <div className="min-h-screen bg-[#141414]">

      {/* ── Desktop sidebar ───────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-20 w-56 h-[calc(100vh-5rem)] bg-[#0F0F0F] border-r border-[#1F1F1F] z-30">
        <div className="px-5 py-5 border-b border-[#1F1F1F]">
          <Logo size="sm" />
          <p className="text-xs text-[#888] mt-2 truncate">{profile?.name ?? 'Anfitrião'}</p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const active = item.tabKey === tab
            const badge = item.tabKey === 'mensagens' && unreadCount > 0 ? unreadCount : 0
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active ? 'bg-[#E50914] text-white' : 'text-[#B3B3B3] hover:text-white hover:bg-[#1F1F1F]'
                }`}
              >
                <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {badge > 0 && (
                  <span className="min-w-[18px] h-[18px] bg-[#E50914] rounded-full text-[9px] font-bold text-white flex items-center justify-center px-1">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-[#1F1F1F]">
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
            const badge = item.tabKey === 'mensagens' && unreadCount > 0 ? unreadCount : 0
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
                  active ? 'border-[#E50914] text-white' : 'border-transparent text-[#B3B3B3] hover:text-white'
                }`}
              >
                <span className="relative w-4 h-4">
                  {item.icon}
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1.5 min-w-[10px] h-2.5 bg-[#E50914] rounded-full text-[7px] font-bold text-white flex items-center justify-center px-0.5">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────── */}
      <div className="lg:ml-56 pt-20">
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
                  {/* Rejected properties banner */}
                  {properties.filter(p => p.status === 'REPROVADO').map(p => (
                    <div key={p.id} className="mb-4 bg-[#E50914]/10 border border-[#E50914]/40 rounded-2xl p-4">
                      <div className="flex items-start gap-3">
                        <XCircle size={18} className="text-[#E50914] flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#E50914]">Imóvel reprovado: {p.name}</p>
                          {p.rejection_reason ? (
                            <p className="text-sm text-[#B3B3B3] mt-1 leading-relaxed whitespace-pre-line">
                              {p.rejection_reason}
                            </p>
                          ) : (
                            <p className="text-xs text-[#888] mt-1">Nenhum motivo informado. Entre em contato para saber mais.</p>
                          )}
                          <Link
                            to={APP_ROUTES.EDIT_PROPERTY(p.id)}
                            className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-[#F5A623] hover:text-[#F5A623]/80 transition-colors"
                          >
                            <Pencil size={11} /> Editar e reenviar para aprovação
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}

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
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <StatCard label="Imóveis ativos" value={activeProperties.length} icon={<Home size={18} />} />
                    <StatCard label="Reservas ativas" value={activeBookings.length} icon={<Calendar size={18} />} />
                    <StatCard label="Receita do mês" value={formatCurrency(monthlyRevenue)} icon={<DollarSign size={18} />} accent />
                    <StatCard label="Avaliação média" value={avgRating} icon={<Star size={18} />} />
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <StatCard label="Receita líquida total" value={formatCurrency(totalRevenue)} icon={<DollarSign size={18} />} accent />
                    <StatCard label="Estadia média" value={avgNights > 0 ? `${avgNights} noites` : '—'} icon={<Calendar size={18} />} />
                    <StatCard label="Taxa cancelamento" value={`${cancelRate}%`} icon={<TrendingUp size={18} />} />
                    <StatCard label="Total reservas" value={bookings.length} icon={<Calendar size={18} />} />
                  </div>

                  {/* Nota sobre repasses */}
                  <div className="flex items-start gap-2.5 p-3.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl mb-8">
                    <Info size={14} className="text-[#888] flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-[#888] leading-relaxed">
                      <span className="text-[#B3B3B3] font-semibold">Sobre os valores: </span>
                      todos os valores exibidos são líquidos (após as taxas da plataforma). O repasse é liberado <strong className="text-[#B3B3B3]">1 dia após o checkout</strong> do hóspede, ou conforme a política de cancelamento aplicável em caso de cancelamento antecipado.
                    </p>
                  </div>

                  {/* Ocupação mensal */}
                  {bookings.length > 0 && (
                    <Card className="p-5 mb-10">
                      <h3 className="text-sm font-semibold text-white mb-4">Ocupação — últimos 3 meses</h3>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={occupationChart} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                          <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ background: '#1A1A1A', border: '1px solid #333', borderRadius: 8 }}
                            labelStyle={{ color: '#B3B3B3', fontSize: 11 }}
                            itemStyle={{ color: '#E50914', fontSize: 11 }}
                            formatter={(v) => [v ?? 0, 'Reservas']}
                          />
                          <Bar dataKey="reservas" fill="#E50914" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>
                  )}

                  {/* Reservas recentes */}
                  <section className="mb-10">
                    <h2 className="font-display text-lg font-bold text-white mb-4">Reservas Recentes</h2>
                    {bookings.length === 0 ? (
                      <div className="text-center py-10 text-[#888]">
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

                  {/* Pending extension requests */}
                  {extensionRequests.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <CalendarPlus size={16} className="text-[#F5A623]" />
                        <h3 className="text-sm font-bold text-white">Pedidos de prorrogação pendentes</h3>
                        <span className="bg-[#F5A623] text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {extensionRequests.length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {extensionRequests.map(req => (
                          <Card key={req.id} className="p-4 border-[#F5A623]/30 bg-[#F5A623]/5">
                            <div className="flex items-start gap-3 flex-wrap">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-[#F5A623] flex items-center justify-center text-sm font-bold text-black overflow-hidden flex-shrink-0">
                                  {(req.guest as { avatar_url?: string | null; name?: string | null } | undefined)?.avatar_url
                                    ? <img src={(req.guest as { avatar_url: string }).avatar_url} alt="" className="w-full h-full object-cover" />
                                    : ((req.guest as { name?: string | null } | undefined)?.name?.[0] ?? 'H')
                                  }
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-white">
                                    {(req.guest as { name?: string | null } | undefined)?.name ?? 'Hóspede'}
                                  </p>
                                  <p className="text-xs text-[#B3B3B3]">
                                    {(req.booking as { property?: { name?: string | null } | null } | undefined)?.property?.name ?? 'Imóvel'}
                                  </p>
                                  <p className="text-xs text-[#999] mt-0.5">
                                    Checkout atual: <strong className="text-white">{formatShortDate(req.current_checkout)}</strong>
                                    {' → '}
                                    Novo: <strong className="text-[#F5A623]">{formatShortDate(req.new_checkout)}</strong>
                                    {' · '}+{req.extra_nights} noite{req.extra_nights !== 1 ? 's' : ''}
                                    {' · '}{formatCurrency(req.extra_cost)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <button
                                  onClick={() => handleExtensionAction(req, 'ACCEPTED')}
                                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#46D369]/10 border border-[#46D369]/30 text-[#46D369] hover:bg-[#46D369]/20 transition-colors"
                                >
                                  <Check size={11} /> Aceitar
                                </button>
                                <button
                                  onClick={() => handleExtensionAction(req, 'REJECTED')}
                                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#E50914]/10 border border-[#E50914]/30 text-[#E50914] hover:bg-[#E50914]/20 transition-colors"
                                >
                                  <X size={11} /> Recusar
                                </button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                  {bookings.length === 0 ? (
                    <div className="text-center py-16 text-[#888]">
                      <Calendar size={48} className="mx-auto mb-4" />
                      <p>Nenhuma reserva ainda.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {bookings.map(b => {
                        const repasseDate = (() => {
                          const d = new Date(b.check_out)
                          d.setDate(d.getDate() + 1)
                          return d.toLocaleDateString('pt-BR')
                        })()
                        return (
                        <Card key={b.id} className="p-4">
                          {/* Header */}
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
                                <p className="text-xs text-[#999]">{formatShortDate(b.check_in)} → {formatShortDate(b.check_out)}</p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <StatusBadge status={b.status} />
                              {b.owner_confirmed
                                ? <p className="text-xs text-[#46D369] mt-0.5">Aceita por você</p>
                                : !['CANCELADA','CONCLUIDA'].includes(b.status) && (
                                    <p className="text-xs text-[#F5A623] mt-0.5">Aguardando seu aceite</p>
                                  )
                              }
                            </div>
                          </div>

                          {/* Detalhamento financeiro */}
                          <div className="mt-3 pt-3 border-t border-[#2A2A2A]">
                            <div className="grid grid-cols-3 gap-3 text-xs mb-2">
                              <div>
                                <p className="text-[#888] mb-0.5">Valor da reserva</p>
                                <p className="text-[#B3B3B3] font-medium">{formatCurrency(b.subtotal)}</p>
                              </div>
                              <div>
                                <p className="text-[#888] mb-0.5">Taxa plataforma</p>
                                <p className="text-[#E50914] font-medium">− {formatCurrency(b.platform_fee)}</p>
                              </div>
                              <div>
                                <p className="text-[#888] mb-0.5">Seu repasse</p>
                                <p className="text-[#F5A623] font-bold">{formatCurrency(b.subtotal - b.platform_fee)}</p>
                              </div>
                            </div>
                            {!['CANCELADA'].includes(b.status) && (
                              <p className="text-xs text-[#444]">
                                ⏱ Repasse disponível após checkout em {repasseDate}
                              </p>
                            )}
                          </div>

                          {/* Ações */}
                          {!b.owner_confirmed && !['CANCELADA','CONCLUIDA'].includes(b.status) && (
                            <div className="flex gap-2 mt-3 pt-3 border-t border-[#2A2A2A]">
                              <button
                                onClick={() => setContractBooking(b)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-[#46D369]/10 border border-[#46D369]/30 text-[#46D369] hover:bg-[#46D369]/20 transition-colors"
                              >
                                <Check size={12} /> Aceitar reserva
                              </button>
                              <button
                                onClick={() => setCancelBookingId(b.id)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-[#E50914]/10 border border-[#E50914]/30 text-[#E50914] hover:bg-[#E50914]/20 transition-colors"
                              >
                                <X size={12} /> Recusar
                              </button>
                            </div>
                          )}
                        </Card>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── FINANCEIRO ─────────────────────────────────── */}
              {tab === 'financeiro' && (
                <div className="space-y-6">
                  <h2 className="font-display text-xl font-bold text-white">Painel de Receita</h2>

                  {/* KPIs */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Receita líquida total" value={formatCurrency(totalRevenue)} icon={<DollarSign size={18} />} accent />
                    <StatCard label="Receita do mês" value={formatCurrency(monthlyRevenue)} icon={<TrendingUp size={18} />} accent />
                    <StatCard label="Taxa de ocupação" value={`${occupancyRate}%`} icon={<Calendar size={18} />} />
                    <StatCard label="Ticket médio" value={formatCurrency(avgTicket)} icon={<Star size={18} />} />
                  </div>

                  {/* Revenue line chart — 12 months */}
                  <Card className="p-5">
                    <h3 className="text-sm font-semibold text-white mb-4">Receita líquida — últimos 12 meses</h3>
                    {revenueChart.every(r => r.liquido === 0) ? (
                      <p className="text-sm text-[#999]">Ainda sem reservas concluídas para exibir.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={revenueChart} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                          <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                          <Tooltip
                            contentStyle={{ background: '#1A1A1A', border: '1px solid #333', borderRadius: 8 }}
                            labelStyle={{ color: '#B3B3B3', fontSize: 11 }}
                            formatter={(v) => [formatCurrency(Number(v ?? 0)), 'Receita líquida']}
                          />
                          <Line type="monotone" dataKey="liquido" stroke="#46D369" strokeWidth={2} dot={{ r: 3, fill: '#46D369' }} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </Card>

                  {/* Reservas per month bar chart */}
                  <Card className="p-5">
                    <h3 className="text-sm font-semibold text-white mb-4">Reservas concluídas — últimos 12 meses</h3>
                    {revenueChart.every(r => r.reservas === 0) ? (
                      <p className="text-sm text-[#999]">Ainda sem reservas concluídas.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={revenueChart} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                          <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ background: '#1A1A1A', border: '1px solid #333', borderRadius: 8 }}
                            labelStyle={{ color: '#B3B3B3', fontSize: 11 }}
                            formatter={(v) => [Number(v ?? 0), 'Reservas']}
                          />
                          <Bar dataKey="reservas" fill="#E50914" radius={[4, 4, 0, 0]} maxBarSize={36} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </Card>

                  {/* Revenue by property */}
                  {revenueByProperty.length > 1 && (
                    <Card className="p-5">
                      <h3 className="text-sm font-semibold text-white mb-4">Receita por imóvel</h3>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={revenueByProperty} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
                          <XAxis type="number" tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                          <YAxis type="category" dataKey="name" tick={{ fill: '#B3B3B3', fontSize: 10 }} axisLine={false} tickLine={false} width={120} />
                          <Tooltip
                            contentStyle={{ background: '#1A1A1A', border: '1px solid #333', borderRadius: 8 }}
                            formatter={(v) => [formatCurrency(Number(v ?? 0)), 'Receita líquida']}
                          />
                          <Bar dataKey="liquido" fill="#F5A623" radius={[0, 4, 4, 0]} maxBarSize={28} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>
                  )}

                  {/* Payment history table */}
                  <Card className="p-5">
                    <h3 className="text-sm font-semibold text-white mb-3">Histórico de pagamentos</h3>
                    {bookings.length === 0 ? (
                      <p className="text-sm text-[#999]">Nenhum pagamento registrado.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[480px]">
                          <thead>
                            <tr className="text-[#999] text-xs border-b border-[#333]">
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

                  {/* ── Dados para Repasse ── */}
                  <Card className="p-5 mt-6">
                    <h3 className="text-sm font-semibold text-white mb-1">Dados para Repasse</h3>
                    <p className="text-xs text-[#888] mb-4">Informe seus dados bancários para receber os repasses das reservas.</p>
                    <div className="space-y-4">
                      <Input
                        label="Chave Pix"
                        value={bankForm.pix_key}
                        onChange={e => setBankForm(f => ({ ...f, pix_key: e.target.value }))}
                        placeholder="CPF, e-mail, telefone ou chave aleatória"
                      />
                      <Input
                        label="Nome do banco"
                        value={bankForm.bank_name}
                        onChange={e => setBankForm(f => ({ ...f, bank_name: e.target.value }))}
                        placeholder="Ex: Nubank, Itaú, Bradesco"
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="Agência"
                          value={bankForm.bank_agency}
                          onChange={e => setBankForm(f => ({ ...f, bank_agency: e.target.value }))}
                          placeholder="0000"
                        />
                        <Input
                          label="Conta"
                          value={bankForm.bank_account}
                          onChange={e => setBankForm(f => ({ ...f, bank_account: e.target.value }))}
                          placeholder="00000-0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#B3B3B3] mb-1.5 font-medium">Tipo de conta</label>
                        <select
                          value={bankForm.bank_account_type}
                          onChange={e => setBankForm(f => ({ ...f, bank_account_type: e.target.value }))}
                          className="w-full bg-[#2A2A2A] border border-[#333] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-[#E50914]"
                        >
                          <option value="corrente">Corrente</option>
                          <option value="poupança">Poupança</option>
                        </select>
                      </div>
                      <Button onClick={() => void saveBankData()} loading={savingBank}>
                        Salvar dados bancários
                      </Button>
                    </div>
                  </Card>
                </div>
              )}

              {/* ── CALENDÁRIO ─────────────────────────────────── */}
              {tab === 'calendario' && (
                <CalendarioTab properties={properties} />
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
                    <div className="text-center py-16 text-[#888]">
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

              {/* ── SINISTROS ──────────────────────────────────── */}
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
                            <p className="text-xs text-[#999] mt-0.5">Marque se o imóvel não está em seu nome</p>
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
                        <p className="text-xs text-[#888] text-center">
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

      {/* ── Modal cancelamento pelo anfitrião ── */}
      {/* ── Modal contrato de aceite ── */}
      {contractBooking && (
        <OwnerContractModal
          booking={contractBooking}
          accepting={acceptingContract}
          onAccept={() => void confirmAccept()}
          onClose={() => setContractBooking(null)}
        />
      )}

      {cancelBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1F1F1F] border border-[#333] rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base font-bold text-white">Cancelar reserva</h3>
              <button onClick={() => setCancelBookingId(null)} className="text-[#999] hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-[#B3B3B3] mb-3">Ao cancelar, o hóspede será notificado e poderá escolher:</p>
            <ul className="space-y-2 mb-5">
              <li className="flex items-start gap-2 text-sm text-[#B3B3B3]">
                <span className="text-[#46D369] font-bold mt-0.5">•</span>
                Reembolso total do valor pago
              </li>
              <li className="flex items-start gap-2 text-sm text-[#B3B3B3]">
                <span className="text-[#46D369] font-bold mt-0.5">•</span>
                Escolher outro imóvel
              </li>
              <li className="flex items-start gap-2 text-sm text-[#B3B3B3]">
                <span className="text-[#46D369] font-bold mt-0.5">•</span>
                Manter como crédito na plataforma
              </li>
            </ul>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setCancelBookingId(null)} fullWidth>
                Voltar
              </Button>
              <Button
                onClick={() => void cancelBookingByOwner()}
                loading={cancellingBooking}
                fullWidth
                className="!bg-[#E50914] hover:!bg-[#F40612]"
              >
                Confirmar cancelamento
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function OwnerContractModal({
  booking, accepting, onAccept, onClose,
}: {
  booking: Booking
  accepting: boolean
  onAccept: () => void
  onClose: () => void
}) {
  const repasseDate = (() => {
    const d = new Date(booking.check_out)
    d.setDate(d.getDate() + 1)
    return d.toLocaleDateString('pt-BR')
  })()
  const netValue = booking.subtotal - booking.platform_fee

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#1F1F1F] border border-[#333] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2A2A2A]">
          <div>
            <h3 className="font-display text-base font-bold text-white">Aceite de Reserva</h3>
            <p className="text-xs text-[#888] mt-0.5">{booking.booking_number}</p>
          </div>
          <button onClick={onClose} className="text-[#999] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Resumo da reserva */}
          <div className="bg-[#2A2A2A] rounded-xl p-4 space-y-2.5 text-sm">
            <p className="text-xs font-bold text-[#888] uppercase tracking-widest mb-3">Resumo da reserva</p>
            {[
              { label: 'Hóspede',   value: booking.guest?.name ?? '—' },
              { label: 'Imóvel',    value: booking.property?.name ?? '—' },
              { label: 'Check-in',  value: formatShortDate(booking.check_in) },
              { label: 'Check-out', value: formatShortDate(booking.check_out) },
            ].map(row => (
              <div key={row.label} className="flex justify-between">
                <span className="text-[#999]">{row.label}</span>
                <span className="text-white font-medium text-right max-w-[60%] truncate">{row.value}</span>
              </div>
            ))}
          </div>

          {/* Detalhamento financeiro */}
          <div className="bg-[#2A2A2A] rounded-xl p-4 space-y-2.5 text-sm">
            <p className="text-xs font-bold text-[#888] uppercase tracking-widest mb-3">Detalhamento financeiro</p>
            <div className="flex justify-between">
              <span className="text-[#999]">Valor da reserva (hospedagem)</span>
              <span className="text-white">{formatCurrency(booking.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#999]">Taxa da plataforma</span>
              <span className="text-[#E50914]">− {formatCurrency(booking.platform_fee)}</span>
            </div>
            <div className="flex justify-between border-t border-[#333] pt-2.5">
              <span className="text-[#F5A623] font-bold">Seu repasse líquido</span>
              <span className="text-[#F5A623] font-bold text-base">{formatCurrency(netValue)}</span>
            </div>
            <div className="flex items-start gap-2 mt-2 pt-2 border-t border-[#333]">
              <Info size={13} className="text-[#888] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#888] leading-relaxed">
                O repasse é liberado <strong className="text-[#B3B3B3]">1 dia após o checkout</strong> ({repasseDate}).
                Em caso de cancelamento, o valor segue a política de cancelamento do imóvel.
              </p>
            </div>
          </div>

          {/* Termos */}
          <div className="bg-[#2A2A2A] rounded-xl p-4">
            <p className="text-xs font-bold text-[#888] uppercase tracking-widest mb-3">Ao aceitar você se compromete a</p>
            <div className="space-y-2">
              {[
                'Manter o imóvel disponível nas datas reservadas',
                'Receber o hóspede nas condições anunciadas',
                'Respeitar a política de cancelamento do imóvel',
                'Comunicar qualquer imprevisto com no mínimo 48h de antecedência',
              ].map((term, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm text-[#B3B3B3]">
                  <Check size={13} className="text-[#46D369] flex-shrink-0 mt-0.5" />
                  {term}
                </div>
              ))}
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-3 pt-1">
            <Button variant="ghost" onClick={onClose} fullWidth>Cancelar</Button>
            <Button onClick={onAccept} loading={accepting} fullWidth>
              Aceitar e confirmar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

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
        {property.photos?.[0]
          ? <img src={property.photos[0]} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
          : <div className="w-16 h-16 rounded-xl flex-shrink-0 bg-[#2A2A2A] flex items-center justify-center"><Home size={22} className="text-[#888]" /></div>
        }
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm line-clamp-1">{property.name}</p>
          <p className="text-xs text-[#B3B3B3]">{property.city}, {property.state}</p>
          <div className="flex items-center gap-2 mt-1">
            <PropertyStatusBadge status={property.status} />
            <span className="text-xs text-[#999]">{formatCurrency(property.price_per_night)}/noite</span>
          </div>
          {property.status === 'REPROVADO' && property.rejection_reason && (
            <p className="text-xs text-[#E50914]/80 mt-1 line-clamp-2">{property.rejection_reason}</p>
          )}
          <Link to={APP_ROUTES.EDIT_PROPERTY(property.id)} className="inline-block mt-1 text-xs text-[#F5A623] hover:underline">
            {property.status === 'REPROVADO' ? 'Corrigir e reenviar →' : 'Configurar disponibilidade →'}
          </Link>
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
          <Link to={APP_ROUTES.EDIT_PROPERTY(property.id)}>
            <button className="w-8 h-8 rounded-lg bg-[#2A2A2A] flex items-center justify-center text-[#B3B3B3] hover:text-white transition-colors">
              <Pencil size={14} />
            </button>
          </Link>
          <button
            onClick={() => onToggle(property)}
            className="w-8 h-8 rounded-lg bg-[#2A2A2A] flex items-center justify-center transition-colors"
            title={property.status === 'ATIVO' ? 'Desativar' : 'Ativar'}
          >
            {property.status === 'ATIVO'
              ? <ToggleRight size={16} className="text-[#46D369]" />
              : <ToggleLeft size={16} className="text-[#999]" />
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
              <label className="text-xs text-[#999] block mb-1">Tipo</label>
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
              <label className="text-xs text-[#999] block mb-1">Nome</label>
              <input
                value={form.name}
                onChange={e => updForm({ name: e.target.value })}
                className="w-full bg-[#2A2A2A] border border-[#333] rounded-lg px-3 py-2 text-xs text-white placeholder-[#555] outline-none focus:border-[#555]"
              />
            </div>
          </div>
          <div className={`grid gap-2 ${needsDates ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
            <div>
              <label className="text-xs text-[#999] block mb-1">Preço/noite (R$)</label>
              <input
                type="number" min="1" step="0.01"
                value={form.price_per_night}
                onChange={e => updForm({ price_per_night: e.target.value })}
                placeholder="0,00"
                className="w-full bg-[#2A2A2A] border border-[#333] rounded-lg px-3 py-2 text-xs text-white placeholder-[#555] outline-none focus:border-[#555]"
              />
            </div>
            <div>
              <label className="text-xs text-[#999] block mb-1">Prioridade</label>
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
                  <label className="text-xs text-[#999] block mb-1">Início</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={e => updForm({ start_date: e.target.value })}
                    className="w-full bg-[#2A2A2A] border border-[#333] rounded-lg px-2 py-2 text-xs text-white outline-none focus:border-[#555]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#999] block mb-1">Fim</label>
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
        <p className="text-xs text-[#888] text-center py-3">
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
                  <span className="text-xs text-[#888] shrink-0">prio {p.priority}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-[#999]">{PERIOD_TYPE_LABELS[p.period_type]}</span>
                  {p.start_date && p.end_date && (
                    <span className="text-xs text-[#888]">· {p.start_date} → {p.end_date}</span>
                  )}
                </div>
              </div>
              <span className="text-sm font-bold text-[#F5A623] shrink-0">{formatCurrency(p.price_per_night)}</span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleToggle(p)}
                  className="w-7 h-7 rounded-lg bg-[#2A2A2A] flex items-center justify-center text-[#999] hover:text-white transition-colors"
                  title={p.active ? 'Desativar' : 'Ativar'}
                >
                  {p.active ? <ToggleRight size={13} className="text-[#46D369]" /> : <ToggleLeft size={13} />}
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="w-7 h-7 rounded-lg bg-[#2A2A2A] flex items-center justify-center text-[#999] hover:text-[#E50914] transition-colors"
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

// ── CalendarioTab ────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  LOCAFLIX: '#22C55E',
  AIRBNB:   '#3B82F6',
  BOOKING:  '#F97316',
  MANUAL:   '#EF4444',
}
const SOURCE_LABELS: Record<string, string> = {
  LOCAFLIX: 'Locaflix',
  AIRBNB:   'Airbnb',
  BOOKING:  'Booking',
  MANUAL:   'Bloqueio Manual',
}
const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

interface CalEventInfo {
  source: string
  startDate: string
  endDate: string
  label: string
  blockId?: string
}

function CalendarioTab({ properties }: { properties: Property[] }) {
  const { toast } = useToast()
  const [selectedPropId, setSelectedPropId] = useState(properties[0]?.id ?? '')
  const [propData, setPropData] = useState<Property | null>(null)
  const [calBlocks, setCalBlocks] = useState<CalendarBlock[]>([])
  const [locaflixBookings, setLocaflixBookings] = useState<{ id: string; check_in: string; check_out: string; booking_number: string | null }[]>([])
  const [monthOffset, setMonthOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<Record<string, boolean>>({})
  const [blockForm, setBlockForm] = useState({ start: '', end: '', notes: '' })
  const [addingBlock, setAddingBlock] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  useEffect(() => {
    if (!selectedPropId) return
    void loadCalendarData(selectedPropId)
  }, [selectedPropId])

  async function loadCalendarData(propId: string) {
    const [propRes, bkRes, blkRes] = await Promise.all([
      supabase.from('properties').select('*').eq('id', propId).single(),
      supabase.from('bookings').select('id,check_in,check_out,booking_number')
        .eq('property_id', propId).in('status', ['PARCIAL', 'PAGO']),
      supabase.from('calendar_blocks').select('*').eq('property_id', propId).order('start_date'),
    ])
    if (propRes.data) setPropData(propRes.data as Property)
    setLocaflixBookings((bkRes.data ?? []) as { id: string; check_in: string; check_out: string; booking_number: string | null }[])
    setCalBlocks((blkRes.data ?? []) as CalendarBlock[])
  }

  // Build map: date → event info
  const eventMap = useMemo(() => {
    const map = new Map<string, CalEventInfo>()
    for (const b of locaflixBookings) {
      const d = new Date(b.check_in + 'T00:00:00')
      const end = new Date(b.check_out + 'T00:00:00')
      while (d <= end) {
        const key = d.toISOString().slice(0, 10)
        if (!map.has(key)) {
          map.set(key, {
            source: 'LOCAFLIX',
            startDate: b.check_in,
            endDate: b.check_out,
            label: b.booking_number ? `Reserva #${b.booking_number}` : 'Reserva Locaflix',
          })
        }
        d.setDate(d.getDate() + 1)
      }
    }
    for (const blk of calBlocks) {
      const d = new Date(blk.start_date + 'T00:00:00')
      const end = new Date(blk.end_date + 'T00:00:00')
      while (d <= end) {
        const key = d.toISOString().slice(0, 10)
        if (!map.has(key)) {
          map.set(key, {
            source: blk.source,
            startDate: blk.start_date,
            endDate: blk.end_date,
            label: blk.notes ?? SOURCE_LABELS[blk.source] ?? blk.source,
            blockId: blk.id,
          })
        }
        d.setDate(d.getDate() + 1)
      }
    }
    return map
  }, [locaflixBookings, calBlocks])

  const selectedEvent = selectedDay ? (eventMap.get(selectedDay) ?? null) : null

  async function handleSync(provider: 'AIRBNB' | 'BOOKING') {
    setSyncing(s => ({ ...s, [provider]: true }))
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token ?? ''
      const res = await fetch(`/api/calendar/sync/${selectedPropId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider }),
      })
      const data = await res.json() as { success?: boolean; results?: { provider: string; imported: number }[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Erro desconhecido')
      const r = data.results?.[0]
      toast('success', 'Sincronizado!', `${r?.imported ?? 0} eventos importados do ${provider === 'AIRBNB' ? 'Airbnb' : 'Booking'}.`)
      await loadCalendarData(selectedPropId)
    } catch (err) {
      toast('error', 'Erro na sincronização', err instanceof Error ? err.message : 'Tente novamente')
    } finally {
      setSyncing(s => ({ ...s, [provider]: false }))
    }
  }

  async function handleAddBlock() {
    if (!blockForm.start || !blockForm.end) { toast('warning', 'Preencha as datas', ''); return }
    if (blockForm.start > blockForm.end) { toast('warning', 'Data inválida', 'O início deve ser anterior ao fim.'); return }
    setAddingBlock(true)
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token ?? ''
      const res = await fetch('/api/calendar/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ property_id: selectedPropId, start_date: blockForm.start, end_date: blockForm.end, notes: blockForm.notes || undefined }),
      })
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error) }
      toast('success', 'Período bloqueado')
      setBlockForm({ start: '', end: '', notes: '' })
      await loadCalendarData(selectedPropId)
    } catch (err) {
      toast('error', 'Erro', err instanceof Error ? err.message : 'Tente novamente')
    } finally {
      setAddingBlock(false)
    }
  }

  async function handleRemoveBlock(blockId: string) {
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token ?? ''
      const res = await fetch(`/api/calendar/blocks/${blockId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error) }
      toast('success', 'Bloqueio removido')
      setSelectedDay(null)
      await loadCalendarData(selectedPropId)
    } catch (err) {
      toast('error', 'Erro', err instanceof Error ? err.message : 'Tente novamente')
    }
  }

  function fmtDate(d: string) {
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }

  function renderMonth(baseDate: Date) {
    const year = baseDate.getFullYear()
    const month = baseDate.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date(); today.setHours(0, 0, 0, 0)

    return (
      <div key={`${year}-${month}`}>
        <p className="text-xs font-semibold text-white text-center mb-3">
          {MONTHS_PT[month]} {year}
        </p>
        <div className="grid grid-cols-7 gap-px text-center mb-1">
          {DAYS_SHORT.map(d => (
            <div key={d} className="text-xs text-[#888] font-medium py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const event = eventMap.get(dateStr)
            const isPast = new Date(dateStr + 'T00:00:00') < today
            const isSelected = selectedDay === dateStr
            const color = event ? SOURCE_COLORS[event.source] : null

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                className={`relative h-8 w-full rounded text-xs font-medium transition-all ${
                  isPast ? 'text-[#333] cursor-default' :
                  isSelected ? 'ring-2 ring-white text-white' :
                  event ? 'text-white hover:opacity-80' : 'text-[#999] hover:text-white hover:bg-[#2A2A2A]'
                }`}
                style={color ? { backgroundColor: color + '33', color } : {}}
              >
                {isSelected && color && (
                  <span className="absolute inset-0 rounded ring-2" style={{ borderColor: color }} />
                )}
                {day}
                {event && !isPast && (
                  <span
                    className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ backgroundColor: color! }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const today = new Date()
  const months = [0, 1].map(i => new Date(today.getFullYear(), today.getMonth() + monthOffset + i, 1))
  const icalUrl = selectedPropId ? `${window.location.origin}/calendar/${selectedPropId}.ics` : ''

  async function copyIcalUrl() {
    await navigator.clipboard.writeText(icalUrl)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 3000)
  }

  const manualBlocks = calBlocks.filter(b => b.source === 'MANUAL')

  if (properties.length === 0) {
    return (
      <div className="text-center py-20 text-[#888]">
        <CalendarRange size={48} className="mx-auto mb-4" />
        <p>Você ainda não tem imóveis para sincronizar.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-white">Calendário Unificado</h2>
          <p className="text-sm text-[#B3B3B3] mt-0.5">Veja e gerencie todos os bloqueios de calendário</p>
        </div>
        {properties.length > 1 && (
          <select
            value={selectedPropId}
            onChange={e => { setSelectedPropId(e.target.value); setSelectedDay(null) }}
            className="bg-[#1F1F1F] border border-[#333] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-[#555]"
          >
            {properties.map(p => (
              <option key={p.id} value={p.id} className="bg-[#1F1F1F]">{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Status de sincronização */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(['AIRBNB', 'BOOKING'] as const).map(provider => {
          const urlField = provider === 'AIRBNB' ? 'ical_airbnb_url' : 'ical_booking_url'
          const lastSyncField = provider === 'AIRBNB' ? 'ical_last_sync_airbnb' : 'ical_last_sync_booking'
          const errorField = provider === 'AIRBNB' ? 'ical_sync_error_airbnb' : 'ical_sync_error_booking'
          const url = propData?.[urlField as keyof Property] as string | null | undefined
          const lastSync = propData?.[lastSyncField as keyof Property] as string | null | undefined
          const syncError = propData?.[errorField as keyof Property] as string | null | undefined
          const color = provider === 'AIRBNB' ? '#3B82F6' : '#F97316'
          const connected = !!url

          return (
            <div
              key={provider}
              className="bg-[#1F1F1F] border border-[#333] rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: connected ? color : '#555' }} />
                  <span className="text-sm font-semibold text-white">{provider === 'AIRBNB' ? 'Airbnb' : 'Booking'}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${connected ? 'bg-green-500/20 text-green-400' : 'bg-[#333] text-[#888]'}`}>
                    {connected ? 'Conectado' : 'Não configurado'}
                  </span>
                </div>
                {connected && (
                  <button
                    onClick={() => void handleSync(provider)}
                    disabled={!!syncing[provider]}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[#333] text-[#B3B3B3] hover:text-white hover:border-[#555] disabled:opacity-50 transition-all"
                  >
                    <RefreshCw size={12} className={syncing[provider] ? 'animate-spin' : ''} />
                    {syncing[provider] ? 'Sincronizando...' : 'Sincronizar'}
                  </button>
                )}
              </div>
              {connected && lastSync && (
                <p className="text-xs text-[#999]">
                  Última sync: {new Date(lastSync).toLocaleString('pt-BR')}
                </p>
              )}
              {syncError && (
                <p className="text-xs text-[#E50914] bg-[#E50914]/10 rounded-lg px-3 py-2">
                  Erro: {syncError}
                </p>
              )}
              {!connected && (
                <p className="text-xs text-[#888]">
                  Configure a URL iCal na edição do imóvel para ativar.
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* URL do calendário Locaflix (para exportar) */}
      <div className="bg-[#1F1F1F] border border-[#333] rounded-2xl p-4 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Link2 size={14} className="text-[#22C55E]" />
          <p className="text-sm font-semibold text-white">URL do seu calendário Locaflix</p>
        </div>
        <p className="text-xs text-[#999]">Copie esta URL e importe no Airbnb e Booking para eles verem as reservas da Locaflix.</p>
        <div className="flex gap-2">
          <div className="flex-1 bg-[#0A0A0A] border border-[#222] rounded-xl px-3 py-2 text-xs text-[#B3B3B3] truncate font-mono">
            {icalUrl}
          </div>
          <button
            onClick={() => void copyIcalUrl()}
            className="flex-shrink-0 px-3 py-2 bg-[#2A2A2A] border border-[#333] rounded-xl text-[#B3B3B3] hover:text-white transition-colors"
          >
            {copiedUrl ? <Check size={14} className="text-[#22C55E]" /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-4 text-xs">
        {Object.entries(SOURCE_LABELS).map(([src, label]) => (
          <div key={src} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: SOURCE_COLORS[src] }} />
            <span className="text-[#B3B3B3]">{label}</span>
          </div>
        ))}
      </div>

      {/* Calendário */}
      <div className="bg-[#1F1F1F] border border-[#333] rounded-2xl p-5">
        {/* Navegação */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => { setMonthOffset(o => Math.max(0, o - 2)); setSelectedDay(null) }}
            disabled={monthOffset === 0}
            className="p-2 rounded-lg border border-[#333] text-[#999] hover:text-white hover:border-[#555] disabled:opacity-30 transition-all"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs text-[#999]">
            {monthOffset === 0 ? 'Meses atuais' : `+${monthOffset} meses`}
          </span>
          <button
            onClick={() => { setMonthOffset(o => o + 2); setSelectedDay(null) }}
            className="p-2 rounded-lg border border-[#333] text-[#999] hover:text-white hover:border-[#555] transition-all"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {months.map(renderMonth)}
        </div>

        {/* Detalhe do dia selecionado */}
        {selectedDay && (
          <div className="mt-5 pt-5 border-t border-[#333]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-[#999] mb-1">{fmtDate(selectedDay)}</p>
                {selectedEvent ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SOURCE_COLORS[selectedEvent.source] }} />
                      <p className="text-sm font-semibold text-white">{SOURCE_LABELS[selectedEvent.source]}</p>
                    </div>
                    <p className="text-xs text-[#B3B3B3] mt-1">{selectedEvent.label}</p>
                    <p className="text-xs text-[#999] mt-0.5">
                      {fmtDate(selectedEvent.startDate)} → {fmtDate(selectedEvent.endDate)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-[#46D369]">Disponível</p>
                )}
              </div>
              {selectedEvent?.blockId && selectedEvent.source === 'MANUAL' && (
                <button
                  onClick={() => void handleRemoveBlock(selectedEvent.blockId!)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[#E50914]/40 text-[#E50914] hover:bg-[#E50914]/10 transition-colors flex-shrink-0"
                >
                  <Unlock size={12} />
                  Desbloquear
                </button>
              )}
              <button onClick={() => setSelectedDay(null)} className="text-[#888] hover:text-white ml-auto flex-shrink-0">
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bloqueios manuais */}
      <div className="bg-[#1F1F1F] border border-[#333] rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Lock size={14} className="text-[#EF4444]" />
          <p className="text-sm font-semibold text-white">Bloquear período manualmente</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-[#999] block mb-1">Início</label>
            <input
              type="date"
              value={blockForm.start}
              onChange={e => setBlockForm(f => ({ ...f, start: e.target.value }))}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full bg-[#0A0A0A] border border-[#333] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-[#EF4444] transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-[#999] block mb-1">Fim</label>
            <input
              type="date"
              value={blockForm.end}
              onChange={e => setBlockForm(f => ({ ...f, end: e.target.value }))}
              min={blockForm.start || new Date().toISOString().slice(0, 10)}
              className="w-full bg-[#0A0A0A] border border-[#333] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-[#EF4444] transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-[#999] block mb-1">Motivo (opcional)</label>
            <input
              type="text"
              value={blockForm.notes}
              onChange={e => setBlockForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Ex: Reforma, uso próprio..."
              className="w-full bg-[#0A0A0A] border border-[#333] rounded-xl px-3 py-2 text-sm text-white placeholder-[#444] outline-none focus:border-[#555] transition-colors"
            />
          </div>
        </div>
        <button
          onClick={() => void handleAddBlock()}
          disabled={addingBlock || !blockForm.start || !blockForm.end}
          className="flex items-center gap-2 px-4 py-2 bg-[#EF4444] hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Lock size={14} />
          {addingBlock ? 'Bloqueando...' : 'Bloquear período'}
        </button>

        {/* Lista de bloqueios manuais */}
        {manualBlocks.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[#2A2A2A]">
            <p className="text-xs text-[#888] font-semibold uppercase tracking-wide">Bloqueios manuais ativos</p>
            {manualBlocks.map(blk => (
              <div key={blk.id} className="flex items-center justify-between gap-3 bg-[#0A0A0A] border border-[#222] rounded-xl px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{fmtDate(blk.start_date)} → {fmtDate(blk.end_date)}</p>
                  {blk.notes && <p className="text-xs text-[#999] truncate">{blk.notes}</p>}
                </div>
                <button
                  onClick={() => void handleRemoveBlock(blk.id)}
                  className="text-[#E50914] hover:text-red-400 flex-shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PropertyStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ATIVO: 'bg-[#46D369]/20 text-[#46D369]',
    PENDENTE: 'bg-[#F5A623]/20 text-[#F5A623]',
    INATIVO: 'bg-[#333] text-[#999]',
    REPROVADO: 'bg-[#E50914]/20 text-[#E50914]',
  }
  return <span className={`text-xs font-bold px-2 py-0.5 rounded ${map[status] ?? map.PENDENTE}`}>{status}</span>
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
