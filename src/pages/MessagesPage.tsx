import { useEffect, useRef, useState } from 'react'
import { Bell, Calendar, ChevronDown, ChevronLeft, DollarSign, Edit, Headphones, Heart, Home, MessageSquare, Send, ShieldCheck, Star, User, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Message } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/Button'
import { getInitials } from '../lib/utils'

const SUPPORT_ID = '698e7994-96b4-4295-a72d-ba33497387b2'

type Contact = {
  id: string
  name: string | null
  avatar_url: string | null
  lastMessage: string
  lastAt: string
  unread: number
  lastSubject: string | null
  pairIds?: [string, string]
}

type Recipient = {
  id: string
  name: string | null
  avatar_url: string | null
}

export function MessagesPage() {
  const { user, profile } = useAuth()
  const { toast } = useToast()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [activeContactId, setActiveContactId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list')
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
    if (user?.id && profile !== null) {
      void loadContacts()
      void loadRecipientList()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.role])

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
    if (profile?.role === 'ADMIN') { await loadAdminContacts(); return }

    const { data: msgs } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, is_read, created_at, subject')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(300)

    if (!msgs || msgs.length === 0) return

    const otherIds = [...new Set(
      msgs.map(m => m.sender_id === user.id ? m.receiver_id : m.sender_id).filter(Boolean)
    )]

    const { data: usersData } = await supabase
      .from('users')
      .select('id, name, avatar_url')
      .in('id', otherIds)

    const userMap: Record<string, { name: string | null; avatar_url: string | null }> = {}
    for (const u of usersData ?? []) userMap[u.id] = u

    const map: Record<string, Contact> = {}
    for (const m of msgs) {
      const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id
      if (!otherId) continue
      if (!map[otherId]) {
        const u = userMap[otherId] ?? { name: null, avatar_url: null }
        map[otherId] = {
          id: otherId,
          name: otherId === SUPPORT_ID ? 'Suporte LOCAFLIX' : u.name,
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

  async function loadAdminContacts() {
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at, subject')
      .order('created_at', { ascending: false })
      .limit(500)

    if (!msgs || msgs.length === 0) return

    const allIds = [...new Set([...msgs.map(m => m.sender_id), ...msgs.map(m => m.receiver_id)].filter(Boolean))]
    const { data: usersData } = await supabase.from('users').select('id, name, avatar_url').in('id', allIds)
    const userMap: Record<string, { name: string | null; avatar_url: string | null }> = {}
    for (const u of usersData ?? []) userMap[u.id] = u

    const map: Record<string, Contact> = {}
    for (const m of msgs) {
      if (!m.sender_id || !m.receiver_id) continue
      const pair = [m.sender_id, m.receiver_id].sort() as [string, string]
      const pairKey = pair.join('__')
      if (!map[pairKey]) {
        const n1 = pair[0] === SUPPORT_ID ? 'Suporte LOCAFLIX' : (userMap[pair[0]]?.name ?? 'Usuário')
        const n2 = pair[1] === SUPPORT_ID ? 'Suporte LOCAFLIX' : (userMap[pair[1]]?.name ?? 'Usuário')
        map[pairKey] = {
          id: pairKey,
          name: `${n1} ↔ ${n2}`,
          avatar_url: null,
          lastMessage: m.content,
          lastAt: m.created_at,
          unread: 0,
          lastSubject: m.subject ?? null,
          pairIds: pair,
        }
      }
    }

    const sorted = Object.values(map).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
    setContacts(sorted)

    if (!activeContactIdRef.current && sorted.length > 0) {
      setActiveContactId(sorted[0].id)
      await loadMessages(sorted[0].id, sorted[0].pairIds)
    }
  }

  async function loadMessages(contactId: string, pairIds?: [string, string]) {
    if (!user?.id) return
    const [uid1, uid2] = pairIds ?? [user.id, contactId]
    const { data } = await supabase
      .from('messages')
      .select('*, sender:users!sender_id(id,name,avatar_url)')
      .or(
        `and(sender_id.eq.${uid1},receiver_id.eq.${uid2}),` +
        `and(sender_id.eq.${uid2},receiver_id.eq.${uid1})`
      )
      .order('created_at', { ascending: true })
      .limit(100)

    setMessages((data ?? []) as Message[])

    if (!pairIds) {
      await supabase.from('messages')
        .update({ is_read: true })
        .eq('receiver_id', user.id)
        .eq('sender_id', contactId)
        .eq('is_read', false)
      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, unread: 0 } : c))
    }
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
        .in('status', ['PAGO', 'CONCLUIDA'])

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
    const activeContact = contacts.find(c => c.id === activeContactId)
    const receiverId = activeContact?.pairIds
      ? (activeContact.pairIds.find(id => id !== user.id) ?? activeContact.pairIds[0])
      : activeContactId

    console.log('sendMessage attempting:', {
      sender_id: user.id,
      receiver_id: receiverId,
      activeContactId,
      hasPairIds: !!activeContact?.pairIds,
    })

    const { data: newMsg, error } = await supabase
      .from('messages')
      .insert({
        sender_id: user.id,
        receiver_id: receiverId,
        content: text.trim(),
        subject: null,
        is_read: false,
      })
      .select('*, sender:users!sender_id(id,name,avatar_url)')
      .single()

    console.log('sendMessage result:', { data: !!newMsg, error })

    if (error) {
      console.error('sendMessage error:', error)
      toast('error', 'Erro ao enviar', error.message)
      setSending(false)
      return
    }
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
      console.log('sendCompose attempting:', { sender_id: user.id, receiver_id: composeRecipientId })
      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: composeRecipientId,
        content: composeText.trim(),
        subject: composeSubject.trim() || null,
        is_read: false,
      })
      console.log('sendCompose result:', { error })

      if (error) {
        console.error('sendCompose error:', error)
        toast('error', 'Erro ao enviar mensagem', error.message)
        return
      }

      setComposeOpen(false)
      setComposeRecipientId('')
      setComposeSubject('')
      setComposeText('')

      await loadContacts()
      openConversation(composeRecipientId)
    } finally {
      setComposeSending(false)
    }
  }

  function openConversation(contactId: string) {
    const contact = contacts.find(c => c.id === contactId)
    setActiveContactId(contactId)
    void loadMessages(contactId, contact?.pairIds)
    setMobileView('chat')
  }

  function openSupport() {
    setContacts(prev => {
      if (prev.find(c => c.id === SUPPORT_ID)) return prev
      return [{
        id: SUPPORT_ID,
        name: 'Suporte LOCAFLIX',
        avatar_url: null,
        lastMessage: 'Como podemos ajudar?',
        lastAt: new Date().toISOString(),
        unread: 0,
        lastSubject: 'Suporte',
      }, ...prev]
    })
    openConversation(SUPPORT_ID)
  }

  const activeContact = contacts.find(c => c.id === activeContactId)
  const activeContactName = activeContact?.id === SUPPORT_ID ? 'Suporte LOCAFLIX' : (activeContact?.name ?? 'Usuário')

  const isNonAdmin = profile?.role !== 'ADMIN'
  const navItems = profile?.role === 'OWNER'
    ? [
        { key: 'imoveis',    label: 'Imóveis',    icon: <Home size={16} />,          href: '/anfitriao' },
        { key: 'reservas',   label: 'Reservas',   icon: <Calendar size={16} />,      href: '/anfitriao?tab=reservas' },
        { key: 'financeiro', label: 'Financeiro', icon: <DollarSign size={16} />,    href: '/anfitriao?tab=financeiro' },
        { key: 'avaliacoes', label: 'Avaliações', icon: <Star size={16} />,          href: '/anfitriao?tab=avaliacoes' },
        { key: 'documentos', label: 'Documentos', icon: <ShieldCheck size={16} />,   href: '/anfitriao?tab=documentos' },
        { key: 'mensagens',  label: 'Mensagens',  icon: <MessageSquare size={16} />, href: '/mensagens' },
      ]
    : [
        { key: 'reservas',     label: 'Reservas',     icon: <Calendar size={16} />,      href: '/minha-conta' },
        { key: 'favoritos',    label: 'Favoritos',    icon: <Heart size={16} />,          href: '/minha-conta?tab=favoritos' },
        { key: 'notificacoes', label: 'Notificações', icon: <Bell size={16} />,           href: '/minha-conta?tab=notificacoes' },
        { key: 'documentos',   label: 'Documentos',   icon: <ShieldCheck size={16} />,   href: '/minha-conta?tab=documentos' },
        { key: 'perfil',       label: 'Perfil',       icon: <User size={16} />,           href: '/minha-conta?tab=perfil' },
        { key: 'mensagens',    label: 'Mensagens',    icon: <MessageSquare size={16} />, href: '/mensagens' },
      ]

  return (
    <div className="min-h-screen bg-[#141414] pt-20 flex flex-col overflow-x-hidden">
      {/* Mobile tab bar — non-ADMIN */}
      {isNonAdmin && (
        <div className="lg:hidden sticky top-20 z-30 bg-[#0F0F0F] border-b border-[#333] overflow-x-auto">
          <nav className="flex">
            {navItems.map(item => (
              <Link
                key={item.href}
                to={item.href}
                className={`flex flex-col items-center gap-0.5 px-4 py-2.5 text-[10px] font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  item.key === 'mensagens' ? 'text-[#E50914] border-b-2 border-[#E50914]' : 'text-[#666] hover:text-white'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* Fixed sidebar — non-ADMIN */}
      {isNonAdmin && (
        <aside className="hidden lg:flex flex-col fixed left-0 top-20 w-56 h-[calc(100vh-5rem)] bg-[#0F0F0F] border-r border-[#1F1F1F] z-30">
          <nav className="flex-1 py-4 space-y-1 px-3 overflow-y-auto">
            {navItems.map(item => (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  item.key === 'mensagens'
                    ? 'bg-[#1F1F1F] text-white'
                    : 'text-[#B3B3B3] hover:bg-[#1A1A1A] hover:text-white'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
      )}

      <div className={`flex-1 flex flex-col lg:flex-row w-full py-6 gap-4${isNonAdmin ? ' px-4 lg:pl-60' : ' px-4 max-w-6xl mx-auto'}`}
        style={{ minHeight: 'calc(100vh - 80px)' }}
      >
        {/* ── Contact list ─────────────────────────────── */}
        <div className={`
          flex-shrink-0 bg-[#1F1F1F] border border-[#333] rounded-2xl overflow-hidden flex flex-col
          w-full lg:w-72
          ${mobileView === 'chat' ? 'hidden lg:flex' : 'flex'}
          lg:h-[calc(100vh-160px)]
        `}>
          <div className="px-4 py-3 border-b border-[#333] flex items-center justify-between flex-shrink-0">
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
                const name = contact.id === SUPPORT_ID ? 'Suporte LOCAFLIX' : (contact.name ?? 'Usuário')
                return (
                  <button
                    key={contact.id}
                    onClick={() => openConversation(contact.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isActive ? 'bg-[#2A2A2A]' : 'hover:bg-[#252525]'}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden ${contact.id === SUPPORT_ID ? 'bg-[#E50914]' : 'bg-[#E50914]'}`}>
                      {contact.avatar_url
                        ? <img src={contact.avatar_url} alt="" className="w-full h-full object-cover" />
                        : contact.id === SUPPORT_ID
                          ? <Headphones size={16} />
                          : getInitials(contact.name ?? '?')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-sm font-semibold text-white truncate">{name}</p>
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

          {/* Support button — non-ADMIN only */}
          {isNonAdmin && (
            <button
              onClick={openSupport}
              className="flex items-center gap-3 px-4 py-3 border-t border-[#333] text-[#E50914] hover:bg-[#252525] transition-colors w-full text-left flex-shrink-0"
            >
              <Headphones size={16} />
              <span className="text-sm font-medium">Falar com suporte</span>
            </button>
          )}
        </div>

        {/* ── Chat window ──────────────────────────────── */}
        <div className={`
          flex-1 bg-[#1F1F1F] border border-[#333] rounded-2xl overflow-hidden flex flex-col min-w-0
          ${mobileView === 'list' ? 'hidden lg:flex' : 'flex'}
          lg:h-[calc(100vh-160px)]
        `}>
          {activeContact ? (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-[#333] flex items-center gap-3 flex-shrink-0">
                <button
                  className="lg:hidden text-[#B3B3B3] hover:text-white transition-colors -ml-1 mr-1"
                  onClick={() => setMobileView('list')}
                >
                  <ChevronLeft size={22} />
                </button>
                <div className="w-9 h-9 rounded-full bg-[#E50914] flex items-center justify-center text-sm font-bold text-white overflow-hidden flex-shrink-0">
                  {activeContact.avatar_url
                    ? <img src={activeContact.avatar_url} alt="" className="w-full h-full object-cover" />
                    : activeContact.id === SUPPORT_ID
                      ? <Headphones size={15} />
                      : getInitials(activeContact.name ?? '?')}
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{activeContactName}</p>
                  {activeContact.lastSubject && (
                    <p className="text-xs text-[#B3B3B3]">{activeContact.lastSubject}</p>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-center text-sm text-[#666] py-8">
                    {activeContact.id === SUPPORT_ID
                      ? 'Olá! Envie sua dúvida e nossa equipe responderá em breve.'
                      : 'Nenhuma mensagem ainda. Diga olá!'}
                  </p>
                )}
                {messages.map(m => {
                  const isOwn = m.sender_id === user?.id
                  return (
                    <div key={m.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                      {m.subject && (
                        <p className="text-[10px] text-[#666] mb-1 px-1">Assunto: {m.subject}</p>
                      )}
                      <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
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
              <div className="px-4 py-3 border-t border-[#333] flex gap-3 items-end flex-shrink-0">
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
            <div className="flex-1 flex flex-col items-center justify-center text-[#666] gap-4 p-6">
              <MessageSquare size={48} className="mb-2" />
              <p className="text-sm text-center">Selecione uma conversa</p>
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
              <button onClick={() => setComposeOpen(false)} className="text-[#666] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
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
