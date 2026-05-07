import { format, parseISO, addDays, addMonths, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { InstallmentPreview, InsurancePlan } from '../types'

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
}

export function formatShortDate(dateStr: string): string {
  return format(parseISO(dateStr), 'dd/MM/yyyy')
}

export function fromISODateString(isoDate: string): Date {
  return parseISO(isoDate)
}

export function toISODateString(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function daysUntil(dateStr: string): number {
  return differenceInDays(parseISO(dateStr), new Date())
}

export function addDaysToISO(dateStr: string, days: number): string {
  return toISODateString(addDays(parseISO(dateStr), days))
}

export const INSURANCE_PRICES: Record<InsurancePlan, number> = {
  NENHUM: 0,
  BASICO: 5,
  PADRAO: 12,
  PREMIUM: 25,
}

export function calculateInsuranceAmount(plan: InsurancePlan, nights: number): number {
  return INSURANCE_PRICES[plan] * nights
}

export function calculatePlatformFee(subtotal: number, feePercent = 0.05): number {
  return Math.round(subtotal * feePercent * 100) / 100
}

/**
 * Retorna o número máximo de parcelas mensais possíveis.
 * Regra: última parcela vence no máximo 7 dias antes do check-in.
 * Vencimentos sempre no mesmo dia do mês da reserva (bookingDate, padrão = hoje).
 */
export function calculateMaxInstallments(checkInDate: string, bookingDate?: string): number {
  if (!checkInDate) return 1
  const today = new Date(bookingDate ? bookingDate + 'T00:00:00' : Date.now())
  today.setHours(0, 0, 0, 0)
  const checkIn = new Date(checkInDate + 'T00:00:00')
  const latestDue = addDays(checkIn, -7)
  let count = 1
  while (count < 24) {
    const next = addMonths(today, count)
    if (next > latestDue) break
    count++
  }
  return Math.max(1, count)
}

/**
 * Calcula parcelas mensais com vencimento fixo no mesmo dia do mês da reserva.
 * - Parcela 1 (ENTRADA): hoje
 * - Demais: mesmo dia do mês, mensalmente
 * - Última: no máximo 7 dias antes do check-in
 */
export function calculateInstallments(
  totalAmount: number,
  count: number,
  checkInDate: string,
  bookingDate?: string,
): InstallmentPreview[] {
  if (count <= 0 || !checkInDate) return []

  const today = new Date(bookingDate ? bookingDate + 'T00:00:00' : Date.now())
  today.setHours(0, 0, 0, 0)
  const checkIn = new Date(checkInDate + 'T00:00:00')
  const latestDue = addDays(checkIn, -7)
  const dayOfMonth = today.getDate()

  // Garante que a última parcela cabe antes do prazo
  let actual = Math.max(1, count)
  while (actual > 1) {
    const lastDate = addMonths(today, actual - 1)
    if (lastDate <= latestDue) break
    actual--
  }

  const base = Math.floor((totalAmount / actual) * 100) / 100
  const remainder = Math.round((totalAmount - base * actual) * 100) / 100

  return Array.from({ length: actual }, (_, i) => {
    let dueDate: Date
    if (i === 0) {
      dueDate = new Date(today)
    } else {
      const m = addMonths(today, i)
      const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()
      dueDate = new Date(m.getFullYear(), m.getMonth(), Math.min(dayOfMonth, daysInMonth))
      if (dueDate > latestDue) dueDate = new Date(latestDue)
    }
    return {
      number: i + 1,
      value: Math.round((i === actual - 1 ? base + remainder : base) * 100) / 100,
      due_date: toISODateString(dueDate),
      type: i === 0 ? 'ENTRADA' : 'PARCELA',
    } satisfies InstallmentPreview
  })
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function generateBookingCode(): string {
  return 'LFX-' + Math.random().toString(36).substring(2, 10).toUpperCase()
}

export function maskCPF(cpf: string): string {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return `${d.slice(0, 3)}.***.***-${d.slice(9)}`
}

export function formatCPF(cpf: string): string {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return phone
}

export function formatCEP(cep: string): string {
  const d = cep.replace(/\D/g, '')
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : cep
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max) + '...'
}

export function getInitials(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
