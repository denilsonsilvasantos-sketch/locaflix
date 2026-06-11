import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Booking, UserProfile } from '../types'
import { formatCurrency, formatCPF, maskCPF } from './utils'

interface PaymentInfo {
  method: 'PIX' | 'BOLETO' | 'CARTAO'
  installmentCount?: number
  cardFeePercent?: number
  cardFeeValue?: number
  total: number
}

interface DbPolicyRule {
  days_before: number
  refund_percentage: number
  description: string
}

interface ContractParams {
  booking: Booking
  guest: UserProfile
  owner: UserProfile
  ipAddress: string
  userAgent: string
  paymentInfo?: PaymentInfo
  policyRules?: DbPolicyRule[]
  houseRules?: string | null
}

export function generateContractContent(params: ContractParams): string {
  const { booking, guest, owner, ipAddress, userAgent, paymentInfo, policyRules, houseRules } = params
  const now = new Date()
  const acceptedAt = format(now, "dd 'de' MMMM 'de' yyyy 'às' HH:mm:ss", { locale: ptBR })

  const ownerFirstName = (owner.name ?? 'Anfitrião').split(' ')[0]
  const ownerCPFMasked = owner.cpf ? maskCPF(owner.cpf) : '***.***.***-**'
  const propertyCode = `IMOVEL-${booking.property_id.substring(0, 8).toUpperCase()}`

  const checkIn = format(new Date(booking.check_in + 'T00:00:00'), "dd/MM/yyyy")
  const checkOut = format(new Date(booking.check_out + 'T00:00:00'), "dd/MM/yyyy")

  return `CONTRATO DE INTERMEDIAÇÃO DE LOCAÇÃO POR TEMPORADA

Número da Reserva: ${booking.booking_number ?? booking.id}
Data de Aceite: ${acceptedAt}
Versão: 1.0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INTERMEDIADORA:
LOCAFLIX Plataforma Digital
CNPJ: 45.524.502/0001-50
Atuando como plataforma de intermediação, nos termos da legislação vigente.

LOCADOR (Anfitrião):
Nome: ${ownerFirstName}
CPF: ${ownerCPFMasked}
(Dados completos em poder da plataforma, protegidos pela LGPD)

LOCATÁRIO (Hóspede):
Nome: ${guest.name ?? ''}
CPF: ${guest.cpf ? formatCPF(guest.cpf) : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DO IMÓVEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cód. interno: ${propertyCode}
Tipo: ${booking.property?.type ?? '—'}
Localidade: ${booking.property?.city ?? '—'} / ${booking.property?.state ?? '—'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DA LOCAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Check-in:  ${checkIn} (a partir das 14h)
Check-out: ${checkOut} (até as 12h)
Número de noites: ${booking.nights}
Hóspedes: ${booking.total_guests}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOS VALORES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Subtotal da estadia: ${formatCurrency(booking.subtotal)}
Taxa de serviço:     ${formatCurrency(booking.platform_fee)}
Desconto aplicado:   ${formatCurrency(booking.discount_amount)}
TOTAL:               ${formatCurrency(booking.total_price)}

${paymentInfo ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DA FORMA DE PAGAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${paymentInfo.method === 'CARTAO'
  ? `Forma de pagamento: Cartão de Crédito
Número de parcelas: ${paymentInfo.installmentCount === 1 ? 'À vista' : `${paymentInfo.installmentCount}x`}
${paymentInfo.cardFeePercent && paymentInfo.cardFeePercent > 0
  ? `Taxa de parcelamento: ${paymentInfo.cardFeePercent.toFixed(2).replace('.', ',')}%
Valor da taxa: ${formatCurrency(paymentInfo.cardFeeValue ?? 0)}`
  : 'Sem taxa de parcelamento (pagamento à vista)'}
Total cobrado no cartão: ${formatCurrency(paymentInfo.total)}`
  : `Forma de pagamento: ${paymentInfo.method === 'PIX' ? 'Pix' : 'Boleto Bancário'}
Parcelamento: ${paymentInfo.installmentCount && paymentInfo.installmentCount > 1 ? `${paymentInfo.installmentCount}x` : 'À vista'}
Total: ${formatCurrency(paymentInfo.total)}`}

` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DA POLÍTICA DE CANCELAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${getCancellationPolicyText(booking.property?.cancellation_policy ?? 'MODERADO', policyRules)}

${houseRules ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS DA CASA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${houseRules}

` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DISPOSIÇÕES GERAIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. A LOCAFLIX atua como intermediadora entre locador e locatário, não sendo parte
   direta na relação de locação.

2. O presente contrato é celebrado em conformidade com a Medida Provisória nº 2.200-2,
   de 24 de agosto de 2001, e com a Lei nº 14.063, de 23 de setembro de 2020,
   sendo válido como documento eletrônico com força probante.

3. O locatário declara ter lido e compreendido todas as cláusulas deste instrumento.

4. A assinatura eletrônica ocorre pelo aceite digital na plataforma, registrado com
   data, hora, endereço IP e agente de navegação do usuário.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGISTRO DE ACEITE ELETRÔNICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Data/Hora: ${acceptedAt}
IP de origem: ${ipAddress}
User-Agent: ${userAgent}

Ao clicar em "Aceitar e Assinar", o locatário atesta que leu e concordou
com todos os termos deste contrato, cuja validade legal é garantida pela
MP 2.200-2/2001 e Lei 14.063/2020.
`
}

function getCancellationPolicyText(policy: string, rules?: DbPolicyRule[]): string {
  const names: Record<string, string> = {
    LEVE: 'POLÍTICA LEVE', MODERADO: 'POLÍTICA MODERADA', FIRME: 'POLÍTICA FIRME',
  }
  const name = names[policy] ?? 'POLÍTICA DE CANCELAMENTO'

  if (rules && rules.length > 0) {
    const sorted = [...rules].sort((a, b) => b.days_before - a.days_before)
    const lines = sorted.map(r =>
      `• ${r.description || (
        r.refund_percentage === 100
          ? `Cancelamento gratuito até ${r.days_before} dias antes do check-in.`
          : r.refund_percentage === 0
          ? `Sem reembolso a menos de ${r.days_before} dias do check-in.`
          : `Reembolso de ${r.refund_percentage}% até ${r.days_before} dias do check-in.`
      )}`
    )
    return `${name}\n${lines.join('\n')}`
  }

  const fallback: Record<string, string> = {
    LEVE: `${name}
• Cancelamento gratuito até 48h antes do check-in.
• Reembolso de 100% do valor pago (exceto taxa de serviço).
• Sem reembolso a menos de 48h do check-in.`,
    MODERADO: `${name}
• Cancelamento gratuito até 15 dias antes do check-in.
• Sem reembolso a menos de 15 dias do check-in.`,
    FIRME: `${name}
• Cancelamento gratuito até 30 dias antes do check-in.
• Sem reembolso a menos de 30 dias do check-in.`,
  }
  return fallback[policy] ?? fallback.MODERADO
}
