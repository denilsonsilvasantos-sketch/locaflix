import { useState } from 'react'
import { HelpCircle, Mail, MessageCircle, X } from 'lucide-react'

export function HelpCenter() {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="bg-[#1F1F1F] border border-[#333] rounded-2xl shadow-2xl w-72 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm font-bold text-white">Central de Ajuda</h3>
            <button onClick={() => setOpen(false)} className="text-[#666] hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-[#B3B3B3] mb-4">Precisando de ajuda? Fale conosco:</p>
          <div className="space-y-2.5">
            <a
              href="mailto:suporte@locaflix.com.br"
              className="flex items-center gap-3 p-3 bg-[#2A2A2A] hover:bg-[#333] rounded-xl transition-colors"
            >
              <Mail size={16} className="text-[#E50914] flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white">E-mail</p>
                <p className="text-[11px] text-[#B3B3B3]">suporte@locaflix.com.br</p>
              </div>
            </a>
            <a
              href="https://wa.me/5547992646761"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 p-3 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 rounded-xl transition-colors"
            >
              <MessageCircle size={16} className="text-[#25D366] flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white">WhatsApp</p>
                <p className="text-[11px] text-[#B3B3B3]">Atendimento rápido</p>
              </div>
            </a>
          </div>
          <p className="text-[10px] text-[#555] mt-4 text-center">Atendimento seg-sex, 9h às 18h</p>
        </div>
      )}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Central de Ajuda"
        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${
          open ? 'bg-[#333] text-white' : 'bg-[#E50914] text-white hover:bg-[#F40612]'
        }`}
      >
        {open ? <X size={18} /> : <HelpCircle size={20} />}
      </button>
    </div>
  )
}
