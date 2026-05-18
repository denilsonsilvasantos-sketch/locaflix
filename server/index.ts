import express from 'express'
import type { Request, Response } from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = process.env.PORT ?? 3000
// Hostinger escapes '$' to '\$' internally — strip any leading backslash
const ASAAS_API_KEY = (process.env.ASAAS_API_KEY ?? '').replace(/^\\+/, '').trim()
const ASAAS_BASE_URL = process.env.ASAAS_ENV === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3'
const WEBHOOK_SECRET = process.env.ASAAS_WEBHOOK_SECRET ?? ''

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

app.use(express.json())

// Trust proxy to get real IP
app.set('trust proxy', true)

// ---- Middleware: JWT auth ----
async function requireAuth(req: Request, res: Response, next: () => void) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return }
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) { res.status(401).json({ error: 'Unauthorized' }); return }
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
  }
}

// ---- GET /api/client-ip ----
app.get('/api/client-ip', (req: Request, res: Response) => {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    ?? req.headers['x-real-ip'] as string
    ?? req.socket.remoteAddress
    ?? '0.0.0.0'
  res.json({ ip })
})

// ---- POST /api/payments/create-pix ----
app.post('/api/payments/create-pix', requireAuth, async (req: Request, res: Response) => {
  try {
    const { customer, value, dueDate, description, externalReference, installment_id } = req.body

    if (!ASAAS_API_KEY) {
      res.status(503).json({ error: 'Integração Asaas não configurada. Defina ASAAS_API_KEY no servidor.' })
      return
    }

    if (!customer || !value || !dueDate) {
      res.status(400).json({ error: 'customer, value and dueDate are required' })
      return
    }

    // Validate value against DB — never trust the client-supplied amount
    let confirmedValue: number = Number(value)
    if (installment_id) {
      const { data: inst, error } = await supabase.from('installments').select('value').eq('id', installment_id).single()
      if (error || !inst) { res.status(400).json({ error: 'Parcela não encontrada' }); return }
      if (Math.abs(Number(inst.value) - Number(value)) > 0.01) {
        res.status(400).json({ error: 'Valor inválido' }); return
      }
      confirmedValue = Number(inst.value)
    }

    // Create or get customer
    const customerRes = await asaasRequest('POST', '/customers', {
      name: customer.name,
      cpfCnpj: customer.cpf?.replace(/\D/g, ''),
      email: customer.email,
      mobilePhone: customer.phone?.replace(/\D/g, ''),
    })

    // Create Pix payment (with fine 2% + interest 1%/month)
    const paymentRes = await asaasRequest('POST', '/payments', {
      customer: customerRes.id,
      billingType: 'PIX',
      value: confirmedValue,
      dueDate,
      description,
      externalReference,
      fine:     { value: 2.00, type: 'PERCENTAGE' },
      interest: { value: 1.00, type: 'MONTHLY' },
    })

    // Get Pix QR code
    const pixRes = await asaasRequest('GET', `/payments/${paymentRes.id}/pixQrCode`)

    // Salva asaas_payment_id na parcela do Supabase
    if (installment_id) {
      await supabase.from('installments')
        .update({ asaas_payment_id: paymentRes.id })
        .eq('id', installment_id)
    }

    res.json({
      payment_id: paymentRes.id,
      status: paymentRes.status,
      pix_key: pixRes.payload,
      pix_qr_code: pixRes.encodedImage,
      due_date: paymentRes.dueDate,
      value: paymentRes.value,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    res.status(500).json({ error: msg })
  }
})

// ---- POST /api/payments/create-boleto ----
app.post('/api/payments/create-boleto', requireAuth, async (req: Request, res: Response) => {
  try {
    const { customer, value, dueDate, description, externalReference } = req.body

    const customerRes = await asaasRequest('POST', '/customers', {
      name: customer.name,
      cpfCnpj: customer.cpf?.replace(/\D/g, ''),
      email: customer.email,
    })

    const paymentRes = await asaasRequest('POST', '/payments', {
      customer: customerRes.id,
      billingType: 'BOLETO',
      value,
      dueDate,
      description,
      externalReference,
    })

    res.json({
      payment_id: paymentRes.id,
      status: paymentRes.status,
      bank_slip_url: paymentRes.bankSlipUrl,
      bar_code: paymentRes.nossoNumero,
      due_date: paymentRes.dueDate,
      value: paymentRes.value,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    res.status(500).json({ error: msg })
  }
})

// ---- POST /api/payments/create-installments ----
// Creates both a Pix and a Boleto for one installment in parallel
app.post('/api/payments/create-installments', requireAuth, async (req: Request, res: Response) => {
  try {
    const { customer, value, dueDate, description, externalReference, installment_id } = req.body

    if (!ASAAS_API_KEY) {
      res.status(503).json({ error: 'Integração Asaas não configurada. Defina ASAAS_API_KEY no servidor.' })
      return
    }

    if (!customer || !value || !dueDate) {
      res.status(400).json({ error: 'customer, value and dueDate are required' })
      return
    }

    // Validate value against DB — never trust the client-supplied amount
    let confirmedValue: number = Number(value)
    if (installment_id) {
      const { data: inst, error } = await supabase.from('installments').select('value').eq('id', installment_id).single()
      if (error || !inst) { res.status(400).json({ error: 'Parcela não encontrada' }); return }
      if (Math.abs(Number(inst.value) - Number(value)) > 0.01) {
        res.status(400).json({ error: 'Valor inválido' }); return
      }
      confirmedValue = Number(inst.value)
    }

    const customerRes = await asaasRequest('POST', '/customers', {
      name: customer.name,
      cpfCnpj: customer.cpf?.replace(/\D/g, ''),
      email: customer.email,
      mobilePhone: customer.phone?.replace(/\D/g, ''),
    })

    const basePayload = {
      customer: customerRes.id,
      value: confirmedValue,
      dueDate,
      description,
      externalReference,
      fine:     { value: 2.00, type: 'PERCENTAGE' },
      interest: { value: 1.00, type: 'MONTHLY' },
    }

    const [pixPayment, boletoPayment] = await Promise.all([
      asaasRequest('POST', '/payments', { ...basePayload, billingType: 'PIX' }),
      asaasRequest('POST', '/payments', { ...basePayload, billingType: 'BOLETO' }),
    ])

    const pixQr = await asaasRequest('GET', `/payments/${pixPayment.id}/pixQrCode`)

    if (installment_id) {
      await supabase.from('installments')
        .update({ asaas_payment_id: pixPayment.id })
        .eq('id', installment_id)
    }

    res.json({
      pix: {
        payment_id: pixPayment.id,
        status:     pixPayment.status,
        pix_key:    pixQr.payload,
        pix_qr_code: pixQr.encodedImage,
        due_date:   pixPayment.dueDate,
        value:      pixPayment.value,
      },
      boleto: {
        payment_id:    boletoPayment.id,
        status:        boletoPayment.status,
        boleto_url:    boletoPayment.bankSlipUrl ?? '',
        boleto_barcode: boletoPayment.identificationField ?? boletoPayment.nossoNumero ?? '',
        due_date:      boletoPayment.dueDate,
        value:         boletoPayment.value,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    res.status(500).json({ error: msg })
  }
})

// ---- GET /api/payments/:id ----
app.get('/api/payments/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const payment = await asaasRequest('GET', `/payments/${req.params.id}`)
    res.json(payment)
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' })
  }
})

// ---- GET /api/payments/:id/pixQrCode ----
app.get('/api/payments/:id/pixQrCode', requireAuth, async (req: Request, res: Response) => {
  try {
    const qr = await asaasRequest('GET', `/payments/${req.params.id}/pixQrCode`)
    res.json(qr)
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' })
  }
})

// ---- POST /api/webhooks/asaas ----
app.post('/api/webhooks/asaas', async (req: Request, res: Response) => {
  // Verify webhook signature — always reject if secret is not configured
  const signature = req.headers['asaas-access-token'] as string
  if (!WEBHOOK_SECRET || signature !== WEBHOOK_SECRET) {
    res.status(401).json({ error: 'Invalid webhook signature' })
    return
  }

  const { event, payment } = req.body

  try {
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      await handlePaymentConfirmed(payment)
    } else if (event === 'PAYMENT_OVERDUE') {
      await handlePaymentOverdue(payment)
    }
    res.json({ received: true })
  } catch (err: unknown) {
    console.error('Webhook error:', err)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

async function handlePaymentConfirmed(payment: { externalReference?: string; id: string }) {
  if (!payment.externalReference) return
  // externalReference = "installment:{installment_id}"
  const [type, id] = payment.externalReference.split(':')
  if (type !== 'installment' || !id) return

  await supabase.from('installments').update({
    status: 'PAGO',
    paid_at: new Date().toISOString(),
    asaas_payment_id: payment.id,
  }).eq('id', id)

  // Notify guest
  const { data: inst } = await supabase.from('installments').select('booking_id, number, value').eq('id', id).single()
  if (inst) {
    const { data: booking } = await supabase.from('bookings').select('guest_id').eq('id', inst.booking_id).single()
    if (booking) {
      const valueFormatted = `R$ ${Number(inst.value).toFixed(2).replace('.', ',')}`
      await supabase.from('notifications').insert({
        user_id: booking.guest_id,
        title: 'Pagamento confirmado!',
        message: `Parcela ${inst.number} de ${valueFormatted} foi confirmada com sucesso.`,
        type: 'PAYMENT',
      })
    }
  }
}

async function handlePaymentOverdue(payment: { externalReference?: string }) {
  if (!payment.externalReference) return
  const [type, id] = payment.externalReference.split(':')
  if (type !== 'installment' || !id) return

  await supabase.from('installments').update({ status: 'ATRASADO' }).eq('id', id)

  // Notify guest
  const { data: inst } = await supabase.from('installments').select('booking_id, number, due_date').eq('id', id).single()
  if (inst) {
    const { data: booking } = await supabase.from('bookings').select('guest_id').eq('id', inst.booking_id).single()
    if (booking) {
      await supabase.from('notifications').insert({
        user_id: booking.guest_id,
        title: 'Pagamento em atraso',
        message: `A parcela ${inst.number} com vencimento em ${new Date(inst.due_date).toLocaleDateString('pt-BR')} está em atraso.`,
        type: 'WARNING',
      })
    }
  }
}

async function asaasRequest(method: string, path: string, body?: unknown) {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    method,
    headers: {
      'access_token': ASAAS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.errors?.[0]?.description ?? `Asaas error ${res.status}`)
  return data
}

// ---- GET /auth/callback — Supabase email confirmation ----
// O code PKCE só pode ser trocado pelo cliente (browser) pois o code_verifier
// fica no localStorage. O servidor apenas serve o index.html para o React processar.
app.get('/auth/callback', (_req: Request, res: Response) => {
  res.sendFile(distIndex)
})

// ---- Static files — serve dist/ when the built index.html exists ----
const distDir = path.join(__dirname, '..')
const distIndex = path.join(distDir, 'index.html')
if (existsSync(distIndex)) {
  app.use(express.static(distDir))
  app.use((_req: Request, res: Response) => {
    res.sendFile(distIndex)
  })
}

app.listen(PORT, () => {
  console.log(`🚀 LOCAFLIX server running on port ${PORT}`)
})
