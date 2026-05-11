import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { APP_ROUTES } from '../constants'

export function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')

    if (code) {
      // PKCE: troca o code pelo session diretamente no browser (code_verifier está no localStorage)
      supabase.auth.exchangeCodeForSession(code).then(({ data: { session } }) => {
        navigate(session ? APP_ROUTES.HOME : APP_ROUTES.LOGIN, { replace: true })
      })
    } else {
      // Sem code — verifica sessão já existente (ex: hash #access_token)
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
