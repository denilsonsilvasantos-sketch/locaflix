import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, User, Globe } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { APP_ROUTES } from '../constants'
interface LoginProps {
  mode?: 'login' | 'register'
}

export function Login({ mode: initialMode = 'login' }: LoginProps) {
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const { signIn, signUp, signInWithGoogle } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? APP_ROUTES.HOME

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        const fetchedProfile = await signIn(email, password)
        const isSpecificRedirect = from !== APP_ROUTES.HOME && from !== APP_ROUTES.LOGIN && from !== APP_ROUTES.REGISTER
        const dest = isSpecificRedirect ? from
          : fetchedProfile?.role === 'ADMIN' ? APP_ROUTES.ADMIN_DASHBOARD
          : fetchedProfile?.role === 'OWNER' ? APP_ROUTES.OWNER_DASHBOARD
          : APP_ROUTES.GUEST_DASHBOARD
        navigate(dest, { replace: true })
      } else {
        await signUp(email, password, name, 'GUEST')
        toast('success', 'Conta criada!', 'Verifique seu e-mail para confirmar o cadastro.')
        navigate(APP_ROUTES.GUEST_DASHBOARD, { replace: true })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      toast('error', 'Erro', translateAuthError(msg))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    try {
      await signInWithGoogle()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro'
      toast('error', 'Erro', msg)
    }
  }

  return (
    <div className="min-h-screen bg-[#141414] flex items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1600')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#141414]/80 via-transparent to-[#141414]" />

      {/* Logo */}
      <Link to={APP_ROUTES.HOME} className="absolute top-6 left-6 z-10">
        <span className="font-display text-3xl font-bold text-[#E50914]">LOCAFLIX</span>
      </Link>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="bg-[#141414]/95 backdrop-blur-sm border border-[#333] rounded-2xl p-8 shadow-2xl">
          <h1 className="font-display text-3xl font-bold text-white mb-1">
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </h1>
          <p className="text-[#B3B3B3] text-sm mb-8">
            {mode === 'login'
              ? 'Bem-vindo de volta ao LOCAFLIX'
              : 'Comece sua jornada no LOCAFLIX'}
          </p>

          {/* Google */}
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3 px-4 rounded-xl transition-colors mb-5"
          >
            <Globe size={18} />
            Continuar com Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-[#333]" />
            <span className="text-xs text-[#555]">ou com e-mail</span>
            <div className="flex-1 h-px bg-[#333]" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'register' && (
              <Input
                label="Nome completo"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Seu nome"
                leftIcon={<User size={16} />}
                required
              />
            )}

            <Input
              label="E-mail"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              leftIcon={<Mail size={16} />}
              required
              autoComplete="email"
            />

            <Input
              label="Senha"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Mínimo 8 caracteres' : '••••••••'}
              leftIcon={<Lock size={16} />}
              rightIcon={
                <button type="button" onClick={() => setShowPass(v => !v)} className="hover:text-white transition-colors">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              required
            />

            {mode === 'login' && (
              <div className="text-right">
                <button type="button" className="text-xs text-[#B3B3B3] hover:text-white transition-colors">
                  Esqueci minha senha
                </button>
              </div>
            )}

            <Button type="submit" loading={loading} fullWidth size="lg" className="mt-2">
              {mode === 'login' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>

          <p className="text-center text-sm text-[#B3B3B3] mt-6">
            {mode === 'login' ? (
              <>Não tem conta? <button onClick={() => setMode('register')} className="text-white hover:underline font-medium">Cadastre-se</button></>
            ) : (
              <>Já tem conta? <button onClick={() => setMode('login')} className="text-white hover:underline font-medium">Entrar</button></>
            )}
          </p>

          {mode === 'register' && (
            <p className="text-center text-xs text-[#555] mt-4 leading-relaxed">
              Ao criar sua conta você concorda com os{' '}
              <a href="#" className="text-[#B3B3B3] hover:text-white transition-colors">Termos de Uso</a>
              {' '}e a{' '}
              <a href="#" className="text-[#B3B3B3] hover:text-white transition-colors">Política de Privacidade</a>.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  )
}


function translateAuthError(msg: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
    'User already registered': 'Este e-mail já está cadastrado.',
    'Password should be at least 6 characters': 'Senha muito curta. Mínimo 6 caracteres.',
  }
  return map[msg] ?? msg
}
