import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { APP_ROUTES } from '../constants'

interface PolicyRule {
  days_before: number
  refund_percentage: number
  description: string
}

interface PolicyData {
  id: string
  policy_name: string
  rules: PolicyRule[]
}

const POLICY_META: Record<string, { emoji: string; borderColor: string; subtitle: string }> = {
  LEVE: {
    emoji: '🟢',
    borderColor: 'border-green-500',
    subtitle: 'Indicada para imóveis com alta procura e facilidade de nova locação.',
  },
  MODERADA: {
    emoji: '🟠',
    borderColor: 'border-orange-500',
    subtitle: 'Indicada para datas concorridas e imóveis com planejamento financeiro maior.',
  },
  FIRME: {
    emoji: '🔴',
    borderColor: 'border-red-500',
    subtitle: 'Indicada para alta temporada, feriados, imóveis premium e períodos especiais.',
  },
}

function Section({ emoji, borderColor, title, subtitle, children }: {
  emoji: string
  borderColor: string
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className={`border-l-4 ${borderColor} bg-[#1A1A1A] rounded-r-xl p-6 mb-6`}>
      <div className="flex items-center gap-3 mb-1">
        <span className="text-2xl">{emoji}</span>
        <h2 className="font-display text-xl font-bold text-white">{title}</h2>
      </div>
      <p className="text-xs text-[#B3B3B3] mb-4 italic">{subtitle}</p>
      {children}
    </div>
  )
}

function Rule({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-[#F5A623] mb-2">{title}</h3>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-[#B3B3B3] flex gap-2">
            <span className="text-[#555] mt-0.5">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const STATIC_POLICIES: PolicyData[] = [
  {
    id: 'leve',
    policy_name: 'LEVE',
    rules: [
      { days_before: 2, refund_percentage: 100, description: 'O hóspede pode cancelar gratuitamente até 48 horas antes do check-in.' },
      { days_before: 0, refund_percentage: 0, description: 'Sem reembolso. Anfitrião recebe normalmente. Locaflix mantém as taxas operacionais.' },
    ],
  },
  {
    id: 'moderada',
    policy_name: 'MODERADA',
    rules: [
      { days_before: 15, refund_percentage: 100, description: 'O hóspede pode cancelar gratuitamente até 15 dias antes do check-in.' },
      { days_before: 0, refund_percentage: 0, description: 'Sem reembolso. Anfitrião recebe normalmente. Locaflix mantém as taxas operacionais.' },
    ],
  },
  {
    id: 'firme',
    policy_name: 'FIRME',
    rules: [
      { days_before: 30, refund_percentage: 100, description: 'O hóspede pode cancelar gratuitamente até 30 dias antes do check-in.' },
      { days_before: 0, refund_percentage: 0, description: 'Sem reembolso. Anfitrião recebe normalmente. Locaflix mantém as taxas operacionais.' },
    ],
  },
]

function renderRuleTitle(rule: PolicyRule): string {
  if (rule.refund_percentage === 100 && rule.days_before > 0) {
    return 'Cancelamento gratuito'
  }
  if (rule.refund_percentage === 0) {
    return 'Cancelamento sem reembolso'
  }
  return `Cancelamento com ${rule.refund_percentage}% de reembolso`
}

export function CancellationPolicy() {
  const [policies, setPolicies] = useState<PolicyData[]>(STATIC_POLICIES)

  useEffect(() => {
    supabase
      .from('cancellation_policies_config')
      .select('*')
      .order('policy_name')
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          setPolicies(data as PolicyData[])
        }
      })
  }, [])

  return (
    <div className="min-h-screen bg-[#141414] pt-28 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-10">
          <Link to={APP_ROUTES.HOME} className="text-xs text-[#666] hover:text-[#B3B3B3] transition-colors mb-4 inline-block">
            ← Voltar ao início
          </Link>
          <h1 className="font-display text-4xl font-bold text-white mb-3">Políticas de Cancelamento</h1>
          <p className="text-[#B3B3B3] leading-relaxed">
            As políticas da Locaflix foram criadas para equilibrar proteção ao anfitrião,
            flexibilidade ao hóspede, previsibilidade financeira e possibilidade real de realocação
            da data cancelada. Todas as políticas seguem o horário local do imóvel reservado.
          </p>
        </div>

        {/* Dynamic policy sections */}
        {policies.map(policy => {
          const meta = POLICY_META[policy.policy_name] ?? {
            emoji: '⚪',
            borderColor: 'border-[#555]',
            subtitle: '',
          }
          return (
            <Section
              key={policy.id}
              emoji={meta.emoji}
              borderColor={meta.borderColor}
              title={policy.policy_name}
              subtitle={meta.subtitle}
            >
              {policy.rules.map((rule, i) => (
                <Rule
                  key={i}
                  title={renderRuleTitle(rule)}
                  items={[
                    rule.description,
                    ...(rule.days_before === 0 ? ['Não comparecimento (No-show): sem reembolso.'] : []),
                  ]}
                />
              ))}
            </Section>
          )
        })}

        {/* Direito de Arrependimento — CDC Art. 49 */}
        <div className="bg-[#1A1A1A] border border-[#333] rounded-xl p-6 mb-6">
          <h2 className="font-display text-xl font-bold text-white mb-3 flex items-center gap-2">
            <span>⚖️</span> Direito de Arrependimento — CDC Art. 49
          </h2>
          <p className="text-sm text-[#B3B3B3] mb-4">
            Independentemente da política escolhida pelo anfitrião, o Código de Defesa do Consumidor (Art. 49)
            garante ao hóspede o direito de arrependimento nas seguintes condições:
          </p>
          <ul className="space-y-2 mb-4">
            {[
              'Reembolso total em até 7 dias corridos após a confirmação da reserva, sem necessidade de justificativa.',
              'Exceção: se a estadia tiver início em menos de 14 dias a partir da data da reserva, o prazo de arrependimento é reduzido para 24 horas após a confirmação.',
            ].map((item, i) => (
              <li key={i} className="text-sm text-[#B3B3B3] flex gap-2">
                <span className="text-[#555] mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[#555] italic">
            O direito de arrependimento prevalece sobre qualquer política de cancelamento. Solicitações fora deste prazo seguem a política do imóvel.
          </p>
        </div>

        {/* Reservas parceladas */}
        <div className="bg-[#1A1A1A] border border-[#333] rounded-xl p-6 mb-6">
          <h2 className="font-display text-xl font-bold text-white mb-3 flex items-center gap-2">
            <span>💳</span> Reservas Parceladas
          </h2>
          <ul className="space-y-1">
            {[
              'Parcelas futuras poderão ser canceladas automaticamente.',
              'Valores pagos seguirão a política aplicável.',
              'Taxas financeiras e operacionais podem não ser reembolsáveis.',
            ].map((item, i) => (
              <li key={i} className="text-sm text-[#B3B3B3] flex gap-2">
                <span className="text-[#555] mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Liberação do imóvel */}
        <div className="bg-[#1A1A1A] border border-[#333] rounded-xl p-6 mb-6">
          <h2 className="font-display text-xl font-bold text-white mb-3 flex items-center gap-2">
            <span>🔒</span> Liberação do Imóvel
          </h2>
          <p className="text-sm text-[#B3B3B3] mb-3">O acesso ao imóvel somente será liberado quando:</p>
          <ul className="space-y-1">
            {[
              '100% da reserva estiver quitada;',
              'Contrato digital estiver assinado;',
              'KYC aprovado;',
              'Não houver pendências financeiras.',
            ].map((item, i) => (
              <li key={i} className="text-sm text-[#B3B3B3] flex gap-2">
                <span className="text-[#555] mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Cancelamento pelo anfitrião */}
        <div className="bg-[#1A1A1A] border border-red-900/40 rounded-xl p-6 mb-6">
          <h2 className="font-display text-xl font-bold text-white mb-3 flex items-center gap-2">
            <span>🚨</span> Cancelamento pelo Anfitrião
          </h2>
          <p className="text-sm text-[#B3B3B3] mb-3">Caso o anfitrião cancele a reserva:</p>
          <ul className="space-y-1">
            {[
              'O hóspede recebe reembolso integral.',
              'O anfitrião poderá sofrer: multas, bloqueios, perda de visibilidade e suspensão da conta em reincidências.',
            ].map((item, i) => (
              <li key={i} className="text-sm text-[#B3B3B3] flex gap-2">
                <span className="text-[#555] mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Recomendação */}
        <div className="bg-[#1A1A1A] border border-[#F5A623]/30 rounded-xl p-6">
          <h2 className="font-display text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>📌</span> Recomendação da Locaflix aos Anfitriões
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { emoji: '🟢', policy: 'LEVE', use: 'Imóveis urbanos e alta rotatividade' },
              { emoji: '🟠', policy: 'MODERADA', use: 'Períodos concorridos' },
              { emoji: '🔴', policy: 'FIRME', use: 'Feriados e alta temporada' },
            ].map(({ emoji, policy, use }) => (
              <div key={policy} className="flex items-start gap-3 bg-[#222] rounded-lg p-3">
                <span className="text-lg">{emoji}</span>
                <div>
                  <p className="text-sm font-bold text-white">{policy}</p>
                  <p className="text-xs text-[#B3B3B3]">{use}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
