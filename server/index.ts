import express from 'express'
import type { Request, Response } from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const IS_PROD = process.env.NODE_ENV === 'production'

const app = express()
const PORT = process.env.PORT ?? 3001
const ASAAS_API_KEY = process.env.ASAAS_API_KEY ?? ''
const ASAAS_BASE_URL = process.env.ASAAS_ENV === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3'
const WEBHOOK_SECRET = process.env.ASAAS_WEBHOOK_SECRET ?? ''

app.use(express.json())

// Trust proxy to get real IP
app.set('trust proxy', true)

// ---- Middleware: JWT auth ----
function requireAuth(req: Request, res: Response, next: () => void) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return }
  // Supabase JWTs are verified client-side — here we just ensure the header exists
  // For production, verify with jwt.verify(token, process.env.SUPABASE_JWT_SECRET)
  next()
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
    const { customer, value, dueDate, description, externalReference } = req.body

    if (!customer || !value || !dueDate) {
      res.status(400).json({ error: 'customer, value and dueDate are required' })
      return
    }

    // Create or get customer
    const customerRes = await asaasRequest('POST', '/customers', {
      name: customer.name,
      cpfCnpj: customer.cpf?.replace(/\D/g, ''),
      email: customer.email,
      mobilePhone: customer.phone?.replace(/\D/g, ''),
    })

    // Create Pix payment
    const paymentRes = await asaasRequest('POST', '/payments', {
      customer: customerRes.id,
      billingType: 'PIX',
      value,
      dueDate,
      description,
      externalReference,
    })

    // Get Pix QR code
    const pixRes = await asaasRequest('GET', `/payments/${paymentRes.id}/pixQrCode`)

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

// ---- GET /api/payments/:id ----
app.get('/api/payments/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const payment = await asaasRequest('GET', `/payments/${req.params.id}`)
    res.json(payment)
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' })
  }
})

// ---- POST /api/webhooks/asaas ----
app.post('/api/webhooks/asaas', async (req: Request, res: Response) => {
  // Verify webhook signature
  if (WEBHOOK_SECRET) {
    const signature = req.headers['asaas-access-token'] as string
    if (signature !== WEBHOOK_SECRET) {
      res.status(401).json({ error: 'Invalid webhook signature' })
      return
    }
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

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  await supabase.from('installments').update({
    status: 'PAGO',
    paid_at: new Date().toISOString(),
    asaas_payment_id: payment.id,
  }).eq('id', id)
}

async function handlePaymentOverdue(payment: { externalReference?: string }) {
  if (!payment.externalReference) return
  const [type, id] = payment.externalReference.split(':')
  if (type !== 'installment' || !id) return

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  await supabase.from('installments').update({ status: 'ATRASADO' }).eq('id', id)
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

// ---- Static files (production only) ----
// dist/server/index.js → __dirname = dist/server/
// dist/index.html      → path.join(__dirname, '..', 'index.html')
if (IS_PROD) {
  const distDir = path.join(__dirname, '..')
  app.use(express.static(distDir))
  app.use((req: Request, res: Response) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`🚀 LOCAFLIX server running on port ${PORT}`)
})
