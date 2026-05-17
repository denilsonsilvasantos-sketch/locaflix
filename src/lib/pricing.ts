import type { PricePeriod, PeriodType } from '../types'

// ── Labels PT-BR ──────────────────────────────────────────────

export const PERIOD_TYPE_LABELS: Record<PeriodType, string> = {
  WEEKDAY:           'Dias úteis (Seg–Qui)',
  WEEKEND:           'Final de semana (Sex–Dom)',
  HOLIDAY:           'Feriados nacionais',
  CHRISTMAS_NEW_YEAR:'Natal / Réveillon (20/dez – 05/jan)',
  CARNIVAL:          'Carnaval',
  HIGH_SEASON:       'Alta temporada (período personalizado)',
  LOW_SEASON:        'Baixa temporada (período personalizado)',
  CUSTOM:            'Período personalizado',
}

export const PERIOD_DEFAULT_NAMES: Record<PeriodType, string> = {
  WEEKDAY:           'Dias úteis',
  WEEKEND:           'Final de semana',
  HOLIDAY:           'Feriados',
  CHRISTMAS_NEW_YEAR:'Natal / Réveillon',
  CARNIVAL:          'Carnaval',
  HIGH_SEASON:       'Alta temporada',
  LOW_SEASON:        'Baixa temporada',
  CUSTOM:            'Período especial',
}

export const PERIOD_TYPES_WITH_DATES: PeriodType[] = ['HIGH_SEASON', 'LOW_SEASON', 'CUSTOM']

// ── Brazilian holidays ────────────────────────────────────────

const BR_FIXED_HOLIDAYS = [
  { month: 1,  day: 1  }, // Ano Novo
  { month: 4,  day: 21 }, // Tiradentes
  { month: 5,  day: 1  }, // Dia do Trabalho
  { month: 9,  day: 7  }, // Independência
  { month: 10, day: 12 }, // N. Sra. Aparecida
  { month: 11, day: 2  }, // Finados
  { month: 11, day: 15 }, // Proclamação da República
  { month: 12, day: 25 }, // Natal
]

// Meeus/Jones/Butcher algorithm for Easter Sunday
function getEaster(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function dayOnly(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

function isBrazilianHoliday(date: Date): boolean {
  const month = date.getMonth() + 1
  const day = date.getDate()
  if (BR_FIXED_HOLIDAYS.some(h => h.month === month && h.day === day)) return true

  const easter = getEaster(date.getFullYear())
  const easterMs = dayOnly(easter)
  const dateMs = dayOnly(date)
  const goodFriday = easterMs - 2 * 86400000
  const corpusChristi = easterMs + 60 * 86400000
  return dateMs === goodFriday || dateMs === corpusChristi
}

function isChristmasNewYear(date: Date): boolean {
  const month = date.getMonth() + 1
  const day = date.getDate()
  return (month === 12 && day >= 20) || (month === 1 && day <= 5)
}

function isCarnival(date: Date): boolean {
  const easter = getEaster(date.getFullYear())
  const easterMs = dayOnly(easter)
  const dateMs = dayOnly(date)
  // Carnival: Saturday (Easter-50) through Tuesday (Easter-47)
  return dateMs >= easterMs - 50 * 86400000 && dateMs <= easterMs - 47 * 86400000
}

function isBetween(date: Date, startISO: string, endISO: string): boolean {
  const d = dayOnly(date)
  const [sy, sm, sd] = startISO.split('-').map(Number)
  const [ey, em, ed] = endISO.split('-').map(Number)
  const s = Date.UTC(sy, sm - 1, sd)  // Date.UTC month is 0-indexed
  const e = Date.UTC(ey, em - 1, ed)
  return d >= s && d <= e
}

function periodApplies(period: PricePeriod, date: Date): boolean {
  const dow = date.getDay()
  switch (period.period_type) {
    case 'WEEKDAY':
      return dow >= 1 && dow <= 4 && !isBrazilianHoliday(date)
    case 'WEEKEND':
      return dow === 0 || dow === 5 || dow === 6 || isBrazilianHoliday(date)
    case 'HOLIDAY':
      return isBrazilianHoliday(date)
    case 'CHRISTMAS_NEW_YEAR':
      return isChristmasNewYear(date)
    case 'CARNIVAL':
      return isCarnival(date)
    case 'HIGH_SEASON':
    case 'LOW_SEASON':
    case 'CUSTOM':
      if (!period.start_date || !period.end_date) return false
      return isBetween(date, period.start_date, period.end_date)
  }
}

// ── Public API ────────────────────────────────────────────────

export interface DayPrice {
  price: number
  periodName: string
}

export function getPriceForDate(date: Date, periods: PricePeriod[], defaultPrice: number): DayPrice {
  const sorted = [...periods]
    .filter(p => p.active)
    .sort((a, b) => b.priority - a.priority || b.price_per_night - a.price_per_night)

  for (const period of sorted) {
    if (periodApplies(period, date)) {
      return { price: period.price_per_night, periodName: period.name }
    }
  }
  return { price: defaultPrice, periodName: 'Diária padrão' }
}

export interface PeriodSummary {
  periodName: string
  nights: number
  pricePerNight: number
}

export interface EstadiaResult {
  total: number
  summary: PeriodSummary[]
}

export function calcularEstadia(
  checkIn: Date,
  checkOut: Date,
  periods: PricePeriod[],
  defaultPrice: number,
): EstadiaResult {
  const summaryMap = new Map<string, PeriodSummary>()
  const current = new Date(checkIn)
  let total = 0

  while (current < checkOut) {
    const { price, periodName } = getPriceForDate(current, periods, defaultPrice)
    total += price
    const existing = summaryMap.get(periodName)
    if (existing) {
      existing.nights++
    } else {
      summaryMap.set(periodName, { periodName, nights: 1, pricePerNight: price })
    }
    current.setDate(current.getDate() + 1)
  }

  return { total, summary: Array.from(summaryMap.values()) }
}

export function getMinPrice(periods: PricePeriod[], defaultPrice: number): number {
  const active = periods.filter(p => p.active)
  if (active.length === 0) return defaultPrice
  return Math.min(...active.map(p => p.price_per_night), defaultPrice)
}
