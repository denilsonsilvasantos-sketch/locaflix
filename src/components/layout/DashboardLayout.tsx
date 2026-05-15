import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'

interface NavItem {
  label: string
  icon: React.ReactNode
  href: string
  badge?: number
}

interface DashboardLayoutProps {
  children: React.ReactNode
  title: string
  navItems: NavItem[]
}

export function DashboardLayout({ children, title, navItems }: DashboardLayoutProps) {
  const location = useLocation()

  const isActive = (href: string) => {
    const queryPart = href.includes('?') ? href.split('?')[1] : null
    return queryPart
      ? location.search.includes(queryPart)
      : location.pathname === href && !location.search.includes('tab=')
  }

  return (
    <div className="min-h-screen bg-[#141414] pt-24">
      {/* Mobile tab bar — full-width strip above content, only on < lg */}
      <div className="lg:hidden border-b border-[#333] bg-[#1A1A1A]">
        <div className="flex overflow-x-auto scrollbar-hide px-2 max-w-7xl mx-auto">
          {navItems.map(item => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex-shrink-0 flex flex-col items-center gap-0.5 px-4 py-3 text-[10px] font-medium border-b-2 transition-colors relative',
                  active
                    ? 'border-[#E50914] text-white'
                    : 'border-transparent text-[#B3B3B3] hover:text-white',
                )}
              >
                <span className="w-4 h-4">{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="absolute top-2 right-1 w-4 h-4 bg-[#E50914] rounded-full text-[9px] font-bold flex items-center justify-center text-white">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar — desktop only */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-24 bg-[#1F1F1F] border border-[#333] rounded-xl overflow-hidden">
              <div className="px-4 py-4 border-b border-[#333]">
                <h2 className="font-display text-lg font-bold text-white">{title}</h2>
              </div>
              <nav className="flex flex-col gap-1 p-4">
                {navItems.map(item => {
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                        active
                          ? 'bg-[#E50914] text-white'
                          : 'text-[#B3B3B3] hover:text-white hover:bg-[#2A2A2A]',
                      )}
                    >
                      <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && item.badge > 0 ? (
                        <span className={cn(
                          'text-xs font-bold px-1.5 py-0.5 rounded-full',
                          active ? 'bg-white/20 text-white' : 'bg-[#E50914] text-white',
                        )}>
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  )
                })}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
