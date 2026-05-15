import { useState } from 'react'
import { Copy, Check, RefreshCw, Download, QrCode, FileText, ExternalLink } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { formatCurrency, formatDate } from '../../lib/utils'
import type { InstallmentPaymentResponse } from '../../types'

interface PaymentModalProps {
  open: boolean
  onClose: () => void
  payment: InstallmentPaymentResponse | null
  onCheckPayment: () => void
  loading?: boolean
}

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <div>
      <p className="text-xs text-[#666] mb-2 text-center">{label}</p>
      <div className="flex gap-2">
        <div className="flex-1 bg-[#0A0A0A] border border-[#333] rounded-xl px-3 py-2 text-xs text-[#B3B3B3] truncate font-mono">
          {value || '—'}
        </div>
        <button
          onClick={copy}
          disabled={!value}
          title="Copiar"
          className="flex-shrink-0 px-3 py-2 bg-[#1F1F1F] border border-[#333] rounded-xl text-[#B3B3B3] hover:text-white disabled:opacity-40 transition-colors"
        >
          {copied
            ? <Check size={16} className="text-[#46D369]" />
            : <Copy size={16} />}
        </button>
      </div>
    </div>
  )
}

export function PaymentModal({ open, onClose, payment, onCheckPayment, loading }: PaymentModalProps) {
  const [method, setMethod] = useState<'PIX' | 'BOLETO'>('PIX')

  if (!payment) return null

  const { pix, boleto } = payment

  return (
    <Modal open={open} onClose={onClose} title="Escolha como pagar" size="sm">
      <div className="space-y-5">
        {/* Header: valor + vencimento */}
        <div className="text-center">
          <p className="text-[#B3B3B3] text-sm mb-1">Valor da parcela</p>
          <p className="text-3xl font-bold text-white">{formatCurrency(pix.value)}</p>
          <p className="text-xs text-[#666] mt-1">Vence em {formatDate(pix.due_date)}</p>
        </div>

        {/* Toggle PIX / BOLETO */}
        <div className="flex bg-[#0A0A0A] border border-[#333] rounded-xl p-1">
          <button
            onClick={() => setMethod('PIX')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
              method === 'PIX'
                ? 'bg-[#E50914] text-white shadow'
                : 'text-[#666] hover:text-[#B3B3B3]'
            }`}
          >
            <QrCode size={15} />
            Pix
          </button>
          <button
            onClick={() => setMethod('BOLETO')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
              method === 'BOLETO'
                ? 'bg-[#1E4DA1] text-white shadow'
                : 'text-[#666] hover:text-[#B3B3B3]'
            }`}
          >
            <FileText size={15} />
            Boleto
          </button>
        </div>

        {/* PIX content */}
        {method === 'PIX' && (
          <div className="space-y-4">
            {pix.pix_qr_code && (
              <div className="flex justify-center">
                <div className="bg-white p-3 rounded-xl">
                  <img
                    src={`data:image/png;base64,${pix.pix_qr_code}`}
                    alt="QR Code Pix"
                    className="w-44 h-44"
                  />
                </div>
              </div>
            )}
            <CopyField value={pix.pix_key} label="Pix Copia e Cola" />
            <div className="bg-[#1F1F1F] border border-[#333] rounded-xl px-4 py-3 text-xs text-[#B3B3B3] space-y-1">
              <p>• Abra o app do seu banco e escolha <strong className="text-white">Pix</strong></p>
              <p>• Escaneie o QR Code ou cole o código acima</p>
              <p>• O pagamento é confirmado automaticamente</p>
            </div>
          </div>
        )}

        {/* BOLETO content */}
        {method === 'BOLETO' && (
          <div className="space-y-4">
            <a
              href={boleto.boleto_url}
              target="_blank"
              rel="noreferrer"
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors ${
                boleto.boleto_url
                  ? 'bg-[#1E4DA1] hover:bg-[#1a429a] text-white'
                  : 'bg-[#1F1F1F] text-[#555] cursor-not-allowed'
              }`}
              onClick={e => { if (!boleto.boleto_url) e.preventDefault() }}
            >
              <Download size={16} />
              Baixar boleto
              <ExternalLink size={13} className="opacity-70" />
            </a>
            <CopyField value={boleto.boleto_barcode} label="Código de barras" />
            <div className="bg-[#1F1F1F] border border-[#333] rounded-xl px-4 py-3 text-xs text-[#B3B3B3] space-y-1">
              <p>• O boleto pode ser pago em qualquer banco ou app bancário</p>
              <p>• Prazo de compensação: até 3 dias úteis</p>
              <p>• Vencimento: <strong className="text-white">{formatDate(boleto.due_date)}</strong></p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button variant="ghost" fullWidth onClick={onClose}>
            Fechar
          </Button>
          <Button fullWidth onClick={onCheckPayment} loading={loading} className="gap-2">
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
