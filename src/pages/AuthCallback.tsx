import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { APP_ROUTES } from '../constants'

async function ensureProfile(userId: string, meta: Record<string, unknown>) {
  const { data } = await supabase.from('users').select('id').eq('id', userId).single()
  if (!data) {
    await supabase.from('users').upsert({
      id: userId,
      email: meta.email as string ?? '',
      name: (meta.full_name ?? meta.name ?? '') as string,
      role: 'GUEST',
      avatar_url: meta.avatar_url as string ?? null,
    })
  }
}

export function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(async ({ data: { session }, error }) => {
        if (error) {
          console.error('[AuthCallback] exchangeCodeForSession error:', error.message)
          navigate(`${APP_ROUTES.LOGIN}?error=link_expirado`, { replace: true })
        } else if (session) {
          // For Google OAuth: ensure a users row exists on first login
          await ensureProfile(session.user.id, session.user.user_metadata ?? {})
          navigate(APP_ROUTES.HOME, { replace: true })
        } else {
          navigate(APP_ROUTES.LOGIN, { replace: true })
        }
      })
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        navigate(session ? APP_ROUTES.HOME : APP_ROUTES.LOGIN, { replace: true })
      })
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-[#141414] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
