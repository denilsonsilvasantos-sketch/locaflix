import { useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, addDays, isBefore, isAfter, isSameDay,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from './Button'

interface DateRangePickerProps {
  from: string   // 'yyyy-MM-dd' or ''
  to: string     // 'yyyy-MM-dd' or ''
  onChange: (from: string, to: string) => void
  onClose: () => void
  blockedDates?: string[]  // 'yyyy-MM-dd' dates unavailable for selection
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function toDate(iso: string): Date | null {
  if (!iso) return null
  const d = new Date(iso + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

function toISO(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

export function DateRangePicker({ from, to, onChange, onClose, blockedDates = [] }: DateRangePickerProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const blockedSet = new Set(blockedDates)

  function isBlocked(date: Date): boolean {
    return blockedSet.has(format(date, 'yyyy-MM-dd'))
  }

  function rangeHasBlocked(from: Date, to: Date): boolean {
    if (blockedDates.length === 0) return false
    const [a, b] = isBefore(from, to) ? [from, to] : [to, from]
    return blockedDates.some(d => {
      const bd = new Date(d + 'T00:00:00')
      return isAfter(bd, a) && isBefore(bd, b)
    })
  }

  const [leftMonth, setLeftMonth] = useState(() => {
    const f = toDate(from)
    return startOfMonth(f && !isBefore(f, today) ? f : today)
  })
  const rightMonth = addMonths(leftMonth, 1)

  const [draftFrom, setDraftFrom] = useState<Date | null>(toDate(from))
  const [draftTo, setDraftTo] = useState<Date | null>(toDate(to))
  const [hover, setHover] = useState<Date | null>(null)
  const [phase, setPhase] = useState<'from' | 'to'>(from && !to ? 'to' : 'from')

  const nights =
    draftFrom && draftTo
      ? Math.floor((draftTo.getTime() - draftFrom.getTime()) / 86400000)
      : null

  function handleDay(date: Date) {
    if (isBefore(date, today) || isBlocked(date)) return
    if (phase === 'from') {
      setDraftFrom(date)
      setDraftTo(null)
      setPhase('to')
    } else {
      if (!draftFrom || isBefore(date, draftFrom) || isSameDay(date, draftFrom)) {
        setDraftFrom(date)
        setDraftTo(null)
        setPhase('to')
      } else if (rangeHasBlocked(draftFrom, date)) {
        // Range crosses a blocked date — restart selection from clicked date
        setDraftFrom(date)
        setDraftTo(null)
        setPhase('to')
      } else {
        setDraftTo(date)
        setPhase('from')
      }
    }
  }

  function inRange(date: Date): boolean {
    const effectiveTo = phase === 'to' && hover && draftFrom ? hover : draftTo
    if (!draftFrom || !effectiveTo) return false
    const [a, b] = isBefore(draftFrom, effectiveTo)
      ? [draftFrom, effectiveTo]
      : [effectiveTo, draftFrom]
    return isAfter(date, a) && isBefore(date, b)
  }

  function handleOK() {
    onChange(draftFrom ? toISO(draftFrom) : '', draftTo ? toISO(draftTo) : '')
    onClose()
  }

  function renderGrid(month: Date) {
    const monthStart = startOfMonth(month)
    const monthEnd = endOfMonth(month)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

    const days: Date[] = []
    let d = new Date(calStart)
    while (!isAfter(d, calEnd)) {
      days.push(new Date(d))
      d = addDays(d, 1)
    }

    return (
      <div className="flex-1 min-w-[240px]">
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(wd => (
            <div key={wd} className="text-center text-[10px] text-[#555] font-semibold py-1">{wd}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const inMonth = day.getMonth() === month.getMonth()
            const isPast = isBefore(day, today)
            const isDayBlocked = isBlocked(day)
            const isFrom = draftFrom ? isSameDay(day, draftFrom) : false
            const effectiveTo = phase === 'to' && hover && draftFrom ? hover : draftTo
            const isTo = effectiveTo ? isSameDay(day, effectiveTo) : false
            const ranged = inRange(day)
            const isToday = isSameDay(day, today)
            const disabled = isPast || isDayBlocked

            if (!inMonth) return <div key={i} className="h-9" />

            return (
              <div
                key={i}
                className={`relative h-9 flex items-center justify-center
                  ${ranged ? 'bg-[#E50914]/15' : ''}
                  ${isFrom && ranged ? 'rounded-l-full' : ''}
                  ${isTo && ranged ? 'rounded-r-full' : ''}
                `}
              >
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleDay(day)}
                  onMouseEnter={() => {
                    if (phase === 'to' && draftFrom && !disabled) setHover(day)
                  }}
                  onMouseLeave={() => setHover(null)}
                  className={[
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all relative',
                    disabled ? 'cursor-not-allowed' : 'cursor-pointer',
                    isDayBlocked ? 'text-[#3A3A3A] line-through' : '',
                    isPast && !isDayBlocked ? 'text-[#3A3A3A]' : '',
                    isFrom || isTo ? 'bg-[#E50914] text-white font-bold shadow-lg' : '',
                    !isFrom && !isTo && !disabled ? 'hover:bg-[#2A2A2A] text-white' : '',
                    ranged && !isFrom && !isTo ? 'text-white' : '',
                    isToday && !isFrom && !isTo && !isDayBlocked ? 'font-bold text-[#E50914]' : '',
                  ].filter(Boolean).join(' ')}
                >
                  {day.getDate()}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const canPrev = isAfter(leftMonth, startOfMonth(today))

  return (
    <div className="bg-[#1A1A1A] border border-[#333] rounded-2xl shadow-2xl p-5 w-max min-w-[320px]">
      {/* Status bar */}
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#2A2A2A]">
        <button
          type="button"
          onClick={() => setPhase('from')}
          className={`flex-1 text-center p-2.5 rounded-xl border transition-all ${phase === 'from' ? 'border-[#E50914] bg-[#E50914]/10' : 'border-[#2A2A2A] hover:border-[#444]'}`}
        >
          <p className="text-[10px] text-[#B3B3B3] uppercase font-semibold tracking-wide">Check-in</p>
          <p className="text-sm font-bold text-white mt-0.5">
            {draftFrom ? format(draftFrom, 'dd MMM', { locale: ptBR }) : '—'}
          </p>
        </button>

        <div className="flex flex-col items-center gap-1">
          {nights && nights > 0 ? (
            <span className="text-xs font-semibold text-[#46D369] whitespace-nowrap">{nights}n</span>
          ) : (
            <div className="w-5 h-px bg-[#333]" />
          )}
        </div>

        <button
          type="button"
          onClick={() => draftFrom && setPhase('to')}
          className={`flex-1 text-center p-2.5 rounded-xl border transition-all ${phase === 'to' ? 'border-[#E50914] bg-[#E50914]/10' : 'border-[#2A2A2A] hover:border-[#444]'}`}
        >
          <p className="text-[10px] text-[#B3B3B3] uppercase font-semibold tracking-wide">Check-out</p>
          <p className="text-sm font-bold text-white mt-0.5">
            {draftTo ? format(draftTo, 'dd MMM', { locale: ptBR }) : '—'}
          </p>
        </button>

        <button onClick={onClose} className="text-[#555] hover:text-white transition-colors ml-1">
          <X size={16} />
        </button>
      </div>

      {/* Two-month grid */}
      <div className="flex gap-6">
        {/* Left */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => canPrev && setLeftMonth(m => subMonths(m, 1))}
              disabled={!canPrev}
              className="w-7 h-7 rounded-full bg-[#2A2A2A] flex items-center justify-center text-[#B3B3B3] hover:text-white disabled:opacity-20 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <p className="text-sm font-semibold text-white capitalize">
              {format(leftMonth, 'MMMM yyyy', { locale: ptBR })}
            </p>
            <button
              type="button"
              onClick={() => setLeftMonth(m => addMonths(m, 1))}
              className="w-7 h-7 rounded-full bg-[#2A2A2A] flex items-center justify-center text-[#B3B3B3] hover:text-white transition-colors sm:hidden"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          {renderGrid(leftMonth)}
        </div>

        <div className="w-px bg-[#2A2A2A] hidden sm:block" />

        {/* Right */}
        <div className="flex-1 hidden sm:block">
          <div className="flex items-center justify-between mb-3">
            <div className="w-7" />
            <p className="text-sm font-semibold text-white capitalize">
              {format(rightMonth, 'MMMM yyyy', { locale: ptBR })}
            </p>
            <button
              type="button"
              onClick={() => setLeftMonth(m => addMonths(m, 1))}
              className="w-7 h-7 rounded-full bg-[#2A2A2A] flex items-center justify-center text-[#B3B3B3] hover:text-white transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          {renderGrid(rightMonth)}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#2A2A2A]">
        <button
          type="button"
          onClick={() => { setDraftFrom(null); setDraftTo(null); setPhase('from') }}
          className="text-xs text-[#666] hover:text-white transition-colors"
        >
          Limpar datas
        </button>
        <div className="flex items-center gap-3">
          {nights && nights > 0 && (
            <span className="text-xs text-[#B3B3B3]">
              {nights} {nights === 1 ? 'noite' : 'noites'}
            </span>
          )}
          <Button size="sm" onClick={handleOK} disabled={!draftFrom}>
            OK
          </Button>
        </div>
      </div>
    </div>
  )
}
