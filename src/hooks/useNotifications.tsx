import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Notification } from '../types'
import { useAuth } from './useAuth'

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user?.id) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    const userId = user.id
    let active = true

    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (active && data) {
          setNotifications(data as Notification[])
          setUnreadCount(data.filter(n => !n.is_read).length)
        }
      })

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        payload => {
          if (!active) return
          const n = payload.new as Notification
          setNotifications(prev => [n, ...prev])
          setUnreadCount(c => c + 1)
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  async function markAllRead() {
    if (!user) return
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnreadCount(c => Math.max(0, c - 1))
  }

  return { notifications, unreadCount, markAllRead, markRead }
}
