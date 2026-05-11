import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { AuthContextValue, UserProfile, UserRole } from '../types'

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(uid: string): Promise<UserProfile | null> {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', uid)
      .single()

    if (data) {
      setProfile(data as UserProfile)
      return data as UserProfile
    }

    // Profile missing (DB was reset) — recreate from auth metadata
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return null

      const role: UserRole =
        (authUser.user_metadata?.role as UserRole) ?? 'GUEST'

      const { data: upserted } = await supabase
        .from('users')
        .upsert({
          id: uid,
          email: authUser.email ?? '',
          name: authUser.user_metadata?.name ?? authUser.user_metadata?.full_name ?? '',
          role,
        })
        .select()
        .single()

      if (upserted) {
        setProfile(upserted as UserProfile)
        return upserted as UserProfile
      }
    } catch { /* ignore */ }

    return null
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string): Promise<UserProfile | null> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    if (data.user) {
      setUser(data.user)
      return await fetchProfile(data.user.id)
    }
    return null
  }

  async function signUp(
    email: string,
    password: string,
    name: string,
    role: UserRole,
    extra?: Partial<UserProfile>,
  ) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error

    // Fire-and-forget: session may not exist until email is confirmed (PKCE).
    // fetchProfile() will recreate the row on first sign-in if this fails.
    if (data.user) {
      supabase.from('users').upsert({
        id: data.user.id,
        email,
        name,
        role,
        ...extra,
      }).then(({ error: e }) => {
        if (e) console.warn('[signUp] profile upsert:', e.message)
      })
    }
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signInWithGoogle, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
