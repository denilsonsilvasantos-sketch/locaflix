import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, DollarSign, Shield, Star, ArrowRight, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/Button'
import { APP_ROUTES } from '../constants'

const BENEFITS = [
  { icon: <DollarSign size={20} />, title: 'Renda extra garantida', desc: 'Receba pagamentos via Pix e boleto com segurança.' },
  { icon: <Shield size={20} />,     title: 'Proteção total',       desc: 'Cobertura contra danos e suporte 24h.' },
  { icon: <Star size={20} />,       title: 'Visibilidade máxima',  desc: 'Seu imóvel visto por milhares de hóspedes.' },
  { icon: <Home size={20} />,       title: 'Gestão simplificada',  desc: 'Calendário, mensagens e pagamentos em um só lugar.' },
]

export function BecomeOwner() {
  const [loading, setLoading] = useState(false)
  const { user, profile, refreshProfile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = searchParams.get('next') ?? APP_ROUTES.OWNER_DASHBOARD

  async function handleBecome() {
    if (!user) { navigate(APP_ROUTES.LOGIN); return }
    setLoading(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: 'OWNER' })
        .eq('id', user.id)
      if (error) throw error
      await refreshProfile()
      toast('success', 'Bem-vindo, anfitrião!', 'Agora você pode cadastrar seus imóveis.')
      navigate(next, { replace: true })
    } catch (err: unknown) {
      toast('error', 'Erro', err instanceof Error ? err.message : 'Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#B3B3B3] mb-4">Faça login para continuar.</p>
          <Link to={APP_ROUTES.LOGIN}><Button>Entrar</Button></Link>
        </div>
      </div>
    )
  }

  // Already OWNER or ADMIN
  if (profile && profile.role !== 'GUEST') {
    navigate(next, { replace: true })
    return null
  }

  return (
    <div className="min-h-screen bg-[#141414] flex items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-[#F5A623]/20 flex items-center justify-center mx-auto mb-4">
            <Home size={32} className="text-[#F5A623]" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white mb-2">Torne-se Anfitrião</h1>
          <p className="text-[#B3B3B3] text-sm max-w-sm mx-auto">
            Cadastre seus imóveis na Locaflix e comece a receber hóspedes com segurança e facilidade.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {BENEFITS.map(b => (
            <div key={b.title} className="bg-[#1F1F1F] border border-[#333] rounded-xl p-4">
              <div className="w-8 h-8 rounded-lg bg-[#F5A623]/10 flex items-center justify-center text-[#F5A623] mb-2">
                {b.icon}
              </div>
              <p className="text-sm font-semibold text-white mb-0.5">{b.title}</p>
              <p className="text-xs text-[#666]">{b.desc}</p>
            </div>
          ))}
        </div>

        {/* What happens */}
        <div className="bg-[#1F1F1F] border border-[#333] rounded-xl p-5 mb-6">
          <p className="text-xs font-semibold text-[#666] uppercase tracking-wide mb-3">O que acontece ao confirmar</p>
          {[
            'Seu perfil é atualizado para Anfitrião',
            'Você acessa o painel completo de gestão',
            'Pode cadastrar imóveis imediatamente',
            'Continua podendo fazer reservas como hóspede',
          ].map(item => (
            <div key={item} className="flex items-center gap-2 mb-2">
              <Check size={14} className="text-[#46D369] flex-shrink-0" />
              <span className="text-sm text-[#B3B3B3]">{item}</span>
            </div>
          ))}
        </div>

        <Button onClick={handleBecome} loading={loading} fullWidth size="lg">
          Confirmar — Tornar-me anfitrião
          <ArrowRight size={16} className="ml-2" />
        </Button>

        <p className="text-center text-xs text-[#555] mt-4">
          <Link to={APP_ROUTES.GUEST_DASHBOARD} className="hover:text-[#B3B3B3] transition-colors">
            Voltar para minha conta
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
