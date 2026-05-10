import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { APP_ROUTES } from '../constants'

export function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    // Supabase pode retornar sessão via hash (#access_token=...) ou via code
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate(APP_ROUTES.HOME, { replace: true })
      }
    })

    // Fallback: verifica sessão existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate(APP_ROUTES.HOME, { replace: true })
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  return (
    <div className="min-h-screen bg-[#141414] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
