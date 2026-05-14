import { useState } from 'react'
import { Star } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Booking } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { Modal } from './Modal'
import { Button } from './Button'

interface Props {
  open: boolean
  booking: Booking
  onClose: () => void
  onSuccess: () => void
}

const STAR_LABELS = ['', 'Terrível', 'Ruim', 'Regular', 'Bom', 'Excelente']
const MIN_CHARS = 20

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  const active = hover || value
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(i => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
          >
            <Star
              size={36}
              className={`transition-colors ${
                i <= active
                  ? 'fill-[#F5A623] text-[#F5A623]'
                  : 'text-[#444]'
              }`}
            />
          </button>
        ))}
      </div>
      <p className={`text-sm font-semibold h-5 transition-opacity ${active ? 'text-[#F5A623] opacity-100' : 'opacity-0'}`}>
        {STAR_LABELS[active]}
      </p>
    </div>
  )
}

export function ReviewModal({ open, booking, onClose, onSuccess }: Props) {
  const { user } = useAuth()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedLen = comment.trim().length
  const charOk = trimmedLen >= MIN_CHARS
  const canSubmit = rating > 0 && charOk

  function handleClose() {
    if (submitting) return
    setRating(0)
    setComment('')
    setError(null)
    onClose()
  }

  async function handleSubmit() {
    if (!user || !canSubmit) return
    setSubmitting(true)
    setError(null)

    const { error: err } = await supabase.from('reviews').insert({
      booking_id: booking.id,
      reviewer_id: user.id,
      target_property_id: booking.property_id,
      rating,
      comment: comment.trim(),
      mode: 'GUEST_RATES_PROPERTY',
    })

    setSubmitting(false)

    if (err) {
      if (err.code === '42501' || err.message.includes('row-level security')) {
        setError('O prazo para avaliar esta reserva expirou (14 dias após o checkout).')
      } else if (err.code === '23505') {
        setError('Você já avaliou esta reserva.')
      } else {
        setError(err.message)
      }
      return
    }

    setRating(0)
    setComment('')
    setError(null)
    onSuccess()
  }

  const propertyName = booking.property?.name ?? 'esta propriedade'

  return (
    <Modal open={open} onClose={handleClose} title="Avaliar estadia" size="md">
      <div className="space-y-6">
        {/* Property name */}
        <p className="text-sm text-[#B3B3B3]">
          Como foi sua experiência em{' '}
          <span className="text-white font-medium">{propertyName}</span>?
        </p>

        {/* Star picker */}
        <div className="py-1">
          <StarPicker value={rating} onChange={setRating} />
        </div>

        {/* Comment */}
        <div>
          <label className="block text-xs font-semibold text-[#B3B3B3] uppercase tracking-wide mb-2">
            Comentário <span className="text-[#E50914]">*</span>
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Conte como foi a estadia, a limpeza do imóvel, a comunicação com o anfitrião..."
            rows={4}
            className="w-full bg-[#0A0A0A] border border-[#333] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#E50914] resize-none transition-colors"
          />
          <div className="flex justify-between items-center mt-1.5">
            <p className={`text-xs transition-colors ${charOk ? 'text-[#46D369]' : 'text-[#666]'}`}>
              Mínimo {MIN_CHARS} caracteres
            </p>
            <p className={`text-xs tabular-nums transition-colors ${charOk ? 'text-[#46D369]' : 'text-[#666]'}`}>
              {trimmedLen} / {MIN_CHARS}
            </p>
          </div>
        </div>

        {/* Visibility info */}
        <div className="flex items-start gap-2 bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3">
          <Star size={13} className="text-[#555] mt-0.5 flex-shrink-0" />
          <p className="text-xs text-[#666] leading-relaxed">
            Sua avaliação ficará visível quando o anfitrião também avaliar a sua estadia,
            ou automaticamente após 14 dias do checkout.
          </p>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-[#E50914] bg-[#E50914]/10 border border-[#E50914]/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button fullWidth onClick={handleSubmit} loading={submitting} disabled={!canSubmit}>
            Enviar avaliação
          </Button>
        </div>
      </div>
    </Modal>
  )
}
