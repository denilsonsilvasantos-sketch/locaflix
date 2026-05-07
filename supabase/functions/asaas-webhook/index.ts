import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ASAAS_WEBHOOK_SECRET = Deno.env.get('ASAAS_WEBHOOK_SECRET') ?? ''
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// Asaas payment event types we care about
type AsaasEvent =
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_DELETED'
  | 'PAYMENT_REFUNDED'
  | 'PAYMENT_PARTIALLY_REFUNDED'

interface AsaasWebhookPayload {
  event: AsaasEvent
  payment: {
    id: string           // Asaas payment ID (pay_xxx)
    customer: string     // Asaas customer ID
    value: number
    status: string
    externalReference: string | null  // nossa booking_id ou installment_id
  }
}

// Map Asaas event → installment status in our DB
const EVENT_TO_STATUS: Partial<Record<AsaasEvent, string>> = {
  PAYMENT_RECEIVED:            'PAGO',
  PAYMENT_CONFIRMED:           'PAGO',
  PAYMENT_OVERDUE:             'ATRASADO',
  PAYMENT_DELETED:             'CANCELADO',
  PAYMENT_REFUNDED:            'CANCELADO',
  PAYMENT_PARTIALLY_REFUNDED:  'ATRASADO',
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Validate Asaas webhook token
  const token = req.headers.get('asaas-access-token') ?? ''
  if (ASAAS_WEBHOOK_SECRET && token !== ASAAS_WEBHOOK_SECRET) {
    console.error('Webhook: token inválido')
    return new Response('Unauthorized', { status: 401 })
  }

  let payload: AsaasWebhookPayload
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { event, payment } = payload
  const newStatus = EVENT_TO_STATUS[event]

  if (!newStatus) {
    // Evento irrelevante — responde 200 para o Asaas não retentar
    return new Response(JSON.stringify({ ignored: true, event }), { status: 200 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Find installment by asaas_payment_id
  const { data: installment, error: findErr } = await supabase
    .from('installments')
    .select('id, booking_id, status')
    .eq('asaas_payment_id', payment.id)
    .single()

  if (findErr || !installment) {
    console.error('Webhook: parcela não encontrada para', payment.id)
    return new Response(JSON.stringify({ error: 'installment not found' }), { status: 404 })
  }

  // Update installment status
  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }
  if (newStatus === 'PAGO') {
    updatePayload.paid_at = new Date().toISOString()
  }

  const { error: updErr } = await supabase
    .from('installments')
    .update(updatePayload)
    .eq('id', installment.id)

  if (updErr) {
    console.error('Webhook: erro ao atualizar parcela', updErr.message)
    return new Response(JSON.stringify({ error: updErr.message }), { status: 500 })
  }

  // Sync booking status based on all installments
  await syncBookingStatus(supabase, installment.booking_id)

  // Create notification for the guest
  await notifyGuest(supabase, installment.booking_id, event, payment.value)

  console.log(`Webhook: ${event} → parcela ${installment.id} → ${newStatus}`)
  return new Response(JSON.stringify({ ok: true }), { status: 200 })
})

async function syncBookingStatus(
  supabase: ReturnType<typeof createClient>,
  bookingId: string
) {
  const { data: installments } = await supabase
    .from('installments')
    .select('status')
    .eq('booking_id', bookingId)

  if (!installments || installments.length === 0) return

  const total    = installments.length
  const paid     = installments.filter((i: { status: string }) => i.status === 'PAGO').length
  const overdue  = installments.filter((i: { status: string }) => i.status === 'ATRASADO').length
  const cancelled = installments.filter((i: { status: string }) => i.status === 'CANCELADO').length

  let bookingStatus: string
  if (paid === total) {
    bookingStatus = 'PAGO'
  } else if (cancelled === total) {
    bookingStatus = 'CANCELADA'
  } else if (paid > 0) {
    bookingStatus = 'PARCIAL'
  } else if (overdue > 0) {
    bookingStatus = 'AGUARDANDO_PAGAMENTO'
  } else {
    bookingStatus = 'AGUARDANDO_PAGAMENTO'
  }

  await supabase
    .from('bookings')
    .update({ status: bookingStatus, updated_at: new Date().toISOString() })
    .eq('id', bookingId)
}

async function notifyGuest(
  supabase: ReturnType<typeof createClient>,
  bookingId: string,
  event: AsaasEvent,
  value: number
) {
  const { data: booking } = await supabase
    .from('bookings')
    .select('guest_id, booking_number')
    .eq('id', bookingId)
    .single()

  if (!booking) return

  const messages: Partial<Record<AsaasEvent, { title: string; message: string; type: string }>> = {
    PAYMENT_RECEIVED: {
      title: 'Pagamento recebido',
      message: `Recebemos R$ ${value.toFixed(2)} referente à reserva ${booking.booking_number ?? bookingId}.`,
      type: 'PAYMENT',
    },
    PAYMENT_CONFIRMED: {
      title: 'Pagamento confirmado',
      message: `Pagamento de R$ ${value.toFixed(2)} confirmado na reserva ${booking.booking_number ?? bookingId}.`,
      type: 'SUCCESS',
    },
    PAYMENT_OVERDUE: {
      title: 'Parcela em atraso',
      message: `A parcela de R$ ${value.toFixed(2)} da reserva ${booking.booking_number ?? bookingId} está em atraso.`,
      type: 'WARNING',
    },
    PAYMENT_REFUNDED: {
      title: 'Pagamento estornado',
      message: `O valor de R$ ${value.toFixed(2)} da reserva ${booking.booking_number ?? bookingId} foi estornado.`,
      type: 'INFO',
    },
  }

  const notif = messages[event]
  if (!notif) return

  await supabase.from('notifications').insert({
    user_id: booking.guest_id,
    title: notif.title,
    message: notif.message,
    type: notif.type,
    is_read: false,
  })
}
