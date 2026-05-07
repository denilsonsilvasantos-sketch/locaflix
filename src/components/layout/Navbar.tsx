import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, ChevronDown, Heart, LogOut, Menu, MessageSquare, Settings, User, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useNotifications } from '../../hooks/useNotifications'
import { APP_ROUTES } from '../../constants'
import { getInitials } from '../../lib/utils'

export function Navbar() {
  const { user, profile, signOut } = useAuth()
  const { unreadCount } = useNotifications()
  const location = useLocation()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
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
  }, [location.pathname])

  async function handleSignOut() {
    await signOut()
    navigate(APP_ROUTES.HOME)
  }

  const dashboardRoute =
    profile?.role === 'ADMIN' ? APP_ROUTES.ADMIN_DASHBOARD
    : profile?.role === 'OWNER' ? APP_ROUTES.OWNER_DASHBOARD
    : APP_ROUTES.GUEST_DASHBOARD

  return (
    <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'bg-[#141414]/95 backdrop-blur-md shadow-lg' : 'bg-gradient-to-b from-black/70 to-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to={APP_ROUTES.HOME} className="flex-shrink-0 flex items-center">
            <img
              src="/logo.png"
              alt="LOCAFLIX"
              className="h-16 w-auto drop-shadow-lg"
              onError={e => {
                const img = e.currentTarget
                img.style.display = 'none'
                img.nextElementSibling?.removeAttribute('style')
              }}
            />
            <span className="font-display text-3xl font-bold tracking-wider text-[#E50914] drop-shadow-lg" style={{ display: 'none' }}>
              LOCAFLIX
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link to={APP_ROUTES.HOME} className="text-sm text-[#B3B3B3] hover:text-white transition-colors">
              Início
            </Link>
            <Link to={`${APP_ROUTES.HOME}?tipo=praia`} className="text-sm text-[#B3B3B3] hover:text-white transition-colors">
              Praia
            </Link>
            <Link to={`${APP_ROUTES.HOME}?tipo=campo`} className="text-sm text-[#B3B3B3] hover:text-white transition-colors">
              Campo
            </Link>
            <Link to={`${APP_ROUTES.HOME}?tipo=cidade`} className="text-sm text-[#B3B3B3] hover:text-white transition-colors">
              Cidade
            </Link>
            {profile?.role === 'OWNER' && (
              <Link to={APP_ROUTES.NEW_PROPERTY} className="text-sm text-[#F5A623] hover:text-[#e6951a] transition-colors font-medium">
                + Anunciar imóvel
              </Link>
            )}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {/* Messages */}
                <Link
                  to={APP_ROUTES.MESSAGES}
                  className="hidden md:flex w-9 h-9 items-center justify-center rounded-lg text-[#B3B3B3] hover:text-white hover:bg-[#2A2A2A] transition-colors"
                >
                  <MessageSquare size={18} />
                </Link>

                {/* Notifications */}
                <Link
                  to={dashboardRoute}
                  className="relative hidden md:flex w-9 h-9 items-center justify-center rounded-lg text-[#B3B3B3] hover:text-white hover:bg-[#2A2A2A] transition-colors"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#E50914] rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>

                {/* User menu */}
                <div ref={userMenuRef} className="relative hidden md:block">
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
                    <ChevronDown size={14} className={`text-[#B3B3B3] transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-56 bg-[#1F1F1F] border border-[#333] rounded-xl shadow-2xl overflow-hidden"
                      >
                        <div className="px-4 py-3 border-b border-[#333]">
                          <p className="text-sm font-semibold text-white truncate">{profile?.name ?? 'Usuário'}</p>
                          <p className="text-xs text-[#B3B3B3] truncate">{user.email}</p>
                        </div>
                        <div className="py-1">
                          <MenuLink to={dashboardRoute} icon={<User size={14} />} label="Minha conta" />
                          <MenuLink to={APP_ROUTES.MESSAGES} icon={<MessageSquare size={14} />} label="Mensagens" />
                          <MenuLink to={`${dashboardRoute}?tab=favoritos`} icon={<Heart size={14} />} label="Favoritos" />
                          <MenuLink to={`${dashboardRoute}?tab=perfil`} icon={<Settings size={14} />} label="Configurações" />
                          {profile?.role === 'OWNER' && (
                            <MenuLink to={APP_ROUTES.NEW_PROPERTY} icon={<span className="text-[#F5A623]">+</span>} label="Anunciar imóvel" />
                          )}
                        </div>
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
              <div className="hidden md:flex items-center gap-3">
                <Link
                  to={APP_ROUTES.LOGIN}
                  className="text-sm text-[#B3B3B3] hover:text-white transition-colors"
                >
                  Entrar
                </Link>
                <Link
                  to={APP_ROUTES.REGISTER}
                  className="text-sm bg-[#E50914] hover:bg-[#F40612] text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  Cadastrar
                </Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-[#B3B3B3] hover:text-white hover:bg-[#2A2A2A] transition-colors"
              onClick={() => setMenuOpen(v => !v)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#141414] border-t border-[#333] overflow-hidden"
          >
            <div className="px-4 py-4 flex flex-col gap-2">
              <MobileLink to={APP_ROUTES.HOME} label="Início" />
              <MobileLink to={`${APP_ROUTES.HOME}?tipo=praia`} label="Praia" />
              <MobileLink to={`${APP_ROUTES.HOME}?tipo=campo`} label="Campo" />
              <MobileLink to={`${APP_ROUTES.HOME}?tipo=cidade`} label="Cidade" />
              {user ? (
                <>
                  <MobileLink to={dashboardRoute} label="Minha conta" />
                  <MobileLink to={APP_ROUTES.MESSAGES} label="Mensagens" />
                  {profile?.role === 'OWNER' && (
                    <MobileLink to={APP_ROUTES.NEW_PROPERTY} label="Anunciar imóvel" />
                  )}
                  <button
                    onClick={handleSignOut}
                    className="text-left text-sm text-[#E50914] py-2 px-3 rounded-lg hover:bg-[#2A2A2A] transition-colors"
                  >
                    Sair
                  </button>
                </>
              ) : (
                <>
                  <MobileLink to={APP_ROUTES.LOGIN} label="Entrar" />
                  <MobileLink to={APP_ROUTES.REGISTER} label="Cadastrar" />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

function MenuLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-4 py-2 text-sm text-[#B3B3B3] hover:text-white hover:bg-[#2A2A2A] transition-colors"
    >
      {icon}
      {label}
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
