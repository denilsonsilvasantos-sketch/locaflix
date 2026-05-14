import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Calendar, Heart, Bell, ShieldCheck, User,
  AlertTriangle, CheckCircle, XCircle,
  BedDouble, MapPin, CreditCard, LogOut,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Booking, Favorite, Notification, KYCStatus, Property } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { useToast } from '../hooks/useToast'
import { DashboardLayout } from '../components/layout/DashboardLayout'
import { KYCDocumentField } from '../components/ui/KYCDocumentField'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { formatCurrency, formatShortDate, daysUntil } from '../lib/utils'
import { APP_ROUTES } from '../constants'

const TABS = [
  { key: 'reservas',     label: 'Reservas',      icon: <Calendar   size={16} />, href: '/minha-conta' },
  { key: 'favoritos',    label: 'Favoritos',      icon: <Heart      size={16} />, href: '/minha-conta?tab=favoritos' },
  { key: 'notificacoes', label: 'Notificações',   icon: <Bell       size={16} />, href: '/minha-conta?tab=notificacoes' },
  { key: 'documentos',   label: 'Documentos',     icon: <ShieldCheck size={16} />, href: '/minha-conta?tab=documentos' },
  { key: 'perfil',       label: 'Perfil',         icon: <User       size={16} />, href: '/minha-conta?tab=perfil' },
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

  useEffect(() => {
    if (user?.id) loadData()
  }, [user?.id])

  async function loadData() {
    setLoading(true)
    try {
      const [bkRes, favRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('*, installments(*)')
          .eq('guest_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('favorites')
          .select('*')
          .eq('user_id', user!.id)
          .limit(20),
      ])

      const rawBookings = (bkRes.data ?? []) as (Booking & { property_id: string })[]
      const rawFavs = (favRes.data ?? []) as (Favorite & { property_id: string })[]

      // Fetch properties separately to avoid FK/RLS join issues
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

      setBookings(rawBookings.map(b => ({ ...b, property: (propsMap[b.property_id] ?? null) as Property })) as Booking[])
      setFavorites(rawFavs.map(f => ({ ...f, property: (propsMap[f.property_id] ?? null) as Property })) as Favorite[])
    } catch {
      // tables may not exist yet, render empty state
    } finally {
      setLoading(false)
    }
  }

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
    await supabase.from('favorites').delete().eq('user_id', user!.id).eq('property_id', propertyId)
    setFavorites(prev => prev.filter(f => f.property_id !== propertyId))
  }

  const navItems = TABS.map(t =>
    t.key === 'notificacoes' ? { ...t, badge: unreadCount } : t
  )

  const kycStatus = profile?.kyc_status ?? 'INCOMPLETO'
  const kycIncomplete = kycStatus === 'INCOMPLETO' || kycStatus === 'REPROVADO'

  return (
    <DashboardLayout title="Minha Conta" navItems={navItems}>

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
              <h2 className="font-display text-xl font-bold text-white mb-5">Minhas Reservas</h2>
              {bookings.length === 0 ? (
                <EmptyState icon={<Calendar size={40} />} text="Você ainda não tem reservas.">
                  <Link to={APP_ROUTES.HOME}><Button>Explorar imóveis</Button></Link>
                </EmptyState>
              ) : (
                <div className="space-y-3">
                  {bookings.map(b => <BookingCard key={b.id} booking={b} />)}
                </div>
              )}
            </section>
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
                  {favorites.map(f => f.property && (
                    <Card key={f.id} className="flex gap-4 p-4">
                      <img
                        src={f.property.photos?.[0] ?? ''}
                        alt={f.property.name}
                        className="w-20 h-20 rounded-xl object-cover flex-shrink-0 bg-[#2A2A2A]"
                        onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400' }}
                      />
                      <div className="flex-1 min-w-0">
                        <Link
                          to={APP_ROUTES.PROPERTY(f.property_id)}
                          className="font-semibold text-white hover:text-[#E50914] transition-colors text-sm line-clamp-1"
                        >
                          {f.property.name}
                        </Link>
                        <p className="text-xs text-[#B3B3B3] flex items-center gap-1 mt-0.5">
                          <MapPin size={10} /> {f.property.city}, {f.property.state}
                        </p>
                        <p className="text-sm font-bold text-[#F5A623] mt-1">
                          {formatCurrency(f.property.price_per_night)}<span className="text-xs text-[#666] font-normal">/noite</span>
                        </p>
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
    </DashboardLayout>
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

function BookingCard({ booking }: { booking: Booking }) {
  const paid = booking.installments?.filter(i => i.status === 'PAGO').length ?? 0
  const total = booking.installments?.length ?? 0
  const next = booking.installments?.find(i => i.status === 'PENDENTE')
  const daysLeft = next ? daysUntil(next.due_date) : null

  const isUsed = booking.status !== 'CANCELADA' && new Date(booking.check_out + 'T23:59:59') < new Date()

  const statusMap: Record<string, { label: string; cls: string }> = {
    AGUARDANDO_PAGAMENTO: { label: 'Aguardando pagamento', cls: 'bg-[#F5A623]/20 text-[#F5A623]' },
    PARCIAL:              { label: 'Parcelada — em dia',   cls: 'bg-blue-500/20 text-blue-400' },
    PAGO:                 { label: 'Paga',                 cls: 'bg-[#46D369]/20 text-[#46D369]' },
    CONCLUIDA:            { label: 'Utilizada',            cls: 'bg-[#333] text-[#B3B3B3]' },
    CANCELADA:            { label: 'Cancelada',            cls: 'bg-[#E50914]/20 text-[#E50914]' },
  }
  const s = isUsed
    ? { label: 'Utilizada', cls: 'bg-[#333] text-[#B3B3B3]' }
    : (statusMap[booking.status] ?? statusMap.AGUARDANDO_PAGAMENTO)

  return (
    <Card className="p-4 flex gap-4 items-start">
      <img
        src={booking.property?.photos?.[0] ?? ''}
        alt={booking.property?.name}
        className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-[#2A2A2A]"
        onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=200' }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <p className="font-semibold text-white text-sm line-clamp-1">{booking.property?.name ?? 'Imóvel'}</p>
            <p className="text-xs text-[#B3B3B3] flex items-center gap-1 mt-0.5">
              <BedDouble size={10} /> {formatShortDate(booking.check_in)} → {formatShortDate(booking.check_out)}
              <span className="ml-1 text-[#555]">· {booking.nights}n</span>
            </p>
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 ${s.cls}`}>{s.label}</span>
        </div>

        {total > 0 && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-[#B3B3B3] mb-1">
              <span>{paid}/{total} parcelas pagas</span>
              <span className="font-bold text-[#F5A623]">{formatCurrency(booking.total_price)}</span>
            </div>
            <div className="h-1.5 bg-[#333] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#46D369] rounded-full"
                style={{ width: `${total > 0 ? (paid / total) * 100 : 0}%` }}
              />
            </div>
            {next && daysLeft !== null && (
              <p className={`text-xs mt-1 ${daysLeft <= 3 ? 'text-[#E50914]' : 'text-[#B3B3B3]'}`}>
                <CreditCard size={10} className="inline mr-1" />
                Próx.: {formatCurrency(next.value)} · vence em {daysLeft}d
              </p>
            )}
          </div>
        )}
      </div>
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

// needed as inline svg since lucide doesn't export Clock separately in all versions
function Clock({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
