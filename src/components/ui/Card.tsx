import { cn } from '../../lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}

export function Card({ children, className, hover = false, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-[#1F1F1F] border border-[#333] rounded-xl',
        hover && 'card-hover cursor-pointer',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  trend?: number
  accent?: boolean
}

export function StatCard({ label, value, icon, trend, accent = false }: StatCardProps) {
  return (
    <div className={cn(
      'bg-[#1F1F1F] border rounded-xl p-5',
      accent ? 'border-[#F5A623]/30' : 'border-[#333]',
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#B3B3B3] font-medium uppercase tracking-wide">{label}</p>
          <p className={cn(
            'text-2xl font-bold mt-1',
            accent ? 'text-[#F5A623]' : 'text-white',
          )}>
            {value}
          </p>
          {trend !== undefined && (
            <p className={cn('text-xs mt-1', trend >= 0 ? 'text-[#46D369]' : 'text-[#E50914]')}>
              {trend >= 0 ? '+' : ''}{trend}% este mês
            </p>
          )}
        </div>
        {icon && (
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
            accent ? 'bg-[#F5A623]/10 text-[#F5A623]' : 'bg-[#2A2A2A] text-[#B3B3B3]',
          )}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
