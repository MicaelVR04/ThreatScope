import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS_URL  = import.meta.env.VITE_WS_URL  || 'ws://localhost:8000/ws'

export default function useWebSocket() {
  const [alerts, setAlerts] = useState([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (supabase) {
      // --- Supabase path ---
      const fetchInitialAlerts = async () => {
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

      return () => { supabase.removeChannel(channel) }
    }

    // --- Local API / WebSocket path ---
    fetch(`${API_URL}/alerts`)
      .then(r => r.json())
      .then(data => setAlerts(data))
      .catch(() => {})

    const ws = new WebSocket(WS_URL)
    ws.onopen  = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (e) => {
      try {
        const alert = JSON.parse(e.data)
        setAlerts(prev => [alert, ...prev])
      } catch (err) {
        console.warn('Failed to parse WebSocket alert message:', err)
      }
    }

    return () => { ws.close() }
  }, [])

  return { alerts, connected }
}
