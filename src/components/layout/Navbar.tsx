import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, Calendar, FileText, Heart, HelpCircle, Home, LogOut,
  Menu, MessageSquare, Settings, ShieldCheck, User, X,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useNotifications } from '../../hooks/useNotifications'
import { useUnreadMessages } from '../../hooks/useUnreadMessages'
import { APP_ROUTES } from '../../constants'
import { getInitials } from '../../lib/utils'
import { Logo } from './Logo'

export function Navbar() {
  const { user, profile, signOut } = useAuth()
  const { unreadCount: unreadNotifications, markAllRead: markNotificationsRead } = useNotifications()
  const { unreadCount: unreadMessages, markAllRead: markMessagesRead } = useUnreadMessages()
  const location = useLocation()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)       // mobile nav (not logged in)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    setUserMenuOpen(false)
  }, [location.pathname, location.search])

  async function handleSignOut() {
    await signOut()
    navigate(APP_ROUTES.HOME)
  }

  return (
    <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'bg-[#141414]/95 backdrop-blur-md shadow-lg' : 'bg-gradient-to-b from-black/70 to-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">

          {/* Logo */}
          <Link to={APP_ROUTES.HOME} className="flex-shrink-0">
            <Logo size="lg" />
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden lg:flex items-center gap-6">
            <Link to={APP_ROUTES.HOME} className="text-sm text-[#B3B3B3] hover:text-white transition-colors">Início</Link>
            <Link to={`${APP_ROUTES.HOME}?tipo=praia`} className="text-sm text-[#B3B3B3] hover:text-white transition-colors">Praia</Link>
            <Link to={`${APP_ROUTES.HOME}?tipo=campo`} className="text-sm text-[#B3B3B3] hover:text-white transition-colors">Campo</Link>
            <Link to={`${APP_ROUTES.HOME}?tipo=cidade`} className="text-sm text-[#B3B3B3] hover:text-white transition-colors">Cidade</Link>
            <Link
              to={APP_ROUTES.NEW_PROPERTY}
              className="text-sm bg-[#F5A623] hover:bg-[#e6951a] text-black font-bold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              + Anuncie seu imóvel
            </Link>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                {/* Messages — desktop only, not admin */}
                {profile?.role !== 'ADMIN' && (
                  <Link
                    to={APP_ROUTES.MESSAGES}
                    onClick={() => { void markMessagesRead() }}
                    className="relative hidden lg:flex w-9 h-9 items-center justify-center rounded-lg text-[#B3B3B3] hover:text-white hover:bg-[#2A2A2A] transition-colors"
                  >
                    <MessageSquare size={18} />
                    {unreadMessages > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#E50914] rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                        {unreadMessages > 9 ? '9+' : unreadMessages}
                      </span>
                    )}
                  </Link>
                )}

                {/* Bell — desktop only, not admin */}
                {profile?.role !== 'ADMIN' && (
                  <Link
                    to={`${APP_ROUTES.GUEST_DASHBOARD}?tab=notificacoes`}
                    onClick={() => { void markNotificationsRead() }}
                    className="relative hidden lg:flex w-9 h-9 items-center justify-center rounded-lg text-[#B3B3B3] hover:text-white hover:bg-[#2A2A2A] transition-colors"
                  >
                    <Bell size={18} />
                    {unreadNotifications > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#E50914] rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                        {unreadNotifications > 9 ? '9+' : unreadNotifications}
                      </span>
                    )}
                  </Link>
                )}

                {/* User button — visible on ALL screens */}
                <div ref={userMenuRef} className="relative">
                  <button
                    onClick={() => setUserMenuOpen(v => !v)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#2A2A2A] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#E50914] flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                      {profile?.avatar_url
                        ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        : getInitials(profile?.name ?? user.email ?? 'U')
                      }
                    </div>
                    <Menu size={16} className="text-[#B3B3B3]" />
                  </button>

                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-60 bg-[#1F1F1F] border border-[#333] rounded-xl shadow-2xl overflow-hidden z-50"
                      >
                        {/* User info */}
                        <div className="px-4 py-3 border-b border-[#333] flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#E50914] flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden">
                            {profile?.avatar_url
                              ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                              : getInitials(profile?.name ?? user.email ?? '?')}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{profile?.name ?? 'Usuário'}</p>
                            <p className="text-xs text-[#B3B3B3] truncate">{user.email}</p>
                            {profile?.role === 'ADMIN' && (
                              <span className="inline-block mt-1 text-[10px] font-bold text-[#E50914] bg-[#E50914]/10 px-2 py-0.5 rounded">ADMIN</span>
                            )}
                          </div>
                        </div>

                        {/* Admin */}
                        {profile?.role === 'ADMIN' ? (
                          <div className="py-1">
                            <MenuLink to={APP_ROUTES.ADMIN_DASHBOARD} icon={<Settings size={14} className="text-[#E50914]" />} label="Painel Administrativo" />
                          </div>
                        ) : (
                          <div className="py-1">
                            {/* Mobile only: exploration links */}
                            <div className="lg:hidden border-b border-[#2A2A2A] pb-1 mb-1">
                              <MenuLink to={APP_ROUTES.HOME} icon={<Home size={14} />} label="Início" />
                              <MenuLink to={`${APP_ROUTES.HOME}?tipo=praia`} icon={<span className="text-[10px]">🏖</span>} label="Praia" />
                              <MenuLink to={`${APP_ROUTES.HOME}?tipo=campo`} icon={<span className="text-[10px]">🌿</span>} label="Campo" />
                              <MenuLink to={`${APP_ROUTES.HOME}?tipo=cidade`} icon={<span className="text-[10px]">🏙</span>} label="Cidade" />
                              <MenuLink to="/central-ajuda" icon={<HelpCircle size={14} />} label="Central de ajuda" />
                            </div>

                            {/* Mobile only: account links (sidebar handles these on desktop) */}
                            <div className="lg:hidden border-b border-[#2A2A2A] pb-1 mb-1">
                              <MenuLink to={APP_ROUTES.GUEST_DASHBOARD} icon={<User size={14} />} label="Minha Conta" />
                              <MenuLink to={APP_ROUTES.MESSAGES} icon={<MessageSquare size={14} />} label="Mensagens" />
                              {profile?.role === 'OWNER' && (
                                <MenuLink to={APP_ROUTES.OWNER_DASHBOARD} icon={<Home size={14} className="text-[#F5A623]" />} label="Painel Anfitrião" />
                              )}
                            </div>

                            {/* Desktop only: account + owner shortcuts */}
                            <div className="hidden lg:block border-b border-[#2A2A2A] pb-1 mb-1">
                              <MenuLink to={APP_ROUTES.GUEST_DASHBOARD} icon={<User size={14} />} label="Minha Conta" />
                              {profile?.role === 'OWNER' && (
                                <>
                                  <MenuLink to={APP_ROUTES.OWNER_DASHBOARD} icon={<Home size={14} className="text-[#F5A623]" />} label="Painel Anfitrião" />
                                  <MenuLink to={APP_ROUTES.NEW_PROPERTY} icon={<FileText size={14} className="text-[#F5A623]" />} label="Cadastrar imóvel" />
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="border-t border-[#333] py-1">
                          <button
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#B3B3B3] hover:text-[#E50914] hover:bg-[#2A2A2A] transition-colors"
                          >
                            <LogOut size={14} />
                            Sair
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <>
                {/* Desktop: login/register buttons */}
                <div className="hidden lg:flex items-center gap-3">
                  <Link to={APP_ROUTES.LOGIN} className="text-sm text-[#B3B3B3] hover:text-white transition-colors">
                    Entrar
                  </Link>
                  <Link
                    to={APP_ROUTES.REGISTER}
                    className="text-sm bg-[#E50914] hover:bg-[#F40612] text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    Cadastrar
                  </Link>
                </div>

                {/* Mobile hamburger — only when not logged in */}
                <button
                  className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-[#B3B3B3] hover:text-white hover:bg-[#2A2A2A] transition-colors"
                  onClick={() => setMenuOpen(v => !v)}
                >
                  {menuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu — not logged in only */}
      <AnimatePresence>
        {menuOpen && !user && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-[#141414] border-t border-[#333] overflow-hidden"
          >
            <div className="px-4 py-4 flex flex-col gap-2">
              <MobileLink to={APP_ROUTES.HOME} label="Início" />
              <MobileLink to={`${APP_ROUTES.HOME}?tipo=praia`} label="Praia" />
              <MobileLink to={`${APP_ROUTES.HOME}?tipo=campo`} label="Campo" />
              <MobileLink to={`${APP_ROUTES.HOME}?tipo=cidade`} label="Cidade" />
              <MobileLink to={APP_ROUTES.LOGIN} label="Entrar" />
              <MobileLink to={APP_ROUTES.REGISTER} label="Cadastrar" />
              <MobileLink to={APP_ROUTES.NEW_PROPERTY} label="+ Anuncie seu imóvel" />
              <MobileLink to="/central-ajuda" label="Central de ajuda" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

function MenuLink({
  to, icon, label, badge,
}: {
  to: string; icon: React.ReactNode; label: string; badge?: number
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-4 py-2 text-sm text-[#B3B3B3] hover:text-white hover:bg-[#2A2A2A] transition-colors"
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge && badge > 0 ? (
        <span className="w-5 h-5 bg-[#E50914] rounded-full text-[10px] font-bold flex items-center justify-center text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </Link>
  )
}

function MobileLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="text-sm text-[#B3B3B3] hover:text-white py-2 px-3 rounded-lg hover:bg-[#2A2A2A] transition-colors"
    >
      {label}
    </Link>
  )
}
