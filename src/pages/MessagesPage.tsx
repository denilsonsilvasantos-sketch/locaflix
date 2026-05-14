import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Edit, MessageSquare, Send, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Message } from '../types'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { getInitials } from '../lib/utils'

type Contact = {
  id: string
  name: string | null
  avatar_url: string | null
  lastMessage: string
  lastAt: string
  unread: number
  lastSubject: string | null
}

type Recipient = {
  id: string
  name: string | null
  avatar_url: string | null
}

export function MessagesPage() {
  const { user, profile } = useAuth()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [activeContactId, setActiveContactId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const activeContactIdRef = useRef<string | null>(null)

  // Compose
  const [composeOpen, setComposeOpen] = useState(false)
  const [recipientList, setRecipientList] = useState<Recipient[]>([])
  const [composeRecipientId, setComposeRecipientId] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeText, setComposeText] = useState('')
  const [composeSending, setComposeSending] = useState(false)

  useEffect(() => { activeContactIdRef.current = activeContactId }, [activeContactId])

  useEffect(() => {
    if (user?.id) {
      loadContacts()
      loadRecipientList()
    }
  }, [user?.id])

  // Global realtime: listen for messages received by this user
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`messages-inbox-${user.id}-${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${user.id}`,
      }, payload => {
        const m = payload.new as Message
        if (m.sender_id === activeContactIdRef.current) {
          setMessages(prev => [...prev, m])
        }
        setContacts(prev => {
          const exists = prev.find(c => c.id === m.sender_id)
          if (exists) {
            return prev.map(c => c.id === m.sender_id
              ? { ...c, lastMessage: m.content, lastAt: m.created_at, unread: m.sender_id !== activeContactIdRef.current ? c.unread + 1 : c.unread }
              : c
            ).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
          }
          // New contact — reload full list
          void loadContacts()
          return prev
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadContacts() {
    if (!user?.id) return
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, is_read, created_at, subject')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(300)

    if (!msgs || msgs.length === 0) return

    // Collect all unique other-party IDs
    const otherIds = [...new Set(
      msgs.map(m => m.sender_id === user.id ? m.receiver_id : m.sender_id).filter(Boolean)
    )]

    // Fetch user details separately (avoids FK join issues)
    const { data: users } = await supabase
      .from('users')
      .select('id, name, avatar_url')
      .in('id', otherIds)

    const userMap: Record<string, { name: string | null; avatar_url: string | null }> = {}
    for (const u of users ?? []) userMap[u.id] = u

    const map: Record<string, Contact> = {}
    for (const m of msgs) {
      const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id
      if (!otherId) continue
      if (!map[otherId]) {
        const u = userMap[otherId] ?? { name: null, avatar_url: null }
        map[otherId] = {
          id: otherId,
          name: u.name,
          avatar_url: u.avatar_url,
          lastMessage: m.content,
          lastAt: m.created_at,
          unread: 0,
          lastSubject: m.subject ?? null,
        }
      }
      if (!m.is_read && m.receiver_id === user.id) map[otherId].unread++
    }

    const sorted = Object.values(map).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
    setContacts(sorted)

    if (!activeContactIdRef.current && sorted.length > 0) {
      setActiveContactId(sorted[0].id)
      await loadMessages(sorted[0].id)
    }
  }

  async function loadMessages(contactId: string) {
    if (!user?.id) return
    const { data } = await supabase
      .from('messages')
      .select('*, sender:users!sender_id(id,name,avatar_url)')
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${contactId}),` +
        `and(sender_id.eq.${contactId},receiver_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true })
      .limit(100)

    setMessages((data ?? []) as Message[])

    // Mark as read
    await supabase.from('messages')
      .update({ is_read: true })
      .eq('receiver_id', user.id)
      .eq('sender_id', contactId)
      .eq('is_read', false)

    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, unread: 0 } : c))
  }

  async function loadRecipientList() {
    if (!user?.id) return
    try {
      const col = profile?.role === 'OWNER' ? 'guest_id' : 'owner_id'
      const filter = profile?.role === 'OWNER' ? 'owner_id' : 'guest_id'
      const { data: bks } = await supabase
        .from('bookings')
        .select(col)
        .eq(filter, user.id)

      const ids = [...new Set((bks ?? []).map((b: Record<string, string>) => b[col]).filter(Boolean))]
      if (ids.length === 0) { setRecipientList([]); return }

      const { data: recipients } = await supabase
        .from('users')
        .select('id, name, avatar_url')
        .in('id', ids)

      setRecipientList((recipients ?? []) as Recipient[])
    } catch { }
  }

  async function sendMessage() {
    if (!text.trim() || !activeContactId || !user) return
    setSending(true)
    const { data: newMsg } = await supabase
      .from('messages')
      .insert({
        booking_id: null,
        sender_id: user.id,
        receiver_id: activeContactId,
        content: text.trim(),
        subject: null,
      })
      .select('*, sender:users!sender_id(id,name,avatar_url)')
      .single()

    if (newMsg) setMessages(prev => [...prev, newMsg as Message])
    setContacts(prev => prev.map(c =>
      c.id === activeContactId
        ? { ...c, lastMessage: text.trim(), lastAt: new Date().toISOString() }
        : c
    ))
    setText('')
    setSending(false)
  }

  async function sendCompose() {
    if (!composeText.trim() || !composeRecipientId || !user) return
    setComposeSending(true)
    try {
      await supabase.from('messages').insert({
        booking_id: null,
        sender_id: user.id,
        receiver_id: composeRecipientId,
        content: composeText.trim(),
        subject: composeSubject.trim() || null,
      })

      // Switch to the new conversation
      setComposeOpen(false)
      setComposeRecipientId('')
      setComposeSubject('')
      setComposeText('')

      await loadContacts()
      setActiveContactId(composeRecipientId)
      await loadMessages(composeRecipientId)
    } finally {
      setComposeSending(false)
    }
  }

  const activeContact = contacts.find(c => c.id === activeContactId)

  return (
    <div className="min-h-screen bg-[#141414] pt-24 flex flex-col">
      <div
        className="flex-1 flex max-w-6xl mx-auto w-full px-4 py-6 gap-4"
        style={{ height: 'calc(100vh - 120px)' }}
      >
        {/* ── Contact list ─────────────────────────────── */}
        <div className="w-72 flex-shrink-0 bg-[#1F1F1F] border border-[#333] rounded-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[#333] flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white">Mensagens</h2>
            <button
              onClick={() => setComposeOpen(true)}
              className="w-8 h-8 flex items-center justify-center bg-[#E50914] rounded-lg hover:bg-[#F40612] transition-colors"
              title="Nova mensagem"
            >
              <Edit size={14} className="text-white" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {contacts.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MessageSquare size={32} className="mx-auto text-[#333] mb-3" />
                <p className="text-xs text-[#666]">Nenhuma conversa ainda.</p>
                <button
                  onClick={() => setComposeOpen(true)}
                  className="mt-3 text-xs text-[#E50914] hover:underline"
                >
                  Nova mensagem
                </button>
              </div>
            ) : (
              contacts.map(contact => {
                const isActive = contact.id === activeContactId
                return (
                  <button
                    key={contact.id}
                    onClick={() => { setActiveContactId(contact.id); void loadMessages(contact.id) }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isActive ? 'bg-[#2A2A2A]' : 'hover:bg-[#252525]'}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#E50914] flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden">
                      {contact.avatar_url
                        ? <img src={contact.avatar_url} alt="" className="w-full h-full object-cover" />
                        : getInitials(contact.name ?? '?')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-sm font-semibold text-white truncate">{contact.name ?? 'Usuário'}</p>
                        {contact.unread > 0 && (
                          <span className="w-5 h-5 bg-[#E50914] rounded-full text-[9px] font-bold flex items-center justify-center text-white flex-shrink-0">
                            {contact.unread > 9 ? '9+' : contact.unread}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#666] truncate">{contact.lastMessage}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ── Chat window ──────────────────────────────── */}
        <div className="flex-1 bg-[#1F1F1F] border border-[#333] rounded-2xl overflow-hidden flex flex-col min-w-0">
          {activeContact ? (
            <>
              {/* Header */}
              <div className="px-5 py-3 border-b border-[#333] flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#E50914] flex items-center justify-center text-sm font-bold text-white overflow-hidden flex-shrink-0">
                  {activeContact.avatar_url
                    ? <img src={activeContact.avatar_url} alt="" className="w-full h-full object-cover" />
                    : getInitials(activeContact.name ?? '?')}
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{activeContact.name ?? 'Usuário'}</p>
                  {activeContact.lastSubject && (
                    <p className="text-xs text-[#B3B3B3]">{activeContact.lastSubject}</p>
                  )}
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
                    <div key={m.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                      {m.subject && (
                        <p className="text-[10px] text-[#666] mb-1 px-1">Assunto: {m.subject}</p>
                      )}
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
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage() }
                  }}
                  placeholder="Digite uma mensagem..."
                  rows={1}
                  className="flex-1 bg-[#2A2A2A] border border-[#333] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#666] outline-none focus:ring-2 focus:ring-[#E50914] resize-none max-h-32"
                />
                <button
                  onClick={() => void sendMessage()}
                  disabled={!text.trim() || sending}
                  className="w-10 h-10 bg-[#E50914] rounded-xl flex items-center justify-center text-white hover:bg-[#F40612] transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#666] gap-4">
              <MessageSquare size={48} className="mb-2" />
              <p className="text-sm">Selecione uma conversa</p>
              <button
                onClick={() => setComposeOpen(true)}
                className="text-sm text-[#E50914] hover:underline"
              >
                ou envie uma nova mensagem
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Compose modal ────────────────────────────── */}
      {composeOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setComposeOpen(false)}
        >
          <div
            className="bg-[#1F1F1F] border border-[#333] rounded-2xl w-full max-w-md p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-lg font-bold text-white">Nova mensagem</h3>
              <button
                onClick={() => setComposeOpen(false)}
                className="text-[#666] hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Recipient */}
              <div>
                <label className="block text-xs text-[#B3B3B3] mb-1.5 font-medium">Para</label>
                {recipientList.length > 0 ? (
                  <div className="relative">
                    <select
                      value={composeRecipientId}
                      onChange={e => setComposeRecipientId(e.target.value)}
                      className="w-full bg-[#2A2A2A] border border-[#333] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-[#E50914] appearance-none pr-8"
                    >
                      <option value="" disabled>Selecione o destinatário</option>
                      {recipientList.map(r => (
                        <option key={r.id} value={r.id}>{r.name ?? 'Usuário'}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] pointer-events-none" />
                  </div>
                ) : (
                  <p className="text-xs text-[#666] bg-[#2A2A2A] border border-[#333] rounded-xl px-3 py-2.5">
                    Nenhum contato disponível. Faça uma reserva para iniciar uma conversa com um anfitrião.
                  </p>
                )}
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs text-[#B3B3B3] mb-1.5 font-medium">Assunto</label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={e => setComposeSubject(e.target.value)}
                  placeholder="Ex: Dúvida sobre o imóvel"
                  className="w-full bg-[#2A2A2A] border border-[#333] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#666] outline-none focus:ring-2 focus:ring-[#E50914]"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs text-[#B3B3B3] mb-1.5 font-medium">Mensagem</label>
                <textarea
                  value={composeText}
                  onChange={e => setComposeText(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  rows={4}
                  className="w-full bg-[#2A2A2A] border border-[#333] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#666] outline-none focus:ring-2 focus:ring-[#E50914] resize-none"
                />
              </div>

              <Button
                onClick={() => void sendCompose()}
                loading={composeSending}
                disabled={!composeRecipientId || !composeText.trim()}
                fullWidth
              >
                Enviar mensagem
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
