import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronRight, FileText, CreditCard, User, AlertTriangle, ShieldCheck, Calendar, MessageSquare } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Property, CheckoutFormData, InstallmentPreview, InstallmentPaymentResponse, CancellationPolicy, PricePeriod } from '../types'
import { CANCELLATION_POLICIES, APP_ROUTES } from '../constants'
import { MOCK_PROPERTIES } from '../constants/mocks'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { PaymentModal } from '../components/ui/PaymentModal'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import {
  formatCurrency, calculateInstallments, calculateMaxInstallments,
  calculatePlatformFee, formatDate,
} from '../lib/utils'
import { calcularEstadia, type EstadiaResult } from '../lib/pricing'
import { calcularReserva } from '../lib/financeiro'
import { generateContractContent } from '../lib/contractTemplate'
import { format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface PolicyDeadline {
  label: string
  date: Date
  refundPercent: number
  color: string
}

function calcPolicyDeadlines(policy: CancellationPolicy | undefined, checkIn: string): PolicyDeadline[] {
  if (!checkIn || !policy) return []
  const ci = new Date(checkIn + 'T12:00:00')
  const fmt = (d: Date) => d
  switch (policy) {
    case 'LEVE':
      return [
        { label: 'Reembolso total', date: fmt(subDays(ci, 2)), refundPercent: 100, color: '#46D369' },
        { label: 'Sem reembolso', date: fmt(ci), refundPercent: 0, color: '#E50914' },
      ]
    case 'MODERADO':
      return [
        { label: 'Reembolso total', date: fmt(subDays(ci, 15)), refundPercent: 100, color: '#46D369' },
        { label: 'Sem reembolso', date: fmt(ci), refundPercent: 0, color: '#E50914' },
      ]
    case 'FIRME':
      return [
        { label: 'Reembolso total', date: fmt(subDays(ci, 30)), refundPercent: 100, color: '#46D369' },
        { label: 'Sem reembolso', date: fmt(ci), refundPercent: 0, color: '#E50914' },
      ]
    default:
      return []
  }
}

const STEPS = [
  { id: 1, label: 'Política', icon: <AlertTriangle size={14} /> },
  { id: 2, label: 'Dados', icon: <User size={14} /> },
  { id: 3, label: 'Contrato', icon: <FileText size={14} /> },
  { id: 4, label: 'Pagamento', icon: <CreditCard size={14} /> },
]

export function Checkout() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { toast } = useToast()

  const [step, setStep] = useState(1)
  const [property, setProperty] = useState<Property | null>(null)
  const [pricePeriods, setPricePeriods] = useState<PricePeriod[]>([])
  const [estadiaResult, setEstadiaResult] = useState<EstadiaResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [ipAddress, setIpAddress] = useState('0.0.0.0')
  const [installmentCount, setInstallmentCount] = useState(1)
  const [installmentPreviews, setInstallmentPreviews] = useState<InstallmentPreview[]>([])
  const [paymentData, setPaymentData] = useState<InstallmentPaymentResponse | null>(null)
  const [paymentModalOpen2, setPaymentModalOpen2] = useState(false)
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [paid, setPaid] = useState(false)

  const checkIn = searchParams.get('entrada') ?? ''
  const checkOut = searchParams.get('saida') ?? ''
  const guestsParam = Number(searchParams.get('hospedes') ?? 2)

  const nights = checkIn && checkOut
    ? Math.max(0, Math.floor((new Date(checkOut + 'T00:00:00').getTime() - new Date(checkIn + 'T00:00:00').getTime()) / 86400000))
    : 0

  const [form, setForm] = useState<CheckoutFormData>({
    policy_accepted: false,
    name: profile?.name ?? '',
    cpf: profile?.cpf ?? '',
    birth_date: profile?.birth_date ?? '',
    phone: profile?.phone ?? '',
    address: profile?.address ?? '',
    number: profile?.number ?? '',
    complement: profile?.complement ?? '',
    city: profile?.city ?? '',
    state: profile?.state ?? '',
    cep: profile?.cep ?? '',
    contract_accepted: false,
    payment_method: 'PIX',
    installments_count: 1,
  })

  useEffect(() => {
    if (!id) return
    loadProperty(id)
    fetchIp()
  }, [id])

  // Load persisted personal data from previous checkout
  useEffect(() => {
    if (!user?.id) return
    try {
      const saved = localStorage.getItem(`locaflix_checkout_${user.id}`)
      if (saved) {
        const { name, cpf, birth_date, phone, address, number, complement, city, state, cep } = JSON.parse(saved)
        setForm(f => ({ ...f, name: name || f.name, cpf: cpf || f.cpf, birth_date: birth_date || f.birth_date, phone: phone || f.phone, address: address || f.address, number: number || f.number, complement: complement || f.complement, city: city || f.city, state: state || f.state, cep: cep || f.cep }))
      }
    } catch { /* ignore */ }
  }, [user?.id])

  useEffect(() => {
    if (profile) {
      setForm(f => ({
        ...f,
        name: profile.name ?? f.name,
        cpf: profile.cpf ?? f.cpf,
        birth_date: profile.birth_date ?? f.birth_date,
        phone: profile.phone ?? f.phone,
        address: profile.address ?? f.address,
        number: profile.number ?? f.number,
        city: profile.city ?? f.city,
        state: profile.state ?? f.state,
        cep: profile.cep ?? f.cep,
      }))
    }
  }, [profile])

  useEffect(() => {
    if (!checkIn || !checkOut || !property || nights <= 0) return
    const ci = new Date(checkIn + 'T00:00:00')
    const co = new Date(checkOut + 'T00:00:00')
    const result = calcularEstadia(ci, co, pricePeriods, property.price_per_night)
    setEstadiaResult(result)
    const financeiro = calcularReserva(result.total / Math.max(nights, 1), nights, 0, 'dividido')
    setInstallmentPreviews(calculateInstallments(financeiro.totalPagoPeloHospede, installmentCount, checkIn))
  }, [installmentCount, property, checkIn, checkOut, nights, pricePeriods])

  async function loadProperty(pid: string) {
    const [{ data: propData }, { data: periodsData }] = await Promise.all([
      supabase.from('properties').select('*').eq('id', pid).single(),
      supabase.from('price_periods').select('*').eq('property_id', pid).eq('active', true).order('priority', { ascending: false }),
    ])
    // Fetch owner separately using owner_id
    let ownerData = null
    if (propData?.owner_id) {
      const { data } = await supabase.from('users').select('id, name').eq('id', propData.owner_id).single()
      ownerData = data
    }
    const resolved = propData
      ? ({ ...propData, owner: ownerData ?? undefined } as Property)
      : (MOCK_PROPERTIES.find(p => p.id === pid) ?? null)
    setProperty(resolved)
    setPricePeriods((periodsData ?? []) as PricePeriod[])
    setLoading(false)
  }

  async function fetchIp() {
    try {
      const res = await fetch('/api/client-ip')
      const data = await res.json()
      setIpAddress(data.ip ?? '0.0.0.0')
    } catch {
      setIpAddress('unknown')
    }
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
          city: data.localidade ?? f.city,
          state: data.uf ?? f.state,
        }))
      }
    } catch { /* ignore */ }
  }

  function upd(k: keyof CheckoutFormData, v: unknown) {
    setForm(f => {
      const next = { ...f, [k]: v }
      // Persist personal data to reuse in future checkouts
      if (user?.id) {
        const { name, cpf, birth_date, phone, address, number, complement, city, state, cep } = next
        localStorage.setItem(`locaflix_checkout_${user.id}`, JSON.stringify({ name, cpf, birth_date, phone, address, number, complement, city, state, cep }))
      }
      return next
    })
  }

  function canAdvance() {
    if (step === 1) return form.policy_accepted
    if (step === 2) return !!(form.name && form.cpf && form.birth_date && form.phone && form.address && form.number && form.city && form.state && form.cep)
    if (step === 3) return form.contract_accepted
    return true
  }

  function next() {
    if (!canAdvance()) { toast('warning', 'Campos obrigatórios', 'Preencha todos os campos para continuar.'); return }
    if (step < 4) setStep(s => s + 1)
    else setPaymentModalOpen(true)
  }

  async function confirmBooking() {
    if (!property || !user) return
    setSaving(true)

    const isMock = MOCK_PROPERTIES.some(p => p.id === property.id)

    try {
      const ci = new Date(checkIn + 'T00:00:00')
      const co = new Date(checkOut + 'T00:00:00')
      const estadia = calcularEstadia(ci, co, pricePeriods, property.price_per_night)
      const fin = calcularReserva(estadia.total / Math.max(nights, 1), nights, 0, 'dividido')
      const subtotal = fin.subtotalBase
      const platform_fee = fin.valorTaxaHospede
      const total_price = fin.totalPagoPeloHospede
      const previews = calculateInstallments(total_price, installmentCount, checkIn)

      let firstInstallmentId: string | undefined

      if (!isMock) {
        // Real property: persist booking, installments and contract in DB
        const { data: booking, error } = await supabase.from('bookings').insert({
          property_id: property.id,
          guest_id: user.id,
          owner_id: property.owner_id,
          check_in: checkIn,
          check_out: checkOut,
          nights,
          total_guests: guestsParam,
          subtotal,
          platform_fee,
          discount_amount: 0,
          total_price,
          status: 'AGUARDANDO_PAGAMENTO',
        }).select().single()

        if (error || !booking) throw new Error(error?.message ?? 'Erro ao criar reserva')

        const { data: installments } = await supabase.from('installments').insert(
          previews.map(p => ({
            booking_id: booking.id,
            number: p.number,
            value: p.value,
            due_date: p.due_date,
            type: p.type,
            status: 'PENDENTE',
          }))
        ).select()

        const contractContent = generateContractContent({
          booking: { ...booking, property },
          guest: profile!,
          owner: property.owner as any ?? { name: 'Anfitrião', cpf: '' },
          ipAddress,
          userAgent: navigator.userAgent,
        })
        await supabase.from('contracts').insert({
          booking_id: booking.id,
          guest_id: user.id,
          owner_id: property.owner_id,
          content: contractContent,
          ip_address: ipAddress,
          user_agent: navigator.userAgent,
          accepted_at: new Date().toISOString(),
        })

        // Notify guest about the new booking
        await supabase.from('notifications').insert({
          user_id: user.id,
          title: 'Reserva criada com sucesso!',
          message: `Sua reserva para ${property.name} foi criada. Aguardando confirmação do pagamento.`,
          type: 'BOOKING',
        })

        firstInstallmentId = installments?.[0]?.id
      }
      // Mock properties skip DB writes — Pix is still called to test Asaas sandbox

      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token ?? ''

      const payRes = await fetch('/api/payments/create-installments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          customer: {
            name: form.name,
            cpf: form.cpf,
            email: user.email,
            phone: form.phone,
          },
          value: previews[0].value,
          dueDate: previews[0].due_date,
          description: `Locaflix - ${property.name} - Parcela 1${isMock ? ' [SANDBOX TEST]' : ''}`,
          externalReference: firstInstallmentId ? `installment:${firstInstallmentId}` : `sandbox:${Date.now()}`,
          installment_id: firstInstallmentId,
        }),
      })

      if (!payRes.ok) {
        const err = await payRes.json()
        const msg = err.error ?? 'Erro ao gerar cobrança'
        if (isMock) {
          toast('error', 'Erro Asaas (sandbox)', msg)
        } else {
          toast('warning', 'Reserva criada, mas pagamento falhou', `${msg}. Acesse "Minhas reservas" para tentar novamente.`)
          navigate(APP_ROUTES.GUEST_DASHBOARD + '?tab=reservas', { replace: true })
        }
        setPaymentModalOpen(false)
        return
      }

      const paymentResult: InstallmentPaymentResponse = await payRes.json()
      setPaymentData(paymentResult)
      setPaymentModalOpen(false)
      setPaymentModalOpen2(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar reserva.'
      toast('error', 'Erro', msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleCheckPayment() {
    if (!paymentData) return
    setCheckingPayment(true)
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token ?? ''

      const res = await fetch(`/api/payments/${paymentData.pix.payment_id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const payment = await res.json()

      if (payment.status === 'CONFIRMED' || payment.status === 'RECEIVED') {
        setPixModalOpen(false)
        setPaid(true)
      } else {
        toast('warning', 'Pagamento pendente', 'Ainda não identificamos o pagamento. Tente novamente em alguns instantes.')
      }
    } catch (err: unknown) {
      toast('error', 'Erro', err instanceof Error ? err.message : 'Erro ao verificar pagamento.')
    } finally {
      setCheckingPayment(false)
    }
  }

  if (paid) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-[#46D369]/20 rounded-full flex items-center justify-center mx-auto mb-5">
            <Check size={32} className="text-[#46D369]" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white mb-2">Reserva confirmada!</h1>
          <p className="text-[#B3B3B3] text-sm mb-8">
            Pagamento processado com sucesso. Você receberá os detalhes por e-mail.
          </p>
          <div className="space-y-3">
            <Link to={APP_ROUTES.MESSAGES}>
              <Button fullWidth className="gap-2">
                <MessageSquare size={16} />
                Falar com anfitrião
              </Button>
            </Link>
            <Link to={`${APP_ROUTES.GUEST_DASHBOARD}?tab=reservas`}>
              <Button variant="ghost" fullWidth>
                Ver minhas reservas
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (loading || !property) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // KYC gate — only block real properties; allow mock demos through
  const isMockForGate = MOCK_PROPERTIES.some(p => p.id === property.id)
  if (!isMockForGate && profile && profile.kyc_status !== 'APROVADO') {
    return <KYCGate status={profile.kyc_status ?? 'INCOMPLETO'} />
  }

  const subtotalDiarias = estadiaResult?.total ?? property.price_per_night * nights
  const financeiro = calcularReserva(subtotalDiarias / Math.max(nights, 1), nights, 0, 'dividido')
  const subtotal = financeiro.subtotalBase
  const fee = financeiro.valorTaxaHospede
  const total = financeiro.totalPagoPeloHospede
  const maxInstallments = checkIn ? calculateMaxInstallments(checkIn) : 1
  const isMock = MOCK_PROPERTIES.some(p => p.id === property.id)

  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="font-display text-2xl font-bold text-white mb-6">Finalizar reserva</h1>

        {/* Mock warning — sandbox test mode, flow is real */}
        {isMock && (
          <div className="flex items-start gap-3 bg-[#46D369]/10 border border-[#46D369]/30 rounded-xl px-4 py-3 mb-6">
            <AlertTriangle size={16} className="text-[#46D369] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#46D369]">
              Imóvel de demonstração em <strong>modo sandbox</strong>. O fluxo completo de pagamento será testado com dados do Asaas sandbox.
            </p>
          </div>
        )}

        {/* Steps */}
        <div className="flex items-center mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                  step > s.id ? 'bg-[#46D369] border-[#46D369] text-white'
                  : step === s.id ? 'bg-[#E50914] border-[#E50914] text-white'
                  : 'bg-transparent border-[#444] text-[#444]'
                }`}>
                  {step > s.id ? <Check size={14} /> : s.icon}
                </div>
                <span className={`text-[10px] mt-1 font-medium hidden sm:block ${step >= s.id ? 'text-white' : 'text-[#444]'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 transition-colors ${step > s.id ? 'bg-[#46D369]' : 'bg-[#333]'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main step content */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="bg-[#1F1F1F] border border-[#333] rounded-2xl p-6"
              >
                {/* STEP 1 */}
                {step === 1 && (
                  <div>
                    <h2 className="font-display text-xl font-bold text-white mb-4">Política de cancelamento</h2>
                    {(() => {
                      const pol = CANCELLATION_POLICIES.find(p => p.value === property.cancellation_policy)
                      const deadlines = calcPolicyDeadlines(property.cancellation_policy, checkIn)
                      return (
                        <>
                          <div className="bg-[#2A2A2A] rounded-xl p-4 mb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-white font-semibold">{pol?.label ?? 'Política padrão'}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                property.cancellation_policy === 'LEVE' ? 'bg-[#46D369]/20 text-[#46D369]'
                                : property.cancellation_policy === 'MODERADO' ? 'bg-[#F5A623]/20 text-[#F5A623]'
                                : 'bg-[#E50914]/20 text-[#E50914]'
                              }`}>
                                {property.cancellation_policy ?? 'PADRÃO'}
                              </span>
                            </div>
                            <p className="text-sm text-[#B3B3B3]">{pol?.description ?? 'Consulte o anfitrião para condições de cancelamento.'}</p>
                          </div>

                          {deadlines.length > 0 && checkIn && (
                            <div className="mb-5">
                              <p className="text-xs font-semibold text-[#B3B3B3] uppercase tracking-wide mb-3 flex items-center gap-2">
                                <Calendar size={13} /> Prazos para o seu check-in ({format(new Date(checkIn + 'T00:00:00'), "dd 'de' MMMM", { locale: ptBR })})
                              </p>
                              <div className="space-y-2">
                                {deadlines.map((d, i) => (
                                  <div key={i} className="flex items-center justify-between bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                                      <div>
                                        <p className="text-xs font-semibold" style={{ color: d.color }}>{d.label}</p>
                                        <p className="text-xs text-[#666]">
                                          {d.refundPercent > 0
                                            ? `Cancele até ${format(d.date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                                            : `A partir de ${format(d.date, "dd/MM/yyyy", { locale: ptBR })}`
                                          }
                                        </p>
                                      </div>
                                    </div>
                                    <span className="text-sm font-bold text-white">{d.refundPercent}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )
                    })()}
                    <div className="space-y-2 text-sm text-[#B3B3B3] mb-6 bg-[#1A1A1A] rounded-xl p-4">
                      <p>• A LOCAFLIX atua como intermediadora na relação locador-locatário.</p>
                      <p>• Taxa de serviço cobrada do hóspede sobre o valor da estadia.</p>
                      <p>• Parcelamento livre via Pix. Última parcela até 7 dias antes do check-in.</p>
                      <p>• O anfitrião é responsável pelo estado do imóvel no momento da entrega.</p>
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={form.policy_accepted}
                        onChange={e => upd('policy_accepted', e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-[#E50914] flex-shrink-0"
                      />
                      <span className="text-sm text-[#B3B3B3] group-hover:text-white transition-colors">
                        Eu li e concordo com a política de cancelamento e os termos desta reserva.
                      </span>
                    </label>
                  </div>
                )}

                {/* STEP 2 */}
                {step === 2 && (
                  <div>
                    <h2 className="font-display text-xl font-bold text-white mb-4">Dados pessoais</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input label="Nome completo" value={form.name} onChange={e => upd('name', e.target.value)} required className="sm:col-span-2" />
                      <Input
                        label="CPF"
                        value={form.cpf}
                        onChange={e => upd('cpf', e.target.value.replace(/\D/g, '').slice(0, 11))}
                        placeholder="000.000.000-00"
                        required
                      />
                      <Input
                        label="Data de nascimento"
                        type="date"
                        value={form.birth_date}
                        onChange={e => upd('birth_date', e.target.value)}
                        required
                      />
                      <Input
                        label="Telefone"
                        value={form.phone}
                        onChange={e => upd('phone', e.target.value)}
                        placeholder="(00) 00000-0000"
                        required
                        className="sm:col-span-2"
                      />
                      <Input
                        label="CEP"
                        value={form.cep}
                        onChange={e => {
                          upd('cep', e.target.value)
                          if (e.target.value.replace(/\D/g, '').length === 8) handleCEP(e.target.value)
                        }}
                        placeholder="00000-000"
                        required
                      />
                      <Input label="Endereço" value={form.address} onChange={e => upd('address', e.target.value)} required />
                      <Input label="Número" value={form.number} onChange={e => upd('number', e.target.value)} required />
                      <Input label="Complemento" value={form.complement} onChange={e => upd('complement', e.target.value)} />
                      <Input label="Cidade" value={form.city} onChange={e => upd('city', e.target.value)} required />
                      <Input label="Estado" value={form.state} onChange={e => upd('state', e.target.value)} required />
                    </div>
                  </div>
                )}

                {/* STEP 3 — Contract */}
                {step === 3 && (
                  <div>
                    <h2 className="font-display text-xl font-bold text-white mb-4">Contrato digital</h2>
                    <div className="bg-[#0A0A0A] border border-[#333] rounded-xl p-5 max-h-80 overflow-y-auto mb-5 text-xs text-[#B3B3B3] font-mono leading-relaxed whitespace-pre-wrap">
                      {generateContractContent({
                        booking: {
                          id: 'preview', property_id: property.id, guest_id: user!.id,
                          owner_id: property.owner_id, check_in: checkIn, check_out: checkOut,
                          nights, total_guests: guestsParam,
                          subtotal, platform_fee: fee,
                          discount_amount: 0, total_price: total, coupon_code: null,
                          status: 'AGUARDANDO_PAGAMENTO',
                          booking_number: 'LFX-PREVIEW', created_at: '', updated_at: '',
                          property,
                        },
                        guest: {
                          ...profile!,
                          name: form.name,
                          cpf: form.cpf,
                        },
                        owner: property.owner as any ?? { name: 'Anfitrião', cpf: '' },
                        ipAddress,
                        userAgent: navigator.userAgent,
                      })}
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.contract_accepted}
                        onChange={e => upd('contract_accepted', e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-[#E50914] flex-shrink-0"
                      />
                      <span className="text-sm text-[#B3B3B3]">
                        Eu li o contrato acima e assino digitalmente de acordo com a MP 2.200-2/2001 e Lei 14.063/2020.
                      </span>
                    </label>
                  </div>
                )}

                {/* STEP 4 — Payment */}
                {step === 4 && (
                  <div>
                    <h2 className="font-display text-xl font-bold text-white mb-4">Pagamento</h2>

                    <div className="mb-6">
                      <p className="text-sm font-medium text-[#B3B3B3] mb-3">Número de parcelas</p>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: maxInstallments }, (_, i) => i + 1).map(n => (
                          <button
                            key={n}
                            onClick={() => setInstallmentCount(n)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                              installmentCount === n
                                ? 'bg-[#E50914] border-[#E50914] text-white'
                                : 'border-[#333] text-[#B3B3B3] hover:border-[#555]'
                            }`}
                          >
                            {n === 1 ? 'À vista' : `${n}x`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {installmentPreviews.length > 0 && (
                      <div className="bg-[#0A0A0A] border border-[#333] rounded-xl overflow-hidden mb-5">
                        <div className="px-4 py-2 border-b border-[#333] flex items-center justify-between">
                          <p className="text-xs font-semibold text-[#B3B3B3] uppercase tracking-wide">Calendário de pagamentos</p>
                          <p className="text-xs text-[#666]">Pix ou Boleto</p>
                        </div>
                        <div className="divide-y divide-[#1F1F1F]">
                          {installmentPreviews.map(p => (
                            <div key={p.number} className="flex items-center justify-between px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${p.type === 'ENTRADA' ? 'bg-[#46D369]/20 text-[#46D369]' : 'bg-[#333] text-[#B3B3B3]'}`}>
                                  {p.type === 'ENTRADA' ? 'ENTRADA' : `Parcela ${p.number}`}
                                </span>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-white">{formatCurrency(p.value)}</p>
                                <p className="text-xs text-[#666]">Vence {formatDate(p.due_date)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-[#46D369] mb-4">
                      ✓ Última parcela vence até 7 dias antes do check-in ({checkIn ? formatDate(checkIn) : '—'}).
                    </p>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between mt-6 pt-5 border-t border-[#333]">
                  {step > 1 ? (
                    <Button variant="ghost" onClick={() => setStep(s => s - 1)}>
                      Voltar
                    </Button>
                  ) : (
                    <div />
                  )}
                  <Button onClick={next} loading={saving} className="gap-1.5">
                    {step < 4 ? (
                      <>Continuar <ChevronRight size={16} /></>
                    ) : (
                      'Confirmar e pagar'
                    )}
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Summary sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-[#1F1F1F] border border-[#333] rounded-2xl p-5 sticky top-24">
              {property.photos[0] && (
                <img src={property.photos[0]} alt="" className="w-full aspect-video object-cover rounded-xl mb-4" />
              )}
              <h3 className="font-semibold text-white text-sm leading-tight mb-1">{property.name}</h3>
              <p className="text-xs text-[#B3B3B3] mb-4">{property.city}, {property.state}</p>

              <div className="space-y-2 text-sm">
                {estadiaResult && estadiaResult.summary.length > 1 ? (
                  estadiaResult.summary.map((s, i) => (
                    <Row
                      key={i}
                      label={`${s.nights}× ${s.periodName}`}
                      value={formatCurrency(s.nights * s.pricePerNight)}
                    />
                  ))
                ) : (
                  <Row label={`${formatCurrency(property.price_per_night)} × ${nights} noites`} value={formatCurrency(subtotal)} />
                )}
                <Row label="Taxa de serviço" value={formatCurrency(fee)} />
                <div className="pt-2 border-t border-[#333] flex justify-between font-bold">
                  <span className="text-white">Total</span>
                  <span className="text-[#F5A623] text-base">{formatCurrency(total)}</span>
                </div>
                {installmentCount > 1 && (
                  <p className="text-xs text-center text-[#46D369]">
                    {installmentCount}x de {formatCurrency(total / installmentCount)} via Pix ou Boleto
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment confirmation modal */}
      <Modal open={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="Confirmar reserva" size="sm">
        <div className="space-y-4">
          <p className="text-[#B3B3B3] text-sm">
            Você está prestes a criar esta reserva. Na próxima tela, escolha pagar via Pix ou Boleto.
          </p>
          <div className="bg-[#0A0A0A] rounded-xl p-4 space-y-2 text-sm">
            <Row label="Imóvel" value={property.name} />
            <Row label="Check-in" value={checkIn} />
            <Row label="Check-out" value={checkOut} />
            <Row label="Total" value={formatCurrency(total)} accent />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" fullWidth onClick={() => setPaymentModalOpen(false)}>
              Cancelar
            </Button>
            <Button fullWidth onClick={confirmBooking} loading={saving}>
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Payment modal — Pix + Boleto */}
      <PaymentModal
        open={paymentModalOpen2}
        onClose={() => setPaymentModalOpen2(false)}
        payment={paymentData}
        onCheckPayment={handleCheckPayment}
        loading={checkingPayment}
      />
    </div>
  )
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#B3B3B3]">{label}</span>
      <span className={accent ? 'text-[#F5A623] font-bold' : 'text-white'}>{value}</span>
    </div>
  )
}

function KYCGate({ status }: { status: string }) {
  const messages: Record<string, { title: string; body: string; color: string }> = {
    INCOMPLETO: {
      title: 'Verificação de identidade necessária',
      body: 'Para finalizar uma reserva você precisa enviar seus documentos para análise. O processo leva apenas alguns minutos.',
      color: '#F5A623',
    },
    PENDENTE: {
      title: 'Documentos em análise',
      body: 'Seus documentos foram enviados e estão sendo analisados pela nossa equipe. Você será notificado assim que a verificação for concluída.',
      color: '#F5A623',
    },
    REPROVADO: {
      title: 'Verificação reprovada',
      body: 'Seus documentos não foram aprovados. Envie novamente com informações legíveis e atualizadas.',
      color: '#E50914',
    },
  }
  const cfg = messages[status] ?? messages.INCOMPLETO

  return (
    <div className="min-h-screen bg-[#141414] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: `${cfg.color}20` }}>
          <ShieldCheck size={32} style={{ color: cfg.color }} />
        </div>
        <h1 className="font-display text-2xl font-bold text-white mb-3">{cfg.title}</h1>
        <p className="text-[#B3B3B3] text-sm mb-8 leading-relaxed">{cfg.body}</p>
        <Link
          to={APP_ROUTES.GUEST_DASHBOARD + '?tab=documentos'}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#E50914] hover:bg-[#c4070f] text-white font-semibold rounded-xl transition-colors"
        >
          <ShieldCheck size={16} />
          {status === 'PENDENTE' ? 'Ver status dos documentos' : 'Enviar documentos'}
        </Link>
      </div>
    </div>
  )
}
