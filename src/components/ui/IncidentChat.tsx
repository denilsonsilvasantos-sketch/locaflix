import { useEffect, useRef, useState } from 'react'
import { Check, MessageSquare, Send, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface IncidentMessage {
  id: string
  incident_id: string
  sender_id: string
  recipient_id: string | null
  content: string
  created_at: string
}

export interface IncidentForChat {
  id: string
  title: string
  description: string
  status: string
  photos?: string[] | null
  admin_notes?: string | null
}

const STATUS_LABELS: Record<string, string> = {
  ABERTO: 'Aberto',
  EM_ANALISE: 'Em Análise',
  RESOLVIDO: 'Resolvido',
  FECHADO: 'Fechado',
}

const STATUS_COLORS: Record<string, string> = {
  ABERTO: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  EM_ANALISE: 'bg-[#F5A623]/20 text-[#F5A623] border-[#F5A623]/30',
  RESOLVIDO: 'bg-[#46D369]/20 text-[#46D369] border-[#46D369]/30',
  FECHADO: 'bg-[#555]/20 text-[#999] border-[#555]/30',
}

export function IncidentChat({
  incident,
  onClose,
  currentUserId,
  isAdmin = false,
  guestId,
  guestName,
  ownerId,
  ownerName,
}: {
  incident: IncidentForChat
  onClose: () => void
  currentUserId: string
  isAdmin?: boolean
  guestId?: string
  guestName?: string
  ownerId?: string
  ownerName?: string
}) {
  const [messages, setMessages] = useState<IncidentMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [adminNotes, setAdminNotes] = useState(incident.admin_notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [partyTab, setPartyTab] = useState<'guest' | 'owner'>('guest')
  const bottomRef = useRef<HTMLDivElement>(null)

  const photos = (incident.photos ?? []).filter(Boolean)
  const hasTwoParties = isAdmin && !!guestId && !!ownerId

  useEffect(() => { void load() }, [incident.id])

  useEffect(() => {
    const ch = supabase
      .channel(`inc-chat-${incident.id}-${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'incident_messages',
        filter: `incident_id=eq.${incident.id}`,
      }, p => setMessages(prev => [...prev, p.new as IncidentMessage]))
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [incident.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, partyTab])

  async function load() {
    const { data } = await supabase
      .from('incident_messages')
      .select('*')
      .eq('incident_id', incident.id)
      .order('created_at', { ascending: true })
    setMessages((data ?? []) as IncidentMessage[])
  }

  // Admin: filter messages by the active party tab
  // Non-admin: RLS already restricts what they can see, show all
  const displayedMessages = hasTwoParties
    ? messages.filter(m => {
        const targetId = partyTab === 'guest' ? guestId! : ownerId!
        return m.sender_id === targetId || m.recipient_id === targetId
      })
    : messages

  async function send(content?: string) {
    const msg = (content ?? text).trim()
    if (!msg || sending) return
    setSending(true)

    const recipientId = isAdmin
      ? (partyTab === 'guest' ? guestId : ownerId)
      : undefined

    await supabase.from('incident_messages').insert({
      incident_id: incident.id,
      sender_id: currentUserId,
      content: msg,
      ...(recipientId ? { recipient_id: recipientId } : {}),
    })
    setText('')
    setSending(false)
  }

  async function saveNotes() {
    setSavingNotes(true)
    await supabase
      .from('incidents')
      .update({ admin_notes: adminNotes || null, updated_at: new Date().toISOString() })
      .eq('id', incident.id)
    setSavingNotes(false)
  }

  const colorCls = STATUS_COLORS[incident.status] ?? 'bg-[#333]/40 text-[#B3B3B3] border-[#333]'
  const activeName = partyTab === 'guest' ? (guestName ?? 'Hóspede') : (ownerName ?? 'Anfitrião')

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div
          className="bg-[#1F1F1F] border border-[#333] rounded-2xl w-full max-w-lg flex flex-col"
          style={{ maxHeight: '90vh' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-[#333] gap-3 flex-shrink-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="font-semibold text-white text-sm leading-snug">{incident.title}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorCls}`}>
                  {STATUS_LABELS[incident.status] ?? incident.status}
                </span>
              </div>
              <p className="text-xs text-[#B3B3B3] leading-relaxed line-clamp-3">{incident.description}</p>
            </div>
            <button
              onClick={onClose}
              className="text-[#666] hover:text-white transition-colors flex-shrink-0 mt-0.5"
            >
              <X size={16} />
            </button>
          </div>

          {/* Admin: party tabs (only when incident has a booking with both parties) */}
          {hasTwoParties && (
            <div className="flex border-b border-[#333] flex-shrink-0">
              <button
                onClick={() => setPartyTab('guest')}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                  partyTab === 'guest'
                    ? 'text-white border-b-2 border-[#E50914]'
                    : 'text-[#666] hover:text-[#B3B3B3]'
                }`}
              >
                {guestName ?? 'Hóspede'}
              </button>
              <button
                onClick={() => setPartyTab('owner')}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                  partyTab === 'owner'
                    ? 'text-white border-b-2 border-[#E50914]'
                    : 'text-[#666] hover:text-[#B3B3B3]'
                }`}
              >
                {ownerName ?? 'Anfitrião'}
              </button>
            </div>
          )}

          {/* Photos */}
          {photos.length > 0 && (
            <div className="px-5 pt-4 pb-3 border-b border-[#333] flex-shrink-0">
              <p className="text-[11px] text-[#555] mb-2">Fotos anexadas</p>
              <div className="flex gap-2 flex-wrap">
                {photos.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setLightbox(url)}
                    className="w-16 h-16 rounded-lg overflow-hidden border border-[#333] hover:border-[#E50914]/50 transition-colors flex-shrink-0"
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Admin: notes editor */}
          {isAdmin && (
            <div className="px-5 pt-4 pb-3 border-b border-[#333] flex-shrink-0 space-y-2">
              <p className="text-[11px] text-[#555] font-medium">Resposta visível ao usuário</p>
              <textarea
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
                rows={2}
                className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-xs text-white placeholder-[#444] outline-none focus:border-[#E50914] resize-none"
                placeholder="Escreva uma resposta visível ao usuário no painel dele..."
              />
              <button
                onClick={() => void saveNotes()}
                disabled={savingNotes}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#46D369]/10 border border-[#46D369]/30 text-[#46D369] text-xs font-semibold rounded-lg hover:bg-[#46D369]/20 transition-colors disabled:opacity-50"
              >
                {savingNotes
                  ? <span className="w-3 h-3 border-2 border-[#46D369] border-t-transparent rounded-full animate-spin" />
                  : <Check size={11} />}
                Salvar resposta
              </button>
            </div>
          )}

          {/* User: show admin response */}
          {!isAdmin && incident.admin_notes && (
            <div className="px-5 pt-3 pb-3 border-b border-[#333] flex-shrink-0">
              <p className="text-xs text-[#46D369] italic">
                Resposta da equipe: {incident.admin_notes}
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {displayedMessages.length === 0 && (
              <p className="text-center text-xs text-[#555] py-8">
                {isAdmin
                  ? `Nenhuma mensagem com ${activeName} ainda.`
                  : 'Nenhuma mensagem ainda. Envie uma mensagem para nossa equipe.'}
              </p>
            )}
            {displayedMessages.map(m => {
              const isOwn = m.sender_id === currentUserId
              return (
                <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm ${
                    isOwn
                      ? 'bg-[#E50914] text-white rounded-tr-sm'
                      : 'bg-[#2A2A2A] text-white rounded-tl-sm'
                  }`}>
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className={`text-[10px] mt-1 ${isOwn ? 'text-white/60 text-right' : 'text-[#555]'}`}>
                      {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-[#333] flex-shrink-0 space-y-2">
            {isAdmin && (
              <button
                onClick={() => void send('Por favor, nos envie mais detalhes sobre o ocorrido.')}
                className="flex items-center gap-1.5 text-xs text-[#F5A623] hover:text-[#F5A623]/70 transition-colors"
              >
                <MessageSquare size={11} />
                Solicitar informações
              </button>
            )}
            <div className="flex gap-2 items-end">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() }
                }}
                placeholder={
                  isAdmin
                    ? `Mensagem para ${activeName}...`
                    : 'Digite uma mensagem...'
                }
                rows={1}
                className="flex-1 bg-[#2A2A2A] border border-[#333] rounded-xl px-3 py-2 text-sm text-white placeholder-[#666] outline-none focus:ring-2 focus:ring-[#E50914] resize-none"
              />
              <button
                onClick={() => void send()}
                disabled={!text.trim() || sending}
                className="w-9 h-9 bg-[#E50914] hover:bg-[#F40612] rounded-xl flex items-center justify-center text-white transition-colors disabled:opacity-40 flex-shrink-0"
              >
                {sending
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Send size={15} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}
    </>
  )
}
