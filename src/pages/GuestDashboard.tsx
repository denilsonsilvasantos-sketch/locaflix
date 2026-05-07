import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Calendar, Heart, Home, User, CreditCard, Bell, ShieldCheck, Check, AlertCircle, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Booking, Favorite, Notification } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { DashboardLayout } from '../components/layout/DashboardLayout'
import { Card, StatCard } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { KYCDocumentField } from '../components/ui/KYCDocumentField'
import { useToast } from '../hooks/useToast'
import { formatCurrency, formatShortDate, daysUntil } from '../lib/utils'
import { APP_ROUTES } from '../constants'
import { Link } from 'react-router-dom'

const NAV = [
  { label: 'Reservas', icon: <Calendar size={16} />, href: '/minha-conta' },
  { label: 'Favoritos', icon: <Heart size={16} />, href: '/minha-conta?tab=favoritos' },
  { label: 'Notificações', icon: <Bell size={16} />, href: '/minha-conta?tab=notificacoes' },
  { label: 'Documentos', icon: <ShieldCheck size={16} />, href: '/minha-conta?tab=documentos' },
  { label: 'Perfil', icon: <User size={16} />, href: '/minha-conta?tab=perfil' },
]

export function GuestDashboard() {
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'reservas'
  const { user, profile, refreshProfile } = useAuth()
  const { notifications, unreadCount, markAllRead } = useNotifications()
  const { toast } = useToast()

  const [bookings, setBookings] = useState<Booking[]>([])
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(true)
  const [editProfile, setEditProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({
    name: profile?.name ?? '',
    phone: profile?.phone ?? '',
    avatar_url: profile?.avatar_url ?? '',
  })
  const [kycDocUrl, setKycDocUrl] = useState<string>('')
  const [submittingKyc, setSubmittingKyc] = useState(false)

  useEffect(() => {
    if (user) loadData()
  }, [user])

  useEffect(() => {
    if (profile) {
      setProfileForm({ name: profile.name ?? '', phone: profile.phone ?? '', avatar_url: profile.avatar_url ?? '' })
      setKycDocUrl(profile.document_url ?? '')
    }
  }, [profile])

  async function loadData() {
    setLoading(true)
    const [{ data: bk }, { data: fav }] = await Promise.all([
      supabase.from('bookings')
        .select('*, property:properties(id,name,photos,city,state,price_per_night), installments(*)')
        .eq('guest_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('favorites')
        .select('*, property:properties(id,name,photos,city,state,price_per_night,rating)')
        .eq('user_id', user!.id)
        .limit(20),
    ])
    setBookings((bk ?? []) as Booking[])
    setFavorites((fav ?? []) as Favorite[])
    setLoading(false)
  }

  async function saveProfile() {
    const { error } = await supabase.from('users').update(profileForm).eq('id', user!.id)
    if (error) { toast('error', 'Erro', error.message); return }
    await refreshProfile()
    toast('success', 'Perfil atualizado!')
    setEditProfile(false)
  }

  async function removeFavorite(propertyId: string) {
    await supabase.from('favorites').delete().eq('user_id', user!.id).eq('property_id', propertyId)
    setFavorites(f => f.filter(fav => fav.property_id !== propertyId))
  }

  async function submitKYC() {
    if (!user || !kycDocUrl) return
    setSubmittingKyc(true)
    const { error } = await supabase.from('users')
      .update({ kyc_status: 'PENDENTE', document_url: kycDocUrl })
      .eq('id', user.id)
    if (error) { toast('error', 'Erro', error.message); setSubmittingKyc(false); return }
    await refreshProfile()
    toast('success', 'Documentos enviados', 'Sua análise está em andamento.')
    setSubmittingKyc(false)
  }

  const navWithBadge = NAV.map(n =>
    n.href.includes('notificacoes') ? { ...n, badge: unreadCount } : n
  )

  const upcoming = bookings.filter(b => b.status !== 'CANCELADA' && new Date(b.check_in) > new Date())
  const past = bookings.filter(b => b.status === 'CONCLUIDA' || new Date(b.check_out) < new Date())
  const isPending = profile?.kyc_status === 'PENDENTE'

  return (
    <DashboardLayout title="Minha Conta" navItems={navWithBadge}>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Reservas" value={bookings.length} icon={<Calendar size={18} />} />
        <StatCard label="Próximas" value={upcoming.length} icon={<Home size={18} />} />
        <StatCard label="Favoritos" value={favorites.length} icon={<Heart size={18} />} />
        <StatCard label="Gastos" value={formatCurrency(bookings.reduce((s, b) => s + b.total_price, 0))} icon={<CreditCard size={18} />} accent />
      </div>

      {/* RESERVAS TAB */}
      {(tab === 'reservas' || !tab) && (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-bold text-white mb-4">Próximas estadias</h2>
              <div className="space-y-3">
                {upcoming.map(b => <BookingRow key={b.id} booking={b} />)}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-bold text-white mb-4">Histórico</h2>
              <div className="space-y-3">
                {past.map(b => <BookingRow key={b.id} booking={b} />)}
              </div>
            </section>
          )}
          {bookings.length === 0 && !loading && (
            <div className="text-center py-16">
              <Calendar size={48} className="mx-auto text-[#333] mb-4" />
              <p className="text-[#B3B3B3] mb-4">Você ainda não tem reservas.</p>
              <Link to={APP_ROUTES.HOME}><Button>Explorar imóveis</Button></Link>
            </div>
          )}
        </div>
      )}

      {/* FAVORITOS TAB */}
      {tab === 'favoritos' && (
        <div>
          <h2 className="font-display text-xl font-bold text-white mb-4">Favoritos</h2>
          {favorites.length === 0 ? (
            <div className="text-center py-16">
              <Heart size={48} className="mx-auto text-[#333] mb-4" />
              <p className="text-[#B3B3B3]">Nenhum favorito ainda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {favorites.map(f => f.property && (
                <Card key={f.id} className="flex gap-4 p-4">
                  <img src={f.property.photos?.[0] ?? ''} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <Link to={APP_ROUTES.PROPERTY(f.property_id)} className="font-semibold text-white hover:text-[#E50914] transition-colors line-clamp-1">
                      {f.property.name}
                    </Link>
                    <p className="text-xs text-[#B3B3B3]">{f.property.city}, {f.property.state}</p>
                    <p className="text-sm font-bold text-[#F5A623] mt-1">{formatCurrency(f.property.price_per_night)}/noite</p>
                    <button onClick={() => removeFavorite(f.property_id)} className="text-xs text-[#E50914] hover:underline mt-1">
                      Remover
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* NOTIFICAÇÕES TAB */}
      {tab === 'notificacoes' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold text-white">Notificações</h2>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead}>Marcar todas como lidas</Button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="text-center py-16">
              <Bell size={48} className="mx-auto text-[#333] mb-4" />
              <p className="text-[#B3B3B3]">Nenhuma notificação.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map(n => <NotificationRow key={n.id} notification={n} />)}
            </div>
          )}
        </div>
      )}

      {/* DOCUMENTOS TAB */}
      {tab === 'documentos' && (
        <div className="max-w-lg">
          <h2 className="font-display text-xl font-bold text-white mb-5">Verificação de identidade</h2>

          <KYCStatusBanner status={profile?.kyc_status ?? 'INCOMPLETO'} />

          {profile?.kyc_status !== 'APROVADO' && (
            <Card className="p-6 mt-4 space-y-6">
              <div>
                <h3 className="font-semibold text-white mb-1">Documento com foto</h3>
                <p className="text-xs text-[#B3B3B3] mb-4">
                  RG ou CNH — envie uma foto clara de frente e verso (pode ser em um único arquivo).
                </p>
                <KYCDocumentField
                  userId={user!.id}
                  fieldKey="document"
                  label="RG / CNH"
                  hint="JPG, PNG ou PDF · máx. 10 MB"
                  currentUrl={kycDocUrl || profile?.document_url}
                  disabled={isPending}
                  onSuccess={url => setKycDocUrl(url)}
                />
              </div>

              {(kycDocUrl || profile?.document_url) && !isPending && (
                <Button
                  onClick={submitKYC}
                  loading={submittingKyc}
                  fullWidth
                >
                  Enviar para análise
                </Button>
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

      {/* PERFIL TAB */}
      {tab === 'perfil' && (
        <div className="max-w-lg">
          <h2 className="font-display text-xl font-bold text-white mb-4">Perfil</h2>
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-16 h-16 rounded-full bg-[#E50914] flex items-center justify-center text-2xl font-bold text-white overflow-hidden">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : (profile?.name?.[0] ?? 'U')
                }
              </div>
              <div>
                <p className="font-semibold text-white">{profile?.name}</p>
                <p className="text-xs text-[#B3B3B3]">{user?.email}</p>
                <span className="text-xs font-bold bg-[#E50914]/20 text-[#E50914] px-2 py-0.5 rounded mt-1 inline-block">
                  {profile?.role}
                </span>
              </div>
            </div>

            {editProfile ? (
              <>
                <Input label="Nome" value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} />
                <Input label="Telefone" value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} />
                <div className="flex gap-3 pt-2">
                  <Button onClick={saveProfile}>Salvar</Button>
                  <Button variant="ghost" onClick={() => setEditProfile(false)}>Cancelar</Button>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[#666]">CPF</p>
                    <p className="text-white">{profile?.cpf ? `${profile.cpf.slice(0,3)}.***.***-${profile.cpf.slice(9)}` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[#666]">Telefone</p>
                    <p className="text-white">{profile?.phone ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[#666]">KYC</p>
                    <KYCBadge status={profile?.kyc_status ?? 'INCOMPLETO'} />
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setEditProfile(true)}>
                  Editar perfil
                </Button>
              </>
            )}
          </Card>
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
      msg: 'Seus documentos foram aprovados. Você pode fazer reservas.',
    },
    PENDENTE: {
      icon: <Clock size={16} />,
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
      msg: 'Envie seu documento de identidade para liberar reservas na plataforma.',
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

function BookingRow({ booking }: { booking: Booking }) {
  const paidInstallments = booking.installments?.filter(i => i.status === 'PAGO').length ?? 0
  const totalInstallments = booking.installments?.length ?? 0
  const nextPending = booking.installments?.find(i => i.status === 'PENDENTE')
  const daysLeft = nextPending ? daysUntil(nextPending.due_date) : null

  return (
    <Card className="p-4 flex gap-4 items-start">
      <img src={booking.property?.photos?.[0] ?? ''} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <p className="font-semibold text-white text-sm line-clamp-1">{booking.property?.name}</p>
            <p className="text-xs text-[#B3B3B3]">{formatShortDate(booking.check_in)} → {formatShortDate(booking.check_out)}</p>
          </div>
          <BookingStatusBadge status={booking.status} />
        </div>
        {totalInstallments > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-[#B3B3B3] mb-1">
              <span>Pagamento: {paidInstallments}/{totalInstallments} parcelas</span>
              <span className="font-bold text-[#F5A623]">{formatCurrency(booking.total_price)}</span>
            </div>
            <div className="h-1.5 bg-[#333] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#46D369] rounded-full transition-all"
                style={{ width: `${totalInstallments > 0 ? (paidInstallments / totalInstallments) * 100 : 0}%` }}
              />
            </div>
            {nextPending && daysLeft !== null && (
              <p className={`text-xs mt-1 ${daysLeft <= 3 ? 'text-[#E50914]' : 'text-[#B3B3B3]'}`}>
                Próx. parcela: {formatCurrency(nextPending.value)} · vence em {daysLeft}d
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

function BookingStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    AGUARDANDO_PAGAMENTO: { label: 'Aguardando', cls: 'bg-[#F5A623]/20 text-[#F5A623]' },
    PARCIAL: { label: 'Parcial', cls: 'bg-blue-500/20 text-blue-400' },
    PAGO: { label: 'Pago', cls: 'bg-[#46D369]/20 text-[#46D369]' },
    CONCLUIDA: { label: 'Concluída', cls: 'bg-[#333] text-[#B3B3B3]' },
    CANCELADA: { label: 'Cancelada', cls: 'bg-[#E50914]/20 text-[#E50914]' },
  }
  const { label, cls } = map[status] ?? map.AGUARDANDO_PAGAMENTO
  return <span className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 ${cls}`}>{label}</span>
}

function KYCBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    APROVADO: 'text-[#46D369]',
    PENDENTE: 'text-[#F5A623]',
    REPROVADO: 'text-[#E50914]',
    INCOMPLETO: 'text-[#B3B3B3]',
  }
  return <span className={`text-sm font-medium ${map[status] ?? 'text-[#B3B3B3]'}`}>{status}</span>
}

function NotificationRow({ notification }: { notification: Notification }) {
  return (
    <div className={`flex gap-3 p-4 rounded-xl border transition-colors ${notification.is_read ? 'bg-transparent border-[#222]' : 'bg-[#1F1F1F] border-[#333]'}`}>
      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${notification.is_read ? 'bg-[#333]' : 'bg-[#E50914]'}`} />
      <div>
        <p className="text-sm font-semibold text-white">{notification.title}</p>
        <p className="text-xs text-[#B3B3B3] mt-0.5">{notification.message}</p>
      </div>
    </div>
  )
}

// Needed for KYCStatusBanner
function Clock({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
