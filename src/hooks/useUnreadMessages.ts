import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useUnreadMessages() {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0)
      return
    }

    const userId = user.id
    let active = true

    async function fetchCount() {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', userId)
        .eq('is_read', false)
      if (active) setUnreadCount(count ?? 0)
    }

    void fetchCount()

    const channelName = `messages-unread-${userId}-${Date.now()}`
    let channel: ReturnType<typeof supabase.channel> | null = null

    try {
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` },
          () => { void fetchCount() },
        )
        .subscribe((_status, err) => {
          if (err) console.warn('[messages realtime]', err)
        })
    } catch (err) {
      console.warn('[messages] failed to subscribe:', err)
    }

    return () => {
      active = false
      if (channel) supabase.removeChannel(channel).catch(() => {})
    }
  }, [user?.id])

  async function markAllRead() {
    if (!user) return
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('receiver_id', user.id)
      .eq('is_read', false)
    setUnreadCount(0)
  }

  return { unreadCount, markAllRead }
}
