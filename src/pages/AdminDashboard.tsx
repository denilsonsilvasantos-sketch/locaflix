import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  LayoutDashboard, Home, Users, ShieldCheck, DollarSign, Send, FileWarning,
  Settings, Menu, X, LogOut, Check, TrendingUp, Building2, CheckCircle2,
  Banknote, AlertTriangle, UserPlus, Ban, Search, Bell, RefreshCw, Plus, Eye,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { formatCurrency, formatShortDate } from '../lib/utils'
import type { Property, UserProfile, Booking, Installment } from '../types'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',        icon: LayoutDashboard },
  { id: 'imoveis',   label: 'Imóveis',          icon: Home },
  { id: 'usuarios',  label: 'Usuários',          icon: Users },
  { id: 'kyc',       label: 'KYC / Verificações', icon: ShieldCheck },
  { id: 'pagamentos',label: 'Pagamentos',        icon: DollarSign },
  { id: 'repasses',  label: 'Repasses',          icon: Send },
  { id: 'sinistros', label: 'Sinistros',         icon: FileWarning },
  { id: 'config',    label: 'Configurações',     icon: Settings },
] as const

type TabId = typeof NAV_ITEMS[number]['id']

interface KPIs {
  totalProperties: number
  activeProperties: number
  pendingProperties: number
  monthBookings: number
  volumeBloqueado: number
  volumeLiberado: number
  inadimplentes: number
  taxaOcupacao: number
  plataformRevenue: number
  pendingKYC: number
}

interface ChartPoint { month: string; gmv: number; revenue: number }
interface StatePoint  { state: string; value: number }

type BookingRow = Booking & { property?: Property; guest?: UserProfile; owner?: UserProfile }
type InstallRow  = Installment & { booking?: BookingRow }

const PIE_COLORS = ['#E50914','#F5A623','#46D369','#1E90FF','#9B59B6','#1ABC9C']

export function AdminDashboard() {
  const { user, profile, signOut } = useAuth()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') ?? 'dashboard') as TabId
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Dashboard data
  const [kpis, setKpis]             = useState<KPIs | null>(null)
  const [chartData, setChartData]   = useState<ChartPoint[]>([])
  const [stateData, setStateData]   = useState<StatePoint[]>([])
  const [alerts, setAlerts]         = useState<string[]>([])
  const [pendingKYCCount, setPendingKYCCount]   = useState(0)
  const [pendingPropsCount, setPendingPropsCount] = useState(0)

  // Tab data
  const [properties, setProperties] = useState<Property[]>([])
  const [propFilter, setPropFilter] = useState('todos')
  const [users, setUsers]           = useState<UserProfile[]>([])
  const [userSubTab, setUserSubTab] = useState<'clientes'|'proprietarios'>('clientes')
  const [userSearch, setUserSearch] = useState('')
  const [kycPending, setKycPending] = useState<UserProfile[]>([])
  const [installments, setInstallments] = useState<InstallRow[]>([])
  const [installFilter, setInstallFilter] = useState('todos')
  const [repasses, setRepasses]     = useState<BookingRow[]>([])
  const [sinistros, setSinistros]   = useState<Record<string, unknown>[]>([])
  const [loadingTab, setLoadingTab] = useState(false)

  const setTab = (t: TabId) => setSearchParams(t === 'dashboard' ? {} : { tab: t })

  useEffect(() => { loadDashboard() }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadTabData(tab) }, [tab])

  async function loadDashboard() {
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`

    const [
      { data: props },
      { data: allBookings },
      { data: kycUsers },
      { data: overdueInstall },
    ] = await Promise.all([
      supabase.from('properties').select('id,status,state').limit(1000),
      supabase.from('bookings').select('id,total_price,platform_fee,subtotal,status,created_at').limit(1000),
      supabase.from('users').select('id').eq('kyc_status','PENDENTE'),
      supabase.from('installments').select('id').eq('status','ATRASADO'),
    ])

    const propsData    = (props ?? []) as { id: string; status: string; state: string }[]
    const bookingsData = (allBookings ?? []) as { id: string; total_price: number; platform_fee: number; subtotal: number; status: string; created_at: string }[]
    const pendKYC      = (kycUsers ?? []).length
    const overdue      = (overdueInstall ?? []).length
    const pendProps    = propsData.filter(p => p.status === 'PENDENTE').length

    setPendingKYCCount(pendKYC)
    setPendingPropsCount(pendProps)

    // State pie
    const stateMap: Record<string, number> = {}
    propsData.filter(p => p.status === 'ATIVO').forEach(p => {
      stateMap[p.state] = (stateMap[p.state] ?? 0) + 1
    })
    setStateData(
      Object.entries(stateMap).sort(([,a],[,b]) => b - a).slice(0,6).map(([state,value]) => ({ state, value }))
    )

    // Monthly chart (last 6 months)
    const monthMap: Record<string, { gmv: number; revenue: number }> = {}
    bookingsData.forEach(b => {
      if (!['PAGO','CONCLUIDA','PARCIAL'].includes(b.status)) return
      const m = b.created_at?.slice(0,7) ?? ''
      if (!monthMap[m]) monthMap[m] = { gmv: 0, revenue: 0 }
      monthMap[m].gmv     += b.total_price
      monthMap[m].revenue += b.platform_fee
    })
    setChartData(
      Object.entries(monthMap)
        .sort(([a],[b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, v]) => ({ month: month.slice(5), ...v }))
    )

    const monthBookings     = bookingsData.filter(b => b.created_at >= monthStart).length
    const volumeBloqueado   = bookingsData.filter(b => ['PAGO','PARCIAL'].includes(b.status)).reduce((s,b) => s + b.total_price, 0)
    const volumeLiberado    = bookingsData.filter(b => b.status === 'CONCLUIDA').reduce((s,b) => s + b.total_price, 0)
    const plataformRevenue  = bookingsData.filter(b => ['PAGO','CONCLUIDA','PARCIAL'].includes(b.status)).reduce((s,b) => s + b.platform_fee, 0)
    const activeProps       = propsData.filter(p => p.status === 'ATIVO').length

    setKpis({
      totalProperties: propsData.length, activeProperties: activeProps, pendingProperties: pendProps,
      monthBookings, volumeBloqueado, volumeLiberado, inadimplentes: overdue,
      taxaOcupacao: propsData.length > 0 ? Math.round((activeProps / propsData.length) * 100) : 0,
      plataformRevenue, pendingKYC: pendKYC,
    })

    const al: string[] = []
    if (pendKYC > 0)    al.push(`${pendKYC} verificação(ões) KYC aguardando aprovação`)
    if (pendProps > 0)  al.push(`${pendProps} imóvel(is) aguardando revisão`)
    if (overdue > 0)    al.push(`${overdue} parcela(s) em atraso`)
    setAlerts(al)
  }

  async function loadTabData(t: TabId) {
    setLoadingTab(true)
    try {
      if (t === 'imoveis') {
        const { data } = await supabase
          .from('properties').select('*, owner:owner_id(id,name,email)')
          .order('created_at', { ascending: false }).limit(200)
        setProperties((data ?? []) as Property[])

      } else if (t === 'usuarios') {
        const { data } = await supabase
          .from('users').select('*').order('created_at', { ascending: false }).limit(200)
        setUsers((data ?? []) as UserProfile[])

      } else if (t === 'kyc') {
        const { data } = await supabase
          .from('users').select('*').eq('kyc_status','PENDENTE').order('created_at', { ascending: false })
        setKycPending((data ?? []) as UserProfile[])

      } else if (t === 'pagamentos') {
        const { data } = await supabase
          .from('installments')
          .select('*, booking:booking_id(id,booking_number,total_price,status, property:property_id(name,photos), guest:guest_id(name,email))')
          .order('due_date', { ascending: true }).limit(300)
        setInstallments((data ?? []) as unknown as InstallRow[])

      } else if (t === 'repasses') {
        const { data } = await supabase
          .from('bookings')
          .select('*, property:property_id(id,name,photos,city,state), guest:guest_id(id,name,email), owner:owner_id(id,name,email)')
          .in('status', ['CONCLUIDA','PAGO']).eq('repasse_liberado', false).order('updated_at', { ascending: false }).limit(200)
        setRepasses((data ?? []) as unknown as BookingRow[])

      } else if (t === 'sinistros') {
        try {
          const { data, error } = await supabase.from('sinistros').select('*').order('created_at', { ascending: false })
          if (!error) setSinistros(data ?? [])
        } catch { /* table may not exist */ }
      }
    } finally {
      setLoadingTab(false)
    }
  }

  async function approveProperty(id: string) {
    const { error } = await supabase.from('properties').update({ status: 'ATIVO' }).eq('id', id)
    if (error) { toast('error','Erro', error.message); return }
    setProperties(prev => prev.map(p => p.id === id ? { ...p, status: 'ATIVO' as const } : p))
    setPendingPropsCount(c => Math.max(0, c-1))
    toast('success','Imóvel aprovado')
  }

  async function rejectProperty(id: string) {
    const { error } = await supabase.from('properties').update({ status: 'REPROVADO' }).eq('id', id)
    if (error) { toast('error','Erro', error.message); return }
    setProperties(prev => prev.map(p => p.id === id ? { ...p, status: 'REPROVADO' as const } : p))
    setPendingPropsCount(c => Math.max(0, c-1))
    toast('info','Imóvel reprovado')
  }

  async function approveKYC(uid: string) {
    const { error } = await supabase.from('users').update({ kyc_status: 'APROVADO' }).eq('id', uid)
    if (error) { toast('error','Erro', error.message); return }
    setKycPending(prev => prev.filter(u => u.id !== uid))
    setPendingKYCCount(c => Math.max(0, c-1))
    toast('success','KYC aprovado')
  }

  async function rejectKYC(uid: string) {
    const { error } = await supabase.from('users').update({ kyc_status: 'REPROVADO' }).eq('id', uid)
    if (error) { toast('error','Erro', error.message); return }
    setKycPending(prev => prev.filter(u => u.id !== uid))
    setPendingKYCCount(c => Math.max(0, c-1))
    toast('info','KYC reprovado')
  }

  async function makeOwner(uid: string) {
    const { error } = await supabase.from('users').update({ role: 'OWNER' }).eq('id', uid)
    if (error) { toast('error','Erro', error.message); return }
    setUsers(prev => prev.map(u => u.id === uid ? { ...u, role: 'OWNER' as const } : u))
    toast('success','Usuário promovido a Anfitrião')
  }

  async function blockUser(uid: string) {
    const { error } = await supabase.from('users').update({ kyc_status: 'REPROVADO' }).eq('id', uid)
    if (error) { toast('error','Erro', error.message); return }
    setUsers(prev => prev.map(u => u.id === uid ? { ...u, kyc_status: 'REPROVADO' as const } : u))
    toast('warning','Usuário bloqueado')
  }

  async function markInstallmentPaid(id: string) {
    const { error } = await supabase.from('installments')
      .update({ status: 'PAGO', paid_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast('error','Erro', error.message); return }
    setInstallments(prev => prev.map(i => i.id === id ? { ...i, status: 'PAGO' as const } : i))
    toast('success','Parcela marcada como paga')
  }

  async function liberarRepasse(id: string) {
    const { error } = await supabase
      .from('bookings')
      .update({ repasse_liberado: true, repasse_liberado_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { toast('error', 'Erro', error.message); return }
    setRepasses(prev => prev.filter(b => b.id !== id))
    toast('success', 'Repasse liberado', 'O repasse foi processado para o anfitrião.')
  }

  // Filters
  const filteredProps  = properties.filter(p => propFilter === 'todos' || p.status.toLowerCase() === propFilter)
  const filteredUsers  = users.filter(u => {
    const roleOk   = userSubTab === 'clientes' ? u.role === 'GUEST' : u.role === 'OWNER' || u.role === 'ADMIN'
    const searchOk = !userSearch || u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())
    return roleOk && searchOk
  })
  const filteredInstall = installments.filter(i => installFilter === 'todos' || i.status.toLowerCase() === installFilter)
  const repassesBloqueados = repasses.filter(b => b.status === 'PAGO').reduce((s,b) => s + (b.subtotal - b.platform_fee), 0)
  const repassesProntos    = repasses.filter(b => b.status === 'CONCLUIDA').reduce((s,b) => s + (b.subtotal - b.platform_fee), 0)

  return (
    <div className="min-h-screen bg-[#0E0E0E] flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR */}
      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen z-50 w-60 flex-shrink-0
        bg-[#141414] border-r border-[#1F1F1F] flex flex-col
        transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#1F1F1F] flex items-center justify-between">
          <div>
            <span className="font-display text-xl font-bold text-[#E50914]">LOCAFLIX</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#E50914]" />
              <span className="text-[10px] font-bold text-[#E50914] uppercase tracking-widest">Painel Admin</span>
            </div>
          </div>
          <button className="lg:hidden text-[#555] hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const Icon   = item.icon
            const active = tab === item.id
            const badge  = item.id === 'kyc' ? pendingKYCCount : item.id === 'imoveis' ? pendingPropsCount : 0
            return (
              <button
                key={item.id}
                onClick={() => { setTab(item.id); setSidebarOpen(false) }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all text-left
                  ${active ? 'bg-[#E50914]/10 text-white border-r-2 border-[#E50914]' : 'text-[#777] hover:text-white hover:bg-[#1A1A1A]'}`}
              >
                <Icon size={16} className={active ? 'text-[#E50914]' : ''} />
                <span className="flex-1">{item.label}</span>
                {badge > 0 && (
                  <span className="bg-[#E50914] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="px-4 py-4 border-t border-[#1F1F1F]">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#E50914] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {profile?.name?.charAt(0)?.toUpperCase() ?? 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{profile?.name ?? 'Admin'}</p>
              <p className="text-[10px] text-[#444] truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={async () => { await signOut() }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#555] hover:text-[#E50914] hover:bg-[#1A1A1A] rounded-lg transition-colors"
          >
            <LogOut size={13} /> Sair do painel
          </button>
        </div>
      </aside>

      {/* ── MAIN */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <header className="h-14 bg-[#141414] border-b border-[#1F1F1F] flex items-center px-4 lg:px-6 gap-3 sticky top-0 z-30">
          <button className="lg:hidden text-[#555] hover:text-white" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <h1 className="text-sm font-semibold text-white flex-1">
            {NAV_ITEMS.find(n => n.id === tab)?.label ?? 'Dashboard'}
          </h1>
          <button onClick={loadDashboard} className="flex items-center gap-1.5 text-xs text-[#555] hover:text-white transition-colors">
            <RefreshCw size={13} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#46D369] animate-pulse" />
            <span className="text-[10px] text-[#444] hidden sm:inline">Online</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">

          {/* ─────────────── DASHBOARD ─────────────── */}
          {tab === 'dashboard' && (
            <div className="space-y-6">
              {kpis && (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <KpiCard label="Total Imóveis"      value={kpis.totalProperties}            sub={`${kpis.activeProperties} ativos`} icon={<Home size={17} />} />
                    <KpiCard label="Reservas (mês)"     value={kpis.monthBookings}               icon={<TrendingUp size={17} />} accent />
                    <KpiCard label="Volume Bloqueado"   value={formatCurrency(kpis.volumeBloqueado)} icon={<Banknote size={17} />} />
                    <KpiCard label="Volume Liberado"    value={formatCurrency(kpis.volumeLiberado)}  icon={<CheckCircle2 size={17} />} green />
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <KpiCard label="Inadimplentes"      value={kpis.inadimplentes}  icon={<AlertTriangle size={17} />} danger={kpis.inadimplentes > 0} />
                    <KpiCard label="Taxa Ocupação"      value={`${kpis.taxaOcupacao}%`} icon={<Building2 size={17} />} />
                    <KpiCard label="Receita Plataforma" value={formatCurrency(kpis.plataformRevenue)} icon={<DollarSign size={17} />} accent />
                    <KpiCard label="KYC Pendente"       value={kpis.pendingKYC}     icon={<ShieldCheck size={17} />} danger={kpis.pendingKYC > 0} />
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                {/* Bar chart */}
                <div className="xl:col-span-2 bg-[#1A1A1A] border border-[#222] rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">Receita últimos 6 meses</h3>
                    <div className="flex gap-4 text-[10px] text-[#555]">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-[#E50914] inline-block" />GMV</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-[#F5A623] inline-block" />Receita</span>
                    </div>
                  </div>
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={190}>
                      <BarChart data={chartData} margin={{ top:0, right:0, bottom:0, left:0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                        <XAxis dataKey="month" tick={{ fill:'#444', fontSize:11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill:'#444', fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                        <Tooltip
                          contentStyle={{ background:'#1F1F1F', border:'1px solid #2A2A2A', borderRadius:8 }}
                          labelStyle={{ color:'#fff', fontSize:12 }}
                          formatter={(val) => [formatCurrency(Number(val ?? 0)), '']}
                        />
                        <Bar dataKey="gmv"     name="GMV"     fill="#E50914" radius={[4,4,0,0]} maxBarSize={28} />
                        <Bar dataKey="revenue" name="Receita" fill="#F5A623" radius={[4,4,0,0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[190px] flex items-center justify-center text-[#333] text-sm">Sem dados suficientes</div>
                  )}
                </div>

                {/* Pie chart */}
                <div className="bg-[#1A1A1A] border border-[#222] rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-3">Imóveis por Estado</h3>
                  {stateData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={150}>
                        <PieChart>
                          <Pie data={stateData} cx="50%" cy="50%" innerRadius={42} outerRadius={68} dataKey="value" paddingAngle={2}>
                            {stateData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background:'#1F1F1F', border:'1px solid #2A2A2A', borderRadius:8 }}
                            formatter={(val, _n, p) => [Number(val ?? 0), (p?.payload as StatePoint)?.state ?? '']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 mt-2">
                        {stateData.map((d, i) => (
                          <div key={d.state} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full flex-shrink-0 inline-block" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="text-[#666]">{d.state}</span>
                            </span>
                            <span className="text-white font-medium">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-[#333] text-sm">Sem imóveis ativos</div>
                  )}
                </div>
              </div>

              {/* Alerts */}
              {alerts.length > 0 && (
                <div className="bg-[#1A1A1A] border border-[#222] rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Bell size={14} className="text-[#F5A623]" />
                    <h3 className="text-sm font-semibold text-white">Alertas do sistema</h3>
                  </div>
                  <div className="space-y-2">
                    {alerts.map((a, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-[#F5A623]/5 border border-[#F5A623]/20 rounded-lg">
                        <AlertTriangle size={13} className="text-[#F5A623] flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-[#B3B3B3]">{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─────────────── IMÓVEIS ─────────────── */}
          {tab === 'imoveis' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex gap-2 flex-wrap">
                  {['todos','pendente','ativo','inativo','reprovado'].map(f => (
                    <button key={f} onClick={() => setPropFilter(f)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                        ${propFilter === f ? 'bg-[#E50914] text-white' : 'bg-[#1A1A1A] text-[#777] hover:text-white border border-[#222]'}`}
                    >
                      {f === 'todos' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
                      {f === 'pendente' && pendingPropsCount > 0 && (
                        <span className="ml-1 bg-[#F5A623] text-black text-[9px] px-1.5 rounded-full">{pendingPropsCount}</span>
                      )}
                    </button>
                  ))}
                </div>
                <Link to="/anfitriao/novo-imovel">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E50914] hover:bg-[#F40612] text-white text-xs font-bold rounded-lg transition-colors">
                    <Plus size={13} /> Novo Imóvel
                  </button>
                </Link>
              </div>

              {loadingTab ? <Skeleton /> : (
                <div className="bg-[#1A1A1A] border border-[#222] rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#222] text-[#444] text-xs">
                          <th className="text-left px-4 py-3">Imóvel</th>
                          <th className="text-left px-4 py-3 hidden md:table-cell">Tipo</th>
                          <th className="text-left px-4 py-3 hidden lg:table-cell">Anfitrião</th>
                          <th className="text-left px-4 py-3">Valor/noite</th>
                          <th className="text-left px-4 py-3">Status</th>
                          <th className="text-right px-4 py-3">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProps.map(p => (
                          <tr key={p.id} className="border-b border-[#1F1F1F] hover:bg-[#1F1F1F] transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <img src={p.photos?.[0] ?? ''} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-[#222]" />
                                <div>
                                  <p className="text-white text-sm font-medium line-clamp-1">{p.name}</p>
                                  <p className="text-[#444] text-xs">{p.city}, {p.state}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell text-[#666] text-xs">{p.type}</td>
                            <td className="px-4 py-3 hidden lg:table-cell text-[#666] text-xs">{(p.owner as UserProfile)?.name ?? '—'}</td>
                            <td className="px-4 py-3 text-white text-xs font-medium">{formatCurrency(p.price_per_night)}</td>
                            <td className="px-4 py-3"><PropBadge status={p.status} /></td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <Link to={`/imovel/${p.id}`} target="_blank">
                                  <button className="p-1.5 rounded-lg text-[#444] hover:text-white hover:bg-[#333] transition-colors"><Eye size={13} /></button>
                                </Link>
                                {p.status === 'PENDENTE' && (
                                  <>
                                    <button onClick={() => approveProperty(p.id)} className="p-1.5 rounded-lg text-[#46D369] hover:bg-[#46D369]/10 transition-colors"><Check size={13} /></button>
                                    <button onClick={() => rejectProperty(p.id)} className="p-1.5 rounded-lg text-[#E50914] hover:bg-[#E50914]/10 transition-colors"><X size={13} /></button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredProps.length === 0 && (
                          <tr><td colSpan={6} className="text-center py-12 text-[#333]">Nenhum imóvel encontrado</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─────────────── USUÁRIOS ─────────────── */}
          {tab === 'usuarios' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-1 bg-[#1A1A1A] border border-[#222] p-1 rounded-lg">
                  {(['clientes','proprietarios'] as const).map(st => (
                    <button key={st} onClick={() => setUserSubTab(st)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                        ${userSubTab === st ? 'bg-[#E50914] text-white' : 'text-[#555] hover:text-white'}`}
                    >
                      {st === 'clientes' ? 'Clientes' : 'Proprietários'}
                    </button>
                  ))}
                </div>
                <div className="flex-1 min-w-[200px] relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
                  <input
                    type="text" placeholder="Buscar por nome ou e-mail..."
                    value={userSearch} onChange={e => setUserSearch(e.target.value)}
                    className="w-full bg-[#1A1A1A] border border-[#222] rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-[#333] focus:outline-none focus:border-[#333]"
                  />
                </div>
              </div>

              {loadingTab ? <Skeleton /> : (
                <div className="bg-[#1A1A1A] border border-[#222] rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#222] text-[#444] text-xs">
                          <th className="text-left px-4 py-3">Usuário</th>
                          <th className="text-left px-4 py-3 hidden md:table-cell">CPF</th>
                          <th className="text-left px-4 py-3">KYC</th>
                          <th className="text-left px-4 py-3 hidden lg:table-cell">Cadastro</th>
                          <th className="text-right px-4 py-3">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map(u => (
                          <tr key={u.id} className="border-b border-[#1F1F1F] hover:bg-[#1F1F1F] transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#2A2A2A] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                                  {u.name?.charAt(0)?.toUpperCase() ?? '?'}
                                </div>
                                <div>
                                  <p className="text-white text-sm font-medium">{u.name ?? '—'}</p>
                                  <p className="text-[#444] text-xs">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell text-[#555] text-xs font-mono">
                              {u.cpf ? `***.***.${u.cpf.replace(/\D/g,'').slice(6,9)}-**` : '—'}
                            </td>
                            <td className="px-4 py-3"><KycBadge status={u.kyc_status} /></td>
                            <td className="px-4 py-3 hidden lg:table-cell text-[#444] text-xs">{formatShortDate(u.created_at)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1.5">
                                {u.role === 'GUEST' && (
                                  <button onClick={() => makeOwner(u.id)}
                                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-[#F5A623] border border-[#F5A623]/30 rounded hover:bg-[#F5A623]/10 transition-colors whitespace-nowrap"
                                  >
                                    <UserPlus size={11} /> ANFITRIÃO
                                  </button>
                                )}
                                <button onClick={() => blockUser(u.id)} title="Bloquear"
                                  className="p-1.5 rounded-lg text-[#444] hover:text-[#E50914] hover:bg-[#E50914]/10 transition-colors"
                                >
                                  <Ban size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredUsers.length === 0 && (
                          <tr><td colSpan={5} className="text-center py-12 text-[#333]">Nenhum usuário encontrado</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─────────────── KYC ─────────────── */}
          {tab === 'kyc' && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-white">
                Verificações pendentes
                {kycPending.length > 0 && <span className="ml-2 font-normal text-[#F5A623]">({kycPending.length})</span>}
              </h2>
              {loadingTab ? <Skeleton /> : kycPending.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <ShieldCheck size={48} className="text-[#46D369] mb-4" />
                  <p className="text-[#555] text-sm">Nenhuma verificação pendente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {kycPending.map(u => (
                    <div key={u.id} className="bg-[#1A1A1A] border border-[#222] rounded-xl p-5">
                      <div className="flex items-start gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="font-semibold text-white">{u.name ?? '—'}</p>
                            <RoleBadge role={u.role} />
                          </div>
                          <p className="text-xs text-[#777]">{u.email}</p>
                          <p className="text-xs text-[#444] mt-0.5">
                            CPF: {u.cpf ? `${u.cpf.slice(0,3)}.***.***-${u.cpf.slice(-2)}` : '—'} · Cadastro: {formatShortDate(u.created_at)}
                          </p>
                          <div className="flex flex-wrap gap-3 mt-3">
                            {u.document_url && (
                              <a href={u.document_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:underline">
                                <ShieldCheck size={11} /> RG / CNH
                              </a>
                            )}
                            {u.address_proof_url && (
                              <a href={u.address_proof_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:underline">
                                <ShieldCheck size={11} /> Comp. Endereço
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => approveKYC(u.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#46D369]/10 border border-[#46D369]/30 text-[#46D369] text-xs font-semibold rounded-lg hover:bg-[#46D369]/20 transition-colors"
                          >
                            <Check size={12} /> Aprovar
                          </button>
                          <button onClick={() => rejectKYC(u.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E50914]/10 border border-[#E50914]/30 text-[#E50914] text-xs font-semibold rounded-lg hover:bg-[#E50914]/20 transition-colors"
                          >
                            <X size={12} /> Reprovar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─────────────── PAGAMENTOS ─────────────── */}
          {tab === 'pagamentos' && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {['todos','pendente','pago','atrasado','cancelado'].map(f => (
                  <button key={f} onClick={() => setInstallFilter(f)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                      ${installFilter === f ? 'bg-[#E50914] text-white' : 'bg-[#1A1A1A] text-[#777] hover:text-white border border-[#222]'}`}
                  >
                    {f === 'todos' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>

              {loadingTab ? <Skeleton /> : (
                <div className="bg-[#1A1A1A] border border-[#222] rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#222] text-[#444] text-xs">
                          <th className="text-left px-4 py-3">Locatário / Imóvel</th>
                          <th className="text-left px-4 py-3 hidden md:table-cell">Parcela</th>
                          <th className="text-left px-4 py-3">Valor</th>
                          <th className="text-left px-4 py-3 hidden sm:table-cell">Vencimento</th>
                          <th className="text-left px-4 py-3">Status</th>
                          <th className="text-right px-4 py-3">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInstall.map(i => {
                          const bk = i.booking as BookingRow | undefined
                          return (
                            <tr key={i.id} className="border-b border-[#1F1F1F] hover:bg-[#1F1F1F] transition-colors">
                              <td className="px-4 py-3">
                                <p className="text-white text-xs font-medium">{(bk?.guest as UserProfile)?.name ?? (bk?.guest as UserProfile)?.email ?? '—'}</p>
                                <p className="text-[#444] text-[11px] line-clamp-1">{(bk?.property as Property)?.name ?? '—'}</p>
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell text-[#666] text-xs">
                                {i.type === 'ENTRADA' ? 'Entrada' : `Parcela ${i.number}`}
                              </td>
                              <td className="px-4 py-3 text-white text-xs font-semibold">{formatCurrency(i.value)}</td>
                              <td className="px-4 py-3 hidden sm:table-cell text-[#555] text-xs">{formatShortDate(i.due_date)}</td>
                              <td className="px-4 py-3"><InstallBadge status={i.status} /></td>
                              <td className="px-4 py-3 text-right">
                                {i.status !== 'PAGO' && i.status !== 'CANCELADO' && (
                                  <button onClick={() => markInstallmentPaid(i.id)}
                                    className="text-[10px] font-bold px-2 py-1 bg-[#46D369]/10 border border-[#46D369]/30 text-[#46D369] rounded hover:bg-[#46D369]/20 transition-colors whitespace-nowrap"
                                  >
                                    MARCAR PAGO
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                        {filteredInstall.length === 0 && (
                          <tr><td colSpan={6} className="text-center py-12 text-[#333]">Nenhum pagamento encontrado</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─────────────── REPASSES ─────────────── */}
          {tab === 'repasses' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#1A1A1A] border border-[#222] rounded-xl p-5">
                  <p className="text-[10px] text-[#444] uppercase tracking-wide mb-1">Bloqueados</p>
                  <p className="text-xl font-bold text-[#F5A623]">{formatCurrency(repassesBloqueados)}</p>
                  <p className="text-[11px] text-[#333] mt-1">Aguardando conclusão das estadias</p>
                </div>
                <div className="bg-[#1A1A1A] border border-[#222] rounded-xl p-5">
                  <p className="text-[10px] text-[#444] uppercase tracking-wide mb-1">Prontos p/ Liberar</p>
                  <p className="text-xl font-bold text-[#46D369]">{formatCurrency(repassesProntos)}</p>
                  <p className="text-[11px] text-[#333] mt-1">Estadias concluídas, aguardando repasse</p>
                </div>
                <div className="bg-[#1A1A1A] border border-[#222] rounded-xl p-5">
                  <p className="text-[10px] text-[#444] uppercase tracking-wide mb-1">Total Liquidado</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(0)}</p>
                  <p className="text-[11px] text-[#333] mt-1">Repasses já realizados</p>
                </div>
              </div>

              {loadingTab ? <Skeleton /> : (
                <div className="bg-[#1A1A1A] border border-[#222] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#222]">
                    <h3 className="text-sm font-semibold text-white">Conciliação de repasses</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#222] text-[#444] text-xs">
                          <th className="text-left px-4 py-3">Reserva</th>
                          <th className="text-left px-4 py-3 hidden md:table-cell">Imóvel</th>
                          <th className="text-left px-4 py-3 hidden lg:table-cell">Anfitrião</th>
                          <th className="text-left px-4 py-3">Valor Repasse</th>
                          <th className="text-left px-4 py-3">Status</th>
                          <th className="text-right px-4 py-3">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {repasses.map(b => {
                          const repasse = b.subtotal - b.platform_fee
                          return (
                            <tr key={b.id} className="border-b border-[#1F1F1F] hover:bg-[#1F1F1F] transition-colors">
                              <td className="px-4 py-3">
                                <p className="text-white text-xs font-medium">#{b.booking_number ?? b.id.slice(0,8)}</p>
                                <p className="text-[#444] text-[11px]">{(b.guest as UserProfile)?.name ?? '—'}</p>
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell text-[#666] text-xs line-clamp-1">
                                {(b.property as Property)?.name ?? '—'}
                              </td>
                              <td className="px-4 py-3 hidden lg:table-cell text-[#666] text-xs">
                                {(b.owner as UserProfile)?.name ?? '—'}
                              </td>
                              <td className="px-4 py-3 text-white text-xs font-semibold">{formatCurrency(repasse)}</td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  b.status === 'CONCLUIDA' ? 'bg-[#46D369]/10 text-[#46D369]' : 'bg-[#F5A623]/10 text-[#F5A623]'
                                }`}>
                                  {b.status === 'CONCLUIDA' ? 'PRONTO' : 'BLOQUEADO'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {b.status === 'CONCLUIDA' && (
                                  <button onClick={() => liberarRepasse(b.id)}
                                    className="text-[10px] font-bold px-2 py-1 bg-[#46D369]/10 border border-[#46D369]/30 text-[#46D369] rounded hover:bg-[#46D369]/20 transition-colors whitespace-nowrap"
                                  >
                                    LIBERAR MANUAL
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                        {repasses.length === 0 && (
                          <tr><td colSpan={6} className="text-center py-12 text-[#333]">Nenhum repasse pendente</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─────────────── SINISTROS ─────────────── */}
          {tab === 'sinistros' && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-white">Sinistros / Reclamações</h2>
              {loadingTab ? <Skeleton /> : sinistros.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <FileWarning size={48} className="text-[#2A2A2A] mb-4" />
                  <p className="text-[#444] text-sm">Nenhum sinistro registrado</p>
                  <p className="text-[#333] text-xs mt-1">Sinistros reportados pelos hóspedes aparecerão aqui</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sinistros.map((s, i) => (
                    <div key={String(s.id ?? i)} className="bg-[#1A1A1A] border border-[#222] rounded-xl p-5 flex gap-4">
                      {s.photo ? (
                        <img src={String(s.photo)} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-[#222]" />
                      ) : null}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-white font-medium text-sm">{String(s.property_name ?? '—')}</p>
                            <p className="text-[#444] text-xs">Reserva #{String(s.booking_number ?? '—')}</p>
                          </div>
                          <div className="flex gap-2">
                            <button className="text-[10px] font-bold px-2 py-1 border border-[#333] text-[#666] rounded hover:text-white hover:border-[#555] transition-colors">
                              VER DETALHES
                            </button>
                            <button className="text-[10px] font-bold px-2 py-1 bg-[#46D369]/10 border border-[#46D369]/30 text-[#46D369] rounded hover:bg-[#46D369]/20 transition-colors">
                              APROVAR
                            </button>
                          </div>
                        </div>
                        <p className="text-[#666] text-xs mt-2 line-clamp-2">{String(s.description ?? '')}</p>
                        <p className="text-[#F5A623] text-xs font-semibold mt-1">{formatCurrency(Number(s.amount ?? 0))}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─────────────── CONFIGURAÇÕES ─────────────── */}
          {tab === 'config' && (
            <div className="space-y-5 max-w-2xl">
              <div className="bg-[#1A1A1A] border border-[#222] rounded-xl p-6">
                <h3 className="text-sm font-semibold text-white mb-4">Configurações da Plataforma</h3>
                <div className="space-y-1">
                  <CfgRow label="Taxa da plataforma"    desc="Percentual cobrado sobre cada reserva"    val="5%" />
                  <CfgRow label="Seguro básico"         desc="Valor por noite — plano básico"            val="R$ 5,00/noite" />
                  <CfgRow label="Seguro padrão"         desc="Valor por noite — plano padrão"            val="R$ 12,00/noite" />
                  <CfgRow label="Seguro premium"        desc="Valor por noite — plano premium"           val="R$ 25,00/noite" />
                </div>
              </div>
              <div className="bg-[#1A1A1A] border border-[#222] rounded-xl p-6">
                <h3 className="text-sm font-semibold text-white mb-4">Políticas de Cancelamento</h3>
                <div className="space-y-0">
                  {[
                    { name:'Flexível',  desc:'Reembolso total até 24h antes do check-in.' },
                    { name:'Moderado',  desc:'Reembolso total até 5 dias. 50% entre 2-5 dias.' },
                    { name:'Firme',     desc:'Reembolso total até 14 dias. 50% entre 7-14 dias.' },
                  ].map(p => (
                    <div key={p.name} className="flex items-start justify-between gap-4 py-3 border-b border-[#1F1F1F] last:border-0">
                      <div>
                        <p className="text-sm font-medium text-white">{p.name}</p>
                        <p className="text-xs text-[#444] mt-0.5">{p.desc}</p>
                      </div>
                      <span className="text-[10px] font-bold text-[#46D369] bg-[#46D369]/10 px-2 py-0.5 rounded mt-0.5 flex-shrink-0">ATIVO</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-[#1A1A1A] border border-[#222] rounded-xl p-6">
                <h3 className="text-sm font-semibold text-white mb-4">Informações do Sistema</h3>
                <div className="space-y-0 text-xs">
                  {[
                    { k:'Versão',        v:'1.0.0',    color:'text-white' },
                    { k:'Base de dados', v:'Conectada', color:'text-[#46D369]' },
                    { k:'Realtime',      v:'Online',    color:'text-[#46D369]' },
                    { k:'Armazenamento', v:'Supabase',  color:'text-white' },
                  ].map(row => (
                    <div key={row.k} className="flex justify-between py-2.5 border-b border-[#1F1F1F] last:border-0">
                      <span className="text-[#444]">{row.k}</span>
                      <span className={`font-medium ${row.color}`}>{row.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}

// ── Sub-components

function KpiCard({ label, value, sub, icon, accent, green, danger }: {
  label: string; value: string | number; sub?: string; icon: React.ReactNode
  accent?: boolean; green?: boolean; danger?: boolean
}) {
  const color = danger ? 'text-[#E50914]' : green ? 'text-[#46D369]' : accent ? 'text-[#E50914]' : 'text-white'
  const iconColor = danger ? 'text-[#E50914]' : green ? 'text-[#46D369]' : accent ? 'text-[#E50914]' : 'text-[#333]'
  return (
    <div className="bg-[#1A1A1A] border border-[#222] rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-[#444] uppercase tracking-wide font-medium">{label}</span>
        <span className={iconColor}>{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[#333] text-[11px] mt-0.5">{sub}</p>}
    </div>
  )
}

function PropBadge({ status }: { status: string }) {
  const m: Record<string,string> = {
    ATIVO:'bg-[#46D369]/10 text-[#46D369]', PENDENTE:'bg-[#F5A623]/10 text-[#F5A623]',
    INATIVO:'bg-[#2A2A2A] text-[#555]',     REPROVADO:'bg-[#E50914]/10 text-[#E50914]',
  }
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${m[status] ?? m.PENDENTE}`}>{status}</span>
}

function KycBadge({ status }: { status: string }) {
  const m: Record<string,string> = {
    APROVADO:'bg-[#46D369]/10 text-[#46D369]', PENDENTE:'bg-[#F5A623]/10 text-[#F5A623]',
    REPROVADO:'bg-[#E50914]/10 text-[#E50914]', INCOMPLETO:'bg-[#2A2A2A] text-[#555]',
  }
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${m[status] ?? 'bg-[#2A2A2A] text-[#555]'}`}>{status}</span>
}

function RoleBadge({ role }: { role: string }) {
  const m: Record<string,string> = {
    ADMIN:'bg-[#E50914]/20 text-[#E50914]', OWNER:'bg-[#F5A623]/20 text-[#F5A623]', GUEST:'bg-[#2A2A2A] text-[#555]',
  }
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${m[role] ?? 'bg-[#2A2A2A] text-[#555]'}`}>{role}</span>
}

function InstallBadge({ status }: { status: string }) {
  const m: Record<string,string> = {
    PAGO:'bg-[#46D369]/10 text-[#46D369]', PENDENTE:'bg-[#F5A623]/10 text-[#F5A623]',
    ATRASADO:'bg-[#E50914]/10 text-[#E50914]', CANCELADO:'bg-[#2A2A2A] text-[#555]',
  }
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${m[status] ?? 'bg-[#2A2A2A] text-[#555]'}`}>{status}</span>
}

function CfgRow({ label, desc, val }: { label: string; desc: string; val: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#1F1F1F] last:border-0">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-[#444] mt-0.5">{desc}</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-sm font-semibold text-[#E50914]">{val}</span>
        <button className="text-xs text-[#444] hover:text-white transition-colors">Editar</button>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[1,2,3,4].map(i => (
        <div key={i} className="bg-[#1A1A1A] border border-[#222] rounded-xl p-4 animate-pulse">
          <div className="h-4 bg-[#222] rounded w-1/3 mb-2" />
          <div className="h-3 bg-[#1F1F1F] rounded w-2/3" />
        </div>
      ))}
    </div>
  )
}
