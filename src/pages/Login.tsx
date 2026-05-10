import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, User, Globe, MapPin, Phone, CreditCard, ChevronRight, ChevronLeft } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { APP_ROUTES } from '../constants'

interface LoginProps {
  mode?: 'login' | 'register'
}

interface RegisterForm {
  // step 1
  name: string
  email: string
  password: string
  // step 2
  phone: string
  cpf: string
  birth_date: string
  cep: string
  address: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
}

const EMPTY_FORM: RegisterForm = {
  name: '', email: '', password: '',
  phone: '', cpf: '', birth_date: '',
  cep: '', address: '', number: '', complement: '', neighborhood: '', city: '', state: '',
}

export function Login({ mode: initialMode = 'login' }: LoginProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'verify'>(initialMode)
  const [step, setStep] = useState<1 | 2>(1)

  // login fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  // register form
  const [form, setForm] = useState<RegisterForm>(EMPTY_FORM)

  const { signIn, signUp, signInWithGoogle } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? APP_ROUTES.HOME

  function f(field: keyof RegisterForm) {
    return {
      value: form[field],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(prev => ({ ...prev, [field]: e.target.value })),
    }
  }

  async function handleCepBlur() {
    const cep = form.cep.replace(/\D/g, '')
    if (cep.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setForm(prev => ({
          ...prev,
          address: data.logradouro ?? prev.address,
          neighborhood: data.bairro ?? prev.neighborhood,
          city: data.localidade ?? prev.city,
          state: data.uf ?? prev.state,
        }))
      }
    } catch { /* ignore */ }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const fetchedProfile = await signIn(email, password)
      const isSpecificRedirect = from !== APP_ROUTES.HOME && from !== APP_ROUTES.LOGIN && from !== APP_ROUTES.REGISTER
      const dest = isSpecificRedirect ? from
        : fetchedProfile?.role === 'ADMIN' ? APP_ROUTES.ADMIN_DASHBOARD
        : fetchedProfile?.role === 'OWNER' ? APP_ROUTES.OWNER_DASHBOARD
        : APP_ROUTES.GUEST_DASHBOARD
      navigate(dest, { replace: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      toast('error', 'Erro', translateAuthError(msg))
    } finally {
      setLoading(false)
    }
  }

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast('error', 'Preencha o nome'); return }
    if (!form.email.trim()) { toast('error', 'Preencha o e-mail'); return }
    if (form.password.length < 6) { toast('error', 'Senha deve ter no mínimo 6 caracteres'); return }
    setStep(2)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await signUp(form.email, form.password, form.name, 'GUEST', {
        phone: form.phone || undefined,
        cpf: form.cpf || undefined,
        birth_date: form.birth_date || undefined,
        cep: form.cep || undefined,
        address: form.address || undefined,
        number: form.number || undefined,
        complement: form.complement || undefined,
        neighborhood: form.neighborhood || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
      })
      toast('success', 'Conta criada!', 'Verifique seu e-mail para ativar sua conta.')
      setMode('verify')
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

  function switchMode(m: 'login' | 'register' | 'verify') {
    setMode(m)
    setStep(1)
    setForm(EMPTY_FORM)
  }

  return (
    <div className="min-h-screen bg-[#141414] flex items-center justify-center relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1600')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#141414]/80 via-transparent to-[#141414]" />

      <Link to={APP_ROUTES.HOME} className="absolute top-6 left-6 z-10">
        <span className="font-display text-3xl font-bold text-[#E50914]">LOCAFLIX</span>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md mx-4 my-10"
      >
        <div className="bg-[#141414]/95 backdrop-blur-sm border border-[#333] rounded-2xl p-8 shadow-2xl">

          {/* ── LOGIN ───────────────────────────── */}
          {mode === 'login' && (
            <>
              <h1 className="font-display text-3xl font-bold text-white mb-1">Entrar</h1>
              <p className="text-[#B3B3B3] text-sm mb-8">Bem-vindo de volta ao LOCAFLIX</p>

              <button
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3 px-4 rounded-xl transition-colors mb-5"
              >
                <Globe size={18} /> Continuar com Google
              </button>

              <Divider />

              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <Input label="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com" leftIcon={<Mail size={16} />} required autoComplete="email" />
                <Input label="Senha" type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  leftIcon={<Lock size={16} />}
                  rightIcon={
                    <button type="button" onClick={() => setShowPass(v => !v)} className="hover:text-white">
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                  required />
                <div className="text-right">
                  <button type="button" className="text-xs text-[#B3B3B3] hover:text-white transition-colors">
                    Esqueci minha senha
                  </button>
                </div>
                <Button type="submit" loading={loading} fullWidth size="lg">Entrar</Button>
              </form>

              <p className="text-center text-sm text-[#B3B3B3] mt-6">
                Não tem conta?{' '}
                <button onClick={() => switchMode('register')} className="text-white hover:underline font-medium">
                  Cadastre-se
                </button>
              </p>
            </>
          )}

          {/* ── CADASTRO ────────────────────────── */}
          {mode === 'register' && (
            <>
              {/* Header com etapas */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="font-display text-2xl font-bold text-white">
                    {step === 1 ? 'Criar conta' : 'Dados pessoais'}
                  </h1>
                  <p className="text-[#B3B3B3] text-xs mt-0.5">Etapa {step} de 2</p>
                </div>
                <div className="flex gap-2">
                  {[1, 2].map(s => (
                    <div key={s} className={`h-1.5 w-10 rounded-full transition-colors ${s <= step ? 'bg-[#E50914]' : 'bg-[#333]'}`} />
                  ))}
                </div>
              </div>

              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.form
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleStep1}
                    className="flex flex-col gap-4"
                  >
                    <button
                      type="button"
                      onClick={handleGoogle}
                      className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3 px-4 rounded-xl transition-colors"
                    >
                      <Globe size={18} /> Continuar com Google
                    </button>
                    <Divider />

                    <Input label="Nome completo" type="text" {...f('name')} placeholder="Seu nome"
                      leftIcon={<User size={16} />} required />
                    <Input label="E-mail" type="email" {...f('email')} placeholder="seu@email.com"
                      leftIcon={<Mail size={16} />} required autoComplete="email" />
                    <Input label="Senha" type={showPass ? 'text' : 'password'} {...f('password')}
                      placeholder="Mínimo 6 caracteres" leftIcon={<Lock size={16} />}
                      rightIcon={
                        <button type="button" onClick={() => setShowPass(v => !v)} className="hover:text-white">
                          {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      }
                      required />
                    <Button type="submit" fullWidth size="lg" className="mt-1">
                      Continuar <ChevronRight size={16} className="ml-1" />
                    </Button>
                  </motion.form>
                )}

                {step === 2 && (
                  <motion.form
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleRegister}
                    className="flex flex-col gap-3"
                  >
                    <p className="text-xs text-[#666] -mt-2 mb-1">
                      Preencha seus dados para agilizar futuras reservas. Você pode pular e completar depois.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Telefone" {...f('phone')} placeholder="(11) 99999-9999"
                        leftIcon={<Phone size={16} />} />
                      <Input label="CPF" {...f('cpf')} placeholder="000.000.000-00"
                        leftIcon={<CreditCard size={16} />} />
                    </div>
                    <Input label="Data de nascimento" type="date" {...f('birth_date')} />

                    <div className="border-t border-[#333] pt-3 mt-1">
                      <p className="text-xs font-semibold text-[#666] uppercase tracking-wide mb-2">Endereço</p>
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="col-span-1">
                          <Input label="CEP" {...f('cep')}
                            placeholder="00000-000"
                            leftIcon={<MapPin size={16} />}
                            onBlur={handleCepBlur}
                          />
                        </div>
                        <div className="col-span-2">
                          <Input label="Endereço" {...f('address')} placeholder="Rua / Av." />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <Input label="Número" {...f('number')} placeholder="123" />
                        <Input label="Complemento" {...f('complement')} placeholder="Apto 4B" />
                      </div>
                      <Input label="Bairro" {...f('neighborhood')} placeholder="Bairro" className="mb-3" />
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <Input label="Cidade" {...f('city')} placeholder="Cidade" />
                        </div>
                        <Input label="UF" {...f('state')} placeholder="SP" />
                      </div>
                    </div>

                    <div className="flex gap-3 mt-2">
                      <Button type="button" variant="ghost" onClick={() => setStep(1)} className="flex-shrink-0">
                        <ChevronLeft size={16} />
                      </Button>
                      <Button type="submit" loading={loading} fullWidth size="lg">
                        Criar conta
                      </Button>
                    </div>

                    <p className="text-center text-xs text-[#555] leading-relaxed">
                      Ao criar sua conta você concorda com os{' '}
                      <a href="#" className="text-[#B3B3B3] hover:text-white">Termos de Uso</a>
                      {' '}e a{' '}
                      <a href="#" className="text-[#B3B3B3] hover:text-white">Política de Privacidade</a>.
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>

              <p className="text-center text-sm text-[#B3B3B3] mt-5">
                Já tem conta?{' '}
                <button onClick={() => switchMode('login')} className="text-white hover:underline font-medium">
                  Entrar
                </button>
              </p>
            </>
          )}
          {/* ── VERIFICAR EMAIL ─────────────────── */}
          {mode === 'verify' && (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">📬</div>
              <h1 className="font-display text-2xl font-bold text-white mb-2">Verifique seu e-mail</h1>
              <p className="text-[#B3B3B3] text-sm mb-6">
                Enviamos um link de confirmação para{' '}
                <span className="text-white font-medium">{form.email}</span>.
                <br />Clique no link para ativar sua conta.
              </p>
              <p className="text-xs text-[#555] mb-4">
                Não recebeu? Verifique a caixa de spam.
              </p>
              <button
                onClick={() => switchMode('login')}
                className="text-sm text-[#B3B3B3] hover:text-white transition-colors underline"
              >
                Voltar para o login
              </button>
            </div>
          )}

        </div>
      </motion.div>
    </div>
  )
}

function Divider() {
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px bg-[#333]" />
      <span className="text-xs text-[#555]">ou com e-mail</span>
      <div className="flex-1 h-px bg-[#333]" />
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
