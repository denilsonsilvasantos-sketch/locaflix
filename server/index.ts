import express from 'express'
import type { Request, Response } from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Singleton com ws transport — evita erro "Node.js 20 without native WebSocket"
const adminSupabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws }, auth: { persistSession: false } },
)

const app = express()
const PORT = process.env.PORT ?? 3000
// Hostinger escapes '$' to '\$' internally — strip any leading backslash
const ASAAS_API_KEY = (process.env.ASAAS_API_KEY ?? '').replace(/^\\+/, '').trim()
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

    if (!ASAAS_API_KEY) {
      res.status(503).json({ error: 'Integração Asaas não configurada. Defina ASAAS_API_KEY no servidor.' })
      return
    }

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

    // Create Pix payment (with fine 2% + interest 1%/month)
    const paymentRes = await asaasRequest('POST', '/payments', {
      customer: customerRes.id,
      billingType: 'PIX',
      value,
      dueDate,
      description,
      externalReference,
      fine:     { value: 2.00, type: 'PERCENTAGE' },
      interest: { value: 1.00, type: 'MONTHLY' },
    })

    // Get Pix QR code
    const pixRes = await asaasRequest('GET', `/payments/${paymentRes.id}/pixQrCode`)

    // Salva asaas_payment_id na parcela do Supabase
    const { installment_id } = req.body
    if (installment_id) {
      await adminSupabase.from('installments')
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

    const customerRes = await asaasRequest('POST', '/customers', {
      name: customer.name,
      cpfCnpj: customer.cpf?.replace(/\D/g, ''),
      email: customer.email,
      mobilePhone: customer.phone?.replace(/\D/g, ''),
    })

    const basePayload = {
      customer: customerRes.id,
      value,
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
      await adminSupabase.from('installments')
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
    // Sync Supabase installment when payment is confirmed (fallback for missing webhook)
    if (payment.status === 'CONFIRMED' || payment.status === 'RECEIVED') {
      if (payment.externalReference) {
        const [type, id] = (payment.externalReference as string).split(':')
        if (type === 'installment' && id) {
          await adminSupabase.from('installments').update({
            status: 'PAGO',
            paid_at: new Date().toISOString(),
            asaas_payment_id: payment.id,
          }).eq('id', id).neq('status', 'PAGO')
        }
      }
    }
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

  await adminSupabase.from('installments').update({
    status: 'PAGO',
    paid_at: new Date().toISOString(),
    asaas_payment_id: payment.id,
  }).eq('id', id)

  // Notify guest
  const { data: inst } = await adminSupabase.from('installments').select('booking_id, number, value').eq('id', id).single()
  if (inst) {
    const { data: booking } = await adminSupabase.from('bookings').select('guest_id').eq('id', inst.booking_id).single()
    if (booking) {
      const valueFormatted = `R$ ${Number(inst.value).toFixed(2).replace('.', ',')}`
      await adminSupabase.from('notifications').insert({
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

  await adminSupabase.from('installments').update({ status: 'ATRASADO' }).eq('id', id)

  // Notify guest
  const { data: inst } = await adminSupabase.from('installments').select('booking_id, number, due_date').eq('id', id).single()
  if (inst) {
    const { data: booking } = await adminSupabase.from('bookings').select('guest_id').eq('id', inst.booking_id).single()
    if (booking) {
      await adminSupabase.from('notifications').insert({
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

// ============================================================
// iCal — utilities
// ============================================================

interface ICalEvent {
  uid: string
  start: string
  end: string
  summary: string
}

function parseIcal(text: string): ICalEvent[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, '')
  const lines = unfolded.split(/\r?\n/)
  const events: ICalEvent[] = []
  let inEvent = false
  let cur: Partial<ICalEvent> = {}
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { inEvent = true; cur = {}; continue }
    if (line === 'END:VEVENT') {
      if (cur.uid && cur.start && cur.end) events.push(cur as ICalEvent)
      inEvent = false; continue
    }
    if (!inEvent) continue
    const colonIdx = line.indexOf(':')
    if (colonIdx < 0) continue
    const rawKey = line.slice(0, colonIdx).toUpperCase()
    const val = line.slice(colonIdx + 1).trim()
    if (rawKey === 'UID') cur.uid = val
    else if (rawKey.startsWith('DTSTART')) cur.start = icalDateStr(val)
    else if (rawKey.startsWith('DTEND')) cur.end = icalDateStr(val)
    else if (rawKey === 'SUMMARY') cur.summary = val.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';')
  }
  return events
}

function icalDateStr(val: string): string {
  const d = val.replace(/\D/g, '').slice(0, 8)
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
}

function toIcalDate(date: string): string {
  return date.replace(/-/g, '')
}

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

async function generateIcal(propertyId: string): Promise<string> {
  const [bkRes, blkRes, propRes] = await Promise.all([
    adminSupabase.from('bookings').select('id,check_in,check_out,booking_number')
      .eq('property_id', propertyId).in('status', ['PARCIAL', 'PAGO']),
    adminSupabase.from('calendar_blocks').select('id,start_date,end_date,notes')
      .eq('property_id', propertyId).eq('source', 'MANUAL'),
    adminSupabase.from('properties').select('name').eq('id', propertyId).single(),
  ])
  const propName = (propRes.data as { name: string } | null)?.name ?? 'Locaflix'
  const lines: string[] = [
    'BEGIN:VCALENDAR', 'VERSION:2.0',
    'PRODID:-//Locaflix//Calendário//PT',
    `X-WR-CALNAME:${propName} – Locaflix`,
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
  ]
  for (const b of (bkRes.data ?? []) as { id: string; check_in: string; check_out: string; booking_number: string | null }[]) {
    lines.push('BEGIN:VEVENT',
      `UID:booking-${b.id}@locaflix.com.br`,
      `DTSTART;VALUE=DATE:${toIcalDate(b.check_in)}`,
      `DTEND;VALUE=DATE:${toIcalDate(addDays(b.check_out, 1))}`,
      `SUMMARY:Reserva Locaflix${b.booking_number ? ' #' + b.booking_number : ''}`,
      'STATUS:CONFIRMED', 'END:VEVENT')
  }
  for (const bl of (blkRes.data ?? []) as { id: string; start_date: string; end_date: string; notes: string | null }[]) {
    lines.push('BEGIN:VEVENT',
      `UID:block-${bl.id}@locaflix.com.br`,
      `DTSTART;VALUE=DATE:${toIcalDate(bl.start_date)}`,
      `DTEND;VALUE=DATE:${toIcalDate(addDays(bl.end_date, 1))}`,
      `SUMMARY:${bl.notes ?? 'Bloqueado'}`, 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

type SyncProvider = 'AIRBNB' | 'BOOKING'

async function syncPropertyCalendar(propertyId: string, provider: SyncProvider, url: string): Promise<{ imported: number; removed: number }> {
  if (!url.startsWith('https://')) throw new Error('URL inválida: apenas https:// é permitido')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  let text: string
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Locaflix-Calendar/1.0' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar calendário`)
    text = await res.text()
  } finally {
    clearTimeout(timeout)
  }

  const events = parseIcal(text)
  const now = new Date().toISOString()

  // Upsert all current events to calendar_syncs
  for (const ev of events) {
    await adminSupabase.from('calendar_syncs').upsert({
      property_id: propertyId,
      provider,
      external_event_id: ev.uid,
      start_date: ev.start,
      end_date: ev.end,
      summary: ev.summary ?? null,
      updated_at: now,
    }, { onConflict: 'property_id,provider,external_event_id' })
  }

  // Remove events no longer in the feed
  const currentUids = new Set(events.map(e => e.uid))
  const { data: existing } = await adminSupabase.from('calendar_syncs')
    .select('id, external_event_id')
    .eq('property_id', propertyId)
    .eq('provider', provider)
  const toDelete = (existing ?? []).filter((s: { id: string; external_event_id: string }) => !currentUids.has(s.external_event_id))
  for (const s of toDelete) {
    await adminSupabase.from('calendar_syncs').delete().eq('id', s.id)
  }

  // Rebuild calendar_blocks for this provider (full replace)
  await adminSupabase.from('calendar_blocks').delete().eq('property_id', propertyId).eq('source', provider)
  if (events.length > 0) {
    await adminSupabase.from('calendar_blocks').insert(
      events.map(ev => ({
        property_id: propertyId,
        source: provider,
        start_date: ev.start,
        end_date: ev.end,
        notes: ev.summary ?? null,
      }))
    )
  }

  const syncField = provider === 'AIRBNB' ? 'ical_last_sync_airbnb' : 'ical_last_sync_booking'
  const errorField = provider === 'AIRBNB' ? 'ical_sync_error_airbnb' : 'ical_sync_error_booking'
  await adminSupabase.from('properties').update({ [syncField]: now, [errorField]: null }).eq('id', propertyId)

  return { imported: events.length, removed: toDelete.length }
}

async function syncAllProperties() {
  try {
    const { data: props } = await adminSupabase.from('properties')
      .select('id, ical_airbnb_url, ical_booking_url')
      .eq('status', 'ATIVO')
    if (!props) return
    for (const prop of props as { id: string; ical_airbnb_url: string | null; ical_booking_url: string | null }[]) {
      if (prop.ical_airbnb_url) {
        try {
          await syncPropertyCalendar(prop.id, 'AIRBNB', prop.ical_airbnb_url)
          console.log(`[CALENDAR_SYNC_SUCCESS] ${prop.id} AIRBNB`)
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Erro desconhecido'
          console.error(`[CALENDAR_SYNC_FAILED] ${prop.id} AIRBNB: ${msg}`)
          await adminSupabase.from('properties').update({ ical_sync_error_airbnb: msg }).eq('id', prop.id)
        }
      }
      if (prop.ical_booking_url) {
        try {
          await syncPropertyCalendar(prop.id, 'BOOKING', prop.ical_booking_url)
          console.log(`[CALENDAR_SYNC_SUCCESS] ${prop.id} BOOKING`)
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Erro desconhecido'
          console.error(`[CALENDAR_SYNC_FAILED] ${prop.id} BOOKING: ${msg}`)
          await adminSupabase.from('properties').update({ ical_sync_error_booking: msg }).eq('id', prop.id)
        }
      }
    }
  } catch (err) {
    console.error('[CALENDAR_SYNC_FAILED] syncAllProperties:', err)
  }
}

// Auto-sync a cada 5 minutos; primeira rodada 30s após startup
setTimeout(() => void syncAllProperties(), 30_000)
setInterval(() => void syncAllProperties(), 5 * 60 * 1000)

// ============================================================
// iCal — routes
// ============================================================

// GET /calendar/:propertyId.ics — exportação pública do calendário
app.get('/calendar/:propertyId.ics', async (req: Request, res: Response) => {
  try {
    const ical = await generateIcal(req.params.propertyId)
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="locaflix-${req.params.propertyId}.ics"`)
    res.setHeader('Cache-Control', 'no-cache, no-store')
    res.send(ical)
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' })
  }
})

// POST /api/calendar/sync/:propertyId — sincronização manual
app.post('/api/calendar/sync/:propertyId', requireAuth, async (req: Request, res: Response) => {
  const { propertyId } = req.params
  const { provider } = req.body as { provider?: SyncProvider }
  try {
    const { data: prop } = await adminSupabase.from('properties')
      .select('ical_airbnb_url, ical_booking_url')
      .eq('id', propertyId).single()
    if (!prop) { res.status(404).json({ error: 'Imóvel não encontrado' }); return }
    const results: { provider: string; imported: number; removed: number }[] = []
    const toSync: SyncProvider[] = provider ? [provider] : (['AIRBNB', 'BOOKING'] as SyncProvider[])
    for (const p of toSync) {
      const url = p === 'AIRBNB'
        ? (prop as { ical_airbnb_url: string | null }).ical_airbnb_url
        : (prop as { ical_booking_url: string | null }).ical_booking_url
      if (!url) continue
      const r = await syncPropertyCalendar(propertyId, p, url)
      results.push({ provider: p, ...r })
    }
    res.json({ success: true, results })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' })
  }
})

// GET /api/calendar/blocks/:propertyId — lista bloqueios do imóvel
app.get('/api/calendar/blocks/:propertyId', requireAuth, async (req: Request, res: Response) => {
  const { data } = await adminSupabase.from('calendar_blocks')
    .select('*').eq('property_id', req.params.propertyId).order('start_date')
  res.json(data ?? [])
})

// POST /api/calendar/blocks — cria bloqueio manual
app.post('/api/calendar/blocks', requireAuth, async (req: Request, res: Response) => {
  const { property_id, start_date, end_date, notes } = req.body as {
    property_id: string; start_date: string; end_date: string; notes?: string
  }
  if (!property_id || !start_date || !end_date) {
    res.status(400).json({ error: 'property_id, start_date e end_date são obrigatórios' }); return
  }
  const { data, error } = await adminSupabase.from('calendar_blocks')
    .insert({ property_id, start_date, end_date, source: 'MANUAL', notes: notes ?? null })
    .select().single()
  if (error) { res.status(500).json({ error: error.message }); return }
  console.log(`[CALENDAR_BLOCK_CREATED] ${property_id} MANUAL ${start_date}→${end_date}`)
  res.json(data)
})

// DELETE /api/calendar/blocks/:blockId — remove bloqueio manual
app.delete('/api/calendar/blocks/:blockId', requireAuth, async (req: Request, res: Response) => {
  const { error } = await adminSupabase.from('calendar_blocks').delete().eq('id', req.params.blockId)
  if (error) { res.status(500).json({ error: error.message }); return }
  console.log(`[CALENDAR_BLOCK_REMOVED] ${req.params.blockId}`)
  res.json({ success: true })
})

// ---- GET /api/upload/cloudinary-sign ----
// Returns a signed upload request for Cloudinary (keeps API secret server-side)
app.get('/api/upload/cloudinary-sign', requireAuth, (req: Request, res: Response) => {
  const apiSecret  = process.env.CLOUDINARY_API_SECRET
  const apiKey     = process.env.CLOUDINARY_API_KEY ?? process.env.VITE_CLOUDINARY_API_KEY
  const cloudName  = process.env.CLOUDINARY_CLOUD_NAME ?? process.env.VITE_CLOUDINARY_CLOUD_NAME

  if (!apiSecret || !apiKey || !cloudName) {
    res.status(503).json({ error: 'Cloudinary não configurado. Defina CLOUDINARY_API_SECRET, CLOUDINARY_API_KEY e CLOUDINARY_CLOUD_NAME no servidor.' })
    return
  }

  const timestamp = Math.round(Date.now() / 1000)
  const folder = 'property-photos'
  // Cloudinary signature: SHA1 of "folder=...&timestamp=..." + apiSecret
  const signature = createHash('sha1')
    .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex')

  res.json({ timestamp, signature, api_key: apiKey, cloud_name: cloudName, folder })
})

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
