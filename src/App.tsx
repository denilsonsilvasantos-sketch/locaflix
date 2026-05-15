import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ToastProvider } from './hooks/useToast'
import { ToastContainer } from './components/ui/Toast'
import { Navbar } from './components/layout/Navbar'
import { Footer } from './components/layout/Footer'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { APP_ROUTES } from './constants'

import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { PropertyDetails } from './pages/PropertyDetails'
import { Checkout } from './pages/Checkout'
import { GuestDashboard } from './pages/GuestDashboard'
import { OwnerDashboard } from './pages/OwnerDashboard'
import { AdminDashboard } from './pages/AdminDashboard'
import { NewProperty } from './pages/NewProperty'
import { MessagesPage } from './pages/MessagesPage'
import { CancellationPolicy } from './pages/CancellationPolicy'
import { BecomeOwner } from './pages/BecomeOwner'
import { AuthCallback } from './pages/AuthCallback'
import { HelpCenter } from './components/ui/HelpCenter'

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Auth callback — Supabase email confirmation */}
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Public */}
            <Route path={APP_ROUTES.HOME} element={<AppLayout><Home /></AppLayout>} />
            <Route path={APP_ROUTES.LOGIN} element={<Login />} />
            <Route path={APP_ROUTES.REGISTER} element={<Login mode="register" />} />
            <Route path="/imovel/:id" element={<AppLayout><PropertyDetails /></AppLayout>} />
            <Route path="/politica-cancelamento" element={<AppLayout><CancellationPolicy /></AppLayout>} />
            <Route path="/tornar-anfitriao" element={<AppLayout><BecomeOwner /></AppLayout>} />

            {/* Auth required — any role */}
            <Route path="/reservar/:id" element={
              <ProtectedRoute>
                <AppLayout><Checkout /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path={APP_ROUTES.MESSAGES} element={
              <ProtectedRoute>
                <AppLayout><MessagesPage /></AppLayout>
              </ProtectedRoute>
            } />

            {/* GUEST dashboard */}
            <Route path={APP_ROUTES.GUEST_DASHBOARD} element={
              <ProtectedRoute roles={['GUEST', 'OWNER', 'ADMIN']}>
                <AppLayout><GuestDashboard /></AppLayout>
              </ProtectedRoute>
            } />

            {/* OWNER dashboard */}
            <Route path={`${APP_ROUTES.OWNER_DASHBOARD}/*`} element={
              <ProtectedRoute roles={['OWNER', 'ADMIN']}>
                <AppLayout><OwnerDashboard /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path={APP_ROUTES.NEW_PROPERTY} element={
              <ProtectedRoute roles={['OWNER', 'ADMIN']}>
                <AppLayout><NewProperty /></AppLayout>
              </ProtectedRoute>
            } />

            {/* ADMIN dashboard — standalone, no Navbar/Footer */}
            <Route path={`${APP_ROUTES.ADMIN_DASHBOARD}/*`} element={
              <ProtectedRoute roles={['ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />

            {/* Fallback */}
            <Route path="*" element={<AppLayout><Home /></AppLayout>} />
          </Routes>
          <ToastContainer />
          <HelpCenter />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
