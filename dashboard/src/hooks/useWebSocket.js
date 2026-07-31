import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function useWebSocket() {
  const [alerts, setAlerts] = useState([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (supabase) {
      // --- Supabase path ---
      let channel
      const connectSupabase = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        const userId = session?.user?.id
        if (!userId || cancelled) return
        const { data, error } = await supabase
          .from('alerts')
          .select('*')
          .eq('user_id', userId)
          .order('timestamp', { ascending: false })
          .limit(200)
        if (!error && !cancelled) {
          setAlerts(data)
          setConnected(true)
        }

        channel = supabase
          .channel(`alerts:${userId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'alerts',
              filter: `user_id=eq.${userId}`,
            },
            (payload) => {
              setAlerts(prev => [payload.new, ...prev].slice(0, 200))
            }
          )
          .subscribe((status) => {
            if (!cancelled) setConnected(status === 'SUBSCRIBED')
          })
      }
      connectSupabase().catch(() => {
        if (!cancelled) setConnected(false)
      })

      return () => {
        cancelled = true
        if (channel) supabase.removeChannel(channel)
      }
    }

    return () => {
      cancelled = true
    }
  }, [])

  return { alerts, connected }
}
