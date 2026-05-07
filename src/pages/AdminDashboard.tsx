import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Users, Home, DollarSign, TrendingUp, Check, X, ShieldCheck, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Property, UserProfile, AdminKPIs } from '../types'
import { DashboardLayout } from '../components/layout/DashboardLayout'
import { Card, StatCard } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useToast } from '../hooks/useToast'
import { formatCurrency, formatShortDate } from '../lib/utils'

const NAV = [
  { label: 'KPIs', icon: <TrendingUp size={16} />, href: '/admin' },
  { label: 'Imóveis', icon: <Home size={16} />, href: '/admin?tab=imoveis' },
  { label: 'Usuários', icon: <Users size={16} />, href: '/admin?tab=usuarios' },
  { label: 'KYC', icon: <ShieldCheck size={16} />, href: '/admin?tab=kyc' },
  { label: 'Pagamentos', icon: <DollarSign size={16} />, href: '/admin?tab=pagamentos' },
]

export function AdminDashboard() {
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'kpis'
  const { toast } = useToast()

  const [kpis, setKpis] = useState<AdminKPIs | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [kycPending, setKycPending] = useState<UserProfile[]>([])
  const [_loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState<{ month: string; gmv: number; revenue: number }[]>([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [
      { data: allProperties },
      { data: allUsers },
      { data: allBookings },
      { data: kycUsers },
    ] = await Promise.all([
      supabase.from('properties').select('*').order('created_at', { ascending: false }),
      supabase.from('users').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('bookings').select('total_price, platform_fee, status, created_at').limit(500),
      supabase.from('users').select('*').eq('kyc_status', 'PENDENTE').limit(50),
    ])

    const propsData = (allProperties ?? []) as Property[]
    const usersData = (allUsers ?? []) as UserProfile[]
    const booksData = allBookings ?? []

    setProperties(propsData)
    setUsers(usersData)
    setKycPending((kycUsers ?? []) as UserProfile[])

    const gmv = booksData.reduce((s: number, b: { total_price: number; status: string }) => ['PAGO','CONCLUIDA','PARCIAL'].includes(b.status) ? s + b.total_price : s, 0)
    const revenue = booksData.reduce((s: number, b: { platform_fee: number; status: string }) => ['PAGO','CONCLUIDA','PARCIAL'].includes(b.status) ? s + b.platform_fee : s, 0)

    setKpis({
      gmv,
      platform_revenue: revenue,
      total_bookings: booksData.length,
      active_users: usersData.filter(u => u.kyc_status === 'APROVADO').length,
      active_properties: propsData.filter(p => p.status === 'ATIVO').length,
      pending_kyc: (kycUsers ?? []).length,
      pending_properties: propsData.filter(p => p.status === 'PENDENTE').length,
      conversion_rate: booksData.length > 0 ? Math.round((booksData.filter((b: { status: string }) => b.status !== 'CANCELADA').length / booksData.length) * 100) : 0,
    })

    // Build monthly chart data from bookings
    const monthMap: Record<string, { gmv: number; revenue: number }> = {}
    booksData.forEach((b: { total_price: number; platform_fee: number; status: string; created_at: string }) => {
      if (!['PAGO','CONCLUIDA','PARCIAL'].includes(b.status)) return
      const month = b.created_at?.slice(0, 7) ?? ''
      if (!monthMap[month]) monthMap[month] = { gmv: 0, revenue: 0 }
      monthMap[month].gmv += b.total_price
      monthMap[month].revenue += b.platform_fee
    })
    setChartData(Object.entries(monthMap).sort(([a],[b]) => a.localeCompare(b)).slice(-6).map(([month, v]) => ({ month, ...v })))
    setLoading(false)
  }

  async function approveProperty(id: string) {
    const { error } = await supabase.from('properties').update({ status: 'ATIVO' }).eq('id', id)
    if (error) { toast('error', 'Erro', error.message); return }
    setProperties(prev => prev.map(p => p.id === id ? { ...p, status: 'ATIVO' } : p))
    toast('success', 'Imóvel aprovado')
  }

  async function rejectProperty(id: string) {
    const { error } = await supabase.from('properties').update({ status: 'REPROVADO' }).eq('id', id)
    if (error) { toast('error', 'Erro', error.message); return }
    setProperties(prev => prev.map(p => p.id === id ? { ...p, status: 'REPROVADO' } : p))
    toast('info', 'Imóvel reprovado')
  }

  async function approveKYC(uid: string) {
    await supabase.from('users').update({ kyc_status: 'APROVADO' }).eq('id', uid)
    setKycPending(prev => prev.filter(u => u.id !== uid))
    toast('success', 'KYC aprovado')
  }

  async function rejectKYC(uid: string) {
    await supabase.from('users').update({ kyc_status: 'REPROVADO' }).eq('id', uid)
    setKycPending(prev => prev.filter(u => u.id !== uid))
    toast('info', 'KYC reprovado')
  }

  const pendingProperties = properties.filter(p => p.status === 'PENDENTE')

  return (
    <DashboardLayout title="Admin" navItems={NAV}>
      {/* KPIs */}
      {(tab === 'kpis' || !tab) && (
        <div className="space-y-8">
          {kpis && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="GMV Total" value={formatCurrency(kpis.gmv)} icon={<TrendingUp size={18} />} accent />
                <StatCard label="Receita plataforma" value={formatCurrency(kpis.platform_revenue)} icon={<DollarSign size={18} />} accent />
                <StatCard label="Total reservas" value={kpis.total_bookings} icon={<DollarSign size={18} />} />
                <StatCard label="Conversão" value={`${kpis.conversion_rate}%`} icon={<TrendingUp size={18} />} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Usuários ativos" value={kpis.active_users} icon={<Users size={18} />} />
                <StatCard label="Imóveis ativos" value={kpis.active_properties} icon={<Home size={18} />} />
                <StatCard label="KYC pendente" value={kpis.pending_kyc} icon={<ShieldCheck size={18} />} />
                <StatCard label="Imóveis pendentes" value={kpis.pending_properties} icon={<AlertTriangle size={18} />} />
              </div>
            </>
          )}

          {/* Revenue chart */}
          {chartData.length > 0 && (
            <Card className="p-6">
              <h3 className="font-display text-lg font-bold text-white mb-4">GMV vs Receita (últimos 6 meses)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => formatCurrency(v).replace('R$', '')} />
                  <Tooltip
                    contentStyle={{ background: '#1F1F1F', border: '1px solid #333', borderRadius: 8 }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(val) => formatCurrency(Number(val ?? 0))}
                  />
                  <Bar dataKey="gmv" name="GMV" fill="#E50914" radius={[4,4,0,0]} />
                  <Bar dataKey="revenue" name="Receita" fill="#F5A623" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      )}

      {/* IMÓVEIS TAB */}
      {tab === 'imoveis' && (
        <div>
          <h2 className="font-display text-xl font-bold text-white mb-4">
            Gestão de imóveis
            {pendingProperties.length > 0 && (
              <span className="ml-2 text-sm font-normal text-[#F5A623]">({pendingProperties.length} pendentes)</span>
            )}
          </h2>
          <div className="space-y-3">
            {properties.map(p => (
              <Card key={p.id} className="p-4 flex items-center gap-4">
                <img src={p.photos[0] ?? ''} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm line-clamp-1">{p.name}</p>
                  <p className="text-xs text-[#B3B3B3]">{p.city}, {p.state}</p>
                  <PropertyStatusBadge status={p.status} />
                </div>
                {p.status === 'PENDENTE' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" onClick={() => approveProperty(p.id)} className="gap-1.5 bg-[#46D369] hover:bg-green-500">
                      <Check size={13} /> Aprovar
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => rejectProperty(p.id)} className="gap-1.5">
                      <X size={13} /> Reprovar
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* USUÁRIOS TAB */}
      {tab === 'usuarios' && (
        <div>
          <h2 className="font-display text-xl font-bold text-white mb-4">Usuários ({users.length})</h2>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[#666] text-xs border-b border-[#333]">
                    <th className="text-left p-3">Nome</th>
                    <th className="text-left p-3">E-mail</th>
                    <th className="text-left p-3">Role</th>
                    <th className="text-left p-3">KYC</th>
                    <th className="text-left p-3">Cadastro</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-[#1F1F1F] hover:bg-[#2A2A2A]/50 transition-colors">
                      <td className="p-3 text-white font-medium">{u.name ?? '—'}</td>
                      <td className="p-3 text-[#B3B3B3]">{u.email}</td>
                      <td className="p-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${u.role === 'ADMIN' ? 'bg-[#E50914]/20 text-[#E50914]' : u.role === 'OWNER' ? 'bg-[#F5A623]/20 text-[#F5A623]' : 'bg-[#333] text-[#B3B3B3]'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3">
                        <KYCBadge status={u.kyc_status} />
                      </td>
                      <td className="p-3 text-[#666] text-xs">{formatShortDate(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* KYC TAB */}
      {tab === 'kyc' && (
        <div>
          <h2 className="font-display text-xl font-bold text-white mb-4">
            KYC pendente ({kycPending.length})
          </h2>
          {kycPending.length === 0 ? (
            <div className="text-center py-16">
              <ShieldCheck size={48} className="mx-auto text-[#46D369] mb-4" />
              <p className="text-[#B3B3B3]">Nenhum KYC pendente.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {kycPending.map(u => (
                <Card key={u.id} className="p-5">
                  <div className="flex items-start gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold text-white">{u.name ?? '—'}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          u.role === 'OWNER' ? 'bg-[#F5A623]/20 text-[#F5A623]' : 'bg-[#333] text-[#B3B3B3]'
                        }`}>{u.role}</span>
                      </div>
                      <p className="text-xs text-[#B3B3B3]">{u.email}</p>
                      <p className="text-xs text-[#666] mt-0.5">
                        CPF: {u.cpf ? `${u.cpf.slice(0,3)}.***.***-${u.cpf.slice(9)}` : '—'}
                        {' · '}Enviado em: {formatShortDate(u.created_at)}
                      </p>

                      {/* Documents */}
                      <div className="flex flex-wrap gap-3 mt-3">
                        {u.document_url && (
                          <a href={u.document_url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-400 hover:underline">
                            <ShieldCheck size={11} /> RG / CNH
                          </a>
                        )}
                        {u.address_proof_url && (
                          <a href={u.address_proof_url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-400 hover:underline">
                            <ShieldCheck size={11} /> Comprovante endereço
                          </a>
                        )}
                        {u.actual_owner_document_url && (
                          <a href={u.actual_owner_document_url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-400 hover:underline">
                            <ShieldCheck size={11} /> Doc. proprietário
                          </a>
                        )}
                        {u.kinship_document_url && (
                          <a href={u.kinship_document_url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-400 hover:underline">
                            <ShieldCheck size={11} /> Doc. parentesco
                          </a>
                        )}
                      </div>

                      {/* Third-party ownership details */}
                      {u.ownership_type === 'TERCEIRO' && (
                        <div className="mt-3 pl-3 border-l-2 border-[#F5A623]/40 space-y-0.5">
                          <p className="text-[10px] text-[#F5A623] font-semibold uppercase tracking-wide">Imóvel de terceiros</p>
                          <p className="text-xs text-[#B3B3B3]">
                            Proprietário: <span className="text-white">{u.actual_owner_name ?? '—'}</span>
                          </p>
                          <p className="text-xs text-[#B3B3B3]">
                            CPF proprietário: <span className="text-white">{u.actual_owner_cpf ?? '—'}</span>
                          </p>
                          <p className="text-xs text-[#B3B3B3]">
                            Vínculo: <span className="text-white">{u.kinship_type ?? '—'}</span>
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" onClick={() => approveKYC(u.id)} className="bg-[#46D369] hover:bg-green-500 gap-1">
                        <Check size={13} /> Aprovar
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => rejectKYC(u.id)} className="gap-1">
                        <X size={13} /> Reprovar
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PAGAMENTOS TAB */}
      {tab === 'pagamentos' && (
        <div>
          <h2 className="font-display text-xl font-bold text-white mb-4">Pagamentos</h2>
          <p className="text-[#B3B3B3] text-sm">Histórico de installments será exibido aqui.</p>
        </div>
      )}
    </DashboardLayout>
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

function KYCBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    APROVADO: 'text-[#46D369]',
    PENDENTE: 'text-[#F5A623]',
    REPROVADO: 'text-[#E50914]',
    INCOMPLETO: 'text-[#B3B3B3]',
  }
  return <span className={`text-xs font-medium ${map[status] ?? 'text-[#B3B3B3]'}`}>{status}</span>
}
