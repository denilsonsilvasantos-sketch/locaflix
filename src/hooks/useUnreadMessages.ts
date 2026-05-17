import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

const SUPPORT_ID = '698e7994-96b4-4295-a72d-ba33497387b2'

export function useUnreadMessages() {
  const { user, profile } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0)
      return
    }

    const userId = user.id
    const isAdmin = profile?.role === 'ADMIN'
    let active = true

    async function fetchCount() {
      if (isAdmin) {
        // Admin: count unread messages sent to user's own ID OR to SUPPORT_ID
        const [{ count: c1 }, { count: c2 }] = await Promise.all([
          supabase.from('messages').select('*', { count: 'exact', head: true }).eq('receiver_id', userId).eq('is_read', false),
          supabase.from('messages').select('*', { count: 'exact', head: true }).eq('receiver_id', SUPPORT_ID).eq('is_read', false),
        ])
        if (active) setUnreadCount((c1 ?? 0) + (c2 ?? 0))
      } else {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('receiver_id', userId)
          .eq('is_read', false)
        if (active) setUnreadCount(count ?? 0)
      }
    }

    void fetchCount()

    const ts = Date.now()
    const channels: ReturnType<typeof supabase.channel>[] = []

    try {
      channels.push(
        supabase
          .channel(`messages-unread-${userId}-${ts}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` }, () => { void fetchCount() })
          .subscribe((_s, err) => { if (err) console.warn('[messages realtime]', err) })
      )

      if (isAdmin) {
        channels.push(
          supabase
            .channel(`messages-unread-support-${ts}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${SUPPORT_ID}` }, () => { void fetchCount() })
            .subscribe((_s, err) => { if (err) console.warn('[messages realtime support]', err) })
        )
      }
    } catch (err) {
      console.warn('[messages] failed to subscribe:', err)
    }

    return () => {
      active = false
      channels.forEach(ch => supabase.removeChannel(ch).catch(() => {}))
    }
  }, [user?.id, profile?.role])

  async function markAllRead() {
    if (!user) return
    const promises = [
      supabase.from('messages').update({ is_read: true }).eq('receiver_id', user.id).eq('is_read', false),
    ]
    if (profile?.role === 'ADMIN') {
      promises.push(
        supabase.from('messages').update({ is_read: true }).eq('receiver_id', SUPPORT_ID).eq('is_read', false),
      )
    }
    await Promise.all(promises)
    setUnreadCount(0)
  }

  return { unreadCount, markAllRead }
}
