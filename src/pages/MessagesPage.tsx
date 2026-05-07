import { useEffect, useRef, useState } from 'react'
import { Send, MessageSquare } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Booking, Message } from '../types'
import { useAuth } from '../hooks/useAuth'

export function MessagesPage() {
  const { user, profile } = useAuth()
  const [conversations, setConversations] = useState<Booking[]>([])
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user) loadConversations()
  }, [user])

  useEffect(() => {
    if (activeBooking) {
      loadMessages(activeBooking.id)
      const channel = supabase
        .channel(`messages:${activeBooking.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
          filter: `booking_id=eq.${activeBooking.id}`,
        }, payload => {
          setMessages(prev => [...prev, payload.new as Message])
        })
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }
  }, [activeBooking])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadConversations() {
    const isOwner = profile?.role === 'OWNER'
    const filter = isOwner ? 'owner_id' : 'guest_id'
    const { data } = await supabase
      .from('bookings')
      .select('*, property:properties(id,name,photos), guest:users!guest_id(id,name,avatar_url), owner:users!owner_id(id,name,avatar_url)')
      .eq(filter, user!.id)
      .order('updated_at', { ascending: false })
      .limit(20)
    setConversations((data ?? []) as Booking[])
    if (data && data.length > 0) setActiveBooking(data[0] as Booking)
  }

  async function loadMessages(bookingId: string) {
    const { data } = await supabase
      .from('messages')
      .select('*, sender:users!sender_id(id,name,avatar_url)')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true })
      .limit(100)
    setMessages((data ?? []) as Message[])
    // Mark as read
    if (user) {
      await supabase.from('messages')
        .update({ is_read: true })
        .eq('booking_id', bookingId)
        .eq('receiver_id', user.id)
        .eq('is_read', false)
    }
  }

  async function sendMessage() {
    if (!text.trim() || !activeBooking || !user) return
    setSending(true)
    const isOwner = profile?.role === 'OWNER'
    const receiverId = isOwner ? activeBooking.guest_id : activeBooking.owner_id
    await supabase.from('messages').insert({
      booking_id: activeBooking.id,
      sender_id: user.id,
      receiver_id: receiverId,
      content: text.trim(),
    })
    setText('')
    setSending(false)
  }

  const otherParty = (b: Booking) =>
    profile?.role === 'OWNER' ? b.guest : b.owner

  return (
    <div className="min-h-screen bg-[#141414] pt-24 flex flex-col">
      <div className="flex-1 flex max-w-6xl mx-auto w-full px-4 py-6 gap-4 min-h-0">
        {/* Conversation list */}
        <div className="w-72 flex-shrink-0 bg-[#1F1F1F] border border-[#333] rounded-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[#333]">
            <h2 className="font-display text-lg font-bold text-white">Mensagens</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MessageSquare size={32} className="mx-auto text-[#333] mb-3" />
                <p className="text-xs text-[#666]">Nenhuma conversa ainda.</p>
              </div>
            ) : (
              conversations.map(conv => {
                const other = otherParty(conv)
                const isActive = activeBooking?.id === conv.id
                return (
                  <button
                    key={conv.id}
                    onClick={() => setActiveBooking(conv)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isActive ? 'bg-[#2A2A2A]' : 'hover:bg-[#252525]'}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#E50914] flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden">
                      {other?.avatar_url
                        ? <img src={other.avatar_url} alt="" className="w-full h-full object-cover" />
                        : other?.name?.[0] ?? '?'
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{other?.name ?? 'Usuário'}</p>
                      <p className="text-xs text-[#B3B3B3] truncate">{conv.property?.name}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Chat window */}
        <div className="flex-1 bg-[#1F1F1F] border border-[#333] rounded-2xl overflow-hidden flex flex-col min-w-0">
          {activeBooking ? (
            <>
              {/* Chat header */}
              <div className="px-5 py-3 border-b border-[#333] flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#E50914] flex items-center justify-center text-sm font-bold text-white overflow-hidden flex-shrink-0">
                  {otherParty(activeBooking)?.avatar_url
                    ? <img src={otherParty(activeBooking)!.avatar_url!} alt="" className="w-full h-full object-cover" />
                    : otherParty(activeBooking)?.name?.[0] ?? '?'
                  }
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{otherParty(activeBooking)?.name}</p>
                  <p className="text-xs text-[#B3B3B3]">{activeBooking.property?.name}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {messages.length === 0 && (
                  <p className="text-center text-sm text-[#666] py-8">Nenhuma mensagem ainda. Diga olá!</p>
                )}
                {messages.map(m => {
                  const isOwn = m.sender_id === user?.id
                  return (
                    <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                        isOwn
                          ? 'bg-[#E50914] text-white rounded-tr-sm'
                          : 'bg-[#2A2A2A] text-white rounded-tl-sm'
                      }`}>
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        <p className={`text-[10px] mt-1 ${isOwn ? 'text-white/60 text-right' : 'text-[#666]'}`}>
                          {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-[#333] flex gap-3 items-end">
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
                  }}
                  placeholder="Digite uma mensagem..."
                  rows={1}
                  className="flex-1 bg-[#2A2A2A] border border-[#333] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#666] outline-none focus:ring-2 focus:ring-[#E50914] resize-none max-h-32"
                />
                <button
                  onClick={sendMessage}
                  disabled={!text.trim() || sending}
                  className="w-10 h-10 bg-[#E50914] rounded-xl flex items-center justify-center text-white hover:bg-[#F40612] transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#666]">
              <MessageSquare size={48} className="mb-4" />
              <p>Selecione uma conversa</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
