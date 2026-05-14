// ============================================================
// LOCAFLIX — Modelo financeiro de taxação e cancelamento
// ============================================================

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ── Modelo de taxação ─────────────────────────────────────────

/**
 * DIVIDIDO: hóspede paga 14% extra, anfitrião perde 4% do repasse.
 * ÚNICO:    hóspede paga preço líquido, anfitrião perde 16% do repasse.
 * Em ambos, a plataforma arrecada ~18% do subtotal base.
 */
export type TipoModelo = 'dividido' | 'unico'

export interface ResultadoReserva {
  subtotalBase: number           // (preço × noites) + limpeza
  valorTaxaHospede: number       // taxa cobrada do hóspede (0 no modelo único)
  totalPagoPeloHospede: number   // o que sai do bolso do hóspede
  valorTaxaAnfitriao: number     // desconto retido do repasse do anfitrião
  repasseLiquidoAnfitriao: number
  lucroBrutoPlataforma: number   // taxaHospede + taxaAnfitriao
}

export function calcularReserva(
  precoDiaria: number,
  quantidadeNoites: number,
  taxaLimpeza: number = 0,
  tipoModelo: TipoModelo = 'dividido',
): ResultadoReserva {
  const subtotalBase = round2(precoDiaria * quantidadeNoites + taxaLimpeza)

  let valorTaxaHospede: number
  let valorTaxaAnfitriao: number

  if (tipoModelo === 'dividido') {
    valorTaxaHospede = round2(subtotalBase * 0.14)
    valorTaxaAnfitriao = round2(subtotalBase * 0.04)
  } else {
    // único: hóspede não vê taxa; anfitrião arca com os 16%
    valorTaxaHospede = 0
    valorTaxaAnfitriao = round2(subtotalBase * 0.16)
  }

  const totalPagoPeloHospede = round2(subtotalBase + valorTaxaHospede)
  const repasseLiquidoAnfitriao = round2(subtotalBase - valorTaxaAnfitriao)
  const lucroBrutoPlataforma = round2(valorTaxaHospede + valorTaxaAnfitriao)

  return {
    subtotalBase,
    valorTaxaHospede,
    totalPagoPeloHospede,
    valorTaxaAnfitriao,
    repasseLiquidoAnfitriao,
    lucroBrutoPlataforma,
  }
}

// ── Modelo de reembolso ───────────────────────────────────────

export type PoliticaCancelamento = 'leve' | 'moderada' | 'firme'

export interface ParamsCancelamento {
  valorTotalDaReserva: number    // total pago pelo hóspede
  valorTotalDiarias: number      // apenas as diárias (sem taxa de limpeza)
  valorJaPagoViaPix: number      // parcelas efetivamente pagas até o momento
  valorTaxaLimpeza: number
  dataDaCompra: Date
  dataDoCancelamento: Date
  dataCheckIn: Date
  politicaCancelamento: PoliticaCancelamento
}

export interface ResultadoCancelamento {
  totalPagoAteMomento: number
  valorPenalidadeRetido: number  // valor que a plataforma/anfitrião retém
  valorEstornoHospede: number    // devolvido ao hóspede
  saldoDevedorHospede: number    // se hóspede deve mais (parcelas futuras que serão canceladas)
  creditoAnfitriao: number       // crédito gerado para o anfitrião após regras
  receitaRetidaPlataforma: number
  motivo: string                 // descrição da regra aplicada
}

function diffDays(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86400000)
}

export function calcularReembolso(params: ParamsCancelamento): ResultadoCancelamento {
  const {
    valorTotalDaReserva,
    valorJaPagoViaPix,
    valorTaxaLimpeza,
    dataDaCompra,
    dataDoCancelamento,
    dataCheckIn,
    politicaCancelamento,
  } = params

  const diasDesdeCompra = diffDays(dataDaCompra, dataDoCancelamento)
  const diasAteCheckIn = diffDays(dataDoCancelamento, dataCheckIn)
  const totalPagoAteMomento = round2(valorJaPagoViaPix)

  // CDC Art. 49 — direito de arrependimento: 7 dias após compra = 100% reembolso
  if (diasDesdeCompra <= 7) {
    const valorEstornoHospede = round2(totalPagoAteMomento)
    return {
      totalPagoAteMomento,
      valorPenalidadeRetido: 0,
      valorEstornoHospede,
      saldoDevedorHospede: 0,
      creditoAnfitriao: 0,
      receitaRetidaPlataforma: 0,
      motivo: 'CDC Art. 49 — Cancelamento em até 7 dias da compra: reembolso integral.',
    }
  }

  // Janelas por política
  type Janela = { reembolsoTotal: number; reembolso50: number; semReembolso: number }
  const janelas: Record<PoliticaCancelamento, Janela> = {
    leve:     { reembolsoTotal: 7,  reembolso50: 0,  semReembolso: 0 },
    moderada: { reembolsoTotal: 15, reembolso50: 7,  semReembolso: 0 },
    firme:    { reembolsoTotal: 30, reembolso50: 14, semReembolso: 0 },
  }
  const j = janelas[politicaCancelamento]

  let percentualReembolsoBase: number
  let motivo: string

  if (diasAteCheckIn >= j.reembolsoTotal) {
    percentualReembolsoBase = 1.0
    motivo = `Cancelamento com ${diasAteCheckIn} dias de antecedência — reembolso integral.`
  } else if (j.reembolso50 > 0 && diasAteCheckIn >= j.reembolso50) {
    percentualReembolsoBase = 0.5
    motivo = `Cancelamento com ${diasAteCheckIn} dias de antecedência — reembolso de 50%.`
  } else {
    percentualReembolsoBase = 0
    motivo = `Cancelamento tardio (${diasAteCheckIn}d antes do check-in) — sem reembolso de diárias.`
  }

  // Taxa de limpeza sempre retida se cancelamento após 24h da compra
  const reembolsoDiarias = round2((valorTotalDaReserva - valorTaxaLimpeza) * percentualReembolsoBase)
  const reembolsoLimpeza = percentualReembolsoBase === 1.0 ? round2(valorTaxaLimpeza) : 0
  const valorEstornoHospede = round2(Math.min(reembolsoDiarias + reembolsoLimpeza, totalPagoAteMomento))
  const valorPenalidadeRetido = round2(totalPagoAteMomento - valorEstornoHospede)

  // Hóspede ainda deve parcelas futuras? (saldo devedor = 0, pois não pagou)
  const saldoDevedorHospede = 0

  // Plataforma retém 50% da penalidade; restante vai para o anfitrião
  const receitaRetidaPlataforma = round2(valorPenalidadeRetido * 0.5)
  const creditoAnfitriao = round2(valorPenalidadeRetido - receitaRetidaPlataforma)

  return {
    totalPagoAteMomento,
    valorPenalidadeRetido,
    valorEstornoHospede,
    saldoDevedorHospede,
    creditoAnfitriao,
    receitaRetidaPlataforma,
    motivo,
  }
}

// ── Payload Asaas ─────────────────────────────────────────────

export interface AsaasCustomer {
  name: string
  cpf: string
  email?: string
  phone?: string
}

export interface AsaasPaymentInput {
  customerId: string       // ID retornado pelo POST /customers
  value: number
  dueDate: string          // YYYY-MM-DD
  description?: string
  externalReference?: string
}

export interface AsaasPaymentPayload {
  customer: string
  billingType: 'PIX'
  value: number
  dueDate: string
  description?: string
  externalReference?: string
  fine: { value: number; type: 'PERCENTAGE' }
  interest: { value: number; type: 'MONTHLY' }
}

export function formatarPayloadAsaas(input: AsaasPaymentInput): AsaasPaymentPayload {
  return {
    customer: input.customerId,
    billingType: 'PIX',
    value: round2(input.value),
    dueDate: input.dueDate,
    description: input.description,
    externalReference: input.externalReference,
    fine:     { value: 2.00, type: 'PERCENTAGE' },   // 2% de multa por atraso
    interest: { value: 1.00, type: 'MONTHLY' },       // 1% ao mês de juros
  }
}

// ── Helpers expostos ──────────────────────────────────────────

/**
 * Calcula quanto o hóspede paga a mais em juros compostos simples após N dias
 * com base na multa (2%) + juros diários (1%/30 por dia).
 */
export function calcularValorAtualizado(
  valorOriginal: number,
  diasAtraso: number,
): number {
  if (diasAtraso <= 0) return round2(valorOriginal)
  const multa = valorOriginal * 0.02
  const jurosDiario = valorOriginal * (0.01 / 30)
  return round2(valorOriginal + multa + jurosDiario * diasAtraso)
}

/*
// ── TESTES UNITÁRIOS (comentados) ─────────────────────────────

// calcularReserva — modelo dividido
const r1 = calcularReserva(500, 3, 100, 'dividido')
// subtotalBase = 1600, taxaHospede = 224, total = 1824
// taxaAnfitriao = 64, repasseLiquido = 1536, lucro = 288
console.assert(r1.subtotalBase === 1600, 'subtotalBase dividido')
console.assert(r1.valorTaxaHospede === 224, 'taxaHospede dividido')
console.assert(r1.totalPagoPeloHospede === 1824, 'totalHospede dividido')
console.assert(r1.repasseLiquidoAnfitriao === 1536, 'repasseAnfitriao dividido')
console.assert(r1.lucroBrutoPlataforma === 288, 'lucroPlataforma dividido')

// calcularReserva — modelo único
const r2 = calcularReserva(500, 3, 100, 'unico')
// taxaHospede = 0, total = 1600
// taxaAnfitriao = 256, repasse = 1344, lucro = 256
console.assert(r2.valorTaxaHospede === 0, 'taxaHospede unico')
console.assert(r2.totalPagoPeloHospede === 1600, 'totalHospede unico')
console.assert(r2.repasseLiquidoAnfitriao === 1344, 'repasseAnfitriao unico')

// calcularReembolso — CDC 7 dias
const r3 = calcularReembolso({
  valorTotalDaReserva: 1824, valorTotalDiarias: 1500, valorJaPagoViaPix: 1824,
  valorTaxaLimpeza: 100,
  dataDaCompra: new Date('2025-01-01'), dataDoCancelamento: new Date('2025-01-05'),
  dataCheckIn: new Date('2025-02-01'), politicaCancelamento: 'moderada',
})
console.assert(r3.valorEstornoHospede === 1824, 'CDC 7 dias = reembolso total')

// calcularReembolso — firme, 5 dias antes: sem reembolso
const r4 = calcularReembolso({
  valorTotalDaReserva: 1824, valorTotalDiarias: 1500, valorJaPagoViaPix: 1824,
  valorTaxaLimpeza: 100,
  dataDaCompra: new Date('2025-01-01'), dataDoCancelamento: new Date('2025-02-23'),
  dataCheckIn: new Date('2025-02-28'), politicaCancelamento: 'firme',
})
console.assert(r4.valorEstornoHospede === 0, 'firme tardio = sem reembolso')
console.assert(r4.valorPenalidadeRetido === 1824, 'firme tardio = retenção total')

// calcularValorAtualizado — 30 dias de atraso
const r5 = calcularValorAtualizado(1000, 30)
// multa 2% = 20, juros 1%/mês × 30 dias = 10 → total = 1030
console.assert(r5 === 1030, `valAtualizado esperado 1030 obteve ${r5}`)
*/
