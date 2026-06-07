import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronRight, FileText, CreditCard, User, AlertTriangle, ShieldCheck, Lock, Calendar, MapPin, Home, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Property, CheckoutFormData, InstallmentPreview, InstallmentPaymentResponse, CancellationPolicy, PricePeriod, PaymentSetting } from '../types'
import { CANCELLATION_POLICIES, APP_ROUTES } from '../constants'
import { MOCK_PROPERTIES } from '../constants/mocks'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { PaymentModal } from '../components/ui/PaymentModal'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { usePlatformFee } from '../hooks/usePlatformFee'
import {
  formatCurrency, calculateInstallments, calculateMaxInstallments,
  formatDate,
} from '../lib/utils'
import { calcularEstadia, type EstadiaResult } from '../lib/pricing'
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
  const { guestFeePercent } = usePlatformFee()

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
  const INSTALLMENT_FEE = 1.99
  const DEFAULT_CARD_SETTINGS: PaymentSetting[] = [
    { id: 0, installments: 1, fee_percent: 0,    label: 'À vista' },
    { id: 0, installments: 2, fee_percent: 3.5,  label: '2x' },
    { id: 0, installments: 3, fee_percent: 5.2,  label: '3x' },
    { id: 0, installments: 4, fee_percent: 7.2,  label: '4x' },
    { id: 0, installments: 5, fee_percent: 9.4,  label: '5x' },
    { id: 0, installments: 6, fee_percent: 11.5, label: '6x' },
  ]
  const [paymentData, setPaymentData] = useState<InstallmentPaymentResponse | null>(null)
  const [paymentModalOpen2, setPaymentModalOpen2] = useState(false)
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [paid, setPaid] = useState(false)
  const [paymentSettings, setPaymentSettings] = useState<PaymentSetting[]>([])
  const [cardInstallments, setCardInstallments] = useState(1)
  const [cardForm, setCardForm] = useState({ holder: '', number: '', expiry: '', cvv: '' })
  const effectiveCardSettings = paymentSettings.length > 0 ? paymentSettings : DEFAULT_CARD_SETTINGS

  const checkIn = searchParams.get('entrada') ?? ''
  const checkOut = searchParams.get('saida') ?? ''
  const guestsParam = Number(searchParams.get('hospedes') ?? 2)

  const nights = checkIn && checkOut
    ? Math.max(0, Math.floor((new Date(checkOut + 'T00:00:00').getTime() - new Date(checkIn + 'T00:00:00').getTime()) / 86400000))
    : 0

  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'BOLETO' | 'CARTAO'>('PIX')

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
    fetch('/api/payment-settings')
      .then(r => r.json())
      .then((data: PaymentSetting[]) => { if (Array.isArray(data)) setPaymentSettings(data) })
      .catch(() => {})
  }, [id])

  // Auto-polling: check payment status every 5s while QR/boleto modal is open
  useEffect(() => {
    if (!paymentModalOpen2 || !paymentData) return
    const paymentId = paymentData.pix.payment_id
    let active = true

    async function poll() {
      if (!active) return
      try {
        const session = await supabase.auth.getSession()
        const token = session.data.session?.access_token ?? ''
        const res = await fetch(`/api/payments/${paymentId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        })
        const pmt = await res.json()
        if (active && (pmt.status === 'CONFIRMED' || pmt.status === 'RECEIVED')) {
          setPaymentModalOpen2(false)
          setPaid(true)
        }
      } catch { /* ignore polling errors */ }
    }

    const t1 = setTimeout(poll, 3000)
    const interval = setInterval(poll, 5000)
    return () => { active = false; clearTimeout(t1); clearInterval(interval) }
  }, [paymentModalOpen2, paymentData])

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
    if (paymentMethod === 'CARTAO') { setInstallmentPreviews([]); return }
    if (!checkIn || !checkOut || !property || nights <= 0) return
    const ci = new Date(checkIn + 'T00:00:00')
    const co = new Date(checkOut + 'T00:00:00')
    const result = calcularEstadia(ci, co, pricePeriods, property.price_per_night)
    setEstadiaResult(result)
    const cleaning = property.cleaning_fee ?? 0
    const base = result.total + cleaning
    const feeAmt = Math.round(base * guestFeePercent * 100) / 100
    const installmentFeeTotal = INSTALLMENT_FEE * installmentCount
    setInstallmentPreviews(calculateInstallments(base + feeAmt + installmentFeeTotal, installmentCount, checkIn))
  }, [installmentCount, property, checkIn, checkOut, nights, pricePeriods, paymentMethod])

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
    if (step < 4) { setStep(s => s + 1); return }
    if (paymentMethod === 'CARTAO') {
      const digits = cardForm.number.replace(/\D/g, '')
      if (digits.length < 13) { toast('warning', 'Dados do cartão', 'Número de cartão inválido.'); return }
      if (!cardForm.holder.trim()) { toast('warning', 'Dados do cartão', 'Informe o nome impresso no cartão.'); return }
      if (cardForm.expiry.length < 5) { toast('warning', 'Dados do cartão', 'Informe a validade no formato MM/AA.'); return }
      if (cardForm.cvv.length < 3) { toast('warning', 'Dados do cartão', 'CVV inválido.'); return }
    }
    setPaymentModalOpen(true)
  }

  async function confirmBooking() {
    if (!property || !user) return
    setSaving(true)

    const isMock = MOCK_PROPERTIES.some(p => p.id === property.id)

    try {
      const ci = new Date(checkIn + 'T00:00:00')
      const co = new Date(checkOut + 'T00:00:00')
      const estadia = calcularEstadia(ci, co, pricePeriods, property.price_per_night)
      const cleaning = property.cleaning_fee ?? 0
      const subtotal = estadia.total + cleaning
      const platform_fee = Math.round(subtotal * guestFeePercent * 100) / 100
      const total_price = subtotal + platform_fee
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
          guest: { ...profile!, name: form.name, cpf: form.cpf },
          owner: property.owner as never ?? { name: 'Anfitrião', cpf: '' },
          ipAddress,
          userAgent: navigator.userAgent,
          paymentInfo: { method: paymentMethod as 'PIX' | 'BOLETO', installmentCount, total },
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

  async function confirmBookingCard() {
    if (!property || !user || !profile) return
    setSaving(true)
    const isMock = MOCK_PROPERTIES.some(p => p.id === property.id)
    try {
      const ci = new Date(checkIn + 'T00:00:00')
      const co = new Date(checkOut + 'T00:00:00')
      const estadia = calcularEstadia(ci, co, pricePeriods, property.price_per_night)
      const cleaning = property.cleaning_fee ?? 0
      const subtotal = estadia.total + cleaning
      const platform_fee = Math.round(subtotal * guestFeePercent * 100) / 100
      const baseTotal = Math.round((subtotal + platform_fee) * 100) / 100
      const setting = effectiveCardSettings.find(s => s.installments === cardInstallments) ?? effectiveCardSettings[0]
      const feePercent = setting?.fee_percent ?? 0
      const feeValue = Math.round(baseTotal * feePercent / 100 * 100) / 100
      const cardTotal = Math.round((baseTotal + feeValue) * 100) / 100
      const installmentValue = Math.round(cardTotal / cardInstallments * 100) / 100

      let bookingId: string | undefined
      let installmentId: string | undefined

      if (!isMock) {
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
          total_price: baseTotal,
          status: 'AGUARDANDO_PAGAMENTO',
          payment_method: 'CARTAO',
          card_installments: cardInstallments,
          card_fee_percent: feePercent,
          card_fee_value: feeValue,
        }).select().single()
        if (error || !booking) throw new Error(error?.message ?? 'Erro ao criar reserva')
        bookingId = booking.id

        const { data: installments } = await supabase.from('installments').insert([{
          booking_id: booking.id,
          number: 1,
          value: cardTotal,
          due_date: new Date().toISOString().slice(0, 10),
          type: 'ENTRADA',
          status: 'PENDENTE',
        }]).select()
        installmentId = installments?.[0]?.id

        const contractContent = generateContractContent({
          booking: { ...booking, property },
          guest: { ...profile!, name: form.name, cpf: form.cpf },
          owner: property.owner as never ?? { name: 'Anfitrião', cpf: '' },
          ipAddress,
          userAgent: navigator.userAgent,
          paymentInfo: { method: 'CARTAO', installmentCount: cardInstallments, cardFeePercent: feePercent, cardFeeValue: feeValue, total: cardTotal },
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
        await supabase.from('notifications').insert({
          user_id: user.id,
          title: 'Reserva criada!',
          message: `Sua reserva para ${property.name} está sendo processada via cartão de crédito.`,
          type: 'BOOKING',
        })
      }

      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token ?? ''
      const [expMonth, expYear] = cardForm.expiry.split('/')

      const payRes = await fetch('/api/payments/create-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          customer: { name: form.name, cpf: form.cpf, email: user.email, phone: form.phone },
          value: cardTotal,
          description: `Locaflix - ${property.name}${isMock ? ' [SANDBOX]' : ''}`,
          externalReference: installmentId ? `installment:${installmentId}` : `sandbox:${Date.now()}`,
          installment_id: installmentId,
          installmentCount: cardInstallments > 1 ? cardInstallments : undefined,
          installmentValue: cardInstallments > 1 ? installmentValue : undefined,
          creditCard: {
            holderName: cardForm.holder.trim(),
            number: cardForm.number.replace(/\D/g, ''),
            expiryMonth: (expMonth ?? '').padStart(2, '0'),
            expiryYear: expYear ? `20${expYear}` : '',
            ccv: cardForm.cvv,
          },
          creditCardHolderInfo: {
            name: form.name,
            email: user.email ?? '',
            cpfCnpj: form.cpf.replace(/\D/g, ''),
            postalCode: form.cep.replace(/\D/g, ''),
            addressNumber: form.number,
            phone: form.phone.replace(/\D/g, ''),
          },
        }),
      })

      if (!payRes.ok) {
        const err = await payRes.json()
        throw new Error(err.error ?? 'Pagamento recusado')
      }

      const result = await payRes.json()
      const isConfirmed = result.status === 'CONFIRMED' || result.status === 'AUTHORIZED_BY_RISK_ANALYSIS'

      if (isConfirmed && installmentId && bookingId) {
        await Promise.all([
          supabase.from('installments').update({
            status: 'PAGO',
            paid_at: new Date().toISOString(),
            asaas_payment_id: result.payment_id,
          }).eq('id', installmentId),
          supabase.from('bookings').update({ status: 'PAGO' }).eq('id', bookingId),
        ])
      }

      setPaymentModalOpen(false)
      setPaid(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar cartão.'
      toast('error', 'Pagamento recusado', msg)
    } finally {
      setSaving(false)
    }
  }

  async function checkPaymentStatus(silent = false) {
    if (!paymentData) return
    if (!silent) setCheckingPayment(true)
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token ?? ''

      const res = await fetch(`/api/payments/${paymentData.pix.payment_id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const payment = await res.json()

      if (payment.status === 'CONFIRMED' || payment.status === 'RECEIVED') {
        setPaymentModalOpen2(false)
        setPaid(true)
      } else if (!silent) {
        toast('warning', 'Pagamento pendente', 'Ainda não identificamos o pagamento. Aguarde alguns instantes ou tente novamente.')
      }
    } catch (err: unknown) {
      if (!silent) toast('error', 'Erro', err instanceof Error ? err.message : 'Erro ao verificar pagamento.')
    } finally {
      if (!silent) setCheckingPayment(false)
    }
  }

  function handleCheckPayment() { void checkPaymentStatus(false) }

  // Compute totals early — needed for both the success page and the main form
  const nightly = estadiaResult?.total ?? (property ? property.price_per_night * nights : 0)
  const cleaningFee = property?.cleaning_fee ?? 0
  const combinedBase = nightly + cleaningFee
  const avgPerNight = nights > 0 ? Math.round((combinedBase / nights) * 100) / 100 : 0
  const subtotal = combinedBase
  const fee = Math.round(combinedBase * guestFeePercent * 100) / 100
  const total = combinedBase + fee

  // Card fee computations
  const cardSetting = effectiveCardSettings.find(s => s.installments === cardInstallments) ?? effectiveCardSettings[0]
  const cardFeePercent = cardSetting?.fee_percent ?? 0
  const cardFeeValue = Math.round(total * cardFeePercent / 100 * 100) / 100
  const cardTotal = Math.round((total + cardFeeValue) * 100) / 100
  const cardInstallmentValue = Math.round(cardTotal / cardInstallments * 100) / 100

  if (paid) {
    return <CheckoutSuccess property={property} checkIn={checkIn} checkOut={checkOut} nights={nights} total={paymentMethod === 'CARTAO' ? cardTotal : total} guestsCount={guestsParam} />
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
                <span className={`text-xs mt-1 font-medium hidden sm:block ${step >= s.id ? 'text-white' : 'text-[#444]'}`}>
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
                                        <p className="text-xs text-[#999]">
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
                      <p>• Parcelamento via Pix ou Boleto. Última parcela até 7 dias antes do check-in.</p>
                      <p>• Taxa de processamento de R$ 1,99 por parcela aplicada em todos os pagamentos.</p>
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

                    {/* Payment method toggle */}
                    <div className="mb-6">
                      <p className="text-sm font-medium text-[#B3B3B3] mb-3">Forma de pagamento</p>
                      <div className="flex gap-2">
                        {(['PIX', 'BOLETO', 'CARTAO'] as const).map(m => (
                          <button
                            key={m}
                            onClick={() => setPaymentMethod(m)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                              paymentMethod === m
                                ? 'bg-[#E50914] border-[#E50914] text-white'
                                : 'border-[#333] text-[#B3B3B3] hover:border-[#555]'
                            }`}
                          >
                            {m === 'PIX' ? 'Pix' : m === 'BOLETO' ? 'Boleto' : 'Cartão'}
                          </button>
                        ))}
                      </div>
                      {paymentMethod !== 'CARTAO' && (
                        <p className="text-xs text-[#F5A623] mt-2">
                          ⚠ Taxa de R$ 1,99 por parcela adicionada ao valor de cada cobrança.
                        </p>
                      )}
                    </div>

                    {/* PIX / BOLETO installment selector */}
                    {paymentMethod !== 'CARTAO' && (
                      <>
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
                              <p className="text-xs text-[#999]">+R$ 1,99 por parcela</p>
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
                                    <p className="text-xs text-[#999]">Vence {formatDate(p.due_date)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <p className="text-xs text-[#46D369] mb-4">
                          ✓ Última parcela vence até 7 dias antes do check-in ({checkIn ? formatDate(checkIn) : '—'}).
                        </p>
                      </>
                    )}

                    {/* CARTÃO DE CRÉDITO */}
                    {paymentMethod === 'CARTAO' && (
                      <div className="space-y-5">
                        {/* Installment selector */}
                        <div>
                          <p className="text-sm font-medium text-[#B3B3B3] mb-3">Número de parcelas</p>
                          <div className="grid grid-cols-3 gap-2">
                              {effectiveCardSettings.map(s => (
                                <button
                                  key={s.installments}
                                  type="button"
                                  onClick={() => setCardInstallments(s.installments)}
                                  className={`p-3 rounded-xl border transition-all text-left ${
                                    cardInstallments === s.installments
                                      ? 'bg-[#E50914] border-[#E50914] text-white'
                                      : 'border-[#333] text-[#B3B3B3] hover:border-[#555]'
                                  }`}
                                >
                                  <p className="text-xs font-bold">{s.label ?? `${s.installments}x`}</p>
                                  <p className="text-sm font-semibold mt-0.5">
                                    {formatCurrency(Math.round(total * (1 + s.fee_percent / 100) / s.installments * 100) / 100)}
                                  </p>
                                  {s.fee_percent > 0 && (
                                    <p className="text-xs opacity-70">+{s.fee_percent}%</p>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>

                        {/* Fee breakdown */}
                        <div className="bg-[#0A0A0A] border border-[#333] rounded-xl p-4 space-y-2 text-sm">
                          <div className="flex justify-between text-[#B3B3B3]">
                            <span>Hospedagem</span>
                            <span>{formatCurrency(total)}</span>
                          </div>
                          {cardFeeValue > 0 && (
                            <div className="flex justify-between text-[#B3B3B3]">
                              <span>Taxa parcelamento ({cardInstallments}x · {cardFeePercent}%)</span>
                              <span>{formatCurrency(cardFeeValue)}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-bold border-t border-[#333] pt-2">
                            <span className="text-white">Total no cartão</span>
                            <span className="text-[#F5A623]">{formatCurrency(cardTotal)}</span>
                          </div>
                          <p className="text-xs text-[#46D369] text-center">
                            {cardInstallments === 1
                              ? `À vista: ${formatCurrency(cardTotal)}`
                              : `${cardInstallments}x de ${formatCurrency(cardInstallmentValue)}`}
                          </p>
                        </div>

                        {/* Card form */}
                        <div className="space-y-3">
                          <p className="text-sm font-medium text-[#B3B3B3]">Dados do cartão</p>

                          <div>
                            <label className="block text-xs text-[#888] mb-1.5">Número do cartão</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={cardForm.number}
                              onChange={e => {
                                const d = e.target.value.replace(/\D/g, '').slice(0, 16)
                                setCardForm(f => ({ ...f, number: d.replace(/(.{4})/g, '$1 ').trim() }))
                              }}
                              placeholder="0000 0000 0000 0000"
                              maxLength={19}
                              className="w-full bg-[#2A2A2A] border border-[#333] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#555] outline-none focus:ring-2 focus:ring-[#E50914] font-mono tracking-wider"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-[#888] mb-1.5">Nome impresso no cartão</label>
                            <input
                              type="text"
                              value={cardForm.holder}
                              onChange={e => setCardForm(f => ({ ...f, holder: e.target.value.toUpperCase() }))}
                              placeholder="NOME COMO NO CARTÃO"
                              className="w-full bg-[#2A2A2A] border border-[#333] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#555] outline-none focus:ring-2 focus:ring-[#E50914] uppercase"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-[#888] mb-1.5">Validade</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={cardForm.expiry}
                                onChange={e => {
                                  const d = e.target.value.replace(/\D/g, '').slice(0, 4)
                                  setCardForm(f => ({ ...f, expiry: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }))
                                }}
                                placeholder="MM/AA"
                                maxLength={5}
                                className="w-full bg-[#2A2A2A] border border-[#333] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#555] outline-none focus:ring-2 focus:ring-[#E50914] font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-[#888] mb-1.5">CVV</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={cardForm.cvv}
                                onChange={e => setCardForm(f => ({ ...f, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                                placeholder="000"
                                maxLength={4}
                                className="w-full bg-[#2A2A2A] border border-[#333] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#555] outline-none focus:ring-2 focus:ring-[#E50914] font-mono"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-[#888]">
                            <Lock size={12} className="text-[#46D369] flex-shrink-0" />
                            Dados criptografados e processados pelo gateway de pagamento
                          </div>
                        </div>
                      </div>
                    )}
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
                <Row
                  label={`${nights}x Diárias: ${formatCurrency(avgPerNight)}`}
                  value={formatCurrency(combinedBase)}
                />
                <div className="pt-2 border-t border-[#333] flex justify-between font-bold">
                  <span className="text-white">Total</span>
                  <span className="text-[#F5A623] text-base">
                    {formatCurrency(paymentMethod === 'CARTAO' ? cardTotal : total)}
                  </span>
                </div>
                {paymentMethod === 'CARTAO' && cardFeeValue > 0 && (
                  <p className="text-xs text-center text-[#F5A623]">
                    Inclui {formatCurrency(cardFeeValue)} de taxa de parcelamento
                  </p>
                )}
                {paymentMethod === 'CARTAO' && (
                  <p className="text-xs text-center text-[#46D369]">
                    {cardInstallments === 1
                      ? `À vista no cartão`
                      : `${cardInstallments}x de ${formatCurrency(cardInstallmentValue)} no cartão`}
                  </p>
                )}
                {paymentMethod !== 'CARTAO' && installmentCount > 1 && (
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
            {paymentMethod === 'CARTAO'
              ? `O cartão será cobrado agora em ${cardInstallments === 1 ? 'pagamento à vista' : `${cardInstallments}x`} de ${formatCurrency(cardInstallmentValue)}.`
              : 'Na próxima tela, escolha pagar via Pix ou Boleto.'}
          </p>
          <div className="bg-[#0A0A0A] rounded-xl p-4 space-y-2 text-sm">
            <Row label="Imóvel" value={property.name} />
            <Row label="Check-in" value={checkIn} />
            <Row label="Check-out" value={checkOut} />
            <Row label="Total" value={formatCurrency(paymentMethod === 'CARTAO' ? cardTotal : total)} accent />
            {paymentMethod === 'CARTAO' && cardFeeValue > 0 && (
              <p className="text-xs text-[#F5A623]">Inclui {formatCurrency(cardFeeValue)} de taxa de parcelamento</p>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" fullWidth onClick={() => setPaymentModalOpen(false)}>
              Cancelar
            </Button>
            <Button fullWidth onClick={paymentMethod === 'CARTAO' ? confirmBookingCard : confirmBooking} loading={saving}>
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
        polling={paymentModalOpen2}
      />
    </div>
  )
}

function CheckoutSuccess({
  property, checkIn, checkOut, nights, total, guestsCount,
}: {
  property: Property | null
  checkIn: string
  checkOut: string
  nights: number
  total: number
  guestsCount: number
}) {
  const navigate = useNavigate()
  const [countdown, setCountdown] = useState(6)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timer)
          navigate(`${APP_ROUTES.GUEST_DASHBOARD}?tab=reservas`, { replace: true })
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [navigate])

  const fmt = (d: string) => d ? format(new Date(d + 'T00:00:00'), "dd 'de' MMMM, yyyy", { locale: ptBR }) : ''

  return (
    <div className="min-h-screen bg-[#141414] flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="max-w-md w-full"
      >
        {/* Success icon with ring animation */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-20 h-20 bg-[#46D369]/20 rounded-full flex items-center justify-center"
            >
              <Check size={40} className="text-[#46D369]" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: [0, 0.3, 0], scale: [0.8, 1.4, 1.6] }}
              transition={{ delay: 0.3, duration: 1.2, ease: 'easeOut' }}
              className="absolute inset-0 border-2 border-[#46D369] rounded-full"
            />
          </div>
        </div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-center mb-6"
        >
          <h1 className="font-display text-3xl font-bold text-white mb-2">Reserva confirmada!</h1>
          <p className="text-[#B3B3B3] text-sm leading-relaxed">
            Parabéns! Seu pagamento foi processado com sucesso.<br />
            Desejamos bons momentos na sua estadia. ✨
          </p>
        </motion.div>

        {/* Property card */}
        {property && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="bg-[#1F1F1F] border border-[#2A2A2A] rounded-2xl overflow-hidden mb-4"
          >
            {property.photos?.[0] && (
              <img src={property.photos[0]} alt={property.name} className="w-full h-36 object-cover" />
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h2 className="font-semibold text-white text-sm line-clamp-1">{property.name}</h2>
                  <p className="text-xs text-[#999] flex items-center gap-1 mt-0.5">
                    <MapPin size={10} /> {property.city}, {property.state}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[#F5A623] flex-shrink-0">
                  <Star size={12} fill="#F5A623" />
                  <span className="text-xs font-medium">{property.rating?.toFixed(1) ?? '—'}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#0A0A0A] rounded-xl p-2.5">
                  <p className="text-xs text-[#888] uppercase tracking-wide mb-0.5">Check-in</p>
                  <p className="text-white text-xs font-semibold">{fmt(checkIn)}</p>
                </div>
                <div className="bg-[#0A0A0A] rounded-xl p-2.5">
                  <p className="text-xs text-[#888] uppercase tracking-wide mb-0.5">Noites</p>
                  <p className="text-white text-xs font-semibold">{nights}</p>
                </div>
                <div className="bg-[#0A0A0A] rounded-xl p-2.5">
                  <p className="text-xs text-[#888] uppercase tracking-wide mb-0.5">Check-out</p>
                  <p className="text-white text-xs font-semibold">{fmt(checkOut)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#2A2A2A]">
                <span className="text-xs text-[#999]">{guestsCount} hóspede{guestsCount !== 1 ? 's' : ''}</span>
                <span className="text-sm font-bold text-[#F5A623]">{formatCurrency(total)}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* What's next info */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="bg-[#46D369]/8 border border-[#46D369]/20 rounded-xl px-4 py-3 mb-5 text-xs text-[#46D369] space-y-1"
        >
          <p>✓ Detalhes enviados para o seu e-mail</p>
          <p>✓ O anfitrião foi notificado sobre a reserva</p>
          <p>✓ Acompanhe tudo em "Minhas reservas"</p>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="space-y-3"
        >
          <Link to={`${APP_ROUTES.GUEST_DASHBOARD}?tab=reservas`}>
            <Button fullWidth className="gap-2">
              <Home size={16} />
              Ver minhas reservas
            </Button>
          </Link>
        </motion.div>

        {/* Auto-redirect countdown */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-xs text-[#444] mt-5"
        >
          Redirecionando para suas reservas em {countdown}s…
        </motion.p>
      </motion.div>
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
