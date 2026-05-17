import { useEffect, useRef, useState } from 'react'
import { Bell, Calendar, Check, ChevronDown, ChevronLeft, DollarSign, Edit, Headphones, Heart, History, Home, MessageSquare, Paperclip, Send, ShieldCheck, Star, User, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Message } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/Button'
import { Lightbox } from '../components/ui/Lightbox'
import { getInitials } from '../lib/utils'

const SUPPORT_ID = '698e7994-96b4-4295-a72d-ba33497387b2'

type TicketStatus = 'ABERTO' | 'EM_ATENDIMENTO' | 'AGUARDANDO_USUARIO' | 'RESOLVIDO' | 'ARQUIVADO'
type TicketPriority = 'NORMAL' | 'URGENTE' | 'CRITICO'
interface Ticket {
  id: string
  participants: string[]
  subject: string | null
  status: TicketStatus
  priority: TicketPriority
  resolved_at: string | null
}

const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  ABERTO: 'Aberto', EM_ATENDIMENTO: 'Em Atendimento',
  AGUARDANDO_USUARIO: 'Aguardando Usuário', RESOLVIDO: 'Resolvido', ARQUIVADO: 'Arquivado',
}

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
  const location = useLocation()
  const pendingStartChatRef = useRef<string | null>(
    (location.state as { startChatWith?: string } | null)?.startChatWith ?? null
  )
  const [contacts, setContacts] = useState<Contact[]>([])
  const [activeContactId, setActiveContactId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list')
  const bottomRef = useRef<HTMLDivElement>(null)
  const activeContactIdRef = useRef<string | null>(null)
  const activePairIdsRef = useRef<[string, string] | null>(null)
  const adminIdsRef = useRef<string[]>([])
  const attachmentRef = useRef<HTMLInputElement>(null)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  // Tickets
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const [historyTickets, setHistoryTickets] = useState<(Ticket & { displayName?: string })[]>([])
  const [contactsTab, setContactsTab] = useState<'ativas' | 'historico'>('ativas')
  const [contactStatusFilter, setContactStatusFilter] = useState<TicketStatus | 'TODOS'>('TODOS')
  const [contactTicketMap, setContactTicketMap] = useState<Record<string, TicketStatus>>({})

  // Compose
  const [composeOpen, setComposeOpen] = useState(false)
  const [recipientList, setRecipientList] = useState<Recipient[]>([])
  const [composeRecipientId, setComposeRecipientId] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeText, setComposeText] = useState('')
  const [composeSending, setComposeSending] = useState(false)

  useEffect(() => {
    activeContactIdRef.current = activeContactId
    const contact = contacts.find(c => c.id === activeContactId)
    activePairIdsRef.current = contact?.pairIds ?? null
  }, [activeContactId, contacts])

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

    function handleIncoming(m: Message) {
      const pair = activePairIdsRef.current

      if (pair) {
        const allAdminIds = new Set([SUPPORT_ID, ...adminIdsRef.current])
        const nonAdminId = pair.find(id => !allAdminIds.has(id)) ?? pair[1]
        if (m.sender_id === nonAdminId) {
          setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m])
        }
        const pairKey = [...pair].sort().join('__')
        setContacts(prev =>
          prev.map(c => c.id === pairKey
            ? { ...c, lastMessage: m.content, lastAt: m.created_at }
            : c
          ).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
        )
      } else {
        const effectiveSender = adminIdsRef.current.includes(m.sender_id) ? SUPPORT_ID : m.sender_id
        if (effectiveSender === activeContactIdRef.current) {
          setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m])
        }
        setContacts(prev => {
          const exists = prev.find(c => c.id === effectiveSender)
          if (exists) {
            return prev.map(c => c.id === effectiveSender
              ? { ...c, lastMessage: m.content, lastAt: m.created_at, unread: effectiveSender !== activeContactIdRef.current ? c.unread + 1 : c.unread }
              : c
            ).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
          }
          void loadContacts()
          return prev
        })
      }
    }

    const ts = Date.now()
    const channels = [
      supabase
        .channel(`messages-inbox-${user.id}-${ts}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        }, payload => handleIncoming(payload.new as Message))
        .subscribe(),
    ]

    if (profile?.role === 'ADMIN') {
      channels.push(
        supabase
          .channel(`messages-inbox-support-${ts}`)
          .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'messages',
            filter: `receiver_id=eq.${SUPPORT_ID}`,
          }, payload => handleIncoming(payload.new as Message))
          .subscribe()
      )
    }

    return () => { channels.forEach(ch => supabase.removeChannel(ch)) }
  }, [user?.id, profile?.role])

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
      .select('id, name, avatar_url, role')
      .in('id', otherIds)

    const userMap: Record<string, { name: string | null; avatar_url: string | null }> = {}
    const newAdminIds: string[] = []
    for (const u of usersData ?? []) {
      userMap[u.id] = u
      if ((u as { role?: string }).role === 'ADMIN') newAdminIds.push(u.id)
    }
    adminIdsRef.current = newAdminIds

    const map: Record<string, Contact> = {}
    for (const m of msgs) {
      const rawOtherId = m.sender_id === user.id ? m.receiver_id : m.sender_id
      if (!rawOtherId) continue
      // Normalize: replies from any admin collapse into the SUPPORT_ID conversation
      const otherId = newAdminIds.includes(rawOtherId) ? SUPPORT_ID : rawOtherId
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
    const { data: usersData } = await supabase.from('users').select('id, name, avatar_url, role').in('id', allIds)
    const userMap: Record<string, { name: string | null; avatar_url: string | null }> = {}
    // All IDs that belong to admin accounts (normalised to SUPPORT_ID in pairs)
    const adminIdSet = new Set<string>([SUPPORT_ID])
    for (const u of usersData ?? []) {
      userMap[u.id] = u
      if ((u as { role?: string }).role === 'ADMIN') adminIdSet.add(u.id)
    }
    // Keep non-SUPPORT admins in the shared ref so loadMessages can include them
    adminIdsRef.current = [...adminIdSet].filter(id => id !== SUPPORT_ID)

    const map: Record<string, Contact> = {}
    for (const m of msgs) {
      if (!m.sender_id || !m.receiver_id) continue
      // Normalise: any admin account → SUPPORT_ID
      const sid = adminIdSet.has(m.sender_id)   ? SUPPORT_ID : m.sender_id
      const rid = adminIdSet.has(m.receiver_id) ? SUPPORT_ID : m.receiver_id
      if (sid === rid) continue // skip admin↔admin messages
      const pair = [sid, rid].sort() as [string, string]
      const pairKey = pair.join('__')
      if (!map[pairKey]) {
        const nonAdminId = pair.find(id => id !== SUPPORT_ID) ?? pair[0]
        const displayName = userMap[nonAdminId]?.name ?? 'Usuário'
        map[pairKey] = {
          id: pairKey,
          name: displayName,
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

    const pending = pendingStartChatRef.current
    if (pending) {
      pendingStartChatRef.current = null
      const pairKey = [SUPPORT_ID, pending].sort().join('__')
      const existing = sorted.find(c => c.id === pairKey)
      if (existing) {
        setContacts(sorted)
        setActiveContactId(pairKey)
        void loadMessages(pairKey, existing.pairIds)
        void loadOrCreateTicket(pending)
        setMobileView('chat')
      } else {
        const { data: targetUser } = await supabase.from('users').select('id,name,avatar_url').eq('id', pending).maybeSingle()
        const pair = [SUPPORT_ID, pending].sort() as [string, string]
        const synthetic: Contact = {
          id: pair.join('__'), name: `Suporte ↔ ${targetUser?.name ?? 'Usuário'}`,
          avatar_url: null, lastMessage: 'Nova conversa', lastAt: new Date().toISOString(),
          unread: 0, lastSubject: null, pairIds: pair,
        }
        setContacts([synthetic, ...sorted])
        setActiveContactId(synthetic.id)
        setMessages([])
        setMobileView('chat')
        void loadOrCreateTicket(pending)
      }
      return
    }

    setContacts(sorted)
    void loadContactTicketStatuses()
    if (!activeContactIdRef.current && sorted.length > 0) {
      setActiveContactId(sorted[0].id)
      await loadMessages(sorted[0].id, sorted[0].pairIds)
    }
  }

  async function loadContactTicketStatuses() {
    try {
      const { data } = await supabase
        .from('conversation_tickets')
        .select('participants, status')
        .order('created_at', { ascending: false })
      if (!data) return
      const map: Record<string, TicketStatus> = {}
      for (const ticket of data as Pick<Ticket, 'participants' | 'status'>[]) {
        const nonAdminId = ticket.participants.find(id => id !== SUPPORT_ID && !adminIdsRef.current.includes(id))
        if (!nonAdminId) continue
        const pairKey = [SUPPORT_ID, nonAdminId].sort().join('__')
        if (!map[pairKey]) map[pairKey] = ticket.status
      }
      setContactTicketMap(map)
    } catch { /* table may not exist yet */ }
  }

  async function loadMessages(contactId: string, pairIds?: [string, string]) {
    if (!user?.id) return

    if (!pairIds && contactId === SUPPORT_ID) {
      // Non-admin support conversation. Ensure we know all admin IDs.
      if (adminIdsRef.current.length === 0) {
        const { data: admins } = await supabase.from('users').select('id').eq('role', 'ADMIN')
        adminIdsRef.current = (admins ?? []).map((a: { id: string }) => a.id)
      }
      const adminClauses = adminIdsRef.current
        .map(aid => `and(sender_id.eq.${aid},receiver_id.eq.${user.id})`)
        .join(',')
      const orFilter = [
        `and(sender_id.eq.${user.id},receiver_id.eq.${SUPPORT_ID})`,
        `and(sender_id.eq.${SUPPORT_ID},receiver_id.eq.${user.id})`,
        ...(adminClauses ? [adminClauses] : []),
      ].join(',')

      const { data } = await supabase
        .from('messages').select('*').or(orFilter)
        .order('created_at', { ascending: true }).limit(100)

      setMessages((data ?? []) as Message[])
      setContacts(prev => prev.map(c => c.id === SUPPORT_ID ? { ...c, unread: 0 } : c))
      return
    }

    if (pairIds && pairIds.includes(SUPPORT_ID)) {
      // Admin conversation with a user. Query messages from SUPPORT_ID AND admin's real UUID.
      const nonAdminId = pairIds.find(id => id !== SUPPORT_ID)!
      const adminSideIds = [...new Set([SUPPORT_ID, user.id, ...adminIdsRef.current])]
      const clauses = adminSideIds.flatMap(aid => [
        `and(sender_id.eq.${aid},receiver_id.eq.${nonAdminId})`,
        `and(sender_id.eq.${nonAdminId},receiver_id.eq.${aid})`,
      ]).join(',')

      const { data } = await supabase
        .from('messages').select('*').or(clauses)
        .order('created_at', { ascending: true }).limit(100)

      setMessages((data ?? []) as Message[])
      return
    }

    const [uid1, uid2] = pairIds ?? [user.id, contactId]
    const { data } = await supabase
      .from('messages')
      .select('*')
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

  async function uploadAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !activeContactId || !user) return
    setUploadingAttachment(true)
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('message-attachments').upload(path, file, { upsert: true })
    if (upErr) {
      toast('error', 'Erro ao enviar foto', upErr.message)
      setUploadingAttachment(false)
      e.target.value = ''
      return
    }
    const { data: urlData } = supabase.storage.from('message-attachments').getPublicUrl(path)
    const imageUrl = urlData.publicUrl
    // Send the image URL as a message
    const activeContact = contacts.find(c => c.id === activeContactId)
    let receiverId: string
    if (activeContact?.pairIds) {
      const myIndex = activeContact.pairIds.findIndex(id => id === user.id)
      receiverId = myIndex !== -1
        ? activeContact.pairIds[1 - myIndex]
        : (activeContact.pairIds.find(id => id !== SUPPORT_ID) ?? activeContact.pairIds[0])
    } else {
      receiverId = activeContactId
    }
    const { data: newMsg } = await supabase.from('messages').insert({
      sender_id: user.id, receiver_id: receiverId, content: imageUrl, subject: null, is_read: false,
    }).select('*').maybeSingle()
    if (newMsg) setMessages(prev => [...prev, newMsg as Message])
    setContacts(prev => prev.map(c =>
      c.id === activeContactId ? { ...c, lastMessage: '📷 Foto', lastAt: new Date().toISOString() } : c
    ))
    e.target.value = ''
    setUploadingAttachment(false)
  }

  async function sendMessage() {
    if (!text.trim() || !activeContactId || !user) return
    setSending(true)
    const activeContact = contacts.find(c => c.id === activeContactId)
    let receiverId: string
    if (activeContact?.pairIds) {
      const myIndex = activeContact.pairIds.findIndex(id => id === user.id)
      receiverId = myIndex !== -1
        ? activeContact.pairIds[1 - myIndex]
        : (activeContact.pairIds.find(id => id !== SUPPORT_ID) ?? activeContact.pairIds[0])
    } else {
      receiverId = activeContactId
    }

    const { data: newMsg, error } = await supabase
      .from('messages')
      .insert({
        sender_id: user.id,
        receiver_id: receiverId,
        content: text.trim(),
        subject: null,
        is_read: false,
      })
      .select('*')
      .maybeSingle()

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
      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: composeRecipientId,
        content: composeText.trim(),
        subject: composeSubject.trim() || null,
        is_read: false,
      })
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

  function makeLocalTicket(participants: string[]): Ticket {
    return { id: '__local__', participants, subject: null, status: 'ABERTO', priority: 'NORMAL', resolved_at: null }
  }

  async function loadOrCreateTicket(nonAdminId: string) {
    if (!user?.id) return
    try {
      const { data: existing, error: selErr } = await supabase
        .from('conversation_tickets')
        .select('id, participants, subject, status, priority, resolved_at')
        .contains('participants', [nonAdminId])
        .not('status', 'in', '("RESOLVIDO","ARQUIVADO")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (selErr) throw selErr
      if (existing) { setActiveTicket(existing as Ticket); return }
      const { data: created, error: insErr } = await supabase
        .from('conversation_tickets')
        .insert({ participants: [SUPPORT_ID, nonAdminId], status: 'ABERTO', priority: 'NORMAL', created_by: user.id })
        .select()
        .maybeSingle()
      if (insErr) throw insErr
      setActiveTicket((created as Ticket | null) ?? makeLocalTicket([SUPPORT_ID, nonAdminId]))
    } catch {
      setActiveTicket(makeLocalTicket([SUPPORT_ID, nonAdminId]))
    }
  }

  async function loadTicketForUser() {
    if (!user?.id) return
    try {
      const { data, error } = await supabase
        .from('conversation_tickets')
        .select('id, participants, subject, status, priority, resolved_at')
        .contains('participants', [user.id])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      setActiveTicket((data as Ticket | null) ?? makeLocalTicket([SUPPORT_ID, user.id]))
    } catch {
      setActiveTicket(makeLocalTicket([SUPPORT_ID, user.id]))
    }
  }

  async function updateTicket(patch: Partial<Pick<Ticket, 'status' | 'priority'>>) {
    if (!activeTicket) return
    const update: Record<string, unknown> = { ...patch }
    if (patch.status === 'RESOLVIDO') update.resolved_at = new Date().toISOString()
    if (activeTicket.id === '__local__') {
      setActiveTicket(prev => prev ? { ...prev, ...update } as Ticket : prev)
      return
    }
    const { data } = await supabase
      .from('conversation_tickets').update(update).eq('id', activeTicket.id).select().maybeSingle()
    if (data) setActiveTicket(data as Ticket)
  }

  async function createNewSupportTicket() {
    if (!user?.id) return
    try {
      const { data, error } = await supabase
        .from('conversation_tickets')
        .insert({ participants: [SUPPORT_ID, user.id], status: 'ABERTO', priority: 'NORMAL', created_by: user.id })
        .select().maybeSingle()
      if (error) throw error
      setActiveTicket((data as Ticket | null) ?? makeLocalTicket([SUPPORT_ID, user.id]))
    } catch {
      setActiveTicket(makeLocalTicket([SUPPORT_ID, user.id]))
    }
  }

  async function loadHistoryTickets() {
    if (!user?.id) return
    try {
      const { data } = await supabase
        .from('conversation_tickets')
        .select('id, participants, subject, status, priority, resolved_at, created_at')
        .in('status', ['RESOLVIDO', 'ARQUIVADO'])
        .order('resolved_at', { ascending: false })
        .limit(50)
      if (!data || data.length === 0) { setHistoryTickets([]); return }
      if (profile?.role === 'ADMIN') {
        const nonAdminIds = [...new Set(
          (data as Ticket[]).flatMap(t => t.participants.filter(id => id !== SUPPORT_ID && !adminIdsRef.current.includes(id)))
        )]
        const { data: usersData } = nonAdminIds.length
          ? await supabase.from('users').select('id, name').in('id', nonAdminIds)
          : { data: [] }
        const uMap = Object.fromEntries((usersData ?? []).map((u: { id: string; name: string | null }) => [u.id, u.name ?? 'Usuário']))
        setHistoryTickets((data as Ticket[]).map(t => ({
          ...t,
          displayName: uMap[t.participants.find(id => id !== SUPPORT_ID && !adminIdsRef.current.includes(id)) ?? ''] ?? 'Usuário',
        })))
      } else {
        setHistoryTickets(data as Ticket[])
      }
    } catch { setHistoryTickets([]) }
  }

  function openConversation(contactId: string) {
    const contact = contacts.find(c => c.id === contactId)
    setActiveContactId(contactId)
    setActiveTicket(null)
    void loadMessages(contactId, contact?.pairIds)
    setMobileView('chat')
    if (profile?.role === 'ADMIN' && contact?.pairIds?.includes(SUPPORT_ID)) {
      const nonAdminId = contact.pairIds.find(id => id !== SUPPORT_ID)
      if (nonAdminId) void loadOrCreateTicket(nonAdminId)
    } else if (profile?.role !== 'ADMIN' && contactId === SUPPORT_ID) {
      void loadTicketForUser()
    }
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
    <>
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

          {profile?.role === 'ADMIN' && (
            <>
              <div className="flex border-b border-[#333] flex-shrink-0">
                <button
                  onClick={() => setContactsTab('ativas')}
                  className={`flex-1 py-2 text-xs font-semibold transition-colors ${contactsTab === 'ativas' ? 'text-white border-b-2 border-[#E50914]' : 'text-[#555] hover:text-white'}`}
                >
                  Conversas
                </button>
                <button
                  onClick={() => { setContactsTab('historico'); void loadHistoryTickets() }}
                  className={`flex-1 py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${contactsTab === 'historico' ? 'text-white border-b-2 border-[#E50914]' : 'text-[#555] hover:text-white'}`}
                >
                  <History size={11} />Histórico
                </button>
              </div>
              {contactsTab === 'ativas' && (
                <div className="px-3 py-1.5 border-b border-[#2A2A2A] flex-shrink-0">
                  <select
                    value={contactStatusFilter}
                    onChange={e => setContactStatusFilter(e.target.value as TicketStatus | 'TODOS')}
                    className="w-full bg-[#2A2A2A] border border-[#333] rounded-lg px-2 py-1.5 text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="TODOS">Todos os status</option>
                    {(Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]).map(s => (
                      <option key={s} value={s}>{TICKET_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <div className="flex-1 overflow-y-auto">
            {contactsTab === 'historico' ? (
              historyTickets.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <History size={32} className="mx-auto text-[#333] mb-3" />
                  <p className="text-xs text-[#666]">Nenhum ticket resolvido.</p>
                </div>
              ) : (
                historyTickets.map(ticket => (
                  <div key={ticket.id} className="px-4 py-3 border-b border-[#2A2A2A] flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white truncate">{ticket.displayName ?? 'Suporte'}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${ticket.status === 'ARQUIVADO' ? 'bg-[#333] text-[#666]' : 'bg-[#46D369]/10 text-[#46D369]'}`}>
                        {ticket.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#555] truncate">{ticket.subject ?? 'Sem assunto'}</p>
                    {ticket.resolved_at && (
                      <p className="text-[10px] text-[#444]">
                        Resolvido: {new Date(ticket.resolved_at).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                ))
              )
            ) : contacts.length === 0 ? (
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
              contacts
                .filter(c => {
                  if (contactStatusFilter === 'TODOS') return true
                  const status = contactTicketMap[c.id] ?? 'ABERTO'
                  return status === contactStatusFilter
                })
                .map(contact => {
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

              {/* Ticket panel — admin only */}
              {profile?.role === 'ADMIN' && activeTicket && (
                <div className="px-4 py-2 border-b border-[#333] bg-[#161616] flex-shrink-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-[#444] font-medium uppercase tracking-wider">Ticket</span>
                    <select
                      value={activeTicket.status}
                      onChange={e => void updateTicket({ status: e.target.value as TicketStatus })}
                      className="bg-[#1A1A1A] border border-[#333] rounded px-2 py-0.5 text-xs text-white outline-none cursor-pointer"
                    >
                      {(Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]).map(s => (
                        <option key={s} value={s}>{TICKET_STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      activeTicket.priority === 'CRITICO'
                        ? 'bg-[#E50914]/10 border-[#E50914]/30 text-[#E50914]'
                        : activeTicket.priority === 'URGENTE'
                          ? 'bg-[#F5A623]/10 border-[#F5A623]/30 text-[#F5A623]'
                          : 'bg-[#333]/50 border-[#333] text-[#666]'
                    }`}>
                      {activeTicket.priority}
                    </span>
                    <div className="ml-auto flex gap-1.5">
                      {!(['RESOLVIDO', 'ARQUIVADO'] as TicketStatus[]).includes(activeTicket.status) && (
                        <>
                          <button
                            onClick={() => void updateTicket({ status: 'RESOLVIDO' })}
                            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-[#46D369] border border-[#46D369]/30 rounded hover:bg-[#46D369]/10 transition-colors"
                          >
                            <Check size={10} /> Resolvido
                          </button>
                          <button
                            onClick={() => void updateTicket({ priority: activeTicket.priority === 'URGENTE' ? 'NORMAL' : 'URGENTE' })}
                            className={`px-2 py-0.5 text-[10px] font-bold border rounded transition-colors ${
                              activeTicket.priority === 'URGENTE'
                                ? 'text-[#F5A623] border-[#F5A623]/30 bg-[#F5A623]/10'
                                : 'text-[#555] border-[#333] hover:text-[#F5A623]'
                            }`}
                          >
                            Urgente
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Conversa encerrada — non-admin when ticket resolved */}
              {isNonAdmin && activeTicket?.status === 'RESOLVIDO' && activeContact?.id === SUPPORT_ID && (
                <div className="px-4 py-3 border-b border-[#333] bg-[#161616] flex-shrink-0 text-center">
                  <p className="text-xs text-[#B3B3B3]">Esta conversa foi encerrada pela equipe de suporte.</p>
                  <button
                    onClick={() => void createNewSupportTicket()}
                    className="mt-1.5 text-xs text-[#E50914] hover:underline"
                  >
                    Abrir nova conversa
                  </button>
                </div>
              )}

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
                  const isOwn = profile?.role === 'ADMIN'
                    ? (m.sender_id === SUPPORT_ID || adminIdsRef.current.includes(m.sender_id) || m.sender_id === user?.id)
                    : m.sender_id === user?.id
                  return (
                    <div key={m.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                      {m.subject && (
                        <p className="text-[10px] text-[#666] mb-1 px-1">Assunto: {m.subject}</p>
                      )}
                      <div className={`max-w-[80%] rounded-2xl text-sm overflow-hidden ${
                        isOwn
                          ? 'bg-[#E50914] text-white rounded-tr-sm'
                          : 'bg-[#2A2A2A] text-white rounded-tl-sm'
                      }`}>
                        {/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|avif|heic)(\?.*)?$/i.test(m.content)
                          ? <img src={m.content} alt="anexo" className="max-w-full rounded-2xl object-cover cursor-zoom-in" onClick={() => setLightboxSrc(m.content)} />
                          : <p className="whitespace-pre-wrap break-words px-4 py-2.5">{m.content}</p>
                        }
                        <p className={`text-[10px] px-4 pb-2 ${isOwn ? 'text-white/60 text-right' : 'text-[#666]'}`}>
                          {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input or closed banner */}
              {activeTicket && (['RESOLVIDO', 'ARQUIVADO'] as TicketStatus[]).includes(activeTicket.status) ? (
                <div className="px-4 py-4 border-t border-[#333] bg-[#161616] flex-shrink-0 text-center space-y-1.5">
                  <p className="text-xs text-[#666]">Esta conversa foi encerrada.</p>
                  {profile?.role === 'ADMIN' && (
                    <button
                      onClick={() => void updateTicket({ status: 'EM_ATENDIMENTO' })}
                      className="text-xs text-[#E50914] hover:underline"
                    >
                      Reabrir conversa
                    </button>
                  )}
                  {isNonAdmin && activeContact?.id === SUPPORT_ID && (
                    <button
                      onClick={() => void createNewSupportTicket()}
                      className="text-xs text-[#E50914] hover:underline"
                    >
                      Abrir nova conversa
                    </button>
                  )}
                </div>
              ) : (
                <div className="px-4 py-3 border-t border-[#333] flex gap-2 items-end flex-shrink-0">
                  <button
                    onClick={() => attachmentRef.current?.click()}
                    disabled={uploadingAttachment}
                    className="w-10 h-10 bg-[#2A2A2A] border border-[#333] rounded-xl flex items-center justify-center text-[#666] hover:text-white hover:border-[#555] transition-colors disabled:opacity-50 flex-shrink-0"
                    title="Anexar foto"
                  >
                    {uploadingAttachment
                      ? <span className="w-4 h-4 border-2 border-[#E50914] border-t-transparent rounded-full animate-spin" />
                      : <Paperclip size={16} />}
                  </button>
                  <input ref={attachmentRef} type="file" accept="image/*" className="hidden" onChange={e => void uploadAttachment(e)} />
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
              )}
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
    <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </>
  )
}
