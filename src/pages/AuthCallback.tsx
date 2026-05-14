import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { APP_ROUTES } from '../constants'

async function ensureProfile(userId: string, meta: Record<string, unknown>) {
  const { data } = await supabase.from('users').select('id').eq('id', userId).single()
  if (!data) {
    await supabase.from('users').upsert({
      id: userId,
      email: (meta.email as string) ?? '',
      name: ((meta.full_name ?? meta.name ?? '') as string),
      role: 'GUEST',
      avatar_url: (meta.avatar_url as string) ?? null,
    })
  }
}

export function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const hasCode = !!params.get('code')
    const urlError = params.get('error')

    // Supabase returned an explicit OAuth error (provider not configured, etc.)
    if (urlError) {
      navigate(`${APP_ROUTES.LOGIN}?error=link_expirado`, { replace: true })
      return
    }

    let resolved = false

    async function finish(session: Session | null) {
      if (resolved) return
      resolved = true
      if (session) {
        await ensureProfile(session.user.id, session.user.user_metadata ?? {})
        navigate(APP_ROUTES.HOME, { replace: true })
      } else if (hasCode) {
        // Had a code but no session → truly expired/invalid link
        navigate(`${APP_ROUTES.LOGIN}?error=link_expirado`, { replace: true })
      } else {
        navigate(APP_ROUTES.LOGIN, { replace: true })
      }
    }

    // detectSessionInUrl:true processes ?code= automatically and fires SIGNED_IN.
    // We must NOT call exchangeCodeForSession manually — the code is already consumed.
    // Strategy: check existing session first (fast path), then listen for state change.

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) finish(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish(session)
    })

    // Fallback timeout: if nothing happens in 6s, session truly failed
    const timer = setTimeout(() => finish(null), 6000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-[#141414] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
