import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function useWebSocket() {
  const [alerts, setAlerts] = useState([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    // Fetch existing alerts on mount
    async function fetchInitialAlerts() {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(20)
      if (!error) {
        setAlerts(data)
        setConnected(true)
      }
    }
    fetchInitialAlerts()

    // Subscribe to new alerts in real time
    const channel = supabase
      .channel('alerts-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        (payload) => {
          setAlerts(prev => [payload.new, ...prev])
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { alerts, connected }
}
