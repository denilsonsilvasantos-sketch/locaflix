import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { APP_ROUTES } from '../constants'
import { Logo } from '../components/layout/Logo'

async function ensureProfile(userId: string, meta: Record<string, unknown>): Promise<boolean> {
  const { data } = await supabase.from('users').select('id').eq('id', userId).single()
  if (!data) {
    await supabase.from('users').upsert({
      id: userId,
      email: (meta.email as string) ?? '',
      name: ((meta.full_name ?? meta.name ?? '') as string),
      role: 'GUEST',
      avatar_url: (meta.avatar_url as string) ?? null,
    })
    return true // new user
  }
  return false
}

export function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const hasCode = !!params.get('code')
    const urlError = params.get('error')

    if (urlError) {
      navigate(`${APP_ROUTES.LOGIN}?error=link_expirado`, { replace: true })
      return
    }

    let resolved = false

    async function finish(session: Session | null) {
      if (resolved) return
      resolved = true
      if (session) {
        const isNew = await ensureProfile(session.user.id, session.user.user_metadata ?? {})
        // New Google users go to profile completion; returning users go home
        navigate(
          isNew
            ? `${APP_ROUTES.GUEST_DASHBOARD}?tab=perfil&welcome=1`
            : APP_ROUTES.HOME,
          { replace: true },
        )
      } else if (hasCode) {
        navigate(`${APP_ROUTES.LOGIN}?error=link_expirado`, { replace: true })
      } else {
        navigate(APP_ROUTES.LOGIN, { replace: true })
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) finish(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish(session)
    })

    const timer = setTimeout(() => finish(null), 6000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center gap-8">
      <Logo size="lg" />
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#B3B3B3] text-sm">Autenticando sua conta...</p>
      </div>
    </div>
  )
}
