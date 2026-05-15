import { Mail, MessageCircle, Clock, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

const FAQS = [
  {
    q: 'Como funciona o pagamento parcelado via Pix?',
    a: 'Você realiza o pagamento via Pix, que é processado e dividido em parcelas mensais debitadas automaticamente. Não há acréscimo de juros para pagamentos em até 12x.',
  },
  {
    q: 'Posso cancelar minha reserva?',
    a: 'Sim. As condições de cancelamento dependem da política escolhida pelo anfitrião (Flexível, Moderado ou Firme). Consulte a página do imóvel antes de reservar.',
  },
  {
    q: 'O que acontece se o imóvel não corresponder ao anunciado?',
    a: 'Entre em contato com nossa equipe em até 24h após o check-in. Investigaremos o caso e, se confirmado, ofereceremos reembolso ou realocação.',
  },
  {
    q: 'Como me torno anfitrião na LOCAFLIX?',
    a: 'Basta criar uma conta, ir em "Tornar-se anfitrião" e cadastrar seu imóvel. Nossa equipe analisa e aprova em até 48h úteis.',
  },
  {
    q: 'Os imóveis são verificados?',
    a: 'Todos os imóveis passam por verificação de documentação e os anfitriões são validados pelo processo de KYC (Conheça seu cliente).',
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-[#333] rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 text-left hover:bg-[#1A1A1A] transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-sm font-semibold text-white pr-4">{q}</span>
        {open ? <ChevronUp size={16} className="text-[#666] flex-shrink-0" /> : <ChevronDown size={16} className="text-[#666] flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-[#B3B3B3] leading-relaxed border-t border-[#222]">
          <p className="pt-3">{a}</p>
        </div>
      )}
    </div>
  )
}

export function HelpPage() {
  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h1 className="font-display text-3xl font-bold text-white mb-3">Central de Ajuda</h1>
          <p className="text-[#B3B3B3] text-base">
            Tem dúvidas? Estamos aqui para ajudar. Consulte as perguntas frequentes ou entre em contato direto com nossa equipe.
          </p>
        </div>

        {/* Contact cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          <a
            href="mailto:suporte@locaflix.com.br"
            className="flex items-start gap-4 p-5 bg-[#1F1F1F] border border-[#333] hover:border-[#E50914]/40 rounded-2xl transition-colors group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#E50914]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#E50914]/20 transition-colors">
              <Mail size={20} className="text-[#E50914]" />
            </div>
            <div>
              <p className="font-semibold text-white mb-0.5">E-mail</p>
              <p className="text-sm text-[#B3B3B3]">suporte@locaflix.com.br</p>
              <p className="text-xs text-[#555] mt-1">Resposta em até 24h</p>
            </div>
          </a>

          <a
            href="https://wa.me/5511999999999"
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-4 p-5 bg-[#25D366]/5 border border-[#25D366]/30 hover:border-[#25D366]/60 rounded-2xl transition-colors group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#25D366]/20 transition-colors">
              <MessageCircle size={20} className="text-[#25D366]" />
            </div>
            <div>
              <p className="font-semibold text-white mb-0.5">WhatsApp</p>
              <p className="text-sm text-[#B3B3B3]">(11) 99999-9999</p>
              <p className="text-xs text-[#555] mt-1">Atendimento rápido</p>
            </div>
          </a>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Clock size={14} className="text-[#555]" />
          <p className="text-xs text-[#555]">Atendimento de segunda a sexta, das 9h às 18h (horário de Brasília)</p>
        </div>

        {/* FAQ */}
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-5">
            <HelpCircle size={18} className="text-[#E50914]" />
            <h2 className="font-display text-lg font-bold text-white">Perguntas frequentes</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => <FaqItem key={i} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
