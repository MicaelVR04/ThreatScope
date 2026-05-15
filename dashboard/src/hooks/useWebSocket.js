import { useState, useEffect, useRef, useCallback } from 'react'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://api:8000/ws'
const RECONNECT_DELAY_MS = 3000

export default function useWebSocket() {
  const [alerts, setAlerts]       = useState([])
  const [connected, setConnected] = useState(false)
  const wsRef        = useRef(null)
  const reconnectRef = useRef(null)
  const unmountedRef = useRef(false)

  const connect = useCallback(() => {
    if (unmountedRef.current) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] Connected to', WS_URL)
      setConnected(true)
      clearTimeout(reconnectRef.current)
    }

    ws.onmessage = (event) => {
      try {
        const alert = JSON.parse(event.data)
        setAlerts(prev => [alert, ...prev])
      } catch (err) {
        console.error('[WS] Failed to parse message:', err)
      }
    }

    ws.onclose = () => {
      console.warn('[WS] Disconnected — reconnecting in', RECONNECT_DELAY_MS, 'ms')
      setConnected(false)
      if (!unmountedRef.current) {
        reconnectRef.current = setTimeout(connect, RECONNECT_DELAY_MS)
      }
    }

    ws.onerror = (err) => {
      console.error('[WS] Error:', err)
      ws.close()
    }
  }, [])

  useEffect(() => {
    unmountedRef.current = false
    connect()

    return () => {
      unmountedRef.current = true
      clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { alerts, connected }
}
