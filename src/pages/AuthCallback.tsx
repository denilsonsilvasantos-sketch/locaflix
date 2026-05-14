import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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

async function resolveSession(navigate: ReturnType<typeof useNavigate>) {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const urlError = params.get('error')
  const errorDesc = params.get('error_description')

  // Supabase returned an explicit OAuth error
  if (urlError) {
    console.error('[AuthCallback] OAuth error:', urlError, errorDesc)
    navigate(`${APP_ROUTES.LOGIN}?error=link_expirado`, { replace: true })
    return
  }

  // PKCE code flow (email magic link or OAuth with PKCE)
  if (code) {
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && session) {
      await ensureProfile(session.user.id, session.user.user_metadata ?? {})
      navigate(APP_ROUTES.HOME, { replace: true })
      return
    }
    // PKCE exchange failed — fall through to getSession() as a fallback
    // (OAuth implicit flow may have already set the session)
    console.warn('[AuthCallback] exchangeCodeForSession failed:', error?.message)
  }

  // Fallback: check if Supabase already set a session (implicit OAuth or hash token)
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    await ensureProfile(session.user.id, session.user.user_metadata ?? {})
    navigate(APP_ROUTES.HOME, { replace: true })
    return
  }

  // No session at all — if we had a code that failed, show expired-link error
  if (code) {
    navigate(`${APP_ROUTES.LOGIN}?error=link_expirado`, { replace: true })
  } else {
    navigate(APP_ROUTES.LOGIN, { replace: true })
  }
}

export function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    resolveSession(navigate)
  }, [navigate])

  return (
    <div className="min-h-screen bg-[#141414] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
