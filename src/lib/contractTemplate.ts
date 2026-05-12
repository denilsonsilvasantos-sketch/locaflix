import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Booking, UserProfile } from '../types'
import { formatCurrency, formatCPF, maskCPF } from './utils'

interface ContractParams {
  booking: Booking
  guest: UserProfile
  owner: UserProfile
  ipAddress: string
  userAgent: string
}

export function generateContractContent(params: ContractParams): string {
  const { booking, guest, owner, ipAddress, userAgent } = params
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
CNPJ: [A SER REGISTRADO]
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

Subtotal da estadia:  ${formatCurrency(booking.subtotal)}
Taxa de serviço (5%): ${formatCurrency(booking.platform_fee)}
Seguro viagem:        ${formatCurrency(booking.insurance_amount)}
Desconto aplicado:    ${formatCurrency(booking.discount_amount)}
TOTAL:                ${formatCurrency(booking.total_price)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DA POLÍTICA DE CANCELAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${getCancellationPolicyText(booking.property?.cancellation_policy ?? 'MODERADO')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

function getCancellationPolicyText(policy: string): string {
  const policies: Record<string, string> = {
    FLEXIVEL: `POLÍTICA FLEXÍVEL
• Cancelamento gratuito até 24h antes do check-in.
• Reembolso de 100% do valor pago (exceto taxa de serviço).
• Após 24h do check-in: sem reembolso.`,
    MODERADO: `POLÍTICA MODERADA
• Cancelamento gratuito até 5 dias antes do check-in.
• Reembolso de 50% do valor pago entre 2 e 5 dias antes.
• Sem reembolso a menos de 2 dias do check-in.`,
    FIRME: `POLÍTICA FIRME
• Cancelamento gratuito até 14 dias antes do check-in.
• Reembolso de 50% entre 7 e 14 dias antes.
• Sem reembolso a menos de 7 dias do check-in.`,
  }
  return policies[policy] ?? policies.MODERADO
}
