import { Link } from 'react-router-dom'
import { Search, CalendarCheck, CreditCard, Key, Star, Shield } from 'lucide-react'
import { APP_ROUTES } from '../constants'

const STEPS = [
  {
    icon: Search,
    title: 'Encontre o imóvel ideal',
    desc: 'Pesquise por destino, datas e número de hóspedes. Filtre por tipo de imóvel, comodidades e faixa de preço.',
  },
  {
    icon: CalendarCheck,
    title: 'Selecione as datas',
    desc: 'Escolha a data de entrada e saída. O calendário mostra os dias disponíveis e o preço exato do período.',
  },
  {
    icon: CreditCard,
    title: 'Reserve e parcele no Pix',
    desc: 'Pague com Pix parcelado em até 12x sem juros. Seu dinheiro fica bloqueado até a confirmação do check-in.',
  },
  {
    icon: Key,
    title: 'Faça o check-in',
    desc: 'No dia da chegada você recebe as instruções de acesso diretamente pelo anfitrião via mensagem na plataforma.',
  },
  {
    icon: Star,
    title: 'Avalie sua experiência',
    desc: 'Após o check-out, deixe uma avaliação para ajudar outros hóspedes e dar feedback ao anfitrião.',
  },
  {
    icon: Shield,
    title: 'Proteção garantida',
    desc: 'Todas as reservas têm cobertura da LOCAFLIX. Em caso de problema, nossa equipe resolve.',
  },
]

export function HowItWorks() {
  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h1 className="font-display text-3xl font-bold text-white mb-3">Como funciona</h1>
          <p className="text-[#B3B3B3] text-base leading-relaxed">
            A LOCAFLIX é uma plataforma de aluguel de imóveis por temporada com pagamento parcelado via Pix.
            Veja como é simples reservar sua próxima viagem.
          </p>
        </div>

        <div className="space-y-4 mb-12">
          {STEPS.map((step, i) => (
            <div key={i} className="flex gap-5 p-5 bg-[#1F1F1F] border border-[#333] rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-[#E50914]/10 flex items-center justify-center flex-shrink-0">
                <step.icon size={20} className="text-[#E50914]" />
              </div>
              <div>
                <p className="font-semibold text-white mb-1">
                  <span className="text-[#E50914] mr-2">{i + 1}.</span>{step.title}
                </p>
                <p className="text-sm text-[#B3B3B3] leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-[#1F1F1F] border border-[#333] rounded-2xl p-6 text-center">
          <h2 className="font-display text-lg font-bold text-white mb-2">Pronto para começar?</h2>
          <p className="text-sm text-[#B3B3B3] mb-4">Explore centenas de imóveis disponíveis em todo o Brasil.</p>
          <Link
            to={APP_ROUTES.HOME}
            className="inline-block px-6 py-2.5 bg-[#E50914] hover:bg-[#F40612] text-white font-semibold rounded-xl transition-colors text-sm"
          >
            Explorar imóveis
          </Link>
        </div>
      </div>
    </div>
  )
}
