import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, addDays, isAfter, isBefore, isSameDay,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../hooks/useToast'

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface Props {
  propertyId: string
}

export function AvailabilityCalendar({ propertyId }: Props) {
  const { toast } = useToast()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [blocked, setBlocked] = useState<Set<string>>(new Set())
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    void load()
  }, [propertyId])

  async function load() {
    const { data } = await supabase
      .from('blocked_dates')
      .select('blocked_date')
      .eq('property_id', propertyId)
    setBlocked(new Set((data ?? []).map((r: { blocked_date: string }) => r.blocked_date)))
  }

  async function toggle(dateStr: string) {
    if (toggling) return
    setToggling(true)
    try {
      if (blocked.has(dateStr)) {
        const { error } = await supabase
          .from('blocked_dates')
          .delete()
          .eq('property_id', propertyId)
          .eq('blocked_date', dateStr)
        if (error) throw error
        setBlocked(prev => { const s = new Set(prev); s.delete(dateStr); return s })
      } else {
        const { error } = await supabase
          .from('blocked_dates')
          .upsert({ property_id: propertyId, blocked_date: dateStr }, { onConflict: 'property_id,blocked_date' })
        if (error) throw error
        setBlocked(prev => new Set([...prev, dateStr]))
      }
    } catch {
      toast('error', 'Erro ao salvar disponibilidade', '')
    } finally {
      setToggling(false)
    }
  }

  function renderGrid() {
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

    return days.map((day, i) => {
      const inMonth = day.getMonth() === month.getMonth()
      const isPast = isBefore(day, today)
      const isToday = isSameDay(day, today)
      const dateStr = format(day, 'yyyy-MM-dd')
      const isBlocked = blocked.has(dateStr)

      if (!inMonth) return <div key={i} />

      return (
        <button
          key={i}
          type="button"
          disabled={isPast || toggling}
          onClick={() => void toggle(dateStr)}
          className={[
            'h-9 w-full rounded-lg text-xs font-medium transition-all border',
            isPast
              ? 'opacity-20 cursor-not-allowed bg-transparent border-transparent text-[#444]'
              : isBlocked
                ? 'bg-[#E50914]/20 border-[#E50914]/40 text-[#E50914] hover:bg-[#E50914]/30'
                : 'bg-[#46D369]/10 border-[#46D369]/30 text-[#46D369] hover:bg-[#46D369]/20 cursor-pointer',
            isToday && !isPast ? 'ring-1 ring-white/20' : '',
          ].filter(Boolean).join(' ')}
        >
          {day.getDate()}
        </button>
      )
    })
  }

  const canPrev = isAfter(month, startOfMonth(today))

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => canPrev && setMonth(m => subMonths(m, 1))}
          disabled={!canPrev}
          className="w-7 h-7 rounded-full bg-[#2A2A2A] flex items-center justify-center text-[#B3B3B3] hover:text-white disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <p className="text-sm font-semibold text-white capitalize">
          {format(month, 'MMMM yyyy', { locale: ptBR })}
        </p>
        <button
          type="button"
          onClick={() => setMonth(m => addMonths(m, 1))}
          className="w-7 h-7 rounded-full bg-[#2A2A2A] flex items-center justify-center text-[#B3B3B3] hover:text-white transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(wd => (
          <div key={wd} className="text-center text-[10px] text-[#555] font-semibold py-1">{wd}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {renderGrid()}
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#2A2A2A]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#46D369]/20 border border-[#46D369]/40" />
          <span className="text-[10px] text-[#666]">Disponível</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#E50914]/20 border border-[#E50914]/40" />
          <span className="text-[10px] text-[#666]">Bloqueado</span>
        </div>
        <span className="text-[10px] text-[#444] ml-auto">Clique para alternar</span>
      </div>
    </div>
  )
}
