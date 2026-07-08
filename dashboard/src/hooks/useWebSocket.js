import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS_URL  = import.meta.env.VITE_WS_URL  || 'ws://localhost:8000/ws'
const RECONNECT_DELAY_MS = 3000

export default function useWebSocket() {
  const [alerts, setAlerts] = useState([])
  const [connected, setConnected] = useState(false)
  const wsRef             = useRef(null)
  const reconnectTimerRef = useRef(null)

  useEffect(() => {
    if (supabase) {
      // --- Supabase path ---
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

    let active = true

    function connect() {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => { if (active) setConnected(true) }

      ws.onclose = () => {
        if (!active) return
        setConnected(false)
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS)
      }

      ws.onmessage = (e) => {
        if (!active) return
        try {
          const alert = JSON.parse(e.data)
          setAlerts(prev => [alert, ...prev])
        } catch {}
      }
    }

    connect()

    return () => {
      active = false
      clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, [])

  return { alerts, connected }
}
