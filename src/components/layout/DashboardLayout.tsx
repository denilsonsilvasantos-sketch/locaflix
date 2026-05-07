import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
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
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const SidebarContent = () => (
    <nav className="flex flex-col gap-1 p-4">
      {navItems.map(item => {
        const active = location.pathname === item.href || location.search.includes(item.href.split('?')[1] ?? '____')
        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={() => setSidebarOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              active
                ? 'bg-[#E50914] text-white'
                : 'text-[#B3B3B3] hover:text-white hover:bg-[#2A2A2A]',
            )}
          >
            <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.badge && item.badge > 0 && (
              <span className={cn(
                'text-xs font-bold px-1.5 py-0.5 rounded-full',
                active ? 'bg-white/20 text-white' : 'bg-[#E50914] text-white',
              )}>
                {item.badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-screen bg-[#141414] pt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar desktop */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-24 bg-[#1F1F1F] border border-[#333] rounded-xl overflow-hidden">
              <div className="px-4 py-4 border-b border-[#333]">
                <h2 className="font-display text-lg font-bold text-white">{title}</h2>
              </div>
              <SidebarContent />
            </div>
          </aside>

          {/* Mobile sidebar toggle */}
          <div className="lg:hidden fixed bottom-6 left-6 z-30">
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-12 h-12 bg-[#E50914] rounded-full shadow-2xl flex items-center justify-center text-white"
            >
              <Menu size={20} />
            </button>
          </div>

          {/* Mobile sidebar */}
          <AnimatePresence>
            {sidebarOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="lg:hidden fixed inset-0 z-40 bg-black/60"
                  onClick={() => setSidebarOpen(false)}
                />
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                  className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-64 bg-[#1F1F1F] border-r border-[#333]"
                >
                  <div className="flex items-center justify-between px-4 py-4 border-b border-[#333]">
                    <h2 className="font-display text-lg font-bold text-white">{title}</h2>
                    <button onClick={() => setSidebarOpen(false)} className="text-[#B3B3B3] hover:text-white">
                      <X size={18} />
                    </button>
                  </div>
                  <SidebarContent />
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
