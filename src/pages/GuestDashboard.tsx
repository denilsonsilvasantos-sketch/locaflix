import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Calendar, Heart, Bell, ShieldCheck, User, MessageSquare,
  AlertTriangle, CheckCircle, XCircle, Star,
  BedDouble, MapPin, CreditCard, LogOut, Clock,
  RefreshCw, Layers,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Booking, Favorite, Installment, Notification, KYCStatus, Property } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { useToast } from '../hooks/useToast'
import { KYCDocumentField } from '../components/ui/KYCDocumentField'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { ReviewModal } from '../components/ui/ReviewModal'
import { formatCurrency, formatShortDate, daysUntil } from '../lib/utils'
import { calcularValorAtualizado } from '../lib/financeiro'
import { PixModal } from '../components/ui/PixModal'
import { APP_ROUTES } from '../constants'
import type { PixPaymentResponse } from '../types'

const TABS = [
  { key: 'reservas',     label: 'Reservas',      icon: <Calendar      size={16} />, href: '/minha-conta' },
  { key: 'favoritos',    label: 'Favoritos',      icon: <Heart         size={16} />, href: '/minha-conta?tab=favoritos' },
  { key: 'notificacoes', label: 'Notificações',   icon: <Bell          size={16} />, href: '/minha-conta?tab=notificacoes' },
  { key: 'documentos',   label: 'Documentos',     icon: <ShieldCheck   size={16} />, href: '/minha-conta?tab=documentos' },
  { key: 'perfil',       label: 'Perfil',         icon: <User          size={16} />, href: '/minha-conta?tab=perfil' },
  { key: 'mensagens',    label: 'Mensagens',      icon: <MessageSquare size={16} />, href: '/mensagens' },
]

export function GuestDashboard() {
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'reservas'
  const isWelcome = searchParams.get('welcome') === '1'
  const navigate = useNavigate()

  const { user, profile, refreshProfile, signOut } = useAuth()
  const { notifications, unreadCount, markAllRead } = useNotifications()
  const { toast } = useToast()

  const [bookings, setBookings] = useState<Booking[]>([])
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(new Set())
  const [reviewingBooking, setReviewingBooking] = useState<Booking | null>(null)

  // Perfil form
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', cpf: '', birth_date: '' })

  // KYC
  const [docUrl, setDocUrl] = useState('')
  const [submittingKyc, setSubmittingKyc] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name ?? '',
        phone: profile.phone ?? '',
        cpf: profile.cpf ?? '',
        birth_date: profile.birth_date ?? '',
      })
      setDocUrl(profile.document_url ?? '')
    }
  }, [profile?.id])

  const loadData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setLoadError(null)
    try {
      const [bkRes, favRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('*')
          .eq('guest_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('favorites')
          .select('*')
          .eq('user_id', user.id)
          .limit(50),
      ])

      if (bkRes.error) {
        console.error('[favorites] bookings query error:', bkRes.error)
        setLoadError('Não foi possível carregar suas reservas. Tente novamente.')
        // Don't return — continue loading favorites independently
      }

      if (favRes.error) {
        console.error('[favorites] favorites query error:', favRes.error)
      }

      console.log('[favorites] GuestDashboard rawFavs:', favRes.data)

      const rawBookings = (bkRes.data ?? []) as (Booking & { property_id: string })[]
      const rawFavs = ((favRes.data ?? []) as (Favorite & { property_id: string })[])

      // Fetch installments + own reviews for all bookings in parallel
      const instMap: Record<string, Installment[]> = {}
      const reviewedIds = new Set<string>()
      if (rawBookings.length > 0) {
        const bookingIds = rawBookings.map(b => b.id)
        const [instRes, revRes] = await Promise.all([
          supabase
            .from('installments')
            .select('*')
            .in('booking_id', bookingIds)
            .order('number', { ascending: true }),
          supabase
            .from('reviews')
            .select('booking_id')
            .eq('reviewer_id', user.id)
            .in('booking_id', bookingIds),
        ])
        for (const inst of instRes.data ?? []) {
          if (!instMap[inst.booking_id]) instMap[inst.booking_id] = []
          instMap[inst.booking_id].push(inst as Installment)
        }
        for (const r of revRes.data ?? []) reviewedIds.add(r.booking_id as string)
      }
      setReviewedBookingIds(reviewedIds)

      // Fetch properties — properties in non-ATIVO status may be missing here (RLS), that's OK
      const bookingPropIds = [...new Set(rawBookings.map(b => b.property_id).filter(Boolean))]
      const favPropIds = [...new Set(rawFavs.map(f => f.property_id).filter(Boolean))]
      const allIds = [...new Set([...bookingPropIds, ...favPropIds])]

      const propsMap: Record<string, Partial<Property>> = {}
      if (allIds.length > 0) {
        const { data: props } = await supabase
          .from('properties')
          .select('id,name,photos,city,state,price_per_night,rating')
          .in('id', allIds)
        for (const p of props ?? []) propsMap[p.id] = p
      }

      setBookings(rawBookings.map(b => ({
        ...b,
        property: (propsMap[b.property_id] ?? null) as Property,
        installments: instMap[b.id] ?? [],
      })) as Booking[])
      setFavorites(rawFavs.map(f => ({
        ...f,
        property: (propsMap[f.property_id] ?? null) as Property,
      })) as Favorite[])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar dados.'
      setLoadError(msg)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Load on mount and reload whenever the user arrives at the reservas tab
  useEffect(() => {
    loadData()
  }, [loadData, tab])

  async function saveProfile() {
    if (!user) return
    setSaving(true)
    const { error } = await supabase.from('users').update(form).eq('id', user.id)
    if (error) { toast('error', 'Erro ao salvar', error.message); setSaving(false); return }
    await refreshProfile()
    toast('success', 'Perfil atualizado!')
    setSaving(false)
  }

  async function submitKyc() {
    if (!user || !docUrl) { toast('error', 'Atenção', 'Envie o documento antes de continuar.'); return }
    setSubmittingKyc(true)
    const { error } = await supabase.from('users')
      .update({ kyc_status: 'PENDENTE', document_url: docUrl })
      .eq('id', user.id)
    if (error) { toast('error', 'Erro', error.message); setSubmittingKyc(false); return }
    await refreshProfile()
    toast('success', 'Documento enviado!', 'Nossa equipe irá analisar em breve.')
    setSubmittingKyc(false)
  }

  async function removeFavorite(propertyId: string) {
    const { error } = await supabase.from('favorites').delete().eq('user_id', user!.id).eq('property_id', propertyId)
    if (error) { toast('error', 'Erro', 'Não foi possível remover o favorito.'); return }
    setFavorites(prev => prev.filter(f => f.property_id !== propertyId))
  }

  const kycStatus = profile?.kyc_status ?? 'INCOMPLETO'
  const kycIncomplete = kycStatus === 'INCOMPLETO' || kycStatus === 'REPROVADO'

  return (
    <div className="min-h-screen bg-[#141414] pt-20">
      {/* Mobile tab bar — hidden on desktop */}
      <div className="lg:hidden border-b border-[#333] bg-[#141414]/95 backdrop-blur-sm sticky top-20 z-30">
        <div className="flex overflow-x-auto scrollbar-hide px-2">
          {TABS.map(t => {
            const active = t.key === tab
            return (
              <Link
                key={t.key}
                to={t.href}
                className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors relative flex-shrink-0 ${
                  active ? 'border-[#E50914] text-white' : 'border-transparent text-[#B3B3B3] hover:text-white'
                }`}
              >
                {t.icon}
                {t.label}
                {t.key === 'notificacoes' && unreadCount > 0 && (
                  <span className="w-4 h-4 bg-[#E50914] rounded-full text-[9px] font-bold flex items-center justify-center text-white ml-0.5">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Desktop sidebar — hidden on mobile */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-24 bg-[#1F1F1F] border border-[#333] rounded-xl overflow-hidden">
              <div className="px-4 py-4 border-b border-[#333]">
                <h2 className="font-display text-lg font-bold text-white">Minha Conta</h2>
              </div>
              <nav className="flex flex-col gap-1 p-4">
                {TABS.map(t => {
                  const active = t.key === tab
                  return (
                    <Link
                      key={t.key}
                      to={t.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        active
                          ? 'bg-[#E50914] text-white'
                          : 'text-[#B3B3B3] hover:text-white hover:bg-[#2A2A2A]'
                      }`}
                    >
                      <span className="w-4 h-4 flex-shrink-0">{t.icon}</span>
                      <span className="flex-1">{t.label}</span>
                      {t.key === 'notificacoes' && unreadCount > 0 && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-[#E50914] text-white'}`}>
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </nav>
            </div>
          </aside>

          <main className="flex-1 min-w-0">

      {/* Banner boas-vindas Google */}
      {isWelcome && tab === 'perfil' && (
        <div className="mb-6 flex items-center justify-between gap-4 p-4 bg-[#E50914]/10 border border-[#E50914]/40 rounded-xl">
          <div>
            <p className="text-sm font-semibold text-white">Bem-vindo à Locaflix! 🎉</p>
            <p className="text-xs text-[#B3B3B3] mt-0.5">Complete seu perfil para agilizar suas reservas.</p>
          </div>
          <button
            onClick={() => navigate(APP_ROUTES.HOME)}
            className="flex-shrink-0 text-xs text-[#B3B3B3] hover:text-white underline"
          >
            Explorar imóveis
          </button>
        </div>
      )}

      {/* Banner KYC obrigatório */}
      {kycIncomplete && tab !== 'documentos' && (
        <div className="mb-6 flex items-center justify-between gap-4 p-4 bg-[#F5A623]/10 border border-[#F5A623]/40 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-[#F5A623] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#F5A623]">
                {kycStatus === 'REPROVADO' ? 'Documento reprovado — envie novamente' : 'Verificação de identidade obrigatória'}
              </p>
              <p className="text-xs text-[#B3B3B3] mt-0.5">
                Envie um documento com foto (RG ou CNH) para fazer reservas na plataforma.
              </p>
            </div>
          </div>
          <Link to="/minha-conta?tab=documentos" className="flex-shrink-0">
            <Button size="sm">Enviar documento</Button>
          </Link>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-24">
          <div className="w-8 h-8 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── RESERVAS ─────────────────────────── */}
          {tab === 'reservas' && (
            <section>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-xl font-bold text-white">Minhas Reservas</h2>
                <button
                  onClick={loadData}
                  className="flex items-center gap-1.5 text-xs text-[#B3B3B3] hover:text-white transition-colors"
                >
                  <RefreshCw size={13} />
                  Atualizar
                </button>
              </div>

              {loadError ? (
                <div className="flex items-start gap-3 bg-[#E50914]/10 border border-[#E50914]/30 rounded-xl px-4 py-4 mb-4">
                  <AlertTriangle size={16} className="text-[#E50914] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-[#E50914] font-medium">{loadError}</p>
                    <button onClick={loadData} className="text-xs text-[#E50914] underline mt-1">
                      Tentar novamente
                    </button>
                  </div>
                </div>
              ) : bookings.length === 0 ? (
                <EmptyState icon={<Calendar size={40} />} text="Você ainda não tem reservas.">
                  <Link to={APP_ROUTES.HOME}><Button>Explorar imóveis</Button></Link>
                </EmptyState>
              ) : (
                <div className="space-y-3">
                  {bookings.map(b => (
                    <BookingCard
                      key={b.id}
                      booking={b}
                      hasReviewed={reviewedBookingIds.has(b.id)}
                      onReview={() => setReviewingBooking(b)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {reviewingBooking && (
            <ReviewModal
              open={!!reviewingBooking}
              booking={reviewingBooking}
              onClose={() => setReviewingBooking(null)}
              onSuccess={() => {
                setReviewedBookingIds(prev => new Set([...prev, reviewingBooking.id]))
                setReviewingBooking(null)
                toast('success', 'Avaliação enviada!', 'Ficará visível quando o anfitrião também avaliar.')
              }}
            />
          )}

          {/* ── FAVORITOS ────────────────────────── */}
          {tab === 'favoritos' && (
            <section>
              <h2 className="font-display text-xl font-bold text-white mb-5">Favoritos</h2>
              {favorites.length === 0 ? (
                <EmptyState icon={<Heart size={40} />} text="Nenhum imóvel favoritado ainda.">
                  <Link to={APP_ROUTES.HOME}><Button>Explorar imóveis</Button></Link>
                </EmptyState>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {favorites.map(f => (
                    <Card key={f.id} className="flex gap-4 p-4">
                      <img
                        src={f.property?.photos?.[0] ?? ''}
                        alt={f.property?.name ?? 'Imóvel'}
                        className="w-20 h-20 rounded-xl object-cover flex-shrink-0 bg-[#2A2A2A]"
                        onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400' }}
                      />
                      <div className="flex-1 min-w-0">
                        <Link
                          to={APP_ROUTES.PROPERTY(f.property_id)}
                          className="font-semibold text-white hover:text-[#E50914] transition-colors text-sm line-clamp-1"
                        >
                          {f.property?.name ?? 'Ver imóvel'}
                        </Link>
                        {f.property && (
                          <>
                            <p className="text-xs text-[#B3B3B3] flex items-center gap-1 mt-0.5">
                              <MapPin size={10} /> {f.property.city}, {f.property.state}
                            </p>
                            <p className="text-sm font-bold text-[#F5A623] mt-1">
                              {formatCurrency(f.property.price_per_night)}<span className="text-xs text-[#666] font-normal">/noite</span>
                            </p>
                          </>
                        )}
                        <button
                          onClick={() => removeFavorite(f.property_id)}
                          className="text-xs text-[#E50914] hover:underline mt-1"
                        >
                          Remover
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── NOTIFICAÇÕES ─────────────────────── */}
          {tab === 'notificacoes' && (
            <section>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-xl font-bold text-white">Notificações</h2>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAllRead}>Marcar todas como lidas</Button>
                )}
              </div>
              {notifications.length === 0 ? (
                <EmptyState icon={<Bell size={40} />} text="Nenhuma notificação ainda." />
              ) : (
                <div className="space-y-2">
                  {notifications.map(n => <NotificationItem key={n.id} n={n} />)}
                </div>
              )}
            </section>
          )}

          {/* ── DOCUMENTOS / KYC ─────────────────── */}
          {tab === 'documentos' && (
            <section className="max-w-lg">
              <h2 className="font-display text-xl font-bold text-white mb-2">Verificação de Identidade</h2>
              <p className="text-sm text-[#B3B3B3] mb-6">
                Para fazer reservas na Locaflix é obrigatório enviar um documento com foto válido (RG ou CNH).
              </p>

              <KYCBanner status={kycStatus} />

              {kycStatus !== 'APROVADO' && (
                <Card className="p-6 mt-4 space-y-5">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">Documento com foto <span className="text-[#E50914]">*</span></h3>
                    <p className="text-xs text-[#666] mb-3">RG ou CNH — foto clara de frente e verso. JPG, PNG ou PDF, máx. 10 MB.</p>
                    <KYCDocumentField
                      userId={user!.id}
                      fieldKey="document"
                      label=""
                      hint=""
                      currentUrl={docUrl || profile?.document_url}
                      disabled={kycStatus === 'PENDENTE'}
                      onSuccess={url => setDocUrl(url)}
                    />
                  </div>

                  {kycStatus !== 'PENDENTE' && (
                    <Button
                      onClick={submitKyc}
                      loading={submittingKyc}
                      fullWidth
                      disabled={!docUrl && !profile?.document_url}
                    >
                      Enviar para análise
                    </Button>
                  )}

                  {kycStatus === 'PENDENTE' && (
                    <p className="text-xs text-[#F5A623] text-center">
                      Aguardando revisão. Você será notificado quando aprovado.
                    </p>
                  )}
                </Card>
              )}
            </section>
          )}

          {/* ── PERFIL ───────────────────────────── */}
          {tab === 'perfil' && (
            <section className="max-w-lg">
              <h2 className="font-display text-xl font-bold text-white mb-5">Meu Perfil</h2>

              {/* Avatar / info rápida */}
              <Card className="p-5 mb-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#E50914] flex items-center justify-center text-xl font-bold text-white flex-shrink-0 overflow-hidden">
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    : (profile?.name?.[0]?.toUpperCase() ?? 'U')}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{profile?.name ?? 'Usuário'}</p>
                  <p className="text-xs text-[#B3B3B3] truncate">{user?.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <KYCStatusBadge status={kycStatus} />
                    <span className="text-xs text-[#555]">·</span>
                    <span className="text-xs text-[#555]">{profile?.role}</span>
                  </div>
                </div>
              </Card>

              {/* Formulário */}
              <Card className="p-5 space-y-4">
                <Input
                  label="Nome completo"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Seu nome"
                />
                <Input
                  label="Telefone / WhatsApp"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="CPF"
                    value={form.cpf}
                    onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))}
                    placeholder="000.000.000-00"
                  />
                  <Input
                    label="Data de nascimento"
                    type="date"
                    value={form.birth_date}
                    onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
                  />
                </div>
                <Button onClick={saveProfile} loading={saving} fullWidth>
                  Salvar alterações
                </Button>
              </Card>

              {/* Sair */}
              <button
                onClick={signOut}
                className="mt-6 w-full flex items-center justify-center gap-2 text-sm text-[#666] hover:text-[#E50914] transition-colors py-2"
              >
                <LogOut size={14} /> Sair da conta
              </button>
            </section>
          )}
        </>
      )}
          </main>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────

function EmptyState({ icon, text, children }: { icon: React.ReactNode; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="text-[#333]">{icon}</div>
      <p className="text-[#B3B3B3] text-sm">{text}</p>
      {children}
    </div>
  )
}

type StatusInfo = { label: string; icon: React.ReactNode; cls: string; barColor: string }

function deriveStatus(booking: Booking): StatusInfo {
  const insts = booking.installments ?? []
  const total = insts.length
  const paid = insts.filter(i => i.status === 'PAGO').length
  const hasOverdue = insts.some(i => i.status === 'ATRASADO')
  const now = new Date()
  const checkOut = new Date(booking.check_out + 'T23:59:59')

  if (booking.status === 'CANCELADA') {
    return { label: 'Cancelada', icon: <XCircle size={11} />, cls: 'bg-[#E50914]/20 text-[#E50914] border-[#E50914]/30', barColor: '#E50914' }
  }
  if (now > checkOut) {
    return { label: 'Reserva utilizada', icon: <CheckCircle size={11} />, cls: 'bg-[#2A2A2A] text-[#888] border-[#333]', barColor: '#555' }
  }
  if (total === 0 || paid === 0) {
    return { label: 'Aguardando pagamento', icon: <Clock size={11} />, cls: 'bg-[#F5A623]/20 text-[#F5A623] border-[#F5A623]/30', barColor: '#F5A623' }
  }
  if (paid === total) {
    return { label: 'Reserva quitada', icon: <CheckCircle size={11} />, cls: 'bg-[#46D369]/20 text-[#46D369] border-[#46D369]/30', barColor: '#46D369' }
  }
  if (hasOverdue) {
    return { label: 'Pagamento atrasado', icon: <AlertTriangle size={11} />, cls: 'bg-[#E50914]/20 text-[#E50914] border-[#E50914]/30', barColor: '#E50914' }
  }
  return { label: 'Reserva parcelada', icon: <Layers size={11} />, cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30', barColor: '#3B82F6' }
}

function BookingCard({
  booking,
  hasReviewed,
  onReview,
}: {
  booking: Booking
  hasReviewed: boolean
  onReview: () => void
}) {
  const [overdueQR, setOverdueQR] = useState<PixPaymentResponse | null>(null)
  const [fetchingQR, setFetchingQR] = useState(false)
  const [pixModalOpen, setPixModalOpen] = useState(false)

  const insts = booking.installments ?? []
  const total = insts.length
  const paid = insts.filter(i => i.status === 'PAGO').length
  const next = insts.find(i => i.status === 'PENDENTE' || i.status === 'ATRASADO')
  const daysLeft = next ? daysUntil(next.due_date) : null
  const isOverdue = next?.status === 'ATRASADO'

  const updatedValue = isOverdue && next
    ? calcularValorAtualizado(next.value, Math.abs(daysLeft ?? 0))
    : 0

  async function fetchOverdueQR() {
    if (!next?.asaas_payment_id) return
    setFetchingQR(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/payments/${next.asaas_payment_id}/pixQrCode`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      const qrData = await res.json()
      if (!res.ok) throw new Error(qrData.error ?? 'Erro ao gerar QR Code')
      setOverdueQR({
        payment_id: next.asaas_payment_id,
        status: 'OVERDUE',
        pix_key: qrData.payload,
        pix_qr_code: qrData.encodedImage,
        due_date: next.due_date,
        value: updatedValue,
      })
      setPixModalOpen(true)
    } catch {
      // user can retry via the button
    } finally {
      setFetchingQR(false)
    }
  }

  const s = deriveStatus(booking)

  return (
    <Card className="p-4">
      <div className="flex gap-4 items-start">
        <img
          src={booking.property?.photos?.[0] ?? ''}
          alt={booking.property?.name}
          className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-[#2A2A2A]"
          onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=200' }}
        />
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <p className="font-semibold text-white text-sm line-clamp-1">
                {booking.property?.name ?? 'Imóvel'}
              </p>
              <p className="text-xs text-[#B3B3B3] flex items-center gap-1 mt-0.5">
                <BedDouble size={10} />
                {formatShortDate(booking.check_in)} → {formatShortDate(booking.check_out)}
                <span className="ml-1 text-[#555]">· {booking.nights}n</span>
              </p>
            </div>
            {/* Status badge */}
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${s.cls}`}>
              {s.icon}
              {s.label}
            </span>
          </div>

          {/* Installment progress */}
          {total > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[#B3B3B3]">{paid}/{total} parcela{total !== 1 ? 's' : ''} paga{paid !== 1 ? 's' : ''}</span>
                <span className="font-bold text-[#F5A623]">{formatCurrency(booking.total_price)}</span>
              </div>
              <div className="h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${total > 0 ? (paid / total) * 100 : 0}%`,
                    backgroundColor: s.barColor,
                  }}
                />
              </div>
              {next && daysLeft !== null && (
                <p className={`text-xs mt-1.5 flex items-center gap-1 ${isOverdue ? 'text-[#E50914]' : daysLeft <= 3 ? 'text-[#F5A623]' : 'text-[#B3B3B3]'}`}>
                  <CreditCard size={10} className="flex-shrink-0" />
                  {isOverdue
                    ? `Parcela atrasada: ${formatCurrency(next.value)} (venceu há ${Math.abs(daysLeft)}d)`
                    : `Próxima: ${formatCurrency(next.value)} · vence em ${daysLeft}d`}
                </p>
              )}
            </div>
          )}

          {/* Booking number */}
          {booking.booking_number && (
            <p className="text-[10px] text-[#555] mt-2">#{booking.booking_number}</p>
          )}
        </div>
      </div>

      {/* Overdue installment panel */}
      {isOverdue && next?.asaas_payment_id && (
        <div className="mt-3 pt-3 border-t border-[#E50914]/30">
          <div className="bg-[#E50914]/10 border border-[#E50914]/30 rounded-xl p-3 space-y-2.5">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-[#E50914] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#E50914]">
                Esta parcela está vencida. O valor original de{' '}
                <strong>{formatCurrency(next.value)}</strong> foi atualizado para{' '}
                <strong>{formatCurrency(updatedValue)}</strong> devido aos dias de atraso.
              </p>
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#F5A623] bg-[#F5A623]/10 border border-[#F5A623]/30 rounded-full px-2 py-0.5">
                <AlertTriangle size={9} />
                Sinalizado para contato manual
              </span>
              <button
                onClick={fetchOverdueQR}
                disabled={fetchingQR}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#E50914] hover:bg-[#C50813] disabled:opacity-50 rounded-lg px-3 py-1.5 transition-colors"
              >
                {fetchingQR
                  ? <RefreshCw size={12} className="animate-spin" />
                  : <CreditCard size={12} />}
                Gerar QR Code atualizado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review action — only for "Reserva utilizada" */}
      {s.label === 'Reserva utilizada' && (
        <div className="mt-3 pt-3 border-t border-[#222] flex items-center justify-between">
          {hasReviewed ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-[#46D369]">
              <CheckCircle size={13} />
              Avaliação enviada
            </span>
          ) : (
            <button
              onClick={onReview}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F5A623] hover:text-[#F5A623]/80 transition-colors"
            >
              <Star size={13} className="fill-[#F5A623]" />
              Avaliar estadia
            </button>
          )}
          <span className="text-[10px] text-[#555]">
            {hasReviewed ? 'Obrigado pelo feedback' : 'Prazo: 14 dias após o checkout'}
          </span>
        </div>
      )}

      {/* Pix Modal for overdue payment */}
      <PixModal
        open={pixModalOpen}
        onClose={() => setPixModalOpen(false)}
        pix={overdueQR}
        onConfirm={() => setPixModalOpen(false)}
      />
    </Card>
  )
}

function NotificationItem({ n }: { n: Notification }) {
  return (
    <div className={`flex gap-3 p-4 rounded-xl border ${n.is_read ? 'bg-transparent border-[#222]' : 'bg-[#1F1F1F] border-[#333]'}`}>
      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.is_read ? 'bg-[#333]' : 'bg-[#E50914]'}`} />
      <div>
        <p className="text-sm font-semibold text-white">{n.title}</p>
        <p className="text-xs text-[#B3B3B3] mt-0.5">{n.message}</p>
      </div>
    </div>
  )
}

function KYCBanner({ status }: { status: KYCStatus }) {
  const cfg = {
    APROVADO:   { icon: <CheckCircle  size={16} />, bg: 'bg-[#46D369]/10 border-[#46D369]/30', text: 'text-[#46D369]',   title: 'Identidade verificada', msg: 'Você pode fazer reservas normalmente.' },
    PENDENTE:   { icon: <Clock        size={16} />, bg: 'bg-[#F5A623]/10 border-[#F5A623]/30', text: 'text-[#F5A623]',   title: 'Em análise', msg: 'Aguarde a revisão. Você será notificado.' },
    REPROVADO:  { icon: <XCircle      size={16} />, bg: 'bg-[#E50914]/10 border-[#E50914]/30', text: 'text-[#E50914]',   title: 'Documento reprovado', msg: 'Envie um novo documento para continuar.' },
    INCOMPLETO: { icon: <AlertTriangle size={16} />, bg: 'bg-[#2A2A2A] border-[#333]',          text: 'text-[#B3B3B3]',  title: 'Pendente', msg: 'Envie seu documento com foto para liberar reservas.' },
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

function KYCStatusBadge({ status }: { status: KYCStatus }) {
  const map = {
    APROVADO:   'text-[#46D369]',
    PENDENTE:   'text-[#F5A623]',
    REPROVADO:  'text-[#E50914]',
    INCOMPLETO: 'text-[#666]',
  }
  return <span className={`text-xs font-medium ${map[status] ?? 'text-[#666]'}`}>{status}</span>
}

