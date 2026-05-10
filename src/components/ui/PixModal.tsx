import { useState } from 'react'
import { Copy, Check, RefreshCw } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { formatCurrency, formatDate } from '../../lib/utils'
import type { PixPaymentResponse } from '../../types'

interface PixModalProps {
  open: boolean
  onClose: () => void
  pix: PixPaymentResponse | null
  onConfirm: () => void
  loading?: boolean
}

export function PixModal({ open, onClose, pix, onConfirm, loading }: PixModalProps) {
  const [copied, setCopied] = useState(false)

  async function copyKey() {
    if (!pix?.pix_key) return
    await navigator.clipboard.writeText(pix.pix_key)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  if (!pix) return null

  return (
    <Modal open={open} onClose={onClose} title="Pagar com Pix" size="sm">
      <div className="space-y-5">
        <div className="text-center">
          <p className="text-[#B3B3B3] text-sm mb-1">Valor a pagar</p>
          <p className="text-3xl font-bold text-white">{formatCurrency(pix.value)}</p>
          <p className="text-xs text-[#666] mt-1">Vence em {formatDate(pix.due_date)}</p>
        </div>

        {/* QR Code */}
        {pix.pix_qr_code && (
          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-xl">
              <img
                src={`data:image/png;base64,${pix.pix_qr_code}`}
                alt="QR Code Pix"
                className="w-48 h-48"
              />
            </div>
          </div>
        )}

        {/* Copia e cola */}
        <div>
          <p className="text-xs text-[#666] mb-2 text-center">Ou copie o código Pix</p>
          <div className="flex gap-2">
            <div className="flex-1 bg-[#0A0A0A] border border-[#333] rounded-xl px-3 py-2 text-xs text-[#B3B3B3] truncate font-mono">
              {pix.pix_key}
            </div>
            <button
              onClick={copyKey}
              className="flex-shrink-0 px-3 py-2 bg-[#1F1F1F] border border-[#333] rounded-xl text-[#B3B3B3] hover:text-white transition-colors"
            >
              {copied ? <Check size={16} className="text-[#46D369]" /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        <div className="bg-[#1F1F1F] border border-[#333] rounded-xl px-4 py-3 text-xs text-[#B3B3B3] space-y-1">
          <p>• Abra o app do seu banco e escolha <strong className="text-white">Pix</strong></p>
          <p>• Escaneie o QR Code ou cole o código acima</p>
          <p>• O pagamento é confirmado automaticamente</p>
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="ghost" fullWidth onClick={onClose}>
            Fechar
          </Button>
          <Button fullWidth onClick={onConfirm} loading={loading} className="gap-2">
            <RefreshCw size={14} />
            Já paguei
          </Button>
        </div>

        <p className="text-center text-xs text-[#555]">
          Ambiente sandbox — use dados de teste do Asaas
        </p>
      </div>
    </Modal>
  )
}
