import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import type { UserRole } from '../../types'
import { APP_ROUTES } from '../../constants'

interface ProtectedRouteProps {
  children: React.ReactNode
  roles?: UserRole[]
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to={APP_ROUTES.LOGIN} state={{ from: location }} replace />
  }

  if (roles && profile) {
    const allowed = roles.includes(profile.role)
    if (!allowed) {
      // GUEST tentando acessar área de OWNER → ir para "Torne-se anfitrião"
      const ownerRoutes = [APP_ROUTES.OWNER_DASHBOARD, APP_ROUTES.NEW_PROPERTY]
      const isOwnerRoute = ownerRoutes.some(r => location.pathname.startsWith(r))

      if (isOwnerRoute && profile.role === 'GUEST') {
        return <Navigate to={`/tornar-anfitriao?next=${encodeURIComponent(location.pathname)}`} replace />
      }

      const redirectMap: Record<UserRole, string> = {
        GUEST: APP_ROUTES.GUEST_DASHBOARD,
        OWNER: APP_ROUTES.OWNER_DASHBOARD,
        ADMIN: APP_ROUTES.ADMIN_DASHBOARD,
      }
      return <Navigate to={redirectMap[profile.role] ?? APP_ROUTES.HOME} replace />
    }
  }

  return <>{children}</>
}
